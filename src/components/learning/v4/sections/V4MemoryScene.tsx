import { useState, useEffect, useCallback, useRef } from 'react';
import type { V4Section, V4Flashcard } from '../types';

interface V4MemorySceneProps {
  section: V4Section;
  getAvatarVideo: () => HTMLVideoElement | null;
}

const LOG_PREFIX = '[V4MemoryScene]';

function getCardData(section: V4Section): { front: string; back: string }[] {
  const fc = section.flashcards;
  if (fc && fc.length > 0) {
    return fc.map((c: V4Flashcard) => ({
      front: c.q || c.front || c.question || '',
      back: c.a || c.back || c.answer || '',
    }));
  }
  // Fallback: narration segments
  const segs = section.narration?.segments || [];
  return segs.map((s, i) => ({
    front: `Card ${i + 1}`,
    back: s.text?.slice(0, 150) || '',
  }));
}

export const V4MemoryScene = ({ section, getAvatarVideo }: V4MemorySceneProps) => {
  const cards = getCardData(section);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const autoStateRef = useRef({ idx: 0, autoFlipped: false });

  // Auto-advance and auto-flip synced to avatar
  useEffect(() => {
    const segments = section.narration?.segments || [];
    let attachedVideo: HTMLVideoElement | null = null;
    let lastTickLog = 0;
    let noVideoLogs = 0;
    let attached = false;
    const sectionLabel = `${section.section_id ?? 'unknown'}:${section.title || 'Untitled'}`;

    console.log(`${LOG_PREFIX} MOUNT`, {
      section: sectionLabel,
      cards: cards.length,
      segments: segments.length,
      flashcards: section.flashcards?.length || 0,
    });

    autoStateRef.current = { idx: 0, autoFlipped: false };
    setCardIndex(0);
    setFlipped(false);
    console.log(`${LOG_PREFIX} RESET`, { section: sectionLabel, idx: 0, flipped: false });

    if (cards.length === 0) {
      console.warn(`${LOG_PREFIX} NO_CARDS`, { section: sectionLabel, segments: segments.length });
      return;
    }

    const iv = setInterval(() => {
      const vid = getAvatarVideo();
      if (!vid) {
        if (noVideoLogs < 10 || noVideoLogs % 25 === 0) {
          console.warn(`${LOG_PREFIX} NO_VIDEO`, {
            section: sectionLabel,
            count: noVideoLogs + 1,
            cards: cards.length,
            segments: segments.length,
          });
        }
        noVideoLogs += 1;
        return;
      }

      if (vid !== attachedVideo) {
        attachedVideo = vid;
        attached = true;
        console.log(`${LOG_PREFIX} ATTACH`, {
          section: sectionLabel,
          src: vid.currentSrc || vid.src || '(empty)',
          readyState: vid.readyState,
          paused: vid.paused,
          currentTime: Number(vid.currentTime.toFixed(3)),
          duration: Number.isFinite(vid.duration) ? Number(vid.duration.toFixed(3)) : vid.duration,
          cards: cards.length,
          segments: segments.length,
        });
      }

      const t = vid.currentTime;
      const vDur = vid.duration || 0;
      const fallbackPer = vDur > 0 ? vDur / cards.length : 8;

      let idx = 0;
      let cum = 0;
      let activeStart = 0;
      let activeDur = fallbackPer;

      for (let i = 0; i < cards.length; i++) {
        const seg = segments[i];
        const effDur = Number(seg?.duration_seconds || seg?.duration) || fallbackPer;
        if (t >= cum) {
          idx = i;
          activeStart = cum;
          activeDur = effDur;
        }
        cum += effDur;
      }

      const shouldFlip = t >= activeStart + activeDur * 0.45;
      const flipPoint = activeStart + activeDur * 0.45;
      const autoState = autoStateRef.current;
      const now = Date.now();

      if (now - lastTickLog >= 1000) {
        console.log(`${LOG_PREFIX} TICK`, {
          section: sectionLabel,
          t: Number(t.toFixed(3)),
          duration: Number.isFinite(vDur) ? Number(vDur.toFixed(3)) : vDur,
          paused: vid.paused,
          readyState: vid.readyState,
          idx,
          activeStart: Number(activeStart.toFixed(3)),
          activeDur: Number(activeDur.toFixed(3)),
          flipPoint: Number(flipPoint.toFixed(3)),
          shouldFlip,
          autoIdx: autoState.idx,
          autoFlipped: autoState.autoFlipped,
          usingSegments: segments.length === cards.length,
        });
        lastTickLog = now;
      }

      if (idx !== autoState.idx) {
        console.log(`${LOG_PREFIX} CARD_CHANGE`, {
          section: sectionLabel,
          from: autoState.idx,
          to: idx,
          t: Number(t.toFixed(3)),
          activeStart: Number(activeStart.toFixed(3)),
          activeDur: Number(activeDur.toFixed(3)),
          flipPoint: Number(flipPoint.toFixed(3)),
          shouldFlip,
        });
        setCardIndex(idx);
        setFlipped(shouldFlip);
        autoStateRef.current = { idx, autoFlipped: shouldFlip };
      } else if (shouldFlip && !autoState.autoFlipped) {
        console.log(`${LOG_PREFIX} AUTO_FLIP`, {
          section: sectionLabel,
          idx,
          t: Number(t.toFixed(3)),
          flipPoint: Number(flipPoint.toFixed(3)),
          paused: vid.paused,
          readyState: vid.readyState,
        });
        setFlipped(true);
        autoStateRef.current = { idx, autoFlipped: true };
      }
    }, 200);

    return () => {
      clearInterval(iv);
      console.log(`${LOG_PREFIX} UNMOUNT`, {
        section: sectionLabel,
        attached,
        finalState: autoStateRef.current,
      });
    };
  }, [getAvatarVideo, cards.length, section]);

  const handleFlip = useCallback(() => {
    setFlipped(f => {
      const next = !f;
      autoStateRef.current = { ...autoStateRef.current, autoFlipped: true };
      console.log(`${LOG_PREFIX} MANUAL_FLIP`, {
        idx: autoStateRef.current.idx,
        from: f,
        to: next,
        section: `${section.section_id ?? 'unknown'}:${section.title || 'Untitled'}`,
      });
      return next;
    });
  }, [section.section_id, section.title]);
  const handlePrev = useCallback(() => {
    setCardIndex(i => {
      const next = Math.max(0, i - 1);
      autoStateRef.current = { idx: next, autoFlipped: false };
      console.log(`${LOG_PREFIX} NAV`, { direction: 'prev', from: i, to: next, section: `${section.section_id ?? 'unknown'}:${section.title || 'Untitled'}` });
      return next;
    });
    setFlipped(false);
  }, [section.section_id, section.title]);
  const handleNext = useCallback(() => {
    setCardIndex(i => {
      const next = Math.min(cards.length - 1, i + 1);
      autoStateRef.current = { idx: next, autoFlipped: false };
      console.log(`${LOG_PREFIX} NAV`, { direction: 'next', from: i, to: next, section: `${section.section_id ?? 'unknown'}:${section.title || 'Untitled'}` });
      return next;
    });
    setFlipped(false);
  }, [cards.length, section.section_id, section.title]);

  if (cards.length === 0) return null;
  const card = cards[cardIndex];

  return (
    <div className="v4-card-scene">
      <div
        className={`v4-card-3d ${flipped ? 'flipped' : ''}`}
        onClick={handleFlip}
      >
        <div className="v4-card-face v4-card-front">
          <div style={{ fontSize: 13, color: 'var(--v4-dim)', marginBottom: 8, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.1em' }}>
            TAP TO FLIP
          </div>
          <div style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.5 }}>{card.front}</div>
        </div>
        <div className="v4-card-face v4-card-back">
          <div style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--v4-w)' }}>{card.back}</div>
        </div>
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 16 }}>
        <button className="v4-nb" onClick={handlePrev} disabled={cardIndex === 0} style={{ opacity: cardIndex === 0 ? 0.3 : 1 }}>
          ◀
        </button>
        <div style={{ display: 'flex', gap: 6 }}>
          {cards.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === cardIndex ? 20 : 8,
                height: 8,
                borderRadius: 4,
                background: i === cardIndex ? 'var(--v4-gold)' : 'rgba(255,255,255,0.15)',
                transition: 'all 0.3s',
                cursor: 'pointer',
              }}
              onClick={() => {
                console.log(`${LOG_PREFIX} NAV`, { direction: 'dot', from: cardIndex, to: i, section: `${section.section_id ?? 'unknown'}:${section.title || 'Untitled'}` });
                autoStateRef.current = { idx: i, autoFlipped: false };
                setCardIndex(i);
                setFlipped(false);
              }}
            />
          ))}
        </div>
        <button className="v4-nb" onClick={handleNext} disabled={cardIndex === cards.length - 1} style={{ opacity: cardIndex === cards.length - 1 ? 0.3 : 1 }}>
          ▶
        </button>
      </div>
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--v4-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
        {cardIndex + 1} / {cards.length}
      </div>
    </div>
  );
};
