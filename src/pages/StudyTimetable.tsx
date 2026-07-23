import { useState, useMemo, useEffect } from 'react';
import {
  format, addDays, differenceInCalendarDays,
  startOfMonth, endOfMonth, getDay,
  eachDayOfInterval, isSameDay, isToday, addMonths, subMonths,
} from 'date-fns';
import { CalendarIcon, Clock, Trash2, CheckCircle2, Sparkles, Loader2, Wand2, ArrowRight, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

import { SEOHead } from '@/components/SEO';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TimetableHowToDialog, ScheduleTestHowToDialog } from '@/components/timetable/TimetableHowToDialog';
import { Footer } from '@/components/Footer';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { AutoChapterTestBanner } from '@/components/tests/AutoChapterTestBanner';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';


import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const useTimetableEnrollments = () => useQuery({
  queryKey: ['timetable-enrollments'],
  queryFn: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from('enrollments')
      .select('course_id, courses(id, name)')
      .eq('student_id', user.id)
      .eq('is_active', true);
    if (error) throw error;
    return data || [];
  },
});
import { useCourseSubjects } from '@/hooks/useCourseSubjects';
import { useSubjectChaptersWithTopics, useCourseChaptersWithTopics } from '@/hooks/useSubjectChaptersOptimized';

import {
  useStudyTimetableSessions,
  useCreateManualSessions,
  useDeleteSession,
  useDeleteAllSessions,
  useDeleteStudyPlan,
  useUpdateSessionStatus,
  useUpdateSession,
  useEvaluateFeasibility,
  useGenerateAutoPlan,
  useCreateTestSession,
  useStudyTimetableMeta,
  useReshuffleTimetable,
  useStudyTimetablePlans,
  useDeleteSinglePlan,
  type StudyPattern,
  type StudyPlanSummary,
} from '@/hooks/useStudyTimetable';

import { useCreateSelfTest, useSelfTests, type SelfTestWithLabels } from '@/hooks/useSelfTests';
import { Checkbox } from '@/components/ui/checkbox';

const PageInner = () => {
  const { data: enrollments, isLoading: loadingEnroll } = useTimetableEnrollments();
  const [courseId, setCourseId] = useState<string>('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [builderTab, setBuilderTab] = useState<'auto' | 'test'>('auto');
  const [wizardOpen, setWizardOpen] = useState(false);

  const openWizard = (tab: 'auto' | 'test') => {
    setBuilderTab(tab);
    setWizardOpen(true);
  };


  useEffect(() => {
    if (!courseId && enrollments?.length) {
      const first = (enrollments[0] as any).course_id || (enrollments[0] as any).courses?.id;
      if (first) setCourseId(first);
    }
  }, [enrollments, courseId]);

  // Reset plan filter when switching courses
  useEffect(() => { setSelectedPlanId(null); }, [courseId]);

  const { data: sessions = [], isLoading: loadingSessions } = useStudyTimetableSessions(courseId);
  const { data: plans = [] } = useStudyTimetablePlans(courseId);
  const { data: allTests = [] } = useSelfTests();
  const courseTests = useMemo(
    () => {
      const now = Date.now();
      return (allTests as SelfTestWithLabels[]).filter(
        t => t.course_id === courseId && !t.submitted_at && new Date(t.scheduled_at).getTime() >= now,
      );
    },
    [allTests, courseId],
  );

  // If the selected plan disappeared (deleted), fall back to "All"
  useEffect(() => {
    if (selectedPlanId && !plans.some(p => p.id === selectedPlanId)) {
      setSelectedPlanId(null);
    }
  }, [plans, selectedPlanId]);

  const filteredSessions = useMemo(() => {
    if (!selectedPlanId) return sessions;
    return sessions.filter((s: any) => s.timetable_id === selectedPlanId);
  }, [sessions, selectedPlanId]);

  const planCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sessions as any[]) {
      m.set(s.timetable_id, (m.get(s.timetable_id) || 0) + 1);
    }
    return m;
  }, [sessions]);

  return (
    <div className="space-y-6">
      <AutoChapterTestBanner />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => openWizard('auto')} className="gap-2" disabled={!courseId}>
          <Sparkles className="h-4 w-4" />
          Create Time Table
        </Button>
        <Button onClick={() => openWizard('test')} variant="outline" className="gap-2" disabled={!courseId}>
          <FileText className="h-4 w-4" />
          Schedule Exam
        </Button>
        {!courseId && (
          <span className="text-xs text-muted-foreground">Pick a course below to enable</span>
        )}
      </div>
      {courseId && (
        <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{builderTab === 'test' ? 'Schedule Exam' : 'Create Time Table'}</DialogTitle>
            </DialogHeader>
            <Builder courseId={courseId} tab={builderTab} onTabChange={setBuilderTab} />
          </DialogContent>
        </Dialog>
      )}

      <Card className="p-5">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary" />
          Pick a course
        </h2>
        {loadingEnroll ? (
          <p className="text-sm text-muted-foreground">Loading your courses…</p>
        ) : enrollments?.length === 0 ? (
          <p className="text-sm text-muted-foreground">You're not enrolled in any course yet.</p>
        ) : (
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger className="w-full md:w-96">
              <SelectValue placeholder="Select course" />
            </SelectTrigger>
            <SelectContent>
              {enrollments?.map((e: any) => {
                const id = e.course_id || e.courses?.id;
                const name = e.courses?.name || 'Course';
                return id ? <SelectItem key={id} value={id}>{name}</SelectItem> : null;
              })}
            </SelectContent>
          </Select>
        )}
      </Card>
      {courseId && (
        <>
          <PlansStrip
            plans={plans}
            counts={planCounts}
            selectedPlanId={selectedPlanId}
            onSelect={setSelectedPlanId}
            courseId={courseId}
            tests={courseTests}
          />
          <UpcomingSessions sessions={filteredSessions} isLoading={loadingSessions} courseId={courseId} tests={courseTests} />
          {filteredSessions.length > 0 && <DangerZone courseId={courseId} count={filteredSessions.length} />}
          <Builder courseId={courseId} tab={builderTab} onTabChange={setBuilderTab} />
        </>
      )}
    </div>
  );
};

const SCOPE_BADGE: Record<StudyPlanSummary['scopeType'], { label: string; cls: string }> = {
  course:  { label: 'Course',  cls: 'bg-primary/15 text-primary border-primary/30' },
  subject: { label: 'Subject', cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30' },
  chapter: { label: 'Chapter', cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30' },
  topic:   { label: 'Topic',   cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  manual:  { label: 'Manual',  cls: 'bg-muted text-muted-foreground border-border' },
};

const PlansStrip = ({
  plans, counts, selectedPlanId, onSelect, courseId, tests,
}: {
  plans: StudyPlanSummary[];
  counts: Map<string, number>;
  selectedPlanId: string | null;
  onSelect: (id: string | null) => void;
  courseId: string;
  tests: SelfTestWithLabels[];
}) => {
  const del = useDeleteSinglePlan();
  const navigate = useNavigate();
  const totalSessions = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  const isEmpty = plans.length === 0 && tests.length === 0;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Plans
        </h2>
        <span className="text-xs text-muted-foreground">
          {plans.length} {plans.length === 1 ? 'plan' : 'plans'}
          {tests.length > 0 && <> · {tests.length} {tests.length === 1 ? 'test' : 'tests'}</>}
        </span>
      </div>

      {isEmpty ? (
        <p className="text-sm text-muted-foreground">
          No plans yet — generate one below to schedule sessions on the calendar.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {/* All plans card */}
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={cn(
              'shrink-0 w-48 text-left rounded-lg border p-3 transition-all bg-card hover:border-primary/40',
              selectedPlanId === null && 'border-primary ring-2 ring-primary/30',
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <Badge variant="outline" className="text-[10px]">All</Badge>
              <span className="text-[10px] text-muted-foreground">{totalSessions} sessions</span>
            </div>
            <p className="font-medium text-sm leading-tight">All plans</p>
            <p className="text-xs text-muted-foreground mt-1">Show every scheduled session</p>
          </button>

          {plans.map(plan => {
            const badge = SCOPE_BADGE[plan.scopeType];
            const isSel = plan.id === selectedPlanId;
            const count = counts.get(plan.id) || 0;
            return (
              <div
                key={plan.id}
                className={cn(
                  'shrink-0 w-56 rounded-lg border p-3 transition-all bg-card hover:border-primary/40 relative group',
                  isSel && 'border-primary ring-2 ring-primary/30',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(plan.id)}
                  className="text-left w-full"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge variant="outline" className={cn('text-[10px]', badge.cls)}>{badge.label}</Badge>
                    <span className="text-[10px] text-muted-foreground">{count} sessions</span>
                  </div>
                  <p className="font-medium text-sm leading-tight pr-6 line-clamp-2">{plan.scopeLabel}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.deadline
                      ? `${plan.startDate ? `From ${format(new Date(plan.startDate), 'd MMM')} → ` : ''}By ${format(new Date(plan.deadline), 'd MMM yyyy')}`
                      : 'No deadline'}
                  </p>
                </button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this plan?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the plan and its {count} scheduled session{count === 1 ? '' : 's'}. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => del.mutate({ timetableId: plan.id, courseId })}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}

          {/* Test cards */}
          {tests.map(t => {
            const submitted = t.status === 'submitted';
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => navigate('/my-tests')}
                className={cn(
                  'shrink-0 w-56 text-left rounded-lg border p-3 transition-all relative',
                  'border-amber-500/40 bg-amber-500/[0.06] hover:border-amber-500/70 hover:shadow-md',
                  submitted && 'opacity-70',
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <Badge
                    variant="outline"
                    className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  >
                    Test · {t.test_type === 'chapter' ? 'Chapter' : 'Topic'}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {t.total_questions}Q · {t.duration_minutes}m
                  </span>
                </div>
                <p className="font-medium text-sm leading-tight line-clamp-2">{t.title}</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 font-medium">
                  {format(new Date(t.scheduled_at), 'd MMM yyyy · HH:mm')}
                </p>
                {submitted && (
                  <p className="text-[10px] text-muted-foreground mt-1">Submitted</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
};



const useSessionEntityTitles = (sessions: any[]) => {
  const subjectIds = useMemo(() => Array.from(new Set(sessions.map(s => s.subject_id).filter(Boolean))), [sessions]);
  const chapterIds = useMemo(() => Array.from(new Set(sessions.map(s => s.chapter_id).filter(Boolean))), [sessions]);
  const topicIds = useMemo(() => Array.from(new Set(sessions.map(s => s.topic_id).filter(Boolean))), [sessions]);
  const key = `${subjectIds.length}-${chapterIds.length}-${topicIds.length}`;
  return useQuery({
    queryKey: ['session-entity-titles', key, subjectIds, chapterIds, topicIds],
    enabled: sessions.length > 0,
    queryFn: async () => {
      const [subs, chaps, tops] = await Promise.all([
        subjectIds.length ? supabase.from('popular_subjects').select('id,name').in('id', subjectIds as string[]) : Promise.resolve({ data: [] as any[] }),
        chapterIds.length ? supabase.from('subject_chapters').select('id,title').in('id', chapterIds as string[]) : Promise.resolve({ data: [] as any[] }),
        topicIds.length ? supabase.from('subject_topics').select('id,title').in('id', topicIds as string[]) : Promise.resolve({ data: [] as any[] }),
      ]);
      const subject = new Map((subs.data || []).map((r: any) => [r.id, r.name]));
      const chapter = new Map((chaps.data || []).map((r: any) => [r.id, r.title]));
      const topic = new Map((tops.data || []).map((r: any) => [r.id, r.title]));
      return { subject, chapter, topic };
    },
  });
};

import { colorForSubject, bucketOf, BUCKET_LABEL } from '@/components/timetable/dayStyling';

const DayPopoverBody = ({
  day, sessions, tests = [], titles, courseId, onDone, onDelete,
}: {
  day: Date;
  sessions: any[];
  tests?: SelfTestWithLabels[];
  titles?: { subject: Map<string, string>; chapter: Map<string, string>; topic: Map<string, string> };
  courseId: string;
  onDone: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = { morning: [], afternoon: [], night: [] };
    for (const s of sessions) g[bucketOf(new Date(s.scheduled_at))].push(s);
    return g;
  }, [sessions]);

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold">{format(day, 'EEEE')}</p>
          <p className="text-xs text-muted-foreground">{format(day, 'MMM d, yyyy')}</p>
        </div>
        {sessions.length > 0 && (
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => setEditOpen(true)}>
            <Wand2 className="h-3 w-3 mr-1" />Edit day
          </Button>
        )}
      </div>
      {sessions.length === 0 && tests.length === 0 && (
        <p className="text-sm text-muted-foreground">No sessions planned.</p>
      )}
      {tests.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Tests scheduled
          </p>
          {tests.map(t => {
            const submitted = t.status === 'submitted';
            return (
              <div key={t.id} className="rounded-lg border border-amber-500/40 bg-amber-500/[0.08] p-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{format(new Date(t.scheduled_at), 'p')} · {t.duration_minutes}m</p>
                    <p className="font-medium mt-0.5">{t.title}</p>
                    <p className="opacity-80">
                      {t.test_type === 'chapter' ? 'Chapter test' : 'Topic test'} · {t.total_questions} questions
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="shrink-0 text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
                  >
                    {submitted ? 'Submitted' : 'Test'}
                  </Badge>
                </div>
                <div className="flex justify-end gap-1 mt-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => navigate('/my-tests')}
                  >
                    {submitted ? 'View result' : 'Open test'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {(['morning', 'afternoon', 'night'] as const).map(b => grouped[b].length > 0 && (
        <div key={b} className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{BUCKET_LABEL[b]}</p>
          {grouped[b].map(s => {
            const start = new Date(s.scheduled_at);
            const end = new Date(start.getTime() + (s.duration_minutes || 0) * 60000);
            const subj = titles?.subject.get(s.subject_id);
            const chap = titles?.chapter.get(s.chapter_id);
            const top = titles?.topic.get(s.topic_id);
            const canPlay = !!s.course_id && (!!s.topic_id || !!s.chapter_id);
            const goPlay = () => {
              if (!canPlay) return;
              const params = new URLSearchParams();
              if (s.subject_id) params.set('subject', s.subject_id);
              if (s.chapter_id) params.set('chapter', s.chapter_id);
              if (s.topic_id) params.set('topic', s.topic_id);
              params.set('autoplay', '1');
              navigate(`/learning/${s.course_id}?${params.toString()}`);
            };
            return (
              <div
                key={s.id}
                role={canPlay ? 'button' : undefined}
                tabIndex={canPlay ? 0 : undefined}
                onClick={canPlay ? goPlay : undefined}
                onKeyDown={canPlay ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goPlay(); } } : undefined}
                className={cn(
                  'rounded-lg border p-2.5 text-xs',
                  colorForSubject(s.subject_id),
                  canPlay && 'cursor-pointer hover:shadow-md hover:ring-1 hover:ring-primary/40 transition-all',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{format(start, 'p')} – {format(end, 'p')}</p>
                    {subj && <p className="font-medium mt-0.5">{subj}</p>}
                    {chap && <p className="opacity-80">{chap}</p>}
                    {top && <p className="opacity-70 italic">{top}</p>}
                    <p className="mt-1 opacity-90 truncate">{s.title}</p>
                  </div>
                  <Badge variant={s.status === 'done' ? 'default' : 'outline'} className="shrink-0 text-[10px]">{s.status}</Badge>
                </div>
                <div className="flex justify-end gap-1 mt-1.5">
                  {s.status === 'pending' && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px]" onClick={(e) => { e.stopPropagation(); onDone(s.id); }}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />Done
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {editOpen && (
        <EditDayDialog
          day={day}
          sessions={sessions}
          courseId={courseId}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </div>
  );
};

type EditDraft = {
  id: string;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  start_time: string; // HH:mm
  duration_minutes: number;
};

const pad2 = (n: number) => String(n).padStart(2, '0');

const EditDayDialog = ({
  day, sessions, courseId, open, onOpenChange,
}: {
  day: Date;
  sessions: any[];
  courseId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) => {
  const { data: courseSubjects = [] } = useCourseSubjects(courseId);
  const update = useUpdateSession();
  const del = useDeleteSession();

  const initial: EditDraft[] = useMemo(() => sessions.map(s => {
    const d = new Date(s.scheduled_at);
    return {
      id: s.id,
      subject_id: s.subject_id || null,
      chapter_id: s.chapter_id || null,
      topic_id: s.topic_id || null,
      start_time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
      duration_minutes: s.duration_minutes || 60,
    };
  }), [sessions]);

  const [drafts, setDrafts] = useState<EditDraft[]>(initial);
  useEffect(() => { setDrafts(initial); }, [initial]);

  const subjectOptions = useMemo(
    () => courseSubjects.map((cs: any) => ({ id: cs.subject?.id || cs.subject_id, name: cs.subject?.name || 'Subject' })).filter((s: any) => s.id),
    [courseSubjects]
  );

  const patchDraft = (idx: number, patch: Partial<EditDraft>) => {
    setDrafts(d => d.map((row, i) => i === idx ? { ...row, ...patch } : row));
  };

  const save = async () => {
    try {
      await Promise.all(drafts.map(async (d, idx) => {
        const orig = initial[idx];
        const changed =
          d.subject_id !== orig.subject_id ||
          d.chapter_id !== orig.chapter_id ||
          d.topic_id !== orig.topic_id ||
          d.start_time !== orig.start_time ||
          d.duration_minutes !== orig.duration_minutes;
        if (!changed) return;

        const [hh, mm] = d.start_time.split(':').map(Number);
        const newDate = new Date(day);
        newDate.setHours(hh, mm, 0, 0);

        await update.mutateAsync({
          id: d.id,
          subject_id: d.subject_id,
          chapter_id: d.chapter_id,
          topic_id: d.topic_id,
          scheduled_at: newDate.toISOString(),
          duration_minutes: d.duration_minutes,
        });
      }));
      toast.success('Sessions updated');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to save changes');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit sessions — {format(day, 'EEEE, MMM d')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {drafts.length === 0 && <p className="text-sm text-muted-foreground">No sessions on this day.</p>}
          {drafts.map((d, idx) => (
            <EditSessionRow
              key={d.id}
              draft={d}
              subjects={subjectOptions}
              onChange={(patch) => patchDraft(idx, patch)}
              onDelete={() => {
                del.mutate(d.id);
                setDrafts(prev => prev.filter((_, i) => i !== idx));
              }}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EditSessionRow = ({
  draft, subjects, onChange, onDelete,
}: {
  draft: EditDraft;
  subjects: { id: string; name: string }[];
  onChange: (patch: Partial<EditDraft>) => void;
  onDelete: () => void;
}) => {
  const { data: chaptersData = [] } = useSubjectChaptersWithTopics(draft.subject_id || undefined);
  const chapters = chaptersData as any[];
  const currentChapter = chapters.find(c => c.id === draft.chapter_id);
  const topics = currentChapter?.subject_topics || [];

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Subject</Label>
          <Select
            value={draft.subject_id || ''}
            onValueChange={(v) => onChange({ subject_id: v, chapter_id: null, topic_id: null })}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>
              {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Chapter</Label>
          <Select
            value={draft.chapter_id || ''}
            onValueChange={(v) => onChange({ chapter_id: v, topic_id: null })}
            disabled={!draft.subject_id}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Select chapter" /></SelectTrigger>
            <SelectContent>
              {chapters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Topic</Label>
          <Select
            value={draft.topic_id || '__none__'}
            onValueChange={(v) => onChange({ topic_id: v === '__none__' ? null : v })}
            disabled={!draft.chapter_id}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Select topic" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No topic</SelectItem>
              {topics.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 items-end">
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Start time</Label>
          <Input
            type="time"
            value={draft.start_time}
            onChange={(e) => onChange({ start_time: e.target.value })}
            className="h-9"
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Duration (min)</Label>
          <Input
            type="number"
            min={5}
            step={5}
            value={draft.duration_minutes}
            onChange={(e) => onChange({ duration_minutes: Math.max(5, Number(e.target.value) || 0) })}
            className="h-9"
          />
        </div>
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-1" />Remove
          </Button>
        </div>
      </div>
    </div>
  );
};


const PATTERN_OPTIONS: { value: StudyPattern; label: string; hint: string }[] = [
  { value: 'sequential', label: 'One subject', hint: 'Finish one subject before starting the next' },
  { value: 'pair', label: '2 / day', hint: 'Alternate 2 subjects each day' },
  { value: 'mixed', label: 'Mixed', hint: 'Mix every subject into each study day' },
];

const UpcomingSessions = ({ sessions, isLoading, courseId, tests = [] }: { sessions: any[]; isLoading: boolean; courseId: string; tests?: SelfTestWithLabels[] }) => {
  const del = useDeleteSession();
  const upd = useUpdateSessionStatus();
  const [cursor, setCursor] = useState<Date>(new Date());
  const { data: titles } = useSessionEntityTitles(sessions);
  const { data: meta } = useStudyTimetableMeta(courseId);
  const reshuffle = useReshuffleTimetable();
  const [pendingPattern, setPendingPattern] = useState<StudyPattern | null>(null);

  const activePattern: StudyPattern = ((meta?.plan_metadata as any)?.pattern as StudyPattern) || 'sequential';
  const canReshuffle = !!meta && sessions.length > 0;

  const byDate = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const s of sessions) {
      const k = format(new Date(s.scheduled_at), 'yyyy-MM-dd');
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(s);
    }
    for (const arr of m.values()) arr.sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
    return m;
  }, [sessions]);

  const testsByDate = useMemo(() => {
    const m = new Map<string, SelfTestWithLabels[]>();
    for (const t of tests) {
      const k = format(new Date(t.scheduled_at), 'yyyy-MM-dd');
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(t);
    }
    return m;
  }, [tests]);


  const days = useMemo(() => {
    return eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) });
  }, [cursor]);
  const leadingBlanks = useMemo(() => getDay(startOfMonth(cursor)), [cursor]);

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card className="p-5 md:p-6 border-0 shadow-lg bg-gradient-to-br from-card via-card to-primary/[0.03] rounded-3xl">
      <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">My Schedule</p>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{format(cursor, 'MMMM yyyy')}</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canReshuffle && (
            <div className="inline-flex items-center gap-0.5 bg-muted/40 rounded-full p-1">
              {PATTERN_OPTIONS.map(opt => {
                const active = reshuffle.isPending
                  ? pendingPattern === opt.value
                  : activePattern === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    title={opt.hint}
                    disabled={reshuffle.isPending}
                    onClick={() => {
                      if (reshuffle.isPending) return;
                      setPendingPattern(opt.value);
                    }}
                    className={cn(
                      'rounded-full h-8 px-3 text-xs font-medium transition-colors inline-flex items-center gap-1.5',
                      active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      reshuffle.isPending && 'opacity-70 cursor-not-allowed',
                    )}
                  >
                    {reshuffle.isPending && pendingPattern === opt.value && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-1 bg-muted/40 rounded-full p-1">
            <Button size="icon" variant="ghost" className="rounded-full h-8 w-8" disabled={reshuffle.isPending} onClick={() => setCursor(subMonths(cursor, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full h-8 px-3 text-xs" disabled={reshuffle.isPending} onClick={() => setCursor(new Date())}>Today</Button>
            <Button size="icon" variant="ghost" className="rounded-full h-8 w-8" disabled={reshuffle.isPending} onClick={() => setCursor(addMonths(cursor, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>


      <AlertDialog open={!!pendingPattern} onOpenChange={(o) => { if (!o) setPendingPattern(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reshuffle your schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current sessions will be replaced with a new arrangement based on the selected pattern. Completed sessions will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const p = pendingPattern;
                setPendingPattern(null);
                if (p) await reshuffle.mutateAsync({ courseId, pattern: p });
              }}
            >
              Reshuffle
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="relative">
          <div className={cn(reshuffle.isPending && 'opacity-40 pointer-events-none transition-opacity')}>
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {weekdays.map(d => (
                <div key={d} className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} aria-hidden />
              ))}
              {days.map(day => {
                const key = format(day, 'yyyy-MM-dd');
                const items = byDate.get(key) || [];
                const dayTests = testsByDate.get(key) || [];
                const hasTest = dayTests.length > 0;
                const today = isToday(day);
                return (
                  <HoverCard key={key} openDelay={120} closeDelay={80}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'group text-left rounded-xl border p-2 min-h-[80px] md:min-h-[110px] transition-all',
                          'hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40',
                          'bg-card',
                          today && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                          hasTest && 'animate-test-glow border-amber-500/60 bg-amber-500/[0.08]',
                        )}
                      >
                        <div className="flex items-center justify-between mb-1.5 gap-1">
                          <span className={cn(
                            'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full',
                            today && 'bg-primary text-primary-foreground',
                          )}>{format(day, 'd')}</span>
                          <div className="flex items-center gap-1">
                            {hasTest && (
                              <span className="text-[9px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-full px-1.5 py-0.5">
                                Test
                              </span>
                            )}
                            {items.length > 0 && (
                              <span className="text-[9px] font-medium bg-primary/10 text-primary rounded-full px-1.5 py-0.5">
                                {items.length}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="space-y-0.5">
                          {hasTest && dayTests.slice(0, 1).map(t => (
                            <div
                              key={t.id}
                              className="text-[10px] leading-tight rounded-md px-1.5 py-0.5 truncate border border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200 font-semibold"
                            >
                              <span className="hidden md:inline">{format(new Date(t.scheduled_at), 'HH:mm')} </span>
                              {t.title}
                            </div>
                          ))}
                          {items.slice(0, hasTest ? 1 : 2).map(s => {
                            const subj = titles?.subject.get(s.subject_id);
                            return (
                              <div
                                key={s.id}
                                className={cn(
                                  'text-[10px] leading-tight rounded-md px-1.5 py-0.5 truncate border',
                                  colorForSubject(s.subject_id),
                                  s.status === 'done' && 'opacity-60 line-through',
                                )}
                              >
                                <span className="hidden md:inline font-semibold">{format(new Date(s.scheduled_at), 'HH:mm')} </span>
                                {subj || s.title}
                              </div>
                            );
                          })}
                          {(items.length + dayTests.length) > (hasTest ? 2 : 2) && (
                            <div className="text-[10px] text-muted-foreground font-medium px-1">
                              +{items.length + dayTests.length - (hasTest ? 2 : 2)} more
                            </div>
                          )}
                        </div>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent side="top" align="center" className="w-80 p-4">
                      <DayPopoverBody
                        day={day}
                        sessions={items}
                        tests={dayTests}
                        titles={titles}
                        courseId={courseId}
                        onDone={(id) => upd.mutate({ id, status: 'done' })}
                        onDelete={(id) => del.mutate(id)}
                      />
                    </HoverCardContent>
                  </HoverCard>
                );
              })}
            </div>
          </div>
          {reshuffle.isPending && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/70 backdrop-blur-sm rounded-2xl z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-sm font-semibold">Reshuffling your schedule…</p>
                <p className="text-xs text-muted-foreground mt-0.5">Saving to your account so it syncs everywhere.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};



const DangerZone = ({ courseId, count }: { courseId: string; count: number }) => {
  const clearAll = useDeleteAllSessions();
  const deletePlan = useDeleteStudyPlan();
  return (
    <Card className="p-5 md:p-6 border border-destructive/30 bg-destructive/[0.04] rounded-3xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-destructive/80">Danger Zone</p>
          <h3 className="text-lg font-bold mt-1">Manage your study plan</h3>
          <p className="text-sm text-muted-foreground mt-1">
            You currently have {count} session{count === 1 ? '' : 's'} scheduled. These actions cannot be undone.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Clear all sessions
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all sessions?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove every scheduled session in this course's timetable. The plan shell stays so you can add new sessions. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => clearAll.mutate(courseId)}
                >
                  Yes, clear sessions
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Delete entire plan
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this study plan?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes your timetable and all {count} session{count === 1 ? '' : 's'} for this course. You can create a new plan afterwards. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deletePlan.mutate(courseId)}
                >
                  Yes, delete plan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Card>
  );
};


const Builder = ({ courseId, tab, onTabChange }: { courseId: string; tab?: 'auto' | 'test'; onTabChange?: (v: 'auto' | 'test') => void }) => {
  return (
    <Card className="p-5" id="builder-section">
      <Tabs value={tab} defaultValue="auto" onValueChange={(v) => onTabChange?.(v as 'auto' | 'test')}>
        <TabsList className="grid grid-cols-2 w-full md:w-[360px] mb-4">
          <TabsTrigger value="auto"><Sparkles className="h-3.5 w-3.5 mr-1" />Time Table</TabsTrigger>
          <TabsTrigger value="test"><FileText className="h-3.5 w-3.5 mr-1" />Schedule Test</TabsTrigger>
        </TabsList>
        <TabsContent value="auto">
          <AutoBuilder courseId={courseId} />
        </TabsContent>
        <TabsContent value="test">
          <TestScheduler courseId={courseId} />
        </TabsContent>
      </Tabs>
    </Card>
  );
};

const TestScheduler = ({ courseId }: { courseId: string }) => {
  const { data: subjects = [] } = useCourseSubjects(courseId);
  const [subjectId, setSubjectId] = useState<string>('');
  const { data: chapters = [] } = useSubjectChaptersWithTopics(subjectId);
  const [testType, setTestType] = useState<'topic' | 'chapter' | ''>('');
  const [selectedChapterIds, setSelectedChapterIds] = useState<string[]>([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  // For topic test: which chapter is the topic picker scoped to
  const [topicChapterId, setTopicChapterId] = useState<string>('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('17:00');
  const [duration, setDuration] = useState(60);
  const [title, setTitle] = useState('');

  const create = useCreateSelfTest();

  const topicChapter = useMemo(
    () => (chapters as any[]).find((c: any) => c.id === topicChapterId),
    [chapters, topicChapterId]
  );
  const topicsOfChapter = topicChapter?.subject_topics || [];

  // Reset downstream selections when key things change
  useEffect(() => {
    setSelectedChapterIds([]);
    setSelectedTopicIds([]);
    setTopicChapterId('');
  }, [subjectId, testType]);

  // Auto-fill title
  useEffect(() => {
    if (title) return;
    if (testType === 'chapter' && selectedChapterIds.length) {
      const names = (chapters as any[])
        .filter((c: any) => selectedChapterIds.includes(c.id))
        .map((c: any) => c.title)
        .slice(0, 2)
        .join(', ');
      setTitle(`Chapter Test — ${names}${selectedChapterIds.length > 2 ? ` +${selectedChapterIds.length - 2}` : ''}`);
    } else if (testType === 'topic' && selectedTopicIds.length && topicChapter) {
      setTitle(`Topic Test — ${topicChapter.title}`);
    }
  }, [testType, selectedChapterIds, selectedTopicIds, chapters, topicChapter]); // eslint-disable-line

  const toggle = (id: string, arr: string[], set: (v: string[]) => void) => {
    set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  };

  const canSubmit =
    !!subjectId &&
    !!testType &&
    !!date &&
    !!startTime &&
    !!title.trim() &&
    duration >= 5 &&
    (testType === 'chapter' ? selectedChapterIds.length > 0 : selectedTopicIds.length > 0);

  const submit = () => {
    if (!canSubmit || !date) return;
    const start = new Date(date);
    const [h, m] = startTime.split(':').map(Number);
    start.setHours(h, m, 0, 0);
    if (start.getTime() <= Date.now()) {
      toast.error('Pick a future date and time');
      return;
    }
    // Derive chapter_ids: for topic test, infer from topic_chapter_id
    const chapterIds = testType === 'chapter'
      ? selectedChapterIds
      : (topicChapterId ? [topicChapterId] : []);

    create.mutate({
      courseId,
      subjectId,
      testType: testType as 'topic' | 'chapter',
      chapterIds,
      topicIds: testType === 'topic' ? selectedTopicIds : [],
      title: title.trim(),
      scheduledAt: start.toISOString(),
      durationMinutes: duration,
    }, {
      onSuccess: () => {
        setTitle('');
        setSelectedChapterIds([]);
        setSelectedTopicIds([]);
        setTopicChapterId('');
        setDate(undefined);
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-sm text-muted-foreground">
        Schedule a personal test. We'll pick questions automatically and email reminders <strong>24h</strong> & <strong>1h</strong> before.
      </div>

      {/* Step 1: Subject */}
      <div>
        <Label>1. Subject</Label>
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger><SelectValue placeholder="Choose subject" /></SelectTrigger>
          <SelectContent>
            {subjects.map((cs: any) => (
              <SelectItem key={cs.subject?.id} value={cs.subject?.id}>{cs.subject?.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Step 2: Test type */}
      {subjectId && (
        <div>
          <Label>2. Test type</Label>
          <RadioGroup value={testType} onValueChange={(v) => setTestType(v as any)} className="grid grid-cols-2 gap-3 mt-2">
            <label className={cn('border rounded-lg p-3 cursor-pointer flex items-center gap-2', testType === 'topic' && 'border-primary bg-primary/5')}>
              <RadioGroupItem value="topic" />
              <div>
                <p className="font-medium text-sm">Topic Test</p>
                <p className="text-xs text-muted-foreground">Pick a chapter, then specific topics</p>
              </div>
            </label>
            <label className={cn('border rounded-lg p-3 cursor-pointer flex items-center gap-2', testType === 'chapter' && 'border-primary bg-primary/5')}>
              <RadioGroupItem value="chapter" />
              <div>
                <p className="font-medium text-sm">Chapter Test</p>
                <p className="text-xs text-muted-foreground">Pick one or more chapters</p>
              </div>
            </label>
          </RadioGroup>
        </div>
      )}

      {/* Step 3a: Topic flow — pick chapter then topics */}
      {testType === 'topic' && (
        <>
          <div>
            <Label>3. Chapter</Label>
            <Select value={topicChapterId} onValueChange={(v) => { setTopicChapterId(v); setSelectedTopicIds([]); }}>
              <SelectTrigger><SelectValue placeholder="Choose chapter" /></SelectTrigger>
              <SelectContent>
                {(chapters as any[]).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {topicChapterId && (
            <div>
              <Label>4. Topics ({selectedTopicIds.length} selected)</Label>
              <div className="border rounded-lg p-3 max-h-56 overflow-auto space-y-2 mt-1">
                {topicsOfChapter.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No topics in this chapter.</p>
                ) : topicsOfChapter.map((t: any) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={selectedTopicIds.includes(t.id)}
                      onCheckedChange={() => toggle(t.id, selectedTopicIds, setSelectedTopicIds)}
                    />
                    <span>{t.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Step 3b: Chapter flow — pick chapters */}
      {testType === 'chapter' && (
        <div>
          <Label>3. Chapters ({selectedChapterIds.length} selected)</Label>
          <div className="border rounded-lg p-3 max-h-56 overflow-auto space-y-2 mt-1">
            {(chapters as any[]).length === 0 ? (
              <p className="text-sm text-muted-foreground">No chapters available.</p>
            ) : (chapters as any[]).map((c: any) => (
              <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedChapterIds.includes(c.id)}
                  onCheckedChange={() => toggle(c.id, selectedChapterIds, setSelectedChapterIds)}
                />
                <span>{c.title}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: schedule details */}
      {testType && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
          <div className="md:col-span-2">
            <Label>Test title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Self-test: Algebra Ch.3" />
          </div>
          <div>
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))} initialFocus className={cn('p-3 pointer-events-auto')} />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start time</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label>Duration (min)</Label>
              <Input type="number" min={5} max={300} value={duration} onChange={e => setDuration(Number(e.target.value))} />
            </div>
          </div>

          <div className="md:col-span-2">
            <Button onClick={submit} disabled={!canSubmit || create.isPending} className="w-full md:w-auto">
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              Schedule Test &amp; Email Me
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const ManualBuilder = ({ courseId }: { courseId: string }) => {
  const { data: subjects = [] } = useCourseSubjects(courseId);
  const create = useCreateManualSessions();

  const [subjectId, setSubjectId] = useState<string>('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('17:00');
  const [endTime, setEndTime] = useState('18:00');
  const [title, setTitle] = useState('');

  const submit = () => {
    if (!date || !startTime || !endTime || !title.trim()) return;
    const start = new Date(date);
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(date);
    end.setHours(eh, em, 0, 0);
    const dur = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000));
    create.mutate({
      courseId,
      subjectId: subjectId || null,
      title: title.trim(),
      sessions: [{ scheduled_at: start.toISOString(), duration_minutes: dur }],
    }, {
      onSuccess: () => { setTitle(''); }
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <Label>Subject (optional)</Label>
        <Select value={subjectId} onValueChange={setSubjectId}>
          <SelectTrigger><SelectValue placeholder="Choose subject" /></SelectTrigger>
          <SelectContent>
            {subjects.map((cs: any) => (
              <SelectItem key={cs.subject?.id} value={cs.subject?.id}>{cs.subject?.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>What will you study?</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Algebra Chapter 3" />
      </div>
      <div>
        <Label>Date</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, 'PPP') : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={date} onSelect={setDate} disabled={(d) => d < new Date(new Date().setHours(0,0,0,0))} initialFocus className={cn('p-3 pointer-events-auto')} />
          </PopoverContent>
        </Popover>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Start time</Label>
          <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
        </div>
        <div>
          <Label>End time</Label>
          <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
      </div>
      <div className="md:col-span-2">
        <Button onClick={submit} disabled={create.isPending || !date || !title.trim()} className="w-full md:w-auto">
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarIcon className="h-4 w-4 mr-2" />}
          Add to Time Table
        </Button>
      </div>
    </div>
  );
};

type Scope = 'course' | 'subject' | 'chapter' | 'topic';
type IntervalLabel = 'morning' | 'afternoon' | 'night';
type IntervalState = { enabled: boolean; start: string; end: string };
type DayIntervals = Record<IntervalLabel, IntervalState>;

const DEFAULT_INTERVALS: DayIntervals = {
  morning: { enabled: true, start: '07:00', end: '09:00' },
  afternoon: { enabled: false, start: '14:00', end: '16:00' },
  night: { enabled: true, start: '19:00', end: '21:00' },
};
const WEEKEND_DEFAULT: DayIntervals = {
  morning: { enabled: true, start: '09:00', end: '11:00' },
  afternoon: { enabled: true, start: '15:00', end: '17:00' },
  night: { enabled: false, start: '20:00', end: '22:00' },
};

const toDayPlan = (d: DayIntervals) => ({
  intervals: (Object.keys(d) as IntervalLabel[])
    .filter(k => d[k].enabled && d[k].start < d[k].end)
    .map(k => ({ label: k, start: d[k].start, end: d[k].end })),
});

const minutesOf = (iv: IntervalState) => {
  const [sh, sm] = iv.start.split(':').map(Number);
  const [eh, em] = iv.end.split(':').map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
};
const dayMinutes = (d: DayIntervals) =>
  (Object.keys(d) as IntervalLabel[]).reduce((a, k) => a + (d[k].enabled ? minutesOf(d[k]) : 0), 0);

const IntervalEditor = ({ label, value, onChange }: { label: string; value: DayIntervals; onChange: (v: DayIntervals) => void }) => {
  const rows: { key: IntervalLabel; title: string; emoji: string }[] = [
    { key: 'morning', title: 'Morning', emoji: '🌅' },
    { key: 'afternoon', title: 'Afternoon', emoji: '☀️' },
    { key: 'night', title: 'Night', emoji: '🌙' },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold">{label}</p>
      {rows.map(({ key, title, emoji }) => {
        const iv = value[key];
        return (
          <div
            key={key}
            className={cn(
              'rounded-xl border p-3 transition-colors',
              iv.enabled ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border opacity-70',
            )}
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <span>{emoji}</span>{title}
              </span>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={!iv.enabled}
                  onCheckedChange={(c) => onChange({ ...value, [key]: { ...iv, enabled: !c } })}
                />
                Skip
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Start</Label>
                <Input type="time" disabled={!iv.enabled} value={iv.start} onChange={e => onChange({ ...value, [key]: { ...iv, start: e.target.value } })} />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">End</Label>
                <Input type="time" disabled={!iv.enabled} value={iv.end} onChange={e => onChange({ ...value, [key]: { ...iv, end: e.target.value } })} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

import { useCoursePublishedLectureStats } from '@/hooks/useCoursePublishedLectureStats';

const AutoBuilder = ({ courseId }: { courseId: string }) => {
  const { data: subjects = [] } = useCourseSubjects(courseId);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  const [scope, setScope] = useState<Scope>('course');
  const [subjectId, setSubjectId] = useState<string>('');
  const [chapterId, setChapterId] = useState<string>('');
  const [topicId, setTopicId] = useState<string>('');
  const { data: chaptersData = [] } = useSubjectChaptersWithTopics(subjectId);

  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [deadline, setDeadline] = useState<Date | undefined>(addDays(new Date(), 30));
  const [weekday, setWeekday] = useState<DayIntervals>(DEFAULT_INTERVALS);
  const [saturday, setSaturday] = useState<DayIntervals>(WEEKEND_DEFAULT);
  const [sunday, setSunday] = useState<DayIntervals>(WEEKEND_DEFAULT);
  const [feasibility, setFeasibility] = useState<{ verdict: string; message: string } | null>(null);
  const [pattern, setPattern] = useState<StudyPattern>('sequential');

  const evalMut = useEvaluateFeasibility();
  const genMut = useGenerateAutoPlan();
  // For course scope: fetch chapters+topics for every subject in the course
  const courseSubjectList = useMemo(
    () => (subjects || [])
      .map((cs: any) => ({ id: cs.subject?.id, name: cs.subject?.name || 'Subject' }))
      .filter((s: any) => !!s.id),
    [subjects]
  );
  const { data: courseChaptersBySubject = [] } = useCourseChaptersWithTopics(
    scope === 'course' ? courseSubjectList : []
  );

  // Subject IDs we need real lecture durations for (based on current scope)
  const durationSubjectIds = useMemo(() => {
    if (scope === 'course') return courseSubjectList.map((s: any) => s.id);
    if (subjectId) return [subjectId];
    return [];
  }, [scope, courseSubjectList, subjectId]);

  const { data: lectureStats, isLoading: loadingDurations } =
    useCoursePublishedLectureStats(durationSubjectIds);

  const { items, scopeLabel, totalLectures } = useMemo(() => {
    const lookup = lectureStats?.durationByTopic || {};
    const counts = lectureStats?.lectureCountByTopic || {};
    // Only include topics that have a published lecture visible to students.
    // Chapters with no published topics are skipped entirely.
    const buildFromChapters = (chapters: any[], subjectIdForItems: string, prefix?: string) => {
      const out: any[] = [];
      let lectures = 0;
      for (const c of chapters || []) {
        for (const t of c.subject_topics || []) {
          const minutes = lookup[t.id];
          if (!minutes || minutes <= 0) continue;
          out.push({
            id: `topic-${t.id}`,
            title: prefix ? `${prefix} • ${c.title} • ${t.title}` : `${c.title} • ${t.title}`,
            durationMinutes: minutes,
            subject_id: subjectIdForItems,
            chapter_id: c.id,
            topic_id: t.id,
          });
          lectures += counts[t.id] || 1;
        }
      }
      return { out, lectures };
    };

    if (scope === 'course') {
      const items: any[] = [];
      let totalLectures = 0;
      for (const entry of courseChaptersBySubject as any[]) {
        const { out, lectures } = buildFromChapters(entry.chapters || [], entry.subject_id, entry.subject_name);
        items.push(...out);
        totalLectures += lectures;
      }
      return { items, scopeLabel: 'Entire course', totalLectures };
    }

    if (scope === 'subject') {
      const subj = subjects.find((cs: any) => cs.subject?.id === subjectId);
      const subjName = subj?.subject?.name || 'Subject';
      const { out, lectures } = buildFromChapters(chaptersData as any[], subjectId);
      return { items: out, scopeLabel: subjName, totalLectures: lectures };
    }
    if (scope === 'chapter') {
      const chap = (chaptersData as any[]).find((c: any) => c.id === chapterId);
      const { out, lectures } = buildFromChapters(chap ? [chap] : [], subjectId);
      return { items: out, scopeLabel: chap?.title || 'Chapter', totalLectures: lectures };
    }

    // topic scope
    const chapForTopic = (chaptersData as any[]).find((c: any) => c.id === chapterId);
    const topic = (chapForTopic?.subject_topics || []).find((t: any) => t.id === topicId);
    const minutes = topic ? (lookup[topic.id] || 0) : 0;
    const counts2 = lectureStats?.lectureCountByTopic || {};
    const topicItems = topic && minutes > 0
      ? [{
          id: `topic-${topic.id}`,
          title: `${chapForTopic.title} • ${topic.title}`,
          durationMinutes: minutes,
          subject_id: subjectId,
          chapter_id: chapForTopic.id,
          topic_id: topic.id,
        }]
      : [];
    return {
      items: topicItems,
      scopeLabel: topic ? `${chapForTopic.title} • ${topic.title}` : 'Topic',
      totalLectures: topic ? (counts2[topic.id] || 1) : 0,
    };
  }, [scope, subjects, subjectId, chaptersData, chapterId, topicId, courseChaptersBySubject, lectureStats]);



  const totalMinutes = items.reduce((a, i) => a + i.durationMinutes, 0);
  const days = deadline ? Math.max(1, differenceInCalendarDays(deadline, startDate || new Date())) : 0;
  const weeklyMinutes = dayMinutes(weekday) * 5 + dayMinutes(saturday) + dayMinutes(sunday);

  const reset = () => {
    setStep(0);
    setFeasibility(null);
  };

  // Serialize deadline as a *local* YYYY-MM-DD so timezone never shifts it
  // (e.g. selecting Jul 30 in IST must NOT become Jul 29 UTC).
  const formatLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const runFeasibility = async () => {
    if (!deadline) return;
    const res = await evalMut.mutateAsync({
      scopeLabel,
      contentDurationMinutes: totalMinutes,
      deadline: formatLocalYMD(deadline),
      startDate: startDate ? formatLocalYMD(startDate) : undefined,
      dailyHours: Math.round((weeklyMinutes / 7) / 60) || 1,
    });
    setFeasibility(res);
  };

  const generate = async () => {
    if (!deadline) return;
    const deadlineYMD = formatLocalYMD(deadline);
    const startYMD = startDate ? formatLocalYMD(startDate) : undefined;
    console.info('[StudyTimetable][generate]', {
      pickedStart: startDate?.toString(),
      serializedStart: startYMD,
      pickedDeadline: deadline.toString(),
      serializedDeadline: deadlineYMD,
      tzOffsetMinutes: new Date().getTimezoneOffset(),
      itemCount: items.length,
      pattern,
    });
    await genMut.mutateAsync({
      courseId,
      scopeLabel,
      scopeType: scope as any,
      scopeId: scope === 'subject' ? subjectId : scope === 'chapter' ? chapterId : scope === 'topic' ? topicId : undefined,
      deadline: deadlineYMD,
      startDate: startYMD,
      weekday: toDayPlan(weekday),
      saturday: toDayPlan(saturday),
      sunday: toDayPlan(sunday),
      items,
      feedbackMessage: feasibility?.message,
      pattern,
    });
    setOpen(false);
    reset();
  };



  // Step validation
  const stepValid = (() => {
    if (step === 0) return !!items.length && (scope === 'course' || (scope === 'subject' && !!subjectId) || (scope === 'chapter' && !!subjectId && !!chapterId) || (scope === 'topic' && !!subjectId && !!chapterId && !!topicId));
    if (step === 1) return !!deadline && !!startDate && differenceInCalendarDays(deadline, startDate) >= 1;
    if (step === 2) return toDayPlan(weekday).intervals.length > 0;
    if (step === 3) return true;
    if (step === 4) return feasibility?.verdict !== 'too_short';
    return true;
  })();

  const steps = ['Scope', 'Timeline', 'Weekdays', 'Weekend', 'Check', 'Review'];


  return (
    <div className="space-y-4">
      <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-card to-card p-6 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">AI Study Plan Wizard</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Answer a few quick questions and we'll generate a personalized schedule.
        </p>
        <Button size="lg" onClick={() => { reset(); setOpen(true); }}>
          <Sparkles className="h-4 w-4 mr-2" />
          Start AI plan
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{steps[step]}</DialogTitle>
            <div className="flex items-center gap-1 pt-2">
              {steps.map((_, i) => (
                <div key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-primary' : 'bg-muted')} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground pt-1">Step {step + 1} of {steps.length}</p>
          </DialogHeader>

          <div className="py-2 min-h-[280px]">
            {step === 0 && (
              <div className="space-y-4">
                <Label className="text-base font-semibold">What do you want to complete?</Label>
                <RadioGroup value={scope} onValueChange={(v) => setScope(v as Scope)} className="grid grid-cols-2 gap-2">
                  {(['course','subject'] as Scope[]).map(s => (
                    <Label key={s} className={cn('border rounded-xl p-3 cursor-pointer flex items-center gap-2 transition-colors', scope === s && 'border-primary bg-primary/5')}>
                      <RadioGroupItem value={s} /><span className="capitalize">{s}</span>
                    </Label>
                  ))}
                </RadioGroup>
                {scope !== 'course' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setChapterId(''); setTopicId(''); }}>
                      <SelectTrigger><SelectValue placeholder="Choose subject" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map((cs: any) => (
                          <SelectItem key={cs.subject?.id} value={cs.subject?.id}>{cs.subject?.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(scope === 'chapter' || scope === 'topic') && (
                      <Select value={chapterId} onValueChange={(v) => { setChapterId(v); setTopicId(''); }} disabled={!subjectId}>
                        <SelectTrigger><SelectValue placeholder="Choose chapter" /></SelectTrigger>
                        <SelectContent>
                          {chaptersData.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {scope === 'topic' && (
                      <Select value={topicId} onValueChange={setTopicId} disabled={!chapterId}>
                        <SelectTrigger><SelectValue placeholder="Choose topic" /></SelectTrigger>
                        <SelectContent>
                          {((chaptersData as any[]).find((c: any) => c.id === chapterId)?.subject_topics || []).map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {loadingDurations ? (
                    <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" /> Calculating real content from published lectures…</span>
                  ) : items.length === 0 ? (
                    <span className="text-destructive">No published lectures found in this scope yet. Nothing to schedule.</span>
                  ) : (
                    <>Real content: <strong>{Math.round(totalMinutes / 60)} h {totalMinutes % 60}m</strong> across {totalLectures} published lecture(s).</>
                  )}
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-base font-semibold">When do you want to start?</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, 'PPP') : 'Pick a start date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(d) => {
                          setStartDate(d);
                          if (d && deadline && differenceInCalendarDays(deadline, d) < 1) {
                            setDeadline(addDays(d, 1));
                          }
                        }}
                        disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-muted-foreground">Plan begins on this day — leave as today to start right away.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">When do you want to finish?</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {deadline ? format(deadline, 'PPP') : 'Pick a deadline'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deadline}
                        onSelect={setDeadline}
                        disabled={(d) => d < addDays(startDate || new Date(), 1)}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-sm text-muted-foreground">{days} day(s) of study window</p>
                </div>
              </div>
            )}


            {step === 2 && (
              <IntervalEditor label="Weekday study windows (Mon–Fri)" value={weekday} onChange={setWeekday} />
            )}

            {step === 3 && (
              <div className="space-y-5">
                <IntervalEditor label="Saturday" value={saturday} onChange={setSaturday} />
                <IntervalEditor label="Sunday" value={sunday} onChange={setSunday} />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <div className="rounded-xl bg-muted/40 p-4 text-sm space-y-1">
                  <p><strong>Total content:</strong> {Math.round(totalMinutes / 60)} h {totalMinutes % 60}m <span className="text-xs text-muted-foreground">({totalLectures} published lectures)</span></p>
                  <p><strong>Weekly study time:</strong> {Math.round(weeklyMinutes / 60)} h</p>
                  <p><strong>Window:</strong> {startDate ? format(startDate, 'd MMM') : '—'} → {deadline ? format(deadline, 'd MMM yyyy') : '—'} ({days} days)</p>
                </div>
                <Button variant="secondary" onClick={runFeasibility} disabled={evalMut.isPending} className="w-full">
                  {evalMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
                  Ask AI if this is realistic
                </Button>
                {feasibility && (
                  <div className={cn(
                    'rounded-lg p-3 text-sm border',
                    feasibility.verdict === 'too_short' && 'bg-destructive/10 border-destructive/30 text-destructive',
                    feasibility.verdict === 'ok' && 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:text-green-200 dark:border-green-800',
                    feasibility.verdict === 'generous' && 'bg-primary/10 border-primary/30 text-primary',
                  )}>
                    {feasibility.message}
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3 text-sm">
                <div className="rounded-xl border p-4 space-y-2">
                  <p><span className="text-muted-foreground">Scope:</span> <strong>{scopeLabel}</strong> ({items.length} items)</p>
                  <p><span className="text-muted-foreground">Start:</span> <strong>{startDate ? format(startDate, 'PPP') : '—'}</strong></p>
                  <p><span className="text-muted-foreground">Deadline:</span> <strong>{deadline ? format(deadline, 'PPP') : '—'}</strong></p>
                  <Separator />
                  {(['Weekday', 'Saturday', 'Sunday'] as const).map((name, i) => {
                    const d = i === 0 ? weekday : i === 1 ? saturday : sunday;
                    const plan = toDayPlan(d);
                    return (
                      <div key={name}>
                        <p className="font-medium">{name}</p>
                        {plan.intervals.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No study planned</p>
                        ) : (
                          <ul className="text-xs text-muted-foreground space-y-0.5">
                            {plan.intervals.map(iv => (
                              <li key={iv.label} className="capitalize">• {iv.label}: {iv.start} – {iv.end}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-xl border p-4 space-y-2">
                  <p className="font-medium text-sm">How should subjects be arranged?</p>
                  <div className="grid grid-cols-3 gap-2">
                    {PATTERN_OPTIONS.map(opt => {
                      const active = pattern === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPattern(opt.value)}
                          className={cn(
                            'rounded-lg border p-2 text-left transition-colors',
                            active ? 'border-primary bg-primary/5' : 'hover:border-primary/40',
                          )}
                        >
                          <p className="text-xs font-semibold">{opt.label}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{opt.hint}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
              )}
              {step < steps.length - 1 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!stepValid}>
                  Next <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={generate} disabled={genMut.isPending || !items.length || !deadline}>
                  {genMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Generate
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};


const StudyTimetable = () => {
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
        <SEOHead title="My Time Table | SimpleLecture" description="Plan your study schedule" />
        <MobileLayout title="Time Table">
          <PageInner />
        </MobileLayout>
      </>
    );
  }

  return (
    <>
      <SEOHead title="My Time Table | SimpleLecture" description="Plan your study schedule with manual or AI-powered scheduling and email reminders." />
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-7 w-7 text-primary" />
              My Time Table
            </h1>
            <div className="flex items-center gap-2">
              <TimetableHowToDialog />
              <ScheduleTestHowToDialog />
            </div>
          </div>
          <PageInner />
        </div>
        <Footer />
      </div>
    </>
  );
};

export default StudyTimetable;
