import { useState } from "react";
import { PlayCircle, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface VideoPreviewProps {
  platform: string;
  videoId: string;
}

export function VideoPreview({ platform, videoId }: VideoPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!platform || !videoId) return null;

  const getEmbedUrl = () => {
    if (platform === "youtube") {
      return `https://www.youtube.com/embed/${videoId}`;
    } else if (platform === "vimeo") {
      return `https://player.vimeo.com/video/${videoId}`;
    }
    return "";
  };

  const getExternalUrl = () => {
    if (platform === "youtube") {
      return `https://www.youtube.com/watch?v=${videoId}`;
    } else if (platform === "vimeo") {
      return `https://vimeo.com/${videoId}`;
    }
    return "";
  };

  const embedUrl = getEmbedUrl();
  const externalUrl = getExternalUrl();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Preview video"
            >
              <PlayCircle className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="space-y-2">
              <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
                <iframe
                  src={embedUrl}
                  title="Video preview"
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Close Preview
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => window.open(externalUrl, "_blank")}
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
