import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, BookOpen, LayoutList, CalendarDays } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const TimetableTab = ({ student }: { student: any }) => {
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  const timetable = student.timetable || [];
  
  // Extract unique courses and subjects
  const courses = useMemo(() => {
    const uniqueCourses = new Set(student.courses?.map((c: any) => c.name) || []);
    return Array.from(uniqueCourses);
  }, [student.courses]);

  const subjects = useMemo(() => {
    const uniqueSubjects = new Set<string>(timetable.map((t: any) => t.subject as string));
    return Array.from(uniqueSubjects);
  }, [timetable]);

  // Filter timetable
  const filteredTimetable = useMemo(() => {
    return timetable.filter((entry: any) => {
      if (selectedSubject !== "all" && entry.subject !== selectedSubject) return false;
      return true;
    });
  }, [timetable, selectedSubject]);

  // Group by day for calendar view
  const timetableByDay = useMemo(() => {
    const grouped: Record<number, any[]> = {};
    filteredTimetable.forEach((entry: any) => {
      if (!grouped[entry.day]) grouped[entry.day] = [];
      grouped[entry.day].push(entry);
    });
    // Sort entries by start time within each day
    Object.keys(grouped).forEach(day => {
      grouped[Number(day)].sort((a, b) => a.start_time.localeCompare(b.start_time));
    });
    return grouped;
  }, [filteredTimetable]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "live_class":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "recorded":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400";
      case "self_study":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getSubjectColor = (subject: string) => {
    const colors = [
      "border-l-4 border-l-blue-500",
      "border-l-4 border-l-green-500",
      "border-l-4 border-l-purple-500",
      "border-l-4 border-l-orange-500",
      "border-l-4 border-l-pink-500",
    ];
    const index = subject.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex-1" />

            <Button
              variant={viewMode === "calendar" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Calendar
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="h-4 w-4 mr-2" />
              List
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {DAYS.map((day, dayIndex) => (
            <Card key={day}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{day}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(timetableByDay[dayIndex] as any[])?.length > 0 ? (
                  (timetableByDay[dayIndex] as any[]).map((entry: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg bg-card border ${getSubjectColor(entry.subject)} space-y-1`}
                    >
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{entry.start_time} - {entry.end_time}</span>
                      </div>
                      <p className="font-semibold text-sm">{entry.subject}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{entry.topic}</p>
                      <div className="flex items-center gap-1 text-xs">
                        <User className="h-3 w-3" />
                        <span className="line-clamp-1">{entry.instructor}</span>
                      </div>
                      <Badge className={`text-xs ${getTypeColor(entry.type)}`}>
                        {entry.type.replace("_", " ")}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No classes</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <Card>
          <CardHeader>
            <CardTitle>Weekly Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {DAYS.map((day, dayIndex) => (
                (timetableByDay[dayIndex] as any[])?.length > 0 && (
                  <div key={day} className="space-y-2">
                    <h3 className="font-semibold text-sm text-muted-foreground">{day}</h3>
                    <div className="space-y-2">
                      {(timetableByDay[dayIndex] as any[]).map((entry: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border ${getSubjectColor(entry.subject)} bg-card`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-primary" />
                                <span className="font-semibold">{entry.subject}</span>
                                <Badge className={getTypeColor(entry.type)}>
                                  {entry.type.replace("_", " ")}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{entry.topic}</p>
                              <div className="flex items-center gap-4 text-sm">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span>{entry.start_time} - {entry.end_time}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <User className="h-4 w-4 text-muted-foreground" />
                                  <span>{entry.instructor}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredTimetable.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No timetable entries found for the selected filters.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
