import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAllQuestions } from "@/hooks/useAllQuestions";
import { MathpixRenderer } from "@/components/admin/MathpixRenderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, List, ArrowRight, Send, CheckCircle, XCircle, Loader2, Camera, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { stripInlineOptions } from "@/lib/stripInlineOptions";
import { refreshLearningResults } from "@/lib/refreshLearningResults";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QuestionsTabProps {
  topicId?: string;
  chapterId?: string;
  chapterOnly?: boolean;
  subjectId?: string;
}

const difficultyColors: Record<string, string> = {
  Low: "bg-green-100 text-green-800 border-green-200",
  Medium: "bg-primary/10 text-primary border-primary/30",
  Intermediate: "bg-yellow-100 text-yellow-800 border-yellow-200",
  Advanced: "bg-red-100 text-red-800 border-red-200",
};

/** Extract display text from option value which may be string or {text: string} */
function getOptionText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "text" in (value as Record<string, unknown>)) {
    return String((value as Record<string, string>).text || "");
  }
  return String(value || "");
}

function hasValidOptions(options: unknown): options is Record<string, unknown> {
  return !!options && typeof options === "object" && Object.keys(options).length > 0;
}

function isMCQ(q: any): boolean {
  const fmt = (q.question_format || "").toLowerCase();
  const typ = (q.question_type || "").toLowerCase();
  const hasMCQFormat = ["mcq", "single_choice", "multiple_choice"].includes(fmt) || ["mcq", "single_choice", "multiple_choice"].includes(typ);
  return hasMCQFormat || hasValidOptions(q.options);
}

export const QuestionsTab = ({ topicId, chapterId, chapterOnly, subjectId }: QuestionsTabProps) => {
  const { data: questions, isLoading } = useAllQuestions(topicId, chapterId, chapterOnly);
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewAll, setViewAll] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [uploadedImages, setUploadedImages] = useState<Record<string, { file: File; previewUrl: string }>>({});
  const [extractingImages, setExtractingImages] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const startedAtRef = useRef<number | null>(null);
  const [results, setResults] = useState<{
    score: number;
    total: number;
    totalMarks: number;
    scoredMarks: number;
    details: Record<string, { correct: boolean; feedback: string; marksAwarded: number }>;
    pendingCount: number;
  } | null>(null);

  // Start the timer on first user interaction with any answer input
  const markStarted = () => {
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
  };

  // Reset all per-question state when the topic/chapter scope changes
  useEffect(() => {
    setUploadedImages(prev => {
      Object.values(prev).forEach(img => {
        try { URL.revokeObjectURL(img.previewUrl); } catch {}
      });
      return {};
    });
    setSelectedAnswers({});
    setExtractingImages({});
    setSubmitted(false);
    setResults(null);
    setCurrentIndex(0);
    setViewAll(false);
    setIsSubmitting(false);
    startedAtRef.current = null;
  }, [topicId, chapterId, chapterOnly]);


  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!questions?.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No questions available for this {chapterOnly ? "chapter" : "topic"}.</p>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async () => {
    const answeredQuestions = questions.filter((q: any) => selectedAnswers[q.id]?.trim() || uploadedImages[q.id]);
    if (answeredQuestions.length === 0) {
      toast({ title: "No answers", description: "Please answer at least one question before submitting.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Session guard: verify active session before submitting
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        toast({ 
          title: "Session expired", 
          description: "Your session has expired. Please log in again and retry.", 
          variant: "destructive" 
        });
        setIsSubmitting(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Extract text from uploaded images first (and remember the image URL)
      const extractedTexts: Record<string, string> = {};
      const imageUrls: Record<string, string> = {};
      for (const q of questions) {
        if (!isMCQ(q) && uploadedImages[q.id] && !selectedAnswers[q.id]?.trim()) {
          setExtractingImages(prev => ({ ...prev, [q.id]: true }));
          try {
            const file = uploadedImages[q.id].file;
            const filePath = `${user.id}/${q.id}_${Date.now()}.${file.name.split('.').pop()}`;
            const { error: uploadError } = await supabase.storage
              .from('student-answers')
              .upload(filePath, file, { cacheControl: '3600', upsert: false });
            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage
              .from('student-answers')
              .getPublicUrl(filePath);
            imageUrls[q.id] = publicUrlData.publicUrl;

            const { data: extractData, error: extractError } = await supabase.functions.invoke('extract-answer-from-image', {
              body: {
                image_url: publicUrlData.publicUrl,
                question_context: q.question_text,
              },
            });
            if (extractError) throw extractError;
            if (extractData?.extracted_text && extractData.extracted_text !== 'UNREADABLE') {
              extractedTexts[q.id] = extractData.extracted_text;
            } else {
              extractedTexts[q.id] = `[Image answer uploaded - pending review]`;
            }
          } catch (err: any) {
            console.error('Image extraction failed for', q.id, err);
            extractedTexts[q.id] = `[Image answer uploaded - AI extraction failed]`;
            toast({ title: "Image reading issue", description: `Could not read answer for Q${questions.indexOf(q) + 1}, but your image was saved.` });
          } finally {
            setExtractingImages(prev => ({ ...prev, [q.id]: false }));
          }
        }
      }

      // Grade MCQs instantly, run AI for subjective
      let score = 0;          // count of CORRECT answers
      let totalMarks = 0;     // sum of marks across ANSWERED questions
      let scoredMarks = 0;    // sum of marks the student earned
      let pendingCount = 0;   // subjective answers AI could not grade
      let answeredCount = 0;  // number of questions the student attempted
      const details: Record<string, { correct: boolean; feedback: string; marksAwarded: number }> = {};
      const answersJson: Record<string, {
        student_answer: string;
        image_url: string | null;
        is_correct: boolean;
        marks_awarded: number;
        max_marks: number;
        feedback: string;
      }> = {};

      for (const q of questions) {
        const marks = q.marks || 1;
        const studentAnswer = selectedAnswers[q.id]?.trim() || extractedTexts[q.id]?.trim() || "";
        const imageUrl = imageUrls[q.id] || null;

        if (!studentAnswer) {
          // Not answered — do NOT count toward totals
          details[q.id] = { correct: false, feedback: "Not answered", marksAwarded: 0 };
          continue;
        }

        answeredCount++;
        totalMarks += marks;

        if (isMCQ(q)) {
          const correctKey = (q.correct_answer || "").trim().toLowerCase();
          const studentKey = studentAnswer.trim().toLowerCase();
          const isCorrect = studentKey === correctKey;
          if (isCorrect) {
            score++;
            scoredMarks += marks;
          }
          const feedback = isCorrect ? "Correct!" : `Incorrect. Correct answer: ${q.correct_answer}`;
          details[q.id] = { correct: isCorrect, feedback, marksAwarded: isCorrect ? marks : 0 };
          answersJson[q.id] = {
            student_answer: studentAnswer,
            image_url: imageUrl,
            is_correct: isCorrect,
            marks_awarded: isCorrect ? marks : 0,
            max_marks: marks,
            feedback,
          };
        } else {
          // Subjective: call ai-check-answer
          try {
            const { data: aiResult, error: aiError } = await supabase.functions.invoke("ai-check-answer", {
              body: {
                question_id: q.id,
                question_text: q.question_text,
                question_type: q.question_format || q.question_type || "subjective",
                correct_answer: q.correct_answer || "",
                student_answer: studentAnswer,
                max_marks: marks,
              },
            });
            if (aiError) throw aiError;
            const awarded = aiResult?.marks_awarded || 0;
            const isCorrect = !!aiResult?.is_correct;
            scoredMarks += awarded;
            if (isCorrect) score++;
            const feedback = aiResult?.feedback || "Evaluated";
            details[q.id] = { correct: isCorrect, feedback, marksAwarded: awarded };
            answersJson[q.id] = {
              student_answer: studentAnswer,
              image_url: imageUrl,
              is_correct: isCorrect,
              marks_awarded: awarded,
              max_marks: marks,
              feedback,
            };
          } catch (err) {
            pendingCount++;
            const feedback = "AI grading failed — will be reviewed";
            details[q.id] = { correct: false, feedback, marksAwarded: 0 };
            answersJson[q.id] = {
              student_answer: studentAnswer,
              image_url: imageUrl,
              is_correct: false,
              marks_awarded: 0,
              max_marks: marks,
              feedback,
            };
          }
        }
      }

      const percentage = totalMarks > 0 ? Math.round((scoredMarks / totalMarks) * 100) : 0;
      const timeTakenSeconds = startedAtRef.current
        ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
        : null;

      // Derive chapter_id from topic when it's not provided directly.
      let resolvedChapterId: string | null = chapterId || null;
      if (!resolvedChapterId && topicId) {
        const { data: topicRow } = await supabase
          .from("subject_topics")
          .select("chapter_id")
          .eq("id", topicId)
          .maybeSingle();
        resolvedChapterId = topicRow?.chapter_id || null;
      }

      // Try creating practice test record
      let testId: string | null = null;
      const { data: testRecord, error: testError } = await supabase
        .from("tests")
        .insert({
          title: `Practice - ${new Date().toLocaleDateString()}`,
          test_type: "practice",
          subject_id: subjectId || null,
          chapter_id: resolvedChapterId,
          topic_id: topicId || null,
          total_marks: totalMarks,
          duration_minutes: 0,
          is_active: false,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (testError) {
        console.error("Tests insert failed:", JSON.stringify({ code: (testError as any).code, message: testError.message, details: (testError as any).details, hint: (testError as any).hint }));
        if (testError.message?.includes("row-level security")) {
          toast({
            title: "Session issue detected",
            description: "Saving your practice in fallback mode. Please refresh and log in again if this persists.",
            variant: "destructive",
          });
        }
        testId = null;
      } else {
        testId = testRecord.id;
      }

      // Save to test_results — score is CORRECT count, total_questions is ANSWERED count
      const { error: resultError } = await supabase
        .from("test_results")
        .insert({
          test_id: testId,
          student_id: user.id,
          subject_id: subjectId || null,
          topic_id: topicId || null,
          chapter_id: resolvedChapterId,
          test_type: "practice",
          score,
          total_questions: answeredCount,
          percentage,
          time_taken_seconds: timeTakenSeconds,
          answers: answersJson as any,
          grading_status: pendingCount > 0 ? "pending" : "graded",
        } as any);

      if (resultError) throw resultError;

      // Keep Results tab in sync without a page refresh.
      refreshLearningResults(queryClient);

      setResults({ score, total: answeredCount, totalMarks, scoredMarks, details, pendingCount });
      setSubmitted(true);
      toast({ title: "Submitted!", description: `You scored ${scoredMarks}/${totalMarks} marks (${percentage}%)` });

    } catch (err: any) {
      console.error("Submit error:", err);
      toast({ title: "Error", description: err.message || "Failed to submit", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (q: any, index: number) => {
    if (!q) return null;
    const options = q.options as Record<string, unknown> | null;
    const mcq = isMCQ(q);
    const detail = results?.details[q.id];

    return (
      <Card key={q.id} className={`overflow-hidden max-w-full ${submitted && detail ? (detail.correct ? "border-green-300 dark:border-green-700" : "border-red-300 dark:border-red-700") : ""}`}>
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-muted-foreground">Q{index + 1}</span>
              {submitted && detail && (
                detail.correct
                  ? <CheckCircle className="h-4 w-4 text-green-600" />
                  : <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
            <div className="flex items-center gap-2">
              {q.difficulty && (
                <Badge variant="outline" className={difficultyColors[q.difficulty] || ""}>
                  {q.difficulty}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                {q.marks || 1} {(q.marks || 1) === 1 ? "mark" : "marks"}
              </Badge>
            </div>
          </div>

          {/* Question image - stacked above content on mobile */}
          {q.question_image_url && (
            <div className="w-full overflow-hidden rounded-lg border">
              <img src={q.question_image_url} alt="Question" className="max-w-full w-full h-auto" />
            </div>
          )}

          {/* Question text */}
          <div className="text-sm overflow-x-auto">
            <MathpixRenderer mmdText={stripInlineOptions(q.question_text, mcq && hasValidOptions(options))} inline />
          </div>

          {/* MCQ Options */}
          {mcq && hasValidOptions(options) && (
            <RadioGroup
              value={selectedAnswers[q.id] || ""}
              onValueChange={(val) => { if (submitted) return; markStarted(); setSelectedAnswers(prev => ({ ...prev, [q.id]: val })); }}
              className="space-y-2"
            >
              {Object.entries(options).map(([key, value]) => {
                const isCorrectOption = submitted && q.correct_answer?.toLowerCase() === key.toLowerCase();
                const isSelectedWrong = submitted && selectedAnswers[q.id] === key && !isCorrectOption;
                return (
                  <div
                    key={key}
                    className={`flex items-start gap-2 p-2 rounded-lg border transition-colors ${
                      isCorrectOption
                        ? "bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700"
                        : isSelectedWrong
                        ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem value={key} id={`${q.id}-${key}`} className="mt-0.5" disabled={submitted} />
                    <Label htmlFor={`${q.id}-${key}`} className="flex-1 cursor-pointer text-sm">
                      <span className="font-medium mr-1">{key.toUpperCase()}.</span>
                      <MathpixRenderer mmdText={getOptionText(value)} inline />
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          )}

          {/* Subjective / Non-MCQ answer input */}
          {!mcq && (
            <div className="space-y-2">
              <Textarea
                placeholder="Type your answer here or upload an image..."
                value={selectedAnswers[q.id] || ""}
                onChange={(e) => { if (submitted) return; markStarted(); setSelectedAnswers(prev => ({ ...prev, [q.id]: e.target.value })); }}
                disabled={submitted}
                className="min-h-[100px]"
              />
              {!submitted && (
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={(el) => { fileInputRefs.current[q.id] = el; }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) {
                        toast({ title: "File too large", description: "Max 5MB allowed", variant: "destructive" });
                        return;
                      }
                      const previewUrl = URL.createObjectURL(file);
                      markStarted();
                      setUploadedImages(prev => ({ ...prev, [q.id]: { file, previewUrl } }));

                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => fileInputRefs.current[q.id]?.click()}
                  >
                    <Camera className="h-4 w-4" />
                    Upload Answer Image
                  </Button>
                  {extractingImages[q.id] && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Reading your answer...
                    </span>
                  )}
                </div>
              )}
              {uploadedImages[q.id] && (
                <div className="relative inline-block">
                  <img
                    src={uploadedImages[q.id].previewUrl}
                    alt="Uploaded answer"
                    className="max-h-40 rounded-lg border"
                  />
                  {!submitted && (
                    <button
                      onClick={() => {
                        URL.revokeObjectURL(uploadedImages[q.id].previewUrl);
                        setUploadedImages(prev => { const n = { ...prev }; delete n[q.id]; return n; });
                      }}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Post-submission feedback */}
          {submitted && detail && (
            <div className="pt-2 border-t space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className={detail.correct ? "text-green-700 dark:text-green-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>
                  {detail.marksAwarded}/{q.marks || 1} marks
                </span>
              </div>
              {q.correct_answer && (
                <div className="text-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                  <span className="font-semibold text-green-800 dark:text-green-300">Correct Answer: </span>
                  <MathpixRenderer mmdText={q.correct_answer} inline />
                </div>
              )}
              {detail.feedback && !detail.feedback.toLowerCase().includes('basic matching') && detail.feedback !== 'Evaluated' && (
                <p className="text-sm text-muted-foreground">{detail.feedback}</p>
              )}
              {q.explanation && (
                <div className="text-sm bg-muted/50 p-3 rounded-lg">
                  <span className="font-semibold">Explanation: </span>
                  <MathpixRenderer mmdText={q.explanation} />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const safeIndex = questions.length > 0 ? Math.min(currentIndex, questions.length - 1) : 0;
  const currentQuestion = questions[safeIndex];
  const answeredCount = questions.filter((q: any) => selectedAnswers[q.id]?.trim()).length;

  return (
    <div className="space-y-4">
      {/* Score summary after submission */}
      {submitted && results && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold">Practice Results</h3>
                <p className="text-sm text-muted-foreground">
                  {results.scoredMarks}/{results.totalMarks} marks • {results.score}/{results.total} correct
                </p>
              </div>
              <div className="text-3xl font-bold text-primary">
                {results.totalMarks > 0 ? Math.round((results.scoredMarks / results.totalMarks) * 100) : 0}%
              </div>
            </div>
            {results.pendingCount > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {results.pendingCount} subjective answer(s) are pending AI review.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">
          {questions.length} Questions
          {!submitted && answeredCount > 0 && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({answeredCount} answered)
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewAll(!viewAll)} className="gap-2">
            {viewAll ? <ArrowRight className="h-4 w-4" /> : <List className="h-4 w-4" />}
            {viewAll ? "One at a time" : "View all"}
          </Button>
        </div>
      </div>

      {viewAll ? (
        <div className="space-y-4">
          {questions.map((q: any, i: number) => renderQuestion(q, i))}
          {!submitted && (
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={isSubmitting || answeredCount === 0}
                className="gap-2"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {currentQuestion ? renderQuestion(currentQuestion, safeIndex) : (
            <Card><CardContent className="py-12 text-center"><p className="text-muted-foreground">No question available.</p></CardContent></Card>
          )}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex(i => i - 1)}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {questions.length}
            </span>
            {currentIndex === questions.length - 1 && !submitted ? (
              <Button
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={isSubmitting || answeredCount === 0}
                className="gap-1"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={currentIndex === questions.length - 1}
                onClick={() => setCurrentIndex(i => i + 1)}
                className="gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your answers?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Answered</span>
                  <span className="font-semibold text-foreground">{answeredCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Remaining</span>
                  <span className="font-semibold text-foreground">{questions.length - answeredCount}</span>
                </div>
                <p className="pt-2">You won't be able to change answers after submitting.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSubmitting}
              onClick={async (e) => {
                e.preventDefault();
                await handleSubmit();
                setConfirmOpen(false);
              }}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
