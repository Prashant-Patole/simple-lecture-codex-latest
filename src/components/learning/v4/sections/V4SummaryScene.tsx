import { useState, useEffect, useMemo, useRef } from 'react';
import type { V4Section } from '../types';

interface V4SummarySceneProps {
  section: V4Section;
  avatarVideoRef: React.RefObject<HTMLVideoElement | null>;
}

export const V4SummaryScene = ({ section, avatarVideoRef }: V4SummarySceneProps) => {
  const [visibleCount, setVisibleCount] = useState(0);

  // ---- Compute bullets + thresholds ----
  const { bullets, thresholds, source, avatarDuration } = useMemo(() => {
    const avatarDuration =
      (section as any).avatar_duration_seconds ||
      (section as any).audio_duration_seconds ||
      section.narration?.total_duration_seconds ||
      0;

    // 1) Bullet text source — prefer visual_beats bullet_list
    let bullets: string[] = [];
    let source = 'narration.segments';

    const bulletBeat = (section.visual_beats || []).find(
      (vb: any) =>
        vb?.visual_type === 'bullet_list' &&
        Array.isArray(vb?.display_text) &&
        vb.display_text.length > 0
    ) as any;

    if (bulletBeat) {
      bullets = bulletBeat.display_text
        .map((s: any) => String(s ?? '').trim())
        .filter((s: string) => s.length > 0);
      source = 'visual_beats.bullet_list';
    } else {
      const filtered = (section.narration?.segments || []).filter((s) => s.purpose !== 'introduce');
      bullets = filtered
        .map((s) => String(s.text ?? '').trim())
        .filter((s) => s.length > 0);
    }

    // 2) Thresholds
    const filteredSegs = (section.narration?.segments || []).filter((s) => s.purpose !== 'introduce');
    const N = bullets.length;
    let thresholds: number[] = [];

    const countsMatch = filteredSegs.length === N;

    // Primary: cumulative duration_seconds (needs count match + all positive)
    if (
      countsMatch &&
      filteredSegs.every((s) => Number(s.duration_seconds ?? s.duration ?? 0) > 0)
    ) {
      let cum = 0;
      for (let i = 0; i < N; i++) {
        thresholds.push(cum);
        cum += Number(filteredSegs[i].duration_seconds ?? filteredSegs[i].duration ?? 0);
      }
    }

    const validateThresholds = (arr: number[]) => {
      if (arr.length !== N) return false;
      for (let i = 1; i < arr.length; i++) if (arr[i] < arr[i - 1]) return false;
      if (avatarDuration > 0 && arr[arr.length - 1] > avatarDuration + 0.5) return false;
      if (N > 1 && arr[arr.length - 1] === 0) return false;
      return true;
    };

    if (!validateThresholds(thresholds)) {
      if (countsMatch) {
        const ss = filteredSegs.slice(0, N).map((s) => Number(s.start_seconds ?? NaN));
        if (ss.every((v) => Number.isFinite(v)) && validateThresholds(ss)) {
          thresholds = ss;
        }
      }
      if (!validateThresholds(thresholds)) {
        const total = avatarDuration > 0 ? avatarDuration : N * 4;
        thresholds = Array.from({ length: N }, (_, i) => (i * total) / N);
      }
    }

    console.log('[V4Summary]', { bullets, thresholds, source, avatarDuration, sectionId: section.section_id });

    return { bullets, thresholds, source, avatarDuration };
  }, [section]);

  // Reset on section change
  useEffect(() => {
    setVisibleCount(0);
  }, [section.section_id]);

  // Listen to avatar timeupdate
  useEffect(() => {
    const vid = avatarVideoRef.current;
    if (!vid || bullets.length === 0) return;

    const onTime = () => {
      const t = vid.currentTime;
      const dur = vid.duration || avatarDuration || 0;
      // End-of-section safety net
      if (vid.ended || (dur > 0 && t >= dur - 0.5)) {
        setVisibleCount(bullets.length);
        return;
      }
      let count = 0;
      for (let i = 0; i < thresholds.length; i++) {
        if (t + 0.05 >= thresholds[i]) count = i + 1;
      }
      setVisibleCount(count);
    };

    const onEnded = () => setVisibleCount(bullets.length);

    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('ended', onEnded);
    // Trigger immediately in case t already past first threshold
    onTime();
    return () => {
      vid.removeEventListener('timeupdate', onTime);
      vid.removeEventListener('ended', onEnded);
    };
  }, [avatarVideoRef, bullets, thresholds, avatarDuration]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll newest visible bullet into view
  useEffect(() => {
    const container = containerRef.current;
    if (!container || visibleCount === 0) return;
    const items = container.querySelectorAll('.v4-sbullet');
    const target = items[Math.min(visibleCount - 1, items.length - 1)] as HTMLElement | undefined;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [visibleCount]);

  if (bullets.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="v4-summary-scroll v4-summary-left"
      style={{
        position: 'absolute',
        left: '4%',
        top: '50%',
        transform: 'translateY(-50%)',
        width: '46%',
        maxWidth: 520,
        maxHeight: 'min(90%, calc(100% - 40px))',
        overflowY: 'auto',
        paddingBottom: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        letterSpacing: '0.1em',
        color: 'var(--v4-dim)',
        textTransform: 'uppercase' as const,
        marginBottom: 6,
      }}>
        By the end of this section, you will…
      </div>
      {bullets.map((text, i) => (
        <div
          key={i}
          className={`v4-sbullet ${i < visibleCount ? 'show' : ''}`}
          style={{ transitionDelay: `${i * 80}ms` }}
        >
          <div className="v4-sbullet-n">{i + 1}</div>
          <div className="v4-sbullet-t">{text}</div>
        </div>
      ))}
    </div>
  );
};
