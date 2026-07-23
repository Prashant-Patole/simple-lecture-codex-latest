import { useMemo, useRef, useEffect } from 'react';
import { PresentationSection, VisualBeat } from '../types';
import { ContentRenderer } from '../ContentRenderer';
import { cn } from '@/lib/utils';
import { getImagePath, getAdminMediaUrl, getCdnMediaUrl } from '../utils/mediaResolver';

interface ContentSectionProps {
  section: PresentationSection;
  revealedIndices: number[];
  currentSegmentIndex: number;
  isVideoLayerVisible: boolean;
  jobId: string;
  serverIp: string;
  cdnBaseUrl?: string | null;
  isMobile?: boolean;
}

// Helper to normalize display_text from various formats
const normalizeDisplayText = (displayText: string | string[] | { text: string }[] | undefined): string => {
  if (!displayText) return '';
  if (typeof displayText === 'string') return displayText;
  if (Array.isArray(displayText)) {
    return displayText.map(item => 
      typeof item === 'string' ? item : item.text
    ).join('\n');
  }
  return '';
};

// Extract text from visual_content as fallback
const extractVisualContentText = (beat: VisualBeat): string => {
  const vc = beat.visual_content;
  if (!vc) return '';
  
  const items: string[] = [];
  if (vc.bullet_points) {
    vc.bullet_points.forEach(bp => {
      items.push(typeof bp === 'string' ? bp : bp.text);
    });
  }
  if (vc.items) {
    vc.items.forEach(item => {
      items.push(typeof item === 'string' ? item : item.text);
    });
  }
  return items.join('\n');
};

// Extract all beats using multiple strategies
const extractAllBeats = (section: PresentationSection): VisualBeat[] => {
  const beats: VisualBeat[] = [];
  const seenIds = new Set<string>();

  // Strategy 1: Direct visual_beats
  if (section.visual_beats && section.visual_beats.length > 0) {
    section.visual_beats.forEach(beat => {
      if (!seenIds.has(beat.beat_id)) {
        beats.push(beat);
        seenIds.add(beat.beat_id);
      }
    });
  }

  // Strategy 2: Explanation plan visual_beats
  if (section.explanation_plan?.visual_beats) {
    section.explanation_plan.visual_beats.forEach(beat => {
      if (!seenIds.has(beat.beat_id)) {
        beats.push(beat);
        seenIds.add(beat.beat_id);
      }
    });
  }

  // Strategy 3: Create beats from narration segments if no visual beats
  if (beats.length === 0 && section.narration?.segments) {
    section.narration.segments.forEach((seg, index) => {
      if (seg.text && seg.text.trim()) {
        beats.push({
          beat_id: `narration-${index}`,
          visual_type: 'text',
          display_text: seg.text,
          segment_id: seg.segment_id,
        });
      }
    });
  }

  return beats;
};

export const ContentSection = ({
  section,
  revealedIndices,
  currentSegmentIndex,
  isVideoLayerVisible,
  jobId,
  serverIp,
  cdnBaseUrl,
  isMobile = false,
}: ContentSectionProps) => {
  const activeRef = useRef<HTMLDivElement>(null);
  
  // Extract all beats using multi-strategy approach
  const allBeats = useMemo(() => extractAllBeats(section), [section]);

  // Get current segment for display directives
  const currentSegment = section.narration?.segments?.[currentSegmentIndex];
  
  // Get active beat index (the most recently revealed one)
  const activeIndex = revealedIndices.length > 0 
    ? revealedIndices[revealedIndices.length - 1] 
    : -1;

  useEffect(() => {
    if (!isMobile) return;

    const frame = window.requestAnimationFrame(() => {
      const card = document.querySelector('.content-single-mobile-content') as HTMLElement | null;
      const text = document.querySelector('.content-single-mobile-content .markdown-content-container') as HTMLElement | null;

      if (card) {
        console.log('[ContentSection.mobile] card', {
          w: card.clientWidth,
          h: card.clientHeight,
          scrollH: card.scrollHeight,
        });
      }

      if (text) {
        console.log('[ContentSection.mobile] text', {
          w: text.clientWidth,
          h: text.clientHeight,
          scrollH: text.scrollHeight,
        });
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isMobile, activeIndex]);

  // Preload all image URLs when section mounts for instant display
  useEffect(() => {
    const preloaded: HTMLImageElement[] = [];
    allBeats.forEach(beat => {
      const imgId = beat.image_id;
      const isImg = beat.visual_type === 'image' || !!imgId;
      if (!isImg) return;

      const path = imgId || normalizeDisplayText(beat.display_text);
      if (!path) return;

      const url = getMediaUrlWithServer(getImagePath(path));
      if (!url) return;

      const img = new window.Image();
      img.src = url;
      preloaded.push(img);

      const fallback = new window.Image();
      if (url.endsWith('.png')) {
        fallback.src = url.replace('.png', '.jpg');
      } else {
        fallback.src = url.replace(/\.jpe?g$/, '.png');
      }
      preloaded.push(fallback);
    });

    return () => { preloaded.length = 0; };
  }, [allBeats, jobId, serverIp, cdnBaseUrl]);

  // Auto-scroll to active beat when revealed
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeIndex]);

  // Helper to get media URL - uses CDN if cdnBaseUrl is provided, otherwise uses proxy
  const getMediaUrlWithServer = (path: string) => {
    if (cdnBaseUrl) {
      return getCdnMediaUrl(jobId, path, cdnBaseUrl);
    }
    return getAdminMediaUrl(jobId, path, serverIp);
  };

  return (
    <div className="h-full flex flex-col">
      <h2 className="section-title">{section.title}</h2>

      {isMobile ? (
        /* Mobile: Show only the active beat with counter */
        activeIndex >= 0 && allBeats[activeIndex] ? (() => {
          const beat = allBeats[activeIndex];
          const isImage = beat.visual_type === 'image' || beat.image_id;
          const isLatex = beat.visual_type === 'latex' || beat.latex_content;
          const isVideo = beat.visual_type === 'video';
          const displayText = normalizeDisplayText(beat.display_text);
          const fallbackText = displayText || extractVisualContentText(beat);

          return (
            <div className="content-single-mobile">
              <div className="content-single-mobile-content">
                {isImage && beat.image_id && (
                  <div className="beat-image-container">
                    <img
                      src={getMediaUrlWithServer(getImagePath(beat.image_id))}
                      alt=""
                      className="beat-image"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        const src = img.src;
                        if (src.endsWith('.jpg') || src.endsWith('.jpeg')) {
                          img.src = src.replace(/\.jpe?g$/, '.png');
                        } else if (src.endsWith('.png')) {
                          img.src = src.replace('.png', '.jpg');
                        }
                      }}
                    />
                  </div>
                )}

                {isImage && !beat.image_id && displayText && (
                  <div className="beat-image-container">
                    <img
                      src={getMediaUrlWithServer(getImagePath(displayText))}
                      alt=""
                      className="beat-image"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        const src = img.src;
                        if (src.endsWith('.jpg') || src.endsWith('.jpeg')) {
                          img.src = src.replace(/\.jpe?g$/, '.png');
                        } else if (src.endsWith('.png')) {
                          img.src = src.replace('.png', '.jpg');
                        }
                      }}
                    />
                  </div>
                )}

                {isLatex && beat.latex_content && (
                  <div className="latex-container">
                    <ContentRenderer content={beat.latex_content} type="latex" isRevealed={true} />
                    {/* Raw fallback removed - latex_content already renders the formula */}
                  </div>
                )}

                {isVideo && !isVideoLayerVisible && fallbackText && (
                  <div className="markdown-content-container">
                    <ContentRenderer content={fallbackText} type="markdown" isRevealed={true} />
                  </div>
                )}

                {!isImage && !isLatex && !isVideo && fallbackText && (
                  <div className="markdown-content-container">
                    <ContentRenderer
                      content={fallbackText}
                      type={beat.visual_type === 'bullet_list' ? 'bullet' : 'markdown'}
                      isRevealed={true}
                    />
                  </div>
                )}

                {!fallbackText && !isVideo && !(isImage && beat.image_id) && !(isImage && displayText) && !isLatex && (
                  <div className="text-center text-muted-foreground py-4 text-sm">
                    <p>Content loading...</p>
                  </div>
                )}
              </div>
              <span className="content-single-mobile-counter">
                {activeIndex + 1} / {allBeats.length}
              </span>
            </div>
          );
        })() : allBeats.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No content available for this section.</p>
          </div>
        ) : null
      ) : (
        /* Desktop: Existing accumulation behavior */
        <div className="content-box space-y-4">
          {allBeats.map((beat, index) => {
            const isRevealed = revealedIndices.includes(index);
            const isActive = index === activeIndex;
            const isImage = beat.visual_type === 'image' || beat.image_id;
            const isLatex = beat.visual_type === 'latex' || beat.latex_content;
            const isVideo = beat.visual_type === 'video';
            const displayText = normalizeDisplayText(beat.display_text);
            const fallbackText = displayText || extractVisualContentText(beat);

            const isAccumulatingType = beat.visual_type === 'bullet_list' 
              || beat.visual_type === 'text' 
              || beat.visual_type === undefined;

            if (isAccumulatingType && !isRevealed) return null;
            if (!isAccumulatingType && index !== activeIndex) return null;
            
            return (
              <div
                key={beat.beat_id}
                ref={isActive ? activeRef : null}
                className={cn(
                  "beat-block",
                  isRevealed ? "reveal-visible" : "reveal-hidden",
                  isActive && "beat-active"
                )}
              >
                {isImage && beat.image_id && (
                  <div className="beat-image-container">
                    <img
                      src={getMediaUrlWithServer(getImagePath(beat.image_id))}
                      alt=""
                      className="beat-image"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        const src = img.src;
                        if (src.endsWith('.jpg') || src.endsWith('.jpeg')) {
                          img.src = src.replace(/\.jpe?g$/, '.png');
                        } else if (src.endsWith('.png')) {
                          img.src = src.replace('.png', '.jpg');
                        }
                      }}
                    />
                  </div>
                )}

                {isImage && !beat.image_id && displayText && (
                  <div className="beat-image-container">
                    <img
                      src={getMediaUrlWithServer(getImagePath(displayText))}
                      alt=""
                      className="beat-image"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        const src = img.src;
                        if (src.endsWith('.jpg') || src.endsWith('.jpeg')) {
                          img.src = src.replace(/\.jpe?g$/, '.png');
                        } else if (src.endsWith('.png')) {
                          img.src = src.replace('.png', '.jpg');
                        }
                      }}
                    />
                  </div>
                )}

                {isLatex && beat.latex_content && (
                  <div className="latex-container">
                    <ContentRenderer content={beat.latex_content} type="latex" isRevealed={isRevealed} />
                    {/* Raw fallback removed - latex_content already renders the formula */}
                  </div>
                )}

                {isVideo && !isVideoLayerVisible && (
                  fallbackText ? (
                    <div className="markdown-content-container">
                      <ContentRenderer content={fallbackText} type="markdown" isRevealed={isRevealed} />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-muted-foreground py-4 text-sm italic">
                      <span>📹 Visual content playing...</span>
                    </div>
                  )
                )}

                {!isImage && !isLatex && !isVideo && fallbackText && (
                  <div className="markdown-content-container">
                    <ContentRenderer
                      content={fallbackText}
                      type={beat.visual_type === 'bullet_list' ? 'bullet' : 'markdown'}
                      isRevealed={isRevealed}
                    />
                  </div>
                )}

                {!fallbackText && !isVideo && !(isImage && beat.image_id) && !(isImage && displayText) && !isLatex && (
                  <div className="text-center text-muted-foreground py-4 text-sm">
                    <p>Content loading...</p>
                  </div>
                )}
              </div>
            );
          })}

          {allBeats.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <p>No content available for this section.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
