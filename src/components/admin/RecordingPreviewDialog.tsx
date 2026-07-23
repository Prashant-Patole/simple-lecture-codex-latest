import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdaptiveVideoPlayer } from '@/components/learning/AdaptiveVideoPlayer';
import { format } from 'date-fns';
import { Clock, User, BookOpen, Calendar, HardDrive, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RecordingPreviewDialogProps {
  recording: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatDuration = (seconds: number | null) => {
  if (!seconds) return '-';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins} min`;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export function RecordingPreviewDialog({ recording, open, onOpenChange }: RecordingPreviewDialogProps) {
  const navigate = useNavigate();

  if (!recording) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Recording Preview
            {recording.processing_status === 'ready' && (
              <Badge className="bg-green-500/20 text-green-700">Ready</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Video Player */}
          {recording.processing_status === 'ready' ? (
            <div className="rounded-lg overflow-hidden">
              <AdaptiveVideoPlayer
                recordingId={recording.id}
                title={recording.scheduled_class?.subject || 'Recording'}
                recordingData={recording}
              />
            </div>
          ) : (
            <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground">Video not ready</p>
                <p className="text-sm text-muted-foreground">Status: {recording.processing_status}</p>
              </div>
            </div>
          )}

          {/* Recording Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Subject</p>
                <p className="text-sm font-medium">{recording.scheduled_class?.subject || '-'}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Instructor</p>
                <p className="text-sm font-medium">{recording.scheduled_class?.teacher?.full_name || '-'}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm font-medium">
                  {recording.scheduled_class?.scheduled_at 
                    ? format(new Date(recording.scheduled_class.scheduled_at), 'MMM d, yyyy')
                    : '-'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-medium">{formatDuration(recording.duration_seconds)}</p>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <p className="text-xs text-muted-foreground">Course</p>
              <p className="text-sm font-medium">{recording.scheduled_class?.course?.name || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">File Size</p>
              <p className="text-sm font-medium">{formatFileSize(recording.file_size_bytes)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Available Qualities</p>
              <div className="flex gap-1 mt-1 flex-wrap">
                {recording.available_qualities?.map((q: string) => (
                  <Badge key={q} variant="outline" className="text-xs">{q}</Badge>
                )) || '-'}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Default Quality</p>
              <p className="text-sm font-medium">{recording.default_quality || '-'}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={() => {
              onOpenChange(false);
              navigate(`/watch/${recording.id}`);
            }}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Full Player
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
