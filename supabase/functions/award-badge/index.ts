import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TAG = '[award-badge]';

async function badgeExists(
  supabase: any,
  studentId: string,
  badgeType: string,
  filters: Record<string, string | null>
): Promise<boolean> {
  let query = supabase
    .from('student_badges')
    .select('id')
    .eq('student_id', studentId)
    .eq('badge_type', badgeType);

  for (const [key, value] of Object.entries(filters)) {
    if (value) query = query.eq(key, value);
  }

  const { data } = await query.maybeSingle();
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log(`${TAG} ERROR: No auth header`);
      return new Response(JSON.stringify({ error: 'No auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.log(`${TAG} AUTH ERROR:`, authError?.message || 'no user');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { topicId, chapterId, subjectId, courseId, topicTitle } = await req.json();
    const studentId = user.id;
    const badges: string[] = [];

    console.log(`${TAG} START | studentId=${studentId} | topicId=${topicId} | chapterId=${chapterId} | subjectId=${subjectId} | courseId=${courseId} | topicTitle="${topicTitle}"`);

    // 1. BRONZE badge for topic completion (one per topic)
    if (topicId) {
      const exists = await badgeExists(supabase, studentId, 'bronze', { topic_id: topicId });
      console.log(`${TAG} BRONZE: exists=${exists} for topicId=${topicId}`);
      if (!exists) {
        const { error } = await supabase.from('student_badges').insert({
          student_id: studentId,
          badge_type: 'bronze',
          topic_id: topicId,
          chapter_id: chapterId || null,
          // No subject_id/course_id to avoid idx_student_badge_subject constraint
          title: `Topic Completed: ${topicTitle || 'Unknown'}`,
          description: 'Earned by watching the full lecture video',
        });
        if (error) {
          console.error(`${TAG} BRONZE INSERT ERROR:`, error.message);
        } else {
          badges.push('bronze');
          console.log(`${TAG} BRONZE: awarded ✅`);
        }
      }
    }

    // 2. SILVER: all topics in chapter have bronze badges
    if (chapterId) {
      const { data: chapterTopics } = await supabase
        .from('subject_topics').select('id').eq('chapter_id', chapterId);
      const topicCount = chapterTopics?.length || 0;
      console.log(`${TAG} SILVER CHECK: chapterId=${chapterId} | totalTopics=${topicCount}`);

      if (chapterTopics && topicCount > 0) {
        const { data: bronzeBadges } = await supabase
          .from('student_badges').select('topic_id')
          .eq('student_id', studentId).eq('badge_type', 'bronze')
          .in('topic_id', chapterTopics.map(t => t.id));
        const bronzeCount = bronzeBadges?.length || 0;
        console.log(`${TAG} SILVER CHECK: bronzeBadges=${bronzeCount}/${topicCount}`);

        if (bronzeCount >= topicCount) {
          const exists = await badgeExists(supabase, studentId, 'silver', { chapter_id: chapterId });
          if (!exists) {
            const { data: chapter } = await supabase
              .from('subject_chapters').select('title').eq('id', chapterId).single();
            const { error } = await supabase.from('student_badges').insert({
              student_id: studentId,
              badge_type: 'silver',
              chapter_id: chapterId,
              subject_id: subjectId || null,
              course_id: courseId || null,
              title: `Chapter Completed: ${chapter?.title || 'Unknown'}`,
              description: 'Earned by completing all topics in this chapter',
            });
            if (error) console.error(`${TAG} SILVER ERROR:`, error.message);
            else { badges.push('silver'); console.log(`${TAG} SILVER: awarded ✅`); }
          }
        }
      }
    }

    // 3. GOLD (3+ chapters) & MASTER (ALL chapters) — check silver (chapter) badges
    if (subjectId) {
      const { data: subjectChapters } = await supabase
        .from('subject_chapters').select('id').eq('subject_id', subjectId);
      const chapterCount = subjectChapters?.length || 0;
      console.log(`${TAG} GOLD/MASTER CHECK: subjectId=${subjectId} | totalChapters=${chapterCount}`);

      if (subjectChapters && chapterCount > 0) {
        const { data: silverBadges } = await supabase
          .from('student_badges').select('chapter_id')
          .eq('student_id', studentId).eq('badge_type', 'silver')
          .in('chapter_id', subjectChapters.map(c => c.id));
        const silverCount = silverBadges?.length || 0;
        console.log(`${TAG} GOLD/MASTER CHECK: silverBadges=${silverCount}/${chapterCount}`);

        if (silverCount >= 3) {
          const exists = await badgeExists(supabase, studentId, 'gold', { subject_id: subjectId });
          if (!exists) {
            const { data: subject } = await supabase
              .from('popular_subjects').select('name').eq('id', subjectId).single();
            const { error } = await supabase.from('student_badges').insert({
              student_id: studentId,
              badge_type: 'gold',
              subject_id: subjectId,
              course_id: courseId || null,
              title: `Gold Achievement: ${subject?.name || 'Unknown'}`,
              description: 'Earned by completing 3 chapters in this subject',
            });
            if (error) console.error(`${TAG} GOLD ERROR:`, error.message);
            else { badges.push('gold'); console.log(`${TAG} GOLD: awarded ✅`); }
          }
        }

        if (silverCount >= chapterCount) {
          const exists = await badgeExists(supabase, studentId, 'master', { subject_id: subjectId });
          if (!exists) {
            const { data: subject } = await supabase
              .from('popular_subjects').select('name').eq('id', subjectId).single();
            const { error } = await supabase.from('student_badges').insert({
              student_id: studentId,
              badge_type: 'master',
              subject_id: subjectId,
              course_id: courseId || null,
              title: `Subject Mastered: ${subject?.name || 'Unknown'}`,
              description: 'Earned by completing all chapters in this subject',
            });
            if (error) console.error(`${TAG} MASTER ERROR:`, error.message);
            else { badges.push('master'); console.log(`${TAG} MASTER: awarded ✅`); }
          }
        }
      }
    }

    // 4. COURSE COMPLETE
    if (courseId) {
      const { data: courseSubjects } = await supabase
        .from('course_subjects').select('subject_id').eq('course_id', courseId);
      const subjectCount = courseSubjects?.length || 0;
      console.log(`${TAG} COURSE CHECK: courseId=${courseId} | totalSubjects=${subjectCount}`);

      if (courseSubjects && subjectCount > 0) {
        const { data: masterBadges } = await supabase
          .from('student_badges').select('subject_id')
          .eq('student_id', studentId).eq('badge_type', 'master')
          .in('subject_id', courseSubjects.map(s => s.subject_id));
        const masterCount = masterBadges?.length || 0;
        console.log(`${TAG} COURSE CHECK: masterBadges=${masterCount}/${subjectCount}`);

        if (masterCount >= subjectCount) {
          const exists = await badgeExists(supabase, studentId, 'course_complete', { course_id: courseId });
          if (!exists) {
            const { data: course } = await supabase
              .from('courses').select('name').eq('id', courseId).single();
            const { error } = await supabase.from('student_badges').insert({
              student_id: studentId,
              badge_type: 'course_complete',
              course_id: courseId,
              title: `Course Completed: ${course?.name || 'Unknown'}`,
              description: 'Earned by mastering all subjects in this course',
            });
            if (error) console.error(`${TAG} COURSE_COMPLETE ERROR:`, error.message);
            else { badges.push('course_complete'); console.log(`${TAG} COURSE_COMPLETE: awarded ✅`); }
          }
        }
      }
    }

    console.log(`${TAG} DONE | badges_awarded=${JSON.stringify(badges)}`);
    return new Response(
      JSON.stringify({ success: true, badges_awarded: badges }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(`${TAG} FATAL ERROR:`, err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
