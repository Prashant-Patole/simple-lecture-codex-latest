import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdaptiveVideoPlayer } from '@/components/learning/AdaptiveVideoPlayer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Calendar, User, Clock, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import { BottomNav } from '@/components/mobile/BottomNav';

export default function WatchRecording() {
  const { recordingId } = useParams<{ recordingId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoBack = () => {
    // Strategy 1: Use passed referrer path if available
    const referrer = (location.state as any)?.from;
    if (referrer && typeof referrer === 'string' && referrer.startsWith('/')) {
      navigate(referrer);
      return;
    }
    
    // Strategy 2: Check if we came from the same site
    if (document.referrer && document.referrer.includes(window.location.host)) {
      navigate(-1);
      return;
    }
    
    // Strategy 3: Default fallback to recordings list
    navigate('/recordings');
  };

  const { data: recording, isLoading, error } = useQuery({
    queryKey: ['recording', recordingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_recordings')
        .select(`
          id,
          duration_seconds,
          available_qualities,
          default_quality,
          processing_status,
          b2_original_path,
          b2_hls_360p_path,
          b2_hls_480p_path,
          b2_hls_720p_path,
          b2_hls_1080p_path,
          cdn_base_url,
          bunny_video_guid,
          scheduled_class:scheduled_classes(
            id,
            scheduled_at,
            subject:popular_subjects(id, name),
            course:courses(id, name),
            teacher:teacher_profiles(id, full_name)
          )
        `)
        .eq('id', recordingId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!recordingId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-10 w-32 mb-6" />
        <Skeleton className="aspect-video w-full max-w-5xl mx-auto" />
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-lg font-medium mb-4">Recording not found</p>
            <Button onClick={handleGoBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const scheduledClass = recording.scheduled_class as any;
  const subjectName = scheduledClass?.subject?.name || 'Class Recording';
  const courseName = scheduledClass?.course?.name || '';
  const teacherName = scheduledClass?.teacher?.full_name || '';
  const scheduledAt = scheduledClass?.scheduled_at;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins} min`;
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0 bg-background">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleGoBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold truncate">{subjectName}</h1>
              <p className="text-sm text-muted-foreground truncate">{courseName}</p>
            </div>
            {recording.available_qualities && (
              <div className="hidden sm:flex gap-1">
                {(recording.available_qualities as string[]).map(q => (
                  <Badge key={q} variant="outline" className="text-xs">{q}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4 md:py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Video Player */}
          {['ready', 'uploaded'].includes(recording.processing_status || '') ? (
            <AdaptiveVideoPlayer
              recordingId={recording.id}
              title={subjectName}
              recordingData={recording}
            />
          ) : (
            <Card className="aspect-video flex items-center justify-center bg-muted">
              <div className="text-center">
                <p className="text-lg font-medium mb-2">Recording Processing</p>
                <p className="text-muted-foreground">
                  This recording is still being processed. Please check back later.
                </p>
              </div>
            </Card>
          )}

          {/* Recording Details */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Subject</p>
                    <p className="font-medium">{subjectName}</p>
                  </div>
                </div>
                {teacherName && (
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Instructor</p>
                      <p className="font-medium">{teacherName}</p>
                    </div>
                  </div>
                )}
                {scheduledAt && (
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10">
                      <Calendar className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Recorded On</p>
                      <p className="font-medium">{format(new Date(scheduledAt), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                )}
                {recording.duration_seconds && (
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-medium">{formatDuration(recording.duration_seconds)}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
