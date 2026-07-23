import { useState } from 'react';
import { X, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useNotices } from '@/hooks/useNotices';

interface NoticeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const NoticeModal = ({ open, onOpenChange }: NoticeModalProps) => {
  const { notices, unreadCount, markAsRead, markAllAsRead } = useNotices();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filteredNotices = filter === 'unread' 
    ? notices.filter(n => !n.is_read)
    : notices;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] max-w-full sm:max-w-lg p-0">
        <DialogHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Notices
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount}</Badge>
              )}
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')} className="flex-1 flex flex-col">
          <div className="px-4 py-2 border-b">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
            </TabsList>
          </div>

          {unreadCount > 0 && (
            <div className="px-4 py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsRead()}
                className="w-full"
              >
                Mark all as read
              </Button>
            </div>
          )}

          <TabsContent value={filter} className="flex-1 m-0">
            <ScrollArea className="h-[calc(90vh-200px)]">
              <div className="p-4 space-y-3">
                {filteredNotices.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {filter === 'unread' ? 'No unread notices' : 'No notices available'}
                  </p>
                ) : (
                  filteredNotices.map((notice) => (
                    <div
                      key={notice.id}
                      onClick={() => !notice.is_read && markAsRead(notice.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        !notice.is_read
                          ? 'bg-primary/5 border-primary/20'
                          : 'bg-card'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Mail className={`h-4 w-4 ${!notice.is_read ? 'text-primary' : 'text-muted-foreground'}`} />
                          <h4 className="font-medium">{notice.title}</h4>
                        </div>
                        {!notice.is_read && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                      
                      {notice.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {notice.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {notice.category}
                        </Badge>
                        {notice.priority !== 'normal' && (
                          <Badge
                            variant={notice.priority === 'high' ? 'destructive' : 'default'}
                            className="text-xs"
                          >
                            {notice.priority}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(new Date(notice.created_at), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
