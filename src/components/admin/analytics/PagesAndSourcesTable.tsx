import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format, subDays, startOfDay } from 'date-fns';
import { Eye, Users, TrendingUp } from 'lucide-react';

type SourceKey = 'Instagram' | 'Facebook' | 'Google' | 'YouTube' | 'Direct' | 'Testing' | 'Other';

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All time' },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

function getRangeStart(range: RangeKey): string | null {
  const now = new Date();
  switch (range) {
    case 'today': return startOfDay(now).toISOString();
    case '7d': return subDays(now, 7).toISOString();
    case '30d': return subDays(now, 30).toISOString();
    case 'year': return new Date(now.getFullYear(), 0, 1).toISOString();
    case 'all': return null;
  }
}

function classifySource(referrer: string | null): { source: SourceKey; domain: string } {
  if (!referrer) return { source: 'Direct', domain: '' };
  const r = referrer.toLowerCase();
  if (r === 'testing' || r.includes('lovable.app') || r.includes('lovable.dev') || r.includes('lovableproject.com') || r.includes('localhost')) {
    return { source: 'Testing', domain: 'testing' };
  }
  if (r.includes('instagram.com') || r.includes('l.instagram.com')) return { source: 'Instagram', domain: 'instagram.com' };
  if (r.includes('facebook.com') || r.includes('fb.com') || r.includes('l.facebook.com') || r.includes('fb.me') || r.includes('m.facebook.com')) {
    return { source: 'Facebook', domain: 'facebook.com' };
  }
  if (r.includes('youtube.com') || r.includes('youtu.be')) return { source: 'YouTube', domain: 'youtube.com' };
  if (r.includes('google.')) return { source: 'Google', domain: 'google' };
  let domain = referrer;
  try { domain = new URL(referrer).hostname; } catch { /* keep raw */ }
  return { source: 'Other', domain };
}

interface PageRow {
  path: string;
  visits: number;
  uniqueVisitors: number;
  Instagram: number;
  Facebook: number;
  Google: number;
  YouTube: number;
  Direct: number;
  Testing: number;
  Other: number;
  lastVisit: string;
}

export const PagesAndSourcesTable = () => {
  const [range, setRange] = useState<RangeKey>('7d');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-page-analytics', range],
    queryFn: async () => {
      const since = getRangeStart(range);
      let q = (supabase as any).from('page_visits')
        .select('page_path, referrer, visitor_ip, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(10000);
      if (since) q = q.gte('created_at', since);
      const { data: rows } = await q;
      const list: any[] = rows || [];

      const pageMap = new Map<string, PageRow>();
      const referrerMap = new Map<string, number>();
      const sourceTotals: Record<SourceKey, number> = {
        Instagram: 0, Facebook: 0, Google: 0, YouTube: 0, Direct: 0, Testing: 0, Other: 0,
      };
      const uniqueKeys = new Set<string>();

      const pageUnique = new Map<string, Set<string>>();

      list.forEach((v) => {
        const path = v.page_path || '/';
        const { source, domain } = classifySource(v.referrer);
        sourceTotals[source]++;

        const uKey = v.user_id || v.visitor_ip || `anon-${v.id}`;
        uniqueKeys.add(uKey);

        let row = pageMap.get(path);
        if (!row) {
          row = { path, visits: 0, uniqueVisitors: 0, Instagram: 0, Facebook: 0, Google: 0, YouTube: 0, Direct: 0, Testing: 0, Other: 0, lastVisit: v.created_at };
          pageMap.set(path, row);
          pageUnique.set(path, new Set());
        }
        row.visits++;
        row[source]++;
        pageUnique.get(path)!.add(uKey);
        if (new Date(v.created_at) > new Date(row.lastVisit)) row.lastVisit = v.created_at;

        if (domain && source !== 'Direct') {
          referrerMap.set(domain, (referrerMap.get(domain) || 0) + 1);
        }
      });

      pageMap.forEach((row, path) => {
        row.uniqueVisitors = pageUnique.get(path)!.size;
      });

      const pageRows = Array.from(pageMap.values()).sort((a, b) => b.visits - a.visits);
      const topReferrers = Array.from(referrerMap.entries())
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      const topSource = (Object.entries(sourceTotals) as [SourceKey, number][])
        .filter(([k]) => k !== 'Testing')
        .sort(([, a], [, b]) => b - a)[0];

      return {
        totalVisits: list.length,
        uniqueVisitors: uniqueKeys.size,
        topSource: topSource ? `${topSource[0]} (${topSource[1]})` : '—',
        pageRows,
        topReferrers,
        sourceTotals,
      };
    },
    staleTime: 30000,
  });

  const sources: SourceKey[] = useMemo(() => ['Instagram', 'Facebook', 'Google', 'YouTube', 'Direct', 'Other'], []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Pages &amp; Traffic Sources</h2>
        <div className="flex gap-1 rounded-md border p-1 bg-muted/30">
          {RANGES.map(r => (
            <Button
              key={r.key}
              size="sm"
              variant={range === r.key ? 'default' : 'ghost'}
              className="h-7 px-3 text-xs"
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{data?.totalVisits?.toLocaleString() ?? '—'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unique Visitors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{data?.uniqueVisitors?.toLocaleString() ?? '—'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Source</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{data?.topSource ?? '—'}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Visits per Page</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Unique</TableHead>
                  {sources.map(s => <TableHead key={s} className="text-right">{s}</TableHead>)}
                  <TableHead className="text-right">Last visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={5 + sources.length} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                )}
                {!isLoading && (data?.pageRows.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={5 + sources.length} className="text-center text-muted-foreground py-6">No visits in this range.</TableCell></TableRow>
                )}
                {data?.pageRows.map((p) => (
                  <TableRow key={p.path}>
                    <TableCell className="font-mono text-xs max-w-xs truncate" title={p.path}>{p.path}</TableCell>
                    <TableCell className="text-right font-semibold">{p.visits}</TableCell>
                    <TableCell className="text-right">{p.uniqueVisitors}</TableCell>
                    {sources.map(s => (
                      <TableCell key={s} className="text-right">
                        {p[s] > 0 ? <span className={s === 'Instagram' || s === 'Facebook' ? 'font-semibold text-primary' : ''}>{p[s]}</span> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-xs whitespace-nowrap">{format(new Date(p.lastVisit), 'MMM dd, HH:mm')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Top Referrers (raw domains)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead className="text-right">Visits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.topReferrers.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-6">No external referrers in this range.</TableCell></TableRow>
              )}
              {data?.topReferrers.map((r) => (
                <TableRow key={r.domain}>
                  <TableCell className="font-mono text-xs">{r.domain}</TableCell>
                  <TableCell className="text-right">{r.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PagesAndSourcesTable;
