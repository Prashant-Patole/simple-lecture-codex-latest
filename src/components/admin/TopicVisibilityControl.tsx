import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import {
  useTopicLectureVisibility,
  useSetTopicLectureVisibility,
  type TopicVisibilityMode,
} from "@/hooks/useTopicLectureVisibility";
import { usePublishedAILectures } from "@/hooks/usePublishedAILectures";

interface Props {
  topicId: string;
}

export const TopicVisibilityControl = ({ topicId }: Props) => {
  const { data: lectures } = usePublishedAILectures(topicId, undefined, { skipVisibilityFilter: true });
  const { data: mode = "both" } = useTopicLectureVisibility(topicId);
  const setMode = useSetTopicLectureVisibility();

  const hasMarketing = (lectures || []).some((l) => l.is_marketing);
  const hasNormal = (lectures || []).some((l) => !l.is_marketing);

  // Only show control when topic has at least one marketing lecture
  if (!hasMarketing) return null;

  return (
    <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
      <Eye className="h-4 w-4 text-muted-foreground" />
      <Label className="text-xs whitespace-nowrap">Student visibility:</Label>
      <Select
        value={mode}
        onValueChange={(v) => {
          setMode.mutate(
            { topicId, mode: v as TopicVisibilityMode },
            {
              onSuccess: () => toast.success("Visibility updated"),
              onError: (e: any) => toast.error(e?.message || "Failed to update"),
            }
          );
        }}
      >
        <SelectTrigger className="w-[220px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-background z-50">
          <SelectItem value="both">Show both cards</SelectItem>
          <SelectItem value="hide_marketing" disabled={!hasNormal}>
            Hide marketing card
          </SelectItem>
          <SelectItem value="hide_lecture" disabled={!hasNormal}>
            Hide lecture card
          </SelectItem>
        </SelectContent>
      </Select>
      {!hasNormal && (
        <span className="text-[10px] text-muted-foreground">
          (only marketing published)
        </span>
      )}
    </div>
  );
};
