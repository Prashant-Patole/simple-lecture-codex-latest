import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { addDays, startOfDay, isSameDay } from 'date-fns';
import type { StudySession } from './useStudyTimetable';

export interface DaySessionsRow {
  sessions: StudySession[];
  courseNameById: Map<string, string>;
}


export interface SessionTitles {
  subject: Map<string, string>;
  chapter: Map<string, string>;
  topic: Map<string, string>;
}

const fetchSessions = async (courseId: string): Promise<StudySession[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const today = startOfDay(new Date());
  const start = addDays(today, -1).toISOString();
  const end = addDays(today, 2).toISOString();
  const { data, error } = await supabase
    .from('study_timetable_sessions')
    .select('*')
    .eq('student_id', user.id)
    .eq('course_id', courseId)
    .gte('scheduled_at', start)
    .lt('scheduled_at', end);
  if (error) throw error;
  return (data || []) as StudySession[];
};

const fetchEnrollments = async (): Promise<Array<{ id: string; name: string }>> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('enrollments')
    .select('course_id, courses(id, name)')
    .eq('student_id', user.id)
    .eq('is_active', true);
  if (error) throw error;
  const map = new Map<string, { id: string; name: string }>();
  (data || []).forEach((e: any) => {
    const id = e?.course_id || e?.courses?.id;
    if (!id) return;
    const name = e?.courses?.name || 'Course';
    if (!map.has(id)) map.set(id, { id, name });
  });
  return Array.from(map.values());
};

export const useDashboardStudyPlanStrip = () => {
  const { data: courses = [], isLoading: enrLoading } = useQuery({
    queryKey: ['dashboard-study-strip-enrollments'],
    queryFn: fetchEnrollments,
    staleTime: 2 * 60_000,
  });

  const sessionQueries = useQueries({
    queries: courses.map(c => ({
      queryKey: ['dashboard-study-strip-sessions', c.id],
      queryFn: () => fetchSessions(c.id),
      staleTime: 60_000,
    })),
  });

  const isLoading = enrLoading || sessionQueries.some(q => q.isLoading);


  const today = startOfDay(new Date());
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);

  // Collect entity ids across all sessions for title lookups
  const { subjectIds, chapterIds, topicIds } = useMemo(() => {
    const subj = new Set<string>();
    const chap = new Set<string>();
    const top = new Set<string>();
    sessionQueries.forEach(q => {
      (q.data || []).forEach(s => {
        if (s.subject_id) subj.add(s.subject_id);
        if (s.chapter_id) chap.add(s.chapter_id);
        if (s.topic_id) top.add(s.topic_id);
      });
    });
    return {
      subjectIds: Array.from(subj),
      chapterIds: Array.from(chap),
      topicIds: Array.from(top),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionQueries.map(q => q.dataUpdatedAt).join('|')]);

  const titlesKey = `${subjectIds.length}-${chapterIds.length}-${topicIds.length}`;

  const { data: titles } = useQuery<SessionTitles>({
    queryKey: ['dashboard-study-strip-titles', titlesKey, subjectIds, chapterIds, topicIds],
    enabled: subjectIds.length + chapterIds.length + topicIds.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const [subs, chaps, tops] = await Promise.all([
        subjectIds.length
          ? supabase.from('course_subjects').select('subject_id, subjects:subjects(id, name)').in('subject_id', subjectIds)
          : Promise.resolve({ data: [] as any[] }),
        chapterIds.length
          ? supabase.from('subject_chapters').select('id, title').in('id', chapterIds)
          : Promise.resolve({ data: [] as any[] }),
        topicIds.length
          ? supabase.from('subject_topics').select('id, title').in('id', topicIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const subject = new Map<string, string>();
      (subs.data || []).forEach((r: any) => {
        const name = r?.subjects?.name || r?.name;
        const id = r?.subject_id || r?.id;
        if (id && name) subject.set(id, name);
      });
      const chapter = new Map<string, string>((chaps.data || []).map((r: any) => [r.id, r.title]));
      const topic = new Map<string, string>((tops.data || []).map((r: any) => [r.id, r.title]));
      return { subject, chapter, topic };
    },
  });

  const courseNameById = useMemo(() => {
    const m = new Map<string, string>();
    courses.forEach(c => m.set(c.id, c.name));
    return m;
  }, [courses]);

  const buildDay = (day: Date): DaySessionsRow => {
    const out: StudySession[] = [];
    courses.forEach((_c, idx) => {
      const sessions = sessionQueries[idx]?.data || [];
      sessions.forEach(s => {
        if (isSameDay(new Date(s.scheduled_at), day)) out.push(s);
      });
    });
    out.sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
    return { sessions: out, courseNameById };
  };

  const emptyTitles: SessionTitles = { subject: new Map(), chapter: new Map(), topic: new Map() };

  return {
    isLoading,
    yesterday: buildDay(yesterday),
    today: buildDay(today),
    tomorrow: buildDay(tomorrow),
    titles: titles || emptyTitles,
    hasAnyEnrollment: courses.length > 0,
  };
};
