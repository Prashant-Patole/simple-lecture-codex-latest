import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Flame, Trophy, Target, ArrowLeft, ArrowRight, CheckCircle2, XCircle, Loader2, CalendarDays, AlertCircle } from "lucide-react";
import { useTopicDPP, DPPQuestion } from "@/hooks/useTopicDPP";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import DPPGeneratingAnimation from "./DPPGeneratingAnimation";
import { format, isFuture, isToday, isSameDay } from "date-fns";
import { MathpixRenderer } from "@/components/admin/MathpixRenderer";

interface DPTTestProps {
  topicId?: string;
  chapterId?: string;
}

type ViewState = 'dashboard' | 'completed' | 'loading' | 'test' | 'results' | 'no-questions';

export const DPTTest = ({ topicId, chapterId }: DPTTestProps) => {
  const { toast } = useToast();
  const { 
    todaySubmission, 
    isLoadingSubmission, 
    isCompleted, 
    fetchDPPQuestions, 
    submitDPP, 
    streak, 
    completedDates, 
    getSubmissionByDate,
    hasDPPQuestions 
  } = useTopicDPP(topicId, chapterId);
  
  const [view, setView] = useState<ViewState>('dashboard');
  const [questions, setQuestions] = useState<DPPQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  useEffect(() => {
    if (isCompleted && todaySubmission) {
      setView('completed');
      setQuestions(todaySubmission.questions);
      setAnswers(todaySubmission.answers);
    }
  }, [isCompleted, todaySubmission]);

  const handleStartDPP = async () => {
    if (!hasDPPQuestions) {
      setView('no-questions');
      return;
    }

    setView('loading');
    try {
      const result = await fetchDPPQuestions.mutateAsync();
      setQuestions(result.questions);
      setAnswers({});
      setCurrentQuestion(0);
      setStartTime(Date.now());
      setView('test');
    } catch (error) {
      setView('no-questions');
    }
  };

  const handleSelectAnswer = (questionId: number, optionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionId }));
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    const score = questions.reduce((acc, q) => {
      return acc + (answers[q.id] === q.correctAnswer ? 1 : 0);
    }, 0);

    const timeSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;

    await submitDPP.mutateAsync({
      questions,
      answers,
      score,
      timeSeconds
    });

    setView('results');
  };

  const getScore = () => {
    return questions.reduce((acc, q) => {
      return acc + (answers[q.id] === q.correctAnswer ? 1 : 0);
    }, 0);
  };

  if (isLoadingSubmission) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // No questions available view
  if (view === 'no-questions') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setView('dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
            <h3 className="text-xl font-bold mb-2">No DPP Questions Available</h3>
            <p className="text-muted-foreground">
              DPP questions for this topic have not been uploaded yet.
              <br />
              Please check back later or contact your teacher.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading view
  if (view === 'loading') {
    return <DPPGeneratingAnimation />;
  }

  // Test view
  if (view === 'test' && questions.length > 0) {
    const currentQ = questions[currentQuestion];
    const answeredCount = Object.keys(answers).length;
    const isLastQuestion = currentQuestion === questions.length - 1;
    const allAnswered = answeredCount === questions.length;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setView('dashboard')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Exit
          </Button>
          <Badge variant="outline">
            Question {currentQuestion + 1} of {questions.length}
          </Badge>
          <Badge variant="secondary">
            {answeredCount}/{questions.length} Answered
          </Badge>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="capitalize">{currentQ.difficulty}</Badge>
            </div>
            <CardTitle className="text-lg mt-2">
              <MathpixRenderer mmdText={currentQ.question} inline />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentQ.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelectAnswer(currentQ.id, option.id)}
                className={cn(
                  "w-full p-4 text-left rounded-lg border transition-all",
                  answers[currentQ.id] === option.id
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium border",
                    answers[currentQ.id] === option.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border"
                  )}>
                    {option.id}
                  </span>
                  <MathpixRenderer mmdText={option.text} inline className="inline" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>

          {isLastQuestion ? (
            <Button 
              onClick={handleSubmit}
              disabled={!allAnswered || submitDPP.isPending}
            >
              {submitDPP.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit DPP'
              )}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>

        {/* Question navigation dots */}
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setCurrentQuestion(idx)}
              className={cn(
                "w-8 h-8 rounded-full text-sm font-medium transition-all",
                currentQuestion === idx
                  ? "bg-primary text-primary-foreground"
                  : answers[q.id]
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Results view
  if (view === 'results' || view === 'completed') {
    const score = todaySubmission?.score ?? getScore();
    const total = todaySubmission?.total_questions ?? questions.length;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const displayQuestions = todaySubmission?.questions ?? questions;
    const displayAnswers = todaySubmission?.answers ?? answers;

    return (
      <div className="space-y-4">
        <Card className="border-green-500 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500" />
              DPP Completed!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <div className="text-5xl font-bold mb-2">{score}/{total}</div>
              <p className="text-2xl text-muted-foreground">{percentage}%</p>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <div className="text-2xl font-bold">{streak}</div>
                <div className="text-xs text-muted-foreground">Day Streak</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div className="text-2xl font-bold">{score}</div>
                <div className="text-xs text-muted-foreground">Correct</div>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-2xl font-bold">{total - score}</div>
                <div className="text-xs text-muted-foreground">Incorrect</div>
              </div>
            </div>

            <div className="pt-4">
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => {
                  setView('dashboard');
                  setQuestions([]);
                  setAnswers({});
                }}
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Review Questions */}
        <Card>
          <CardHeader>
            <CardTitle>Review Your Answers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {displayQuestions.map((q, idx) => {
              const userAnswer = displayAnswers[q.id];
              const isCorrect = userAnswer === q.correctAnswer;
              
              return (
                <div key={q.id} className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium flex items-start gap-1">
                      Q{idx + 1}. <MathpixRenderer mmdText={q.question} inline />
                    </span>
                    {isCorrect ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    {q.options.map((opt) => (
                      <div
                        key={opt.id}
                        className={cn(
                          "p-2 rounded",
                          opt.id === q.correctAnswer && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
                          opt.id === userAnswer && opt.id !== q.correctAnswer && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        )}
                      >
                        <span className="font-medium">{opt.id}.</span> <MathpixRenderer mmdText={opt.text} inline className="inline" />
                        {opt.id === q.correctAnswer && " ✓ (Correct answer)"}
                        {opt.id === userAnswer && opt.id !== q.correctAnswer && " ✗ (Your answer)"}
                      </div>
                    ))}
                  </div>

                  {q.explanation && (
                    <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded">
                      <strong>Explanation:</strong> <MathpixRenderer mmdText={q.explanation} inline />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Dashboard view
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daily Practice Problems</CardTitle>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Flame className="h-4 w-4 text-orange-500" />
              {streak} Day Streak
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center py-6">
            <Target className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h3 className="text-2xl font-bold mb-2">Today's Challenge</h3>
            <p className="text-muted-foreground mb-6">
              Test your knowledge with 10 questions on this topic
            </p>
            <Button 
              size="lg" 
              onClick={handleStartDPP}
              disabled={fetchDPPQuestions.isPending}
            >
              {fetchDPPQuestions.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                'Start DPP'
              )}
            </Button>
            {!hasDPPQuestions && (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-3">
                No DPP questions available yet for this topic
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold">10</div>
              <div className="text-xs text-muted-foreground">Questions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">Mixed</div>
              <div className="text-xs text-muted-foreground">Difficulty</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Your Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                modifiers={{
                  completed: completedDates
                }}
                modifiersStyles={{
                  completed: {
                    backgroundColor: 'hsl(var(--primary) / 0.2)',
                    color: 'hsl(var(--primary))',
                    fontWeight: 'bold'
                  }
                }}
                disabled={(date) => isFuture(date)}
                className="rounded-md border"
              />
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">
                {isToday(selectedDate) ? "Today's" : format(selectedDate, 'MMM d')} Result
              </h4>
              {(() => {
                const submission = getSubmissionByDate(selectedDate);
                if (!submission) {
                  return (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No DPP completed on this day</p>
                    </div>
                  );
                }

                const percentage = Math.round((submission.score / submission.total_questions) * 100);
                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <span>Score</span>
                      <span className="font-bold">{submission.score}/{submission.total_questions} ({percentage}%)</span>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                      <span>Time Taken</span>
                      <span className="font-bold">{formatTime(submission.time_taken_seconds)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
