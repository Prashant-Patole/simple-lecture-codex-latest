import { useRef, useCallback, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { getMediaSrc, getMainVideoUrl, isMergedSection, logV4Source } from './utils';
import type { V4Section } from './types';


export interface V4AvatarHandle {
  /** The currently-active <video> element (avatar overlay or merged full-bleed). */
  video: HTMLVideoElement | null;
  /** Load and play a new section's master video. */
  loadAvatar: (section: V4Section, jobId: string, rate: number, getBlob?: (src: string) => string | null, sectionIndex?: number, language?: string | null) => void;
}

interface V4AvatarProps {
  jobId: string;
  sectionType: string;
  visible: boolean;
}

export const V4Avatar = forwardRef<V4AvatarHandle, V4AvatarProps>(
  ({ jobId, sectionType, visible }, ref) => {
    const avatarVideoRef = useRef<HTMLVideoElement>(null);
    const mergedVideoRef = useRef<HTMLVideoElement>(null);
    const [merged, setMerged] = useState(false);
    const isQuiz = sectionType === 'quiz';
    const effectiveMerged = isQuiz ? false : merged;

    useEffect(() => {
      if (!isQuiz) return;
      const mergedVid = mergedVideoRef.current;
      if (mergedVid) {
        try {
          mergedVid.pause();
          mergedVid.removeAttribute('src');
          mergedVid.load();
        } catch {}
      }
      setMerged(false);

      requestAnimationFrame(() => {
        const main = document.querySelector('.v4-main');
        const mergedBox = document.querySelector('.v4-merged-overlay');
        const avatarBox = document.querySelector('.v4-av-overlay[data-sectype="quiz"]');
        const avatarVid = avatarVideoRef.current;
        const box = (el: Element | null) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cls: (el as HTMLElement).className };
        };
        console.log('[V4Avatar][QUIZ_LAYOUT]', {
          mergedStateBeforeForce: merged,
          activeVideo: 'avatarVideoRef',
          main: box(main),
          mergedOverlay: box(mergedBox),
          avatarOverlay: box(avatarBox),
          avatarVideo: box(avatarVid),
          avatarVideoSrc: avatarVid?.currentSrc || avatarVid?.src || null,
        });
      });
    }, [isQuiz, merged]);

    const loadAvatar = useCallback(
      (section: V4Section, jid: string, rate: number, getBlob?: (src: string) => string | null, sectionIndex: number = -1, language?: string | null) => {
        const useMerged = isMergedSection(section, language);
        const mainPath = getMainVideoUrl(section, language);

        if (!mainPath) {
          console.warn('[V4Avatar] No main video path for section');
          return;
        }

        const mediaSrc = getMediaSrc(mainPath, jid);
        const blobSrc = getBlob?.(mediaSrc);
        const finalSrc = blobSrc || mediaSrc;
        const srcType = blobSrc ? 'BLOB' : 'PROXY';

        setMerged(useMerged);

        const targetVid = useMerged ? mergedVideoRef.current : avatarVideoRef.current;
        const otherVid = useMerged ? avatarVideoRef.current : mergedVideoRef.current;

        if (otherVid) {
          try { otherVid.pause(); otherVid.removeAttribute('src'); otherVid.load(); } catch {}
        }
        if (!targetVid) {
          console.warn(`[V4Avatar] target video ref is null (${useMerged ? 'merged' : 'avatar'})`);
          return;
        }

        logV4Source({
          sectionIndex,
          title: section.title,
          kind: useMerged ? 'final' : 'avatar',
          source: srcType,
          url: finalSrc,
          proxyUrl: mediaSrc,
        });

        targetVid.muted = true;
        targetVid.playsInline = true;
        targetVid.preload = 'auto';
        targetVid.playbackRate = rate;

        let settled = false;
        const cleanup = () => {
          targetVid.removeEventListener('loadedmetadata', tryPlay);
          targetVid.removeEventListener('canplay', tryPlay);
          targetVid.removeEventListener('playing', onPlaying);
          targetVid.removeEventListener('error', onError);
        };
        const onPlaying = () => {
          settled = true;
          console.log(`[V4Avatar] [${useMerged ? 'MERGED' : 'AVATAR'}] playing — unmuting`);
          try { targetVid.muted = false; } catch {}
          cleanup();
        };
        const onError = () => {
          console.warn('[V4Avatar] <video> error:', targetVid.error?.code, targetVid.error?.message);
          cleanup();
        };
        const tryPlay = () => {
          if (settled) return;
          const p = targetVid.play();
          if (!p || typeof p.then !== 'function') return;
          p.catch((err) => {
            console.warn(`[V4Avatar] play() rejected: ${err?.name || ''} ${err?.message || ''}`);
          });
        };
        targetVid.addEventListener('loadedmetadata', tryPlay);
        targetVid.addEventListener('canplay', tryPlay);
        targetVid.addEventListener('playing', onPlaying);
        targetVid.addEventListener('error', onError);

        targetVid.src = finalSrc;
        targetVid.load();
        tryPlay();

      },
      []
    );

    useImperativeHandle(ref, () => ({
      get video() { return isQuiz ? avatarVideoRef.current : (merged ? mergedVideoRef.current : avatarVideoRef.current); },
      loadAvatar,
    }), [loadAvatar, merged, isQuiz]);

    return (
      <>
        {/* MERGED-mode: full-bleed single video. */}
        <div
          className="v4-merged-overlay"
          style={{
            position: 'absolute', inset: 0, zIndex: 3,
            display: visible && effectiveMerged ? 'block' : 'none',
            background: '#000',
          }}
        >
          <video
            ref={mergedVideoRef}
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />
        </div>

        {/* AVATAR-mode: right-side overlay region with raw video (no chroma key). */}
        <div
          className={`v4-av-overlay${isQuiz ? ' v4-av-overlay--quiz' : ''}`}
          data-sectype={sectionType}
          style={{ display: visible && !effectiveMerged ? undefined : 'none' }}
        >
          <video
            ref={avatarVideoRef}
            className={isQuiz ? 'v4-av-video--quiz' : undefined}
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          />
        </div>
      </>
    );
  }
);

V4Avatar.displayName = 'V4Avatar';
