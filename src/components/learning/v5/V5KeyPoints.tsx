import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Eye, EyeOff } from 'lucide-react';
import type { V5TimelineSection } from './types';
import 'katex/dist/katex.min.css';

interface V5KeyPointsProps {
  active: V5TimelineSection | null;
  isHidden: boolean;
  onToggle: () => void;
  visibleCount: number;
}

export function V5KeyPoints({
  active,
  isHidden,
  onToggle,
  visibleCount,
}: V5KeyPointsProps) {
  if (!active || active.keyPoints.length === 0 || visibleCount === 0) return null;

  const isManim = active.section.renderer?.toLowerCase() === 'manim';

  if (isHidden) {
    return (
      <button
        aria-label="Show key points"
        className="v5-keypoints-toggle"
        onClick={onToggle}
        type="button"
      >
        <Eye size={16} />
        <span>Show key points</span>
      </button>
    );
  }

  return (
    <aside
      className={`v5-keypoints ${isManim ? 'v5-keypoints--manim' : 'v5-keypoints--visual'}`}
      aria-live="polite"
    >
      <div className="v5-keypoints__eyebrow">
        <span className="v5-keypoints__label">
          <span className="v5-keypoints__pulse" />
          Key points
        </span>
        <button aria-label="Hide key points" onClick={onToggle} type="button">
          <EyeOff size={15} />
          <span>Hide</span>
        </button>
      </div>
      <div className="v5-keypoints__list">
        {active.keyPoints.slice(0, visibleCount).map((point, index) => (
          <div
            className={`v5-keypoint ${index === visibleCount - 1 ? 'v5-keypoint--active' : ''}`}
            key={`${active.section.section_id}-${index}`}
          >
            <span className="v5-keypoint__number">{String(index + 1).padStart(2, '0')}</span>
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
              {point}
            </ReactMarkdown>
          </div>
        ))}
      </div>
    </aside>
  );
}
