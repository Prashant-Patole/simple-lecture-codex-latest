import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToggleLiveStatus } from '@/hooks/useToggleLiveStatus';
import { useAddRecording } from '@/hooks/useAddRecording';
import { useBBBMeeting, useBBBMeetingInfo } from '@/hooks/useBBBMeeting';
import { useBBBConfigured } from '@/hooks/useBBBSettings';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Radio, Video, VideoOff, Link as LinkIcon, Check, Users, Loader2 } from 'lucide-react';

interface ScheduledClassForControls {
  id: string;
  is_live?: boolean;
  subject_name?: string;
  course_name?: string;
  scheduled_at?: string;
  recording_url?: string | null;
  bbb_meeting_id?: string | null;
}

interface InstructorLiveControlsProps {
  scheduledClass: ScheduledClassForControls;
  onStatusChange?: () => void;
}

export const InstructorLiveControls = ({ scheduledClass, onStatusChange }: InstructorLiveControlsProps) => {
  const toggleLive = useToggleLiveStatus();
  const addRecording = useAddRecording();
  const { isConfigured: isBBBConfigured } = useBBBConfigured();
  const { createMeeting, endMeeting, joinMeeting } = useBBBMeeting();
  const { data: meetingInfo } = useBBBMeetingInfo(scheduledClass.id);
  const { data: currentUser } = useCurrentUser();
  
  const [recordingUrl, setRecordingUrl] = useState('');
  const [isRecordingDialogOpen, setIsRecordingDialogOpen] = useState(false);

  const handleToggleLive = () => {
    toggleLive.mutate(
      { scheduledClassId: scheduledClass.id, isLive: !scheduledClass.is_live },
      { onSuccess: onStatusChange }
    );
  };

  const handleStartBBBMeeting = async () => {
    await createMeeting.mutateAsync({
      scheduledClassId: scheduledClass.id,
      meetingName: scheduledClass.subject_name || 'Live Class',
    });
    onStatusChange?.();
  };

  const handleEndBBBMeeting = async () => {
    await endMeeting.mutateAsync(scheduledClass.id);
    onStatusChange?.();
  };

  const handleJoinAsModerator = async () => {
    const joinUrl = await joinMeeting.mutateAsync({
      scheduledClassId: scheduledClass.id,
      role: 'moderator',
      fullName: currentUser?.profile?.full_name || currentUser?.email || 'Instructor',
    });
    window.open(joinUrl, '_blank');
  };

  const handleAddRecording = () => {
    if (!recordingUrl.trim()) return;
    addRecording.mutate(
      { scheduledClassId: scheduledClass.id, recordingUrl: recordingUrl.trim() },
      { 
        onSuccess: () => {
          setRecordingUrl('');
          setIsRecordingDialogOpen(false);
          onStatusChange?.();
        }
      }
    );
  };

  const isLive = scheduledClass.is_live;
  const hasRecording = !!scheduledClass.recording_url;
  const hasBBBMeeting = !!scheduledClass.bbb_meeting_id;

  return (
    <Card className={`transition-all ${isLive ? 'border-red-500 border-2' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{scheduledClass.subject_name || 'Class'}</CardTitle>
          {isLive && (
            <Badge variant="destructive" className="animate-pulse flex items-center gap-1">
              <Radio className="h-3 w-3" />
              LIVE
              {meetingInfo?.participantCount !== undefined && (
                <span className="ml-1 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {meetingInfo.participantCount}
                </span>
              )}
            </Badge>
          )}
          {hasRecording && !isLive && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Video className="h-3 w-3" />
              Recording Added
            </Badge>
          )}
        </div>
        {scheduledClass.course_name && (
          <p className="text-sm text-muted-foreground">{scheduledClass.course_name}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {/* BBB Controls (if configured) */}
        {isBBBConfigured ? (
          <>
            {!isLive ? (
              <Button
                variant="default"
                className="w-full"
                onClick={handleStartBBBMeeting}
                disabled={createMeeting.isPending}
              >
                {createMeeting.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Radio className="h-4 w-4 mr-2" />
                )}
                Start BBB Meeting
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleJoinAsModerator}
                  disabled={joinMeeting.isPending}
                >
                  <Video className="h-4 w-4 mr-2" />
                  Join as Moderator
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleEndBBBMeeting}
                  disabled={endMeeting.isPending}
                >
                  {endMeeting.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <VideoOff className="h-4 w-4 mr-2" />
                  )}
                  End Meeting
                </Button>
              </>
            )}
          </>
        ) : (
          /* Fallback: Simple Toggle */
          <Button
            variant={isLive ? 'destructive' : 'default'}
            className="w-full"
            onClick={handleToggleLive}
            disabled={toggleLive.isPending}
          >
            {isLive ? (
              <>
                <VideoOff className="h-4 w-4 mr-2" />
                End Live Class
              </>
            ) : (
              <>
                <Radio className="h-4 w-4 mr-2" />
                Go Live
              </>
            )}
          </Button>
        )}

        {/* Add Recording Button (only show if not live) */}
        {!isLive && (
          <Dialog open={isRecordingDialogOpen} onOpenChange={setIsRecordingDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <LinkIcon className="h-4 w-4 mr-2" />
                {hasRecording ? 'Update Recording' : 'Add Recording'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Recording Link</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recording-url">Recording URL</Label>
                  <Input
                    id="recording-url"
                    placeholder="https://youtube.com/watch?v=..."
                    value={recordingUrl}
                    onChange={(e) => setRecordingUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste a YouTube, Vimeo, or Google Drive link
                  </p>
                </div>
                {scheduledClass.recording_url && (
                  <div className="text-sm text-muted-foreground">
                    Current: <a href={scheduledClass.recording_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">View Recording</a>
                  </div>
                )}
                <Button
                  onClick={handleAddRecording}
                  disabled={!recordingUrl.trim() || addRecording.isPending}
                  className="w-full"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save Recording
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};
