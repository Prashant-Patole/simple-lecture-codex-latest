import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Flag,
  ChevronLeft,
  ChevronRight,
  Timer,
  AlertCircle,
  CheckCircle,
  Eye,
  RotateCcw,
  Trophy,
  Clock,
  Loader2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useSubmitTestResult } from "@/hooks/useTestResults";
import { MathpixRenderer } from "@/components/admin/MathpixRenderer";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { stripInlineOptions } from "@/lib/stripInlineOptions";

import { AIPresentationReadyButton } from "./AIPresentationReadyButton";

interface DPPTabProps {
  subjectId: string | null;
  topicId?: string | null;
  chapterId?: string | null;
  chapterOnly?: boolean;
  onOpenInAITab?: (questionText: string, cachedResponse: any) => void;
}

type DPPState = "landing" | "testing" | "submitting" | "results";

interface DPPQuestion {
  id: string;
  question_text: string;
  options: Record<string, any>;
  correct_answer: string;
  difficulty?: string;
  question_type?: string;
  question_format?: string;
  solution?: string;
  solution_steps?: any;
  marks?: number;
}

const getOptionText = (value: any): string => {
  if (typeof value === "object" && value !== null) return value.text || "";
  return String(value || "");
};

const isMCQType = (q: DPPQuestion): boolean => {
  const t = (q.question_type || "").toLowerCase();
  return t === "mcq" || t === "single_choice" || t === "multiple_choice";
};

const isTrueFalseType = (q: DPPQuestion): boolean => {
  return (q.question_type || "").toLowerCase() === "true_false";
};

const isIntegerType = (q: DPPQuestion): boolean => {
  const t = (q.question_type || "").toLowerCase();
  return t === "integer" || t === "numerical";
};

export function DPPTab({ subjectId, topicId, chapterId, chapterOnly, onOpenInAITab }: DPPTabProps) {
  const [dppState, setDppState] = useState<DPPState>("landing");
  const [questions, setQuestions] = useState<DPPQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState<number | null>(null);
  const [resultData, setResultData] = useState<{
    correct: number;
    incorrect: number;
    unanswered: number;
    total: number;
    percentage: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const submitTestResult = useSubmitTestResult();

  // Fetch past DPP attempts for this topic
  const { data: pastAttempts } = useQuery({
    queryKey: ["dpp-attempts", topicId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data } = await supabase
        .from("test_results")
        .select("id, score, total_questions, percentage, submitted_at, grading_status")
        .eq("student_id", user.id)
        .eq("test_type", "dpp")
        .order("submitted_at", { ascending: false })
        .limit(10);

      return data || [];
    },
    enabled: !!topicId,
  });

  const handleStartDPP = async () => {
    if (!topicId) {
      toast({ title: "Select a topic", description: "Please select a topic first.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      // Fetch random questions from the question bank for this topic
      const { data: rawData, error: fetchError } = await supabase
        .from("questions")
        .select("*")
        .eq("topic_id", topicId)
        .limit(20);

      if (fetchError) throw fetchError;
      if (!rawData || rawData.length === 0) {
        toast({ title: "No questions", description: "No questions available for this topic yet.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      // Shuffle and pick 5
      const shuffled = [...rawData].sort(() => Math.random() - 0.5);
      const fetchedQuestions = shuffled.slice(0, 5);

      if (fetchedQuestions.length === 0) {
        toast({ title: "No questions", description: "No questions available for this topic yet.", variant: "destructive" });
        setIsLoading(false);
        return;
      }

      const mapped: DPPQuestion[] = fetchedQuestions.map((q: any) => ({
        id: q.id,
        question_text: q.question_text,
        options: q.options || {},
        correct_answer: q.correct_answer || "",
        difficulty: q.difficulty || "medium",
        question_type: q.question_type || "mcq",
        question_format: q.question_format || "objective",
        solution: q.solution,
        solution_steps: q.solution_steps,
        marks: q.marks || 1,
      }));

      setQuestions(mapped);
      setAnswers({});
      setFlagged(new Set());
      setCurrentIndex(0);
      setStartTime(Date.now());
      setResultData(null);
      setDppState("testing");
    } catch (err) {
      console.error("Failed to fetch DPP questions:", err);
      toast({ title: "Error", description: "Failed to load questions.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const s = new Set(prev);
      s.has(questionId) ? s.delete(questionId) : s.add(questionId);
      return s;
    });
  };

  const checkAnswerWithAI = async (
    question: DPPQuestion,
    userAnswer: string
  ): Promise<{ isCorrect: boolean; marksAwarded: number }> => {
    try {
      const { data, error } = await supabase.functions.invoke("ai-check-answer", {
        body: {
          question_id: question.id,
          question_text: question.question_text,
          question_type: question.question_type || "mcq",
          correct_answer: question.correct_answer,
          student_answer: userAnswer,
          max_marks: question.marks || 1,
        },
      });
      if (error) throw error;
      return { isCorrect: data.is_correct, marksAwarded: data.marks_awarded };
    } catch {
      // Fallback: simple comparison
      const isCorrect = userAnswer.trim().toLowerCase() === (question.correct_answer || "").trim().toLowerCase();
      return { isCorrect, marksAwarded: isCorrect ? (question.marks || 1) : 0 };
    }
  };

  const handleSubmit = async () => {
    setDppState("submitting");
    const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : null;

    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;

    for (const q of questions) {
      const userAnswer = answers[q.id];
      if (!userAnswer || !userAnswer.trim()) {
        unanswered++;
        continue;
      }
      // MCQ / True-False / Integer: direct comparison; Subjective: AI
      if (Object.keys(q.options || {}).length > 0 || isMCQType(q) || isTrueFalseType(q)) {
        const isCorrect = userAnswer.trim().toLowerCase() === (q.correct_answer || "").trim().toLowerCase();
        isCorrect ? correct++ : incorrect++;
      } else if (isIntegerType(q)) {
        const sNum = parseFloat(userAnswer);
        const cNum = parseFloat(q.correct_answer || "");
        if (!isNaN(sNum) && !isNaN(cNum) && Math.abs(sNum - cNum) < 0.001) {
          correct++;
        } else {
          incorrect++;
        }
      } else {
        // Subjective - use AI
        const result = await checkAnswerWithAI(q, userAnswer);
        result.isCorrect ? correct++ : incorrect++;
      }
    }

    const total = questions.length;
    const percentage = Math.round((correct / total) * 100);

    try {
      await submitTestResult.mutateAsync({
        test_id: null,
        subject_id: subjectId,
        topic_id: topicId || null,
        chapter_id: chapterId || null,
        test_type: "dpp",
        score: correct,
        total_questions: total,
        percentage,
        time_taken_seconds: timeTaken,
        answers,
        grading_status: "graded",
      });
    } catch (err) {
      console.error("Failed to save DPP result:", err);
    }

    setResultData({ correct, incorrect, unanswered, total, percentage });
    setDppState("results");
  };

  const handleBackToLanding = () => {
    setDppState("landing");
    setQuestions([]);
    setAnswers({});
    setResultData(null);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  // ─── LANDING ───
  if (dppState === "landing") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-4 rounded-full bg-green-100 dark:bg-green-900/50 w-fit mb-3">
              <Zap className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Daily Practice Problems</CardTitle>
            <CardDescription>
              5 random questions from this topic — mixed types. Test yourself daily!
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 pb-6">
            <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white px-8"
              onClick={handleStartDPP}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <Play className="h-5 w-5 mr-2" />
                  Start DPP
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Past attempts */}
        {pastAttempts && pastAttempts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Past Attempts</h3>
            {pastAttempts.map((a: any) => (
              <Card key={a.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                    (a.percentage || 0) >= 60
                      ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                      : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                  )}>
                    {a.percentage || 0}%
                  </div>
                  <div>
                    <p className="text-sm font-medium">{a.score}/{a.total_questions} correct</p>
                    <p className="text-xs text-muted-foreground">{formatDate(a.submitted_at)}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {a.grading_status === "graded" ? "Graded" : "Pending"}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── SUBMITTING ───
  if (dppState === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-green-600" />
        <p className="text-muted-foreground">Grading your answers…</p>
      </div>
    );
  }

  // ─── RESULTS ───
  if (dppState === "results" && resultData) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-4 rounded-full bg-green-100 dark:bg-green-900/50 w-fit mb-4">
              <Trophy className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">DPP Completed!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-green-600 dark:text-green-400">{resultData.percentage}%</div>
              <p className="text-muted-foreground mt-2">{resultData.correct} out of {resultData.total} correct</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl bg-green-100/50 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 mx-auto text-green-600 dark:text-green-400 mb-2" />
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{resultData.correct}</div>
                <p className="text-sm text-muted-foreground">Correct</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-red-100/50 dark:bg-red-900/30">
                <AlertCircle className="h-6 w-6 mx-auto text-red-600 dark:text-red-400 mb-2" />
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{resultData.incorrect}</div>
                <p className="text-sm text-muted-foreground">Incorrect</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <Clock className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <div className="text-2xl font-bold text-muted-foreground">{resultData.unanswered}</div>
                <p className="text-sm text-muted-foreground">Unanswered</p>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={handleBackToLanding}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={handleStartDPP}>
                <Play className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Review */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Question Review</h3>
          {questions.map((q, idx) => {
            const userAnswer = answers[q.id];
            const hasMCQOptions = Object.keys(q.options || {}).length > 0;
            let wasCorrect = false;
            if (userAnswer) {
              if (Object.keys(q.options || {}).length > 0 || isMCQType(q) || isTrueFalseType(q)) {
                wasCorrect = userAnswer.trim().toLowerCase() === (q.correct_answer || "").trim().toLowerCase();
              } else if (isIntegerType(q)) {
                const s = parseFloat(userAnswer), c = parseFloat(q.correct_answer || "");
                wasCorrect = !isNaN(s) && !isNaN(c) && Math.abs(s - c) < 0.001;
              }
            }

            return (
              <Card key={q.id} className={cn("border-l-4", !userAnswer ? "border-l-muted" : wasCorrect ? "border-l-green-500" : "border-l-red-500")}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">{idx + 1}</span>
                    <div className="flex-1 space-y-3">
                      <MathpixRenderer mmdText={stripInlineOptions(q.question_text, hasMCQOptions)} inline />
                      <Badge variant="outline" className="text-xs">{q.question_type}</Badge>

                      {hasMCQOptions && (
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(q.options).map(([key, value]: [string, any]) => {
                            const isUser = userAnswer?.toLowerCase() === key.toLowerCase();
                            const isCorrectOpt = q.correct_answer?.toLowerCase() === key.toLowerCase();
                            return (
                              <div key={key} className={cn(
                                "p-3 rounded-lg border text-sm",
                                isCorrectOpt && "bg-green-100 border-green-500 dark:bg-green-900/30",
                                isUser && !isCorrectOpt && "bg-red-100 border-red-500 dark:bg-red-900/30",
                                !isUser && !isCorrectOpt && "bg-muted/50",
                              )}>
                                <span className="font-medium mr-2">{key.toUpperCase()}.</span>
                                <MathpixRenderer mmdText={getOptionText(value)} inline className="inline-block align-middle" />
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!hasMCQOptions && (
                        <div className="space-y-2">
                          <div className="p-3 rounded-lg border bg-muted/50 text-sm">
                            <span className="font-medium">Your answer: </span>{userAnswer || <span className="italic text-muted-foreground">Not answered</span>}
                          </div>
                          <div className="p-3 rounded-lg border bg-green-50 dark:bg-green-900/20 text-sm">
                            <span className="font-medium">Correct answer: </span>
                            <MathpixRenderer mmdText={q.correct_answer || ""} inline />
                          </div>
                        </div>
                      )}

                      {q.solution && (
                        <div className="p-3 rounded-lg bg-primary/10 dark:bg-primary/20 border border-primary/30 dark:border-primary">
                          <p className="text-sm font-medium text-primary dark:text-primary mb-1">Solution:</p>
                          <MathpixRenderer mmdText={q.solution} inline />
                        </div>
                      )}

                      {!wasCorrect && (
                        <AIPresentationReadyButton
                          questionId={q.id}
                          questionText={q.question_text}
                          subjectId={subjectId || undefined}
                          onOpenInAITab={onOpenInAITab}
                        />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── TESTING ───
  if (dppState === "testing" && questions.length > 0) {
    const currentQ = questions[currentIndex];
    const answeredCount = Object.keys(answers).length;
    const hasMCQOptions = Object.keys(currentQ.options || {}).length > 0;
    const isTF = isTrueFalseType(currentQ);
    const isInt = isIntegerType(currentQ);

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/30 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">Q {currentIndex + 1} of {questions.length}</div>
            <div className="text-sm text-muted-foreground">Answered: {answeredCount}/{questions.length}</div>
          </div>
          <Badge variant="outline" className="text-xs">{currentQ.question_type}</Badge>
        </div>

        <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-2" />

        {/* Navigation dots */}
        <div className="flex gap-1 flex-wrap p-2 bg-muted/50 rounded-lg">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "w-8 h-8 rounded text-xs font-medium transition-colors",
                idx === currentIndex && "ring-2 ring-green-500",
                answers[q.id] ? "bg-green-500 text-white" : "bg-background border",
                flagged.has(q.id) && "ring-2 ring-orange-500",
              )}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        {/* Question Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <MathpixRenderer mmdText={stripInlineOptions(currentQ.question_text, hasMCQOptions)} inline />
              </div>
              <Button variant="ghost" size="icon" onClick={() => toggleFlag(currentQ.id)}
                className={cn(flagged.has(currentQ.id) && "text-orange-500")}>
                <Flag className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* MCQ rendering */}
            {hasMCQOptions && (
              <RadioGroup
                value={answers[currentQ.id] || ""}
                onValueChange={(v) => handleAnswer(currentQ.id, v)}
                className="space-y-3"
              >
                {Object.entries(currentQ.options).map(([key, value]: [string, any]) => (
                  <div
                    key={key}
                    className={cn(
                      "flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors",
                      answers[currentQ.id]?.toLowerCase() === key.toLowerCase()
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "hover:bg-muted/50",
                    )}
                    onClick={() => handleAnswer(currentQ.id, key)}
                  >
                    <RadioGroupItem value={key} id={`opt-${key}`} />
                    <Label htmlFor={`opt-${key}`} className="flex-1 cursor-pointer flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{key.toUpperCase()}.</span>
                      <MathpixRenderer mmdText={getOptionText(value)} inline className="inline-block align-middle" />
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {/* True/False */}
            {isTF && (
              <RadioGroup
                value={answers[currentQ.id] || ""}
                onValueChange={(v) => handleAnswer(currentQ.id, v)}
                className="space-y-3"
              >
                {["True", "False"].map((opt) => (
                  <div
                    key={opt}
                    className={cn(
                      "flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors",
                      answers[currentQ.id] === opt
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "hover:bg-muted/50",
                    )}
                    onClick={() => handleAnswer(currentQ.id, opt)}
                  >
                    <RadioGroupItem value={opt} id={`tf-${opt}`} />
                    <Label htmlFor={`tf-${opt}`} className="flex-1 cursor-pointer font-medium">{opt}</Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {/* Integer input */}
            {isInt && !hasMCQOptions && !isTF && (
              <Input
                type="number"
                placeholder="Enter your numerical answer"
                value={answers[currentQ.id] || ""}
                onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
                className="text-lg"
              />
            )}

            {/* Subjective / text input */}
            {!hasMCQOptions && !isTF && !isInt && (
              <Textarea
                placeholder="Type your answer here…"
                value={answers[currentQ.id] || ""}
                onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
                rows={4}
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4">
          <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex((p) => p - 1)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
          </Button>
          <div className="flex gap-2">
            {currentIndex < questions.length - 1 ? (
              <Button onClick={() => setCurrentIndex((p) => p + 1)} className="bg-green-600 hover:bg-green-700">
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="bg-green-600 hover:bg-green-700">
                Submit DPP
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
