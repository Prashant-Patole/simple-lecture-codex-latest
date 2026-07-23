// Shared styling helpers for timetable day cells (used by /study-timetable and dashboard strip).

export const SUBJECT_COLORS = [
  'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
  'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30',
  'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
];

export const colorForSubject = (id?: string | null) => {
  if (!id) return 'bg-secondary text-secondary-foreground border-border';
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return SUBJECT_COLORS[h % SUBJECT_COLORS.length];
};

export type DayBucket = 'morning' | 'afternoon' | 'night';

export const bucketOf = (date: Date): DayBucket => {
  const h = date.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'night';
};

export const BUCKET_LABEL: Record<DayBucket, string> = {
  morning: '🌅 Morning',
  afternoon: '☀️ Afternoon',
  night: '🌙 Night',
};
