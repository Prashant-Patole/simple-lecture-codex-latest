import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  FileText, 
  Loader2, 
  Trash2, 
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Brain,
  AlertCircle,
  Upload,
  Star
} from "lucide-react";
import { useDPPDocuments, useDeleteDPPDocument, useDPPQuestions } from "@/hooks/useDPPDocuments";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectManagement";
import { useDatalab } from "@/hooks/useDatalab";
import { useAnalyzeDocument } from "@/hooks/useAnalyzeDocument";
import { useExtractQuestionsAI, ExtractQuestionsResponse } from "@/hooks/useExtractQuestionsAI";
import { useBulkInsertPreviousYearQuestions, ExtractedQuestion } from "@/hooks/usePreviousYearQuestions";
import { DocumentAnalysisPreview } from "./DocumentAnalysisPreview";
import type { DocumentAnalysis } from "@/types/documentAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { MathpixRenderer } from "./MathpixRenderer";
import { useB2Upload } from "@/hooks/useB2Upload";
import { generateB2Path } from "@/lib/b2PathGenerator";

interface SubjectDPPTabProps {
  subjectId: string;
  subjectName: string;
}

// New step flow matching PYQ
type Step = "form" | "uploading" | "parsing" | "analyzing" | "analysis_preview" | "extracting" | "preview" | "saving";

export const SubjectDPPTab = ({ subjectId, subjectName }: SubjectDPPTabProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>("form");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Extracted questions for preview (NOT yet saved)
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
  const [importantQuestions, setImportantQuestions] = useState<Set<number>>(new Set());
  
  // Document analysis state (Phase 1)
  const [documentAnalysis, setDocumentAnalysis] = useState<DocumentAnalysis | null>(null);
  const [parsedJson, setParsedJson] = useState<any>(null);
  const [parsedMarkdown, setParsedMarkdown] = useState<string>("");
  
  // Extraction metadata
  const [extractionMeta, setExtractionMeta] = useState<{
    answersFound?: number;
    answersApplied?: number;
    missingAnswers?: number[];
    completionRate?: string;
  } | null>(null);
  
  // B2 upload state
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  
  const [formData, setFormData] = useState({
    display_name: '',
    chapter_id: '',
    topic_id: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Hooks
  const { data: documents, isLoading } = useDPPDocuments(subjectId);
  const { data: chapters } = useSubjectChapters(subjectId);
  const { data: topics } = useChapterTopics(formData.chapter_id || undefined);
  const deleteDocument = useDeleteDPPDocument();
  const { data: selectedDocQuestions } = useDPPQuestions(selectedDocumentId || undefined);
  const { parsePdfFile, isLoading: isParsing, progress: parseProgress } = useDatalab();
  const { uploadFile: uploadToB2, uploading: b2Uploading, progress: b2Progress } = useB2Upload();
  
  // NEW: Intelligent extraction hooks
  const analyzeDocument = useAnalyzeDocument();
  const extractQuestionsAI = useExtractQuestionsAI();
  const bulkInsertQuestions = useBulkInsertPreviousYearQuestions();

  const resetForm = () => {
    setFormData({ display_name: '', chapter_id: '', topic_id: '' });
    setSelectedFile(null);
    setExtractedQuestions([]);
    setImportantQuestions(new Set());
    setDocumentAnalysis(null);
    setParsedJson(null);
    setParsedMarkdown("");
    setExtractionMeta(null);
    setUploadedFileUrl("");
    setCategoryId("");
    setCurrentStep("form");
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setIsAddDialogOpen(open);
  };

  const handleStartProcessing = async () => {
    if (!selectedFile || !formData.display_name || !formData.chapter_id || !formData.topic_id) {
      toast({
        title: "Missing information",
        description: "Please fill all required fields and select a PDF file.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Step 1: Upload PDF to B2
      setCurrentStep("uploading");
      
      // Fetch subject details for B2 path generation
      const { data: subjectDetails } = await supabase
        .from('popular_subjects')
        .select(`
          name,
          category_id,
          categories!inner (
            name,
            parent_id,
            parent:categories!parent_id (name)
          )
        `)
        .eq('id', subjectId)
        .single();

      // Fetch chapter name
      const { data: chapterDetails } = await supabase
        .from('subject_chapters')
        .select('title')
        .eq('id', formData.chapter_id)
        .single();

      const catId = subjectDetails?.category_id || 'd1807178-486e-483b-bdb9-a2b095eb96e8';
      setCategoryId(catId);
      
      // Generate B2 path
      const parentCategoryName = (subjectDetails?.categories as any)?.parent?.name || 'General';
      const subCategoryName = (subjectDetails?.categories as any)?.name || 'Default';
      
      const b2Path = generateB2Path({
        parentCategoryName,
        subCategoryName,
        subjectName: subjectDetails?.name || 'Unknown',
        chapterName: chapterDetails?.title,
        entityType: 'previous_year_paper',
        entityName: formData.display_name,
        fileName: selectedFile.name,
      });

      const uploadResult = await uploadToB2(selectedFile, b2Path, {
        entityType: 'dpp',
        categoryId: catId,
        subjectId: subjectId,
        chapterId: formData.chapter_id,
        topicId: formData.topic_id || undefined,
      });

      if (!uploadResult?.success) {
        throw new Error('Failed to upload PDF to storage');
      }

      setUploadedFileUrl(uploadResult.filePath);

      // Step 2: Parse PDF with Datalab
      setCurrentStep("parsing");
      const parseResult = await parsePdfFile(selectedFile);

      if (!parseResult || !parseResult.success) {
        toast({
          title: "Parsing failed",
          description: "Could not parse the PDF. Please try again.",
          variant: "destructive",
        });
        setCurrentStep("form");
        return;
      }

      // Store parsed content
      setParsedJson(parseResult.content_json || null);
      setParsedMarkdown(parseResult.content_markdown || "");

      // Step 3: Analyze document structure (Phase 1)
      setCurrentStep("analyzing");
      
      const analysis = await analyzeDocument.mutateAsync({
        contentMarkdown: parseResult.content_markdown,
        contentJson: parseResult.content_json,
        documentName: formData.display_name,
      });

      setDocumentAnalysis(analysis);
      setCurrentStep("analysis_preview");

    } catch (error) {
      console.error("Error in DPP processing:", error);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setCurrentStep("form");
    }
  };

  // Handle user confirming the analysis and proceeding with extraction
  const handleConfirmAnalysis = async () => {
    if (!documentAnalysis) return;

    try {
      setCurrentStep("extracting");

      // Phase 2: Extract questions with dynamic prompts
      const result = await extractQuestionsAI.mutateAsync({
        contentJson: parsedJson,
        contentMarkdown: parsedMarkdown,
        examName: formData.display_name,
        year: new Date().getFullYear(),
        paperType: "DPP",
        documentType: "practice",
        documentAnalysis,
      });

      if (!result.success) {
        toast({
          title: "Extraction issue",
          description: result.error || "Could not extract questions",
          variant: "destructive",
        });
        setCurrentStep("analysis_preview");
        return;
      }

      // Store extracted questions for preview (NOT saved yet)
      setExtractedQuestions(result.questions);
      
      // Store extraction metadata
      setExtractionMeta({
        answersFound: result.answerKeyStats?.found,
        answersApplied: result.answerKeyStats?.applied,
        missingAnswers: result.answerKeyStats?.missing,
        completionRate: result.extractionStats?.completionRate,
      });

      setCurrentStep("preview");

    } catch (error) {
      console.error("Extraction error:", error);
      toast({
        title: "Extraction failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setCurrentStep("analysis_preview");
    }
  };

  // Handle saving questions to database
  const handleSaveQuestions = async () => {
    if (extractedQuestions.length === 0) {
      toast({
        title: "No questions to save",
        description: "Please extract questions first.",
        variant: "destructive",
      });
      return;
    }

    setCurrentStep("saving");

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Filter questions with valid answers
      const questionsWithAnswers = extractedQuestions.filter(q => 
        q.correct_answer && q.correct_answer.trim() !== "" && q.correct_answer !== "—"
      );

      // Add importance flags
      const questionsWithImportance = questionsWithAnswers.map((q, idx) => ({
        ...q,
        is_important: importantQuestions.has(extractedQuestions.indexOf(q))
      }));

      // Create uploaded_question_documents record
      const { data: docRecord, error: docError } = await supabase
        .from('uploaded_question_documents')
        .insert({
          subject_id: subjectId,
          category_id: categoryId,
          chapter_id: formData.chapter_id,
          topic_id: formData.topic_id || null,
          display_name: formData.display_name,
          document_purpose: 'dpp',
          status: 'completed',
          questions_count: questionsWithImportance.length,
          file_type: 'pdf',
          file_name: selectedFile?.name || 'dpp-document.pdf',
          file_url: uploadedFileUrl,
          questions_file_url: uploadedFileUrl,
          uploaded_by: user?.id || '',
        })
        .select()
        .single();

      if (docError || !docRecord) {
        throw new Error('Failed to create document record');
      }

      // Bulk insert questions
      await bulkInsertQuestions.mutateAsync({
        questions: questionsWithImportance,
        paperId: null,
        topicId: formData.topic_id,
        subjectId,
        chapterId: formData.chapter_id,
        documentPurpose: 'dpp',
        sourceDocumentId: docRecord.id,
      });

      // Also create dpp_documents record for DPP-specific tracking
      await supabase.from('dpp_documents').insert({
        subject_id: subjectId,
        chapter_id: formData.chapter_id,
        topic_id: formData.topic_id,
        display_name: formData.display_name,
        questions_mmd: parsedMarkdown,
        status: 'completed',
        questions_count: questionsWithImportance.length,
        created_by: user?.id,
      });

      // Refresh documents list
      queryClient.invalidateQueries({ queryKey: ['dpp-documents', subjectId] });
      queryClient.invalidateQueries({ queryKey: ['subject-uploaded-documents', subjectId] });

      toast({
        title: "Questions saved",
        description: `Successfully saved ${questionsWithImportance.length} questions to Question Bank.`,
      });

      handleDialogClose(false);

    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setCurrentStep("preview");
    }
  };

  const handleDelete = async (documentId: string) => {
    if (confirm('Are you sure you want to delete this document and all its questions?')) {
      await deleteDocument.mutateAsync({ documentId, subjectId });
    }
  };

  const toggleImportant = (index: number) => {
    const newSet = new Set(importantQuestions);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setImportantQuestions(newSet);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>DPP Document Upload</CardTitle>
            <CardDescription>
              Upload PDFs to extract questions to Question Bank (tagged as DPP). Uses intelligent two-phase extraction.
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add DPP
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl h-[90vh] min-h-0 overflow-hidden flex flex-col">
              <DialogHeader className="shrink-0">
                <DialogTitle>Add DPP Document</DialogTitle>
                <DialogDescription>
                  Upload a PDF and questions will be automatically extracted using AI analysis
                </DialogDescription>
              </DialogHeader>

              {/* Body wrapper for all steps */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {/* Form Step */}
                {currentStep === "form" && (
                  <div className="space-y-4 py-4 flex-1 min-h-0 overflow-y-auto">
                  <div className="space-y-2">
                    <Label>Display Name *</Label>
                    <Input
                      value={formData.display_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                      placeholder="e.g., Complex Numbers DPP Set 1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Chapter *</Label>
                      <Select
                        value={formData.chapter_id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, chapter_id: value, topic_id: '' }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a chapter" />
                        </SelectTrigger>
                        <SelectContent>
                          {chapters?.map((chapter) => (
                            <SelectItem key={chapter.id} value={chapter.id}>
                              {chapter.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Topic *</Label>
                      <Select
                        value={formData.topic_id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, topic_id: value }))}
                        disabled={!formData.chapter_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={formData.chapter_id ? "Select a topic" : "Select chapter first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {topics?.map((topic) => (
                            <SelectItem key={topic.id} value={topic.id}>
                              {topic.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Upload PDF *</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    <div 
                      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {selectedFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <FileText className="h-5 w-5 text-green-500" />
                          <span className="text-sm font-medium">{selectedFile.name}</span>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFile(null);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">
                          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>Click to select PDF file</p>
                          <p className="text-xs mt-1">Supports various question types (MCQ, Integer, etc.)</p>
                        </div>
                      )}
                    </div>
                  </div>


                  <Button 
                    onClick={handleStartProcessing}
                    disabled={!selectedFile || !formData.display_name || !formData.chapter_id || !formData.topic_id}
                    className="w-full"
                    size="lg"
                  >
                    Start Processing
                  </Button>
                </div>
              )}

                {/* Uploading Step */}
                {currentStep === "uploading" && (
                  <div className="py-12 flex-1 min-h-0 flex flex-col items-center justify-center space-y-4">
                  <Upload className="h-12 w-12 animate-pulse text-primary" />
                  <p className="text-lg font-medium">Uploading PDF to Storage...</p>
                  <p className="text-sm text-muted-foreground">Please wait while we upload your file</p>
                  <Progress value={b2Progress} className="w-64" />
                  <p className="text-xs text-muted-foreground">{b2Progress}% complete</p>
                </div>
              )}

                {/* Parsing Step */}
                {currentStep === "parsing" && (
                  <div className="py-12 flex-1 min-h-0 flex flex-col items-center justify-center space-y-4">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-lg font-medium">Parsing PDF...</p>
                  <p className="text-sm text-muted-foreground">{parseProgress}</p>
                  <Progress value={50} className="w-64" />
                  <p className="text-xs text-muted-foreground">This may take 1-2 minutes</p>
                </div>
              )}

                {/* Analyzing Step */}
                {currentStep === "analyzing" && (
                  <div className="py-12 flex-1 min-h-0 flex flex-col items-center justify-center space-y-4">
                  <Brain className="h-12 w-12 animate-pulse text-primary" />
                  <p className="text-lg font-medium">Analyzing Document Structure...</p>
                  <p className="text-sm text-muted-foreground">Detecting question types and formats</p>
                  <Progress value={75} className="w-64" />
                  <p className="text-xs text-muted-foreground">Identifying patterns and answer key locations</p>
                </div>
              )}

                {/* Analysis Preview Step */}
                {currentStep === "analysis_preview" && documentAnalysis && (
                  <div className="py-4 flex-1 min-h-0 overflow-hidden">
                  <DocumentAnalysisPreview
                    analysis={documentAnalysis}
                    onConfirm={handleConfirmAnalysis}
                    onCancel={() => setCurrentStep("form")}
                    isExtracting={extractQuestionsAI.isPending}
                    extractionInput={{
                      hasJson: parsedJson != null,
                      hasMarkdown: (parsedMarkdown?.trim().length ?? 0) > 100
                    }}
                  />
                </div>
              )}

                {/* Extracting Step */}
                {currentStep === "extracting" && (
                  <div className="py-12 flex-1 min-h-0 flex flex-col items-center justify-center space-y-4">
                  <Brain className="h-12 w-12 animate-pulse text-primary" />
                  <p className="text-lg font-medium">Extracting Questions with AI...</p>
                  <p className="text-sm text-muted-foreground">
                    Using dynamic prompts based on document analysis
                  </p>
                  <Progress value={85} className="w-64" />
                  <p className="text-xs text-muted-foreground">
                    Extracting ~{documentAnalysis?.totalEstimatedQuestions || "?"} questions
                  </p>
                </div>
              )}

                {/* Preview Step - Questions NOT yet saved */}
                {currentStep === "preview" && (
                  <div className="space-y-4 py-4 flex-1 min-h-0 overflow-hidden flex flex-col">
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    {extractedQuestions.length > 0 ? (
                      <CheckCircle className="h-6 w-6 text-green-500" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-yellow-500" />
                    )}
                    <div className="flex-1">
                      <p className="font-semibold text-lg">
                        Extracted {extractedQuestions.length} questions
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {extractionMeta?.completionRate && `Completion rate: ${extractionMeta.completionRate}`}
                        {extractionMeta?.answersApplied !== undefined && ` • ${extractionMeta.answersApplied} answers applied`}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Click the star to mark important questions. Questions will be saved when you click "Save Questions".
                  </p>

                  <ScrollArea className="h-[350px] border rounded-md p-4">
                    <div className="space-y-6 pr-4">
                      {extractedQuestions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                          <p>No questions could be extracted from the PDF.</p>
                          <p className="text-sm">Please check the PDF format and try again.</p>
                        </div>
                      ) : (
                        extractedQuestions.map((q, index) => (
                          <div key={index} className="border-b pb-4 last:border-0">
                            <div className="flex items-start gap-3">
                              <div className="flex flex-col items-center gap-1">
                                <Badge variant="outline" className="shrink-0">
                                  Q{q.question_number || index + 1}
                                </Badge>
                                <button
                                  onClick={() => toggleImportant(index)}
                                  className={`p-1 rounded hover:bg-muted ${importantQuestions.has(index) ? 'text-yellow-500' : 'text-muted-foreground'}`}
                                  title="Mark as important"
                                >
                                  <Star className={`h-4 w-4 ${importantQuestions.has(index) ? 'fill-current' : ''}`} />
                                </button>
                              </div>
                              <div className="flex-1 space-y-3">
                                <div className="text-sm">
                                  <MathpixRenderer mmdText={q.question_text} inline={false} />
                                </div>
                                {q.options && Object.keys(q.options).length > 0 && (
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    {Object.entries(q.options).map(([key, value]) => (
                                      <div 
                                        key={key} 
                                        className={`flex items-start gap-1 ${key.toLowerCase() === q.correct_answer?.toLowerCase() ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}
                                      >
                                        <span className="shrink-0 font-medium">{key.toUpperCase()}:</span>
                                        <span className="flex-1">
                                          <MathpixRenderer mmdText={typeof value === 'object' ? (value as any).text : String(value)} inline={true} />
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className="text-xs">
                                    {q.difficulty || 'Medium'}
                                  </Badge>
                                  <Badge variant={q.correct_answer ? "outline" : "destructive"} className="text-xs">
                                    Ans: {q.correct_answer?.toUpperCase() || '—'}
                                  </Badge>
                                  <Badge variant="secondary" className="text-xs">
                                    {q.question_type}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setCurrentStep("analysis_preview")} className="flex-1">
                      Back to Analysis
                    </Button>
                    <Button 
                      onClick={handleSaveQuestions} 
                      disabled={extractedQuestions.length === 0}
                      className="flex-1"
                    >
                      Save {extractedQuestions.length} Questions
                    </Button>
                  </div>
                </div>
              )}

                {/* Saving Step */}
                {currentStep === "saving" && (
                  <div className="py-12 flex-1 min-h-0 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg font-medium">Saving Questions...</p>
                    <p className="text-sm text-muted-foreground">
                      Adding {extractedQuestions.length} questions to Question Bank
                    </p>
                    <Progress value={90} className="w-64" />
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {documents && documents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Chapter</TableHead>
                  <TableHead>Topic</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => {
                  const chapter = chapters?.find(c => c.id === doc.chapter_id);
                  return (
                    <TableRow key={doc.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          {doc.display_name || 'Untitled'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {chapter?.title || '-'}
                      </TableCell>
                      <TableCell>
                        {(doc as any).topic?.title || '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(doc.status)}
                        {doc.error_message && (
                          <p className="text-xs text-destructive mt-1">{doc.error_message}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{doc.questions_count || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(doc.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedDocumentId(doc.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDelete(doc.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No DPP documents uploaded yet</p>
              <p className="text-sm mt-1">Click "Add DPP" to upload your first document</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question Preview Dialog */}
      <Dialog open={!!selectedDocumentId} onOpenChange={(open) => !open && setSelectedDocumentId(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>DPP Questions Preview</DialogTitle>
            <DialogDescription>
              Viewing questions from this DPP document
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              {selectedDocQuestions?.map((q, index) => (
                <div key={q.id} className="border-b pb-4 last:border-0">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-1">
                      Q{q.question_number || index + 1}
                    </Badge>
                    <div className="flex-1 space-y-3">
                      <div className="text-sm">
                        <MathpixRenderer mmdText={q.question_text} inline={false} />
                      </div>
                      {q.options && typeof q.options === 'object' && Object.keys(q.options).length > 0 && (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          {Object.entries(q.options as Record<string, string>).map(([key, text]) => (
                            <div 
                              key={key} 
                              className={`flex items-start gap-1 ${key.toLowerCase() === q.correct_answer?.toLowerCase() ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}
                            >
                              <span className="shrink-0 font-medium">{key.toUpperCase()}:</span>
                              <span className="flex-1">
                                <MathpixRenderer mmdText={String(text)} inline={true} />
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {q.difficulty || 'medium'}
                        </Badge>
                        <Badge variant={q.correct_answer ? "outline" : "destructive"} className="text-xs">
                          Ans: {q.correct_answer?.toUpperCase() || '—'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {(!selectedDocQuestions || selectedDocQuestions.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No questions found for this document</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
