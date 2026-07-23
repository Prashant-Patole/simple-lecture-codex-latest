CREATE OR REPLACE FUNCTION public.find_similar_questions(
  p_text text,
  p_subject_id uuid DEFAULT NULL::uuid,
  p_topic_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 6
)
RETURNS TABLE(id uuid, question_text text, score real, bucket text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_topic_ids uuid[];
  v_chapter_ids uuid[];
BEGIN
  IF p_text IS NULL OR length(btrim(p_text)) < 3 THEN
    RETURN;
  END IF;

  IF p_subject_id IS NOT NULL THEN
    SELECT array_agg(t.id) INTO v_topic_ids
    FROM public.subject_topics t
    JOIN public.subject_chapters c ON c.id = t.chapter_id
    WHERE c.subject_id = p_subject_id;

    SELECT array_agg(c.id) INTO v_chapter_ids
    FROM public.subject_chapters c
    WHERE c.subject_id = p_subject_id;
  END IF;

  RETURN QUERY
  WITH stopwords(word) AS (
    VALUES
      ('what'), ('when'), ('where'), ('which'), ('who'), ('whom'), ('whose'), ('why'), ('how'),
      ('was'), ('were'), ('are'), ('is'), ('am'), ('be'), ('been'), ('being'), ('the'), ('a'), ('an'),
      ('and'), ('or'), ('of'), ('in'), ('on'), ('to'), ('from'), ('for'), ('with'), ('by'), ('into'),
      ('explain'), ('describe'), ('write'), ('give'), ('name'), ('state'), ('define'), ('short'), ('note')
  ),
  query_tokens AS (
    SELECT DISTINCT tok.token
    FROM regexp_split_to_table(regexp_replace(lower(p_text), '[^a-z0-9 ]', ' ', 'g'), '[[:space:]]+') AS tok(token)
    WHERE length(tok.token) >= 3
      AND NOT EXISTS (SELECT 1 FROM stopwords sw WHERE sw.word = tok.token)
  ),
  candidates AS (
    SELECT
      q.id AS candidate_id,
      q.question_text AS candidate_question_text,
      similarity(lower(q.question_text), lower(p_text)) AS trg,
      word_similarity(lower(q.question_text), lower(p_text)) AS word_trg,
      strict_word_similarity(lower(q.question_text), lower(p_text)) AS strict_trg
    FROM public.questions q
    WHERE (p_topic_id IS NULL OR q.topic_id = p_topic_id)
      AND (
        p_subject_id IS NULL
        OR (v_topic_ids IS NOT NULL AND q.topic_id = ANY(v_topic_ids))
        OR (v_chapter_ids IS NOT NULL AND q.chapter_id = ANY(v_chapter_ids))
      )
      AND length(btrim(q.question_text)) >= 3
    ORDER BY GREATEST(
      similarity(lower(q.question_text), lower(p_text)),
      word_similarity(lower(q.question_text), lower(p_text)),
      strict_word_similarity(lower(q.question_text), lower(p_text))
    ) DESC
    LIMIT 500
  ),
  candidate_tokens AS (
    SELECT DISTINCT c.candidate_id, tok.token
    FROM candidates c
    CROSS JOIN LATERAL regexp_split_to_table(regexp_replace(lower(c.candidate_question_text), '[^a-z0-9 ]', ' ', 'g'), '[[:space:]]+') AS tok(token)
    WHERE length(tok.token) >= 3
      AND NOT EXISTS (SELECT 1 FROM stopwords sw WHERE sw.word = tok.token)
  ),
  scored AS (
    SELECT
      c.candidate_id,
      c.candidate_question_text,
      c.trg,
      c.word_trg,
      c.strict_trg,
      COALESCE((
        SELECT COUNT(*)::real
        FROM query_tokens qt
        WHERE EXISTS (
          SELECT 1
          FROM candidate_tokens ct
          WHERE ct.candidate_id = c.candidate_id
            AND (
              ct.token = qt.token
              OR similarity(ct.token, qt.token) >= 0.62
              OR word_similarity(ct.token, qt.token) >= 0.82
            )
        )
      ), 0) / NULLIF((SELECT COUNT(*)::real FROM query_tokens), 0) AS fuzzy_coverage,
      COALESCE((
        SELECT COUNT(*)::real FROM (
          SELECT ct.token FROM candidate_tokens ct WHERE ct.candidate_id = c.candidate_id
          INTERSECT
          SELECT qt.token FROM query_tokens qt
        ) i
      ), 0) / NULLIF((
        SELECT COUNT(*)::real FROM (
          SELECT ct.token FROM candidate_tokens ct WHERE ct.candidate_id = c.candidate_id
          UNION
          SELECT qt.token FROM query_tokens qt
        ) u
      ), 0) AS jac
    FROM candidates c
  ),
  final_scores AS (
    SELECT
      s.candidate_id,
      s.candidate_question_text,
      GREATEST(
        (0.45 * COALESCE(s.fuzzy_coverage, 0) + 0.25 * s.word_trg + 0.20 * s.trg + 0.10 * COALESCE(s.jac, 0)),
        (0.50 * COALESCE(s.jac, 0) + 0.50 * s.trg)
      )::real AS final_score
    FROM scored s
  )
  SELECT
    fs.candidate_id AS id,
    fs.candidate_question_text AS question_text,
    fs.final_score AS score,
    CASE
      WHEN fs.final_score >= 0.75 THEN 'near_duplicate'
      WHEN fs.final_score >= 0.45 THEN 'related'
      ELSE 'weak'
    END AS bucket
  FROM final_scores fs
  WHERE fs.final_score >= 0.45
  ORDER BY fs.final_score DESC
  LIMIT p_limit;
END;
$function$;