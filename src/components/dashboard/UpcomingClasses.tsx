import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Video, BookOpen, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUpcomingClasses } from "@/hooks/useUpcomingClasses";
import { format, isToday, isTomorrow } from "date-fns";

const UpcomingClasses = () => {
  const { data: classes = [], isLoading } = useUpcomingClasses();

  const formatClassDate = (date: string) => {
    const classDate = new Date(date);
    if (isToday(classDate)) return "Today";
    if (isTomorrow(classDate)) return "Tomorrow";
    return format(classDate, "EEE, MMM d");
  };

  const formatFullDate = (date: string) => {
    const classDate = new Date(date);
    return format(classDate, "EEEE, MMMM d, yyyy");
  };

  const formatClassTime = (date: string, duration: number) => {
    const startTime = format(new Date(date), "h:mm a");
    return `${startTime} (${duration} min)`;
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Upcoming Classes</h2>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 border rounded-lg">
              <Skeleton className="h-5 w-32 mb-2" />
              <Skeleton className="h-4 w-48 mb-3" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">Upcoming Classes</h2>
      <div className="space-y-4">
        {classes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No upcoming classes scheduled</p>
          </div>
        ) : (
          classes.slice(0, 5).map((classItem) => (
            <div key={classItem.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{classItem.subject_name || classItem.subject || 'Class'}</h3>
                    {classItem.is_live && (
                      <Badge variant="destructive" className="animate-pulse text-xs">
                        LIVE
                      </Badge>
                    )}
                  </div>
                  {classItem.course_name && (
                    <p className="text-sm text-muted-foreground">{classItem.course_name}</p>
                  )}
                  {classItem.notes && (
                    <p className="text-xs text-muted-foreground mt-0.5">{classItem.notes}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{formatFullDate(classItem.scheduled_at)}</p>
                </div>
                <Badge variant="outline">{formatClassDate(classItem.scheduled_at)}</Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatClassTime(classItem.scheduled_at, classItem.duration_minutes)}
                </div>
                {classItem.teacher && (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={classItem.teacher.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {classItem.teacher.full_name?.charAt(0)?.toUpperCase() || <User className="h-3 w-3" />}
                      </AvatarFallback>
                    </Avatar>
                    <span>{classItem.teacher.full_name}</span>
                  </div>
                )}
              </div>
              {classItem.meeting_link && (
                <Button size="sm" className="w-full" asChild>
                  <a href={classItem.meeting_link} target="_blank" rel="noopener noreferrer">
                    <Video className="h-4 w-4 mr-2" />
                    Join Class
                  </a>
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default UpcomingClasses;
