import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Trash2, Play, Plus } from "lucide-react";
import { VideoPreview } from "./VideoPreview";
import { 
  useTopicVideos, 
  useCreateTopicVideo, 
  useDeleteTopicVideo,
  INDIAN_LANGUAGES,
  TopicVideo 
} from "@/hooks/useTopicVideos";

interface TopicVideosManagerProps {
  topicId: string;
}

export const TopicVideosManager = ({ topicId }: TopicVideosManagerProps) => {
  const { data: videos = [], isLoading } = useTopicVideos(topicId);
  const createVideo = useCreateTopicVideo();
  const deleteVideo = useDeleteTopicVideo();

  const [selectedLanguage, setSelectedLanguage] = useState('english');
  const [newVideo, setNewVideo] = useState({
    video_name: '',
    video_platform: 'youtube' as 'youtube' | 'vimeo',
    video_id: '',
    description: '',
  });
  const [previewVideo, setPreviewVideo] = useState<{ platform: string; id: string } | null>(null);

  const videosByLanguage = videos.reduce((acc, video) => {
    if (!acc[video.language]) acc[video.language] = [];
    acc[video.language].push(video);
    return acc;
  }, {} as Record<string, TopicVideo[]>);

  const handleAddVideo = () => {
    if (!newVideo.video_name || !newVideo.video_id) return;

    createVideo.mutate({
      topic_id: topicId,
      language: selectedLanguage,
      video_name: newVideo.video_name,
      video_platform: newVideo.video_platform,
      video_id: newVideo.video_id,
      description: newVideo.description || null,
      display_order: videosByLanguage[selectedLanguage]?.length || 0,
      is_active: true,
    }, {
      onSuccess: () => {
        setNewVideo({
          video_name: '',
          video_platform: 'youtube',
          video_id: '',
          description: '',
        });
      }
    });
  };

  const handleDeleteVideo = (videoId: string) => {
    deleteVideo.mutate({ id: videoId, topicId });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading videos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Topic Videos (Multi-Language)</h4>
      </div>

      {/* Add New Video Form */}
      <Card className="p-4 space-y-3 bg-muted/30">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Language</Label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_LANGUAGES.map(lang => (
                  <SelectItem key={lang.value} value={lang.value}>
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Video Name *</Label>
            <Input
              className="h-8 text-xs"
              value={newVideo.video_name}
              onChange={(e) => setNewVideo({ ...newVideo, video_name: e.target.value })}
              placeholder="e.g., Introduction to Chapter"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Platform</Label>
            <Select 
              value={newVideo.video_platform} 
              onValueChange={(val) => setNewVideo({ ...newVideo, video_platform: val as 'youtube' | 'vimeo' })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="youtube">YouTube</SelectItem>
                <SelectItem value="vimeo">Vimeo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Video ID *</Label>
            <div className="flex gap-1">
              <Input
                className="h-8 text-xs flex-1"
                value={newVideo.video_id}
                onChange={(e) => setNewVideo({ ...newVideo, video_id: e.target.value })}
                placeholder="Video ID"
              />
              {newVideo.video_id && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => setPreviewVideo({ platform: newVideo.video_platform, id: newVideo.video_id })}
                >
                  <Play className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <Button 
          type="button" 
          size="sm" 
          onClick={handleAddVideo}
          disabled={!newVideo.video_name || !newVideo.video_id || createVideo.isPending}
          className="w-full"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Video
        </Button>
      </Card>

      {/* Videos by Language */}
      <Tabs value={selectedLanguage} onValueChange={setSelectedLanguage} className="w-full">
        <TabsList className="w-full flex-wrap h-auto">
          {INDIAN_LANGUAGES.filter(lang => videosByLanguage[lang.value]?.length > 0).map(lang => (
            <TabsTrigger key={lang.value} value={lang.value} className="text-xs">
              {lang.label} ({videosByLanguage[lang.value]?.length || 0})
            </TabsTrigger>
          ))}
        </TabsList>

        {INDIAN_LANGUAGES.map(lang => (
          <TabsContent key={lang.value} value={lang.value} className="space-y-2">
            {videosByLanguage[lang.value]?.length > 0 ? (
              videosByLanguage[lang.value].map((video) => (
                <Card key={video.id} className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{video.video_name}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          ({video.video_platform})
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        ID: {video.video_id}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => setPreviewVideo({ platform: video.video_platform || 'youtube', id: video.video_id })}
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteVideo(video.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              <div className="text-center py-6 text-sm text-muted-foreground">
                No videos added for {lang.label} yet
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Video Preview */}
      {previewVideo && (
        <div className="mt-4 p-4 border rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-medium">Video Preview</h5>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPreviewVideo(null)}
            >
              Close
            </Button>
          </div>
          <VideoPreview
            platform={previewVideo.platform}
            videoId={previewVideo.id}
          />
        </div>
      )}
    </div>
  );
};
