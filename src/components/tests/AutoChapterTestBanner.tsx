import { useNavigate } from 'react-router-dom';
import { Sparkles, ChevronRight, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePendingAutoChapterTests } from '@/hooks/usePendingAutoChapterTests';

export const AutoChapterTestBanner = () => {
  const navigate = useNavigate();
  const { data: pending = [] } = usePendingAutoChapterTests();

  if (!pending.length) return null;

  return (
    <div className="space-y-2">
      {pending.map((p) => (
        <Card
          key={p.id}
          className="p-4 border-amber-400/40 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm md:text-base">
                Chapter test ready: <span className="text-primary">{p.chapter_title || p.self_tests?.title}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                {p.self_tests?.duration_minutes || 180} min · {p.self_tests?.total_questions || 30} questions
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => navigate('/my-tests')}
              className="shrink-0"
            >
              Start Test <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};
