import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, CheckCircle2, Loader2, Check, Bot, FileText } from "lucide-react";
import { usePendingQuestions } from "@/hooks/usePendingQuestions";
import { useUploadedDocuments } from "@/hooks/useUploadedDocuments";
import { useBulkAutoAssignChapters } from "@/hooks/useBulkAutoAssignChapters";
import { useMarkDocumentVerified } from "@/hooks/useMarkDocumentVerified";
import { ChapterTopicSelector } from "@/components/admin/ChapterTopicSelector";
import { useUpdateQuestionAssignment } from "@/hooks/useUpdateQuestionAssignment";
import { useVerifySingleQuestion } from "@/hooks/useVerifySingleQuestion";
import { useGenerateSolution } from "@/hooks/useGenerateSolution";
import { useApproveSingleQuestion } from "@/hooks/useApproveSingleQuestion";
import { MathpixRenderer } from "@/components/admin/MathpixRenderer";
import { DifficultyBadge } from "@/components/admin/DifficultyBadge";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";

export default function DocumentVerificationDetail() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([]);

  const { data: documents } = useUploadedDocuments({});
  const document = documents?.find((d: any) => d.id === documentId);
  
  const { data: questions } = usePendingQuestions({ documentId });
  const bulkAssignMutation = useBulkAutoAssignChapters();
  const verifyMutation = useMarkDocumentVerified();
  const updateAssignmentMutation = useUpdateQuestionAssignment();
  const verifySingleMutation = useVerifySingleQuestion();
  const generateSolutionMutation = useGenerateSolution();
  const approveSingleMutation = useApproveSingleQuestion();

  const handleBulkAutoAssign = () => {
    if (documentId) {
      bulkAssignMutation.mutate({ documentId });
    }
  };

  const handleCompleteVerification = () => {
    if (documentId) {
      const approvedCount = questions?.filter((q: any) => q.is_approved).length || 0;
      const avgConfidence = questions?.reduce((sum: number, q: any) => sum + (q.llm_confidence_score || 0), 0) / (questions?.length || 1);
      const qualityScore = avgConfidence * (approvedCount / (questions?.length || 1));

      verifyMutation.mutate({
        documentId,
        verificationType: 'human',
        qualityScore,
        notes: 'Verification completed'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/admin/question-bank/verify')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to List
        </Button>
        <div>
          <h2 className="text-3xl font-bold">Verify Questions</h2>
          <p className="text-muted-foreground">{document?.questions_file_name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Bulk Actions</span>
            <div className="flex gap-2">
              <Button onClick={handleBulkAutoAssign} disabled={bulkAssignMutation.isPending}>
                {bulkAssignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                Auto-Assign All
              </Button>
              <Button onClick={handleCompleteVerification} disabled={verifyMutation.isPending}>
                {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Complete Verification
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <div className="space-y-4">
        {questions?.map((q: any, index: number) => (
          <Card key={q.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge className="text-base px-3 py-1">Q{index + 1}</Badge>
                  <Badge variant="outline">{q.question_format.replace('_', ' ')}</Badge>
                  <DifficultyBadge level={q.difficulty} />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => verifySingleMutation.mutate({ questionId: q.id })}
                    disabled={verifySingleMutation.isPending}
                  >
                    {verifySingleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Bot className="h-4 w-4 mr-2" />
                    )}
                    Verify with LLM
                  </Button>
                  {!q.is_approved && (
                    <Button
                      size="sm"
                      onClick={() => {
                        if (confirm('Approve this question and transfer to question bank?')) {
                          approveSingleMutation.mutate({ questionId: q.id });
                        }
                      }}
                      disabled={approveSingleMutation.isPending}
                    >
                      {approveSingleMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Approve
                    </Button>
                  )}
                  {q.is_approved && (
                    <Badge className="bg-green-500">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Approved
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Question Text */}
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <span>Question:</span>
                </h4>
                <div className="p-4 rounded-lg bg-muted/30 border">
                  <MathpixRenderer mmdText={q.question_text} inline />
                </div>
              </div>

              {/* Options for Single Choice */}
              {q.question_format === 'single_choice' && q.options && (
                <div>
                  <h4 className="font-semibold mb-3">Options:</h4>
                  <div className="space-y-2">
                    {Object.entries(q.options).map(([key, value]: [string, any]) => (
                      <div 
                        key={key} 
                        className={`flex items-start gap-3 p-3 rounded-lg border ${
                          key === q.correct_answer 
                            ? 'bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-800' 
                            : 'bg-muted/20'
                        }`}
                      >
                        <input 
                          type="radio" 
                          checked={key === q.correct_answer} 
                          readOnly 
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <span className="font-medium">{key}.</span>{' '}
                          <MathpixRenderer mmdText={value} inline />
                          {key === q.correct_answer && (
                            <Badge className="ml-2 bg-green-600">Correct Answer</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Options for Multiple Choice */}
              {q.question_format === 'multiple_choice' && q.options && (
                <div>
                  <h4 className="font-semibold mb-3">Options (Multiple Correct):</h4>
                  <div className="space-y-2">
                    {Object.entries(q.options).map(([key, value]: [string, any]) => {
                      const isCorrect = Array.isArray(q.correct_answer) 
                        ? q.correct_answer.includes(key)
                        : q.correct_answer.split(',').map((a: string) => a.trim()).includes(key);
                      
                      return (
                        <div 
                          key={key} 
                          className={`flex items-start gap-3 p-3 rounded-lg border ${
                            isCorrect
                              ? 'bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-800' 
                              : 'bg-muted/20'
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={isCorrect} 
                            readOnly 
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <span className="font-medium">{key}.</span>{' '}
                            <MathpixRenderer mmdText={value} inline />
                            {isCorrect && (
                              <Badge className="ml-2 bg-green-600">Correct Answer</Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* True/False */}
              {q.question_format === 'true_false' && (
                <div>
                  <h4 className="font-semibold mb-3">Answer:</h4>
                  <div className="flex gap-4">
                    {['True', 'False'].map((option) => (
                      <div 
                        key={option}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg border flex-1 ${
                          q.correct_answer === option
                            ? 'bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-800'
                            : 'bg-muted/20'
                        }`}
                      >
                        <input 
                          type="radio" 
                          checked={q.correct_answer === option} 
                          readOnly 
                        />
                        <span className="font-medium">{option}</span>
                        {q.correct_answer === option && (
                          <Badge className="ml-auto bg-green-600">Correct</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fill in the Blank */}
              {q.question_format === 'fill_blank' && (
                <div>
                  <h4 className="font-semibold mb-2">Correct Answer:</h4>
                  <div className="p-3 rounded-lg bg-green-50 border border-green-300 dark:bg-green-950/20 dark:border-green-800">
                    <MathpixRenderer mmdText={q.correct_answer} inline />
                  </div>
                </div>
              )}

              <Separator />

              {/* Solution */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Solution:
                  </h4>
                  {!q.explanation && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => generateSolutionMutation.mutate({ questionId: q.id })}
                      disabled={generateSolutionMutation.isPending}
                    >
                      {generateSolutionMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Generate Solution with AI
                    </Button>
                  )}
                </div>
                {q.explanation ? (
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                    <MathpixRenderer mmdText={q.explanation} inline />
                  </div>
                ) : (
                  <div className="p-4 rounded-lg bg-muted/20 border border-dashed text-muted-foreground italic">
                    No solution available. Click "Generate Solution with AI" to create one.
                  </div>
                )}
              </div>

              {/* LLM Verification Status */}
              {q.llm_verified && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      LLM Verification Status:
                    </h4>
                    <div className="p-4 rounded-lg border space-y-3" 
                      style={{
                        backgroundColor: q.llm_verification_status === 'correct' 
                          ? 'hsl(var(--success) / 0.1)' 
                          : q.llm_verification_status === 'medium'
                          ? 'hsl(var(--warning) / 0.1)'
                          : 'hsl(var(--destructive) / 0.1)'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant={
                            q.llm_verification_status === 'correct' ? 'default' : 
                            q.llm_verification_status === 'medium' ? 'secondary' : 
                            'destructive'
                          }
                          className="text-base px-3 py-1"
                        >
                          {q.llm_verification_status === 'correct' ? '✓ Verified Correct' :
                           q.llm_verification_status === 'medium' ? '⚠ Needs Review' :
                           '✗ Issues Found'}
                        </Badge>
                        {q.llm_confidence_score && (
                          <span className="text-sm font-medium">
                            Confidence: {(q.llm_confidence_score * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {q.llm_verification_comments && (
                        <p className="text-sm">{q.llm_verification_comments}</p>
                      )}
                      {q.llm_issues && q.llm_issues.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold mb-1">Issues:</p>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {q.llm_issues.map((issue: string, idx: number) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Chapter/Topic Assignment */}
              {document && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-3">Assign to Chapter & Topic:</h4>
                    <ChapterTopicSelector
                      questionText={q.question_text}
                      subjectId={document.subject_id}
                      subjectName={document.popular_subjects?.name}
                      categoryName={document.categories?.name}
                      currentChapterId={q.chapter_id}
                      currentTopicId={q.topic_id}
                      currentSubtopicId={q.subtopic_id}
                      onAssignmentChange={(chapterId, topicId, subtopicId) => {
                        updateAssignmentMutation.mutate({
                          questionId: q.id,
                          chapterId,
                          topicId,
                          subtopicId
                        });
                      }}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
