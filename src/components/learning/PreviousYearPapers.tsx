import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText,
  Clock,
  Play,
  Download,
  Flag,
  ChevronLeft,
  ChevronRight,
  Timer,
  AlertCircle,
  Star,
  Upload,
  Pencil,
  Loader2,
  Trophy,
  CheckCircle,
  Eye,
  RotateCcw,
  Target,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  usePreviousYearPapersForSubject,
  usePreviousYearPaperQuestions,
  PaperQuestion,
} from "@/hooks/usePreviousYearPaperQuestions";
import { useStudentTests, StudentTest } from "@/hooks/useStudentTests";
import { useUploadAnswerImage, useSubmitWrittenAnswer } from "@/hooks/useStudentAnswers";
import { useSubmitPaperTestResult, useUpdatePaperTestResult } from "@/hooks/usePaperTestResults";
import { useSubmitTestResult, useUpdateTestResult } from "@/hooks/useTestResults";
import { useExtractImageAnswer } from "@/hooks/useExtractImageAnswer";
import { MathpixRenderer } from "@/components/admin/MathpixRenderer";
import { PaperTestResults } from "./PaperTestResults";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PreviousYearPapersProps {
  subjectId: string | null;
  topicId?: string | null;
  chapterId?: string | null;
  chapterOnly?: boolean;
  onViewResults?: () => void;
}

type TestState = "papers" | "setup" | "testing" | "results";
type PaperCategory = "previous_year" | "proficiency" | "exam";

// Map test_type values to valid paper_category values for database storage
const mapTestTypeToPaperCategory = (testType: string): "previous_year" | "proficiency" | "exam" => {
  switch (testType) {
    case 'proficiency':
      return 'proficiency';
    case 'practice':
    case 'mock':
    case 'exam':
      return 'exam';
    default:
      return 'previous_year';
  }
};

const QUESTION_OPTIONS = [5, 10, 15, 20, 25] as const;
const TIME_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "3 hours", value: 180 },
  { label: "Unlimited", value: 0 },
] as const;

export function PreviousYearPapers({ subjectId, topicId, chapterId, chapterOnly, onViewResults }: PreviousYearPapersProps) {
  const [testState, setTestState] = useState<TestState>("papers");
  const [selectedPaper, setSelectedPaper] = useState<any>(null);
  const [selectedQuestionCount, setSelectedQuestionCount] = useState<number>(10);
  const [selectedTime, setSelectedTime] = useState<number>(30);
  const [testQuestions, setTestQuestions] = useState<PaperQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answerImages, setAnswerImages] = useState<Record<string, string>>({});
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [questionFilter, setQuestionFilter] = useState<"all" | "important">("all");
  const [activeCategory, setActiveCategory] = useState<PaperCategory>("previous_year");

  const { data: papers, isLoading: papersLoading } = usePreviousYearPapersForSubject(subjectId, topicId, chapterId, chapterOnly);
  const { data: paperQuestions, isLoading: questionsLoading } = usePreviousYearPaperQuestions(
    selectedPaper?.id || null
  );
  
  // Fetch tests from tests table for proficiency, exam, and dpp tabs
  const { data: proficiencyTests, isLoading: proficiencyLoading } = useStudentTests(
    subjectId, "proficiency", topicId, chapterId, chapterOnly
  );
  const { data: rawExamTests, isLoading: examLoading } = useStudentTests(
    subjectId, ["practice", "exam", "mock"], topicId, chapterId, chapterOnly
  );
  
  // Filter out DPPs from exam tests (DPPs have "dpp" in title or description)
  const examTests = useMemo(() => {
    if (!rawExamTests) return [];
    return rawExamTests.filter(test => {
      const searchText = `${test.title} ${test.description || ""}`.toLowerCase();
      return !searchText.includes("dpp");
    });
  }, [rawExamTests]);
  // DPP tests are now handled by the separate DPPTab component
  const uploadAnswerImage = useUploadAnswerImage();
  const submitWrittenAnswer = useSubmitWrittenAnswer();
  const submitPaperTestResult = useSubmitPaperTestResult();
  const updatePaperTestResult = useUpdatePaperTestResult();
  const submitTestResult = useSubmitTestResult();
  const updateTestResult = useUpdateTestResult();
  const extractImageAnswer = useExtractImageAnswer();
  
  // Track extracted text from images
  const [extractedImageAnswers, setExtractedImageAnswers] = useState<Record<string, string>>({});
  const [isExtractingImages, setIsExtractingImages] = useState(false);

  // Track test start time for duration calculation
  const [testStartTime, setTestStartTime] = useState<number | null>(null);

  // Filter papers by category (only for previous_year from papers table)
  const filteredPapers = useMemo(() => {
    if (!papers) return [];
    return papers.filter(p => (p.paper_category || "previous_year") === "previous_year");
  }, [papers]);

  // Count papers/tests by category - combine papers with tests
  const paperCounts = useMemo(() => {
    const pyqCount = papers?.filter(p => (p.paper_category || "previous_year") === "previous_year").length || 0;
    const proficiencyCount = proficiencyTests?.length || 0;
    const examCount = examTests?.length || 0;
    
    return { previous_year: pyqCount, proficiency: proficiencyCount, exam: examCount };
  }, [papers, proficiencyTests, examTests]);

  // Fetch user's submitted papers for status display
  const { data: submittedPapers } = useQuery({
    queryKey: ["submitted-papers", subjectId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data } = await supabase
        .from("paper_test_results")
        .select("paper_id, submitted_at, score, percentage, grading_status")
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false });
      
      return data || [];
    },
  });

  // Create a lookup map: paper_id -> latest submission info
  const submittedPaperMap = useMemo(() => {
    if (!submittedPapers) return new Map();
    const map = new Map();
    submittedPapers.forEach((s: any) => {
      // Only keep the latest submission per paper
      if (!map.has(s.paper_id)) {
        map.set(s.paper_id, s);
      }
    });
    return map;
  }, [submittedPapers]);

  // Fetch user's submitted test results (for proficiency/exam tests from tests table)
  const { data: submittedTests } = useQuery({
    queryKey: ["submitted-tests", subjectId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data } = await supabase
        .from("test_results")
        .select("test_id, submitted_at, score, percentage, grading_status, total_questions")
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false });
      
      return data || [];
    },
  });

  // Create lookup map: test_id -> latest submission info
  const submittedTestMap = useMemo(() => {
    if (!submittedTests) return new Map();
    const map = new Map();
    submittedTests.forEach((s: any) => {
      if (!map.has(s.test_id)) {
        map.set(s.test_id, s);
      }
    });
    return map;
  }, [submittedTests]);

  // Format date helper
  const formatSubmissionDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Timer effect
  useEffect(() => {
    if (testState !== "testing" || timeRemaining === null || timeRemaining === 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 0) {
          clearInterval(timer);
          return 0;
        }
        if (prev === 1) {
          // Auto-submit when time runs out
          setTestState("results");
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [testState, timeRemaining]);

  const handleStartSetup = (paper: any) => {
    setSelectedPaper(paper);
    
    // For proficiency tests, exams, and PYQ papers, set defaults for auto-start
    const category = paper.paper_category || 'previous_year';
    if (category === 'proficiency' || category === 'exam' || category === 'previous_year') {
      setSelectedQuestionCount(-1); // All questions
      setSelectedTime(0); // Unlimited time
    }
    
    setTestState("setup");
  };

  const handleStartTest = () => {
    if (!paperQuestions || paperQuestions.length === 0) return;

    // Shuffle and select questions
    const shuffled = [...paperQuestions].sort(() => Math.random() - 0.5);
    const count = selectedQuestionCount === -1 ? shuffled.length : Math.min(selectedQuestionCount, shuffled.length);
    setTestQuestions(shuffled.slice(0, count));
    setAnswers({});
    setAnswerImages({});
    setExtractedImageAnswers({});
    setFlaggedQuestions(new Set());
    setCurrentQuestionIndex(0);
    setTimeRemaining(selectedTime === 0 ? null : selectedTime * 60);
    setTestStartTime(Date.now());
    setTestState("testing");
  };

  // Handle starting a test from the tests table (proficiency, exam, etc.)
  const handleStartTestFromTestsTable = async (test: StudentTest) => {
    try {
      // Fetch questions from test_questions table
      const { data: testQuestionData, error } = await supabase
        .from("test_questions")
        .select(`
          *,
          question:questions(*)
        `)
        .eq("test_id", test.id)
        .order("order_number", { ascending: true });
      
      if (error) throw error;

      if (!testQuestionData || testQuestionData.length === 0) {
        toast({
          title: "No questions found",
          description: "This test has no questions yet.",
          variant: "destructive",
        });
        return;
      }
      
      // Transform to match PaperQuestion format
      const questions: PaperQuestion[] = testQuestionData.map((tq: any) => ({
        id: tq.question.id,
        question_text: tq.question.question_text,
        options: tq.question.options || {},
        correct_answer: tq.question.correct_answer,
        difficulty: tq.question.difficulty || "medium",
        question_type: tq.question.question_type || "mcq",
        question_format: tq.question.question_format || "objective",
        is_important: tq.question.is_important || false,
        solution: tq.question.solution,
        solution_steps: tq.question.solution_steps,
        marks: tq.marks || 1,
        is_verified: true,
      }));
      
      // Set up and start the test directly (skip setup dialog)
      setSelectedPaper({
        id: test.id,
        exam_name: test.title,
        paper_category: test.test_type,
        total_questions: test.question_count,
        isFromTestsTable: true, // Flag to identify it's from tests table
      });
      setTestQuestions(questions);
      setAnswers({});
      setAnswerImages({});
      setExtractedImageAnswers({});
      setFlaggedQuestions(new Set());
      setCurrentQuestionIndex(0);
      setTimeRemaining(test.duration_minutes > 0 ? test.duration_minutes * 60 : null);
      setTestStartTime(Date.now());
      setTestState("testing");
    } catch (error) {
      console.error("Failed to start test:", error);
      toast({
        title: "Error",
        description: "Failed to load test questions. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Check if paper is a written answer type
  const isWrittenAnswerPaper = selectedPaper?.document_type === "practice" || 
                               selectedPaper?.document_type === "proficiency";

  // Check if question requires written answer
  const isWrittenAnswerQuestion = (question: PaperQuestion): boolean => {
    // If paper type is practice/proficiency, all questions are written
    if (isWrittenAnswerPaper) return true;
    // Otherwise check question format
    return question.question_format === "subjective" && 
           (!question.options || Object.keys(question.options).length === 0);
  };

  const handleImageUpload = async (questionId: string, file: File) => {
    if (!selectedPaper) return;
    
    setUploadingImage(questionId);
    try {
      const imageUrl = await uploadAnswerImage.mutateAsync({ file, questionId });
      setAnswerImages(prev => ({ ...prev, [questionId]: imageUrl }));
      
      // Only save to student_answers for PYQ papers (FK constraint)
      if (!selectedPaper.isFromTestsTable) {
        await submitWrittenAnswer.mutateAsync({
          questionId,
          paperId: selectedPaper.id,
          answerImageUrl: imageUrl,
        });
      }
      
      toast({ title: "Image uploaded", description: "Your answer image has been saved" });
    } catch (error) {
      console.error("Failed to upload image:", error);
    } finally {
      setUploadingImage(null);
    }
  };

  const handleAnswer = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  };

  const toggleFlag = (questionId: string) => {
    setFlaggedQuestions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    // Calculate time taken
    const timeTakenSeconds = testStartTime ? Math.floor((Date.now() - testStartTime) / 1000) : null;
    
    // First, extract text from any image answers that don't have text
    setIsExtractingImages(true);
    const imageAnswersToExtract = testQuestions.filter(q => {
      const hasImageAnswer = !!answerImages[q.id];
      const hasTextAnswer = !!answers[q.id]?.trim();
      const alreadyExtracted = !!extractedImageAnswers[q.id];
      return hasImageAnswer && !hasTextAnswer && !alreadyExtracted;
    });

    const newExtractedAnswers: Record<string, string> = { ...extractedImageAnswers };
    
    if (imageAnswersToExtract.length > 0) {
      toast({
        title: "Processing images...",
        description: `Extracting answers from ${imageAnswersToExtract.length} image(s)`,
      });

      // Process image answers sequentially to avoid rate limits
      for (const question of imageAnswersToExtract) {
        try {
          const result = await extractImageAnswer.mutateAsync({
            imageUrl: answerImages[question.id],
            questionContext: question.question_text?.substring(0, 200),
          });
          
          if (result.extracted_text && result.extracted_text !== 'UNREADABLE') {
            newExtractedAnswers[question.id] = result.extracted_text;
            
            // Only save to student_answers for PYQ papers (FK constraint)
            if (!selectedPaper.isFromTestsTable) {
              await submitWrittenAnswer.mutateAsync({
                questionId: question.id,
                paperId: selectedPaper.id,
                answerText: result.extracted_text,
                answerImageUrl: answerImages[question.id],
              });
            }
          }
        } catch (error) {
          console.error(`Failed to extract answer for question ${question.id}:`, error);
        }
      }
      
      setExtractedImageAnswers(newExtractedAnswers);
    }
    setIsExtractingImages(false);

    // Now calculate score using both text answers and extracted image answers
    let correct = 0;
    testQuestions.forEach((q) => {
      // Prefer typed answer, then extracted image answer
      const userAnswer = answers[q.id]?.trim() || newExtractedAnswers[q.id]?.trim();
      const correctAnswer = q.correct_answer?.trim();
      if (fastIsCorrect(userAnswer, correctAnswer)) {
        correct++;
      }
    });
    
    const percentage = Math.round((correct / testQuestions.length) * 100);
    const rawCategory = selectedPaper?.paper_category || "previous_year";
    const paperCategory = mapTestTypeToPaperCategory(rawCategory);
    
    // Check if any answers need AI grading (including extracted image answers)
    const needsAiGrading = testQuestions.some((q) => {
      const userAnswer = answers[q.id]?.trim() || newExtractedAnswers[q.id]?.trim();
      const correctAnswer = q.correct_answer?.trim();
      return userAnswer && correctAnswer && !fastIsCorrect(userAnswer, correctAnswer) &&
        (isIntegerQuestion(q) || isSubjectiveQuestion(q));
    });

    // Merge text answers with extracted image answers for storage
    const allAnswers = { ...answers };
    Object.entries(newExtractedAnswers).forEach(([qId, extractedText]) => {
      if (!allAnswers[qId]?.trim() && extractedText) {
        allAnswers[qId] = extractedText;
      }
    });

    // Save to database - branch based on test source
    try {
      let resultId: string | undefined;
      
      if (selectedPaper.isFromTestsTable) {
        // Tests from the 'tests' table go to test_results
        const result = await submitTestResult.mutateAsync({
          test_id: selectedPaper.id,
          subject_id: subjectId,
          test_type: selectedPaper.paper_category || 'proficiency',
          score: correct,
          total_questions: testQuestions.length,
          percentage,
          time_taken_seconds: timeTakenSeconds,
          answers: allAnswers,
          grading_status: needsAiGrading ? "pending" : "graded",
        });
        resultId = result?.id;
        
        // If needs AI grading, run it in background and update the result
        if (needsAiGrading && resultId) {
          runAiGradingAndUpdateTestResult(resultId, correct, testQuestions.length, newExtractedAnswers);
        }
      } else {
        // Previous year papers go to paper_test_results
        const result = await submitPaperTestResult.mutateAsync({
          paper_id: selectedPaper.id,
          subject_id: subjectId,
          paper_category: paperCategory,
          score: correct,
          total_questions: testQuestions.length,
          percentage,
          time_taken_seconds: timeTakenSeconds,
          answers: allAnswers,
          grading_status: needsAiGrading ? "pending" : "graded",
        });
        resultId = result?.id;
        
        // If needs AI grading, run it in background and update the result
        if (needsAiGrading && resultId) {
          runAiGradingAndUpdate(resultId, correct, testQuestions.length, newExtractedAnswers);
        }
      }

      // Reset and go back to papers list with results tab selected
      setTestState("papers");
      setActiveCategory("previous_year"); // Will switch to results
      setSelectedPaper(null);
      setTestQuestions([]);
      setAnswers({});
      setAnswerImages({});
      setExtractedImageAnswers({});
      setFlaggedQuestions(new Set());
      setTestStartTime(null);
      
      // Switch to results tab
      setTimeout(() => {
        setActiveCategory("previous_year");
      }, 100);
      
    } catch (error) {
      console.error("Failed to save test result:", error);
    }
  };

  // Run AI grading in background and update the result in DB
  const runAiGradingAndUpdate = async (
    resultId: string,
    initialScore: number,
    totalQuestions: number,
    extractedAnswers: Record<string, string> = {}
  ) => {
    const integerChecks: { id: string; user_answer: string; correct_answer: string }[] = [];
    const subjectiveChecks: { id: string; user_answer: string; correct_answer: string; question_text: string; marks: number }[] = [];
    
    testQuestions.forEach((q) => {
      const userAnswer = answers[q.id]?.trim() || extractedAnswers[q.id]?.trim();
      const correctAnswer = q.correct_answer?.trim();
      
      if (userAnswer && correctAnswer && !fastIsCorrect(userAnswer, correctAnswer)) {
        if (isIntegerQuestion(q)) {
          integerChecks.push({ id: q.id, user_answer: userAnswer, correct_answer: correctAnswer });
        } else if (isSubjectiveQuestion(q)) {
          subjectiveChecks.push({ id: q.id, user_answer: userAnswer, correct_answer: correctAnswer, question_text: q.question_text, marks: q.marks || 1 });
        }
      }
    });

    if (integerChecks.length === 0 && subjectiveChecks.length === 0) {
      try {
        await updatePaperTestResult.mutateAsync({
          id: resultId,
          updates: { grading_status: "ai_graded", graded_at: new Date().toISOString() },
        });
      } catch (err) {
        console.error('Failed to update grading status:', err);
      }
      return;
    }

    try {
      let additionalCorrect = 0;
      let subjectiveMarks = 0;
      let subjectiveTotalMarks = 0;

      // Grade integer questions via math equivalence
      if (integerChecks.length > 0) {
        const { data, error } = await supabase.functions.invoke('ai-compare-math-answers', {
          body: { items: integerChecks },
        });
        if (!error && data?.results) {
          data.results.forEach((r: { id: string; is_equivalent: boolean }) => {
            if (r.is_equivalent) additionalCorrect++;
          });
        }
      }

      // Grade subjective questions via semantic grading
      for (const sq of subjectiveChecks) {
        subjectiveTotalMarks += sq.marks;
        try {
          const { data, error } = await supabase.functions.invoke('ai-check-answer', {
            body: {
              question_id: sq.id,
              question_text: sq.question_text,
              question_type: 'subjective',
              correct_answer: sq.correct_answer,
              student_answer: sq.user_answer,
              max_marks: sq.marks,
            },
          });
          if (!error && data) {
            subjectiveMarks += (data.marks_awarded || 0);
            if (data.is_correct) additionalCorrect++;
          }
        } catch (err) {
          console.error(`Subjective grading failed for ${sq.id}:`, err);
        }
      }

      const finalScore = initialScore + additionalCorrect;
      const finalPercentage = Math.round((finalScore / totalQuestions) * 100);

      await updatePaperTestResult.mutateAsync({
        id: resultId,
        updates: {
          score: finalScore,
          percentage: finalPercentage,
          grading_status: "ai_graded",
          graded_at: new Date().toISOString(),
        },
      });

      console.log(`AI grading complete: ${additionalCorrect} additional correct, final score: ${finalScore}/${totalQuestions}`);
    } catch (err) {
      console.error('AI grading failed:', err);
    }
  };

  // Run AI grading for tests from tests table and update the result in DB
  const runAiGradingAndUpdateTestResult = async (
    resultId: string,
    initialScore: number,
    totalQuestions: number,
    extractedAnswers: Record<string, string> = {}
  ) => {
    const integerChecks: { id: string; user_answer: string; correct_answer: string }[] = [];
    const subjectiveChecks: { id: string; user_answer: string; correct_answer: string; question_text: string; marks: number }[] = [];
    
    testQuestions.forEach((q) => {
      const userAnswer = answers[q.id]?.trim() || extractedAnswers[q.id]?.trim();
      const correctAnswer = q.correct_answer?.trim();
      
      if (userAnswer && correctAnswer && !fastIsCorrect(userAnswer, correctAnswer)) {
        if (isIntegerQuestion(q)) {
          integerChecks.push({ id: q.id, user_answer: userAnswer, correct_answer: correctAnswer });
        } else if (isSubjectiveQuestion(q)) {
          subjectiveChecks.push({ id: q.id, user_answer: userAnswer, correct_answer: correctAnswer, question_text: q.question_text, marks: q.marks || 1 });
        }
      }
    });

    if (integerChecks.length === 0 && subjectiveChecks.length === 0) {
      try {
        await updateTestResult.mutateAsync({
          id: resultId,
          updates: { grading_status: "ai_graded", graded_at: new Date().toISOString() },
        });
      } catch (err) {
        console.error('Failed to update grading status:', err);
      }
      return;
    }

    try {
      let additionalCorrect = 0;

      // Grade integer questions via math equivalence
      if (integerChecks.length > 0) {
        const { data, error } = await supabase.functions.invoke('ai-compare-math-answers', {
          body: { items: integerChecks },
        });
        if (!error && data?.results) {
          data.results.forEach((r: { id: string; is_equivalent: boolean }) => {
            if (r.is_equivalent) additionalCorrect++;
          });
        }
      }

      // Grade subjective questions via semantic grading
      for (const sq of subjectiveChecks) {
        try {
          const { data, error } = await supabase.functions.invoke('ai-check-answer', {
            body: {
              question_id: sq.id,
              question_text: sq.question_text,
              question_type: 'subjective',
              correct_answer: sq.correct_answer,
              student_answer: sq.user_answer,
              max_marks: sq.marks,
            },
          });
          if (!error && data?.is_correct) {
            additionalCorrect++;
          }
        } catch (err) {
          console.error(`Subjective grading failed for ${sq.id}:`, err);
        }
      }

      const finalScore = initialScore + additionalCorrect;
      const finalPercentage = Math.round((finalScore / totalQuestions) * 100);

      await updateTestResult.mutateAsync({
        id: resultId,
        updates: {
          score: finalScore,
          percentage: finalPercentage,
          grading_status: "ai_graded",
          graded_at: new Date().toISOString(),
        },
      });

      console.log(`AI grading complete: ${additionalCorrect} additional correct, final score: ${finalScore}/${totalQuestions}`);
    } catch (err) {
      console.error('AI grading failed:', err);
    }
  };

  const handleRetake = () => {
    setTestState("setup");
  };

  const handleBackToPapers = () => {
    setTestState("papers");
    setSelectedPaper(null);
    setTestQuestions([]);
    setAnswers({});
    setAnswerImages({});
    setExtractedImageAnswers({});
    setFlaggedQuestions(new Set());
  };

  // Normalize math notation for answer comparison (e.g., 5² ↔ 5^2, $x^2$ ↔ x^2)
  const normalizeAnswer = (answer: string): string => {
    if (!answer) return '';
    
    let normalized = answer.trim();
    
    // Remove LaTeX math delimiters
    normalized = normalized
      .replace(/\$\$/g, '')     // display math $$...$$
      .replace(/\$/g, '')       // inline math $...$
      .replace(/\\\(/g, '')     // \( ... \)
      .replace(/\\\)/g, '')
      .replace(/\\\[/g, '')     // \[ ... \]
      .replace(/\\\]/g, '');
    
    // Remove LaTeX formatting tokens
    normalized = normalized
      .replace(/\\left/g, '')
      .replace(/\\right/g, '')
      .replace(/\\displaystyle/g, '')
      .replace(/\\text\{([^}]*)\}/g, '$1')  // \text{abc} → abc
      .replace(/\\mathrm\{([^}]*)\}/g, '$1')
      .replace(/\\mathbf\{([^}]*)\}/g, '$1');
    
    // Convert LaTeX operators to plain equivalents
    normalized = normalized
      .replace(/\\times/g, '*')
      .replace(/\\cdot/g, '*')
      .replace(/\\div/g, '/')
      .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')  // \frac{a}{b} → (a)/(b)
      .replace(/\\lt/g, '<')
      .replace(/\\gt/g, '>')
      .replace(/\\leq/g, '<=')
      .replace(/\\le/g, '<=')
      .replace(/\\geq/g, '>=')
      .replace(/\\ge/g, '>=')
      .replace(/\\neq/g, '!=')
      .replace(/\\ne/g, '!=')
      .replace(/\\pm/g, '+-')
      .replace(/\\sqrt/g, 'SQRT')
      .replace(/\\infty/g, 'INF')
      .replace(/\\pi/g, 'PI');
    
    // Remove braces (so a^{2} becomes a^2)
    normalized = normalized.replace(/[{}]/g, '');
    
    // Uppercase for case-insensitive comparison
    normalized = normalized.toUpperCase();
    
    // Superscript mappings: ⁰¹²³⁴⁵⁶⁷⁸⁹ → ^0 ^1 ^2 etc.
    const superscriptMap: Record<string, string> = {
      '⁰': '^0', '¹': '^1', '²': '^2', '³': '^3', '⁴': '^4',
      '⁵': '^5', '⁶': '^6', '⁷': '^7', '⁸': '^8', '⁹': '^9',
      'ⁿ': '^N', 'ⁱ': '^I', 'ˣ': '^X',
    };
    
    // Subscript mappings: ₀₁₂₃₄₅₆₇₈₉ → _0 _1 _2 etc.
    const subscriptMap: Record<string, string> = {
      '₀': '_0', '₁': '_1', '₂': '_2', '₃': '_3', '₄': '_4',
      '₅': '_5', '₆': '_6', '₇': '_7', '₈': '_8', '₉': '_9',
      'ₙ': '_N', 'ₓ': '_X',
    };
    
    // Apply superscript normalization
    Object.entries(superscriptMap).forEach(([unicode, caret]) => {
      normalized = normalized.replace(new RegExp(unicode, 'g'), caret);
    });
    
    // Apply subscript normalization
    Object.entries(subscriptMap).forEach(([unicode, underscore]) => {
      normalized = normalized.replace(new RegExp(unicode, 'g'), underscore);
    });
    
    // Normalize Unicode math symbols
    normalized = normalized
      .replace(/×/g, '*')      // multiplication
      .replace(/÷/g, '/')      // division
      .replace(/−/g, '-')      // minus sign (unicode)
      .replace(/±/g, '+-')     // plus-minus
      .replace(/√/g, 'SQRT')   // square root
      .replace(/∞/g, 'INF')    // infinity
      .replace(/π/g, 'PI')     // pi
      .replace(/≤/g, '<=')     // less than or equal
      .replace(/≥/g, '>=')     // greater than or equal
      .replace(/≠/g, '!=')     // not equal
      .replace(/\s+/g, '');    // remove all whitespace
    
    return normalized;
  };

  // Check if fast normalization matches
  const fastIsCorrect = (userAnswer: string | undefined, correctAnswer: string | undefined): boolean => {
    if (!userAnswer || !correctAnswer) return false;
    return normalizeAnswer(userAnswer) === normalizeAnswer(correctAnswer);
  };

  const isIntegerQuestion = (question: PaperQuestion): boolean => {
    return question.question_type === "integer";
  };

  const isSubjectiveQuestion = (question: PaperQuestion): boolean => {
    return question.question_type === "subjective" && 
           (!question.options || Object.keys(question.options).length === 0);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getOptionText = (question: PaperQuestion, key: string): string => {
    const opt = question.options?.[key];
    if (typeof opt === "string") return opt;
    if (opt && typeof opt === "object" && "text" in opt) return opt.text;
    return "";
  };

  // Render Papers List
  if (testState === "papers") {
    const isLoading = papersLoading || proficiencyLoading || examLoading;
    const hasAnyContent = (papers && papers.length > 0) || 
                          (proficiencyTests && proficiencyTests.length > 0) || 
                          (examTests && examTests.length > 0);
    
    if (isLoading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    if (!hasAnyContent) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Practice Tests Available</h3>
            <p className="text-muted-foreground">
              No practice tests or previous year questions are available for this subject yet.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Enhanced Tabs */}
        <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as PaperCategory)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 p-1.5 h-auto bg-slate-100/80 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/50 shadow-sm">
            <TabsTrigger 
              value="previous_year" 
              className={cn(
                "gap-2 py-2.5 rounded-lg font-medium transition-all duration-300",
                "data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800",
                "data-[state=active]:text-primary dark:data-[state=active]:text-primary",
                "hover:text-primary dark:hover:text-primary"
              )}
            >
              PYQ
              {paperCounts.previous_year > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-bold transition-colors",
                  activeCategory === "previous_year" 
                    ? "bg-primary text-white" 
                    : "bg-primary/10 text-primary dark:bg-primary/50 dark:text-primary"
                )}>
                  {paperCounts.previous_year}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="proficiency" 
              className={cn(
                "gap-2 py-2.5 rounded-lg font-medium transition-all duration-300",
                "data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800",
                "data-[state=active]:text-primary dark:data-[state=active]:text-primary",
                "hover:text-primary dark:hover:text-primary"
              )}
            >
              Proficiency
              {paperCounts.proficiency > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-bold transition-colors",
                  activeCategory === "proficiency" 
                    ? "bg-primary text-white" 
                    : "bg-primary/10 text-primary dark:bg-primary/50 dark:text-primary"
                )}>
                  {paperCounts.proficiency}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="exam" 
              className={cn(
                "gap-2 py-2.5 rounded-lg font-medium transition-all duration-300",
                "data-[state=active]:bg-white data-[state=active]:shadow-md dark:data-[state=active]:bg-slate-800",
                "data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400",
                "hover:text-amber-600 dark:hover:text-amber-400"
              )}
            >
              Test
              {paperCounts.exam > 0 && (
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-bold transition-colors",
                  activeCategory === "exam" 
                    ? "bg-amber-500 text-white" 
                    : "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"
                )}>
                  {paperCounts.exam}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Previous Year Tab Content */}
          <TabsContent value="previous_year" className="mt-4">
            {filteredPapers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPapers.map((paper) => {
                  const submission = submittedPaperMap.get(paper.id);
                  const isSubmitted = !!submission;
                  
                  return (
                    <Card 
                      key={paper.id} 
                      className="group relative overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-xl bg-gradient-to-br from-primary/20 to-primary/5 dark:from-primary/30 dark:to-primary/10"
                    >
                      <CardHeader className="pb-3 pt-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-110 bg-primary/10 dark:bg-primary/20">
                              <Clock className="h-5 w-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <CardTitle className="text-lg font-semibold leading-tight">
                                {paper.exam_name}
                              </CardTitle>
                              {paper.paper_type && (
                                <CardDescription className="mt-1 text-sm">
                                  {paper.paper_type}
                                </CardDescription>
                              )}
                            </div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className="shrink-0 font-semibold border-primary/30 text-primary bg-primary/10 dark:border-primary/50 dark:text-primary dark:bg-primary/20"
                          >
                            {paper.year}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pb-5">
                        {/* Show submission status for PYQ */}
                        {isSubmitted && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-green-500 hover:bg-green-500 text-white">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Submitted - {Math.round(submission.percentage || 0)}%
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatSubmissionDate(submission.submitted_at)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-primary/70 text-primary dark:bg-primary/40 dark:text-primary">
                            <FileText className="h-4 w-4" />
                            <span>{paper.total_questions || "N/A"} Questions</span>
                          </div>
                          {paper.document_type && paper.document_type !== "mcq" && (
                            <Badge variant="secondary" className="text-xs font-medium rounded-full">
                              <Pencil className="h-3 w-3 mr-1" />
                              Written
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button
                            size="sm"
                            className="flex-1 font-medium bg-primary hover:bg-primary/90 text-primary-foreground"
                            onClick={() => handleStartSetup(paper)}
                          >
                            {isSubmitted ? (
                              <>
                                <RotateCcw className="h-4 w-4 mr-1.5" />
                                Re-attempt
                              </>
                            ) : (
                              <>
                                <Play className="h-4 w-4 mr-1.5" />
                                Start to Solve
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No previous year papers available</p>
              </div>
            )}
          </TabsContent>

          {/* Proficiency Tab Content - Uses tests table */}
          <TabsContent value="proficiency" className="mt-4">
            {proficiencyTests && proficiencyTests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {proficiencyTests.map((test) => {
                  const submission = submittedTestMap.get(test.id);
                  const isSubmitted = !!submission;
                  
                  return (
                    <Card 
                      key={test.id} 
                      className="group relative overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-xl bg-gradient-to-br from-primary/50 to-primary/30 dark:from-primary/40 dark:to-primary/20"
                    >
                      <CardHeader className="pb-3 pt-5">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-110 bg-primary/10 dark:bg-primary/50">
                            <Target className="h-5 w-5 text-primary dark:text-primary" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-lg font-semibold leading-tight">
                              {test.title}
                            </CardTitle>
                            {test.description && (
                              <CardDescription className="mt-1 text-sm">
                                {test.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pb-5">
                        {/* Show submission status for Proficiency */}
                        {isSubmitted && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-green-500 hover:bg-green-500 text-white">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Submitted - {Math.round(submission.percentage || 0)}%
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatSubmissionDate(submission.submitted_at)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="border-primary/30 text-primary dark:border-primary dark:text-primary">
                            {test.question_count} Questions
                          </Badge>
                          <Badge variant="outline" className="border-primary/30 text-primary dark:border-primary dark:text-primary">
                            {test.duration_minutes} min
                          </Badge>
                          <Badge variant="outline" className="border-primary/30 text-primary dark:border-primary dark:text-primary">
                            {test.total_marks} marks
                          </Badge>
                        </div>
                        <Button 
                          className="w-full bg-primary hover:bg-primary text-white"
                          onClick={() => handleStartTestFromTestsTable(test)}
                        >
                          {isSubmitted ? (
                            <>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Re-attempt
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Start Test
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No proficiency tests available</p>
              </div>
            )}
          </TabsContent>

          {/* Exam/Test Tab Content - Uses tests table */}
          <TabsContent value="exam" className="mt-4">
            {examTests && examTests.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {examTests.map((test) => {
                  const submission = submittedTestMap.get(test.id);
                  const isSubmitted = !!submission;
                  
                  return (
                    <Card 
                      key={test.id} 
                      className="group relative overflow-hidden transition-all duration-300 border-0 shadow-md hover:shadow-xl bg-gradient-to-br from-amber-100/50 to-amber-50/30 dark:from-amber-950/40 dark:to-amber-900/20"
                    >
                      <CardHeader className="pb-3 pt-5">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 rounded-xl shrink-0 transition-transform group-hover:scale-110 bg-amber-100 dark:bg-amber-900/50">
                            <GraduationCap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-lg font-semibold leading-tight">
                              {test.title}
                            </CardTitle>
                            {test.description && (
                              <CardDescription className="mt-1 text-sm">
                                {test.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 pb-5">
                        {/* Show submission status for Exam */}
                        {isSubmitted && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-green-500 hover:bg-green-500 text-white">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Submitted - {Math.round(submission.percentage || 0)}%
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatSubmissionDate(submission.submitted_at)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                            {test.question_count} Questions
                          </Badge>
                          <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                            {test.duration_minutes} min
                          </Badge>
                          <Badge variant="outline" className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300">
                            {test.total_marks} marks
                          </Badge>
                        </div>
                        <Button 
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                          onClick={() => handleStartTestFromTestsTable(test)}
                        >
                          {isSubmitted ? (
                            <>
                              <RotateCcw className="h-4 w-4 mr-2" />
                              Re-attempt
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Start Test
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No exam tests available</p>
              </div>
            )}
          </TabsContent>

          {/* DPP is now handled by the separate DPPTab component */}
        </Tabs>
      </div>
    );
  }

  // Render Setup Dialog
  if (testState === "setup") {
    const availableQuestions = paperQuestions?.length || 0;
    const category = selectedPaper?.paper_category || 'previous_year';
    const shouldAutoStart = category === 'proficiency' || 
                            category === 'exam' || 
                            category === 'previous_year';

    // Auto-start for proficiency tests, exams, and PYQ papers when questions are loaded
    if (shouldAutoStart && !questionsLoading && availableQuestions > 0) {
      // Use setTimeout to avoid state update during render
      setTimeout(() => {
        handleStartTest();
      }, 0);
      
      return (
        <Dialog open={true} onOpenChange={() => handleBackToPapers()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedPaper?.exam_name} {selectedPaper?.year}
              </DialogTitle>
            </DialogHeader>
            <div className="py-8 text-center">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">
                Starting test with {availableQuestions} questions...
              </p>
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    return (
      <Dialog open={true} onOpenChange={() => handleBackToPapers()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedPaper?.exam_name} {selectedPaper?.year}
            </DialogTitle>
          </DialogHeader>

          {questionsLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : availableQuestions === 0 ? (
            <div className="py-8 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No questions available for this paper yet.
              </p>
              <Button className="mt-4" onClick={handleBackToPapers}>
                Back to Papers
              </Button>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              <div className="space-y-3">
                <Label className="text-base font-medium">Number of Questions</Label>
                <p className="text-sm text-muted-foreground">
                  {availableQuestions} questions available
                </p>
                <RadioGroup
                  value={selectedQuestionCount.toString()}
                  onValueChange={(v) => setSelectedQuestionCount(parseInt(v))}
                  className="flex flex-wrap gap-2"
                >
                  {QUESTION_OPTIONS.map((count) => (
                    <div key={count}>
                      <RadioGroupItem
                        value={count.toString()}
                        id={`q-${count}`}
                        className="peer sr-only"
                        disabled={count > availableQuestions}
                      />
                      <Label
                        htmlFor={`q-${count}`}
                        className={cn(
                          "flex items-center justify-center px-4 py-2 rounded-md border cursor-pointer transition-colors",
                          "peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground",
                          "hover:bg-accent",
                          count > availableQuestions && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        {count}
                      </Label>
                    </div>
                  ))}
                  <div>
                    <RadioGroupItem
                      value="-1"
                      id="q-all"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="q-all"
                      className={cn(
                        "flex items-center justify-center px-4 py-2 rounded-md border cursor-pointer transition-colors",
                        "peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground",
                        "hover:bg-accent"
                      )}
                    >
                      All ({availableQuestions})
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">Time Limit</Label>
                <RadioGroup
                  value={selectedTime.toString()}
                  onValueChange={(v) => setSelectedTime(parseInt(v))}
                  className="flex flex-wrap gap-2"
                >
                  {TIME_OPTIONS.map((opt) => (
                    <div key={opt.value}>
                      <RadioGroupItem
                        value={opt.value.toString()}
                        id={`t-${opt.value}`}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={`t-${opt.value}`}
                        className={cn(
                          "flex items-center justify-center px-3 py-2 rounded-md border cursor-pointer transition-colors",
                          "peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground",
                          "hover:bg-accent"
                        )}
                      >
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <Button className="w-full" onClick={handleStartTest}>
                <Play className="h-4 w-4 mr-2" />
                Start Test
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // Render Test Interface
  if (testState === "testing") {
    const importantQuestionsCount = testQuestions.filter(q => q.is_important).length;
    const displayedQuestions = questionFilter === "important" 
      ? testQuestions.filter(q => q.is_important)
      : testQuestions;
    const currentQuestion = displayedQuestions[currentQuestionIndex];
    const progress = displayedQuestions.length > 0 
      ? ((currentQuestionIndex + 1) / displayedQuestions.length) * 100 
      : 0;

    // Guard for invalid index when switching tabs
    if (!currentQuestion && displayedQuestions.length > 0) {
      setCurrentQuestionIndex(0);
      return null;
    }

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setTestState("results")}>
              Submit Test
            </Button>
            <span className="text-sm text-muted-foreground">
              Question {currentQuestionIndex + 1} of {displayedQuestions.length}
            </span>
          </div>
          {timeRemaining !== null && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-md",
              timeRemaining < 60 ? "bg-destructive/10 text-destructive" : "bg-muted"
            )}>
              <Timer className="h-4 w-4" />
              <span className="font-mono font-medium">{formatTime(timeRemaining)}</span>
            </div>
          )}
        </div>

        {/* Question Filter Tabs */}
        <Tabs value={questionFilter} onValueChange={(v) => {
          setQuestionFilter(v as "all" | "important");
          setCurrentQuestionIndex(0);
        }}>
          <TabsList>
            <TabsTrigger value="all">
              All Questions ({testQuestions.length})
            </TabsTrigger>
            <TabsTrigger value="important" disabled={importantQuestionsCount === 0}>
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500 mr-1" />
              Important ({importantQuestionsCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Progress value={progress} className="h-2" />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Question Card */}
          <Card className="lg:col-span-3">
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Badge variant="outline">
                      {currentQuestion.difficulty}
                    </Badge>
                    {currentQuestion.is_important && (
                      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500 mr-1" />
                        Important
                      </Badge>
                    )}
                  </div>
                  <div className="text-lg">
                    <MathpixRenderer mmdText={currentQuestion.question_text} inline />
                  </div>
                </div>
                <Button
                  variant={flaggedQuestions.has(currentQuestion.id) ? "default" : "ghost"}
                  size="icon"
                  onClick={() => toggleFlag(currentQuestion.id)}
                >
                  <Flag className="h-4 w-4" />
                </Button>
              </div>

              {isWrittenAnswerQuestion(currentQuestion) ? (
                // Written answer question - show textarea and image upload
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Pencil className="h-4 w-4" />
                    <span>Write your answer below or upload an image of your handwritten solution</span>
                  </div>
                  
                  <Textarea
                    placeholder="Type your answer here..."
                    value={answers[currentQuestion.id] || ""}
                    onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                    className="min-h-[120px]"
                  />
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">OR</span>
                    </div>
                  </div>
                  
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-accent/50 transition-colors">
                    {uploadingImage === currentQuestion.id ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-sm text-muted-foreground">Uploading...</span>
                      </div>
                    ) : answerImages[currentQuestion.id] ? (
                      <div className="space-y-3">
                        <img 
                          src={answerImages[currentQuestion.id]} 
                          alt="Your answer" 
                          className="max-h-48 mx-auto rounded-lg shadow-sm"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setAnswerImages(prev => {
                              const next = { ...prev };
                              delete next[currentQuestion.id];
                              return next;
                            });
                          }}
                        >
                          Remove & Upload New
                        </Button>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm font-medium">Click to upload image</span>
                        <span className="text-xs text-muted-foreground">
                          JPG, PNG up to 10MB
                        </span>
                        <Input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(currentQuestion.id, file);
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ) : isIntegerQuestion(currentQuestion) ? (
                // Integer type question - show text input
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">
                    Enter your numeric answer:
                  </Label>
                  <Input
                    type="text"
                    placeholder="Enter your answer (e.g., 42, -5, 3.14)"
                    value={answers[currentQuestion.id] || ""}
                    onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                    className="text-lg font-mono"
                  />
                </div>
              ) : isSubjectiveQuestion(currentQuestion) ? (
                // Subjective question - show textarea
                <div className="space-y-3">
                  <Label className="text-sm text-muted-foreground">
                    Write your answer:
                  </Label>
                  <Textarea
                    placeholder="Type your answer here..."
                    value={answers[currentQuestion.id] || ""}
                    onChange={(e) => handleAnswer(currentQuestion.id, e.target.value)}
                    className="min-h-[120px]"
                  />
                </div>
              ) : (
                // MCQ question - show radio buttons
                <RadioGroup
                  value={answers[currentQuestion.id] || ""}
                  onValueChange={(value) => handleAnswer(currentQuestion.id, value)}
                  className="space-y-3"
                >
                  {Object.keys(currentQuestion.options || {}).sort().map((key) => (
                    <div
                      key={key}
                      className={cn(
                        "flex items-center space-x-3 p-4 rounded-lg border transition-colors",
                        answers[currentQuestion.id] === key
                          ? "border-primary bg-primary/5"
                          : "hover:bg-accent"
                      )}
                    >
                      <RadioGroupItem value={key} id={`opt-${key}`} />
                      <Label htmlFor={`opt-${key}`} className="flex-1 cursor-pointer flex items-start">
                        <span className="font-medium mr-2">{key}.</span>
                        <MathpixRenderer mmdText={getOptionText(currentQuestion, key)} inline className="inline" />
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((i) => i - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                {currentQuestionIndex === displayedQuestions.length - 1 ? (
                  <Button onClick={handleSubmit} disabled={isExtractingImages}>
                    {isExtractingImages ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing Images...
                      </>
                    ) : (
                      "Submit Test"
                    )}
                  </Button>
                ) : (
                  <Button onClick={() => setCurrentQuestionIndex((i) => i + 1)}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Question Palette */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Question Palette</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {displayedQuestions.map((q, idx) => {
                  // Question is answered if it has text answer OR image answer OR extracted image answer
                  const isAnswered = !!answers[q.id] || !!answerImages[q.id] || !!extractedImageAnswers[q.id];
                  
                  return (
                    <Button
                      key={q.id}
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-8 w-8 p-0 relative",
                        idx === currentQuestionIndex && "ring-2 ring-primary",
                        isAnswered && "bg-primary text-primary-foreground",
                        flaggedQuestions.has(q.id) && "border-orange-500 border-2"
                      )}
                      onClick={() => setCurrentQuestionIndex(idx)}
                    >
                      {idx + 1}
                      {q.is_important && (
                        <Star className="absolute -top-1 -right-1 h-3 w-3 fill-yellow-500 text-yellow-500" />
                      )}
                    </Button>
                  );
                })}
              </div>
              <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded border bg-primary" />
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded border border-orange-500 border-2" />
                  <span>Flagged</span>
                </div>
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  <span>Important</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded border" />
                  <span>Not Answered</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Empty state for Important tab */}
        {questionFilter === "important" && displayedQuestions.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                <Star className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>No important questions marked in this paper.</p>
                <Button 
                  variant="link" 
                  onClick={() => setQuestionFilter("all")}
                  className="mt-2"
                >
                  View all questions
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return null;
}
