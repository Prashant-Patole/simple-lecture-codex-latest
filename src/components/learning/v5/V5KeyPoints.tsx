import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { V5TimelineSection } from './types';
import 'katex/dist/katex.min.css';

interface V5KeyPointsProps {
  active: V5TimelineSection | null;
  visibleCount: number;
}

export function V5KeyPoints({ active, visibleCount }: V5KeyPointsProps) {
  if (!active || active.keyPoints.length === 0 || visibleCount === 0) return null;

  const isManim = active.section.renderer?.toLowerCase() === 'manim';

  return (
    <aside
      className={`v5-keypoints ${isManim ? 'v5-keypoints--manim' : 'v5-keypoints--visual'}`}
      aria-live="polite"
    >
      <div className="v5-keypoints__eyebrow">
        <span className="v5-keypoints__pulse" />
        Key points
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

