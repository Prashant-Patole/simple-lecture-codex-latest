import { useState, useEffect } from 'react';
import type { V3Section } from '../types';

interface V3RecapSceneProps {
  section: V3Section;
  avatarVideoRef: React.RefObject<HTMLVideoElement | null>;
}

export const V3RecapScene = ({ section, avatarVideoRef }: V3RecapSceneProps) => {
  const segments = section.narration?.segments || [];
  const [visibleCount, setVisibleCount] = useState(1);

  useEffect(() => {
    const vid = avatarVideoRef.current;
    if (!vid || segments.length === 0) return;

    const onTime = () => {
      const t = vid.currentTime;
      let cumulative = 0;
      let count = 1; // first always visible
      for (let i = 1; i < segments.length; i++) {
        const prevDur = segments[i - 1]?.duration_seconds || segments[i - 1]?.duration || 5;
        cumulative += prevDur;
        const start = segments[i]?.start_seconds ?? cumulative;
        if (t >= start) count = i + 1;
      }
      setVisibleCount(count);
    };

    vid.addEventListener('timeupdate', onTime);
    return () => vid.removeEventListener('timeupdate', onTime);
  }, [avatarVideoRef, segments]);

  if (segments.length === 0) return null;

  return (
    <div className="v3-recap-container">
      {segments.map((seg, i) => (
        <div
          key={i}
          className="v3-recap-text"
          style={{ opacity: i < visibleCount ? 1 : 0 }}
        >
          {seg.text}
        </div>
      ))}
    </div>
  );
};
