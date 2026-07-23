import { Video, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLiveClasses } from '@/hooks/useLiveClasses';

export const LiveClassBanner = () => {
  const { liveClasses, hasLiveClasses, isLoading } = useLiveClasses();

  if (isLoading || !hasLiveClasses) {
    return null;
  }

  return (
    <div className="space-y-3">
      {liveClasses.map((classItem) => (
        <Card
          key={classItem.id}
          className="p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-red-200 dark:border-red-800"
        >
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="destructive" className="animate-pulse">
              <div className="h-2 w-2 rounded-full bg-white mr-1 animate-ping" />
              LIVE NOW
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(classItem.scheduled_at), 'HH:mm')}
            </span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={(classItem.teacher as any)?.avatar_url || ''} />
              <AvatarFallback>
                {(classItem.teacher as any)?.full_name?.[0] || 'T'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold">{classItem.subject}</h4>
              <p className="text-sm text-muted-foreground">
                {(classItem.teacher as any)?.full_name || 'Teacher'}
              </p>
              {classItem.room_number && (
                <p className="text-xs text-muted-foreground">
                  Room {classItem.room_number}
                </p>
              )}
            </div>
          </div>

          {classItem.meeting_link ? (
            <Button
              className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 animate-pulse"
              onClick={() => window.open(classItem.meeting_link!, '_blank')}
            >
              <Video className="h-4 w-4 mr-2" />
              JOIN NOW
              <ExternalLink className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <div className="text-center text-sm text-muted-foreground py-2">
              Class is live in Room {classItem.room_number}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
};
