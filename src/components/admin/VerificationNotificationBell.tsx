import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useVerificationNotifications } from "@/hooks/useVerificationNotifications";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

export const VerificationNotificationBell = () => {
  const { notifications, unreadCount, markAsRead } = useVerificationNotifications();
  const navigate = useNavigate();

  const recentNotifications = notifications.slice(0, 5);

  const handleNotificationClick = (notificationId: string, documentId: string) => {
    markAsRead(notificationId);
    navigate(`/admin/question-bank/verify/${documentId}`);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'verification_needed':
        return '🔔';
      case 'verification_completed':
        return '✅';
      case 'issues_found':
        return '⚠️';
      default:
        return '📋';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:bg-primary-dark relative"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="px-3 py-2 font-semibold">Verification Notifications</div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {recentNotifications.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            recentNotifications.map((notification: any) => (
              <DropdownMenuItem
                key={notification.id}
                className={`px-3 py-3 cursor-pointer ${
                  !notification.is_read ? 'bg-muted/50' : ''
                }`}
                onClick={() => handleNotificationClick(notification.id, notification.document_id)}
              >
                <div className="flex gap-3 w-full">
                  <span className="text-xl">{getNotificationIcon(notification.notification_type)}</span>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {notification.uploaded_question_documents?.popular_subjects?.name}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="h-2 w-2 bg-primary rounded-full" />
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/admin/notifications')}
          className="justify-center text-primary cursor-pointer"
        >
          View All Notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
