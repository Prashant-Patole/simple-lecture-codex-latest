import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useClassRecordings, useVideoWatchProgress } from '@/hooks/useClassRecordings';
import { AdaptiveVideoPlayer } from '@/components/learning/AdaptiveVideoPlayer';
import { format, isThisWeek, isThisMonth } from 'date-fns';
import { 
  Video, 
  Play, 
  Calendar, 
  User, 
  Search, 
  BookOpen, 
  Clock,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface RecordingWithProgress {
  id: string;
  duration_seconds: number | null;
  available_qualities: string[] | null;
  processing_status: string | null;
  created_at: string | null;
  scheduled_class?: {
    id: string;
    scheduled_at: string;
    subject: string;
    course?: { id?: string; name: string } | null;
    teacher?: { id?: string; full_name: string } | null;
  } | null;
}

export const RecordingsTab = ({ courseId }: { courseId?: string }) => {
  const { data: recordings, isLoading } = useClassRecordings(courseId);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecording, setSelectedRecording] = useState<RecordingWithProgress | null>(null);
  const [filter, setFilter] = useState<'all' | 'week' | 'month'>('all');
  const navigate = useNavigate();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const allRecordings = (recordings || []) as unknown as RecordingWithProgress[];
  
  // Filter by time period
  const filteredByTime = allRecordings.filter(r => {
    if (filter === 'all') return true;
    const date = r.scheduled_class?.scheduled_at ? new Date(r.scheduled_class.scheduled_at) : null;
    if (!date) return true;
    if (filter === 'week') return isThisWeek(date);
    if (filter === 'month') return isThisMonth(date);
    return true;
  });

  // Filter by search
  const filteredRecordings = filteredByTime.filter(recording => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    const subjectName = recording.scheduled_class?.subject || '';
    const courseName = recording.scheduled_class?.course?.name || '';
    return (
      subjectName.toLowerCase().includes(search) ||
      courseName.toLowerCase().includes(search)
    );
  });

  // Group by subject
  const groupedBySubject = filteredRecordings.reduce((acc, recording) => {
    const subjectName = recording.scheduled_class?.subject || 'Other';
    if (!acc[subjectName]) acc[subjectName] = [];
    acc[subjectName].push(recording);
    return acc;
  }, {} as Record<string, RecordingWithProgress[]>);

  if (allRecordings.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-medium mb-2">No Recordings Available</h3>
        <p className="text-muted-foreground">
          Class recordings will appear here once they are processed.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search recordings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Grouped Recordings */}
      {Object.keys(groupedBySubject).length === 0 ? (
        <Card className="p-8 text-center">
          <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-medium mb-2">No Results</h3>
          <p className="text-muted-foreground">No recordings match your search.</p>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedBySubject).map(([subjectName, subjectRecordings]) => (
            <div key={subjectName}>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                {subjectName}
                <Badge variant="secondary" className="ml-2">{subjectRecordings.length}</Badge>
              </h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjectRecordings.map((recording) => (
                  <RecordingCard 
                    key={recording.id} 
                    recording={recording}
                    onWatch={() => navigate(`/watch/${recording.id}`, { state: { from: location.pathname } })}
                    onQuickWatch={() => setSelectedRecording(recording)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Player Dialog */}
      <Dialog open={!!selectedRecording} onOpenChange={(open) => !open && setSelectedRecording(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
          <DialogTitle>
            {selectedRecording?.scheduled_class?.subject || 'Recording'}
            </DialogTitle>
          </DialogHeader>
          {selectedRecording && (
            <div className="p-4 pt-2">
              <AdaptiveVideoPlayer
                recordingId={selectedRecording.id}
                title={selectedRecording.scheduled_class?.subject || 'Recording'}
                recordingData={selectedRecording as any}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Recording Card with Progress
const RecordingCard = ({ 
  recording,
  onWatch,
  onQuickWatch
}: { 
  recording: RecordingWithProgress;
  onWatch: () => void;
  onQuickWatch: () => void;
}) => {
  const { data: progress } = useVideoWatchProgress(recording.id);
  
  const subjectName = recording.scheduled_class?.subject || 'Class';
  const courseName = recording.scheduled_class?.course?.name || '';
  const teacherName = (recording.scheduled_class?.teacher as any)?.full_name || '';
  const scheduledAt = recording.scheduled_class?.scheduled_at;
  const isReady = recording.processing_status === 'ready';
  const isProcessing = recording.processing_status === 'processing';

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins} min`;
  };

  const watchPercentage = progress?.progress_percent || 0;
  const isCompleted = progress?.completed || false;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow group">
      <div className="aspect-video bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative">
        <Video className="h-8 w-8 sm:h-12 sm:w-12 text-primary/50" />
        
        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          {isReady && (
            <Badge className="bg-green-500/90 text-white">
              <Play className="h-3 w-3 mr-1" />
              Ready
            </Badge>
          )}
          {isProcessing && (
            <Badge className="bg-primary/90 text-white">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Processing
            </Badge>
          )}
          {!isReady && !isProcessing && (
            <Badge variant="secondary">
              <Clock className="h-3 w-3 mr-1" />
              Pending
            </Badge>
          )}
        </div>

        {/* Duration Badge */}
        {recording.duration_seconds && (
          <div className="absolute bottom-2 right-2">
            <Badge variant="secondary" className="bg-black/60 text-white">
              {formatDuration(recording.duration_seconds)}
            </Badge>
          </div>
        )}

        {/* Completed Indicator */}
        {isCompleted && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-green-500 text-white">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Watched
            </Badge>
          </div>
        )}

        {/* Play Overlay */}
        {isReady && (
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button size="lg" className="rounded-full" onClick={onQuickWatch}>
              <Play className="h-6 w-6" />
            </Button>
          </div>
        )}
      </div>

      <CardContent className="p-3 sm:p-4">
        <h3 className="font-semibold mb-1 line-clamp-1">{subjectName}</h3>
        <p className="text-sm text-muted-foreground mb-3 line-clamp-1">{courseName}</p>
        
        <div className="space-y-1 text-sm text-muted-foreground mb-3">
          {scheduledAt && (
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(scheduledAt), "MMM d, yyyy")}
            </div>
          )}
          {teacherName && (
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              {teacherName}
            </div>
          )}
        </div>

        {/* Watch Progress */}
        {watchPercentage > 0 && !isCompleted && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{Math.round(watchPercentage)}%</span>
            </div>
            <Progress value={watchPercentage} className="h-1.5" />
          </div>
        )}

        {/* Quality Badges */}
        {recording.available_qualities && recording.available_qualities.length > 0 && (
          <div className="hidden sm:flex gap-1 mb-3 flex-wrap">
            {(recording.available_qualities as string[]).map(q => (
              <Badge key={q} variant="outline" className="text-xs">{q}</Badge>
            ))}
          </div>
        )}

        {/* Action Button */}
        {isReady ? (
          <Button className="w-full" onClick={onWatch}>
            <Play className="h-4 w-4 mr-2" />
            {watchPercentage > 0 && !isCompleted ? 'Continue Watching' : 'Watch Recording'}
          </Button>
        ) : (
          <Button className="w-full" variant="outline" disabled>
            <Clock className="h-4 w-4 mr-2" />
            {isProcessing ? 'Processing...' : 'Coming Soon'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
