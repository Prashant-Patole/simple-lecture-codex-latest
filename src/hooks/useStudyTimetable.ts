import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StudySession {
  id: string;
  timetable_id: string;
  student_id: string;
  course_id: string;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  reminder_sent_at: string | null;
  reminder_24h_sent_at?: string | null;
  reminder_1h_sent_at?: string | null;
  session_type?: 'study' | 'test';
  status: 'pending' | 'done' | 'skipped';
}

export const useCreateTestSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      courseId: string;
      subjectId: string;
      chapterId: string;
      title: string;
      scheduled_at: string;
      duration_minutes: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: existing } = await supabase
        .from('study_timetables')
        .select('id')
        .eq('student_id', user.id)
        .eq('course_id', params.courseId)
        .eq('mode', 'manual')
        .maybeSingle();

      let timetableId = existing?.id;
      if (!timetableId) {
        const { data: newTt, error: ttErr } = await supabase
          .from('study_timetables')
          .insert({ student_id: user.id, course_id: params.courseId, mode: 'manual' })
          .select('id')
          .single();
        if (ttErr) throw ttErr;
        timetableId = newTt.id;
      }

      const { error } = await supabase.from('study_timetable_sessions').insert({
        timetable_id: timetableId,
        student_id: user.id,
        course_id: params.courseId,
        subject_id: params.subjectId,
        chapter_id: params.chapterId,
        title: params.title,
        scheduled_at: params.scheduled_at,
        duration_minutes: params.duration_minutes,
        session_type: 'test',
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['study-sessions', vars.courseId] });
      qc.invalidateQueries({ queryKey: ['study-plans', vars.courseId] });
      toast.success('Test scheduled — we\'ll email you 24h and 1h before');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to schedule test'),
  });
};

export const useStudyTimetableSessions = (courseId?: string) => {
  return useQuery({
    queryKey: ['study-sessions', courseId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !courseId) return [];
      const { data, error } = await supabase
        .from('study_timetable_sessions')
        .select('*')
        .eq('student_id', user.id)
        .eq('course_id', courseId)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return (data || []) as StudySession[];
    },
    enabled: !!courseId,
  });
};

export const useCreateManualSessions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      courseId: string;
      subjectId?: string | null;
      title: string;
      sessions: Array<{ scheduled_at: string; duration_minutes: number }>;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Find or create a manual timetable for this course
      const { data: existing } = await supabase
        .from('study_timetables')
        .select('id')
        .eq('student_id', user.id)
        .eq('course_id', params.courseId)
        .eq('mode', 'manual')
        .maybeSingle();

      let timetableId = existing?.id;
      if (!timetableId) {
        const { data: newTt, error: ttErr } = await supabase
          .from('study_timetables')
          .insert({ student_id: user.id, course_id: params.courseId, mode: 'manual' })
          .select('id')
          .single();
        if (ttErr) throw ttErr;
        timetableId = newTt.id;
      }

      const rows = params.sessions.map(s => ({
        timetable_id: timetableId,
        student_id: user.id,
        course_id: params.courseId,
        subject_id: params.subjectId || null,
        title: params.title,
        scheduled_at: s.scheduled_at,
        duration_minutes: s.duration_minutes,
      }));
      const { error } = await supabase.from('study_timetable_sessions').insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['study-sessions', vars.courseId] });
      qc.invalidateQueries({ queryKey: ['study-plans', vars.courseId] });
      toast.success('Sessions added to your timetable');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to add sessions'),
  });
};

export const useUpdateSessionStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StudySession['status'] }) => {
      const { error } = await supabase
        .from('study_timetable_sessions')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['study-sessions'] }),
  });
};

export const useUpdateSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      subject_id?: string | null;
      chapter_id?: string | null;
      topic_id?: string | null;
      title?: string;
      scheduled_at?: string;
      duration_minutes?: number;
    }) => {
      const { id, ...patch } = params;
      const { error } = await supabase
        .from('study_timetable_sessions')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-sessions'] });
      qc.invalidateQueries({ queryKey: ['session-entity-titles'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to update session'),
  });
};

export const useDeleteSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('study_timetable_sessions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-sessions'] });
      toast.success('Session removed');
    },
  });
};

export interface StudyPlanSummary {
  id: string;
  mode: 'auto' | 'manual' | string;
  scopeType: 'course' | 'subject' | 'chapter' | 'topic' | 'manual';
  scopeLabel: string;
  deadline: string | null;
  startDate: string | null;
  createdAt: string;
}


export const useStudyTimetablePlans = (courseId?: string) => {
  return useQuery({
    queryKey: ['study-plans', courseId],
    queryFn: async (): Promise<StudyPlanSummary[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !courseId) return [];
      const { data, error } = await supabase
        .from('study_timetables')
        .select('id, mode, plan_metadata, created_at')
        .eq('student_id', user.id)
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => {
        const meta = (row.plan_metadata || {}) as any;
        const scopeType = (meta.scopeType as StudyPlanSummary['scopeType']) || (row.mode === 'manual' ? 'manual' : 'course');
        return {
          id: row.id,
          mode: row.mode,
          scopeType,
          scopeLabel: meta.scopeLabel || (row.mode === 'manual' ? 'Manual plan' : 'Entire course'),
          deadline: meta.deadline || null,
          startDate: meta.startDate || null,
          createdAt: row.created_at,
        };
      });
    },
    enabled: !!courseId,
  });
};

export const useDeleteSinglePlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ timetableId }: { timetableId: string; courseId: string }) => {
      const { error: sErr } = await supabase
        .from('study_timetable_sessions')
        .delete()
        .eq('timetable_id', timetableId);
      if (sErr) throw sErr;
      const { error: tErr } = await supabase
        .from('study_timetables')
        .delete()
        .eq('id', timetableId);
      if (tErr) throw tErr;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['study-sessions', vars.courseId] });
      qc.invalidateQueries({ queryKey: ['study-plans', vars.courseId] });
      qc.invalidateQueries({ queryKey: ['study-timetable-meta', vars.courseId] });
      toast.success('Plan deleted');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete plan'),
  });
};





export const useDeleteAllSessions = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('study_timetable_sessions')
        .delete()
        .eq('student_id', user.id)
        .eq('course_id', courseId);
      if (error) throw error;
    },
    onSuccess: (_, courseId) => {
      qc.invalidateQueries({ queryKey: ['study-sessions', courseId] });
      qc.invalidateQueries({ queryKey: ['study-plans', courseId] });
      toast.success('All sessions cleared');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to clear sessions'),
  });
};

export const useDeleteStudyPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      // Delete sessions first (in case FK doesn't cascade)
      const { error: sErr } = await supabase
        .from('study_timetable_sessions')
        .delete()
        .eq('student_id', user.id)
        .eq('course_id', courseId);
      if (sErr) throw sErr;
      const { error: tErr } = await supabase
        .from('study_timetables')
        .delete()
        .eq('student_id', user.id)
        .eq('course_id', courseId);
      if (tErr) throw tErr;
    },
    onSuccess: (_, courseId) => {
      qc.invalidateQueries({ queryKey: ['study-sessions', courseId] });
      qc.invalidateQueries({ queryKey: ['study-plans', courseId] });
      toast.success('Study plan deleted');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete plan'),
  });
};



export const useEvaluateFeasibility = () => {
  return useMutation({
    mutationFn: async (params: {
      scopeLabel: string;
      contentDurationMinutes: number;
      deadline: string;
      startDate?: string;
      dailyHours: number;
    }) => {
      const { data, error } = await supabase.functions.invoke('study-timetable-ai', {
        body: { action: 'evaluate_feasibility', ...params },
      });
      if (error) throw error;
      return data as { verdict: 'too_short' | 'ok' | 'generous'; message: string };
    },
  });
};

export type StudyInterval = { label: 'morning' | 'afternoon' | 'night'; start: string; end: string };
export type DayPlan = { intervals: StudyInterval[] };

export type StudyPattern = 'sequential' | 'pair' | 'mixed';

const canonicalizeItemsBySubject = <T extends { subject_id?: string | null }>(items: T[]): T[] => {
  const queues = new Map<string, T[]>();
  const order: string[] = [];
  for (const item of items || []) {
    const key = item.subject_id || '__none__';
    if (!queues.has(key)) {
      queues.set(key, []);
      order.push(key);
    }
    queues.get(key)!.push(item);
  }
  return order.flatMap(key => queues.get(key) || []);
};

const subjectOrderPreview = (items: Array<{ subject_id?: string | null; title?: string }>, limit = 18) =>
  items.slice(0, limit).map(item => item.title?.split(' • ')[0] || item.subject_id || '__none__').join(' | ');

export const orderItemsByPattern = <T extends { subject_id?: string | null }>(
  items: T[],
  pattern: StudyPattern,
): T[] => {
  if (pattern === 'sequential' || items.length === 0) return items;

  // Build per-subject queues preserving original order
  const queues = new Map<string, T[]>();
  const order: string[] = [];
  for (const it of items) {
    const k = (it.subject_id || '__none__') as string;
    if (!queues.has(k)) {
      queues.set(k, []);
      order.push(k);
    }
    queues.get(k)!.push(it);
  }
  if (order.length <= 1) return items;

  const out: T[] = [];
  if (pattern === 'mixed') {
    // Round-robin across every subject
    while (out.length < items.length) {
      for (const k of order) {
        const q = queues.get(k)!;
        if (q.length) out.push(q.shift()!);
      }
    }
    return out;
  }
  // pattern === 'pair' → process subjects two at a time, alternating until both drain
  for (let i = 0; i < order.length; i += 2) {
    const a = queues.get(order[i])!;
    const b = i + 1 < order.length ? queues.get(order[i + 1])! : [];
    while (a.length || b.length) {
      if (a.length) out.push(a.shift()!);
      if (b.length) out.push(b.shift()!);
    }
  }
  return out;
};

export const useGenerateAutoPlan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      courseId: string;
      scopeLabel: string;
      scopeType: 'course' | 'subject' | 'chapter';
      scopeId?: string;
      deadline: string;
      startDate?: string;
      weekday: DayPlan;
      saturday: DayPlan;
      sunday: DayPlan;
      items: Array<{ id: string; title: string; durationMinutes: number; subject_id?: string; chapter_id?: string; topic_id?: string }>;
      feedbackMessage?: string;
      pattern?: StudyPattern;
    }) => {
      const tzOffsetMinutes = new Date().getTimezoneOffset();
      const orderedItems = orderItemsByPattern(params.items, params.pattern || 'sequential');
      const { data, error } = await supabase.functions.invoke('study-timetable-ai', {
        body: { action: 'generate_plan', tzOffsetMinutes, ...params, items: orderedItems, itemsOriginal: params.items },
      });

      if (error) throw error;
      return data as { timetable_id: string; sessions_created: number };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['study-sessions', vars.courseId] });
      qc.invalidateQueries({ queryKey: ['study-plans', vars.courseId] });
      qc.invalidateQueries({ queryKey: ['study-timetable-meta', vars.courseId] });
      toast.success('AI study plan created');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to generate plan'),
  });
};

/** Latest auto-generated timetable row for this course (incl. plan_metadata). */
export const useStudyTimetableMeta = (courseId?: string) => {
  return useQuery({
    queryKey: ['study-timetable-meta', courseId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !courseId) return null;
      const { data, error } = await supabase
        .from('study_timetables')
        .select('id, mode, plan_metadata, created_at')
        .eq('student_id', user.id)
        .eq('course_id', courseId)
        .eq('mode', 'auto')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });
};

/**
 * Re-shuffle an existing auto timetable to a different pattern.
 * Reads items + day plans from the saved plan_metadata, reorders, deletes
 * the old timetable + its sessions, then calls the edge function to
 * regenerate with the new ordering.
 */
export const useReshuffleTimetable = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ courseId, pattern }: { courseId: string; pattern: StudyPattern }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: tt, error: ttErr } = await supabase
        .from('study_timetables')
        .select('id, plan_metadata')
        .eq('student_id', user.id)
        .eq('course_id', courseId)
        .eq('mode', 'auto')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ttErr) throw ttErr;
      if (!tt) throw new Error('No AI study plan found to reshuffle. Generate one first.');

      const meta = (tt.plan_metadata || {}) as any;
      // Always reorder from the canonical baseline so each pattern produces a fresh,
      // visibly different schedule (otherwise reshuffling back to "sequential" after
      // "mixed" would silently keep the mixed order).
      const itemsOriginal = meta.items_original as Array<any> | undefined;
      const metaItems = meta.items as Array<any> | undefined;
      let baseline = itemsOriginal?.length
        ? itemsOriginal
        : canonicalizeItemsBySubject(metaItems || []);

      console.info('[StudyTimetable][reshuffle:start]', {
        courseId,
        targetPattern: pattern,
        timetableId: tt.id,
        metadataPattern: meta.pattern,
        hasItemsOriginal: !!itemsOriginal?.length,
        metaItemsCount: metaItems?.length || 0,
        baselineCount: baseline.length,
        baselinePreview: subjectOrderPreview(baseline),
      });

      // Fallback: reconstruct items from existing sessions for plans
      // generated before items were persisted in plan_metadata.
      if (!baseline || !baseline.length) {
        const { data: rows, error: sErr } = await supabase
          .from('study_timetable_sessions')
          .select('id, title, duration_minutes, subject_id, chapter_id, topic_id')
          .eq('timetable_id', tt.id)
          .order('scheduled_at', { ascending: true });
        if (sErr) throw sErr;
        if (!rows || !rows.length) {
          throw new Error('No sessions found for this plan. Generate a new one first.');
        }
        const groups = new Map<string, any>();
        const order: string[] = [];
        for (const r of rows) {
          const key = r.topic_id || r.chapter_id || `s-${r.id}`;
          if (!groups.has(key)) {
            const cleanTitle = (r.title || 'Study session').replace(/\s*\(part\s+\d+\)\s*$/i, '').trim();
            groups.set(key, {
              id: `item-${key}`,
              title: cleanTitle,
              durationMinutes: 0,
              subject_id: r.subject_id || undefined,
              chapter_id: r.chapter_id || undefined,
              topic_id: r.topic_id || undefined,
            });
            order.push(key);
          }
          groups.get(key)!.durationMinutes += r.duration_minutes || 0;
        }
        baseline = order.map(k => groups.get(k)!);
      }

      if (!meta.deadline || !meta.weekday || !meta.saturday || !meta.sunday) {
        throw new Error('This plan is missing schedule details. Please regenerate it.');
      }

      baseline = canonicalizeItemsBySubject(baseline);
      const ordered = orderItemsByPattern(baseline, pattern);

      console.info('[StudyTimetable][reshuffle:order]', {
        targetPattern: pattern,
        canonicalPreview: subjectOrderPreview(baseline),
        orderedPreview: subjectOrderPreview(ordered),
        itemCount: ordered.length,
      });

      // Delete the old timetable's sessions and the timetable itself, then regenerate.
      const { error: deleteSessionsError } = await supabase.from('study_timetable_sessions').delete().eq('timetable_id', tt.id);
      if (deleteSessionsError) {
        console.error('[StudyTimetable][reshuffle:delete-sessions-error]', deleteSessionsError);
        throw deleteSessionsError;
      }
      const { error: deleteTimetableError } = await supabase.from('study_timetables').delete().eq('id', tt.id);
      if (deleteTimetableError) {
        console.error('[StudyTimetable][reshuffle:delete-timetable-error]', deleteTimetableError);
        throw deleteTimetableError;
      }

      const tzOffsetMinutes = new Date().getTimezoneOffset();
      const { data, error } = await supabase.functions.invoke('study-timetable-ai', {
        body: {
          action: 'generate_plan',
          tzOffsetMinutes,
          courseId,
          scopeLabel: meta.scopeLabel,
          scopeType: meta.scopeType,
          scopeId: meta.scopeId,
          deadline: meta.deadline,
          startDate: meta.startDate || undefined,
          weekday: meta.weekday,
          saturday: meta.saturday,
          sunday: meta.sunday,
          items: ordered,
          itemsOriginal: baseline,
          pattern,
        },
      });

      if (error) {
        console.error('[StudyTimetable][reshuffle:function-error]', error);
        throw error;
      }
      console.info('[StudyTimetable][reshuffle:success]', data);
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['study-sessions', vars.courseId] });
      qc.invalidateQueries({ queryKey: ['study-plans', vars.courseId] });
      qc.invalidateQueries({ queryKey: ['study-timetable-meta', vars.courseId] });
      toast.success('Schedule reshuffled');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to reshuffle schedule'),
  });
};
