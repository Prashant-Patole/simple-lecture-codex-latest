import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotices } from "@/hooks/useNotices";
import { format } from "date-fns";
import { Bell, Megaphone, Calendar, AlertCircle, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface NotificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NotificationModal = ({ open, onOpenChange }: NotificationModalProps) => {
  const { notices, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotices();

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'exam': return <AlertCircle className="h-4 w-4" />;
      case 'holiday': return <Calendar className="h-4 w-4" />;
      default: return <Megaphone className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'normal': return 'default';
      default: return 'secondary';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-2">{unreadCount}</Badge>
              )}
            </DialogTitle>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => markAllAsRead()}>
                Mark all as read
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-3 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No notifications</p>
              <p className="text-sm">You're all caught up!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  className={`relative flex gap-3 p-4 border rounded-lg transition-colors hover:bg-accent cursor-pointer ${
                    !notice.is_read ? 'bg-primary/5 border-primary/20' : ''
                  }`}
                  onClick={() => markAsRead(notice.id)}
                >
                  {!notice.is_read && (
                    <div className="absolute top-2 right-2">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    </div>
                  )}
                  
                  <div className="flex-shrink-0 mt-1">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      !notice.is_read ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      {getCategoryIcon(notice.category)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className={`font-semibold text-sm ${
                        !notice.is_read ? 'text-foreground' : 'text-muted-foreground'
                      }`}>
                        {notice.title}
                      </h4>
                      <Badge variant={getPriorityColor(notice.priority)} className="text-xs">
                        {notice.category}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {notice.description}
                    </p>
                    
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(notice.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};