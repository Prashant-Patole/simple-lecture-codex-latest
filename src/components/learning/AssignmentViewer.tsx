import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle, Clock, AlertCircle, ChevronLeft, ChevronRight, Flag, Image as ImageIcon, Loader2, Trophy, XCircle, ArrowLeft, Calendar, Play, RotateCcw, BookOpen, Target, Timer, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSubjectAssignmentsForStudent, useAssignmentQuestions, AssignmentQuestion, AssignmentDetails, StudentAssignment } from "@/hooks/useAssignmentQuestions";
import { useAssignmentSubmission, useSubmitAssignment, useUploadAssignmentAnswerImage, AssignmentAnswer } from "@/hooks/useAssignmentSubmissions";
import { useExtractImageAnswer } from "@/hooks/useExtractImageAnswer";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

import { AIPresentationReadyButton } from "./AIPresentationReadyButton";
import { stripInlineOptions } from "@/lib/stripInlineOptions";
import { MathpixRenderer } from "@/components/admin/MathpixRenderer";
import { refreshLearningResults } from "@/lib/refreshLearningResults";

interface AssignmentViewerProps {
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  onOpenInAITab?: (questionText: string, cachedResponse: any) => void;
}

type TestState = "assignments" | "detail" | "testing" | "results";

// Preserve visible line breaks while still allowing $$...$$ / markdown blocks.
const normalizeMultiline = (s?: string | null): string =>
  (s || "").replace(/\r\n/g, "\n").replace(/\n(?!\n)/g, "  \n");

interface AnswerState {
  text?: string;
  imageUrl?: string;
  imageFile?: File;
}

export const AssignmentViewer = ({ topicId, chapterId, subjectId, onOpenInAITab }: AssignmentViewerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testState, setTestState] = useState<TestState>("assignments");
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [gradedAnswers, setGradedAnswers] = useState<Record<string, AssignmentAnswer>>({});
  const [totalScore, setTotalScore] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch assignments for the subject
  const { data: assignments = [], isLoading: assignmentsLoading } = useSubjectAssignmentsForStudent(
    subjectId || null,
    chapterId,
    topicId
  );

  // Fetch questions for selected assignment
  const { data: assignmentDetails, isLoading: questionsLoading } = useAssignmentQuestions(selectedAssignmentId);

  // Fetch existing submission
  const { data: existingSubmission } = useAssignmentSubmission(selectedAssignmentId);

  const submitAssignment = useSubmitAssignment();
  const uploadImage = useUploadAssignmentAnswerImage();
  const extractImage = useExtractImageAnswer();

  const questions = assignmentDetails?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  // Timer effect
  useEffect(() => {
    if (testState !== "testing" || !timeRemaining) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev && prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev ? prev - 1 : null;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [testState, timeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const selectAssignment = (assignmentId: string) => {
    const assignment = assignments.find((a) => a.id === assignmentId);
    setSelectedAssignmentId(assignmentId);
    
    // If already submitted/graded, go to results view
    if (assignment?.status !== 'pending') {
      setTestState("results");
      return;
    }

    // Go to detail landing page
    setTestState("detail");
  };

  const startTest = () => {
    if (!selectedAssignmentId) return;
    const assignment = assignments.find((a) => a.id === selectedAssignmentId);
    setTestState("testing");
    setCurrentQuestionIndex(0);
    setAnswers({});
    setFlaggedQuestions(new Set());
    setStartTime(Date.now());
    
    // Set timer if assignment has duration
    if (assignment?.duration_minutes) {
      setTimeRemaining(assignment.duration_minutes * 60);
    }
  };

  const handleAnswerChange = (questionId: string, text: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], text },
    }));
  };

  const handleImageUpload = async (questionId: string, file: File) => {
    if (!selectedAssignmentId) return;

    try {
      const imageUrl = await uploadImage.mutateAsync({
        file,
        assignmentId: selectedAssignmentId,
        questionId,
      });

      setAnswers((prev) => ({
        ...prev,
        [questionId]: { ...prev[questionId], imageUrl, imageFile: file },
      }));

      toast({
        title: "Image Uploaded",
        description: "Your answer image has been uploaded.",
      });
    } catch (error) {
      console.error("Image upload error:", error);
    }
  };

  const handleExtractFromImage = async (questionId: string) => {
    const answer = answers[questionId];
    if (!answer?.imageUrl) return;

    setIsExtracting(true);
    try {
      const result = await extractImage.mutateAsync({
        imageUrl: answer.imageUrl,
        questionContext: currentQuestion?.question,
      });

      setAnswers((prev) => ({
        ...prev,
        [questionId]: { ...prev[questionId], text: result.extracted_text },
      }));

      toast({
        title: "Text Extracted",
        description: `Extracted with ${result.confidence} confidence.`,
      });
    } catch (error) {
      console.error("Extraction error:", error);
      toast({
        title: "Extraction Failed",
        description: "Could not extract text from image.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleFlag = (questionId: string) => {
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const normalizeAnswer = (answer: string): string => {
    return answer.trim().toLowerCase().replace(/\s+/g, " ");
  };

  const handleSubmit = async () => {
    if (!assignmentDetails || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // Separate MCQ and subjective questions
      const mcqTypes = ["mcq", "true_false"];
      const mcqQuestions: AssignmentQuestion[] = [];
      const subjectiveQuestions: AssignmentQuestion[] = [];

      questions.forEach((q) => {
        if (mcqTypes.includes(q.type)) {
          mcqQuestions.push(q);
        } else {
          subjectiveQuestions.push(q);
        }
      });

      // Grade MCQs locally
      const graded: Record<string, AssignmentAnswer> = {};
      let totalMarks = 0;

      for (const q of mcqQuestions) {
        const studentAnswer = answers[q.id]?.text || "";
        // Check MCQ correctness: direct text match OR key-to-option-text match
        const isCorrect = (() => {
          if (normalizeAnswer(studentAnswer) === normalizeAnswer(q.correct_answer || "")) return true;
          // Fallback: if correct_answer is a single letter key (A/B/C/D), resolve to option text
          const ca = (q.correct_answer || "").trim().toUpperCase();
          if (/^[A-Z]$/.test(ca) && q.options && q.options.length > 0) {
            const idx = ca.charCodeAt(0) - 65; // A=0, B=1, ...
            if (idx >= 0 && idx < q.options.length) {
              return normalizeAnswer(studentAnswer) === normalizeAnswer(q.options[idx]);
            }
          }
          return false;
        })();
        const marksAwarded = isCorrect ? q.marks : 0;
        totalMarks += marksAwarded;

        // For feedback, show the resolved correct answer text
        const resolvedCorrectAnswer = (() => {
          const ca = (q.correct_answer || "").trim().toUpperCase();
          if (/^[A-Z]$/.test(ca) && q.options && q.options.length > 0) {
            const idx = ca.charCodeAt(0) - 65;
            if (idx >= 0 && idx < q.options.length) return q.options[idx];
          }
          return q.correct_answer;
        })();

        graded[q.id] = {
          question_id: q.id,
          text_answer: studentAnswer,
          image_url: answers[q.id]?.imageUrl,
          marks_awarded: marksAwarded,
          is_correct: isCorrect,
          feedback: isCorrect ? "Correct!" : `Incorrect. The correct answer is: ${resolvedCorrectAnswer}`,
        };
      }

      // Grade subjective questions with AI
      if (subjectiveQuestions.length > 0) {
        const questionsToGrade = subjectiveQuestions.map((q) => ({
          question_id: q.id,
          question: q.question,
          type: q.type,
          correct_answer: q.correct_answer || "",
          student_answer: answers[q.id]?.text || "",
          marks: q.marks,
        }));

        const { data: gradeResult, error: gradeError } = await supabase.functions.invoke(
          "ai-grade-assignment",
          { body: { questions: questionsToGrade } }
        );

        if (gradeError) {
          console.error("AI grading error:", gradeError);
          toast({
            title: "Grading Error",
            description: "AI grading failed. Using manual review.",
            variant: "destructive",
          });

          // Fallback: mark as pending review
          for (const q of subjectiveQuestions) {
            graded[q.id] = {
              question_id: q.id,
              text_answer: answers[q.id]?.text || "",
              image_url: answers[q.id]?.imageUrl,
              marks_awarded: 0,
              is_correct: false,
              feedback: "Pending manual review",
            };
          }
        } else if (gradeResult?.grades) {
          for (const grade of gradeResult.grades) {
            const q = subjectiveQuestions.find((sq) => sq.id === grade.question_id);
            if (q) {
              totalMarks += grade.marks_awarded;
              graded[q.id] = {
                question_id: q.id,
                text_answer: answers[q.id]?.text || "",
                image_url: answers[q.id]?.imageUrl,
                marks_awarded: grade.marks_awarded,
                is_correct: grade.marks_awarded >= 1,
                feedback: grade.feedback,
              };
            }
          }
        }
      }

      // Calculate percentage
      const maxMarks = assignmentDetails.total_marks;
      const pct = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;

      // Calculate time taken
      const timeTaken = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

      // Save submission
      await submitAssignment.mutateAsync({
        assignmentId: assignmentDetails.id,
        answers: graded,
        score: totalMarks,
        percentage: pct,
        feedback: pct >= 60 ? "Good job!" : "Keep practicing!",
        timeTakenSeconds: timeTaken,
      });

      // Also mirror to test_results so it appears in the Results tab
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const correctCount = questions.reduce(
            (acc, q) => acc + (graded[q.id]?.is_correct ? 1 : 0),
            0
          );
          const answersPayload: Record<string, any> = {};
          for (const q of questions) {
            const g = graded[q.id];
            answersPayload[q.id] = {
              student_answer: g?.text_answer || "",
              image_url: g?.image_url || null,
              is_correct: !!g?.is_correct,
              marks_awarded: g?.marks_awarded ?? 0,
              max_marks: q.marks,
              feedback: g?.feedback || "",
              question_text: q.question,
              question_type: q.type,
              question_format: q.type === "mcq" ? "mcq" : "subjective",
              options: q.type === "mcq" && q.options
                ? Object.fromEntries((q.options as string[]).map((o, i) => [String.fromCharCode(65 + i), o]))
                : null,
              correct_answer: q.correct_answer || "",
              explanation: q.explanation || "",
            };
          }
          const { error: mirrorError } = await supabase.from("test_results").insert({
            student_id: user.id,
            test_id: null,
            test_type: "assignment",
            subject_id: assignmentDetails.subject_id || null,
            topic_id: assignmentDetails.topic_id || null,
            chapter_id: assignmentDetails.chapter_id || null,
            score: correctCount,
            total_questions: questions.length,
            percentage: pct,
            time_taken_seconds: timeTaken,
            answers: answersPayload,
            grading_status: "graded",
            submitted_at: new Date().toISOString(),
            graded_at: new Date().toISOString(),
          });
          if (mirrorError) {
            console.error("[assignment] test_results mirror insert error", mirrorError);
            toast({
              title: "Result sync failed",
              description: "Your assignment was submitted, but couldn't be mirrored to the Results tab.",
              variant: "destructive",
            });
          } else {
            refreshLearningResults(queryClient);
          }
        }
      } catch (mirrorErr) {
        console.warn("[assignment] test_results mirror failed", mirrorErr);
      }

      setGradedAnswers(graded);
      setTotalScore(totalMarks);
      setPercentage(pct);
      setTestState("results");

      toast({
        title: "Assignment Submitted",
        description: `You scored ${totalMarks}/${maxMarks} (${pct}%)`,
      });
    } catch (error) {
      console.error("Submit error:", error);
      toast({
        title: "Submission Failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusVariant = (status: StudentAssignment['status']): "default" | "secondary" | "destructive" => {
    switch (status) {
      case 'graded': return "default";
      case 'submitted': return "secondary";
      default: return "destructive";
    }
  };

  const getStatusIcon = (status: StudentAssignment['status']) => {
    switch (status) {
      case 'graded': return <CheckCircle className="h-3 w-3 mr-1" />;
      case 'submitted': return <AlertCircle className="h-3 w-3 mr-1" />;
      default: return <Clock className="h-3 w-3 mr-1" />;
    }
  };

  const getStatusLabel = (status: StudentAssignment['status']) => {
    switch (status) {
      case 'graded': return "Graded";
      case 'submitted': return "Submitted";
      default: return "Pending";
    }
  };

  // Hydrate results from existing submission when viewing
  useEffect(() => {
    if (testState === 'results' && existingSubmission && Object.keys(gradedAnswers).length === 0) {
      setGradedAnswers(existingSubmission.answers);
      setTotalScore(existingSubmission.score || 0);
      setPercentage(existingSubmission.percentage || 0);
    }
  }, [testState, existingSubmission]);

  const getAnsweredCount = () => {
    return Object.values(answers).filter((a) => a.text || a.imageUrl).length;
  };

  const getOptionText = (opt: any): string => {
    if (typeof opt === 'string') return opt;
    if (opt && typeof opt === 'object' && 'text' in opt) return opt.text;
    return String(opt);
  };

  const hasValidMCQOptions = (options: any): boolean => {
    if (!options || typeof options !== 'object') return false;
    const entries = Object.entries(options);
    if (entries.length < 2) return false;
    return entries.some(([key, val]: [string, any]) => {
      const text = (typeof val === 'string' ? val : val?.text || '').trim().toLowerCase();
      return text && text !== 'none' && text !== key.toLowerCase() && text.length > 1;
    });
  };

  const mapQuestionType = (qt: string): string => {
    const t = qt.toLowerCase();
    if (['mcq', 'single_choice', 'multiple_choice'].includes(t)) return 'mcq';
    if (t === 'true_false') return 'true_false';
    if (['long_answer', 'essay', 'descriptive', 'subjective'].includes(t)) return 'long_answer';
    return 'short_answer';
  };

  const handleCreatePracticeAssignment = async () => {
    setIsCreating(true);
    try {
      // Fetch questions for this topic or chapter
      let query = supabase.from("questions").select("*").limit(20);
      if (topicId) {
        query = query.eq("topic_id", topicId);
      } else if (chapterId) {
        query = query.eq("chapter_id", chapterId);
      }

      const { data: bankQuestions, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!bankQuestions || bankQuestions.length === 0) {
        toast({
          title: "No Questions Available",
          description: "There are no questions in the question bank for this topic yet.",
          variant: "destructive",
        });
        return;
      }

      // Shuffle and pick up to 10
      const shuffled = [...bankQuestions].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, 10);

      // Map to assignment question format
      const assignmentQuestions = selected.map((q, idx) => ({
        id: q.id,
        question: q.question_text,
        type: hasValidMCQOptions(q.options) ? 'mcq' : mapQuestionType(q.question_type || q.question_format || 'subjective'),
        options: hasValidMCQOptions(q.options) ? Object.values(q.options).map(getOptionText) : [],
        correct_answer: hasValidMCQOptions(q.options) && q.correct_answer
          ? (getOptionText((q.options as Record<string, unknown>)[q.correct_answer.trim().toUpperCase()]
              || (q.options as Record<string, unknown>)[q.correct_answer.trim()])
            || q.correct_answer)
          : q.correct_answer || '',
        marks: q.marks || 1,
        explanation: q.explanation || '',
      }));

      const totalMarks = assignmentQuestions.reduce((sum, q) => sum + q.marks, 0);
      const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      // Insert assignment
      const { data: newAssignment, error: insertError } = await supabase
        .from("assignments")
        .insert({
          title: `Practice Assignment - ${today}`,
          subject_id: subjectId || null,
          chapter_id: chapterId || null,
          topic_id: topicId || null,
          questions: assignmentQuestions as any,
          total_marks: totalMarks,
          passing_marks: Math.round(totalMarks * 0.4),
          is_active: true,
          source_type: "self_practice",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Invalidate cache so assignment appears in list
      queryClient.invalidateQueries({ queryKey: ["subject-assignments"] });

      // Navigate to detail view
      setSelectedAssignmentId(newAssignment.id);
      setTestState("detail");

      toast({
        title: "Practice Assignment Created",
        description: `${assignmentQuestions.length} questions ready to solve!`,
      });
    } catch (error: any) {
      console.error("Create practice assignment error:", error);
      toast({
        title: "Creation Failed",
        description: error.message || "Could not create practice assignment.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Loading state
  if (assignmentsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No assignments
  if (testState === "assignments" && assignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium">No Assignments Available</p>
          <p className="text-sm text-muted-foreground mb-4">
            Create a practice assignment from the question bank to start practicing.
          </p>
          <Button
            onClick={handleCreatePracticeAssignment}
            disabled={isCreating}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isCreating ? "Creating..." : "Create Practice Assignment"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Assignments list
  if (testState === "assignments") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Assignments</h2>
          <Button
            size="sm"
            onClick={handleCreatePracticeAssignment}
            disabled={isCreating}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            {isCreating ? "Creating..." : "New Practice"}
          </Button>
        </div>
        {assignments.map((assignment) => (
          <Card 
            key={assignment.id} 
            className="cursor-pointer hover:border-primary transition-colors"
            onClick={() => selectAssignment(assignment.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{assignment.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{assignment.description}</p>
                </div>
                <Badge variant={getStatusVariant(assignment.status)}>
                  {getStatusIcon(assignment.status)}
                  {getStatusLabel(assignment.status)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                <div className="flex flex-wrap gap-3">
                  {assignment.valid_until && (() => {
                    const dueDate = new Date(assignment.valid_until);
                    const now = new Date();
                    const isOverdue = dueDate < now;
                    const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
                    const isDueSoon = dueDate <= twoDaysFromNow && !isOverdue;
                    
                    return (
                      <span className={cn(
                        "flex items-center gap-1",
                        isOverdue && "text-destructive",
                        isDueSoon && !isOverdue && "text-orange-500",
                        !isOverdue && !isDueSoon && "text-muted-foreground"
                      )}>
                        <Calendar className="h-4 w-4" />
                        Due: {dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {isOverdue && " (Overdue)"}
                        {isDueSoon && " (Due Soon)"}
                      </span>
                    );
                  })()}
                  <span className="text-muted-foreground">
                    Total Marks: {assignment.total_marks}
                  </span>
                  {assignment.duration_minutes && (
                    <span className="text-muted-foreground">
                      Duration: {assignment.duration_minutes} min
                    </span>
                  )}
                  {assignment.status !== 'pending' && assignment.score !== null && (
                    <span className="font-medium text-primary">
                      Score: {assignment.score}/{assignment.total_marks} ({assignment.percentage}%)
                    </span>
                  )}
                </div>
                <Button 
                  size="sm"
                  className={assignment.status === 'pending' ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectAssignment(assignment.id);
                  }}
                >
                  {assignment.status === 'pending' ? (
                    <>
                      <Play className="h-4 w-4 mr-1" />
                      Solve Assignment
                    </>
                  ) : 'View Result'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Detail / Landing view (DPP-style)
  if (testState === "detail") {
    const selectedAssignment = assignments.find(a => a.id === selectedAssignmentId);
    
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => {
          setTestState("assignments");
          setSelectedAssignmentId(null);
        }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assignments
        </Button>

        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-4 rounded-full bg-green-100 dark:bg-green-900/50 w-fit mb-3">
              <BookOpen className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">{selectedAssignment?.title}</CardTitle>
            {selectedAssignment?.description && (
              <p className="text-sm text-muted-foreground mt-2">{selectedAssignment.description}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-5 pb-6">
            {/* Assignment info grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {assignmentDetails && (
                <div className="text-center p-3 rounded-xl bg-white/60 dark:bg-white/5">
                  <FileText className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <div className="text-lg font-bold">{assignmentDetails.questions.length}</div>
                  <p className="text-xs text-muted-foreground">Questions</p>
                </div>
              )}
              <div className="text-center p-3 rounded-xl bg-white/60 dark:bg-white/5">
                <Target className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <div className="text-lg font-bold">{assignmentDetails?.total_marks || selectedAssignment?.total_marks || 0}</div>
                <p className="text-xs text-muted-foreground">Total Marks</p>
              </div>
              {selectedAssignment?.duration_minutes && (
                <div className="text-center p-3 rounded-xl bg-white/60 dark:bg-white/5">
                  <Timer className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <div className="text-lg font-bold">{selectedAssignment.duration_minutes}</div>
                  <p className="text-xs text-muted-foreground">Minutes</p>
                </div>
              )}
              <div className="text-center p-3 rounded-xl bg-white/60 dark:bg-white/5">
                <Trophy className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <div className="text-lg font-bold">{assignmentDetails?.passing_marks || selectedAssignment?.passing_marks || 0}%</div>
                <p className="text-xs text-muted-foreground">Passing</p>
              </div>
            </div>

            {/* Instructions */}
            {assignmentDetails?.instructions && (
              <div className="p-3 rounded-lg bg-white/60 dark:bg-white/5 text-sm">
                <p className="font-medium mb-1">Instructions:</p>
                <p className="text-muted-foreground">{assignmentDetails.instructions}</p>
              </div>
            )}

            {/* Solve button */}
            <div className="flex justify-center pt-2">
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white px-8"
                onClick={startTest}
                disabled={questionsLoading}
              >
                {questionsLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Loading…
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5 mr-2" />
                    Solve Assignment
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Past attempts */}
        {existingSubmission && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Past Attempts</h3>
            <Card className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold",
                  (existingSubmission.percentage || 0) >= 60
                    ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                    : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                )}>
                  {existingSubmission.percentage || 0}%
                </div>
                <div>
                  <p className="text-sm font-medium">
                    Score: {existingSubmission.score}/{assignmentDetails?.total_marks || selectedAssignment?.total_marks || 0}
                  </p>
                  {existingSubmission.submitted_at && (
                    <p className="text-xs text-muted-foreground">
                      {new Date(existingSubmission.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-xs">
                {existingSubmission.graded_at ? "Graded" : "Submitted"}
              </Badge>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Results view (DPP-style)
  if (testState === "results" && assignmentDetails) {
    // Calculate correct/incorrect/unanswered counts
    const correctCount = Object.values(gradedAnswers).filter(a => a.is_correct).length;
    const incorrectCount = Object.values(gradedAnswers).filter(a => !a.is_correct && (a.text_answer || a.image_url)).length;
    const unansweredCount = questions.length - correctCount - incorrectCount;

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* DPP-style score card */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-4 rounded-full bg-green-100 dark:bg-green-900/50 w-fit mb-4">
              <Trophy className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Assignment Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="text-5xl font-bold text-green-600 dark:text-green-400">{percentage}%</div>
              <p className="text-muted-foreground mt-2">
                {totalScore}/{assignmentDetails.total_marks} marks
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {percentage >= assignmentDetails.passing_marks
                  ? "🎉 Congratulations! You passed!"
                  : `You need ${assignmentDetails.passing_marks}% to pass.`}
              </p>
            </div>

            {/* 3 stat boxes */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-xl bg-green-100/50 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 mx-auto text-green-600 dark:text-green-400 mb-2" />
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{correctCount}</div>
                <p className="text-sm text-muted-foreground">Correct</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-red-100/50 dark:bg-red-900/30">
                <XCircle className="h-6 w-6 mx-auto text-red-600 dark:text-red-400 mb-2" />
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{incorrectCount}</div>
                <p className="text-sm text-muted-foreground">Incorrect</p>
              </div>
              <div className="text-center p-4 rounded-xl bg-muted/50">
                <Clock className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <div className="text-2xl font-bold text-muted-foreground">{unansweredCount}</div>
                <p className="text-sm text-muted-foreground">Unanswered</p>
              </div>
            </div>

            {/* Back + Try Again buttons */}
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => {
                setTestState("assignments");
                setSelectedAssignmentId(null);
              }}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => {
                setTestState("detail");
                setGradedAnswers({});
                setTotalScore(0);
                setPercentage(0);
              }}>
                <Play className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Question-wise results */}
        <h3 className="text-lg font-semibold">Detailed Results</h3>
        {questions.map((q, idx) => {
          const graded = gradedAnswers[q.id];
          const isCorrect = graded?.is_correct;

          return (
            <Card key={q.id} className={isCorrect ? "border-green-300" : "border-red-300"}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Question {idx + 1}</CardTitle>
                  <Badge variant={isCorrect ? "default" : "destructive"}>
                    {graded?.marks_awarded || 0}/{q.marks} marks
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <MathpixRenderer inline mmdText={stripInlineOptions(q.question, q.type === "mcq" && !!q.options?.length)} className="font-medium" />

                {/* Student's answer */}
                <div className="p-3 rounded bg-muted overflow-x-auto [&_.katex-display]:overflow-x-auto [&_.katex-display]:my-2">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Your Answer:</p>
                  {graded?.text_answer ? (
                    <MathpixRenderer inline mmdText={normalizeMultiline(graded.text_answer)} />
                  ) : graded?.image_url ? (
                    <img src={graded.image_url} alt="Answer" className="max-h-40 rounded" />
                  ) : (
                    <p className="text-muted-foreground italic">No answer provided</p>
                  )}
                </div>

                {/* Correct answer for MCQ */}
                {q.type === "mcq" && q.options && (
                  <div className="space-y-1">
                    {q.options.map((opt, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded text-sm ${
                          opt === q.correct_answer
                            ? "bg-green-100 dark:bg-green-900 border border-green-500"
                            : graded?.text_answer === opt
                            ? "bg-red-100 dark:bg-red-900 border border-red-500"
                            : "bg-muted/50"
                        }`}
                      >
                        <MathpixRenderer inline mmdText={opt} />
                        {opt === q.correct_answer && (
                          <CheckCircle className="inline h-4 w-4 ml-2 text-green-600" />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Correct answer for theory/subjective */}
                {q.type !== "mcq" && q.correct_answer && (
                  <div className="p-3 rounded bg-green-50 dark:bg-green-950 border border-green-300 dark:border-green-800 overflow-x-auto [&_.katex-display]:overflow-x-auto [&_.katex-display]:my-2">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Correct Answer:</p>
                    <MathpixRenderer
                      inline
                      mmdText={normalizeMultiline(q.correct_answer)}
                      className="text-sm text-green-900 dark:text-green-100"
                    />
                  </div>
                )}

                {/* Feedback */}
                {graded?.feedback && (
                  <div className="p-3 rounded bg-primary/10 dark:bg-primary border border-primary/30 dark:border-primary overflow-x-auto [&_.katex-display]:overflow-x-auto [&_.katex-display]:my-2">
                    <p className="text-sm font-medium text-primary dark:text-primary">Feedback:</p>
                    <MathpixRenderer
                      inline
                      mmdText={normalizeMultiline(graded.feedback)}
                      className="text-sm text-primary dark:text-primary"
                    />
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div className="pt-2 border-t overflow-x-auto [&_.katex-display]:overflow-x-auto [&_.katex-display]:my-2">
                    <p className="text-sm font-medium">Explanation:</p>
                    <MathpixRenderer
                      inline
                      mmdText={normalizeMultiline(q.explanation)}
                      className="text-sm text-muted-foreground"
                    />
                  </div>
                )}


                {!isCorrect && (
                  <AIPresentationReadyButton
                    questionId={q.id}
                    questionText={q.question}
                    subjectId={subjectId}
                    onOpenInAITab={onOpenInAITab}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // Testing view
  if (testState === "testing" && assignmentDetails && currentQuestion) {
    return (
      <div className="space-y-4">
        {/* Header with timer and progress */}
        <div className="flex items-center justify-between bg-card p-4 rounded-lg border sticky top-0 z-10">
          <div>
            <h2 className="font-semibold">{assignmentDetails.title}</h2>
            <p className="text-sm text-muted-foreground">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground">
              Answered: {getAnsweredCount()}/{questions.length}
            </div>
            {timeRemaining !== null && (
              <Badge variant={timeRemaining < 60 ? "destructive" : "secondary"} className="text-lg px-3 py-1">
                <Clock className="h-4 w-4 mr-1" />
                {formatTime(timeRemaining)}
              </Badge>
            )}
          </div>
        </div>

        {/* Question Palette */}
        <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
          {questions.map((q, idx) => {
            const isAnswered = !!(answers[q.id]?.text || answers[q.id]?.imageUrl);
            const isFlagged = flaggedQuestions.has(q.id);
            const isCurrent = idx === currentQuestionIndex;

            return (
              <Button
                key={q.id}
                size="sm"
                variant={isCurrent ? "default" : isAnswered ? "secondary" : "outline"}
                className={`w-10 h-10 p-0 relative ${isFlagged ? "ring-2 ring-orange-500" : ""}`}
                onClick={() => setCurrentQuestionIndex(idx)}
              >
                {idx + 1}
                {isFlagged && (
                  <Flag className="absolute -top-1 -right-1 h-3 w-3 text-orange-500" />
                )}
              </Button>
            );
          })}
        </div>

        {/* Question Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">Question {currentQuestionIndex + 1}</CardTitle>
                <Badge variant="outline">{currentQuestion.marks} marks</Badge>
                <Badge variant="outline" className="capitalize">{currentQuestion.type.replace("_", " ")}</Badge>
              </div>
              <Button
                variant={flaggedQuestions.has(currentQuestion.id) ? "destructive" : "outline"}
                size="sm"
                onClick={() => toggleFlag(currentQuestion.id)}
              >
                <Flag className="h-4 w-4 mr-1" />
                {flaggedQuestions.has(currentQuestion.id) ? "Flagged" : "Flag"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <MathpixRenderer inline mmdText={stripInlineOptions(currentQuestion.question, currentQuestion.type === "mcq" && !!currentQuestion.options?.length)} className="text-lg" />

            {/* Question image if exists */}
            {currentQuestion.image_url && (
              <img src={currentQuestion.image_url} alt="Question" className="max-h-60 rounded border" />
            )}

            {/* Answer input based on type */}
            {currentQuestion.type === "mcq" && currentQuestion.options && (
              <RadioGroup
                value={answers[currentQuestion.id]?.text || ""}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                className="space-y-2"
              >
                {currentQuestion.options.map((option, idx) => (
                  <div key={idx} className="flex items-center space-x-2 p-3 rounded border hover:bg-muted cursor-pointer">
                    <RadioGroupItem value={option} id={`option-${idx}`} />
                    <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer">
                      <MathpixRenderer inline mmdText={option} />
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {currentQuestion.type === "true_false" && (
              <RadioGroup
                value={answers[currentQuestion.id]?.text || ""}
                onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                className="space-y-2"
              >
                {["True", "False"].map((option) => (
                  <div key={option} className="flex items-center space-x-2 p-3 rounded border hover:bg-muted cursor-pointer">
                    <RadioGroupItem value={option} id={`tf-${option}`} />
                    <Label htmlFor={`tf-${option}`} className="flex-1 cursor-pointer">
                      {option}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}

            {/* Fill in the Blank - Single line input */}
            {currentQuestion.type === "fill_blank" && (
              <div className="space-y-3">
                <div className="flex flex-col gap-2">
                  <Label className="text-base font-medium">Your Answer:</Label>
                  <Input
                    type="text"
                    placeholder="Type your answer here..."
                    value={answers[currentQuestion.id]?.text || ""}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    className="max-w-md"
                  />
                </div>
              </div>
            )}

            {/* Diagram - Image upload only */}
            {currentQuestion.type === "diagram" && (
              <div className="space-y-4">
                <div className="p-6 border-2 border-dashed rounded-lg text-center bg-muted/30">
                  <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">Upload your diagram or drawing</p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Image
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(currentQuestion.id, file);
                    }}
                  />
                </div>
                
                {/* Show uploaded diagram */}
                {answers[currentQuestion.id]?.imageUrl && (
                  <div className="relative inline-block">
                    <img
                      src={answers[currentQuestion.id].imageUrl}
                      alt="Your Diagram"
                      className="max-h-60 rounded border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => setAnswers((prev) => ({
                        ...prev,
                        [currentQuestion.id]: { ...prev[currentQuestion.id], imageUrl: undefined },
                      }))}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Short/Long Answer, Application, Case Study, Real World Application */}
            {["short_answer", "long_answer", "application", "case_study", "real_world_application"].includes(currentQuestion.type) && (
              <div className="space-y-3">
                <Textarea
                  placeholder="Type your answer here..."
                  value={answers[currentQuestion.id]?.text || ""}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  rows={currentQuestion.type === "short_answer" ? 3 : 6}
                />

                {/* Helpful hint for case study / real world */}
                {["case_study", "real_world_application"].includes(currentQuestion.type) && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    💡 Tip: You can upload a diagram or image to support your answer
                  </p>
                )}

                {/* Image upload option */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-4 w-4 mr-1" />
                    {["case_study", "real_world_application", "diagram"].includes(currentQuestion.type) 
                      ? "Add Supporting Image/Diagram" 
                      : "Upload Image"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(currentQuestion.id, file);
                    }}
                  />
                  {answers[currentQuestion.id]?.imageUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExtractFromImage(currentQuestion.id)}
                      disabled={isExtracting}
                    >
                      {isExtracting ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4 mr-1" />
                      )}
                      Extract Text
                    </Button>
                  )}
                </div>

                {/* Show uploaded image */}
                {answers[currentQuestion.id]?.imageUrl && (
                  <div className="relative inline-block">
                    <img
                      src={answers[currentQuestion.id].imageUrl}
                      alt="Answer"
                      className="max-h-40 rounded border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => setAnswers((prev) => ({
                        ...prev,
                        [currentQuestion.id]: { ...prev[currentQuestion.id], imageUrl: undefined },
                      }))}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Fallback for unknown question types */}
            {!["mcq", "true_false", "fill_blank", "diagram", "short_answer", "long_answer", "application", "case_study", "real_world_application"].includes(currentQuestion.type) && (
              <div className="space-y-3">
                <Textarea
                  placeholder="Type your answer here..."
                  value={answers[currentQuestion.id]?.text || ""}
                  onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                  rows={4}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQuestionIndex === 0}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <div className="flex gap-2">
            {currentQuestionIndex === questions.length - 1 ? (
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                Submit Assignment
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading questions
  if (questionsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return null;
};
