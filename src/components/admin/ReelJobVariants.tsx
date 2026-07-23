import { useState } from "react";
import { Loader2, Play, ExternalLink, Film, Upload, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useReelJobManifest,
  reelVariantVideoUrl,
  type ReelVariant,
} from "@/hooks/useReelJobManifest";
import { useReelVariantPlayable } from "@/hooks/useReelVariantPlayable";
import {
  usePublishedReelsForJob,
  usePublishReel,
  useUnpublishReel,
} from "@/hooks/usePublishedReels";

interface Props {
  jobId: string;       // external job id (upstream)
  reelJobId: string;   // local reel_jobs.id
  serverIp?: string | null;
  targetPort?: number | null;
}

export function ReelJobVariants({ jobId, reelJobId, serverIp, targetPort }: Props) {
  const { data, isLoading, error } = useReelJobManifest(jobId, true, serverIp, targetPort);
  const { data: published = [] } = usePublishedReelsForJob(jobId);
  const publish = usePublishReel();
  const unpublish = useUnpublishReel();
  const [playing, setPlaying] = useState<{ url: string; title: string } | null>(null);

  const isPublished = (reelIndex: number, variant: string) =>
    published.some((p) => p.reel_index === reelIndex && p.variant === variant);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3 w-3 animate-spin" /> Loading reels…
      </div>
    );
  }
  if (error || !data?.reels?.length) {
    return (
      <div className="text-xs text-muted-foreground py-2 space-y-1">
        <p>No reels available for this job.</p>
        <p className="text-[11px]">
          No manifest found on bound server. Use Rebind / Auto-detect to check other origins.
        </p>
      </div>
    );
  }

  // Prefer the origin that actually returned the manifest, otherwise stored.
  const useIp = data.resolved_ip ?? serverIp;
  const usePort = data.resolved_port ?? targetPort;

  const openVariant = (reelTitle: string, v: ReelVariant) => {
    setPlaying({
      url: reelVariantVideoUrl(jobId, v.dir, useIp, usePort),
      title: `${reelTitle} — ${v.label}`,
    });
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
        {data.reels.map((reel) => (
          <div
            key={reel.reel_index}
            className="rounded-lg border bg-card p-3 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <div className="text-sm font-medium truncate" title={reel.title}>
                Reel {reel.reel_index}: {reel.title}
              </div>
            </div>
            <div className="space-y-1.5">
              {reel.variants.map((v) => {
                const url = reelVariantVideoUrl(jobId, v.dir, useIp, usePort);
                const isExamples = v.variant === "examples";
                const pub = isPublished(reel.reel_index, v.variant);
                return (
                  <VariantRow
                    key={v.dir}
                    url={url}
                    variant={v}
                    isExamples={isExamples}
                    pub={pub}
                    disabledActions={publish.isPending || unpublish.isPending}
                    onPlay={() => openVariant(reel.title, v)}
                    onTogglePublish={() => {
                      if (pub) {
                        unpublish.mutate({
                          externalJobId: jobId,
                          reelIndex: reel.reel_index,
                          variant: v.variant,
                        });
                      } else {
                        publish.mutate({
                          reelJobId,
                          externalJobId: jobId,
                          reelIndex: reel.reel_index,
                          reelTitle: reel.title,
                          variant: v,
                        });
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>


      <Dialog open={!!playing} onOpenChange={(o) => !o && setPlaying(null)}>
        <DialogContent className="max-w-[380px] p-0 gap-0 border-0 rounded-2xl overflow-hidden bg-gradient-to-b from-zinc-900 to-black shadow-2xl shadow-black/50 ring-1 ring-white/10 max-h-[96vh]">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="flex items-center gap-2 text-white/90 text-sm font-medium min-w-0">
              <Film className="h-4 w-4 shrink-0" />
              <span className="truncate">{playing?.title}</span>
            </DialogTitle>
          </DialogHeader>
          {playing && (
            <div className="relative w-full overflow-hidden">
              <video
                key={playing.url}
                src={playing.url}
                controls
                autoPlay
                playsInline
                className="block h-[85vh] w-full object-contain bg-black rounded-b-2xl"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface VariantRowProps {
  url: string;
  variant: ReelVariant;
  isExamples: boolean;
  pub: boolean;
  disabledActions: boolean;
  onPlay: () => void;
  onTogglePublish: () => void;
}

function VariantRow({
  url,
  variant,
  isExamples,
  pub,
  disabledActions,
  onPlay,
  onTogglePublish,
}: VariantRowProps) {
  // Probe the actual video URL — only enable publish when it's reachable & playable.
  // Skip probing when already published (button becomes "Unpublish" and must stay clickable).
  const { data: playable, isLoading: probing } = useReelVariantPlayable(url, !pub);

  const canPublish = pub ? true : playable === true;
  const publishTitle = pub
    ? "Unpublish"
    : probing
      ? "Checking video…"
      : playable === true
        ? "Publish to topic"
        : "Video not reachable — cannot publish";

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        variant="secondary"
        className={`flex-1 justify-start gap-2 ${
          isExamples
            ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300"
            : "bg-violet-500/15 hover:bg-violet-500/25 text-violet-700 dark:text-violet-300"
        }`}
        onClick={onPlay}
      >
        <Play className="h-3.5 w-3.5" />
        <span className="truncate">
          {isExamples ? "🌍 Real-Life" : "🧠 Theory"}
        </span>
      </Button>
      <Button
        size="sm"
        variant={pub ? "default" : "outline"}
        className={pub ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
        disabled={disabledActions || !canPublish}
        onClick={onTogglePublish}
        title={publishTitle}
      >
        {pub ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : probing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : playable === false ? (
          <XCircle className="h-3.5 w-3.5 text-red-500" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => window.open(url, "_blank")}
        title="Open in new tab"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

