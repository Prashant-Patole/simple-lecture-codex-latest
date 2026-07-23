import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Types
export interface CourseAuditSummary {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  subjectCount: number;
  subjects: { id: string; name: string }[];
}

export interface SubjectAuditDetail {
  id: string;
  name: string;
  chapterCount: number;
  topicCount: number;
  videoCoverage: number;
  questionCoverage: number;
  topicsWithVideo: number;
  topicsWithQuestions: number;
  publishedVideoCoverage: number;
  verifiedQuestionCoverage: number;
  topicsWithPublishedVideo: number;
  topicsWithVerifiedQuestions: number;
}

export interface ChapterAuditDetail {
  id: string;
  title: string;
  chapterNumber: number;
  topicCount: number;
  topicsWithVideo: number;
  topicsWithQuestions: number;
  topicsWithPublishedVideo: number;
  topicsWithVerifiedQuestions: number;
}

export interface TopicAuditDetail {
  id: string;
  title: string;
  topicNumber: number | string;
  videoUrl: string | null;
  aiGeneratedVideoUrl: string | null;
  videoId: string | null;
  videoPlatform: string | null;
  aiPodcastUrl: string | null;
  pdfUrl: string | null;
  topicVideoCount: number;
  questionCount: number;
  completedJobCount: number;
  publishedJobCount: number;
  verifiedQuestionCount: number;
  videoPlayerUrl: string | null;
}

// Paginated fetch to avoid 1000-row limit
async function paginatedFetch(
  table: string,
  selectCols: string,
  filterCol: string,
  filterValues: string[],
  extraFilters?: { col: string; val: string }[]
) {
  const PAGE_SIZE = 1000;
  const allRows: any[] = [];
  for (let i = 0; i < filterValues.length; i += 500) {
    const batch = filterValues.slice(i, i + 500);
    let offset = 0;
    let hasMore = true;
    while (hasMore) {
      let q = supabase.from(table as any).select(selectCols).in(filterCol, batch);
      if (extraFilters) {
        for (const f of extraFilters) {
          q = q.eq(f.col, f.val) as any;
        }
      }
      const { data, error } = await (q as any).range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      allRows.push(...(data || []));
      hasMore = (data?.length || 0) === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
  }
  return allRows;
}

// Fetch all courses with their subjects
export function useAuditCourses() {
  return useQuery({
    queryKey: ["content-audit", "courses"],
    queryFn: async () => {
      const { data: courses, error: cErr } = await supabase
        .from("courses")
        .select("id, name, slug, category")
        .eq("is_active", true)
        .order("name");
      if (cErr) throw cErr;

      const { data: courseSubjects, error: csErr } = await supabase
        .from("course_subjects")
        .select("course_id, subject_id, popular_subjects(id, name)")
        .order("display_order");
      if (csErr) throw csErr;

      const map = new Map<string, { id: string; name: string }[]>();
      for (const cs of courseSubjects || []) {
        const subj = cs.popular_subjects as any;
        if (!subj) continue;
        const list = map.get(cs.course_id) || [];
        list.push({ id: subj.id, name: subj.name });
        map.set(cs.course_id, list);
      }

      return (courses || []).map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        category: c.category,
        subjectCount: (map.get(c.id) || []).length,
        subjects: map.get(c.id) || [],
      })) as CourseAuditSummary[];
    },
  });
}

// Helper: count topics with video generation jobs
async function fetchJobCounts(topicIds: string[]) {
  const completedJobCounts = new Map<string, number>();
  const publishedJobCounts = new Map<string, number>();
  const videoPlayerUrls = new Map<string, string>();

  if (topicIds.length === 0) return { completedJobCounts, publishedJobCounts, videoPlayerUrls };

  // Get documents linked to these topics
  const docs = await paginatedFetch("ai_assistant_documents", "id, topic_id", "topic_id", topicIds);
  if (docs.length === 0) return { completedJobCounts, publishedJobCounts, videoPlayerUrls };

  const docIds = docs.map((d: any) => d.id);
  const docToTopic = new Map<string, string>();
  for (const d of docs) {
    if (d.topic_id) docToTopic.set(d.id, d.topic_id);
  }

  // Get completed jobs with video_url
  const jobs = await paginatedFetch(
    "video_generation_jobs", "document_id, is_published, video_url", "document_id", docIds,
    [{ col: "status", val: "completed" }]
  );
  for (const job of jobs) {
    const tid = docToTopic.get(job.document_id);
    if (tid) {
      completedJobCounts.set(tid, (completedJobCounts.get(tid) || 0) + 1);
      if (job.is_published) {
        publishedJobCounts.set(tid, (publishedJobCounts.get(tid) || 0) + 1);
      }
      // Priority: published job URL > first completed job URL
      if (job.video_url) {
        const existing = videoPlayerUrls.get(tid);
        if (!existing || job.is_published) {
          videoPlayerUrls.set(tid, job.video_url);
        }
      }
    }
  }

  return { completedJobCounts, publishedJobCounts, videoPlayerUrls };
}

// Fetch subject-level audit detail for a given list of subject IDs
export function useSubjectAuditDetails(subjectIds: string[]) {
  return useQuery({
    queryKey: ["content-audit", "subjects", subjectIds],
    enabled: subjectIds.length > 0,
    queryFn: async () => {
      const { data: chapters, error: chErr } = await supabase
        .from("subject_chapters")
        .select("id, subject_id")
        .in("subject_id", subjectIds);
      if (chErr) throw chErr;

      const chapterIds = (chapters || []).map((c) => c.id);

      let topics: any[] = [];
      if (chapterIds.length > 0) {
        for (let i = 0; i < chapterIds.length; i += 500) {
          const batch = chapterIds.slice(i, i + 500);
          const { data, error } = await supabase
            .from("subject_topics")
            .select("id, chapter_id, video_url, ai_generated_video_url, video_id")
            .in("chapter_id", batch);
          if (error) throw error;
          topics = topics.concat(data || []);
        }
      }

      const topicIds = topics.map((t) => t.id);

      // Paginated fetches
      const topicVideoRows = await paginatedFetch("topic_videos", "topic_id", "topic_id", topicIds);
      const topicVideoCounts = new Map<string, number>();
      for (const tv of topicVideoRows) {
        topicVideoCounts.set(tv.topic_id, (topicVideoCounts.get(tv.topic_id) || 0) + 1);
      }

      const questionRows = await paginatedFetch("questions", "topic_id, is_verified", "topic_id", topicIds);
      const questionCounts = new Map<string, number>();
      const verifiedQuestionCounts = new Map<string, number>();
      for (const q of questionRows) {
        if (q.topic_id) {
          questionCounts.set(q.topic_id, (questionCounts.get(q.topic_id) || 0) + 1);
          if (q.is_verified) {
            verifiedQuestionCounts.set(q.topic_id, (verifiedQuestionCounts.get(q.topic_id) || 0) + 1);
          }
        }
      }

      const { completedJobCounts, publishedJobCounts } = await fetchJobCounts(topicIds);

      const chapterToSubject = new Map<string, string>();
      for (const ch of chapters || []) {
        chapterToSubject.set(ch.id, ch.subject_id);
      }

      const subjectMap = new Map<string, SubjectAuditDetail>();
      for (const sid of subjectIds) {
        subjectMap.set(sid, {
          id: sid, name: "", chapterCount: 0, topicCount: 0,
          videoCoverage: 0, questionCoverage: 0, topicsWithVideo: 0, topicsWithQuestions: 0,
          publishedVideoCoverage: 0, verifiedQuestionCoverage: 0,
          topicsWithPublishedVideo: 0, topicsWithVerifiedQuestions: 0,
        });
      }

      for (const ch of chapters || []) {
        const s = subjectMap.get(ch.subject_id);
        if (s) s.chapterCount++;
      }

      for (const t of topics) {
        const subjId = chapterToSubject.get(t.chapter_id);
        if (!subjId) continue;
        const s = subjectMap.get(subjId);
        if (!s) continue;
        s.topicCount++;

        const hasVideo = !!(t.video_url || t.ai_generated_video_url || t.video_id || (topicVideoCounts.get(t.id) || 0) > 0 || (completedJobCounts.get(t.id) || 0) > 0);
        if (hasVideo) s.topicsWithVideo++;

        const hasPublishedVideo = !!(t.video_url || t.video_id || (publishedJobCounts.get(t.id) || 0) > 0);
        if (hasPublishedVideo) s.topicsWithPublishedVideo++;

        if ((questionCounts.get(t.id) || 0) > 0) s.topicsWithQuestions++;
        if ((verifiedQuestionCounts.get(t.id) || 0) > 0) s.topicsWithVerifiedQuestions++;
      }

      for (const s of subjectMap.values()) {
        s.videoCoverage = s.topicCount > 0 ? Math.round((s.topicsWithVideo / s.topicCount) * 100) : 0;
        s.questionCoverage = s.topicCount > 0 ? Math.round((s.topicsWithQuestions / s.topicCount) * 100) : 0;
        s.publishedVideoCoverage = s.topicCount > 0 ? Math.round((s.topicsWithPublishedVideo / s.topicCount) * 100) : 0;
        s.verifiedQuestionCoverage = s.topicCount > 0 ? Math.round((s.topicsWithVerifiedQuestions / s.topicCount) * 100) : 0;
      }

      return subjectMap;
    },
  });
}

// Fetch chapter-level audit for a specific subject
export function useChapterAuditDetails(subjectId: string | null) {
  return useQuery({
    queryKey: ["content-audit", "chapters", subjectId],
    enabled: !!subjectId,
    queryFn: async () => {
      const { data: chapters, error: chErr } = await supabase
        .from("subject_chapters")
        .select("id, title, chapter_number")
        .eq("subject_id", subjectId!)
        .order("chapter_number");
      if (chErr) throw chErr;

      const chapterIds = (chapters || []).map((c) => c.id);
      if (chapterIds.length === 0) return [];

      const { data: topics, error: tErr } = await supabase
        .from("subject_topics")
        .select("id, chapter_id, video_url, ai_generated_video_url, video_id")
        .in("chapter_id", chapterIds);
      if (tErr) throw tErr;

      const topicIds = (topics || []).map((t) => t.id);

      const topicVideoRows = await paginatedFetch("topic_videos", "topic_id", "topic_id", topicIds);
      const topicVideoCounts = new Map<string, number>();
      for (const tv of topicVideoRows) {
        topicVideoCounts.set(tv.topic_id, (topicVideoCounts.get(tv.topic_id) || 0) + 1);
      }

      const questionRows = await paginatedFetch("questions", "topic_id, is_verified", "topic_id", topicIds);
      const questionCounts = new Map<string, number>();
      const verifiedQuestionCounts = new Map<string, number>();
      for (const q of questionRows) {
        if (q.topic_id) {
          questionCounts.set(q.topic_id, (questionCounts.get(q.topic_id) || 0) + 1);
          if (q.is_verified) verifiedQuestionCounts.set(q.topic_id, (verifiedQuestionCounts.get(q.topic_id) || 0) + 1);
        }
      }

      const { completedJobCounts, publishedJobCounts } = await fetchJobCounts(topicIds);

      return (chapters || []).map((ch) => {
        const chTopics = (topics || []).filter((t) => t.chapter_id === ch.id);
        let withVideo = 0, withQuestions = 0, withPublishedVideo = 0, withVerifiedQuestions = 0;
        for (const t of chTopics) {
          if (t.video_url || t.ai_generated_video_url || t.video_id || (topicVideoCounts.get(t.id) || 0) > 0 || (completedJobCounts.get(t.id) || 0) > 0) withVideo++;
          if (t.video_url || t.video_id || (publishedJobCounts.get(t.id) || 0) > 0) withPublishedVideo++;
          if ((questionCounts.get(t.id) || 0) > 0) withQuestions++;
          if ((verifiedQuestionCounts.get(t.id) || 0) > 0) withVerifiedQuestions++;
        }
        return {
          id: ch.id, title: ch.title, chapterNumber: ch.chapter_number,
          topicCount: chTopics.length, topicsWithVideo: withVideo, topicsWithQuestions: withQuestions,
          topicsWithPublishedVideo: withPublishedVideo, topicsWithVerifiedQuestions: withVerifiedQuestions,
        } as ChapterAuditDetail;
      });
    },
  });
}

// Fetch topic-level audit for a specific chapter
export function useTopicAuditDetails(chapterId: string | null) {
  return useQuery({
    queryKey: ["content-audit", "topics", chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const { data: topics, error: tErr } = await supabase
        .from("subject_topics")
        .select("id, title, topic_number, video_url, ai_generated_video_url, video_id, video_platform, ai_generated_podcast_url, pdf_url")
        .eq("chapter_id", chapterId!)
        .order("topic_number");
      if (tErr) throw tErr;

      const topicIds = (topics || []).map((t) => t.id);

      const topicVideoCounts = new Map<string, number>();
      const questionCounts = new Map<string, number>();
      const verifiedQuestionCounts = new Map<string, number>();

      if (topicIds.length > 0) {
        const [tvRows, qRows] = await Promise.all([
          paginatedFetch("topic_videos", "topic_id", "topic_id", topicIds),
          paginatedFetch("questions", "topic_id, is_verified", "topic_id", topicIds),
        ]);

        for (const tv of tvRows) {
          topicVideoCounts.set(tv.topic_id, (topicVideoCounts.get(tv.topic_id) || 0) + 1);
        }
        for (const q of qRows) {
          if (q.topic_id) {
            questionCounts.set(q.topic_id, (questionCounts.get(q.topic_id) || 0) + 1);
            if (q.is_verified) {
              verifiedQuestionCounts.set(q.topic_id, (verifiedQuestionCounts.get(q.topic_id) || 0) + 1);
            }
          }
        }
      }

      const { completedJobCounts, publishedJobCounts, videoPlayerUrls } = await fetchJobCounts(topicIds);

      return (topics || []).map((t) => ({
        id: t.id, title: t.title, topicNumber: t.topic_number,
        videoUrl: t.video_url, aiGeneratedVideoUrl: t.ai_generated_video_url,
        videoId: t.video_id, videoPlatform: t.video_platform,
        aiPodcastUrl: t.ai_generated_podcast_url, pdfUrl: t.pdf_url,
        topicVideoCount: topicVideoCounts.get(t.id) || 0,
        questionCount: questionCounts.get(t.id) || 0,
        completedJobCount: completedJobCounts.get(t.id) || 0,
        publishedJobCount: publishedJobCounts.get(t.id) || 0,
        verifiedQuestionCount: verifiedQuestionCounts.get(t.id) || 0,
        videoPlayerUrl: videoPlayerUrls.get(t.id) || null,
      })) as TopicAuditDetail[];
    },
  });
}

// Hook to fetch subject name by ID
export function useSubjectName(subjectId: string | null) {
  return useQuery({
    queryKey: ["content-audit", "subject-name", subjectId],
    enabled: !!subjectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("popular_subjects")
        .select("id, name")
        .eq("id", subjectId!)
        .single();
      if (error) throw error;
      return data as { id: string; name: string };
    },
  });
}

// Hook to fetch chapter breadcrumb info (chapter title + parent subject)
export function useChapterBreadcrumb(chapterId: string | null) {
  return useQuery({
    queryKey: ["content-audit", "chapter-breadcrumb", chapterId],
    enabled: !!chapterId,
    queryFn: async () => {
      const { data: chapter, error: chErr } = await supabase
        .from("subject_chapters")
        .select("id, title, chapter_number, subject_id")
        .eq("id", chapterId!)
        .single();
      if (chErr) throw chErr;

      const { data: subject, error: sErr } = await supabase
        .from("popular_subjects")
        .select("id, name")
        .eq("id", chapter.subject_id)
        .single();
      if (sErr) throw sErr;

      return {
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        chapterNumber: chapter.chapter_number,
        subjectId: subject.id,
        subjectName: subject.name,
      };
    },
  });
}
