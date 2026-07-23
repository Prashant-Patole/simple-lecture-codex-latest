import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { BottomNav } from '@/components/mobile/BottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useUserRecordings, useRecordingCourses, useRecordingSubjects, useRecordingChapters, useRecordingTopics } from '@/hooks/useUserRecordings';
import { useVideoWatchProgress } from '@/hooks/useClassRecordings';
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { 
  Video, 
  Search, 
  Calendar as CalendarIcon,
  Clock,
  Play,
  User,
  BookOpen,
  Filter,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

const formatDuration = (seconds: number | null) => {
  if (!seconds) return '-';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins} min`;
};

type DatePreset = 'all' | 'today' | 'week' | 'month';

export default function Recordings() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [chapterFilter, setChapterFilter] = useState<string>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [groupBy, setGroupBy] = useState<'none' | 'subject' | 'course' | 'date'>('subject');

  // Calculate date range based on preset
  const effectiveDateRange = useMemo(() => {
    const now = new Date();
    switch (datePreset) {
      case 'today':
        return { from: startOfDay(now), to: endOfDay(now) };
      case 'week':
        return { from: startOfWeek(now), to: endOfDay(now) };
      case 'month':
        return { from: startOfMonth(now), to: endOfDay(now) };
      default:
        return { from: dateFrom, to: dateTo };
    }
  }, [datePreset, dateFrom, dateTo]);

  const { data: recordings, isLoading } = useUserRecordings({
    courseId: courseFilter !== 'all' ? courseFilter : undefined,
    subjectId: subjectFilter !== 'all' ? subjectFilter : undefined,
    chapterId: chapterFilter !== 'all' ? chapterFilter : undefined,
    topicId: topicFilter !== 'all' ? topicFilter : undefined,
    dateFrom: effectiveDateRange.from,
    dateTo: effectiveDateRange.to,
    search: searchQuery,
  });
  
  const { data: courses } = useRecordingCourses();
  const { data: subjects } = useRecordingSubjects();
  const { data: chapters } = useRecordingChapters(subjectFilter !== 'all' ? subjectFilter : undefined);
  const { data: topics } = useRecordingTopics(chapterFilter !== 'all' ? chapterFilter : undefined);

  // Group recordings
  const groupedRecordings = useMemo(() => {
    if (!recordings) return {};
    
    if (groupBy === 'none') {
      return { 'All Recordings': recordings };
    }

    return recordings.reduce((groups, recording) => {
      let key = 'Other';
      
      switch (groupBy) {
        case 'subject':
          // Support both topic-based and class-based recordings
          key = (recording as any).subject?.name || 
                recording.scheduled_class?.subject || 
                'No Subject';
          break;
        case 'course':
          key = (recording as any).course?.name || 
                recording.scheduled_class?.course?.name || 
                'No Course';
          break;
        case 'date':
          const dateStr = recording.scheduled_class?.scheduled_at || recording.created_at;
          key = dateStr 
            ? format(new Date(dateStr), 'MMMM d, yyyy')
            : 'Unknown Date';
          break;
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(recording);
      return groups;
    }, {} as Record<string, typeof recordings>);
  }, [recordings, groupBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setCourseFilter('all');
    setSubjectFilter('all');
    setChapterFilter('all');
    setTopicFilter('all');
    setDatePreset('all');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = searchQuery || courseFilter !== 'all' || subjectFilter !== 'all' || chapterFilter !== 'all' || topicFilter !== 'all' || datePreset !== 'all' || dateFrom || dateTo;

  return (
    <div className="min-h-screen flex flex-col bg-background pb-20 md:pb-0">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <DashboardHeader />
      
      <main className="flex-1 container mx-auto px-4 py-4 md:py-8">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Video className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">My Recordings</h1>
              <p className="text-muted-foreground">
                Watch recorded class sessions at your convenience
              </p>
            </div>
          </div>
          {recordings && (
            <p className="text-sm text-muted-foreground mt-2">
              {recordings.length} recording{recordings.length !== 1 ? 's' : ''} available
            </p>
          )}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4 space-y-4">
            {/* Search and Primary Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search recordings by subject, course, or instructor..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses?.map(course => (
                    <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={subjectFilter} onValueChange={(v) => {
                setSubjectFilter(v);
                setChapterFilter('all');
                setTopicFilter('all');
              }}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects?.map(subject => (
                    <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {subjectFilter !== 'all' && chapters && chapters.length > 0 && (
                <Select value={chapterFilter} onValueChange={(v) => {
                  setChapterFilter(v);
                  setTopicFilter('all');
                }}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="All Chapters" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Chapters</SelectItem>
                    {chapters?.map(chapter => (
                      <SelectItem key={chapter.id} value={chapter.id}>
                        Ch {chapter.chapter_number}: {chapter.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {chapterFilter !== 'all' && topics && topics.length > 0 && (
                <Select value={topicFilter} onValueChange={setTopicFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="All Topics" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Topics</SelectItem>
                    {topics?.map(topic => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.topic_number}. {topic.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Date Filters */}
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-2">
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-4 w-4" />
                Date:
              </span>
              
              <div className="flex gap-1">
                {(['all', 'today', 'week', 'month'] as DatePreset[]).map((preset) => (
                  <Button
                    key={preset}
                    variant={datePreset === preset && !dateFrom ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setDatePreset(preset);
                      setDateFrom(undefined);
                      setDateTo(undefined);
                    }}
                  >
                    {preset === 'all' ? 'All Time' : preset.charAt(0).toUpperCase() + preset.slice(1)}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2 ml-0 sm:ml-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn(dateFrom && 'bg-primary/10')}>
                      {dateFrom ? format(dateFrom, 'MMM d') : 'From'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(date) => {
                        setDateFrom(date);
                        setDatePreset('all');
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">-</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn(dateTo && 'bg-primary/10')}>
                      {dateTo ? format(dateTo, 'MMM d') : 'To'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(date) => {
                        setDateTo(date);
                        setDatePreset('all');
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-0 sm:ml-auto w-full sm:w-auto">
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>

            {/* Group By */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 pt-2 border-t">
              <span className="text-sm text-muted-foreground">Group by:</span>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
                <SelectTrigger className="w-full sm:w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Grouping</SelectItem>
                  <SelectItem value="subject">Subject</SelectItem>
                  <SelectItem value="course">Course</SelectItem>
                  <SelectItem value="date">Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Recordings Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <Skeleton key={i} className="h-48 rounded-lg" />
            ))}
          </div>
        ) : !recordings || recordings.length === 0 ? (
          <Card className="py-16">
            <div className="text-center">
              <Video className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No recordings found</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {hasActiveFilters 
                  ? 'Try adjusting your filters to find more recordings.'
                  : 'Recorded class sessions will appear here once they are processed.'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedRecordings).map(([groupName, groupRecordings]) => (
              <div key={groupName}>
                {groupBy !== 'none' && (
                  <div className="flex items-center gap-2 mb-4">
                    {groupBy === 'subject' && <BookOpen className="h-5 w-5 text-primary" />}
                    {groupBy === 'course' && <Video className="h-5 w-5 text-primary" />}
                    {groupBy === 'date' && <CalendarIcon className="h-5 w-5 text-primary" />}
                    <h2 className="text-lg font-semibold">{groupName}</h2>
                    <Badge variant="secondary" className="ml-2">
                      {groupRecordings.length}
                    </Badge>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {groupRecordings.map((recording) => (
                    <RecordingCard 
                      key={recording.id} 
                      recording={recording} 
                      onClick={() => navigate(`/watch/${recording.id}`)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}

// Recording Card Component
function RecordingCard({ 
  recording, 
  onClick 
}: { 
  recording: any; 
  onClick: () => void;
}) {
  const { data: progress } = useVideoWatchProgress(recording.id);

  const watchPercentage = progress?.progress_percent || 0;
  const isCompleted = watchPercentage >= 90;

  return (
    <Card 
      className="overflow-hidden cursor-pointer group hover:shadow-lg transition-all hover:border-primary/50"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
        <Video className="h-12 w-12 text-primary/40 group-hover:scale-110 transition-transform" />
        
        {/* Duration Badge */}
        {recording.duration_seconds && (
          <Badge className="absolute bottom-2 right-2 bg-black/70 text-white">
            <Clock className="h-3 w-3 mr-1" />
            {formatDuration(recording.duration_seconds)}
          </Badge>
        )}

        {/* Play Overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
          <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity transform scale-90 group-hover:scale-100">
            <Play className="h-6 w-6 text-primary-foreground ml-1" />
          </div>
        </div>

        {/* Progress Bar */}
        {watchPercentage > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30">
            <div 
              className={cn(
                "h-full transition-all",
                isCompleted ? "bg-green-500" : "bg-primary"
              )}
              style={{ width: `${Math.min(watchPercentage, 100)}%` }}
            />
          </div>
        )}
      </div>

      <CardContent className="p-4">
        {/* Title - Support both types */}
        <h3 className="font-medium line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {(recording as any).recording_title || 
           (recording as any).topic?.title ||
           recording.scheduled_class?.subject || 
           'Untitled Recording'}
        </h3>

        {/* Subject for topic recordings */}
        {(recording as any).subject?.name && (
          <p className="text-sm text-muted-foreground line-clamp-1 mb-1">
            {(recording as any).subject.name}
          </p>
        )}

        {/* Course */}
        {((recording as any).course?.name || recording.scheduled_class?.course?.name) && (
          <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
            {(recording as any).course?.name || recording.scheduled_class?.course?.name}
          </p>
        )}

        {/* Meta Info */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {recording.scheduled_class?.teacher?.full_name && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {recording.scheduled_class.teacher.full_name}
            </span>
          )}
          {(recording.scheduled_class?.scheduled_at || recording.created_at) && (
            <span className="flex items-center gap-1">
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(recording.scheduled_class?.scheduled_at || recording.created_at!), 'MMM d')}
            </span>
          )}
        </div>

        {/* Quality Badges */}
        {recording.available_qualities && recording.available_qualities.length > 0 && (
          <div className="flex gap-1 mt-3 flex-wrap">
            {recording.available_qualities.slice(0, 3).map((q: string) => (
              <Badge key={q} variant="outline" className="text-xs px-1.5">
                {q}
              </Badge>
            ))}
            {recording.available_qualities.length > 3 && (
              <Badge variant="outline" className="text-xs px-1.5">
                +{recording.available_qualities.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Watch Status */}
        {watchPercentage > 0 && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            {isCompleted ? (
              <Badge variant="default" className="bg-green-500">
                Completed
              </Badge>
            ) : (
              <span className="text-muted-foreground">
                {Math.round(watchPercentage)}% watched
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
