import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Flag, CheckCircle, XCircle, Trophy, Loader2, Star } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMCQQuestions, useMCQQuestionCounts, type MCQQuestion, type DifficultyLevel } from "@/hooks/useMCQQuestions";
import { useSubmitTest } from "@/hooks/useQuestions";
import { Skeleton } from "@/components/ui/skeleton";
import { MathpixRenderer } from "@/components/admin/MathpixRenderer";
import { supabase } from "@/integrations/supabase/client";

interface MCQTestProps {
  topicId?: string;
  chapterId?: string;
  chapterOnly?: boolean;
}

export const MCQTest = ({ topicId, chapterId, chapterOnly }: MCQTestProps) => {
  const { data: allQuestions = [], isLoading, error } = useMCQQuestions(topicId, chapterId, chapterOnly);
  const { data: questionCounts } = useMCQQuestionCounts(topicId, chapterId, chapterOnly);
  
  const [testState, setTestState] = useState<'setup' | 'testing' | 'results'>('setup');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('all');
  const [questionCount, setQuestionCount] = useState(5);
  const [timerMinutes, setTimerMinutes] = useState(15);
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [testStartTime, setTestStartTime] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitTestMutation = useSubmitTest(userId || "");

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });
  }, []);

  // Timer effect
  useEffect(() => {
    if (testState !== 'testing' || timerMinutes === 999) return;
    
    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setTestState('results');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [testState, timerMinutes]);

  const startTest = () => {
    let filteredQuestions = allQuestions;
    
    // Filter by difficulty if not "all"
    if (difficulty !== 'all') {
      filteredQuestions = allQuestions.filter(q => q.difficulty === difficulty);
    }
    
    // Shuffle and limit to question count
    const shuffled = [...filteredQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, questionCount);
    
    if (selected.length === 0) {
      return;
    }
    
    setQuestions(selected);
    setTimeRemaining(timerMinutes * 60);
    setTestStartTime(Date.now());
    setTestState('testing');
    setAnswers({});
    setFlagged(new Set());
    setCurrentQuestionIndex(0);
  };

  const submitTest = async () => {
    if (isSubmitting) return;
    
    // If no user, just show results without saving
    if (!userId) {
      setTestState('results');
      return;
    }
    
    setIsSubmitting(true);
    
    const score = calculateScore();
    const timeTaken = timerMinutes === 999 
      ? Math.floor((Date.now() - testStartTime) / 1000) 
      : (timerMinutes * 60) - timeRemaining;
    
    // Build answers array for storage
    const answersData = questions.map((q, idx) => ({
      question_id: q.id,
      selected_answer: answers[idx] || null,
      correct_answer: q.correct_answer,
      is_correct: answers[idx] === q.correct_answer,
    }));
    
    try {
      await submitTestMutation.mutateAsync({
        topicId: topicId || "",
        chapterId: chapterId || "",
        answers: answersData,
        score: score.correct,
        totalMarks: score.total,
        timeTaken,
      });
    } catch (error) {
      console.error("Failed to save test results:", error);
    }
    
    setIsSubmitting(false);
    setTestState('results');
  };

  const handleAnswer = (answerKey: string) => {
    setAnswers({ ...answers, [currentQuestionIndex]: answerKey });
  };

  const toggleFlag = () => {
    const newFlagged = new Set(flagged);
    if (newFlagged.has(currentQuestionIndex)) {
      newFlagged.delete(currentQuestionIndex);
    } else {
      newFlagged.add(currentQuestionIndex);
    }
    setFlagged(newFlagged);
  };

  const calculateScore = () => {
    let correct = 0;
    questions.forEach((q, index) => {
      if (answers[index] === q.correct_answer) {
        correct++;
      }
    });
    return { correct, total: questions.length, percentage: questions.length > 0 ? (correct / questions.length) * 100 : 0 };
  };

  const getOptionText = (question: MCQQuestion, key: string): string => {
    const option = question.options.find(o => o.key === key);
    return option ? option.text : key;
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-destructive">Failed to load questions. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  // Setup Screen
  if (testState === 'setup') {
    const availableCount = difficulty === 'all' 
      ? questionCounts?.all || allQuestions.length
      : questionCounts?.[difficulty] || 0;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Start MCQ Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Difficulty Level</Label>
            <Select value={difficulty} onValueChange={(v: DifficultyLevel) => setDifficulty(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels ({questionCounts?.all || 0})</SelectItem>
                <SelectItem value="Low">Low ({questionCounts?.Low || 0})</SelectItem>
                <SelectItem value="Medium">Medium ({questionCounts?.Medium || 0})</SelectItem>
                <SelectItem value="Intermediate">Intermediate ({questionCounts?.Intermediate || 0})</SelectItem>
                <SelectItem value="Advanced">Advanced ({questionCounts?.Advanced || 0})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Number of Questions (Available: {availableCount})</Label>
            <Select value={questionCount.toString()} onValueChange={(v) => setQuestionCount(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5" disabled={availableCount < 5}>5 Questions</SelectItem>
                <SelectItem value="10" disabled={availableCount < 10}>10 Questions</SelectItem>
                <SelectItem value="15" disabled={availableCount < 15}>15 Questions</SelectItem>
                <SelectItem value="20" disabled={availableCount < 20}>20 Questions</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Timer</Label>
            <Select value={timerMinutes.toString()} onValueChange={(v) => setTimerMinutes(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 Minutes</SelectItem>
                <SelectItem value="30">30 Minutes</SelectItem>
                <SelectItem value="60">60 Minutes</SelectItem>
                <SelectItem value="999">Unlimited</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={startTest} 
            className="w-full" 
            size="lg"
            disabled={availableCount === 0}
          >
            {availableCount === 0 ? "No Questions Available" : "Start Test"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Test Screen
  if (testState === 'testing' && questions.length > 0) {
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

    return (
      <div className="space-y-4">
        {/* Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <span className="font-semibold">
                  {timerMinutes === 999 ? "Unlimited" : `${Math.floor(timeRemaining / 60)}:${(timeRemaining % 60).toString().padStart(2, '0')}`}
                </span>
              </div>
              <Badge variant="secondary">
                Question {currentQuestionIndex + 1} of {questions.length}
              </Badge>
            </div>
            <Progress value={progress} />
          </CardContent>
        </Card>

        {/* Question */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-lg font-semibold">
                    <MathpixRenderer mmdText={currentQuestion.question_text} inline />
                  </div>
                  {currentQuestion.is_important && (
                    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-500">
                      <Star className="h-3 w-3 mr-1 fill-yellow-500" />
                      Important
                    </Badge>
                  )}
                </div>
                {currentQuestion.question_image_url && (
                  <img 
                    src={currentQuestion.question_image_url} 
                    alt="Question" 
                    className="mt-4 max-w-full rounded-lg"
                  />
                )}
              </div>
              <Button
                variant={flagged.has(currentQuestionIndex) ? "destructive" : "outline"}
                size="icon"
                onClick={toggleFlag}
              >
                <Flag className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <RadioGroup value={answers[currentQuestionIndex] || ""} onValueChange={handleAnswer}>
              {currentQuestion.options.map((option) => (
                <div 
                  key={option.key} 
                  className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent cursor-pointer"
                >
                  <RadioGroupItem value={option.key} id={`option-${option.key}`} />
                <Label htmlFor={`option-${option.key}`} className="flex-1 cursor-pointer flex items-start">
                    <span className="font-medium mr-2">{option.key}.</span>
                    <MathpixRenderer mmdText={option.text} inline className="inline" />
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
            disabled={currentQuestionIndex === 0}
          >
            Previous
          </Button>
          {currentQuestionIndex < questions.length - 1 ? (
            <Button
              className="flex-1"
              onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
            >
              Next
            </Button>
          ) : (
            <Button 
              className="flex-1" 
              onClick={submitTest}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Test"
              )}
            </Button>
          )}
        </div>

        {/* Question Palette */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Question Palette</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-10 gap-2">
              {questions.map((q, idx) => (
                <Button
                  key={idx}
                  variant={idx === currentQuestionIndex ? "default" : answers[idx] ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className="relative"
                >
                  {idx + 1}
                  {flagged.has(idx) && (
                    <Flag className="h-3 w-3 absolute -top-1 -right-1 text-destructive" />
                  )}
                  {q.is_important && (
                    <Star className="h-3 w-3 absolute -top-1 -left-1 text-yellow-500 fill-yellow-500" />
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Results Screen
  if (testState === 'results') {
    const score = calculateScore();

    return (
      <div className="space-y-4">
        {/* Score Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center flex flex-col items-center gap-2">
              <Trophy className="h-12 w-12 text-yellow-500" />
              Test Completed!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold">{score.percentage.toFixed(1)}%</div>
              <div className="text-muted-foreground">
                {score.correct} correct out of {score.total} questions
              </div>
            </div>
            <Progress value={score.percentage} className="h-3" />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setTestState('setup')}>
                Retake Test
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Review */}
        <div className="space-y-3">
          {questions.map((question, idx) => {
            const userAnswer = answers[idx];
            const isCorrect = userAnswer === question.correct_answer;

            return (
              <Card key={idx} className={isCorrect ? "border-green-500" : "border-red-500"}>
                <CardHeader>
                  <div className="flex items-start gap-2">
                    {isCorrect ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 mt-1" />
                    )}
                    <div className="flex-1">
                      <CardTitle className="text-base">Question {idx + 1}</CardTitle>
                      <div className="text-sm text-muted-foreground mt-1">
                        <MathpixRenderer mmdText={question.question_text} inline />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-start gap-1">
                    <span className="font-semibold">Your Answer: </span>
                    <span className={isCorrect ? "text-green-600" : "text-red-600"}>
                      {userAnswer ? (
                        <span className="flex items-start gap-1">
                          {userAnswer}. <MathpixRenderer mmdText={getOptionText(question, userAnswer)} inline className="inline" />
                        </span>
                      ) : "Not answered"}
                    </span>
                  </div>
                  {!isCorrect && (
                    <div className="flex flex-wrap items-start gap-1">
                      <span className="font-semibold">Correct Answer: </span>
                      <span className="text-green-600 flex items-start gap-1">
                        {question.correct_answer}. <MathpixRenderer mmdText={getOptionText(question, question.correct_answer)} inline className="inline" />
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <span className="font-semibold">Explanation: </span>
                    <div className="text-sm text-muted-foreground mt-1">
                      <MathpixRenderer mmdText={question.explanation || ""} inline />
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

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-center text-muted-foreground">No questions available for this topic.</p>
      </CardContent>
    </Card>
  );
};
