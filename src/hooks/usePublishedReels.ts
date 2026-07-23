import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { reelVariantVideoUrl, type ReelVariant } from "@/hooks/useReelJobManifest";
import { toast } from "sonner";

export interface PublishedReel {
  id: string;
  reel_job_id: string | null;
  external_job_id: string;
  document_id: string | null;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  reel_index: number;
  variant: string;
  variant_dir: string;
  title: string | null;
  video_url: string;
  is_published: boolean;
  created_at: string;
  vimeo_url?: string | null;
  vimeo_id?: string | null;
}

// Attach vimeo_url/vimeo_id from reel_vimeo_urls to fetched reels
async function attachVimeo(reels: PublishedReel[]): Promise<PublishedReel[]> {
  if (reels.length === 0) return reels;
  const jobIds = Array.from(new Set(reels.map((r) => r.external_job_id)));
  const { data: vimeoRows } = await supabase
    .from("reel_vimeo_urls")
    .select("external_job_id, reel_index, variant, vimeo_url, vimeo_id")
    .in("external_job_id", jobIds);
  const map = new Map<string, { vimeo_url: string | null; vimeo_id: string | null }>();
  for (const v of vimeoRows || []) {
    map.set(`${v.external_job_id}|${v.reel_index}|${v.variant}`, {
      vimeo_url: v.vimeo_url ?? null,
      vimeo_id: v.vimeo_id ?? null,
    });
  }
  return reels.map((r) => {
    const hit = map.get(`${r.external_job_id}|${r.reel_index}|${r.variant}`);
    return hit ? { ...r, vimeo_url: hit.vimeo_url, vimeo_id: hit.vimeo_id } : r;
  });
}

// Fetch published reels for a given upstream job (used in admin variant list to show pill)
export function usePublishedReelsForJob(externalJobId: string | undefined) {
  return useQuery({
    queryKey: ["published-reels-for-job", externalJobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("published_reels")
        .select("*")
        .eq("external_job_id", externalJobId!);
      if (error) throw error;
      return (data || []) as PublishedReel[];
    },
    enabled: !!externalJobId,
  });
}

// Fetch published reels for student view
export function usePublishedReels(args: { topicId?: string | null; chapterId?: string | null }) {
  const { topicId, chapterId } = args;
  return useQuery({
    queryKey: ["published-reels", { topicId, chapterId }],
    queryFn: async () => {
      let q = supabase
        .from("published_reels")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (topicId) q = q.eq("topic_id", topicId);
      else if (chapterId) q = q.eq("chapter_id", chapterId).is("topic_id", null);
      else return [] as PublishedReel[];
      const { data, error } = await q;
      if (error) throw error;
      return await attachVimeo((data || []) as PublishedReel[]);
    },
    enabled: !!(topicId || chapterId),
  });
}

// Fetch all published reels with optional filters (for mobile Reels page)
export function useAllPublishedReels(args: {
  courseId?: string | null;
  subjectId?: string | null;
  chapterId?: string | null;
}) {
  const { courseId, subjectId, chapterId } = args;
  return useQuery({
    queryKey: ["all-published-reels", { courseId, subjectId, chapterId }],
    queryFn: async () => {
      let subjectIds: string[] | null = null;
      if (courseId && !subjectId) {
        const { data: cs, error: csErr } = await supabase
          .from("course_subjects")
          .select("subject_id")
          .eq("course_id", courseId);
        if (csErr) throw csErr;
        subjectIds = (cs || []).map((r: any) => r.subject_id).filter(Boolean);
        if (subjectIds.length === 0) return [] as PublishedReel[];
      }

      let q = supabase
        .from("published_reels")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(200);

      if (chapterId) q = q.eq("chapter_id", chapterId);
      if (subjectId) q = q.eq("subject_id", subjectId);
      else if (subjectIds) q = q.in("subject_id", subjectIds);

      const { data, error } = await q;
      if (error) throw error;
      return await attachVimeo((data || []) as PublishedReel[]);
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function usePublishReel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      reelJobId: string; // row id in reel_jobs
      externalJobId: string; // upstream job_id
      reelIndex: number;
      reelTitle: string;
      variant: ReelVariant;
    }) => {
      // Resolve subject/document/topic/chapter/server from reel_jobs + ai_assistant_documents
      const { data: job, error: jobErr } = await supabase
        .from("reel_jobs")
        .select("id, subject_id, document_id, server_ip, target_port")
        .eq("id", args.reelJobId)
        .maybeSingle();
      if (jobErr) throw jobErr;
      if (!job) throw new Error("Reel job not found");

      let topic_id: string | null = null;
      let chapter_id: string | null = null;
      if (job.document_id) {
        const { data: doc } = await supabase
          .from("ai_assistant_documents")
          .select("topic_id, chapter_id")
          .eq("id", job.document_id)
          .maybeSingle();
        topic_id = doc?.topic_id ?? null;
        chapter_id = doc?.chapter_id ?? null;
      }
      if (!topic_id && !chapter_id) {
        throw new Error("Source document has no topic or chapter — cannot publish.");
      }

      const { data: authData } = await supabase.auth.getUser();

      const video_url = reelVariantVideoUrl(
        args.externalJobId,
        args.variant.dir,
        (job as any).server_ip,
        (job as any).target_port,
      );
      const { error } = await supabase.from("published_reels").upsert(
        {
          reel_job_id: job.id,
          external_job_id: args.externalJobId,
          document_id: job.document_id,
          subject_id: job.subject_id,
          chapter_id,
          topic_id,
          reel_index: args.reelIndex,
          variant: args.variant.variant,
          variant_dir: args.variant.dir,
          title: args.reelTitle,
          video_url,
          is_published: true,
          published_by: authData.user?.id || null,
        },
        { onConflict: "external_job_id,reel_index,variant" }
      );
      if (error) throw error;

      // Persist dev-server URL (fast playback) in dedicated table
      await supabase.from("reel_devserver_urls").upsert(
        {
          reel_job_id: job.id,
          external_job_id: args.externalJobId,
          reel_index: args.reelIndex,
          variant: args.variant.variant,
          variant_dir: args.variant.dir,
          video_url,
          server_ip: job.server_ip,
          target_port: job.target_port,
        },
        { onConflict: "external_job_id,reel_index,variant" }
      );

      // Persist Vimeo URL when present in the manifest variant
      const vimeoUrl = args.variant.vimeo_url;
      if (vimeoUrl) {
        const m = vimeoUrl.match(/vimeo\.com\/(\d+)/);
        await supabase.from("reel_vimeo_urls").upsert(
          {
            reel_job_id: job.id,
            external_job_id: args.externalJobId,
            reel_index: args.reelIndex,
            variant: args.variant.variant,
            vimeo_url: vimeoUrl,
            vimeo_id: m?.[1] ?? null,
          },
          { onConflict: "external_job_id,reel_index,variant" }
        );
      }
    },
    onSuccess: (_d, vars) => {
      toast.success("Reel published");
      qc.invalidateQueries({ queryKey: ["published-reels-for-job", vars.externalJobId] });
      qc.invalidateQueries({ queryKey: ["published-reels"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to publish reel"),
  });
}

export function useUnpublishReel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { externalJobId: string; reelIndex: number; variant: string }) => {
      const { error } = await supabase
        .from("published_reels")
        .delete()
        .eq("external_job_id", args.externalJobId)
        .eq("reel_index", args.reelIndex)
        .eq("variant", args.variant);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success("Reel unpublished");
      qc.invalidateQueries({ queryKey: ["published-reels-for-job", vars.externalJobId] });
      qc.invalidateQueries({ queryKey: ["published-reels"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to unpublish reel"),
  });
}
