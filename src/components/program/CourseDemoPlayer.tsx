import { useState } from 'react';
import { Play, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCourseDemoVideo } from '@/hooks/useCourseDemoVideo';
import { usePresentationReview } from '@/hooks/useVideoGenerationJobs';
import { EducationalVideoPlayer } from '@/components/learning/player/EducationalVideoPlayer';
import { getAdminMediaUrl } from '@/components/learning/player/utils/mediaResolver';

interface CourseDemoPlayerProps {
  courseId: string;
  courseName?: string;
}

export const CourseDemoPlayer = ({ courseId, courseName }: CourseDemoPlayerProps) => {
  const { data: demo } = useCourseDemoVideo(courseId);
  const [started, setStarted] = useState(false);

  const {
    data: presentationData,
    isLoading,
    isError,
    error,
  } = usePresentationReview(started ? demo?.external_job_id ?? null : null, demo?.server_ip);

  if (!demo) return null;

  return (
    <section className="container mx-auto px-4 py-6 md:py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Watch a Free Demo
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Preview a sample lecture from {courseName || 'this course'} before you enroll.
            </p>
          </div>
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white">DEMO</Badge>
        </div>

        <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-background shadow-lg">
          {!started && (
            <button
              type="button"
              onClick={() => setStarted(true)}
              className="group absolute inset-0 flex items-center justify-center hover:bg-black/5 transition-colors"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 md:h-20 md:w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                  <Play className="h-8 w-8 md:h-10 md:w-10 ml-1 fill-current" />
                </div>
                <p className="text-sm md:text-base font-medium text-foreground">
                  {demo.document_name || 'Demo Lecture'}
                </p>
                <p className="text-xs text-muted-foreground">Click to play</p>
              </div>
            </button>
          )}

          {started && isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading demo...</p>
              </div>
            </div>
          )}

          {started && isError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-destructive px-4">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Failed to load demo</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
            </div>
          )}

          {started && presentationData?.sections?.length ? (
            <EducationalVideoPlayer
              presentationData={presentationData}
              jobId={demo.external_job_id}
              getMediaUrl={getAdminMediaUrl}
              serverIp={demo.server_ip}
              courseId={courseId}
              topicTitle={demo.document_name || 'Demo'}
              className="absolute inset-0 h-full w-full"
              skipPreIntro
              onClose={() => setStarted(false)}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
};
