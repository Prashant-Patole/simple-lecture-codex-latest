import { useState, useMemo, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useUnifiedLiveClasses, useLiveClassFilterOptions, UnifiedClass } from "@/hooks/useUnifiedLiveClasses";
import { useStudentCourseIds } from "@/hooks/useStudentEnrollments";
import { format, isToday, isTomorrow, startOfWeek, addWeeks, subWeeks, isSameWeek, addDays } from "date-fns";
import { Video, Clock, User, MapPin, BookOpen, Radio, Calendar, ArrowRight, ChevronLeft, ChevronRight, BarChart3, PlayCircle } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/mobile/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import { AttendanceDashboard } from "@/components/learning/AttendanceDashboard";
import { RecordingsTab } from "@/components/learning/RecordingsTab";
import { useQueryClient } from "@tanstack/react-query";
import { LiveFilters } from "@/components/live/LiveFilters";
import { LiveVideoPlayer } from "@/components/live/LiveVideoPlayer";
import { useRecordAttendance } from "@/hooks/useRecordAttendance";

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const ClassCard = ({ classItem, showDate = false }: { classItem: UnifiedClass; showDate?: boolean }) => {
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const { joinClass, leaveClass } = useRecordAttendance();

  const formatTime = (date: Date) => {
    return format(date, "h:mm a");
  };

  const getDateLabel = () => {
    if (isToday(classItem.scheduled_at)) return "Today";
    if (isTomorrow(classItem.scheduled_at)) return "Tomorrow";
    return format(classItem.scheduled_at, "EEE, MMM d");
  };

  return (
    <>
      <Card className={`p-4 transition-all ${classItem.is_live ? 'border-destructive border-2 bg-destructive/5' : 'hover:shadow-md'}`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {classItem.is_live && (
                <Badge variant="destructive" className="animate-pulse flex items-center gap-1">
                  <Radio className="h-3 w-3" />
                  LIVE NOW
                </Badge>
              )}
              {!classItem.is_live && classItem.is_upcoming && (
                <Badge variant="secondary">Upcoming</Badge>
              )}
              {showDate && (
                <Badge variant="outline">{getDateLabel()}</Badge>
              )}
              {classItem.source === 'scheduled' && (
                <Badge variant="outline" className="text-xs">Scheduled</Badge>
              )}
            </div>
            <h3 className="font-semibold text-base sm:text-lg">{classItem.subject_name}</h3>
            <p className="text-sm text-muted-foreground">{classItem.course_name}</p>
            {classItem.chapter_name && (
              <p className="text-xs text-muted-foreground mt-1">
                Chapter: {classItem.chapter_name}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {formatTime(classItem.scheduled_at)} - {formatTime(classItem.ends_at)}
          </div>
          {classItem.instructor_name && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              {classItem.instructor_name}
            </div>
          )}
          {classItem.room_number && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {classItem.room_number}
            </div>
          )}
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {classItem.duration_minutes} min
          </div>
        </div>

        {classItem.meeting_link ? (
          <Button 
            className="w-full" 
            variant={classItem.is_live ? "destructive" : "default"}
            onClick={() => {
              // Record attendance when joining class
              joinClass.mutate(classItem.id);
              setIsPlayerOpen(true);
            }}
          >
            <Video className="h-4 w-4 mr-2" />
            {classItem.is_live ? "Join Live Class" : "Join Class"}
          </Button>
        ) : (
          <Button className="w-full" variant="outline" disabled>
            <Video className="h-4 w-4 mr-2" />
            No Meeting Link
          </Button>
        )}
      </Card>

      {/* Embedded Video Player - URL is hidden from users */}
      <LiveVideoPlayer
        isOpen={isPlayerOpen}
        onClose={() => {
          // Record leave time when closing player
          leaveClass.mutate(classItem.id);
          setIsPlayerOpen(false);
        }}
        meetingLink={classItem.meeting_link || ""}
        title={classItem.subject_name}
        courseName={classItem.course_name}
        instructorName={classItem.instructor_name}
        isLive={classItem.is_live}
      />
    </>
  );
};

const LivePage = () => {
  const { data, isLoading, refetch } = useUnifiedLiveClasses();
  const { courseIds } = useStudentCourseIds();
  const { data: filterOptions } = useLiveClassFilterOptions(courseIds || []);
  const queryClient = useQueryClient();

  // Filter state
  const [courseFilter, setCourseFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [chapterFilter, setChapterFilter] = useState('all');

  // Reset dependent filters when parent filter changes
  const handleCourseChange = (value: string) => {
    setCourseFilter(value);
    setSubjectFilter('all');
    setChapterFilter('all');
  };

  const handleSubjectChange = (value: string) => {
    setSubjectFilter(value);
    setChapterFilter('all');
  };

  const clearFilters = () => {
    setCourseFilter('all');
    setSubjectFilter('all');
    setChapterFilter('all');
  };

  // Real-time subscription for live class updates
  useEffect(() => {
    const channel = supabase
      .channel('live-class-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scheduled_classes',
        },
        () => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['unified-live-classes'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch, queryClient]);

  // Apply filters to classes
  const filteredData = useMemo(() => {
    if (!data) return { today: [], week: [], current: null, next: null };

    const filterClass = (c: UnifiedClass) => {
      if (courseFilter !== 'all' && c.course_id !== courseFilter) return false;
      if (subjectFilter !== 'all' && c.subject_id !== subjectFilter) return false;
      if (chapterFilter !== 'all' && c.chapter_id !== chapterFilter) return false;
      return true;
    };

    const today = data.today.filter(filterClass);
    const week = data.week.filter(filterClass);
    const current = data.current && filterClass(data.current) ? data.current : null;
    const next = week.find(c => c.is_upcoming && !c.is_live) || null;

    return { today, week, current, next };
  }, [data, courseFilter, subjectFilter, chapterFilter]);

  if (isLoading) {
    return (
      <>
        <DashboardHeader />
        <main className="min-h-screen bg-background py-4 md:py-8">
          <div className="container mx-auto px-4">
            <Skeleton className="h-10 w-64 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const { today, week, current, next } = filteredData;

  return (
    <>
      <DashboardHeader />
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <main className="min-h-screen bg-background py-4 md:py-8 pb-20 md:pb-8">
        <div className="container mx-auto px-4">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2 md:gap-3">
              <Calendar className="h-6 w-6 md:h-8 md:w-8 text-primary hidden sm:block" />
              My Class Schedule
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">View your live and upcoming classes based on your enrolled courses</p>
          </div>

          {/* Filters */}
          <LiveFilters
            courses={filterOptions?.courses || []}
            subjects={filterOptions?.subjects || []}
            chapters={filterOptions?.chapters || []}
            courseFilter={courseFilter}
            subjectFilter={subjectFilter}
            chapterFilter={chapterFilter}
            onCourseChange={handleCourseChange}
            onSubjectChange={handleSubjectChange}
            onChapterChange={setChapterFilter}
            onClearFilters={clearFilters}
          />

          {/* Current/Live Class */}
          {current && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Radio className="h-5 w-5 text-destructive animate-pulse" />
                Live Now
              </h2>
              <div className="max-w-xl">
                <ClassCard classItem={current} />
              </div>
            </div>
          )}

          {/* Next Class */}
          {next && !current && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <ArrowRight className="h-5 w-5 text-primary" />
                Next Up
              </h2>
              <div className="max-w-xl">
                <ClassCard classItem={next} showDate />
              </div>
            </div>
          )}

          {/* Main Tabs with Schedule, Attendance, Recordings */}
          <MainTabs today={today} week={week} />
        </div>
      </main>
      <Footer />
      <BottomNav />
    </>
  );
};

// Main tabs component with Schedule, Attendance, and Recordings
const MainTabs = ({ today, week }: { today: UnifiedClass[]; week: UnifiedClass[] }) => {
  return (
    <Tabs defaultValue="schedule" className="mt-8">
      <TabsList className="mb-6 w-full sm:w-auto">
        <TabsTrigger value="schedule" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Schedule</span>
        </TabsTrigger>
        <TabsTrigger value="attendance" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Attendance</span>
        </TabsTrigger>
        <TabsTrigger value="recordings" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
          <PlayCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Recordings</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="schedule">
        <WeeklySchedule today={today} week={week} />
      </TabsContent>

      <TabsContent value="attendance">
        <AttendanceDashboard />
      </TabsContent>

      <TabsContent value="recordings">
        <RecordingsTab />
      </TabsContent>
    </Tabs>
  );
};

// Separate component for weekly schedule with navigation
const WeeklySchedule = ({ today, week }: { today: UnifiedClass[]; week: UnifiedClass[] }) => {
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );

  const weekDates = useMemo(() => {
    return DAYS.map((_, idx) => addDays(selectedWeekStart, idx));
  }, [selectedWeekStart]);

  const isCurrentWeek = useMemo(() => {
    return isSameWeek(selectedWeekStart, new Date(), { weekStartsOn: 0 });
  }, [selectedWeekStart]);

  const handlePreviousWeek = () => {
    setSelectedWeekStart(prev => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setSelectedWeekStart(prev => addWeeks(prev, 1));
  };

  const handleToday = () => {
    setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  // Filter week classes for selected week
  const filteredWeek = useMemo(() => {
    return week.filter(classItem => {
      return isSameWeek(classItem.scheduled_at, selectedWeekStart, { weekStartsOn: 0 });
    });
  }, [week, selectedWeekStart]);

  return (
    <Tabs defaultValue="today" className="mt-8">
      <TabsList className="mb-6">
        <TabsTrigger value="today">Today ({today.length})</TabsTrigger>
        <TabsTrigger value="week">This Week ({filteredWeek.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="today">
        {today.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Classes Today</h3>
            <p className="text-muted-foreground">You don't have any scheduled classes for today.</p>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {today.map((classItem) => (
              <ClassCard key={classItem.id} classItem={classItem} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="week">
        {/* Week Navigation */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 p-3 bg-muted/30 rounded-lg">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviousWeek}
            className="w-full sm:w-auto"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            <span className="sm:inline">Previous</span>
          </Button>
          
          <div className="flex items-center gap-2 sm:gap-3 order-first sm:order-none">
            <span className="font-semibold text-sm sm:text-base">
              {format(weekDates[0], "MMM d")} - {format(weekDates[6], "MMM d, yyyy")}
            </span>
            {!isCurrentWeek && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleToday}
              >
                <Calendar className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Today</span>
              </Button>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextWeek}
            className="w-full sm:w-auto"
          >
            <span className="sm:inline">Next</span>
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {filteredWeek.length === 0 ? (
          <Card className="p-8 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Classes This Week</h3>
            <p className="text-muted-foreground">You don't have any scheduled classes for the selected week.</p>
          </Card>
        ) : (
          <div className="space-y-6">
            {DAYS.map((day, dayIndex) => {
              const dayClasses = filteredWeek.filter(c => c.scheduled_at.getDay() === dayIndex);
              if (dayClasses.length === 0) return null;

              const dayDate = weekDates[dayIndex];

              return (
                <div key={day}>
                  <h3 className="text-lg font-semibold mb-3">
                    {day}
                    <span className="font-normal text-muted-foreground ml-2">
                      {format(dayDate, "MMMM d, yyyy")}
                    </span>
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dayClasses.map((classItem) => (
                      <ClassCard key={classItem.id} classItem={classItem} showDate />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};

export default LivePage;
