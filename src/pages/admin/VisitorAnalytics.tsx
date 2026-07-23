import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Users, Globe, MapPin } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PagesAndSourcesTable } from '@/components/admin/analytics/PagesAndSourcesTable';

const formatReferrer = (url: string | null): string => {
  if (!url) return '—';
  if (url === 'testing' || url.includes('lovable.app') || url.includes('lovable.dev') || url.includes('lovableproject.com') || url.includes('localhost')) return 'Testing URL';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    if (host.includes('simplelecture')) return url.replace(parsed.origin, 'https://simplelecture.com');
    return url;
  } catch {
    return url;
  }
};

const VisitorAnalytics = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['visitor-analytics-stats'],
    queryFn: async () => {
      const [totalRes, recentRes, byPageRes, byCountryRes, dailyRes] = await Promise.all([
        // Total visits
        (supabase as any).from('page_visits').select('*', { count: 'exact', head: true }),
        // Recent visits (last 50)
        (supabase as any).from('page_visits')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
        // Visits by page
        (supabase as any).from('page_visits')
          .select('page_path')
          .order('created_at', { ascending: false })
          .limit(1000),
        // Visits with country
        (supabase as any).from('page_visits')
          .select('country')
          .not('country', 'is', null)
          .limit(1000),
        // Last 7 days visits
        (supabase as any).from('page_visits')
          .select('created_at')
          .gte('created_at', subDays(new Date(), 7).toISOString())
          .order('created_at', { ascending: true })
          .limit(5000),
      ]);

      // Unique IPs
      const uniqueIps = new Set((recentRes.data || []).map((v: any) => v.visitor_ip).filter(Boolean));

      // Page counts
      const pageCounts: Record<string, number> = {};
      (byPageRes.data || []).forEach((v: any) => {
        pageCounts[v.page_path] = (pageCounts[v.page_path] || 0) + 1;
      });
      const topPages = Object.entries(pageCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([path, count]) => ({ path, count }));

      // Country counts
      const countryCounts: Record<string, number> = {};
      (byCountryRes.data || []).forEach((v: any) => {
        countryCounts[v.country] = (countryCounts[v.country] || 0) + 1;
      });
      const topCountries = Object.entries(countryCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([country, count]) => ({ country, count }));

      // Daily chart data
      const dailyCounts: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const day = format(subDays(new Date(), i), 'MMM dd');
        dailyCounts[day] = 0;
      }
      (dailyRes.data || []).forEach((v: any) => {
        const day = format(new Date(v.created_at), 'MMM dd');
        if (dailyCounts[day] !== undefined) dailyCounts[day]++;
      });
      const chartData = Object.entries(dailyCounts).map(([date, visits]) => ({ date, visits }));

      return {
        totalVisits: totalRes.count || 0,
        uniqueIpCount: uniqueIps.size,
        topPages,
        topCountries,
        chartData,
        recentVisits: recentRes.data || [],
      };
    },
    staleTime: 30000,
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading analytics...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Visitor Analytics</h1>

      <PagesAndSourcesTable />


      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Visits</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats?.totalVisits.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unique IPs (recent)</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats?.uniqueIpCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Country</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats?.topCountries[0]?.country || 'N/A'}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Top Pages</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats?.topPages.length}</p></CardContent>
        </Card>
      </div>

      {/* Daily Chart */}
      <Card>
        <CardHeader><CardTitle>Visits (Last 7 Days)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="visits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Pages & Countries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Top Pages</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Page</TableHead><TableHead className="text-right">Visits</TableHead></TableRow></TableHeader>
              <TableBody>
                {stats?.topPages.map((p: any) => (
                  <TableRow key={p.path}><TableCell className="font-mono text-sm">{p.path}</TableCell><TableCell className="text-right">{p.count}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top Countries</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Country</TableHead><TableHead className="text-right">Visits</TableHead></TableRow></TableHeader>
              <TableBody>
                {stats?.topCountries.map((c: any) => (
                  <TableRow key={c.country}><TableCell>{c.country}</TableCell><TableCell className="text-right">{c.count}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Recent Visits Table */}
      <Card>
        <CardHeader><CardTitle>Recent Visits</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Page</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Referrer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.recentVisits.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(new Date(v.created_at), 'MMM dd, HH:mm')}</TableCell>
                    <TableCell className="font-mono text-sm">{v.page_path}</TableCell>
                    <TableCell className="text-xs">{v.visitor_ip || '—'}</TableCell>
                    <TableCell>{v.country || '—'}</TableCell>
                    <TableCell className="text-xs max-w-32 truncate">{formatReferrer(v.referrer)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VisitorAnalytics;
