import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, Phone, Mail } from 'lucide-react';
import { format } from 'date-fns';

const SalesLeads = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: leads, isLoading } = useQuery({
    queryKey: ['admin-sales-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (leads || []).filter(lead => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(q) ||
      lead.email?.toLowerCase().includes(q) ||
      lead.mobile?.toLowerCase().includes(q)
    );
  });

  const statusColor = (status: string | null) => {
    switch (status) {
      case 'converted': return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400';
      case 'contacted': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
      case 'lost': return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400';
      default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Leads</h1>
          <p className="text-muted-foreground">Leads captured from the sales chat widget</p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Users className="h-3.5 w-3.5 mr-1" />
          {filtered.length} leads
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Interaction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No leads found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((lead) => (
                      <TableRow key={lead.id}>
                        <TableCell className="font-medium">{lead.name}</TableCell>
                        <TableCell>
                          {lead.mobile ? (
                            <span className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3" />{lead.mobile}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {lead.email ? (
                            <span className="flex items-center gap-1 text-sm">
                              <Mail className="h-3 w-3" />{lead.email}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={`border-0 ${statusColor(lead.lead_status)}`}>
                            {lead.lead_status || 'new'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lead.created_at ? format(new Date(lead.created_at), 'dd MMM yyyy, HH:mm') : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {lead.last_interaction_at ? format(new Date(lead.last_interaction_at), 'dd MMM yyyy, HH:mm') : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesLeads;
