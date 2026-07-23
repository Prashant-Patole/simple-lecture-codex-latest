import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface AIConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
}

async function loadAIConfig(adminClient: any): Promise<AIConfig> {
  const { data, error } = await adminClient
    .from('ai_settings')
    .select('setting_value')
    .eq('setting_key', 'ai_api_config')
    .maybeSingle();
  if (error) throw new Error(`Failed to load AI config: ${error.message}`);
  const cfg = (data?.setting_value || {}) as any;
  if (!cfg || cfg.enabled === false) {
    throw new Error('AI is disabled in Admin Settings. Enable it and add an API key.');
  }
  const provider = cfg.provider || 'openrouter';
  if (provider === 'openrouter') {
    if (!cfg.openrouter_api_key) throw new Error('OpenRouter API key missing in Admin Settings.');
    return {
      apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: cfg.openrouter_api_key,
      model: cfg.default_model || 'google/gemini-2.5-flash',
    };
  }
  if (provider === 'openai') {
    if (!cfg.openai_api_key) throw new Error('OpenAI API key missing in Admin Settings.');
    return {
      apiUrl: 'https://api.openai.com/v1/chat/completions',
      apiKey: cfg.openai_api_key,
      model: cfg.default_model || 'gpt-4o-mini',
    };
  }
  // default: google (Gemini OpenAI-compatible)
  if (!cfg.google_api_key) throw new Error('Google Gemini API key missing in Admin Settings.');
  return {
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    apiKey: cfg.google_api_key,
    model: cfg.default_model || 'gemini-2.5-flash',
  };
}

interface FeasibilityBody {
  action: 'evaluate_feasibility';
  scopeLabel: string;
  contentDurationMinutes: number;
  deadline: string; // ISO date
  startDate?: string; // ISO date (YYYY-MM-DD); defaults to today
  dailyHours: number;
}

type StudyInterval = { label: 'morning' | 'afternoon' | 'night'; start: string; end: string };
type DayPlan = { intervals: StudyInterval[] };

interface GeneratePlanBody {
  action: 'generate_plan';
  courseId: string;
  scopeLabel: string;
  scopeType: 'course' | 'subject' | 'chapter' | 'topic';
  scopeId?: string;
  deadline: string;
  startDate?: string; // ISO date (YYYY-MM-DD); defaults to today
  weekday: DayPlan;
  saturday: DayPlan;
  sunday: DayPlan;
  items: Array<{ id: string; title: string; durationMinutes: number; subject_id?: string; chapter_id?: string; topic_id?: string }>;
  /** Canonical (original course-order) item list. Used to re-seed reshuffles so each pattern starts from the same baseline. */
  itemsOriginal?: Array<{ id: string; title: string; durationMinutes: number; subject_id?: string; chapter_id?: string; topic_id?: string }>;
  feedbackMessage?: string;
  /** Scheduling pattern: 'sequential' (default), 'pair' (2 subjects/day), 'mixed' (round-robin all). */
  pattern?: 'sequential' | 'pair' | 'mixed';
  /** Minutes returned by JS Date.getTimezoneOffset() in the user's browser (UTC - local, in minutes). IST = 330. */
  tzOffsetMinutes?: number;
}



function intervalMinutes(iv: StudyInterval): number {
  const [sh, sm] = iv.start.split(':').map(Number);
  const [eh, em] = iv.end.split(':').map(Number);
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}
function dayBudgetMinutes(p: DayPlan): number {
  return (p?.intervals || []).reduce((a, iv) => a + intervalMinutes(iv), 0);
}
function describeDay(name: string, p: DayPlan): string {
  if (!p?.intervals?.length) return `${name}: no study (skip)`;
  return `${name}: ${p.intervals.map(iv => `${iv.label} ${iv.start}-${iv.end}`).join(', ')}`;
}

type TimetableItem = { id: string; title: string; durationMinutes: number; subject_id?: string; chapter_id?: string; topic_id?: string };

function canonicalizeItemsBySubject<T extends { subject_id?: string; title?: string }>(items: T[]): T[] {
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
}

function subjectOrderPreview(items: Array<{ subject_id?: string; title?: string }>, limit = 18): string {
  return items.slice(0, limit).map(item => item.title?.split(' • ')[0] || item.subject_id || '__none__').join(' | ');
}


async function callAI(cfg: AIConfig, system: string, user: string): Promise<any> {
  const res = await fetch(cfg.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 401) throw new Error('Invalid API key in Admin Settings.');
    if (res.status === 429) throw new Error('AI quota/rate limit hit. Please try again later.');
    throw new Error(`AI error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    // strip code fences if model wrapped JSON
    const cleaned = content.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    return JSON.parse(cleaned);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const adminClient = createClient(supabaseUrl, serviceKey);
    const aiCfg = await loadAIConfig(adminClient);


    if (body.action === 'evaluate_feasibility') {
      const b = body as FeasibilityBody;
      const deadlineDate = new Date(b.deadline);
      const startMs = b.startDate ? new Date(b.startDate).getTime() : Date.now();
      const daysAvailable = Math.max(1, Math.ceil((deadlineDate.getTime() - startMs) / (1000 * 60 * 60 * 24)));
      const totalAvailableMinutes = daysAvailable * (b.dailyHours || 1) * 60;

      const system = `You are a study planning coach. Reply ONLY with JSON: {"verdict":"too_short"|"ok"|"generous","message":"..."}.
- "too_short": the time is too little to realistically finish.
- "ok": time is reasonable; reply with a short motivational message.
- "generous": plenty of time; encourage steady pace.
Keep messages friendly, 1-2 sentences, relatable.`;

      const userPrompt = `Scope: ${b.scopeLabel}
Content duration to study: ${b.contentDurationMinutes} minutes
Start date: ${b.startDate || 'today'}
Deadline: ${b.deadline} (${daysAvailable} days from start)
User plans ${b.dailyHours} hours/day
Total study time available with this plan: ${totalAvailableMinutes} minutes
Decide verdict and write a motivating message.`;

      const out = await callAI(aiCfg, system, userPrompt);
      return new Response(JSON.stringify(out), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    if (body.action === 'generate_plan') {
      const b = body as GeneratePlanBody;

      // Local-timezone-aware deterministic scheduler.
      // tzOffsetMinutes follows JS Date.getTimezoneOffset() convention:
      //   localTime = UTC - tzOffsetMinutes  (e.g. IST returns 330 → UTC is 330 min behind local)
      const TZ = typeof b.tzOffsetMinutes === 'number' ? b.tzOffsetMinutes : 0;

      const planFor = (dow: number): DayPlan => {
        if (dow === 0) return b.sunday;
        if (dow === 6) return b.saturday;
        return b.weekday;
      };
      const sortIntervals = (p: DayPlan) =>
        [...(p?.intervals || [])].sort((a, c) => a.start.localeCompare(c.start));
      const toMin = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      const fromMin = (n: number) => {
        const h = Math.floor(n / 60).toString().padStart(2, '0');
        const m = (n % 60).toString().padStart(2, '0');
        return `${h}:${m}`;
      };

      // Convert a local Y-M-D + minutes-of-day into a UTC ISO string.
      const localToUtcIso = (y: number, mo: number, d: number, mins: number) => {
        // UTC instant = local instant + tzOffsetMinutes
        const utcMs = Date.UTC(y, mo, d, 0, 0, 0) + (mins + TZ) * 60000;
        return new Date(utcMs).toISOString();
      };

      const canonicalOriginalItems = canonicalizeItemsBySubject<TimetableItem>(
        b.itemsOriginal && b.itemsOriginal.length ? b.itemsOriginal : b.items,
      );

      console.log('[study-timetable-ai] generate_plan:start', JSON.stringify({
        user_id: user.id,
        courseId: b.courseId,
        scopeType: b.scopeType,
        scopeId: b.scopeId,
        pattern: b.pattern || 'sequential',
        deadline: b.deadline,
        itemCount: b.items.length,
        itemsOriginalCount: b.itemsOriginal?.length || 0,
        incomingPreview: subjectOrderPreview(b.items),
        originalPreview: subjectOrderPreview(canonicalOriginalItems),
      }));

      // Local "today" derived from current UTC.
      const nowUtc = new Date();
      const nowLocalMs = nowUtc.getTime() - TZ * 60000;
      const nowLocal = new Date(nowLocalMs);
      const nowLocalMinutes = nowLocal.getUTCHours() * 60 + nowLocal.getUTCMinutes();
      const todayY = nowLocal.getUTCFullYear();
      const todayM = nowLocal.getUTCMonth();
      const todayD = nowLocal.getUTCDate();
      const todayKey = todayY * 10000 + (todayM + 1) * 100 + todayD;

      // Honor user-picked start date (local YYYY-MM-DD). Never earlier than today.
      let cursorY = todayY, cursorM = todayM, cursorD = todayD;
      if (b.startDate) {
        const [sy, sm, sd] = b.startDate.split('-').map(Number);
        const startKey = sy * 10000 + sm * 100 + sd;
        if (startKey > todayKey) {
          cursorY = sy; cursorM = sm - 1; cursorD = sd;
        }
      }
      const startKey = cursorY * 10000 + (cursorM + 1) * 100 + cursorD;


      // Deadline as a local calendar date (inclusive).
      const [dy, dm, dd] = b.deadline.split('-').map(Number);
      const deadlineKey = dy * 10000 + dm * 100 + dd;

      // Step 1: enumerate every (date, interval) slot from today → deadline.
      // For today, clip intervals so we don't schedule before the current moment.
      type Slot = { y: number; m: number; d: number; intervals: StudyInterval[] };
      const slots: Slot[] = [];
      {
        let cy = cursorY, cm = cursorM, cd = cursorD;
        let safety = 800;
        while (safety-- > 0) {
          const normalized = new Date(Date.UTC(cy, cm, cd));
          cy = normalized.getUTCFullYear();
          cm = normalized.getUTCMonth();
          cd = normalized.getUTCDate();
          const key = cy * 10000 + (cm + 1) * 100 + cd;
          if (key > deadlineKey) break;
          const dow = normalized.getUTCDay();
          let intervals = sortIntervals(planFor(dow));
          if (key === todayKey) {
            intervals = intervals
              .map(iv => {
                const startM = Math.max(toMin(iv.start), nowLocalMinutes);
                const endM = toMin(iv.end);
                if (startM >= endM) return null;
                return { ...iv, start: fromMin(startM) } as StudyInterval;
              })
              .filter((iv): iv is StudyInterval => iv !== null);
          }
          slots.push({ y: cy, m: cm, d: cd, intervals });
          cd += 1;
        }
      }

      const totalCapacityMin = slots.reduce(
        (sum, s) => sum + s.intervals.reduce((a, iv) => a + intervalMinutes(iv), 0),
        0,
      );
      const N = b.items.length;

      // Step 2: uniform per-topic length derived from the full window.
      // Cap by the longest available interval so a topic always fits inside
      // at least one interval (otherwise every topic gets skipped → 0 sessions).
      const maxIntervalMin = slots.reduce(
        (max, s) => s.intervals.reduce((m, iv) => Math.max(m, intervalMinutes(iv)), max),
        0,
      );
      const idealPerTopic = N > 0 ? Math.floor(totalCapacityMin / N) : 0;
      const perTopicMin = N > 0
        ? Math.max(5, Math.min(idealPerTopic || 5, maxIntervalMin || 5, 90))
        : 0;

      // Step 2b: spread topics across the whole window so the deadline day
      // is actually used. Allot ceil(N / slots.length) topics per day instead
      // of packing them all into the earliest days.
      const usableDays = slots.filter(s => s.intervals.length > 0).length;
      const perDayTarget = usableDays > 0 ? Math.ceil(N / usableDays) : N;

      console.log('[study-timetable-ai] generate_plan:capacity', JSON.stringify({
        pattern: b.pattern || 'sequential',
        deadline: b.deadline,
        slotDays: slots.length,
        usableDays,
        totalCapacityMin,
        itemCount: N,
        maxIntervalMin,
        idealPerTopic,
        perTopicMin,
        perDayTarget,
        firstSlot: slots[0] ? `${slots[0].y}-${String(slots[0].m + 1).padStart(2, '0')}-${String(slots[0].d).padStart(2, '0')}` : null,
        lastSlot: slots[slots.length - 1] ? `${slots[slots.length - 1].y}-${String(slots[slots.length - 1].m + 1).padStart(2, '0')}-${String(slots[slots.length - 1].d).padStart(2, '0')}` : null,
      }));

      // Step 3: per-day allotment placement.
      const queue = b.items.map(i => ({
        id: i.id,
        title: i.title,
        subject_id: i.subject_id,
        chapter_id: i.chapter_id,
        topic_id: i.topic_id,
      }));

      const sessions: Array<{
        item_id: string; title: string; scheduled_at: string; duration_minutes: number;
      }> = [];

      if (perTopicMin > 0) {
        // Walk slots in order; place up to `perDayTarget` topics per day, but
        // never overflow the day's interval capacity. Leftovers fall through
        // to the next day so we still finish.
        for (let si = 0; si < slots.length && queue.length > 0; si++) {
          const slot = slots[si];
          if (slot.intervals.length === 0) continue;
          // Remaining days (including this one) with capacity, used to rebalance
          // so we never run out before the deadline day.
          const remainingDays = slots.slice(si).filter(s => s.intervals.length > 0).length;
          const target = Math.max(1, Math.ceil(queue.length / Math.max(1, remainingDays)));
          let placedToday = 0;
          for (const iv of slot.intervals) {
            let cur = toMin(iv.start);
            const ivEnd = toMin(iv.end);
            while (
              placedToday < target &&
              cur + perTopicMin <= ivEnd &&
              queue.length > 0
            ) {
              const topic = queue.shift()!;
              sessions.push({
                item_id: topic.id,
                title: topic.title,
                scheduled_at: localToUtcIso(slot.y, slot.m, slot.d, cur),
                duration_minutes: perTopicMin,
              });
              cur += perTopicMin;
              placedToday += 1;
            }
            if (placedToday >= target || queue.length === 0) break;
          }
        }
      }


      // Persist timetable + sessions
      const { data: tt, error: ttErr } = await supabase
        .from('study_timetables')
        .insert({
          student_id: user.id,
          course_id: b.courseId,
          mode: 'auto',
          plan_metadata: {
            scopeType: b.scopeType,
            scopeId: b.scopeId,
            scopeLabel: b.scopeLabel,
            deadline: b.deadline,
            startDate: b.startDate || null,
            weekday: b.weekday,
            saturday: b.saturday,
            sunday: b.sunday,
            tzOffsetMinutes: TZ,
            feedbackMessage: b.feedbackMessage,
            unscheduled_items: queue.length,
            pattern: b.pattern || 'sequential',
            items: b.items,
            items_original: canonicalOriginalItems,

          },
        })
        .select()
        .single();

      if (ttErr) throw ttErr;

      const itemMap = new Map(b.items.map(i => [i.id, i]));
      const sessionRows = sessions.map((s) => {
        const item = itemMap.get(s.item_id);
        return {
          timetable_id: tt.id,
          student_id: user.id,
          course_id: b.courseId,
          subject_id: item?.subject_id || null,
          chapter_id: item?.chapter_id || null,
          topic_id: item?.topic_id || null,
          title: s.title || item?.title || 'Study session',
          scheduled_at: s.scheduled_at,
          duration_minutes: s.duration_minutes,
        };
      });

      for (let i = 0; i < sessionRows.length; i += 200) {
        const chunk = sessionRows.slice(i, i + 200);
        const { error: sErr } = await supabase.from('study_timetable_sessions').insert(chunk);
        if (sErr) throw sErr;
      }

      const lastRow = sessionRows[sessionRows.length - 1];
      const lastDateKey = lastRow
        ? (() => {
            // Reconstruct local Y-M-D from the stored UTC ISO
            const dt = new Date(lastRow.scheduled_at);
            const localMs = dt.getTime() - TZ * 60000;
            const local = new Date(localMs);
            return local.getUTCFullYear() * 10000 + (local.getUTCMonth() + 1) * 100 + local.getUTCDate();
          })()
        : null;

      console.log('[study-timetable-ai] generate_plan:done', JSON.stringify({
        timetable_id: tt.id,
        pattern: b.pattern || 'sequential',
        sessionsCreated: sessionRows.length,
        unscheduledItems: queue.length,
        firstScheduledAt: sessionRows[0]?.scheduled_at || null,
        lastScheduledAt: lastRow?.scheduled_at || null,
        deadline: b.deadline,
        reachedDeadlineDay: lastDateKey === deadlineKey,
        sessionPreview: sessionRows.slice(0, 18).map(row => row.subject_id || row.title?.split(' • ')[0] || '__none__').join(' | '),
        itemsOriginalCount: canonicalOriginalItems.length,
      }));


      return new Response(JSON.stringify({ timetable_id: tt.id, sessions_created: sessionRows.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[study-timetable-ai] error', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
