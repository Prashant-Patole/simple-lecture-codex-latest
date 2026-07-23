import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, FileJson, Loader2, Eye, EyeOff, Trash2, BookOpen } from "lucide-react";
import { useDatalab } from "@/hooks/useDatalab";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useExtractJsonQuestions } from "@/hooks/useExtractJsonQuestions";
import { useAddAIAssistantDocument } from "@/hooks/useAIAssistantDocuments";

interface JsonUploadParseWidgetProps {
  currentJson: any;
  onJsonChange: (json: any) => void;
  pdfUrl?: string;
  entityType: "chapter" | "topic" | "subtopic";
  entityName: string;
  // New props for question extraction
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  subtopicId?: string;
  // Parent name for display (e.g., chapter name for topics)
  parentName?: string;
}

export function JsonUploadParseWidget({
  currentJson,
  onJsonChange,
  pdfUrl,
  entityType,
  entityName,
  subjectId,
  chapterId,
  topicId,
  subtopicId,
  parentName,
}: JsonUploadParseWidgetProps) {
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { parsePdfFromUrl, isLoading, progress } = useDatalab();
  const extractQuestions = useExtractJsonQuestions();
  const addDocument = useAddAIAssistantDocument();

  const handleJsonUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      onJsonChange(json);
      toast({
        title: "JSON Uploaded",
        description: `Successfully loaded JSON for ${entityName}`,
      });
    } catch (error) {
      toast({
        title: "Invalid JSON",
        description: "The file does not contain valid JSON",
        variant: "destructive",
      });
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleParsePdf = async () => {
    if (!pdfUrl) {
      toast({
        title: "No PDF",
        description: "Please upload a PDF first before parsing",
        variant: "destructive",
      });
      return;
    }

    const result = await parsePdfFromUrl(pdfUrl);
    if (result) {
      const parsedContent = result.content_json || result;
      onJsonChange(parsedContent);
      
      // Save to ai_assistant_documents if subjectId is provided
      if (subjectId) {
        try {
          const fileName = pdfUrl.split('/').pop() || "document.pdf";
          await addDocument.mutateAsync({
            subjectId,
            chapterId,
            topicId,
            displayName: parentName ? `${entityName} (${parentName})` : `${entityName} (${entityType})`,
            sourceType: "pdf",
            sourceUrl: pdfUrl,
            fileName,
            contentPreview: JSON.stringify(parsedContent).substring(0, 500),
            fullContent: parsedContent,
          });
          
          toast({
            title: "PDF Parsed & Saved",
            description: `Document added to AI Assistant for ${entityName}`,
          });
        } catch (error) {
          // Still show success for parsing even if document save fails
          toast({
            title: "PDF Parsed",
            description: `Parsed successfully but couldn't save to Documents tab`,
          });
        }
      } else {
        toast({
          title: "PDF Parsed",
          description: `Successfully parsed PDF for ${entityName}`,
        });
      }
    }
  };

  const handleClearJson = () => {
    onJsonChange(null);
    toast({
      title: "JSON Cleared",
      description: `Removed JSON content from ${entityName}`,
    });
  };

  const hasJson = currentJson && Object.keys(currentJson).length > 0;
  const canExtractQuestions = hasJson && subjectId && chapterId;

  const handleExtractQuestions = () => {
    if (!subjectId || !chapterId) {
      toast({
        title: "Missing Information",
        description: "Subject and chapter information is required to extract questions",
        variant: "destructive",
      });
      return;
    }

    extractQuestions.mutate({
      contentJson: currentJson,
      subjectId,
      chapterId,
      topicId,
      subtopicId,
      entityType,
      entityName,
    });
  };

  return (
    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
      <Label className="text-sm font-medium">Document JSON Content</Label>
      
      <div className="flex flex-wrap gap-2">
        {/* Upload JSON Button */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload JSON
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleJsonUpload}
          className="hidden"
        />

        {/* Parse PDF Button - only show if no JSON exists (since auto-parse handles initial parsing) */}
        {!hasJson && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleParsePdf}
            disabled={!pdfUrl || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Parsing...
              </>
            ) : (
              <>
                <FileJson className="h-4 w-4 mr-2" />
                Parse PDF to JSON
              </>
            )}
          </Button>
        )}

        {/* Re-parse Button - only show if JSON exists */}
        {hasJson && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleParsePdf}
            disabled={!pdfUrl || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Re-parsing...
              </>
            ) : (
              <>
                <FileJson className="h-4 w-4 mr-2" />
                Re-parse PDF
              </>
            )}
          </Button>
        )}

        {/* Clear JSON Button */}
        {hasJson && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearJson}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}
      </div>

      {/* Push to Question Bank Button */}
      {canExtractQuestions && (
        <div className="pt-2 border-t">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleExtractQuestions}
            disabled={extractQuestions.isPending}
            className="w-full"
          >
            {extractQuestions.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Extracting MCQs...
              </>
            ) : (
              <>
                <BookOpen className="h-4 w-4 mr-2" />
                Push to Question Bank
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Extract MCQs from JSON and add to question bank with LLM difficulty analysis
          </p>
        </div>
      )}

      {/* Progress */}
      {isLoading && progress && (
        <p className="text-xs text-muted-foreground">{progress}</p>
      )}

      {/* JSON Preview */}
      {hasJson && (
        <Collapsible open={showPreview} onOpenChange={setShowPreview}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                JSON Content Available
              </span>
              {showPreview ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-auto max-h-48">
              {JSON.stringify(currentJson, null, 2).substring(0, 2000)}
              {JSON.stringify(currentJson, null, 2).length > 2000 && "..."}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      )}

      {!hasJson && !isLoading && (
        <p className="text-xs text-muted-foreground">
          Upload a JSON file or parse the PDF to extract structured content for AI Teaching Assistant.
        </p>
      )}
    </div>
  );
}
