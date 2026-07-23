import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { SUPABASE_DIRECT_URL } from "@/lib/supabaseUrl";

const PROXY_URL = `${SUPABASE_DIRECT_URL}/functions/v1/ai-teaching-proxy`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBase: string;
  subjectId?: string;
  subjectName?: string;
  question: string;
  jobId?: string;
  label?: string;
}

export function AskAIJobResultDialog({
  open,
  onOpenChange,
  apiBase,
  subjectId,
  subjectName,
  question,
  jobId,
  label,
}: Props) {
  const [slideIdx, setSlideIdx] = useState(0);

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["ask-ai-result", subjectId, question],
    enabled: open && !!question,
    staleTime: 60_000,
    queryFn: async () => {
      const url = `${PROXY_URL}?path=${encodeURIComponent("/ai-teaching-assistant")}&base=${encodeURIComponent(apiBase.replace(/\/+$/, ""))}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "full",
          question,
          subjectId,
          subjectName,
          language: "en-US",
        }),
      });
      const text = await res.text();
      let parsed: any = text;
      try {
        parsed = JSON.parse(text);
      } catch {}
      if (!res.ok) throw new Error(typeof parsed === "string" ? parsed : JSON.stringify(parsed));
      return parsed;
    },
  });

  const slides: any[] = data?.presentationSlides ?? data?.presentation_slides ?? [];
  const slide = slides[slideIdx];
  const audioUrls: any[] = data?.slideAudioUrls?.urls ?? data?.slide_audio_urls?.urls ?? [];
  const slideAudio = audioUrls.find((a: any) => a.slideIndex === slideIdx || a.slide_index === slideIdx);

  // Note: no Supabase mirror write. The CPU server (/ai-teaching-assistant)
  // is the single source of truth for pre-generated answers.


  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    toast({ title: "JSON copied" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="truncate">{label || "Job result"}</DialogTitle>
          <DialogDescription className="truncate">
            {jobId && <span className="font-mono text-xs">question_id: {jobId} · </span>}
            <span className="text-xs">{question}</span>
          </DialogDescription>
        </DialogHeader>

        {isLoading || isFetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <div className="font-medium text-destructive mb-1">Error</div>
            <pre className="text-xs whitespace-pre-wrap break-all">{(error as Error).message}</pre>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="slides">
            <TabsList>
              <TabsTrigger value="slides">Slides ({slides.length})</TabsTrigger>
              <TabsTrigger value="json">Raw JSON</TabsTrigger>
            </TabsList>

            <TabsContent value="slides" className="space-y-3">
              {slides.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No slides in response.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={slideIdx === 0}
                      onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" /> Prev
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      Slide {slideIdx + 1} / {slides.length}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={slideIdx >= slides.length - 1}
                      onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="rounded-md border p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                    <div className="font-semibold">{slide?.title}</div>
                    {(() => {
                      const manimUrl =
                        slide?.manim_video_url ||
                        slide?.manimVideoUrl ||
                        data?.manimVideoUrls?.[slideIdx] ||
                        data?.manimVideoUrls?.[String(slideIdx)];
                      return manimUrl ? (
                        <video
                          key={`${slideIdx}-${manimUrl}`}
                          src={manimUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="rounded-md w-full max-h-64 mx-auto bg-black object-contain"
                        />
                      ) : null;
                    })()}
                    {(slide?.infographicUrl || slide?.infographic_url) && (
                      <img
                        src={slide.infographicUrl || slide.infographic_url}
                        alt={slide?.title || "slide"}
                        className="rounded-md max-h-64 mx-auto"
                      />
                    )}
                    {slide?.narration && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {slide.narration}
                      </p>
                    )}
                    {Array.isArray(slide?.key_points) && slide.key_points.length > 0 && (
                      <ul className="list-disc pl-5 text-sm space-y-1">
                        {slide.key_points.map((k: string, i: number) => (
                          <li key={i}>{k}</li>
                        ))}
                      </ul>
                    )}
                    {(slideAudio?.audioUrl || slideAudio?.audio_url || slide?.audioUrl) && (
                      <audio
                        controls
                        src={slideAudio?.audioUrl || slideAudio?.audio_url || slide?.audioUrl}
                        className="w-full"
                      />
                    )}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="json">
              <div className="flex justify-end mb-2">
                <Button size="sm" variant="outline" onClick={copyJson}>
                  <Copy className="h-4 w-4" /> Copy
                </Button>
              </div>
              <pre className="text-xs whitespace-pre-wrap break-all border rounded-md p-3 max-h-[60vh] overflow-y-auto bg-muted/40">
                {JSON.stringify(data, null, 2)}
              </pre>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default AskAIJobResultDialog;
