import { useRef, useState, useEffect } from 'react';
import { useVideoSchedule } from './hooks/useVideoSchedule';
import { useManimSchedule } from './hooks/useManimSchedule';
import { getSectionType, getMediaSrc } from './utils';
import type { V3Section } from './types';

interface V3ContentLayersProps {
  section: V3Section | null;
  jobId: string;
  avatarVideoRef: React.RefObject<HTMLVideoElement | null>;
  getBlob?: (src: string) => string | null;
  /** Non-English gate: called on mount with the internal <video> refs. */
  onLayerVideosMount?: (els: { wan: HTMLVideoElement | null; manim: HTMLVideoElement | null }) => void;
}

const MANIM_RENDERERS = ['manim'];
const VIDEO_RENDERERS = ['video', 'wan_video', 'text_to_video', 'image_to_video'];

function getRendererKind(section: V3Section): 'manim' | 'video' | 'image' | 'none' {
  const st = getSectionType(section);
  if (st === 'quiz') return 'none'; // Quiz handles its own UI

  const r = section.renderer?.toLowerCase() || '';
  if (MANIM_RENDERERS.includes(r)) return 'manim';
  if (VIDEO_RENDERERS.includes(r)) return 'video';

  if (st === 'memory_infographic' || st === 'recap') return 'image';

  if (section.manim_video_paths && section.manim_video_paths.length > 0) return 'manim';
  if (section.beat_video_paths && section.beat_video_paths.length > 0) return 'video';
  if (section.visual_beats && section.visual_beats.length > 0) return 'video';
  if (section.video_path) return 'video';

  return 'none';
}

export const V3ContentLayers = ({ section, jobId, avatarVideoRef, getBlob, onLayerVideosMount }: V3ContentLayersProps) => {
  const manimVideoRef = useRef<HTMLVideoElement>(null);
  const wanVideoRef = useRef<HTMLVideoElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageVisible, setImageVisible] = useState(false);

  const kind = section ? getRendererKind(section) : 'none';

  // Expose internal video refs upward (for non-English playback gate).
  useEffect(() => {
    onLayerVideosMount?.({ wan: wanVideoRef.current, manim: manimVideoRef.current });
  }, [onLayerVideosMount]);


  // Force-clear both video elements on every section change to prevent stale frames
  useEffect(() => {
    const wan = wanVideoRef.current;
    const manim = manimVideoRef.current;

    if (wan) {
      wan.pause();
      wan.removeAttribute('src');
      wan.load();
    }
    if (manim) {
      manim.pause();
      manim.removeAttribute('src');
      manim.load();
    }
    setImageVisible(false);
    setImageUrl(null);
  }, [section]);

  const { schedule: videoSchedule, currentBeatIndex: videoBeatIdx } = useVideoSchedule({
    section: kind === 'video' ? section : null,
    jobId,
    avatarVideoRef,
    getBlob,
  });

  const { schedule: manimSchedule, currentBeatIndex: manimBeatIdx } = useManimSchedule({
    section: kind === 'manim' ? section : null,
    jobId,
    avatarVideoRef,
    manimVideoRef,
    getBlob,
  });

  // Handle WAN/beat video playback for 'video' kind
  useEffect(() => {
    const vid = wanVideoRef.current;
    if (!vid || kind !== 'video') return;

    if (videoBeatIdx >= 0 && videoSchedule[videoBeatIdx]) {
      const beat = videoSchedule[videoBeatIdx];
      if (beat.type === 'video') {
        const src = beat.blobUrl || beat.src;
        if (vid.src !== src) {
          const srcType = beat.blobUrl ? 'BLOB' : 'PROXY';
          console.log(`[ContentLayers] WAN video beat ${videoBeatIdx} [${srcType}]: ${src.slice(0, 60)}...`);
          vid.src = src;
          vid.currentTime = 0;
          vid.play().catch(() => {});
        }
      }
    }
  }, [videoBeatIdx, videoSchedule, kind]);

  // Handle image beats
  useEffect(() => {
    if (kind === 'video' && videoBeatIdx >= 0 && videoSchedule[videoBeatIdx]?.type === 'image') {
      const imgSrc = videoSchedule[videoBeatIdx].src;
      const blobSrc = getBlob?.(imgSrc);
      const finalSrc = blobSrc || imgSrc;
      const srcType = blobSrc ? 'BLOB' : 'PROXY';
      console.log(`[ContentLayers] Image beat ${videoBeatIdx} [${srcType}]: ${finalSrc.slice(0, 60)}...`);
      setImageUrl(finalSrc);
      requestAnimationFrame(() => setImageVisible(true));
    } else if (kind === 'manim' && manimBeatIdx >= 0 && manimSchedule[manimBeatIdx]?.type === 'image') {
      const imgSrc = manimSchedule[manimBeatIdx].src;
      const blobSrc = getBlob?.(imgSrc);
      const finalSrc = blobSrc || imgSrc;
      const srcType = blobSrc ? 'BLOB' : 'PROXY';
      console.log(`[ContentLayers] Manim image beat ${manimBeatIdx} [${srcType}]: ${finalSrc.slice(0, 60)}...`);
      setImageUrl(finalSrc);
      requestAnimationFrame(() => setImageVisible(true));
    } else {
      setImageVisible(false);
      setTimeout(() => setImageUrl(null), 400);
    }
  }, [kind, videoBeatIdx, manimBeatIdx, videoSchedule, manimSchedule, getBlob]);

  // Handle standalone video_path or single video
  useEffect(() => {
    if (kind !== 'video') return;
    if (videoSchedule.length > 0) return;

    const vid = wanVideoRef.current;
    if (!vid || !section?.video_path) return;

    const proxySrc = getMediaSrc(section.video_path, jobId);
    const blobSrc = getBlob?.(proxySrc);
    const finalSrc = blobSrc || proxySrc;
    const srcType = blobSrc ? 'BLOB' : 'PROXY';
    console.log(`[ContentLayers] Standalone video [${srcType}]: ${finalSrc.slice(0, 60)}...`);
    vid.src = finalSrc;
    vid.currentTime = 0;
    vid.play().catch(() => {});
  }, [section, jobId, kind, videoSchedule.length, getBlob]);

  const showWan = kind === 'video';
  const showManim = kind === 'manim';
  const showImage = !!imageUrl;

  return (
    <>
      {/* WAN / Beat video layer */}
      <div className={`v3-wan-layer ${showWan ? 'on' : ''}`}>
        <video
          ref={wanVideoRef}
          className="v3-layer-video"
          playsInline
          muted
          crossOrigin="anonymous"
        />
      </div>

      {/* Manim layer */}
      <div className={`v3-manim-layer ${showManim ? 'on' : ''}`}>
        <video
          ref={manimVideoRef}
          className="v3-layer-video"
          playsInline
          muted
          crossOrigin="anonymous"
        />
      </div>

      {/* Image overlay layer */}
      <div className={`v3-image-layer ${showImage ? 'on' : ''} ${imageVisible ? 'vis' : ''}`}>
        {imageUrl && (
         <img
            className="v3-layer-image"
            src={imageUrl}
            alt=""
            onError={(e) => {
              const img = e.currentTarget;
              const src = img.src;
              if (src.endsWith('.png')) img.src = src.replace('.png', '.jpg');
              else if (src.endsWith('.jpg')) img.src = src.replace('.jpg', '.jpeg');
            }}
          />
        )}
      </div>
    </>
  );
};
