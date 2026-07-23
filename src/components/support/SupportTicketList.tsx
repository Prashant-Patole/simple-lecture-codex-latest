import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, CheckCircle, AlertCircle, UserCheck } from "lucide-react";
import { format } from "date-fns";

interface SupportTicketListProps {
  onSelectTicket: (ticketId: string) => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  open: { label: "Open", variant: "default", icon: <Clock className="h-3 w-3" /> },
  ai_responded: { label: "AI Responded", variant: "secondary", icon: <MessageSquare className="h-3 w-3" /> },
  escalated_to_admin: { label: "Escalated", variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
  admin_responded: { label: "Admin Replied", variant: "outline", icon: <UserCheck className="h-3 w-3" /> },
  closed_resolved: { label: "Resolved", variant: "outline", icon: <CheckCircle className="h-3 w-3" /> },
  user_confirmed_resolved: { label: "Resolved", variant: "outline", icon: <CheckCircle className="h-3 w-3" /> },
  closed_redirected: { label: "Redirected", variant: "secondary", icon: <MessageSquare className="h-3 w-3" /> },
  closed_no_response: { label: "Closed", variant: "secondary", icon: <Clock className="h-3 w-3" /> },
};

export const SupportTicketList = ({ onSelectTicket }: SupportTicketListProps) => {
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['my-support-tickets'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Support Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tickets || tickets.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          My Support Tickets
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const status = statusConfig[ticket.status] || statusConfig.open;
            return (
              <div
                key={ticket.id}
                className="flex items-center justify-between p-2 sm:p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate text-sm sm:text-base">{ticket.subject}</p>
                    <Badge variant={status.variant} className="shrink-0 flex items-center gap-1">
                      {status.icon}
                      {status.label}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(ticket.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onSelectTicket(ticket.id)}
                >
                  View
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
