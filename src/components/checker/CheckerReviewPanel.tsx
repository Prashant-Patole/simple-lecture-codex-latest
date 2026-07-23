import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Save, Loader2 } from "lucide-react";
import { useSaveCheckerReview, useApproveEntity } from "@/hooks/useCheckerReviews";

interface CheckerReviewPanelProps {
  entityType: "lecture" | "question";
  entityId: string;
  existingComment?: string;
  isApproved?: boolean;
}

export const CheckerReviewPanel = ({
  entityType,
  entityId,
  existingComment = "",
  isApproved = false,
}: CheckerReviewPanelProps) => {
  const [comment, setComment] = useState(existingComment);
  const saveReview = useSaveCheckerReview();
  const approveEntity = useApproveEntity();

  useEffect(() => {
    setComment(existingComment);
  }, [existingComment]);

  return (
    <div className="space-y-3 p-4 bg-muted/30 border rounded-xl">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-muted-foreground">Checker Review</span>
        {isApproved && (
          <Badge className="bg-green-600 text-white text-[10px]">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )}
      </div>
      <Textarea
        placeholder="Leave a comment for this item..."
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        className="min-h-[100px] resize-y"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={saveReview.isPending}
          onClick={() =>
            saveReview.mutate({ entityType, entityId, comment })
          }
        >
          {saveReview.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <Save className="h-3.5 w-3.5 mr-1" />
          )}
          Save Comment
        </Button>
        <Button
          size="sm"
          variant={isApproved ? "default" : "outline"}
          className={isApproved ? "bg-green-600 hover:bg-green-700" : ""}
          disabled={approveEntity.isPending}
          onClick={() =>
            approveEntity.mutate({
              entityType,
              entityId,
              approve: !isApproved,
            })
          }
        >
          {approveEntity.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
          ) : (
            <CheckCircle className="h-3.5 w-3.5 mr-1" />
          )}
          {isApproved ? "Approved" : "Approve"}
        </Button>
      </div>
    </div>
  );
};
