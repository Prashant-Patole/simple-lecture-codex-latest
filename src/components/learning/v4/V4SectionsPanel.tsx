import { BADGE_CONFIG } from './constants';
import { getSectionType } from './utils';
import type { V4Section } from './types';

interface V4SectionsPanelProps {
  sections: V4Section[];
  currentIndex: number;
  onSectionClick: (index: number) => void;
  onClose: () => void;
}

export const V4SectionsPanel = ({
  sections,
  currentIndex,
  onSectionClick,
  onClose,
}: V4SectionsPanelProps) => {
  return (
    <div className="v4-sections-panel" onClick={(e) => e.stopPropagation()}>
      <div className="v4-sp-header">
        <span className="v4-sp-title">Sections</span>
        <button className="v4-sp-close" onClick={onClose}>✕</button>
      </div>
      <div className="v4-sp-list">
        {sections.map((sec, i) => {
          const secType = getSectionType(sec);
          const badge = BADGE_CONFIG[secType] || BADGE_CONFIG.content;
          const isActive = i === currentIndex;
          const dur = sec.narration?.total_duration_seconds || sec.segment_duration_seconds || sec.dur;
          const durStr = dur ? `${Math.floor(dur / 60)}:${String(Math.floor(dur % 60)).padStart(2, '0')}` : '';

          return (
            <button
              key={sec.section_id}
              className={`v4-sp-item ${isActive ? 'active' : ''}`}
              onClick={() => { onSectionClick(i); onClose(); }}
            >
              <span className="v4-sp-idx">{i + 1}</span>
              <span className="v4-sp-info">
                <span className="v4-sp-name">{sec.title || `Section ${i + 1}`}</span>
                <span className="v4-sp-meta">
                  <span
                    className="v4-sp-badge"
                    style={{
                      background: badge.bg,
                      color: badge.color,
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    {badge.label}
                  </span>
                  {durStr && <span className="v4-sp-dur">{durStr}</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
