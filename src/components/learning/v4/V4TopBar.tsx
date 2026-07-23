import { BADGE_CONFIG } from './constants';
import { getSectionType } from './utils';
import type { V4Section } from './types';

interface V4TopBarProps {
  title: string;
  sections: V4Section[];
  currentIndex: number;
  onSectionClick: (index: number) => void;
  onClose: () => void;
  isMobile?: boolean;
  hideDots?: boolean;
  hideSectionName?: boolean;
}

export const V4TopBar = ({ title, sections, currentIndex, onSectionClick, onClose, isMobile, hideDots, hideSectionName }: V4TopBarProps) => {
  const currentSection = sections[currentIndex];
  const sectionType = currentSection ? getSectionType(currentSection) : 'content';
  const badge = BADGE_CONFIG[sectionType] || BADGE_CONFIG.content;

  return (
    <div className="v4-topbar">
      <button className="v4-close-btn" onClick={onClose} title="Close">
        ✕
      </button>
      <div
        className="v4-tb-badge"
        style={{
          background: badge.bg,
          color: badge.color,
          border: `1px solid ${badge.border}`,
        }}
      >
        {badge.label}
      </div>
      <div className="v4-tb-title">{title}</div>
      {!isMobile && !hideSectionName && currentSection && (
        <div className="v4-tb-sec-name">/ {currentSection.title}</div>
      )}
      {!hideDots && (
        <div className="v4-tb-dots">
          {sections.map((_, i) => (
            <div
              key={i}
              className={`v4-tb-dot ${i < currentIndex ? 'past' : i === currentIndex ? 'cur' : 'future'}`}
              onClick={() => onSectionClick(i)}
              title={sections[i]?.title || ''}
            />
          ))}
        </div>
      )}
    </div>
  );
};
