import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, MailOpen, CheckCheck } from "lucide-react";
import { useNotices } from "@/hooks/useNotices";
import { format } from "date-fns";

export const NoticeBoard = () => {
  const { notices, unreadCount, markAsRead, markAllAsRead, isMarkingRead } = useNotices();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          Notice Board
          {unreadCount > 0 && (
            <Badge variant="destructive" className="rounded-full">
              {unreadCount}
            </Badge>
          )}
        </CardTitle>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllAsRead()}
            disabled={isMarkingRead}
            className="text-xs"
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            Mark all read
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          {notices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No notices available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notices.map((notice) => (
                <div
                  key={notice.id}
                  className={`p-3 rounded-lg border transition-colors cursor-pointer hover:bg-accent/50 ${
                    !notice.is_read ? 'bg-primary/5 border-primary/20' : ''
                  }`}
                  onClick={() => !notice.is_read && markAsRead(notice.id)}
                >
                  <div className="flex items-start gap-3">
                    {notice.is_read ? (
                      <MailOpen className="h-5 w-5 text-muted-foreground mt-0.5" />
                    ) : (
                      <Mail className="h-5 w-5 text-primary mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-medium text-sm">{notice.title}</h4>
                        {!notice.is_read && (
                          <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                        )}
                      </div>
                      {notice.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {notice.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {notice.category}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(notice.created_at), 'MMM dd, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
