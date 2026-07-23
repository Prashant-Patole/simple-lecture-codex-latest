import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface Props {
  presentation: any;
  topicId?: string;
  chapterId?: string;
  subjectName?: string;
}

function getManimUrl(slide: any, presentation?: any, slideIdx?: number): string | null {
  if (!slide) return null;
  const candidates = [
    slide.manim_video_url,
    slide.manimVideoUrl,
    slide.manim_video_url,
    slide.videoUrl,
    slide.video_url,
    slide.manim?.url,
    slide.manim?.video_url,
    typeof slideIdx === 'number' ? presentation?.manimVideoUrls?.[slideIdx] : undefined,
    typeof slideIdx === 'number' ? presentation?.manimVideoUrls?.[String(slideIdx)] : undefined,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c;
    if (c && typeof c === 'object') {
      const nested =
        c.url ??
        c.videoUrl ??
        c.video_url ??
        c.manimVideoUrl ??
        c.manim_video_url ??
        c.mp4Url ??
        c.mp4_url;
      if (typeof nested === 'string' && nested.trim()) return nested;
    }
  }
  return null;
}

export function PresentationSlideRenderer({ presentation }: Props) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [videoBroken, setVideoBroken] = useState(false);
  useEffect(() => { setVideoBroken(false); }, [slideIdx]);
  const [isMuted, setIsMuted] = useState(false);

  const slides =
    presentation?.presentationSlides ?? presentation?.presentation_slides ?? [];
  const slide = slides[slideIdx];
  const audioUrls =
    presentation?.slideAudioUrls?.urls ??
    presentation?.slide_audio_urls?.urls ??
    presentation?.slideAudioUrls ??
    presentation?.slide_audio_urls ??
    [];
  const slideAudio = Array.isArray(audioUrls)
    ? audioUrls.find(
        (a: any) => a.slideIndex === slideIdx || a.slide_index === slideIdx,
      )
    : null;
  const audioUrl = slideAudio?.audioUrl || slideAudio?.audio_url || slide?.audioUrl;

  if (slides.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No slides available.
      </div>
    );
  }

  const keyPoints = slide?.key_points || slide?.keyPoints;

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between gap-4">
        <Button
          size="sm"
          variant="outline"
          disabled={slideIdx === 0}
          onClick={() => setSlideIdx(Math.max(0, slideIdx - 1))}
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </Button>

        <div className="text-sm text-muted-foreground text-center flex-1">
          Slide {slideIdx + 1} of {slides.length}
        </div>

        <Button
          size="sm"
          variant="outline"
          disabled={slideIdx >= slides.length - 1}
          onClick={() => setSlideIdx(Math.min(slides.length - 1, slideIdx + 1))}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>

        <Button size="sm" variant="outline" onClick={() => setIsMuted(!isMuted)}>
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>

      <div className="rounded-lg border p-6 space-y-4 bg-muted/30 min-h-[400px]">
        <h3 className="text-xl font-semibold">{slide?.title}</h3>

        {(() => {
          const manimUrl = getManimUrl(slide, presentation, slideIdx);
          const imageUrl = slide?.infographicUrl || slide?.infographic_url;
          if (!manimUrl && !imageUrl) return null;
          return (
            <div className="space-y-3">
              {manimUrl && !videoBroken && (
                <video
                  key={`${slideIdx}-${manimUrl}`}
                  src={manimUrl}
                  controls
                  playsInline
                  preload="metadata"
                  autoPlay
                  loop
                  muted={isMuted}
                  onError={() => setVideoBroken(true)}
                  className="rounded-md w-full max-h-72 mx-auto bg-black object-contain"
                />
              )}
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={slide?.title}
                  className="rounded-md max-h-72 mx-auto"
                />
              )}
            </div>
          );
        })()}

        {slide?.content && (
          <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {slide.content}
            </ReactMarkdown>
          </div>
        )}

        {Array.isArray(keyPoints) && keyPoints.length > 0 && (
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {keyPoints.map((kp: string, i: number) => (
              <li key={i} className="text-foreground">
                {kp}
              </li>
            ))}
          </ul>
        )}

        {slide?.narration && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 italic text-sm text-muted-foreground">
            {slide.narration}
          </div>
        )}
      </div>

      {audioUrl && !isMuted && (
        <audio
          key={`${slideIdx}-${audioUrl}`}
          controls
          src={audioUrl}
          autoPlay
          className="w-full"
          onEnded={() => {
            if (slideIdx < slides.length - 1) setSlideIdx(slideIdx + 1);
          }}
        />
      )}
    </div>
  );
}

export default PresentationSlideRenderer;
