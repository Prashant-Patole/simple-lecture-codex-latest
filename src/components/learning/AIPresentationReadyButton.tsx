import { useState } from 'react';
import { Loader2, PlayCircle } from 'lucide-react';
import { useAskAIJobs } from '@/hooks/useAskAIJobs';
import { getOrFetchAnswer } from '@/lib/getOrFetchAnswer';

interface Props {
  questionId: string;
  questionText: string;
  subjectId?: string;
  subjectName?: string;
  onOpenInAITab?: (questionText: string, cachedResponse: any) => void;
}

export function AIPresentationReadyButton({ questionId, questionText, subjectId, subjectName, onOpenInAITab }: Props) {
  const [loading, setLoading] = useState(false);
  const [cached, setCached] = useState<any | null>(null);

  const { data: pregenJobs = [] } = useAskAIJobs({
    subjectId: subjectId || '',
    status: 'ready',
  });
  const hasPregen = pregenJobs.some((j: any) => j.is_pregen_done && j.question_id === questionId);

  if (!hasPregen || !onOpenInAITab) return null;

  const handleClick = async () => {
    if (cached) {
      onOpenInAITab(questionText, cached);
      return;
    }
    setLoading(true);
    try {
      const data = await getOrFetchAnswer({ questionId, questionText, subjectId, subjectName });
      setCached(data);
      onOpenInAITab(questionText, data);
    } catch (e) {
      console.error('[AIPresentationReadyButton] fetch failed', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleClick}
      className="mt-3 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 transition-colors cursor-pointer border border-emerald-500/30 disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlayCircle className="h-3 w-3" />}
      {loading ? 'Loading…' : 'Watch Answer'}
    </button>
  );
}
