import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { useDashboardStudyPlanStrip, DaySessionsRow, SessionTitles } from '@/hooks/useDashboardStudyPlanStrip';
import type { StudySession } from '@/hooks/useStudyTimetable';
import { colorForSubject, bucketOf, BUCKET_LABEL, type DayBucket } from '@/components/timetable/dayStyling';
import { SessionTopicPickerDialog } from '@/components/timetable/SessionTopicPickerDialog';

const CHIPS_VISIBLE = 3;

const buildLearnUrl = (s: StudySession) => {
  const params = new URLSearchParams();
  if (s.subject_id) params.set('subject', s.subject_id);
  if (s.chapter_id) params.set('chapter', s.chapter_id);
  if (s.topic_id) params.set('topic', s.topic_id);
  params.set('autoplay', '1');
  return `/learning/${s.course_id}?${params.toString()}`;
};

interface DayColumnProps {
  label: string;
  date: Date;
  data: DaySessionsRow;
  highlight?: boolean;
  titles: SessionTitles;
  onOpen: (sessions: StudySession[]) => void;
  onPlay: (s: StudySession) => void;
}

const DayPopoverBody = ({
  date,
  label,
  sessions,
  titles,
  courseNameById,
  onPlay,
}: {
  date: Date;
  label: string;
  sessions: StudySession[];
  titles: SessionTitles;
  courseNameById: Map<string, string>;
  onPlay: (s: StudySession) => void;
}) => {
  const grouped = useMemo(() => {
    const g: Record<DayBucket, StudySession[]> = { morning: [], afternoon: [], night: [] };
    for (const s of sessions) g[bucketOf(new Date(s.scheduled_at))].push(s);
    return g;
  }, [sessions]);

  return (
    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
      <div>
        <p className="text-sm font-bold">{label} · {format(date, 'EEEE')}</p>
        <p className="text-xs text-muted-foreground">{format(date, 'MMM d, yyyy')} · {sessions.length} session{sessions.length === 1 ? '' : 's'}</p>
      </div>

      {sessions.length === 0 && (
        <p className="text-sm text-muted-foreground">No sessions planned.</p>
      )}

      {(['morning', 'afternoon', 'night'] as DayBucket[]).map(b => grouped[b].length > 0 && (
        <div key={b} className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{BUCKET_LABEL[b]}</p>
          {grouped[b].map(s => {
            const start = new Date(s.scheduled_at);
            const end = new Date(start.getTime() + (s.duration_minutes || 0) * 60000);
            const subj = s.subject_id ? titles.subject.get(s.subject_id) : undefined;
            const chap = s.chapter_id ? titles.chapter.get(s.chapter_id) : undefined;
            const top = s.topic_id ? titles.topic.get(s.topic_id) : undefined;
            const courseName = courseNameById.get(s.course_id);
            const canPlay = !!s.course_id && (!!s.topic_id || !!s.chapter_id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => canPlay && onPlay(s)}
                disabled={!canPlay}
                className={cn(
                  'w-full text-left rounded-lg border p-2.5 text-xs transition-all',
                  colorForSubject(s.subject_id),
                  canPlay && 'hover:shadow-md hover:ring-1 hover:ring-primary/40 cursor-pointer',
                  !canPlay && 'cursor-default opacity-90',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{format(start, 'p')} – {format(end, 'p')}</p>
                    {subj && <p className="font-medium mt-0.5">{subj}</p>}
                    {chap && <p className="opacity-80">{chap}</p>}
                    {top && <p className="opacity-70 italic">{top}</p>}
                    {s.title && <p className="mt-1 opacity-90 truncate">{s.title}</p>}
                    {courseName && <p className="mt-1 text-[10px] opacity-60 truncate">{courseName}</p>}
                  </div>
                  <Badge variant={s.status === 'done' ? 'default' : 'outline'} className="shrink-0 text-[10px] capitalize">
                    {s.status}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const DayColumn = ({ label, date, data, highlight, titles, onOpen, onPlay }: DayColumnProps) => {
  const sessions = data.sessions;
  const visible = sessions.slice(0, CHIPS_VISIBLE);
  const extra = sessions.length - visible.length;

  const inner = (
    <button
      type="button"
      onClick={() => sessions.length > 0 && onOpen(sessions)}
      className={cn(
        'w-full text-left rounded-xl border p-3 flex flex-col gap-2 min-h-[140px] transition-colors',
        highlight
          ? 'border-primary bg-primary/5 dark:bg-primary/10 hover:bg-primary/10'
          : 'border-border bg-card hover:bg-accent/40',
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className={cn('text-sm font-semibold', highlight && 'text-primary')}>{label}</p>
          <p className="text-xs text-muted-foreground">{format(date, 'EEE d MMM')}</p>
        </div>
        {sessions.length > 0 && (
          <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-primary/15 text-primary">
            {sessions.length}
          </span>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="text-xs text-muted-foreground italic mt-1">No plan scheduled</p>
      ) : (
        <div className="flex flex-col gap-1">
          {visible.map(s => {
            const subj = s.subject_id ? titles.subject.get(s.subject_id) : undefined;
            return (
              <div
                key={s.id}
                className={cn(
                  'text-[11px] leading-tight rounded-md px-1.5 py-1 truncate border',
                  colorForSubject(s.subject_id),
                  s.status === 'done' && 'opacity-60 line-through',
                )}
              >
                <span className="font-semibold">{format(new Date(s.scheduled_at), 'HH:mm')} </span>
                {subj || s.title || 'Study'}
              </div>
            );
          })}
          {extra > 0 && (
            <p className="text-[10px] text-muted-foreground font-medium px-1">+{extra} more</p>
          )}
        </div>
      )}
    </button>
  );

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>{inner}</HoverCardTrigger>
      <HoverCardContent side="top" align="center" className="w-80 p-3">
        <DayPopoverBody
          date={date}
          label={label}
          sessions={sessions}
          titles={titles}
          courseNameById={data.courseNameById}
          onPlay={onPlay}
        />
      </HoverCardContent>
    </HoverCard>
  );
};

export const StudyPlanThreeDayStrip = () => {
  const navigate = useNavigate();
  const { isLoading, yesterday, today, tomorrow, titles } = useDashboardStudyPlanStrip();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSessions, setPickerSessions] = useState<StudySession[]>([]);

  const totalCount = yesterday.sessions.length + today.sessions.length + tomorrow.sessions.length;
  const allEmpty = !isLoading && totalCount === 0;

  const now = new Date();
  const dYesterday = new Date(now); dYesterday.setDate(now.getDate() - 1);
  const dTomorrow = new Date(now); dTomorrow.setDate(now.getDate() + 1);

  const playSession = (s: StudySession) => {
    if (!s.course_id) return;
    navigate(buildLearnUrl(s));
  };

  const openDay = (sessions: StudySession[]) => {
    const playable = sessions.filter(s => s.course_id && (s.topic_id || s.chapter_id));
    if (playable.length === 0) {
      // nothing playable — fall back to timetable page
      navigate('/timetable');
      return;
    }
    const uniqueTopics = new Set(playable.map(s => s.topic_id || `chapter:${s.chapter_id}`));
    if (uniqueTopics.size === 1) {
      playSession(playable[0]);
      return;
    }
    setPickerSessions(playable);
    setPickerOpen(true);
  };

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarDays className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold leading-tight">Study Plan</h3>
            <p className="text-xs text-muted-foreground">Tap a day or session to jump straight into the lecture</p>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to="/timetable">
            View full timetable <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-xl border p-3 min-h-[140px] animate-pulse">
              <div className="h-4 w-20 bg-muted rounded mb-2" />
              <div className="h-3 w-16 bg-muted rounded mb-4" />
              <div className="h-12 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DayColumn label="Yesterday" date={dYesterday} data={yesterday} titles={titles} onOpen={openDay} onPlay={playSession} />
            <DayColumn label="Today" date={now} data={today} highlight titles={titles} onOpen={openDay} onPlay={playSession} />
            <DayColumn label="Tomorrow" date={dTomorrow} data={tomorrow} titles={titles} onOpen={openDay} onPlay={playSession} />
          </div>
          {allEmpty && (
            <div className="mt-3 flex flex-col sm:flex-row items-center justify-between gap-2 rounded-lg border border-dashed p-3 bg-muted/30">
              <p className="text-sm text-muted-foreground">
                You don't have any study plans for these days yet.
              </p>
              <Button asChild size="sm">
                <Link to="/timetable">
                  Create study plan <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          )}
        </>
      )}

      <SessionTopicPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        sessions={pickerSessions}
        titles={titles}
        onSelect={playSession}
      />
    </Card>
  );
};

export default StudyPlanThreeDayStrip;
