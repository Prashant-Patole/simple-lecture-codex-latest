import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from "date-fns";

interface AttendanceData {
  date: string;
  status: "present" | "absent" | "upcoming";
  subject?: string;
}

interface AttendanceCalendarProps {
  attendanceData: AttendanceData[];
  month?: Date;
}

export const AttendanceCalendar = ({ 
  attendanceData, 
  month = new Date() 
}: AttendanceCalendarProps) => {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const startDayOfWeek = getDay(monthStart);
  const emptyDays = Array(startDayOfWeek).fill(null);

  const getAttendanceStatus = (day: Date) => {
    const attendance = attendanceData.find(a => 
      isSameDay(new Date(a.date), day)
    );
    return attendance;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "present":
        return "bg-green-500 hover:bg-green-600";
      case "absent":
        return "bg-red-500 hover:bg-red-600";
      case "upcoming":
        return "bg-blue-500 hover:bg-blue-600";
      default:
        return "bg-muted hover:bg-muted/80";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Attendance Calendar</span>
          <span className="text-sm font-normal text-muted-foreground">
            {format(month, "MMMM yyyy")}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>Present</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span>Absent</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span>Upcoming</span>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-muted-foreground p-2">
                {day}
              </div>
            ))}
            
            {emptyDays.map((_, idx) => (
              <div key={`empty-${idx}`} className="aspect-square" />
            ))}
            
            {daysInMonth.map((day) => {
              const attendance = getAttendanceStatus(day);
              return (
                <TooltipProvider key={day.toString()}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`aspect-square rounded-md flex items-center justify-center text-sm font-medium cursor-pointer transition-colors ${getStatusColor(attendance?.status)}`}
                      >
                        {format(day, "d")}
                      </div>
                    </TooltipTrigger>
                    {attendance && (
                      <TooltipContent>
                        <div className="space-y-1">
                          <p className="font-semibold">{format(day, "MMM dd, yyyy")}</p>
                          <p className="capitalize">{attendance.status}</p>
                          {attendance.subject && (
                            <p className="text-xs text-muted-foreground">{attendance.subject}</p>
                          )}
                        </div>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
