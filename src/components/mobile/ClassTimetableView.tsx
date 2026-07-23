import { useState } from 'react';
import { Calendar, Clock, MapPin, User } from 'lucide-react';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTimetable, DayFilter } from '@/hooks/useTimetable';

export const ClassTimetableView = () => {
  const [selectedDay, setSelectedDay] = useState<DayFilter>('today');
  const { classes, currentClass, nextClass, isLoading } = useTimetable(selectedDay);

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-20 bg-muted rounded" />
          <div className="h-20 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <Calendar className="h-5 w-5" />
        Class Timetable
      </h3>

      <Tabs value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayFilter)}>
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="tomorrow">Tomorrow</TabsTrigger>
          <TabsTrigger value="week">This Week</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedDay} className="space-y-2 m-0">
          {classes.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">
              No classes scheduled
            </p>
          ) : (
            classes.map((classItem) => {
              const isCurrent = currentClass?.id === classItem.id;
              const isNext = nextClass?.id === classItem.id;
              
              return (
                <div
                  key={classItem.id}
                  className={`p-3 rounded-lg border ${
                    isCurrent
                      ? 'bg-primary/10 border-primary'
                      : isNext
                      ? 'bg-primary/10 dark:bg-primary/20 border-primary/30 dark:border-primary'
                      : 'bg-card'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={(classItem.teacher as any)?.avatar_url || ''} />
                      <AvatarFallback className="text-xs">
                        {(classItem.teacher as any)?.full_name?.[0] || 'T'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{classItem.subject}</h4>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        {(classItem.teacher as any)?.full_name || 'Teacher'}
                      </div>
                    </div>

                    {isCurrent && (
                      <Badge variant="default" className="text-xs">
                        Live Now
                      </Badge>
                    )}
                    {isNext && !isCurrent && (
                      <Badge variant="secondary" className="text-xs">
                        Next
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(classItem.scheduled_at), 'HH:mm')}
                      {classItem.duration_minutes && ` - ${classItem.duration_minutes}min`}
                    </div>
                    
                    {classItem.room_number && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Room {classItem.room_number}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};
