import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  FileSearch, 
  CheckCircle, 
  XCircle, 
  Brain, 
  Layers,
  Hash,
  FileText,
  Settings,
  AlertTriangle
} from "lucide-react";
import type { DocumentAnalysis } from "@/types/documentAnalysis";
import {
  questionTypeLabels,
  answerKeyLocationLabels,
  extractionApproachLabels,
} from "@/types/documentAnalysis";

interface DocumentAnalysisPreviewProps {
  analysis: DocumentAnalysis;
  onConfirm: () => void;
  onCancel: () => void;
  isExtracting?: boolean;
  extractionInput?: { hasJson: boolean; hasMarkdown: boolean };
}

export function DocumentAnalysisPreview({
  analysis,
  onConfirm,
  onCancel,
  isExtracting = false,
  extractionInput,
}: DocumentAnalysisPreviewProps) {
  const canProceed = extractionInput ? (extractionInput.hasJson || extractionInput.hasMarkdown) : true;
  const totalTypesCount = analysis.questionTypes.reduce((sum, t) => sum + t.count, 0);
  const hasMixedTypes = analysis.questionTypes.length > 1;

  return (
    <Card className="w-full h-full min-h-0 flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileSearch className="h-5 w-5 text-primary" />
          Document Structure Analysis
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 min-h-0 p-0 flex flex-col">
        <ScrollArea className="flex-1 min-h-0 px-6 py-4">
          <div className="space-y-4">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Estimated Questions
                </Label>
                <p className="text-2xl font-bold text-primary">
                  {analysis.totalEstimatedQuestions}
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Answer Key
                </Label>
                <Badge 
                  variant={analysis.hasAnswerKey ? "default" : "secondary"}
                  className={analysis.hasAnswerKey ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {analysis.hasAnswerKey ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> {answerKeyLocationLabels[analysis.answerKeyLocation]}</>
                  ) : (
                    <><XCircle className="h-3 w-3 mr-1" /> Not Found</>
                  )}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Question Types */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="h-3 w-3" /> Question Types Detected
              </Label>
              <div className="flex flex-wrap gap-2">
                {analysis.questionTypes.map((qt, index) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="text-xs py-1"
                  >
                    <span className="font-medium">{questionTypeLabels[qt.type] || qt.type}</span>
                    <span className="ml-1 text-muted-foreground">({qt.count})</span>
                    {qt.questionRange && (
                      <span className="ml-1 text-primary">Q{qt.questionRange}</span>
                    )}
                  </Badge>
                ))}
              </div>
              {hasMixedTypes && (
                <p className="text-xs text-muted-foreground">
                  Mixed document with {analysis.questionTypes.length} question types
                </p>
              )}
            </div>

            <Separator />

            {/* Document Sections */}
            {analysis.documentSections.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Document Sections</Label>
                <ScrollArea className="h-20">
                  <ul className="text-xs space-y-1">
                    {analysis.documentSections.map((section, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="font-medium">{section.name}</span>
                        <Badge variant="secondary" className="text-[10px] py-0">
                          {section.purpose}
                        </Badge>
                        <span className="text-muted-foreground">({section.approximatePosition})</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}

            {/* Format Patterns */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Settings className="h-3 w-3" /> Format Patterns
              </Label>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">
                  Numbers: <code className="ml-1">{analysis.formatPatterns.questionNumberFormat}</code>
                </Badge>
                {analysis.formatPatterns.optionFormat && (
                  <Badge variant="secondary">
                    Options: <code className="ml-1">{analysis.formatPatterns.optionFormat}</code>
                  </Badge>
                )}
                {analysis.formatPatterns.hasMathNotation && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    Math/LaTeX
                  </Badge>
                )}
                {analysis.formatPatterns.hasImages && (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    Has Images
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Extraction Strategy */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Brain className="h-3 w-3" /> Extraction Strategy
              </Label>
              <div className="flex items-center gap-2">
                <Badge className="bg-primary">
                  {extractionApproachLabels[analysis.extractionStrategy.recommendedApproach]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ({analysis.extractionStrategy.suggestedChunkCount} chunks)
                </span>
              </div>
            </div>

            {/* Special Instructions */}
            {analysis.extractionStrategy.specialInstructions.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong className="text-xs">Special handling required:</strong>
                  <ul className="list-disc pl-4 mt-1 text-xs">
                    {analysis.extractionStrategy.specialInstructions.map((inst, i) => (
                      <li key={i}>{inst}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Warning if no answer key */}
            {!analysis.hasAnswerKey && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  No answer key detected. Questions will be extracted without correct answers.
                  You'll need to add answers manually after extraction.
                </AlertDescription>
              </Alert>
            )}

            {/* Info about extraction input mode */}
            {extractionInput && !extractionInput.hasJson && extractionInput.hasMarkdown && (
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Structured data not available; extraction will use Markdown content.
                </AlertDescription>
              </Alert>
            )}

            {/* Error if no content available */}
            {extractionInput && !extractionInput.hasJson && !extractionInput.hasMarkdown && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  No readable content found. Please try re-uploading a clearer PDF.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="shrink-0 flex justify-between pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isExtracting}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={isExtracting || !canProceed}>
          {isExtracting ? (
            <>
              <Brain className="h-4 w-4 mr-2 animate-pulse" />
              Extracting...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Proceed with Extraction
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
