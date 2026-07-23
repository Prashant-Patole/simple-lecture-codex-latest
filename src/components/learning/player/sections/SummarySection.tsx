import { useMemo, useRef, useEffect } from 'react';
import { PresentationSection } from '../types';
import { ContentRenderer } from '../ContentRenderer';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

interface SummarySectionProps {
  section: PresentationSection;
  revealedIndices: number[];
  jobId: string;
  serverIp: string;
  cdnBaseUrl?: string | null;
  isMobile?: boolean;
}

// Helper to normalize text from various formats
const normalizeText = (item: string | { text: string } | unknown): string => {
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object' && 'text' in item) {
    return String((item as { text: string }).text).trim();
  }
  return '';
};

// Extract bullets using 3 fallback strategies (matching player_v2.js)
const extractBullets = (section: PresentationSection): string[] => {
  const collected = new Set<string>();

  // Strategy 1: Visual Beats (Primary for V2.5)
  if (section.visual_beats && section.visual_beats.length > 0) {
    section.visual_beats.forEach(beat => {
      if (beat.visual_type === 'bullet_list' || beat.visual_type === 'text') {
        if (beat.display_text) {
          // Handle array or string
          if (Array.isArray(beat.display_text)) {
            beat.display_text.forEach(item => {
              const text = normalizeText(item);
              if (text) collected.add(text);
            });
          } else {
            const text = normalizeText(beat.display_text);
            if (text) collected.add(text);
          }
        }
        // Also check visual_content
        if (beat.visual_content?.bullet_points) {
          beat.visual_content.bullet_points.forEach(bp => {
            const text = normalizeText(bp);
            if (text) collected.add(text);
          });
        }
      }
    });
  }

  // Strategy 2: Slide-Level Visual Content
  if (collected.size === 0 && section.slide?.visual_content?.bullet_points) {
    section.slide.visual_content.bullet_points.forEach(bp => {
      const text = normalizeText(bp);
      if (text) collected.add(text);
    });
  }

  // Strategy 3: Narration Segments (Fallback)
  if (collected.size === 0 && section.narration?.segments) {
    section.narration.segments.forEach(seg => {
      // Check visual_content in segments
      const bullets = seg.visual_content?.bullet_points || seg.visual_content?.items || [];
      bullets.forEach(bp => {
        const text = normalizeText(bp);
        if (text) collected.add(text);
      });
    });
  }

  // Strategy 4: If still empty, try full narration text split by sentences
  if (collected.size === 0 && section.narration?.full_text) {
    const sentences = section.narration.full_text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10 && s.length < 200);
    sentences.slice(0, 6).forEach(s => collected.add(s));
  }

  return Array.from(collected);
};

export const SummarySection = ({
  section,
  revealedIndices,
  isMobile = false,
}: SummarySectionProps) => {
  const activeRef = useRef<HTMLDivElement>(null);
  
  // Extract bullets using multi-strategy approach
  const bullets = useMemo(() => extractBullets(section), [section]);
  
  // Get the most recently revealed index for active highlighting
  const activeIndex = revealedIndices.length > 0 
    ? revealedIndices[revealedIndices.length - 1] 
    : -1;

  // Auto-scroll to active bullet when revealed
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIndex]);

  return (
    <div className={cn("h-full flex flex-col overflow-y-auto", isMobile ? "p-0" : "p-6")}>
      {/* Section Title */}
      <h2 className="section-title">
        {section.title}
      </h2>

      {/* Summary Items */}
      {isMobile ? (
        /* Mobile: Show only the active bullet, fully visible */
        activeIndex >= 0 && bullets[activeIndex] ? (
          <div className="summary-single-mobile">
            <div className="summary-single-mobile-content">
              <span className="summary-marker">
                <CheckCircle2 className="w-5 h-5" />
              </span>
              <div className="summary-text">
                <ContentRenderer 
                  content={bullets[activeIndex]} 
                  type="markdown"
                  isRevealed={true}
                />
              </div>
            </div>
            <span className="summary-single-mobile-counter">
              {activeIndex + 1} / {bullets.length}
            </span>
          </div>
        ) : bullets.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No summary points available for this section.</p>
          </div>
        ) : null
      ) : (
        /* Desktop: Existing accumulation behavior */
        <div className="content-box space-y-2">
          {bullets.map((bulletText, index) => {
            const isRevealed = revealedIndices.includes(index);
            const isActive = index === activeIndex;
            
            return (
              <div
                key={`summary-${index}`}
                ref={isActive ? activeRef : null}
                className={cn(
                  "summary-item",
                  isRevealed ? "reveal-visible" : "reveal-hidden",
                  isActive && "beat-active"
                )}
              >
                <span className="summary-marker">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                <div className="summary-text">
                  <ContentRenderer 
                    content={bulletText} 
                    type="markdown"
                    isRevealed={isRevealed}
                  />
                </div>
              </div>
            );
          })}

          {bullets.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p>No summary points available for this section.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
