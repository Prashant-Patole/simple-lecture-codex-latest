import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { FileText, Loader2, Clock, CheckCircle2, ChevronRight, Calendar } from 'lucide-react';

import { SEOHead } from '@/components/SEO';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSelfTests } from '@/hooks/useSelfTests';
import { AutoChapterTestBanner } from '@/components/tests/AutoChapterTestBanner';

const computeStatus = (t: any): 'upcoming' | 'live' | 'submitted' | 'missed' => {
  if (t.submitted_at) return 'submitted';
  const start = new Date(t.scheduled_at).getTime();
  const end = start + t.duration_minutes * 60_000;
  const now = Date.now();
  if (now < start) return 'upcoming';
  if (now <= end) return 'live';
  return 'missed';
};

const Countdown = ({ to }: { to: string }) => {
  const [, force] = useState(0);
  useEffect(() => {
    const i = setInterval(() => force((x) => x + 1), 30_000);
    return () => clearInterval(i);
  }, []);
  return <span>{formatDistanceToNow(new Date(to), { addSuffix: true })}</span>;
};

const TestRow = ({ t }: { t: any }) => {
  const navigate = useNavigate();
  const [, tick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => tick((x) => x + 1), 15_000);
    return () => clearInterval(i);
  }, []);
  const status = computeStatus(t);
  return (
    <Card className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
      <div className="shrink-0 rounded-lg p-2 bg-primary/10 text-primary self-start">
        <FileText className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold truncate">{t.title}</p>
          <Badge variant="outline" className="capitalize text-xs">{t.test_type} test</Badge>
          {status === 'upcoming' && <Badge variant="secondary">Upcoming</Badge>}
          {status === 'live' && <Badge className="bg-green-600 hover:bg-green-600">Live now</Badge>}
          {status === 'submitted' && <Badge className="bg-primary">Submitted</Badge>}
          {status === 'missed' && <Badge variant="destructive">Missed</Badge>}
        </div>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
          <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(t.scheduled_at), 'EEE, MMM d · p')}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{t.duration_minutes} min</span>
          <span>{t.total_questions} Qs ({t.mcq_count} MCQ + {t.written_count} written)</span>
        </p>
        {(() => {
          const items: string[] = t.test_type === 'topic' ? (t.topic_names || []) : (t.chapter_names || []);
          if (!items.length) return null;
          const label = t.test_type === 'topic' ? 'Topics covered' : 'Chapters covered';
          const shown = items.slice(0, 6);
          const extra = items.length - shown.length;
          return (
            <div className="mt-2 flex items-start gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground mt-0.5">{label}:</span>
              {shown.map((name, i) => (
                <Badge key={i} variant="outline" className="text-[11px] font-normal">{name}</Badge>
              ))}
              {extra > 0 && (
                <Badge variant="outline" className="text-[11px] font-normal">+{extra} more</Badge>
              )}
            </div>
          );
        })()}
        {status === 'upcoming' && (
          <p className="text-xs text-primary mt-1">Exam starts <Countdown to={t.scheduled_at} /></p>
        )}
        {status === 'submitted' && t.percentage !== null && (
          <p className="text-xs text-muted-foreground mt-1">Score: <span className="font-semibold text-foreground">{t.percentage}%</span></p>
        )}
      </div>
      <div className="shrink-0 flex gap-2">
        {status === 'live' && (
          <Button onClick={() => navigate(`/my-tests/${t.id}/take`)}>
            Start Test <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
        {status === 'submitted' && (
          <Button variant="outline" onClick={() => navigate(`/my-tests/${t.id}/result`)}>
            <CheckCircle2 className="h-4 w-4 mr-1" /> View Result
          </Button>
        )}
        {status === 'upcoming' && (
          <Button variant="outline" disabled>Not started yet</Button>
        )}
        {status === 'missed' && (
          <Button variant="ghost" disabled>Missed</Button>
        )}
      </div>
    </Card>
  );
};

const Inner = () => {
  const { data: tests = [], isLoading } = useSelfTests();
  return (
    <div className="space-y-4">
      <AutoChapterTestBanner />
      <Card className="p-5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> My Tests
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tests you scheduled from your Time Table. We'll email you 24h and 1h before each one.
        </p>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : tests.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="font-medium">No tests scheduled yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Go to Time Table → Schedule Test to create your first one.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {tests.map((t) => <TestRow key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
};

const MyTests = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/auth');
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (isMobile) {
    return (
      <>
        <SEOHead title="My Tests | SimpleLecture" description="Your scheduled self-tests" />
        <MobileLayout title="My Tests"><Inner /></MobileLayout>
      </>
    );
  }

  return (
    <>
      <SEOHead title="My Tests | SimpleLecture" description="Take and review the tests you scheduled." />
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <h1 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" /> My Tests
          </h1>
          <Inner />
        </div>
        <Footer />
      </div>
    </>
  );
};

export default MyTests;
