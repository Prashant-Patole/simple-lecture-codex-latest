import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NotesSegment {
  text?: string;
  purpose?: string;
  duration_seconds?: number;
}

export interface NotesVisualBeat {
  visual_type?: string;
  display_text?: string | string[];
  image_url?: string;
  latex?: string;
  start_time?: number;
  end_time?: number;
}

export interface NotesSection {
  section_id: string;
  section_type?: string;
  title: string;
  narration?: {
    full_text?: string;
    segments?: NotesSegment[];
    total_duration_seconds?: number;
  };
  visual_beats?: NotesVisualBeat[];
  summary?: string;
  key_points?: string[];
}

export interface TopicNotesQuestion {
  id: string;
  question_text: string;
  question_type: string;
  question_format?: string | null;
  options?: any;
  correct_answer?: string | null;
  explanation?: string | null;
  difficulty?: string | null;
  subtopic_id?: string | null;
  is_ai_generated?: boolean;
  is_verified?: boolean;
}

export interface TopicNotesData {
  jobId: string | null;
  sourceUpdatedAt: string | null;
  sections: NotesSection[];
  questionsBySection: Record<string, TopicNotesQuestion[]>;
  allQuestions: TopicNotesQuestion[];
  hasPublishedLecture: boolean;
  /** Where the presentation payload came from for this render. */
  source: "db" | "cdn" | "empty";
}

/**
 * Fetches the latest published presentation_json for a topic (the exact JSON
 * used by the V3/V4 player) and buckets Question Bank items by section.
 *
 * When the DB row's presentation_json.sections is empty, falls back to the
 * render server via the `notes-backfill-presentation` edge function, which
 * also writes the JSON back to the DB so subsequent loads serve from `db`.
 */
export function useTopicNotes(topicId?: string | null) {
  return useQuery<TopicNotesData>({
    queryKey: ["topic-notes", topicId],
    enabled: !!topicId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      // 1. Latest published, completed video job for this topic
      const { data: docs, error: docsErr } = await supabase
        .from("ai_assistant_documents")
        .select("id")
        .eq("topic_id", topicId!);
      if (docsErr) throw docsErr;

      const docIds = (docs || []).map((d) => d.id);
      let job: any = null;
      if (docIds.length) {
        const { data: jobs, error: jobsErr } = await supabase
          .from("video_generation_jobs")
          .select(
            "id, presentation_json, updated_at, created_at, external_job_id, server_ip"
          )
          .in("document_id", docIds)
          .eq("is_published", true)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(1);
        if (jobsErr) throw jobsErr;
        job = jobs?.[0] || null;
      }

      let rawSections: any[] = Array.isArray(job?.presentation_json?.sections)
        ? job.presentation_json.sections
        : [];
      let source: "db" | "cdn" | "empty" = "empty";

      console.log(
        `[NOTES] step=db-job topic=${topicId} jobId=${job?.id ?? "-"} sections=${rawSections.length} external=${job?.external_job_id ?? "-"} ip=${job?.server_ip ?? "-"}`
      );

      if (rawSections.length > 0) {
        source = "db";
        console.log(
          `[NOTES] source=db topic=${topicId} jobId=${job?.id} sections=${rawSections.length}`
        );
      } else if (job?.id && job?.external_job_id) {
        console.log(
          `[NOTES] db-empty → cdn-fallback topic=${topicId} jobId=${job.id} external=${job.external_job_id}`
        );
        try {
          const { data: resp, error: invokeErr } = await supabase.functions.invoke(
            "notes-backfill-presentation",
            { body: { jobId: job.id, externalJobId: job.external_job_id } }
          );
          if (invokeErr) {
            console.log(
              `[NOTES] cdn-miss topic=${topicId} reason=invoke-error err=${invokeErr.message}`
            );
            source = "empty";
          } else if (resp?.ok && Array.isArray(resp?.presentation?.sections) && resp.presentation.sections.length > 0) {
            rawSections = resp.presentation.sections;
            source = "cdn";
            console.log(
              `[NOTES] cdn-hit topic=${topicId} jobId=${job.id} sections=${rawSections.length} bytes=${resp.bytes ?? "-"} wrote=${!!resp.wrote}`
            );
          } else {
            console.log(
              `[NOTES] cdn-miss topic=${topicId} reason=${resp?.reason ?? "unknown"}`
            );
            source = "empty";
          }
        } catch (err: any) {
          console.log(
            `[NOTES] cdn-miss topic=${topicId} reason=throw err=${err?.message ?? String(err)}`
          );
          source = "empty";
        }
      } else {
        console.log(
          `[NOTES] source=empty topic=${topicId} reason=no-job-or-external`
        );
        source = "empty";
      }

      const sections: NotesSection[] = rawSections.map((s: any, i: number) => ({
        section_id: String(s.section_id ?? i + 1),
        section_type: s.section_type,
        title: s.title || `Section ${i + 1}`,
        narration: s.narration,
        visual_beats: s.visual_beats,
        summary: s.summary,
        key_points: s.key_points,
      }));

      // 2. Question bank items for this topic
      const { data: qs, error: qsErr } = await supabase
        .from("questions")
        .select(
          "id, question_text, question_type, question_format, options, correct_answer, explanation, difficulty, subtopic_id, is_ai_generated, is_verified"
        )
        .eq("topic_id", topicId!)
        .limit(500);
      if (qsErr) throw qsErr;

      const allQuestions = (qs || []) as TopicNotesQuestion[];

      // 3. Bucket questions per section: map subtopic_id → section by fuzzy
      //    title match; fallback distributes remaining questions round-robin.
      const subtopicIdToSection = new Map<string, string>();
      if (allQuestions.some((q) => q.subtopic_id)) {
        const subIds = Array.from(
          new Set(allQuestions.map((q) => q.subtopic_id).filter(Boolean) as string[])
        );
        if (subIds.length) {
          const { data: subs } = await supabase
            .from("subtopics")
            .select("id, title")
            .in("id", subIds);
          (subs || []).forEach((sub: any) => {
            const match = sections.find((sec) =>
              sec.title.toLowerCase().includes(sub.title.toLowerCase()) ||
              sub.title.toLowerCase().includes(sec.title.toLowerCase())
            );
            if (match) subtopicIdToSection.set(sub.id, match.section_id);
          });
        }
      }

      const questionsBySection: Record<string, TopicNotesQuestion[]> = {};
      sections.forEach((s) => (questionsBySection[s.section_id] = []));

      const unbucketed: TopicNotesQuestion[] = [];
      for (const q of allQuestions) {
        const bucket = q.subtopic_id ? subtopicIdToSection.get(q.subtopic_id) : undefined;
        if (bucket && questionsBySection[bucket]) {
          questionsBySection[bucket].push(q);
        } else {
          unbucketed.push(q);
        }
      }
      // Round-robin distribute unbucketed across sections so every card has some.
      if (sections.length && unbucketed.length) {
        unbucketed.forEach((q, i) => {
          const secId = sections[i % sections.length].section_id;
          questionsBySection[secId].push(q);
        });
      }

      return {
        jobId: job?.id ?? null,
        sourceUpdatedAt: job?.updated_at ?? job?.created_at ?? null,
        sections,
        questionsBySection,
        allQuestions,
        hasPublishedLecture: !!job,
        source,
      };
    },
  });
}
