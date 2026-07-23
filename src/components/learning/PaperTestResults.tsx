import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  Calendar,
  Trophy,
  AlertCircle,
  MessageCircle,
  Image,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePaperTestResults, PaperTestResult } from "@/hooks/usePaperTestResults";
import { useTestResults, TestResult } from "@/hooks/useTestResults";
import { usePreviousYearPaperQuestions, PaperQuestion } from "@/hooks/usePreviousYearPaperQuestions";
import { useTestQuestionsView } from "@/hooks/useTestQuestionsView";
import { useStudentAnswers } from "@/hooks/useStudentAnswers";
import { MathpixRenderer } from "@/components/admin/MathpixRenderer";
import { format } from "date-fns";

interface DoubtData {
  questionText: string;
  correctAnswer: string;
  studentAnswer: string;
  subjectName?: string;
}

interface PaperTestResultsProps {
  subjectId: string | null;
  subjectName?: string;
  topicId?: string | null;
  chapterId?: string | null;
  onClearDoubt?: (doubtData: DoubtData) => void;
}

type ResultCategory = "all" | "previous_year" | "proficiency" | "dpp" | "mock";

type SourceType = "dpp" | "assignment" | "questions" | "previous_year" | "proficiency" | "mock" | "practice" | "exam";

// Unified result type for display
interface UnifiedResult {
  id: string;
  paper_id: string;
  paper_category: string;
  score: number | null;
  total_questions: number;
  percentage: number | null;
  time_taken_seconds: number | null;
  grading_status: string;
  submitted_at: string;
  answers: Record<string, string>;
  paper: {
    exam_name: string;
    year: number | null;
    paper_type: string | null;
  } | null;
  isFromTestsTable: boolean;
  source_type: SourceType;
  topic_name?: string;
  chapter_name?: string;
}

export function PaperTestResults({ subjectId, subjectName, topicId, chapterId, onClearDoubt }: PaperTestResultsProps) {
  const navigate = useNavigate();
  const [selectedResult, setSelectedResult] = useState<UnifiedResult | null>(null);

  const getResultsReturnPath = () => {
    const params = new URLSearchParams(window.location.search);
    if (subjectId) params.set("subject", subjectId);
    params.set("tab", "my-results");
    if (topicId) {
      params.set("topic", topicId);
      if (chapterId) params.set("chapter", chapterId);
    } else {
      params.delete("topic");
      if (chapterId) params.set("chapter", chapterId);
      else params.delete("chapter");
    }
    return `${window.location.pathname}?${params.toString()}`;
  };
  
  // Fetch from both tables with optional filtering
  const { data: paperResults, isLoading: paperLoading } = usePaperTestResults(subjectId, topicId, chapterId);
  const { data: testResults, isLoading: testLoading } = useTestResults(subjectId, topicId, chapterId);
  
  const isLoading = paperLoading || testLoading;
  
  // Fetch questions based on selected result type
  const { data: paperQuestions } = usePreviousYearPaperQuestions(
    selectedResult && !selectedResult.isFromTestsTable ? selectedResult.paper_id : null
  );
  const { data: testQuestions } = useTestQuestionsView(
    selectedResult?.isFromTestsTable ? selectedResult.paper_id : null
  );
  const { data: studentAnswers } = useStudentAnswers(
    selectedResult && !selectedResult.isFromTestsTable ? selectedResult.paper_id : null
  );

  // Normalize test_results to match paper_test_results format
  const normalizedTestResults = useMemo((): UnifiedResult[] => {
    return (testResults || []).map(tr => {
      const testType = tr.test?.test_type || tr.test_type;
      const isAssignment = tr.test_type === "assignment";
      const isPractice = !isAssignment && (tr.test_type === "practice" || !tr.test_id);
      const sourceType: SourceType = isAssignment ? "assignment" : isPractice ? "practice" : testType === "dpp" ? "dpp" : testType === "proficiency" ? "proficiency" : testType === "mock" ? "mock" : "practice";
      return {
        id: tr.id,
        paper_id: tr.test_id,
        paper_category: tr.test_type,
        score: tr.score ?? null,
        total_questions: tr.total_questions,
        percentage: tr.percentage !== null && tr.percentage !== undefined ? Number(tr.percentage) : null,
        time_taken_seconds: tr.time_taken_seconds,
        grading_status: tr.grading_status,
        submitted_at: tr.submitted_at,
        answers: tr.answers || {},
        paper: tr.test ? {
          exam_name: tr.test.title,
          year: null,
          paper_type: tr.test.test_type
        } : (isAssignment ? { exam_name: "Assignment", year: null, paper_type: "assignment" }
            : isPractice ? { exam_name: "Practice Session", year: null, paper_type: "practice" } : null),
        isFromTestsTable: true,
        source_type: sourceType,
        topic_name: tr.test?.topic?.title,
        chapter_name: tr.test?.chapter?.title || tr.test?.topic?.chapter?.title,
      };
    });
  }, [testResults]);

  // Combine both sources
  const results = useMemo((): UnifiedResult[] => {
    const paper: UnifiedResult[] = (paperResults || []).map(r => ({
      id: r.id,
      paper_id: r.paper_id,
      paper_category: r.paper_category,
      score: r.score,
      total_questions: r.total_questions,
      percentage: r.percentage,
      time_taken_seconds: r.time_taken_seconds,
      grading_status: r.grading_status,
      submitted_at: r.submitted_at,
      answers: r.answers || {},
      paper: r.paper ? {
        exam_name: r.paper.exam_name,
        year: r.paper.year,
        paper_type: r.paper.paper_type
      } : null,
      isFromTestsTable: false,
      source_type: (r.paper_category === "previous_year" ? "previous_year" : r.paper_category === "proficiency" ? "proficiency" : "exam") as SourceType,
      topic_name: r.paper?.topic?.title,
      chapter_name: r.paper?.chapter?.title || r.paper?.topic?.chapter?.title,
    }));
    const tests = normalizedTestResults;
    return [...paper, ...tests].sort((a, b) => 
      new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    );
  }, [paperResults, normalizedTestResults]);

  // Build a lookup for student answers by question ID
  const studentAnswersByQuestionId = useMemo(() => {
    if (!studentAnswers) return {};
    return studentAnswers.reduce((acc, sa) => {
      acc[sa.question_id] = sa;
      return acc;
    }, {} as Record<string, typeof studentAnswers[0]>);
  }, [studentAnswers]);

  // Helper to check if a result is a DPP
  const isDppResult = (result: UnifiedResult) => {
    if (!result.isFromTestsTable) return false;
    
    // Check paper_category (from test_type) OR exam_name contains "dpp"
    if (result.paper_category === "dpp") return true;
    
    const examName = result.paper?.exam_name || "";
    return examName.toLowerCase().includes("dpp");
  };


  const getSourceBadge = (sourceType: SourceType) => {
    const config: Record<SourceType, { label: string; className: string }> = {
      dpp: { label: "DPP", className: "bg-orange-100 text-orange-700 border-orange-300" },
      questions: { label: "Questions", className: "bg-primary/10 text-primary border-primary/30" },
      assignment: { label: "Assignment", className: "bg-primary/10 text-primary border-primary/30" },
      previous_year: { label: "Previous Year", className: "bg-teal-100 text-teal-700 border-teal-300" },
      proficiency: { label: "Proficiency", className: "bg-primary/10 text-primary border-primary/30" },
      mock: { label: "Mock Test", className: "bg-pink-100 text-pink-700 border-pink-300" },
      practice: { label: "Practice", className: "bg-sky-100 text-sky-700 border-sky-300" },
      exam: { label: "Exam", className: "bg-red-100 text-red-700 border-red-300" },
    };
    const c = config[sourceType] || config.practice;
    return <Badge variant="outline" className={cn("text-xs font-medium", c.className)}>{c.label}</Badge>;
  };

  const getStatusBadge = (result: UnifiedResult) => {
    // If score exists, treat as graded regardless of grading_status
    const hasValidScore = result.score !== null && result.percentage !== null;
    
    if (result.grading_status === "pending" && !hasValidScore) {
      return (
        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Pending
        </Badge>
      );
    }
    if (result.grading_status === "ai_graded") {
      return (
        <Badge variant="outline" className="text-primary border-primary">
          <CheckCircle className="h-3 w-3 mr-1" />
          AI Graded
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-green-600 border-green-600">
        <CheckCircle className="h-3 w-3 mr-1" />
        Graded
      </Badge>
    );
  };

  const getScoreColor = (percentage: number | null) => {
    if (percentage === null) return "text-muted-foreground";
    if (percentage >= 70) return "text-green-600";
    if (percentage >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs}h ${remainingMins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  // Get questions for review based on result type
  const reviewQuestions = useMemo(() => {
    if (!selectedResult) return [];
    
    if (selectedResult.isFromTestsTable && testQuestions) {
      // Map test_questions to a similar format as paper questions
      return testQuestions.map((tq, idx) => ({
        id: tq.question_id,
        question_text: tq.question?.question_text || "",
        correct_answer: tq.question?.correct_answer || null,
        explanation: tq.question?.explanation || null,
        difficulty: tq.question?.difficulty || "medium",
        options: tq.question?.options || null,
      }));
    }
    
    return paperQuestions || [];
  }, [selectedResult, testQuestions, paperQuestions]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-10 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!results || results.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Test Results Yet</h3>
          <p className="text-muted-foreground">
            Complete a test from Previous Year, Proficiency, or Exam tabs to see your results here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {results.map((result) => (
          <Card key={result.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium">
                      {result.paper?.exam_name || "Test"} {result.paper?.year || ""}
                    </h3>
                    {getSourceBadge(result.source_type)}
                  </div>
                  {(result.chapter_name || result.topic_name) && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {result.chapter_name && <span>Ch: {result.chapter_name}</span>}
                      {result.chapter_name && result.topic_name && <span>•</span>}
                      {result.topic_name && <span>Topic: {result.topic_name}</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(result.submitted_at), "MMM d, yyyy h:mm a")}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDuration(result.time_taken_seconds)}
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {result.total_questions} Questions
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {result.grading_status === "pending" && result.score === null && result.percentage === null ? (
                      <div className="flex items-center gap-2 text-yellow-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">Grading...</span>
                      </div>
                    ) : (
                      <>
                        <div className={cn("text-2xl font-bold", getScoreColor(result.percentage))}>
                          {result.percentage !== null ? `${Math.round(result.percentage)}%` : "N/A"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {result.score}/{result.total_questions} correct
                        </div>
                      </>
                    )}
                  </div>
                  {getStatusBadge(result)}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (result.source_type === "practice" || result.source_type === "assignment") {
                        const from = getResultsReturnPath();
                        sessionStorage.setItem("last-learning-results-path", from);
                        navigate(`/practice-results/${result.id}`, {
                          state: { from },
                        });
                      } else {
                        setSelectedResult(result);
                      }
                    }}

                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Review
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selectedResult} onOpenChange={() => setSelectedResult(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedResult?.paper?.exam_name || "Test"} {selectedResult?.paper?.year || ""} - Review
            </DialogTitle>
          </DialogHeader>
          
          {selectedResult && (
            <div className="space-y-4">
              {/* Score Summary */}
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Your Score</p>
                      <p className={cn("text-3xl font-bold", getScoreColor(selectedResult.percentage))}>
                        {selectedResult.percentage !== null ? `${Math.round(selectedResult.percentage)}%` : "Pending"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Correct Answers</p>
                      <p className="text-xl font-semibold">
                        {selectedResult.score ?? "?"}/{selectedResult.total_questions}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Time Taken</p>
                      <p className="text-xl font-semibold">
                        {formatDuration(selectedResult.time_taken_seconds)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Questions Review */}
              {reviewQuestions && reviewQuestions.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="font-medium">Question Review</h4>
                  {reviewQuestions.map((q, idx) => {
                    const textAnswer = selectedResult.answers[q.id];
                    const studentAnswer = studentAnswersByQuestionId[q.id];
                    const imageAnswer = studentAnswer?.answer_image_url;
                    
                    // Has any answer if text answer OR image answer exists
                    const hasAnyAnswer = !!textAnswer || !!imageAnswer;
                    const displayAnswer = textAnswer || studentAnswer?.answer_text;
                    const isCorrect = displayAnswer?.toUpperCase() === q.correct_answer?.toUpperCase();
                    
                    return (
                      <Card key={q.id} className={cn(
                        "border-l-4",
                        !hasAnyAnswer ? "border-l-gray-300" :
                        isCorrect ? "border-l-green-500" : "border-l-red-500"
                      )}>
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-muted-foreground">
                                Q{idx + 1}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {q.difficulty}
                              </Badge>
                            </div>
                            {!hasAnyAnswer ? (
                              <Badge variant="outline" className="text-gray-500">
                                Not Answered
                              </Badge>
                            ) : imageAnswer && !displayAnswer ? (
                              <Badge variant="outline" className="text-primary border-primary">
                                <Image className="h-3 w-3 mr-1" />
                                Image Submitted
                              </Badge>
                            ) : isCorrect ? (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Correct
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-red-600 border-red-600">
                                <XCircle className="h-3 w-3 mr-1" />
                                Incorrect
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm">
                            <MathpixRenderer mmdText={q.question_text} inline />
                          </div>
                          
                          {/* Show image answer if exists */}
                          {imageAnswer && (
                            <div className="mt-2">
                              <span className="text-sm text-muted-foreground">Your uploaded answer:</span>
                              <img 
                                src={imageAnswer} 
                                alt="Your answer" 
                                className="mt-1 max-h-48 rounded-lg border shadow-sm"
                                onError={(e) => {
                                  const target = e.currentTarget;
                                  target.style.display = 'none';
                                  const fallback = document.createElement('div');
                                  fallback.className = 'mt-1 p-4 rounded-lg border bg-muted text-muted-foreground text-sm';
                                  fallback.textContent = 'Image could not be loaded';
                                  target.parentNode?.appendChild(fallback);
                                }}
                              />
                            </div>
                          )}
                          
                          <div className="flex gap-4 text-sm flex-wrap">
                            <div className="flex items-baseline gap-1">
                              <span className="text-muted-foreground">Your answer: </span>
                              <span className={cn(
                                "font-medium",
                                isCorrect ? "text-green-600" : "text-red-600"
                              )}>
                                {displayAnswer ? (
                                  <MathpixRenderer mmdText={displayAnswer} inline className="inline" />
                                ) : (imageAnswer ? "(see image above)" : "—")}
                              </span>
                            </div>
                            {!isCorrect && q.correct_answer && (
                              <div className="flex items-baseline gap-1">
                                <span className="text-muted-foreground">Correct: </span>
                                <span className="font-medium text-green-600">
                                  <MathpixRenderer mmdText={q.correct_answer} inline className="inline" />
                                </span>
                              </div>
                            )}
                          </div>
                          {q.explanation && (
                            <div className="bg-muted p-2 rounded text-sm">
                              <span className="font-medium">Explanation: </span>
                              <MathpixRenderer mmdText={q.explanation} inline className="inline" />
                            </div>
                          )}
                          
                          {/* Clear Doubt Button - show only for incorrect answers when score <= 50% */}
                          {!isCorrect && hasAnyAnswer && selectedResult.percentage !== null && selectedResult.percentage <= 50 && onClearDoubt && (
                            <div className="mt-3 pt-3 border-t">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 text-primary border-primary/50 hover:bg-primary/10"
                                onClick={() => onClearDoubt({
                                  questionText: q.question_text,
                                  correctAnswer: q.correct_answer || '',
                                  studentAnswer: displayAnswer || '',
                                  subjectName: subjectName,
                                })}
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                Clear Doubt with AI
                              </Button>
                              <span className="text-xs text-muted-foreground ml-2">
                                Get a personalized explanation
                              </span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin mb-2" />
                  <p>Loading questions...</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
