import { useRef, useState, useEffect } from 'react';
import { useVideoSchedule } from './hooks/useVideoSchedule';
import { useManimSchedule } from './hooks/useManimSchedule';
import { getSectionType, getMediaSrc, logV4Source } from './utils';
import type { V4Section } from './types';

interface V4ContentLayersProps {
  section: V4Section | null;
  jobId: string;
  avatarVideoRef: React.RefObject<HTMLVideoElement | null>;
  getBlob?: (src: string) => string | null;
  sectionIndex?: number;
}

const MANIM_RENDERERS = ['manim'];
const VIDEO_RENDERERS = ['video', 'wan_video', 'text_to_video', 'image_to_video'];

function getRendererKind(section: V4Section): 'manim' | 'video' | 'image' | 'none' {
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

export const V4ContentLayers = ({ section, jobId, avatarVideoRef, getBlob, sectionIndex = -1 }: V4ContentLayersProps) => {
  const manimVideoRef = useRef<HTMLVideoElement>(null);
  const wanVideoRef = useRef<HTMLVideoElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageVisible, setImageVisible] = useState(false);

  const kind = section ? getRendererKind(section) : 'none';

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
    sectionIndex,
  });

  const { schedule: manimSchedule, currentBeatIndex: manimBeatIdx } = useManimSchedule({
    section: kind === 'manim' ? section : null,
    jobId,
    avatarVideoRef,
    manimVideoRef,
    getBlob,
    sectionIndex,
  });

  // Slave WAN/beat video playback to the avatar (master clock).
  // Fixes: (a) beat playing before avatar is ready, (b) seek-back leaving beat
  // frozen at wrong offset, (c) drift over long sections, (d) stuck states.
  useEffect(() => {
    const vid = wanVideoRef.current;
    const avatar = avatarVideoRef.current;
    if (!vid || !avatar || kind !== 'video') return;
    if (videoBeatIdx < 0 || !videoSchedule[videoBeatIdx]) return;
    const beat = videoSchedule[videoBeatIdx];
    if (beat.type !== 'video') return;

    const src = beat.blobUrl || beat.src;
    const srcChanged = vid.src !== src;

    const applyOffset = () => {
      const expected = Math.max(0, avatar.currentTime - beat.start);
      try { vid.currentTime = expected; } catch { /* noop */ }
    };

    const gatedPlay = () => {
      if (avatar.paused) return;
      // Wait until BOTH elements are ready before starting the beat, so the
      // beat never runs ahead of a still-buffering avatar.
      const bothReady = () => avatar.readyState >= 3 && vid.readyState >= 3;
      const start = () => { if (!avatar.paused) vid.play().catch(() => {}); };
      if (bothReady()) return start();
      const onReady = () => {
        if (!bothReady()) return;
        vid.removeEventListener('canplay', onReady);
        avatar.removeEventListener('canplay', onReady);
        applyOffset();
        start();
      };
      vid.addEventListener('canplay', onReady);
      avatar.addEventListener('canplay', onReady);
      // Safety timeout: play anyway after 4s so we never hang forever.
      setTimeout(() => { onReady(); }, 4000);
    };

    if (srcChanged) {
      logV4Source({
        sectionIndex,
        kind: 'beat',
        source: beat.blobUrl ? 'BLOB' : 'PROXY',
        url: src,
        proxyUrl: beat.src,
      });
      vid.src = src;
      try { vid.load(); } catch { /* noop */ }
    }
    applyOffset();
    gatedPlay();

    // Mirror pause/play + propagate seeks + drift correction
    const onAvatarPause = () => { try { vid.pause(); } catch { /* noop */ } };
    const onAvatarPlay = () => gatedPlay();
    const onAvatarSeeked = () => { applyOffset(); gatedPlay(); };

    let lastDrift = 0;
    const onAvatarTime = () => {
      const now = performance.now();
      if (now - lastDrift < 500) return;
      lastDrift = now;
      const expected = Math.max(0, avatar.currentTime - beat.start);
      if (Math.abs(vid.currentTime - expected) > 0.25) {
        try { vid.currentTime = expected; } catch { /* noop */ }
      }
    };

    avatar.addEventListener('pause', onAvatarPause);
    avatar.addEventListener('play', onAvatarPlay);
    avatar.addEventListener('playing', onAvatarPlay);
    avatar.addEventListener('seeked', onAvatarSeeked);
    avatar.addEventListener('timeupdate', onAvatarTime);
    return () => {
      avatar.removeEventListener('pause', onAvatarPause);
      avatar.removeEventListener('play', onAvatarPlay);
      avatar.removeEventListener('playing', onAvatarPlay);
      avatar.removeEventListener('seeked', onAvatarSeeked);
      avatar.removeEventListener('timeupdate', onAvatarTime);
    };
  }, [videoBeatIdx, videoSchedule, kind, sectionIndex, avatarVideoRef]);

  // Handle image beats
  useEffect(() => {
    if (kind === 'video' && videoBeatIdx >= 0 && videoSchedule[videoBeatIdx]?.type === 'image') {
      const imgSrc = videoSchedule[videoBeatIdx].src;
      const blobSrc = getBlob?.(imgSrc);
      const finalSrc = blobSrc || imgSrc;
      logV4Source({ sectionIndex, kind: 'image', source: blobSrc ? 'BLOB' : 'PROXY', url: finalSrc, proxyUrl: imgSrc });
      setImageUrl(finalSrc);
      requestAnimationFrame(() => setImageVisible(true));
    } else if (kind === 'manim' && manimBeatIdx >= 0 && manimSchedule[manimBeatIdx]?.type === 'image') {
      const imgSrc = manimSchedule[manimBeatIdx].src;
      const blobSrc = getBlob?.(imgSrc);
      const finalSrc = blobSrc || imgSrc;
      logV4Source({ sectionIndex, kind: 'image', source: blobSrc ? 'BLOB' : 'PROXY', url: finalSrc, proxyUrl: imgSrc });
      setImageUrl(finalSrc);
      requestAnimationFrame(() => setImageVisible(true));
    } else {
      setImageVisible(false);
      setTimeout(() => setImageUrl(null), 400);
    }
  }, [kind, videoBeatIdx, manimBeatIdx, videoSchedule, manimSchedule, getBlob, sectionIndex]);

  // Handle standalone video_path or single video
  useEffect(() => {
    if (kind !== 'video') return;
    if (videoSchedule.length > 0) return;

    const vid = wanVideoRef.current;
    if (!vid || !section?.video_path) return;

    const proxySrc = getMediaSrc(section.video_path, jobId);
    const blobSrc = getBlob?.(proxySrc);
    const finalSrc = blobSrc || proxySrc;
    logV4Source({ sectionIndex, kind: 'final', source: blobSrc ? 'BLOB' : 'PROXY', url: finalSrc, proxyUrl: proxySrc });
    vid.src = finalSrc;
    vid.currentTime = 0;
    vid.play().catch(() => {});
  }, [section, jobId, kind, videoSchedule.length, getBlob, sectionIndex]);

  const showWan = kind === 'video';
  const showManim = kind === 'manim';
  const showImage = !!imageUrl;

  return (
    <>
      {/* WAN / Beat video layer */}
      <div className={`v4-wan-layer ${showWan ? 'on' : ''}`}>
        <video
          ref={wanVideoRef}
          className="v4-layer-video"
          playsInline
          muted
        />
      </div>

      {/* Manim layer */}
      <div className={`v4-manim-layer ${showManim ? 'on' : ''}`}>
        <video
          ref={manimVideoRef}
          className="v4-layer-video"
          playsInline
          muted
        />
      </div>

      {/* Image overlay layer */}
      <div className={`v4-image-layer ${showImage ? 'on' : ''} ${imageVisible ? 'vis' : ''}`}>
        {imageUrl && (
         <img
            className="v4-layer-image"
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
