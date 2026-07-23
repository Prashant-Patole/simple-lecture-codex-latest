// Scans topics that have both an uploaded document (ai_assistant_documents)
// and a published video_generation_job. For each topic:
//   Level 1 (STRUCTURAL): does each doc "## " heading correspond to a
//     dedicated section in presentation_json (matched against section titles)?
//   Level 2 (NARRATION): does each heading's keywords appear anywhere in
//     the concatenated narration text?
//
// Returns per-heading verdict:
//   fully_covered   — has dedicated section AND mentioned in narration
//   mentioned_only  — no dedicated section, only referenced in narration
//   missing         — absent from both
//   title_only      — has section but not mentioned (rare)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const STOPWORDS = new Set([
  "the","a","an","of","and","or","to","in","on","for","with","by","is","are",
  "as","at","from","this","that","these","those","be","been","being","it","its",
  "into","about","how","what","why","when","which","who","whom","whose","not",
  "no","do","does","did","done","have","has","had","will","would","should","can",
  "could","may","might","must","shall","also","such","than","then","so","if",
  "but","because","while","between","among","other","others","any","all","each",
  "every","some","more","most","less","few","many","much","own","same","only",
  "just","very","up","down","out","off","over","under","again","further","once"
]);

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function extractHeadings(md: string): string[] {
  const lines = md.split(/\r?\n/);
  const headings: string[] = [];
  for (const raw of lines) {
    const m = raw.match(/^\s{0,3}##\s+(.+?)\s*$/);
    if (!m) continue;
    let h = m[1].replace(/\*\*/g, "").replace(/^[\d.\)\s]+/, "").replace(/:\s*$/, "").trim();
    if (h.length < 2) continue;
    headings.push(h);
  }
  return headings;
}

function keywordsOf(heading: string): string[] {
  return normalise(heading)
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function keywordOverlap(kws: string[], targetNorm: string): number {
  if (kws.length === 0) return 1;
  let hits = 0;
  for (const kw of kws) if (targetNorm.includes(kw)) hits++;
  return hits / kws.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const subjectId: string | null = body?.subjectId ?? null;
    const topicId: string | null = body?.topic_id ?? body?.topicId ?? null;
    const mode: "keyword" | "ai" = body?.mode === "ai" ? "ai" : "keyword";

    let docQ = supabase
      .from("ai_assistant_documents")
      .select("id, topic_id, subject_id, chapter_id, file_name, full_content, content_preview")
      .not("topic_id", "is", null);
    if (subjectId) docQ = docQ.eq("subject_id", subjectId);
    if (topicId) docQ = docQ.eq("topic_id", topicId);
    const { data: docs, error: docsErr } = await docQ;
    if (docsErr) throw docsErr;
    if (!docs?.length) {
      return new Response(JSON.stringify({ topics: [], summary: { total: 0 } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const docIds = docs.map((d) => d.id);
    const { data: jobs, error: jobsErr } = await supabase
      .from("video_generation_jobs")
      .select("id, document_id, presentation_json, is_published, status, created_at")
      .in("document_id", docIds)
      .eq("is_published", true)
      .eq("status", "completed")
      .order("created_at", { ascending: false });
    if (jobsErr) throw jobsErr;

    const jobByDoc = new Map<string, any>();
    for (const j of jobs || []) {
      if (!jobByDoc.has(j.document_id)) jobByDoc.set(j.document_id, j);
    }

    const topicIds = Array.from(new Set(docs.map((d) => d.topic_id).filter(Boolean))) as string[];
    const subjectIds = Array.from(new Set(docs.map((d) => d.subject_id).filter(Boolean))) as string[];
    const chapterIds = Array.from(new Set(docs.map((d) => d.chapter_id).filter(Boolean))) as string[];

    const [topicsRes, subjectsRes, chaptersRes] = await Promise.all([
      supabase.from("subject_topics").select("id, title").in("id", topicIds),
      supabase.from("popular_subjects").select("id, name").in("id", subjectIds),
      supabase.from("subject_chapters").select("id, title").in("id", chapterIds),
    ]);
    const topicMap = new Map((topicsRes.data || []).map((t) => [t.id, t.title]));
    const subjMap = new Map((subjectsRes.data || []).map((s) => [s.id, s.name]));
    const chapMap = new Map((chaptersRes.data || []).map((c) => [c.id, c.title]));

    const results: any[] = [];
    for (const d of docs) {
      const job = jobByDoc.get(d.id);
      const md: string =
        (d.full_content && (d.full_content as any).content_markdown) ||
        d.content_preview ||
        "";
      const headings = extractHeadings(md);

      const base = {
        topic_id: d.topic_id,
        topic_title: topicMap.get(d.topic_id) || "(unknown)",
        subject_id: d.subject_id,
        subject_name: subjMap.get(d.subject_id) || "",
        chapter_id: d.chapter_id,
        chapter_title: chapMap.get(d.chapter_id) || "",
        file_name: d.file_name,
        headings_total: headings.length,
      };

      if (!job) {
        results.push({
          ...base,
          headings_detail: headings.map((h) => ({ heading: h, status: "missing", in_section_title: false, in_narration: false })),
          headings_missing: headings,
          headings_missing_slide: headings,
          section_count: 0,
          presentation_sections: [],
          structural_coverage_pct: 0,
          narration_coverage_pct: 0,
          coverage_pct: 0,
          has_published_lecture: false,
        });
        continue;
      }

      const sections: any[] = job.presentation_json?.sections || [];

      // Level 1: collect section title strings
      const sectionTitles: { section_id: string; title: string; norm: string }[] = [];
      const narrationParts: string[] = [];
      for (const s of sections) {
        const title = String(s?.title || s?.slide?.title || s?.section_title || "").trim();
        if (title) {
          sectionTitles.push({
            section_id: String(s?.section_id || s?.id || ""),
            title,
            norm: normalise(title),
          });
        }
        // Also include summary first line & key_points[0] as a heading candidate
        if (s?.summary) {
          const firstLine = String(s.summary).split(/\r?\n/)[0]?.trim();
          if (firstLine) sectionTitles.push({ section_id: String(s?.section_id || s?.id || ""), title: firstLine, norm: normalise(firstLine) });
        }

        // Narration accumulation
        const segs = s?.narration?.segments || [];
        for (const seg of segs) if (seg?.text) narrationParts.push(String(seg.text));
        if (s?.narration?.full_text) narrationParts.push(String(s.narration.full_text));
        if (s?.summary) narrationParts.push(String(s.summary));
        if (Array.isArray(s?.key_points)) for (const kp of s.key_points) narrationParts.push(String(kp));
        for (const vb of s?.visual_beats || []) {
          if (typeof vb?.display_text === "string") narrationParts.push(vb.display_text);
          else if (Array.isArray(vb?.display_text)) narrationParts.push(vb.display_text.join(" "));
        }
      }

      const narrationNorm = normalise(narrationParts.join(" "));

      const headings_detail = headings.map((h) => {
        const kws = keywordsOf(h);
        // Structural: check against any section title with ≥60% keyword overlap
        let matched_section_title: string | undefined;
        for (const st of sectionTitles) {
          if (keywordOverlap(kws, st.norm) >= 0.6) {
            matched_section_title = st.title;
            break;
          }
        }
        const in_section_title = !!matched_section_title;
        const in_narration = keywordOverlap(kws, narrationNorm) >= 0.6;
        let status: "fully_covered" | "mentioned_only" | "missing" | "title_only";
        if (in_section_title && in_narration) status = "fully_covered";
        else if (!in_section_title && in_narration) status = "mentioned_only";
        else if (in_section_title && !in_narration) status = "title_only";
        else status = "missing";
        return { heading: h, in_section_title, in_narration, status, matched_section_title };
      });

      const withSlide = headings_detail.filter((h) => h.in_section_title).length;
      const withNarration = headings_detail.filter((h) => h.in_narration).length;
      const structural_pct = headings.length ? Math.round((withSlide / headings.length) * 100) : 100;
      const narration_pct = headings.length ? Math.round((withNarration / headings.length) * 100) : 100;

      const headings_missing_slide = headings_detail.filter((h) => !h.in_section_title).map((h) => h.heading);
      const headings_missing = headings_detail.filter((h) => h.status === "missing").map((h) => h.heading);

      results.push({
        ...base,
        headings_detail,
        headings_missing,
        headings_missing_slide,
        headings_covered: withSlide,
        section_count: sections.length,
        presentation_sections: sectionTitles
          .filter((s, i, arr) => arr.findIndex((x) => x.title === s.title) === i)
          .map((s) => ({ section_id: s.section_id, title: s.title })),
        structural_coverage_pct: structural_pct,
        narration_coverage_pct: narration_pct,
        coverage_pct: structural_pct, // primary metric = structural
        has_published_lecture: true,
      });
    }

    // Optional: AI-powered deep analysis for a single topic
    if (mode === "ai" && topicId && results.length === 1 && results[0].has_published_lecture) {
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      const row = results[0];
      const doc = docs[0];
      const md: string =
        (doc.full_content && (doc.full_content as any).content_markdown) ||
        doc.content_preview ||
        "";
      if (!apiKey) {
        row.ai_feedback = { error: "LOVABLE_API_KEY not configured" };
      } else {
        try {
          const slidesForAI = row.presentation_sections.slice(0, 40);
          const truncatedDoc = md.slice(0, 40000);
          const sys = `You are a curriculum QA reviewer. Compare a source document's ## headings against a generated presentation's sections. Return STRICT JSON only, no prose.`;
          const user = `SOURCE DOC HEADINGS (extracted):\n${row.headings_detail.map((h: any) => "- " + h.heading).join("\n")}\n\nPRESENTATION SECTION TITLES:\n${slidesForAI.map((s: any, i: number) => `${i + 1}. ${s.title}`).join("\n")}\n\nSOURCE DOC (markdown, may be truncated):\n${truncatedDoc}\n\nReturn JSON:\n{\n  "overall_summary": "one-sentence verdict",\n  "structural_coverage_pct": 0-100,\n  "headings": [{"heading":"","status":"covered|partial|missing","matched_section_title":"or null","reason":"short","suggested_slide_title":"or null"}],\n  "recommended_new_sections": ["title", ...]\n}`;

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": apiKey,
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash",
              messages: [
                { role: "system", content: sys },
                { role: "user", content: user },
              ],
              response_format: { type: "json_object" },
              temperature: 0.2,
            }),
          });
          if (!aiRes.ok) {
            const errTxt = await aiRes.text();
            row.ai_feedback = { error: `AI ${aiRes.status}: ${errTxt.slice(0, 300)}` };
          } else {
            const aiJson = await aiRes.json();
            const content = aiJson?.choices?.[0]?.message?.content || "{}";
            let parsed: any = {};
            try { parsed = JSON.parse(content); } catch { parsed = { raw: content }; }
            row.ai_feedback = parsed;

            // Merge AI verdicts into headings_detail
            if (Array.isArray(parsed?.headings)) {
              const aiMap = new Map(parsed.headings.map((h: any) => [String(h.heading || "").toLowerCase().trim(), h]));
              row.headings_detail = row.headings_detail.map((h: any) => {
                const ai = aiMap.get(h.heading.toLowerCase().trim());
                if (!ai) return h;
                let status = h.status;
                if (ai.status === "missing") status = "missing";
                else if (ai.status === "covered") status = "fully_covered";
                else if (ai.status === "partial") status = h.in_section_title ? "title_only" : "mentioned_only";
                return {
                  ...h,
                  status,
                  ai_status: ai.status,
                  ai_reason: ai.reason,
                  ai_suggested_slide_title: ai.suggested_slide_title,
                  matched_section_title: h.matched_section_title || ai.matched_section_title || undefined,
                };
              });
            }
          }
        } catch (e) {
          row.ai_feedback = { error: String((e as Error)?.message || e) };
        }
      }
    }

    const summary = {
      total: results.length,
      published: results.filter((r) => r.has_published_lecture).length,
      unpublished: results.filter((r) => !r.has_published_lecture).length,
      fully_covered: results.filter((r) => r.has_published_lecture && r.headings_total > 0 && r.headings_missing_slide.length === 0).length,
      partially_covered: results.filter((r) => r.has_published_lecture && r.headings_missing_slide.length > 0 && r.structural_coverage_pct >= 50).length,
      poorly_covered: results.filter((r) => r.has_published_lecture && r.structural_coverage_pct < 50 && r.headings_total > 0).length,
      no_headings: results.filter((r) => r.headings_total === 0).length,
      total_headings_missing_slide: results.reduce((acc, r) => acc + (r.headings_missing_slide?.length || 0), 0),
      total_headings_mentioned_only: results.reduce(
        (acc, r) => acc + (r.headings_detail?.filter((h: any) => h.status === "mentioned_only").length || 0),
        0,
      ),
    };

    return new Response(JSON.stringify({ topics: results, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-topic-content-coverage error:", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
