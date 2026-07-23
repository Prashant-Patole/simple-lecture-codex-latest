import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Eye, Users, UserPlus, TrendingUp, Loader2 } from 'lucide-react';
import { format, subDays } from 'date-fns';

const RANGES = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'all', label: 'All time' },
] as const;
type RangeKey = (typeof RANGES)[number]['key'];

function rangeStart(r: RangeKey): string | null {
  if (r === '7d') return subDays(new Date(), 7).toISOString();
  if (r === '30d') return subDays(new Date(), 30).toISOString();
  return null;
}

interface AnalyticsPayload {
  totalVisits: number;
  uniqueVisitors: number;
  signedInVisitors: number;
  totalUsers: number;
  sources: { source: string; visits: number; unique: number; signed: number }[];
  pages: { path: string; visits: number; unique: number; signed: number; last: string }[];
  recentSignups: { id: string; full_name: string | null; email: string | null; created_at: string | null }[];
}

const AdminAnalytics = () => {
  const [range, setRange] = useState<RangeKey>('30d');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-analytics', range],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_admin_analytics', {
        p_since: rangeStart(range),
      });
      if (error) throw error;
      return data as AnalyticsPayload;
    },
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const conversion = data && data.uniqueVisitors
    ? Math.round((data.signedInVisitors / data.uniqueVisitors) * 100)
    : 0;

  const cards = useMemo(() => ([
    { label: 'Total Visits', value: data?.totalVisits ?? 0, icon: Eye },
    { label: 'Unique Visitors', value: data?.uniqueVisitors ?? 0, icon: Users },
    { label: 'Total Registered Users', value: data?.totalUsers ?? 0, icon: UserPlus },
    { label: 'Signup Conversion', value: `${conversion}%`, icon: TrendingUp, sub: data ? `${data.signedInVisitors}/${data.uniqueVisitors} visitors signed in` : undefined },
  ]), [data, conversion]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Analytics
            {isFetching && !isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </h1>
          <p className="text-sm text-muted-foreground">Where visitors come from, what they view, and who signs up.</p>
        </div>
        <div className="flex gap-1 rounded-md border p-1 bg-muted/30">
          {RANGES.map((r) => (
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{typeof c.value === 'number' ? c.value.toLocaleString() : c.value}</p>
              {c.sub && <p className="text-xs text-muted-foreground mt-1">{c.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Traffic Sources</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Unique Visitors</TableHead>
                  <TableHead className="text-right">Signed Up</TableHead>
                  <TableHead className="text-right">Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                )}
                {!isLoading && (data?.sources.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No visits in this range.</TableCell></TableRow>
                )}
                {data?.sources.map((s) => (
                  <TableRow key={s.source}>
                    <TableCell className="font-medium">{s.source}</TableCell>
                    <TableCell className="text-right">{s.visits}</TableCell>
                    <TableCell className="text-right">{s.unique}</TableCell>
                    <TableCell className="text-right">{s.signed}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {s.unique ? Math.round((s.signed / s.unique) * 100) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Visitors by Page (Top 25)</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead className="text-right">Visits</TableHead>
                  <TableHead className="text-right">Unique</TableHead>
                  <TableHead className="text-right">Signed Up</TableHead>
                  <TableHead className="text-right">Last Visit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                )}
                {!isLoading && (data?.pages.length ?? 0) === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No page views in this range.</TableCell></TableRow>
                )}
                {data?.pages.map((p) => (
                  <TableRow key={p.path}>
                    <TableCell className="font-mono text-xs max-w-xs truncate" title={p.path}>{p.path}</TableCell>
                    <TableCell className="text-right font-semibold">{p.visits}</TableCell>
                    <TableCell className="text-right">{p.unique}</TableCell>
                    <TableCell className="text-right">{p.signed}</TableCell>
                    <TableCell className="text-right text-xs whitespace-nowrap">
                      {p.last ? format(new Date(p.last), 'MMM dd, HH:mm') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent New Signups</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Signed up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.recentSignups.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">No signups yet.</TableCell></TableRow>
              )}
              {data?.recentSignups.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.full_name || '—'}</TableCell>
                  <TableCell className="text-xs">{u.email || '—'}</TableCell>
                  <TableCell className="text-right text-xs whitespace-nowrap">
                    {u.created_at ? format(new Date(u.created_at), 'MMM dd, yyyy HH:mm') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalytics;
