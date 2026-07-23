import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Edit, Trash2, Eye, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { MathpixRenderer } from "./MathpixRenderer";

interface QuestionPreviewProps {
  question: any;
  onEdit: (question: any) => void;
  onDelete: (id: string) => void;
  onVerify: (id: string, verified: boolean, isImportant?: boolean) => void;
}

export function QuestionPreview({ question, onEdit, onDelete, onVerify }: QuestionPreviewProps) {
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [isImportant, setIsImportant] = useState(false);

  const renderContent = (content: string, containsFormula: boolean, images?: string[]) => {
    if (!content) return null;
    
    return (
      <div className="prose prose-sm max-w-none space-y-2">
        <MathpixRenderer mmdText={content} inline={true} />
        {images?.map((img, index) => (
          <img 
            key={index}
            src={img} 
            alt={`Content image ${index + 1}`}
            className="max-w-full h-auto rounded border my-2"
          />
        ))}
      </div>
    );
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "bg-green-100 text-green-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "hard": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleVerifyClick = () => {
    setIsImportant(false);
    setShowVerifyDialog(true);
  };

  const handleConfirmVerify = () => {
    onVerify(question.id, true, isImportant);
    setShowVerifyDialog(false);
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-base line-clamp-2">
                <MathpixRenderer mmdText={question.question_text} inline={true} className="[&_.prose]:m-0" />
              </CardTitle>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge className={getDifficultyColor(question.difficulty)}>
                  {question.difficulty}
                </Badge>
                {question.is_verified ? (
                  <Badge variant="outline" className="border-green-500 text-green-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-orange-500 text-orange-700">
                    Pending
                  </Badge>
                )}
                {question.is_important && (
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-500">
                    <Star className="h-3 w-3 mr-1 fill-yellow-500" />
                    Important
                  </Badge>
                )}
                {question.is_ai_generated && (
                  <Badge variant="secondary">AI Generated</Badge>
                )}
                {question.contains_formula && (
                  <Badge variant="outline">Contains Formula</Badge>
                )}
                <Badge variant="outline">{question.marks} mark(s)</Badge>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullPreview(true)}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(question)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(question.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Format: {question.question_format?.replace(/_/g, " ")}
            </div>
            {/* Answer/Options Display */}
            {(() => {
              const qType = question.question_type?.toLowerCase();
              const qFormat = question.question_format?.toLowerCase();
              
              // MCQ with options
              if (question.options && typeof question.options === 'object' && Object.keys(question.options).length > 0) {
                return (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {Object.entries(question.options as Record<string, any>).map(([key, option]) => {
                      const optionText = typeof option === 'string' ? option : option?.text || '';
                      const isCorrect = question.correct_answer === key;
                      return (
                        <div 
                          key={key}
                          className={`p-2 rounded border ${
                            isCorrect 
                              ? "bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600" 
                              : "bg-muted/50 border-border"
                          }`}
                        >
                          <span className="font-medium">{key}.</span>{' '}
                          <span className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_p]:inline">
                            <MathpixRenderer mmdText={optionText} inline={true} />
                          </span>
                          {isCorrect && (
                            <CheckCircle2 className="inline h-4 w-4 ml-1 text-green-600" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }
              
              // Subjective/Written or other types without options
              if (question.correct_answer) {
                return (
                  <div className="mt-2 p-2 rounded border bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600 text-sm">
                    <span className="font-medium">Answer:</span>{' '}
                    <span className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_p]:inline">
                      <MathpixRenderer mmdText={question.correct_answer} inline={true} />
                    </span>
                  </div>
                );
              }
              
              return null;
            })()}
            {!question.is_verified && (
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2"
                onClick={handleVerifyClick}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Verify Question
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Verify Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Verify Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Is this question important for exams or high priority practice?
            </p>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="important"
                checked={isImportant} 
                onCheckedChange={(checked) => setIsImportant(!!checked)} 
              />
              <Label htmlFor="important" className="flex items-center gap-2 cursor-pointer">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                Mark as Important
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerifyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmVerify}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Verify Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Preview Modal */}
      <Dialog open={showFullPreview} onOpenChange={setShowFullPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Question */}
            <div>
              <h4 className="font-semibold mb-2">Question:</h4>
              {renderContent(
                question.question_text, 
                question.contains_formula,
                question.question_image_url ? [question.question_image_url] : []
              )}
            </div>

            {/* Options */}
            {question.options && Object.keys(question.options).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Options:</h4>
                <div className="space-y-2">
                  {Object.entries(question.options).map(([key, value]: [string, any]) => (
                    <div 
                      key={key} 
                      className={`p-3 rounded border ${
                        key === question.correct_answer 
                          ? "bg-green-50 border-green-500" 
                          : "bg-muted"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span className="font-medium">{key}.</span>
                        <div className="flex-1">
                          {renderContent(
                            typeof value === 'string' ? value : value.text, 
                            question.contains_formula,
                            question.option_images?.[key] ? [question.option_images[key]] : []
                          )}
                        </div>
                        {key === question.correct_answer && (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Correct Answer */}
            <div>
              <h4 className="font-semibold mb-2">Correct Answer:</h4>
              <div className="bg-green-100 text-green-800 text-base px-3 py-1 rounded inline-block">
                <MathpixRenderer mmdText={question.correct_answer} inline={true} />
              </div>
            </div>

            {/* Explanation */}
            {question.explanation && (
              <div>
                <h4 className="font-semibold mb-2">Explanation:</h4>
                {renderContent(question.explanation, question.contains_formula)}
              </div>
            )}

            {/* Metadata */}
            <div className="border-t pt-4 text-sm text-muted-foreground">
              <div className="grid grid-cols-2 gap-2">
                <div>Difficulty: <span className="font-medium">{question.difficulty}</span></div>
                <div>Marks: <span className="font-medium">{question.marks}</span></div>
                <div>Format: <span className="font-medium">{question.question_format}</span></div>
                <div>Type: <span className="font-medium">{question.question_type}</span></div>
                {question.is_important && (
                  <div className="col-span-2">
                    <Badge className="bg-yellow-100 text-yellow-800">
                      <Star className="h-3 w-3 mr-1 fill-yellow-500" />
                      Important Question
                    </Badge>
                  </div>
                )}
                {question.contains_formula && (
                  <div>Formula Type: <span className="font-medium">{question.formula_type || 'plain'}</span></div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}