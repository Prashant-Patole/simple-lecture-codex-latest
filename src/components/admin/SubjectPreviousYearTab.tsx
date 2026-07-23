import { useState, useEffect, useMemo } from "react";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, FileText, Loader2, CheckCircle, AlertCircle, Brain, Star, Eye } from "lucide-react";
import { usePaperQuestionsView } from "@/hooks/usePaperQuestionsView";
import { cn } from "@/lib/utils";
import { DocumentImageViewer } from "./DocumentImageViewer";
import { usePdfPageRenderer } from "@/hooks/usePdfPageRenderer";
import { PDFPreview } from "./PDFPreview";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  usePreviousYearPapers,
  useCreatePreviousYearPaper,
  useDeletePreviousYearPaper,
  useUploadPaperPDF,
} from "@/hooks/usePreviousYearPapers";
import { useSubjectTests, useDeleteTest, SubjectTest } from "@/hooks/useSubjectTests";
import { useTestQuestionsView } from "@/hooks/useTestQuestionsView";
import {
  useSubjectChapters,
  useChapterTopics,
} from "@/hooks/useSubjectChaptersTopics";
import {
  useBulkInsertPreviousYearQuestions,
  type ExtractedQuestion,
} from "@/hooks/usePreviousYearQuestions";
import {
  useSubjectUploadedDocuments,
  useDeleteUploadedDocument,
  type SubjectUploadedDocument,
} from "@/hooks/useSubjectUploadedDocuments";
import { supabase } from "@/integrations/supabase/client";
import { useDatalab } from "@/hooks/useDatalab";
import { useExtractQuestionsAI } from "@/hooks/useExtractQuestionsAI";
import { useAnalyzeDocument } from "@/hooks/useAnalyzeDocument";
import { DocumentAnalysisPreview } from "./DocumentAnalysisPreview";
import type { DocumentAnalysis } from "@/types/documentAnalysis";
import { MathpixRenderer } from './MathpixRenderer';
import { useB2Upload } from "@/hooks/useB2Upload";
import { generateB2Path } from "@/lib/b2PathGenerator";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

type PaperCategory = "previous_year" | "proficiency" | "exam" | "dpp";

interface SubjectPreviousYearTabProps {
  subjectId: string;
  subjectName: string;
  categoryId: string;
}

type Step = "form" | "parsing" | "analyzing" | "analysis_preview" | "extracting" | "preview" | "saving";

export function SubjectPreviousYearTab({ subjectId, subjectName, categoryId }: SubjectPreviousYearTabProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>("form");
  const [activeTab, setActiveTab] = useState<PaperCategory>("previous_year");
  
  // Uploaded Documents Modal state
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [docsModalTab, setDocsModalTab] = useState<PaperCategory>("previous_year");
  
  // Questions Viewer states (for Papers table)
  const [questionsViewerOpen, setQuestionsViewerOpen] = useState(false);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedPaperName, setSelectedPaperName] = useState("");
  
  // Test states
  const [deleteTestId, setDeleteTestId] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedTestName, setSelectedTestName] = useState("");
  const [testQuestionsViewerOpen, setTestQuestionsViewerOpen] = useState(false);
  const [formData, setFormData] = useState({
    total_questions: 0,
    chapter_id: "",
    topic_id: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
  
  // Filter questions that have valid answers - only these will be saved
  const questionsWithAnswers = useMemo(() => {
    return extractedQuestions.filter(q => 
      q.correct_answer && 
      q.correct_answer.trim() !== "" && 
      q.correct_answer !== "—"
    );
  }, [extractedQuestions]);
  const [importantQuestions, setImportantQuestions] = useState<Set<number>>(new Set());
  const [parsedJson, setParsedJson] = useState<any>(null);
  const [parsedMarkdown, setParsedMarkdown] = useState<string>("");
  const [documentAnalysis, setDocumentAnalysis] = useState<DocumentAnalysis | null>(null);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 90 });
  
  // PDF Viewer states
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerImages, setViewerImages] = useState<{url: string, label?: string, pageNumber?: number}[]>([]);
  const [viewerPaperName, setViewerPaperName] = useState("");
  const [renderingPaperId, setRenderingPaperId] = useState<string | null>(null);
  const [extractionMeta, setExtractionMeta] = useState<
    | {
        partial?: boolean;
        error?: string;
        errorCode?: string;
        errors?: string[];
        chunksProcessed?: number;
        answerKeyStats?: {
          found: number;
          applied: number;
          missing: number[];
        };
        extractionStats?: {
          expected: number;
          extracted: number;
          recoveryAttempts: number;
          recoveredInRetries: number;
          stillMissing: number[];
          completionRate: string;
        };
      }
    | null
  >(null);

  // Animated extraction progress counter
  useEffect(() => {
    if (currentStep !== "extracting") {
      setExtractionProgress({ current: 0, total: 90 });
      return;
    }

    const estimatedTotal = formData.total_questions > 0 ? formData.total_questions : 90;
    setExtractionProgress({ current: 0, total: estimatedTotal });

    // Simulate progress with varying speeds
    const interval = setInterval(() => {
      setExtractionProgress((prev) => {
        if (prev.current >= prev.total - 5) {
          // Slow down near the end
          return { ...prev, current: Math.min(prev.current + 0.5, prev.total - 1) };
        }
        // Faster progress initially
        const increment = Math.random() * 3 + 1;
        return { ...prev, current: Math.min(prev.current + increment, prev.total - 1) };
      });
    }, 800);

    return () => clearInterval(interval);
  }, [currentStep, formData.total_questions]);

  const { data: papers, isLoading } = usePreviousYearPapers(subjectId);
  const { data: chapters } = useSubjectChapters(subjectId);
  const { data: topics } = useChapterTopics(formData.chapter_id || undefined);
  const { data: uploadedDocuments, isLoading: isDocsLoading } = useSubjectUploadedDocuments(subjectId);
  const { data: categories } = useAdminCategories();
  const { data: paperQuestions, isLoading: isLoadingQuestions } = usePaperQuestionsView(selectedPaperId);
  
  // Fetch tests from the tests table for proficiency, exam, and dpp tabs
  const { data: proficiencyTests, isLoading: isProficiencyLoading } = useSubjectTests(subjectId, "proficiency");
  const { data: examTests, isLoading: isExamLoading } = useSubjectTests(subjectId, ["practice", "exam", "mock"]);
  const { data: dppTests, isLoading: isDppLoading } = useSubjectTests(subjectId, "dpp");
  const { data: testQuestions, isLoading: isLoadingTestQuestions } = useTestQuestionsView(selectedTestId);
  const deleteTest = useDeleteTest();
  
  const createPaper = useCreatePreviousYearPaper();
  const deletePaper = useDeletePreviousYearPaper();
  const deleteDocument = useDeleteUploadedDocument();
  const uploadPDF = useUploadPaperPDF();
  const bulkInsertQuestions = useBulkInsertPreviousYearQuestions();
  const { parsePdfFile, isLoading: isParsing, progress: parseProgress } = useDatalab();
  const extractQuestionsAI = useExtractQuestionsAI();
  const analyzeDocument = useAnalyzeDocument();
  const { renderPdfPages, isRendering: isPdfRendering } = usePdfPageRenderer();
  const { uploadFile: uploadToB2, uploading: isB2Uploading } = useB2Upload();

  // Helper to get category hierarchy for B2 path generation
  const getCategoryHierarchy = () => {
    if (!categoryId || !categories) {
      return { parentCategory: 'General', subCategory: 'General' };
    }
    
    const category = categories.find(c => c.id === categoryId);
    if (!category) {
      return { parentCategory: 'General', subCategory: 'General' };
    }
    
    // If this is a level 1 category (has parent), find the parent
    if (category.level === 1 && category.parent_id) {
      const parent = categories.find(c => c.id === category.parent_id);
      return {
        parentCategory: parent?.name || 'General',
        subCategory: category.name
      };
    }
    
    // If level 0, use same name for both
    return {
      parentCategory: category.name,
      subCategory: category.name
    };
  };

  const resetForm = () => {
    setFormData({
      total_questions: 0,
      chapter_id: "",
      topic_id: "",
    });
    setSelectedFile(null);
    setExtractedQuestions([]);
    setImportantQuestions(new Set());
    setParsedJson(null);
    setParsedMarkdown("");
    setDocumentAnalysis(null);
    setExtractionMeta(null);
    setCurrentStep("form");
  };

  // Filter papers by category
  const filteredPapers = useMemo(() => {
    if (!papers) return [];
    return papers.filter(p => (p.paper_category || "previous_year") === activeTab);
  }, [papers, activeTab]);

  // Count papers by category - proficiency, exam, and dpp now come from tests table
  const paperCounts = useMemo(() => {
    const pyqCount = papers?.filter(p => (p.paper_category || "previous_year") === "previous_year").length || 0;
    const proficiencyCount = proficiencyTests?.length || 0;
    const examCount = examTests?.length || 0;
    const dppCount = dppTests?.length || 0;
    return { previous_year: pyqCount, proficiency: proficiencyCount, exam: examCount, dpp: dppCount };
  }, [papers, proficiencyTests, examTests, dppTests]);

  // Get tests for current tab
  const currentTabTests = useMemo(() => {
    if (activeTab === "proficiency") return proficiencyTests || [];
    if (activeTab === "exam") return examTests || [];
    if (activeTab === "dpp") return dppTests || [];
    return [];
  }, [activeTab, proficiencyTests, examTests, dppTests]);

  // Handle delete test
  const handleDeleteTest = () => {
    if (deleteTestId) {
      deleteTest.mutate(deleteTestId, {
        onSuccess: () => setDeleteTestId(null),
      });
    }
  };

  // Filter uploaded documents for modal based on its own tab state
  const modalFilteredDocuments = useMemo(() => {
    if (!uploadedDocuments) return [];
    const purposeMap: Record<PaperCategory, string[]> = {
      'previous_year': ['previous_year', 'general'],
      'proficiency': ['proficiency_test'],
      'exam': ['exam'],
      'dpp': ['dpp'],
    };
    const purposes = purposeMap[docsModalTab] || [];
    return uploadedDocuments.filter(doc => 
      doc.document_purpose && purposes.includes(doc.document_purpose)
    );
  }, [uploadedDocuments, docsModalTab]);

  // Count documents by category
  const docCounts = useMemo(() => {
    if (!uploadedDocuments) return { previous_year: 0, proficiency: 0, exam: 0 };
    const counts = { previous_year: 0, proficiency: 0, exam: 0 };
    uploadedDocuments.forEach(doc => {
      const purpose = doc.document_purpose;
      if (purpose === 'previous_year' || purpose === 'general') counts.previous_year++;
      else if (purpose === 'proficiency_test') counts.proficiency++;
      else if (purpose === 'exam' || purpose === 'dpp') counts.exam++;
    });
    return counts;
  }, [uploadedDocuments]);

  const handleParsePDF = async () => {
    if (!selectedFile) return;

    try {
      // Step 1: Parse PDF with Datalab
      setCurrentStep("parsing");
      const result = await parsePdfFile(selectedFile);

      if (!result || !result.success) {
        setCurrentStep("form");
        return;
      }

      setParsedJson(result.content_json);
      setParsedMarkdown(result.content_markdown || "");

      // Step 2: Analyze document structure using AI
      setCurrentStep("analyzing");
      
      try {
        const analysis = await analyzeDocument.mutateAsync({
          contentMarkdown: result.content_markdown,
          contentJson: result.content_json,
          documentName: selectedFile.name,
        });
        
        setDocumentAnalysis(analysis);
        
        // Update estimated question count from analysis
        if (analysis.totalEstimatedQuestions > 0) {
          setFormData(prev => ({ ...prev, total_questions: analysis.totalEstimatedQuestions }));
        }
        
        // Show the analysis preview for user confirmation
        setCurrentStep("analysis_preview");
      } catch (analysisError) {
        console.error("Document analysis failed:", analysisError);
        // Fall back to direct extraction without analysis
        toast({
          title: "Analysis skipped",
          description: "Proceeding with standard extraction",
        });
        await proceedWithExtraction(result.content_json, result.content_markdown);
      }
    } catch (error) {
      console.error("Error in PDF parsing:", error);
      setCurrentStep("form");
    }
  };

  // Handle extraction after analysis confirmation
  const handleConfirmAnalysis = async () => {
    const hasMarkdown = (parsedMarkdown?.trim().length ?? 0) > 100;
    const hasJson = parsedJson != null;
    
    console.log("[Extraction] starting", { hasJson, markdownLength: parsedMarkdown?.length });
    
    if (!hasMarkdown && !hasJson) {
      toast({
        title: "Cannot start extraction",
        description: "PDF parsing did not return readable text. Please try a clearer PDF or re-upload.",
        variant: "destructive",
      });
      return;
    }
    
    await proceedWithExtraction(parsedJson ?? null, parsedMarkdown, documentAnalysis ?? undefined);
  };

  // Common extraction logic (used by both analysis flow and fallback)
  const proceedWithExtraction = async (
    contentJson: any | null, 
    contentMarkdown?: string, 
    analysis?: DocumentAnalysis
  ) => {
    setExtractionMeta(null);
    setExtractedQuestions([]);
    setCurrentStep("extracting");

    try {
      // Use filename as exam name for extraction context
      const extractionName = selectedFile?.name?.replace(/\.[^/.]+$/, "") || "Document";
      
      const aiResult = await extractQuestionsAI.mutateAsync({
        contentJson,
        contentMarkdown,
        examName: extractionName,
        year: new Date().getFullYear(),
        paperType: undefined,
        documentType: undefined, // Let AI auto-detect
        documentAnalysis: analysis,
      });

      setExtractionMeta({
        partial: aiResult.partial,
        error: aiResult.error,
        errorCode: aiResult.errorCode,
        errors: aiResult.errors,
        chunksProcessed: aiResult.chunksProcessed,
        answerKeyStats: aiResult.answerKeyStats,
      });

      if (aiResult.questions && aiResult.questions.length > 0) {
        setExtractedQuestions(aiResult.questions);
        setFormData((prev) => ({ ...prev, total_questions: aiResult.questionsCount }));
      }

      setCurrentStep("preview");
    } catch (aiError) {
      console.error("AI extraction failed:", aiError);
      setExtractionMeta({
        error: aiError instanceof Error ? aiError.message : "AI extraction failed",
        errorCode: "CLIENT_ERROR",
      });
      setCurrentStep("preview");
    }
  };

  const handleSubmit = async () => {
    if (!formData.chapter_id) {
      toast({
        title: "Validation Error",
        description: "Please select a chapter",
        variant: "destructive",
      });
      return;
    }

    if (questionsWithAnswers.length === 0) {
      toast({
        title: "No Questions",
        description: "No questions with answers to save to Question Bank",
        variant: "destructive",
      });
      return;
    }

    setCurrentStep("saving");

    try {
      // Prepare questions with importance flags
      const questionsWithImportance = questionsWithAnswers.map((q) => {
        const originalIndex = extractedQuestions.findIndex(
          orig => orig.question_number === q.question_number
        );
        return {
          ...q,
          is_important: importantQuestions.has(originalIndex),
        };
      });
      
      
      // Map to general purpose since we removed paper_category from form
      const documentPurpose = 'general';
      
      // Step 1: Upload PDF to B2 storage
      const { data: { user } } = await supabase.auth.getUser();
      let pdfUrl: string | null = null;
      
      if (selectedFile) {
        const { parentCategory, subCategory } = getCategoryHierarchy();
        const chapterName = chapters?.find(c => c.id === formData.chapter_id)?.title || 'General';
        
        const b2Path = generateB2Path({
          parentCategoryName: parentCategory,
          subCategoryName: subCategory,
          subjectName: subjectName,
          chapterName: chapterName,
          entityType: 'previous_year_paper',
          entityName: selectedFile?.name?.replace(/\.[^/.]+$/, "") || 'ExtractedQuestions',
          fileName: selectedFile.name
        });
        
        const uploadResult = await uploadToB2(
          selectedFile,
          b2Path,
          {
            entityType: 'previous_year_paper',
            categoryId: categoryId,
            subjectId: subjectId,
            chapterId: formData.chapter_id || undefined,
            topicId: formData.topic_id || undefined,
          }
        );
        
        if (uploadResult?.success) {
          pdfUrl = uploadResult.filePath;
        }
      }
      
      // Step 2: Create a document record to track this upload
      const { data: docRecord, error: docError } = await supabase
        .from('uploaded_question_documents')
        .insert({
          subject_id: subjectId,
          category_id: categoryId,
          chapter_id: formData.chapter_id,
          topic_id: formData.topic_id || null,
          display_name: selectedFile?.name || 'Uploaded Document',
          document_purpose: documentPurpose,
          status: 'completed',
          questions_count: questionsWithImportance.length,
          file_type: 'pdf',
          file_name: selectedFile?.name || 'extracted-questions.pdf',
          file_url: pdfUrl || 'extracted-from-upload',
          questions_file_url: pdfUrl, // Store B2 path for viewing
          uploaded_by: user?.id || '',
        })
        .select()
        .single();

      if (docError) throw docError;
      
      // Step 2: Insert questions to Question Bank with source_document_id
      await bulkInsertQuestions.mutateAsync({
        questions: questionsWithImportance,
        paperId: null, // No paper link - questions go directly to Question Bank
        topicId: formData.topic_id || undefined,
        subjectId,
        chapterId: formData.chapter_id,
        documentPurpose,
        sourceDocumentId: docRecord.id,
      });
      
      const skippedCount = extractedQuestions.length - questionsWithAnswers.length;
      const skippedMsg = skippedCount > 0 ? ` (${skippedCount} without answers skipped)` : "";
      toast({ 
        title: "Questions Added to Bank", 
        description: `${questionsWithImportance.length} questions saved to Question Bank${skippedMsg}. Create papers from Question Bank.` 
      });

      setIsAddOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error saving questions:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to save questions",
        variant: "destructive",
      });
      setCurrentStep("preview");
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deletePaper.mutate(
        { id: deleteId, subjectId },
        {
          onSuccess: () => setDeleteId(null),
        }
      );
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    setIsAddOpen(open);
  };

  const handleViewPaper = async (paper: { id: string; pdf_url?: string | null; exam_name: string; year: number; paper_type?: string | null }) => {
    if (!paper.pdf_url) {
      toast({
        title: "No PDF Available",
        description: "This paper doesn't have a PDF attached.",
        variant: "destructive",
      });
      return;
    }

    setRenderingPaperId(paper.id);
    
    try {
      const requestId = `paper-view-${paper.id}-${Date.now()}`;
      const renderedPages = await renderPdfPages(paper.pdf_url, requestId);
      
      if (renderedPages && renderedPages.length > 0) {
        const images = renderedPages.map((page) => ({
          url: page.url,
          label: `Page ${page.pageNumber}`,
          pageNumber: page.pageNumber,
        }));
        
        setViewerImages(images);
        setViewerPaperName(`${paper.exam_name} ${paper.year}${paper.paper_type ? ` - ${paper.paper_type}` : ''}`);
        setViewerOpen(true);
      } else {
        toast({
          title: "Rendering Failed",
          description: "Could not render PDF pages. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error rendering PDF:", error);
      toast({
        title: "Error",
        description: "Failed to load PDF preview.",
        variant: "destructive",
      });
    } finally {
      setRenderingPaperId(null);
    }
  };

  const handleViewDocument = async (doc: SubjectUploadedDocument) => {
    const pdfUrl = doc.questions_file_url || doc.solutions_file_url;
    if (!pdfUrl) {
      toast({
        title: "No PDF Available",
        description: "This document doesn't have a PDF attached.",
        variant: "destructive",
      });
      return;
    }

    setRenderingPaperId(doc.id);
    
    try {
      const requestId = `doc-view-${doc.id}-${Date.now()}`;
      const renderedPages = await renderPdfPages(pdfUrl, requestId);
      
      if (renderedPages && renderedPages.length > 0) {
        const images = renderedPages.map((page) => ({
          url: page.url,
          label: `Page ${page.pageNumber}`,
          pageNumber: page.pageNumber,
        }));
        
        setViewerImages(images);
        setViewerPaperName(doc.display_name || 'Document');
        setViewerOpen(true);
      } else {
        toast({
          title: "Rendering Failed",
          description: "Could not render PDF pages. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error rendering document PDF:", error);
      toast({
        title: "Error",
        description: "Failed to load PDF preview.",
        variant: "destructive",
      });
    } finally {
      setRenderingPaperId(null);
    }
  };

  const handleDeleteDocument = () => {
    if (deleteDocId) {
      deleteDocument.mutate(
        { documentId: deleteDocId, subjectId },
        {
          onSuccess: () => setDeleteDocId(null),
        }
      );
    }
  };

  const getSelectedChapterName = () => {
    const chapter = chapters?.find((c) => c.id === formData.chapter_id);
    return chapter ? `Ch ${chapter.chapter_number}: ${chapter.title}` : "";
  };

  const getSelectedTopicName = () => {
    const topic = topics?.find((t) => t.id === formData.topic_id);
    return topic ? `Topic ${topic.topic_number}: ${topic.title}` : "";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Practice & Tests</CardTitle>
              <CardDescription>
                Manage mock tests and previous year questions for {subjectName}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={isAddOpen} onOpenChange={(open) => {
                if (open) {
                  // Set initial category to match active tab
                  setFormData(prev => ({ ...prev, paper_category: activeTab }));
                }
                handleDialogClose(open);
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Upload & Extract Questions
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl h-[90vh] min-h-0 overflow-hidden flex flex-col">
                <DialogHeader className="shrink-0">
                  <DialogTitle>
                    Extract Questions to Bank
                  </DialogTitle>
                  <DialogDescription>
                    Upload a document to extract questions to the Question Bank. Create papers later from Question Bank.
                  </DialogDescription>
                </DialogHeader>

                {/* Body wrapper - constrained flex area for all steps */}
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  {currentStep === "form" && (
                  <div className="space-y-4 py-4 flex-1 min-h-0 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Chapter *</Label>
                        <Select
                          value={formData.chapter_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, chapter_id: value, topic_id: "" })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select chapter" />
                          </SelectTrigger>
                          <SelectContent>
                            {chapters?.map((chapter) => (
                              <SelectItem key={chapter.id} value={chapter.id}>
                                Ch {chapter.chapter_number}: {chapter.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Topic (Optional)</Label>
                        <Select
                          value={formData.topic_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, topic_id: value })
                          }
                          disabled={!formData.chapter_id}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select topic (optional)" />
                          </SelectTrigger>
                          <SelectContent>
                            {topics?.map((topic) => (
                              <SelectItem key={topic.id} value={topic.id}>
                                Topic {topic.topic_number}: {topic.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Leave empty to associate with entire chapter</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pdf-upload">Upload Document *</Label>
                      <Input
                        id="pdf-upload"
                        type="file"
                        accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.html,.epub"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                      {selectedFile && (
                        <>
                          <p className="text-xs text-muted-foreground">
                            Selected: {selectedFile.name}
                          </p>
                          <PDFPreview
                            pdfUrl={URL.createObjectURL(selectedFile)}
                            fileName={selectedFile.name}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )}

                {currentStep === "parsing" && (
                  <div className="py-12 flex-1 min-h-0 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg font-medium">Parsing Document...</p>
                    <p className="text-sm text-muted-foreground">{parseProgress}</p>
                    <Progress value={50} className="w-64" />
                  </div>
                )}

                {currentStep === "analyzing" && (
                  <div className="py-12 flex-1 min-h-0 flex flex-col items-center justify-center space-y-4">
                    <Brain className="h-12 w-12 animate-pulse text-primary" />
                    <p className="text-lg font-medium">Analyzing Document Structure...</p>
                    <p className="text-sm text-muted-foreground">
                      AI is detecting question types, patterns, and answer key locations
                    </p>
                    <Progress value={75} className="w-64" />
                  </div>
                )}

                {currentStep === "analysis_preview" && documentAnalysis && (
                  <div className="py-4 flex-1 min-h-0 overflow-hidden">
                    <DocumentAnalysisPreview
                      analysis={documentAnalysis}
                      onConfirm={handleConfirmAnalysis}
                      onCancel={() => setCurrentStep("form")}
                      isExtracting={extractQuestionsAI.isPending}
                      extractionInput={{
                        hasJson: parsedJson != null,
                        hasMarkdown: (parsedMarkdown?.trim().length ?? 0) > 100,
                      }}
                    />
                  </div>
                )}

                {currentStep === "extracting" && (
                  <div className="py-12 flex-1 min-h-0 flex flex-col items-center justify-center space-y-4">
                    <Brain className="h-12 w-12 animate-pulse text-primary" />
                    <p className="text-lg font-medium">Extracting Questions with AI...</p>
                    <p className="text-sm text-muted-foreground">
                      Processing 6 chunks in parallel for faster extraction
                    </p>
                    {extractionProgress.current >= extractionProgress.total - 5 ? (
                      <p className="text-lg font-semibold text-primary animate-pulse">
                        Finalizing extraction...
                      </p>
                    ) : (
                      <p className="text-lg font-semibold text-primary">
                        {Math.floor(extractionProgress.current)}/{extractionProgress.total}
                      </p>
                    )}
                    <Progress 
                      value={(extractionProgress.current / extractionProgress.total) * 100} 
                      className="w-64" 
                    />
                  </div>
                )}

                {currentStep === "preview" && (
                  <div className="space-y-4 py-4 flex-1 min-h-0 overflow-hidden flex flex-col">
                    {/* Extraction Stats - Show completion rate prominently */}
                    {extractionMeta?.extractionStats && (
                      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          {extractionMeta.extractionStats.extracted >= extractionMeta.extractionStats.expected ? (
                            <CheckCircle className="h-6 w-6 text-primary" />
                          ) : extractionMeta.extractionStats.extracted >= extractionMeta.extractionStats.expected * 0.95 ? (
                            <CheckCircle className="h-6 w-6 text-yellow-500" />
                          ) : (
                            <AlertCircle className="h-6 w-6 text-destructive" />
                          )}
                          <div>
                            <p className="font-semibold text-lg">
                              Extracted {extractionMeta.extractionStats.extracted}/{extractionMeta.extractionStats.expected} questions
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Completion: {extractionMeta.extractionStats.completionRate}
                            </p>
                          </div>
                        </div>
                        
                        {/* Recovery info */}
                        {extractionMeta.extractionStats.recoveryAttempts > 0 && (
                          <div className="flex flex-wrap gap-2 text-sm">
                            <Badge variant="secondary">
                              {extractionMeta.extractionStats.recoveryAttempts} recovery attempt{extractionMeta.extractionStats.recoveryAttempts > 1 ? "s" : ""}
                            </Badge>
                            {extractionMeta.extractionStats.recoveredInRetries > 0 && (
                              <Badge variant="outline" className="text-primary">
                                +{extractionMeta.extractionStats.recoveredInRetries} recovered
                              </Badge>
                            )}
                          </div>
                        )}
                        
                        {/* Missing questions warning */}
                        {extractionMeta.extractionStats.stillMissing.length > 0 && (
                          <div className="text-sm text-destructive">
                            <span className="font-medium">Still missing: </span>
                            Q{extractionMeta.extractionStats.stillMissing.slice(0, 10).join(", Q")}
                            {extractionMeta.extractionStats.stillMissing.length > 10 && ` +${extractionMeta.extractionStats.stillMissing.length - 10} more`}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Questions ready to save count */}
                    <div className="flex flex-wrap items-center gap-2 bg-muted/30 p-3 rounded-md">
                      {questionsWithAnswers.length > 0 ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      )}
                      <span className="font-semibold">
                        {questionsWithAnswers.length} questions ready to save
                      </span>
                      {questionsWithAnswers.length !== extractedQuestions.length && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          {extractedQuestions.length - questionsWithAnswers.length} skipped (no answer)
                        </Badge>
                      )}
                    </div>
                    
                    {extractionMeta?.error && (
                      <p className="text-sm text-muted-foreground">
                        {extractionMeta.error}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Chapter:</span>{" "}
                        {getSelectedChapterName()}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Topic:</span>{" "}
                        {getSelectedTopicName()}
                      </div>
                    </div>

                    <ScrollArea className="h-[400px] border rounded-md p-4">
                      <div className="space-y-4">
                        {extractedQuestions.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                            <p>No questions could be extracted from the PDF.</p>
                            <p className="text-sm">
                              The paper will still be saved for reference.
                            </p>
                          </div>
                        ) : (
                          extractedQuestions.map((q, index) => {
                            const hasAnswer = q.correct_answer && q.correct_answer.trim() !== "" && q.correct_answer !== "—";
                            return (
                            <div 
                              key={index} 
                              className={`border-b pb-3 last:border-0 ${!hasAnswer ? "opacity-50 bg-destructive/5 rounded-md p-2 -mx-2" : ""}`}
                            >
                              {!hasAnswer && (
                                <Badge variant="destructive" className="mb-2 text-xs">
                                  ⚠️ Will be skipped - No answer
                                </Badge>
                              )}
                              <div className="flex items-start gap-2">
                                <Badge variant="outline" className="shrink-0">
                                  Q{q.question_number || index + 1}
                                </Badge>
                                <div className="flex-1">
                                  <div className="text-sm">
                                    <MathpixRenderer 
                                      mmdText={q.question_text} 
                                      inline={true} 
                                      className="[&_.prose]:prose-sm"
                                    />
                                  </div>
                                  {Object.keys(q.options).length > 0 && (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {Object.entries(q.options).map(([key, val]) => (
                                        <span key={key} className="mr-2 inline-flex items-baseline gap-1">
                                          <strong>{key}:</strong>
                                          <MathpixRenderer 
                                            mmdText={val.text.length > 50 ? val.text.substring(0, 50) + "..." : val.text} 
                                            inline={true}
                                            className="inline [&_.prose]:inline [&_.prose]:prose-xs"
                                          />
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                                    <Badge variant="secondary" className="text-xs">
                                      {q.difficulty}
                                    </Badge>
                                    <Badge 
                                      variant={q.correct_answer ? "outline" : "destructive"} 
                                      className="text-xs flex items-center gap-1"
                                    >
                                      <span>Ans:</span>
                                      {q.correct_answer ? (
                                        <MathpixRenderer 
                                          mmdText={q.correct_answer} 
                                          inline={true}
                                          className="inline [&_.prose]:inline [&_.prose]:prose-xs [&_p]:inline [&_p]:m-0"
                                        />
                                      ) : "—"}
                                    </Badge>
                                    <div 
                                      className="flex items-center gap-1.5 cursor-pointer"
                                      onClick={() => {
                                        setImportantQuestions(prev => {
                                          const newSet = new Set(prev);
                                          if (newSet.has(index)) {
                                            newSet.delete(index);
                                          } else {
                                            newSet.add(index);
                                          }
                                          return newSet;
                                        });
                                      }}
                                    >
                                      <Checkbox 
                                        checked={importantQuestions.has(index)}
                                        onCheckedChange={(checked) => {
                                          setImportantQuestions(prev => {
                                            const newSet = new Set(prev);
                                            if (checked) {
                                              newSet.add(index);
                                            } else {
                                              newSet.delete(index);
                                            }
                                            return newSet;
                                          });
                                        }}
                                        className="h-3.5 w-3.5"
                                      />
                                      <span className={`text-xs flex items-center gap-1 ${importantQuestions.has(index) ? 'text-yellow-600 font-medium' : 'text-muted-foreground'}`}>
                                        <Star className={`h-3 w-3 ${importantQuestions.has(index) ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                                        Important
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {currentStep === "saving" && (
                  <div className="py-12 flex-1 min-h-0 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg font-medium">Saving paper and questions...</p>
                  </div>
                )}
                </div>
                {/* End body wrapper */}

                <DialogFooter className="mt-4 shrink-0">
                  {currentStep === "form" && (
                    <>
                      <Button variant="outline" onClick={() => handleDialogClose(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleParsePDF}
                          disabled={
                            !formData.chapter_id ||
                            !selectedFile ||
                            isParsing
                          }
                      >
                        Parse Document & Extract Questions
                      </Button>
                    </>
                  )}

                  {currentStep === "preview" && (
                    <>
                      <Button variant="outline" onClick={() => setCurrentStep("form")}>
                        Back
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={bulkInsertQuestions.isPending || questionsWithAnswers.length === 0}
                      >
                        {bulkInsertQuestions.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving to Bank...
                          </>
                        ) : (
                          `Save ${questionsWithAnswers.length} Questions to Bank`
                        )}
                      </Button>
                    </>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

              {/* Uploaded Documents Modal Button */}
              <Dialog open={isDocsModalOpen} onOpenChange={setIsDocsModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <FileText className="mr-2 h-4 w-4" />
                    Uploaded Documents
                    {uploadedDocuments && uploadedDocuments.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {uploadedDocuments.length}
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Uploaded Documents
                    </DialogTitle>
                    <DialogDescription>
                      Documents used to extract questions to the Question Bank
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Tabs value={docsModalTab} onValueChange={(v) => setDocsModalTab(v as PaperCategory)} className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="previous_year" className="gap-2">
                        Previous Year
                        <Badge variant="secondary">{docCounts.previous_year}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="proficiency" className="gap-2">
                        Proficiency Test
                        <Badge variant="secondary">{docCounts.proficiency}</Badge>
                      </TabsTrigger>
                      <TabsTrigger value="exam" className="gap-2">
                        Test
                        <Badge variant="secondary">{docCounts.exam}</Badge>
                      </TabsTrigger>
                    </TabsList>
                    
                    <ScrollArea className="h-[50vh] mt-4">
                      {modalFilteredDocuments.length > 0 ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Chapter / Topic</TableHead>
                              <TableHead>Questions</TableHead>
                              <TableHead>PDF</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {modalFilteredDocuments.map((doc) => (
                              <TableRow key={doc.id}>
                                <TableCell className="font-medium">
                                  {doc.display_name || doc.file_name || 'Untitled Document'}
                                </TableCell>
                                <TableCell>
                                  {doc.chapter?.title || doc.topic?.title ? (
                                    <div className="text-sm">
                                      {doc.chapter?.title && (
                                        <div className="font-medium">{doc.chapter.title}</div>
                                      )}
                                      {doc.topic?.title && (
                                        <div className="text-muted-foreground text-xs">{doc.topic.title}</div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{doc.questions_count || 0}</Badge>
                                </TableCell>
                                <TableCell>
                                  {doc.questions_file_url || doc.solutions_file_url ? (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleViewDocument(doc)}
                                      disabled={isPdfRendering && renderingPaperId === doc.id}
                                      className="flex items-center gap-1 text-primary"
                                    >
                                      {isPdfRendering && renderingPaperId === doc.id ? (
                                        <>
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          Loading...
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="h-4 w-4" />
                                          View
                                        </>
                                      )}
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setDeleteDocId(doc.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="py-12 text-center text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                          <p>No documents uploaded for this category yet</p>
                        </div>
                      )}
                    </ScrollArea>
                  </Tabs>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PaperCategory)} className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="previous_year" className="gap-2">
                Previous Year
                {paperCounts.previous_year > 0 && (
                  <Badge variant="secondary" className="ml-1">{paperCounts.previous_year}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="proficiency" className="gap-2">
                Proficiency Test
                {paperCounts.proficiency > 0 && (
                  <Badge variant="secondary" className="ml-1">{paperCounts.proficiency}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="exam" className="gap-2">
                Test
                {paperCounts.exam > 0 && (
                  <Badge variant="secondary" className="ml-1">{paperCounts.exam}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="dpp" className="gap-2">
                DPP
                {paperCounts.dpp > 0 && (
                  <Badge variant="secondary" className="ml-1">{paperCounts.dpp}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {isLoading || isDocsLoading || isProficiencyLoading || isExamLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : activeTab === "previous_year" ? (
              // Previous Year Papers Table
              <div className="space-y-8">
                {filteredPapers.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead>Exam Name</TableHead>
                        <TableHead>Chapter / Topic</TableHead>
                        <TableHead>Paper Type</TableHead>
                        <TableHead>Questions</TableHead>
                        <TableHead>PDF</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPapers.map((paper) => (
                        <TableRow key={paper.id}>
                          <TableCell className="font-medium">{paper.year}</TableCell>
                          <TableCell>{paper.exam_name}</TableCell>
                          <TableCell>
                            {paper.chapter?.title || paper.topic?.title ? (
                              <div className="text-sm">
                                {paper.chapter?.title && (
                                  <div className="font-medium">{paper.chapter.title}</div>
                                )}
                                {paper.topic?.title && (
                                  <div className="text-muted-foreground text-xs">{paper.topic.title}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {paper.paper_type ? (
                              <Badge variant="outline">{paper.paper_type}</Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{paper.total_questions || 0}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedPaperId(paper.id);
                                setSelectedPaperName(`${paper.exam_name} ${paper.year}`);
                                setQuestionsViewerOpen(true);
                              }}
                              className="flex items-center gap-1 text-primary"
                            >
                              <Eye className="h-4 w-4" />
                              View ({paper.total_questions || 0})
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(paper.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No previous year papers added yet</p>
                    <p className="text-sm mt-2">Upload documents to extract questions, then create papers from the Question Bank</p>
                  </div>
                )}
              </div>
            ) : (
              // Tests Table (Proficiency & Exam)
              <div className="space-y-8">
                {currentTabTests.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Chapter / Topic</TableHead>
                        <TableHead>Questions</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Total Marks</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentTabTests.map((test) => (
                        <TableRow key={test.id}>
                          <TableCell className="font-medium">{test.title}</TableCell>
                          <TableCell>
                            {test.chapter?.title || test.topic?.title ? (
                              <div className="text-sm">
                                {test.chapter?.title && (
                                  <div className="font-medium">{test.chapter.title}</div>
                                )}
                                {test.topic?.title && (
                                  <div className="text-muted-foreground text-xs">{test.topic.title}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{test.question_count || 0}</Badge>
                          </TableCell>
                          <TableCell>{test.duration_minutes} min</TableCell>
                          <TableCell>{test.total_marks}</TableCell>
                          <TableCell>
                            <Badge variant={test.is_active ? "default" : "secondary"}>
                              {test.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedTestId(test.id);
                                setSelectedTestName(test.title);
                                setTestQuestionsViewerOpen(true);
                              }}
                              className="flex items-center gap-1 text-primary"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTestId(test.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>No {activeTab === "proficiency" ? "proficiency tests" : activeTab === "dpp" ? "DPPs" : "exam tests"} created yet</p>
                    <p className="text-sm mt-2">Use "Create Test from Questions" in the Question Bank to create tests</p>
                  </div>
                )}
              </div>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* Delete Paper Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Paper?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the paper and all its linked questions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Document Confirmation Dialog */}
      <AlertDialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Uploaded Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the document AND all extracted questions from the Question Bank.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDocument}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PDF Viewer */}
      <DocumentImageViewer
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        images={viewerImages}
        fileName={viewerPaperName}
      />

      {/* Questions Viewer Dialog */}
      <Dialog open={questionsViewerOpen} onOpenChange={setQuestionsViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] min-h-0 flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedPaperName}
            </DialogTitle>
            <DialogDescription>
              {paperQuestions?.length || 0} questions in this paper
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 max-h-[70vh] overflow-y-auto pr-4">
            {isLoadingQuestions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : paperQuestions && paperQuestions.length > 0 ? (
              <div className="space-y-6 pb-4">
                {paperQuestions.map((question, index) => (
                  <div key={question.id} className="border rounded-lg p-4 space-y-3">
                    {/* Question Header */}
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="shrink-0">Q{index + 1}</Badge>
                      {question.is_important && (
                        <Star className="h-4 w-4 text-primary fill-primary shrink-0" />
                      )}
                      <div className="flex-1">
                        <MathpixRenderer mmdText={question.question_text} inline />
                      </div>
                    </div>
                    
                    {/* Options - Only show if valid options exist */}
                    {question.hasValidOptions ? (
                      <div className="space-y-2 ml-10">
                        {Object.entries(question.options || {}).map(([key, value]) => {
                          const isCorrect = key === question.correct_answer;
                          return (
                            <div 
                              key={key}
                              className={cn(
                                "p-3 rounded border flex items-start gap-2",
                                isCorrect
                                  ? "bg-primary/10 border-primary"
                                  : "bg-muted/50"
                              )}
                            >
                              <span className={cn("font-semibold", isCorrect && "text-primary")}>
                                {key}.
                              </span>
                              <div className="flex-1">
                                <MathpixRenderer 
                                  mmdText={typeof value === 'string' ? value : value.text} 
                                  inline 
                                />
                              </div>
                              {isCorrect && <CheckCircle className="h-5 w-5 text-primary shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Integer/Numerical Question - No MCQ options */
                      <div className="ml-10 p-4 bg-amber-100/50 dark:bg-amber-900/20 rounded border border-amber-300 dark:border-amber-700">
                        <span className="text-sm text-amber-700 dark:text-amber-400">
                          This is a numerical/integer type question
                        </span>
                      </div>
                    )}
                    
                    {/* Correct Answer Label */}
                    <div className="ml-10 flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Correct Answer:</span>
                      <Badge className="bg-primary/10 text-primary">
                        {question.correct_answer}
                      </Badge>
                    </div>
                    
                    {/* Explanation */}
                    {question.explanation && (
                      <div className="ml-10 p-3 bg-accent/40 rounded border border-accent">
                        <span className="text-sm font-medium text-accent-foreground">Explanation:</span>
                        <div className="mt-1">
                          <MathpixRenderer mmdText={question.explanation} inline />
                        </div>
                      </div>
                    )}
                    
                    {/* Metadata */}
                    <div className="ml-10 flex gap-2">
                      <Badge variant="secondary">{question.difficulty}</Badge>
                      <Badge variant="secondary">{question.marks} mark{question.marks !== 1 ? 's' : ''}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No questions found for this paper</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Test Confirmation Dialog */}
      <AlertDialog open={!!deleteTestId} onOpenChange={() => setDeleteTestId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Test?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the test and unlink all its questions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTest}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test Questions Viewer Dialog */}
      <Dialog open={testQuestionsViewerOpen} onOpenChange={setTestQuestionsViewerOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] min-h-0 flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedTestName}
            </DialogTitle>
            <DialogDescription>
              {testQuestions?.length || 0} questions in this test
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 min-h-0 max-h-[70vh] overflow-y-auto pr-4">
            {isLoadingTestQuestions ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : testQuestions && testQuestions.length > 0 ? (
              <div className="space-y-6 pb-4">
                {testQuestions.map((tq, index) => (
                  <div key={tq.id} className="border rounded-lg p-4 space-y-3">
                    {/* Question Header */}
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="shrink-0">Q{tq.order_number || index + 1}</Badge>
                      <Badge variant="secondary" className="shrink-0">{tq.marks} marks</Badge>
                      <div className="flex-1">
                        <MathpixRenderer mmdText={tq.question?.question_text || ""} inline />
                      </div>
                    </div>
                    
                    {/* Options */}
                    {tq.question?.options && Object.keys(tq.question.options).length > 0 && (
                      <div className="space-y-2 ml-10">
                        {Object.entries(tq.question.options).map(([key, value]) => {
                          const isCorrect = key === tq.question?.correct_answer;
                          return (
                            <div 
                              key={key}
                              className={cn(
                                "p-3 rounded border flex items-start gap-2",
                                isCorrect
                                  ? "bg-primary/10 border-primary"
                                  : "bg-muted/50"
                              )}
                            >
                              <span className={cn("font-semibold", isCorrect && "text-primary")}>
                                {key}.
                              </span>
                              <div className="flex-1">
                                <MathpixRenderer 
                                  mmdText={typeof value === 'string' ? value : (value as { text: string })?.text || ''} 
                                  inline 
                                />
                              </div>
                              {isCorrect && <CheckCircle className="h-5 w-5 text-primary shrink-0" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    {/* Correct Answer */}
                    {tq.question?.correct_answer && (
                      <div className="ml-10 flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Correct Answer:</span>
                        <Badge className="bg-primary/10 text-primary">
                          {tq.question.correct_answer}
                        </Badge>
                      </div>
                    )}
                    
                    {/* Explanation */}
                    {tq.question?.explanation && (
                      <div className="ml-10 p-3 bg-accent/40 rounded border border-accent">
                        <span className="text-sm font-medium text-accent-foreground">Explanation:</span>
                        <div className="mt-1">
                          <MathpixRenderer mmdText={tq.question.explanation} inline />
                        </div>
                      </div>
                    )}
                    
                    {/* Metadata */}
                    {tq.question?.difficulty && (
                      <div className="ml-10">
                        <Badge variant="secondary">{tq.question.difficulty}</Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No questions found for this test</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
