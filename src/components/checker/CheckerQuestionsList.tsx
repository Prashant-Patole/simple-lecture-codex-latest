import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MathpixRenderer } from "@/components/admin/MathpixRenderer";
import { CheckCircle, HelpCircle } from "lucide-react";
import { useCheckerReviews } from "@/hooks/useCheckerReviews";
import { CheckerReviewPanel } from "@/components/checker/CheckerReviewPanel";
import { useMemo } from "react";

interface CheckerQuestionsListProps {
  topicId?: string;
  chapterId?: string;
  chapterOnly?: boolean;
}

export const CheckerQuestionsList = ({ topicId, chapterId, chapterOnly }: CheckerQuestionsListProps) => {
  const { data: questions, isLoading } = useQuery({
    queryKey: ["checker-questions", topicId, chapterId, chapterOnly],
    queryFn: async () => {
      let query = supabase
        .from("questions")
        .select("id, question_text, question_type, question_format, options, correct_answer, explanation, marks, difficulty, is_verified, topic_id, chapter_id")
        .order("created_at", { ascending: true });

      if (topicId) {
        query = query.eq("topic_id", topicId);
      } else if (chapterId) {
        const { data: topics } = await supabase
          .from("subject_topics")
          .select("id")
          .eq("chapter_id", chapterId);
        
        const topicIds = topics?.map(t => t.id) || [];
        if (topicIds.length > 0) {
          query = query.or(`topic_id.in.(${topicIds.join(",")}),chapter_id.eq.${chapterId}`);
        } else {
          query = query.eq("chapter_id", chapterId);
        }
      }

      query = query.limit(200);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!(topicId || chapterId),
    staleTime: 60000,
  });

  const questionIds = useMemo(() => (questions || []).map(q => q.id), [questions]);
  const { data: questionReviews } = useCheckerReviews("question", questionIds);
  const getReview = (id: string) => questionReviews?.find(r => r.entity_id === id);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
      </div>
    );
  }

  if (!questions?.length) {
    return (
      <div className="text-center py-12">
        <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-lg font-semibold mb-1">No Questions Found</h3>
        <p className="text-sm text-muted-foreground">No questions available for this {topicId ? "topic" : "chapter"}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Questions ({questions.length})</h3>
      </div>
      {questions.map((q, idx) => {
        const review = getReview(q.id);
        return (
          <div key={q.id} className="space-y-0">
            <Card className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <span className="font-semibold text-sm text-muted-foreground mr-2">Q{idx + 1}.</span>
                    <MathpixRenderer mmdText={q.question_text || ""} inline className="inline" />
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {review?.is_approved && (
                      <Badge className="text-[10px] bg-green-600 text-white">
                        <CheckCircle className="h-2.5 w-2.5 mr-0.5" />Approved
                      </Badge>
                    )}
                    {q.difficulty && (
                      <Badge variant={q.difficulty === "hard" ? "destructive" : q.difficulty === "medium" ? "default" : "secondary"} className="text-[10px]">
                        {q.difficulty}
                      </Badge>
                    )}
                    {q.question_format && (
                      <Badge variant="outline" className="text-[10px]">{q.question_format}</Badge>
                    )}
                    {q.is_verified && (
                      <Badge variant="default" className="text-[10px] bg-green-600"><CheckCircle className="h-2.5 w-2.5 mr-0.5" />Verified</Badge>
                    )}
                  </div>
                </div>

                {/* Options for MCQ */}
                {q.options && typeof q.options === "object" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
                    {Object.entries(q.options as Record<string, unknown>).map(([key, value]) => {
                      const isCorrect = q.correct_answer?.toUpperCase() === key.toUpperCase();
                      const optionText = typeof value === 'object' && value !== null ? (value as any).text || '' : String(value);
                      return (
                        <div
                          key={key}
                          className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                            isCorrect ? "bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700" : "bg-muted/50"
                          }`}
                        >
                          <span className="font-semibold">{key}.</span>
                          <span className="flex-1">
                            <MathpixRenderer mmdText={optionText} inline className="inline" />
                          </span>
                          {isCorrect && <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Correct answer for non-MCQ */}
                {(!q.options || Object.keys(q.options as any).length === 0) && q.correct_answer && (
                  <div className="pl-4">
                    <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 p-2 rounded-lg text-sm inline-flex items-center gap-2">
                      <span className="font-semibold">Answer:</span>
                      <MathpixRenderer mmdText={q.correct_answer} inline className="inline" />
                    </div>
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div className="pl-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                    <strong>Explanation:</strong> <MathpixRenderer mmdText={q.explanation} inline className="inline" />
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Checker Review Panel below each question */}
            <CheckerReviewPanel
              entityType="question"
              entityId={q.id}
              existingComment={review?.comment || ""}
              isApproved={review?.is_approved || false}
            />
          </div>
        );
      })}
    </div>
  );
};
