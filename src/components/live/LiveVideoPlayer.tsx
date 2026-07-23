import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Radio, X } from "lucide-react";
import { extractYouTubeVideoId, getYouTubeEmbedUrl, isYouTubeUrl } from "@/utils/videoUtils";

interface LiveVideoPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  meetingLink: string;
  title: string;
  courseName: string;
  instructorName?: string;
  isLive?: boolean;
}

export const LiveVideoPlayer = ({
  isOpen,
  onClose,
  meetingLink,
  title,
  courseName,
  instructorName,
  isLive = false,
}: LiveVideoPlayerProps) => {
  const videoId = extractYouTubeVideoId(meetingLink);
  const embedUrl = videoId ? getYouTubeEmbedUrl(videoId, true) : null;
  const isYouTube = isYouTubeUrl(meetingLink);

  // Handle non-YouTube links
  if (!embedUrl || !isYouTube) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unable to Embed Video</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            This meeting link cannot be embedded in the app. Please contact your instructor for access.
          </p>
          <Button onClick={onClose}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl p-0 overflow-hidden max-h-[95vh]">
        <DialogHeader className="px-4 py-2 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {isLive && (
              <Badge variant="destructive" className="animate-pulse">
                <Radio className="h-2.5 w-2.5 mr-1" />
                LIVE
              </Badge>
            )}
            <DialogTitle className="text-base">{title}</DialogTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
            <X className="h-3.5 w-3.5" />
          </Button>
        </DialogHeader>
        
        <div className="px-4 pb-3 space-y-3">
          {/* Video Player - URL is hidden from users with overlay to hide YouTube buttons */}
          <div className="relative bg-black rounded-lg overflow-hidden h-[750px]">
            {/* Full transparent overlay to block all YouTube interaction */}
            <div className="absolute inset-0 z-20 cursor-default" />
            {/* Overlay to hide YouTube's top-right buttons (Share, Watch Later, etc.) */}
            <div className="absolute top-0 right-0 w-[150px] h-[50px] bg-black z-10 pointer-events-none" />
            {/* Overlay to hide "More videos" section at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[60px] bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full border-0"
              style={{ border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              title={title}
            />
          </div>

          {/* Class Info */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{courseName}</p>
              {instructorName && (
                <p className="text-xs text-muted-foreground">
                  Instructor: {instructorName}
                </p>
              )}
            </div>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
