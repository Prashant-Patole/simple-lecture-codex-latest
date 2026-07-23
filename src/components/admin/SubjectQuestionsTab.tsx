import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Upload, Loader2, Sparkles, FileText, Brain, Calendar, ClipboardCheck, Trash2, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCreateQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
  useBulkImportQuestions,
  useBulkVerifyQuestions,
  useBulkDeleteQuestions,
} from "@/hooks/useSubjectQuestions";
import { usePaginatedQuestions } from "@/hooks/usePaginatedQuestions";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectManagement";
import { toast } from "@/hooks/use-toast";
import { AIRephraseModal } from "./AIRephraseModal";
import { ExcelImportModal } from "./ExcelImportModal";
import { RichContentEditor } from "./question/RichContentEditor";
import { QuestionFilters } from "./QuestionFilters";
import { QuestionPreview } from "./QuestionPreview";
import { BulkActionsBar } from "./BulkActionsBar";
import { CreateTestFromQuestionsModal, TestType } from "./CreateTestFromQuestionsModal";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface SubjectQuestionsTabProps {
  subjectId: string;
  subjectName: string;
  categoryId?: string;
}

export function SubjectQuestionsTab({ subjectId, subjectName, categoryId }: SubjectQuestionsTabProps) {
  const [isAddManualOpen, setIsAddManualOpen] = useState(false);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  
  // Test creation state
  const [createTestType, setCreateTestType] = useState<TestType | null>(null);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  
  // Question type tab: "manual" or "previous_year"
  const [questionTypeTab, setQuestionTypeTab] = useState<"manual" | "previous_year">("manual");
  
  // Enhanced filters
  const [filters, setFilters] = useState({
    difficulty: "all",
    verified: "all",
    aiGenerated: "all",
    chapterId: "all",
    topicId: "all",
    searchQuery: "",
  });

  // Selection and bulk operations
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());

  // AI Rephrase states
  const [rephraseModalOpen, setRephraseModalOpen] = useState(false);
  const [rephraseText, setRephraseText] = useState("");
  const [rephraseType, setRephraseType] = useState<"question" | "answer" | "explanation">("question");
  const [rephraseCallback, setRephraseCallback] = useState<((text: string) => void) | null>(null);

  // Question form state
  const [questionForm, setQuestionForm] = useState({
    chapter_id: "",
    topic_id: "",
    question_text: "",
    question_format: "single_choice",
    difficulty: "Medium",
    options: {} as Record<string, any>,
    correct_answer: "",
    explanation: "",
    marks: 1,
    contains_formula: false,
    formula_type: "plain" as "plain" | "latex" | "accounting",
    question_images: [] as string[],
    option_images: {} as Record<string, string[]>,
    explanation_images: [] as string[],
  });

  const { data: chapters } = useSubjectChapters(subjectId);
  const { data: topics } = useChapterTopics(filters.chapterId !== "all" ? filters.chapterId : questionForm.chapter_id);
  
  // Build filters for paginated query based on active tab
  const paginatedFilters = useMemo(() => ({
    subjectId,
    isAiGenerated: filters.aiGenerated === "ai" ? true : filters.aiGenerated === "manual" ? false : undefined,
    difficulty: filters.difficulty !== "all" ? filters.difficulty : undefined,
    isVerified: filters.verified === "verified" ? true : filters.verified === "unverified" ? false : undefined,
    topicId: filters.topicId !== "all" ? filters.topicId : undefined,
    chapterId: filters.chapterId !== "all" ? filters.chapterId : undefined,
    searchQuery: filters.searchQuery || undefined,
  }), [subjectId, filters]);

  const {
    data,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePaginatedQuestions(paginatedFilters);

  // Flatten all pages into a single array
  const questions = useMemo(() => 
    data?.pages.flatMap(page => page.questions) || [], 
    [data]
  );
  const totalCount = data?.pages[0]?.totalCount || 0;

  const createQuestion = useCreateQuestion();
  const updateQuestion = useUpdateQuestion();
  const deleteQuestion = useDeleteQuestion();
  const bulkImport = useBulkImportQuestions();
  const bulkVerify = useBulkVerifyQuestions();
  const bulkDelete = useBulkDeleteQuestions();

  // Filter management
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value };
      // Reset topic filter when chapter changes
      if (key === "chapterId" && value !== prev.chapterId) {
        updated.topicId = "all";
      }
      return updated;
    });
  };

  const handleClearFilters = () => {
    setFilters({
      difficulty: "all",
      verified: "all",
      aiGenerated: "all",
      chapterId: "all",
      topicId: "all",
      searchQuery: "",
    });
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== "all" && v !== "").length;

  // Selection management
  const handleSelectQuestion = (id: string) => {
    const newSelection = new Set(selectedQuestions);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedQuestions(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedQuestions.size === questions.length) {
      setSelectedQuestions(new Set());
    } else {
      setSelectedQuestions(new Set(questions.map(q => q.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedQuestions(new Set());
  };

  // Bulk operations
  const handleBulkVerify = () => {
    if (selectedQuestions.size === 0) return;
    bulkVerify.mutate(Array.from(selectedQuestions), {
      onSuccess: () => handleClearSelection(),
    });
  };

  const handleBulkDelete = () => {
    if (selectedQuestions.size === 0) return;
    bulkDelete.mutate(Array.from(selectedQuestions), {
      onSuccess: () => handleClearSelection(),
    });
  };

  const handleBulkExport = () => {
    if (selectedQuestions.size === 0) return;
    
    const selectedQuestionsData = questions.filter(q => selectedQuestions.has(q.id));
    const exportData = selectedQuestionsData.map(q => ({
      topic_id: q.topic_id,
      question_text: q.question_text,
      question_format: q.question_format,
      option_a: q.options?.A?.text || "",
      option_b: q.options?.B?.text || "",
      option_c: q.options?.C?.text || "",
      option_d: q.options?.D?.text || "",
      correct_answer: q.correct_answer,
      explanation: q.explanation || "",
      difficulty: q.difficulty,
      marks: q.marks,
      contains_formula: q.contains_formula,
      formula_type: q.formula_type || "",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
    XLSX.writeFile(workbook, `questions_export_${Date.now()}.xlsx`);
    
    toast({
      title: "Export Successful",
      description: `Exported ${selectedQuestions.size} questions`,
    });
  };

  const handleVerifyQuestion = (id: string, verified: boolean, isImportant?: boolean) => {
    updateQuestion.mutate({ 
      id, 
      updates: { 
        is_verified: verified,
        ...(isImportant !== undefined && { is_important: isImportant })
      } 
    });
  };

  // Questions are now filtered server-side, no need for client-side filtering

  const resetForm = () => {
    setQuestionForm({
      chapter_id: "",
      topic_id: "",
      question_text: "",
      question_format: "single_choice",
      difficulty: "Medium",
      options: {},
      correct_answer: "",
      explanation: "",
      marks: 1,
      contains_formula: false,
      formula_type: "plain",
      question_images: [],
      option_images: {},
      explanation_images: [],
    });
  };

  const handleCreateQuestion = () => {
    // Comprehensive validation
    if (!questionForm.question_text.trim()) {
      console.error("❌ Validation failed: Question text is empty");
      toast({
        title: "Validation Error",
        description: "Question text is required",
        variant: "destructive",
      });
      return;
    }

    if (!questionForm.correct_answer) {
      console.error("❌ Validation failed: Correct answer not set");
      toast({
        title: "Validation Error",
        description: "Please specify the correct answer",
        variant: "destructive",
      });
      return;
    }

    // Chapter is required, topic is optional
    if (!questionForm.chapter_id) {
      console.error("❌ Validation failed: No chapter selected");
      toast({
        title: "Validation Error",
        description: "Please select a chapter for this question",
        variant: "destructive",
      });
      return;
    }

    console.log("=== CREATE QUESTION DEBUG ===");
    console.log("Subject ID:", subjectId);
    console.log("Question Form Data:", questionForm);

    const questionData: any = {
      topic_id: questionForm.topic_id || null,
      chapter_id: questionForm.chapter_id || null,
      question_text: questionForm.question_text.trim(),
      question_type: questionForm.question_format,
      question_format: questionForm.question_format,
      options: questionForm.options,
      correct_answer: questionForm.correct_answer.toUpperCase(),
      explanation: questionForm.explanation || "",
      marks: questionForm.marks,
      difficulty: questionForm.difficulty,
      is_verified: false,
      is_ai_generated: false,
      contains_formula: questionForm.contains_formula,
      formula_type: questionForm.formula_type,
      question_image_url: questionForm.question_images?.[0] || null,
      option_images: Object.entries(questionForm.option_images || {}).reduce((acc, [key, images]) => {
        if (images && images.length > 0) {
          acc[key] = images[0];
        }
        return acc;
      }, {} as Record<string, string>),
    };

    console.log("Final question data to be inserted:", questionData);

    createQuestion.mutate(questionData, {
      onSuccess: (data) => {
        console.log("✅ Question created successfully:", data);
        toast({
          title: "Success",
          description: "Question created successfully",
        });
        setIsAddManualOpen(false);
        resetForm();
      },
      onError: (error: any) => {
        console.error("❌ Failed to create question:", error);
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        toast({
          title: "Error Creating Question",
          description: error.message || "Failed to create question. Check console for details.",
          variant: "destructive",
        });
      },
    });
  };

  const handleUpdateQuestion = () => {
    if (!editingQuestion) {
      console.error("❌ No question selected for editing");
      return;
    }

    // Validation
    if (!questionForm.question_text.trim()) {
      console.error("❌ Validation failed: Question text is empty");
      toast({
        title: "Validation Error",
        description: "Question text is required",
        variant: "destructive",
      });
      return;
    }

    if (!questionForm.correct_answer) {
      console.error("❌ Validation failed: Correct answer not set");
      toast({
        title: "Validation Error",
        description: "Please specify the correct answer",
        variant: "destructive",
      });
      return;
    }

    console.log("=== UPDATE QUESTION DEBUG ===");
    console.log("Question ID:", editingQuestion.id);
    console.log("Updated Form Data:", questionForm);
    
    const updates: any = {
      question_text: questionForm.question_text.trim(),
      question_format: questionForm.question_format,
      options: questionForm.options,
      correct_answer: questionForm.correct_answer,
      explanation: questionForm.explanation?.trim() || null,
      marks: questionForm.marks,
      difficulty: questionForm.difficulty,
      contains_formula: questionForm.contains_formula,
      formula_type: questionForm.formula_type,
      question_image_url: questionForm.question_images?.[0] || null,
      option_images: Object.entries(questionForm.option_images || {}).reduce((acc, [key, images]) => {
        if (images && images.length > 0) {
          acc[key] = images[0];
        }
        return acc;
      }, {} as Record<string, string>),
    };

    console.log("Updates to be applied:", updates);

    updateQuestion.mutate(
      { id: editingQuestion.id, updates },
      {
        onSuccess: (data) => {
          console.log("✅ Question updated successfully:", data);
          toast({
            title: "Success",
            description: "Question updated successfully",
          });
          setEditingQuestion(null);
          resetForm();
        },
        onError: (error: any) => {
          console.error("❌ Failed to update question:", error);
          console.error("Error details:", {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          });
          toast({
            title: "Error Updating Question",
            description: error.message || "Failed to update question. Check console for details.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDeleteQuestion = () => {
    if (!deleteQuestionId) return;
    deleteQuestion.mutate(deleteQuestionId, {
      onSuccess: () => setDeleteQuestionId(null),
    });
  };

  const openRephraseModal = (
    text: string,
    type: "question" | "answer" | "explanation",
    callback: (text: string) => void
  ) => {
    setRephraseText(text);
    setRephraseType(type);
    setRephraseCallback(() => callback);
    setRephraseModalOpen(true);
  };

  const handleRephraseAccept = (rephrasedText: string) => {
    if (rephraseCallback) {
      rephraseCallback(rephrasedText);
    }
    setRephraseModalOpen(false);
  };

  const handleExcelImport = async (file: File) => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

    const questionsToImport = jsonData.map((row) => {
      const options: Record<string, any> = {};
      
      if (row.option_a) options.A = { text: row.option_a, image_url: row.option_a_image };
      if (row.option_b) options.B = { text: row.option_b, image_url: row.option_b_image };
      if (row.option_c) options.C = { text: row.option_c, image_url: row.option_c_image };
      if (row.option_d) options.D = { text: row.option_d, image_url: row.option_d_image };

      return {
        question_text: row.question_text,
        question_type: row.question_format || "single_choice",
        question_format: row.question_format || "single_choice",
        options,
        correct_answer: row.correct_answer,
        explanation: row.explanation || "",
        marks: parseInt(row.marks) || 1,
        difficulty: row.difficulty || "Medium",
        is_verified: false,
        is_ai_generated: false,
        contains_formula: row.contains_formula === "TRUE" || row.contains_formula === true,
        formula_type: row.formula_type || undefined,
        question_image_url: row.question_image_url || undefined,
      };
    });

    const result = await bulkImport.mutateAsync({ questions: questionsToImport });
    return result;
  };

  // Render options based on question format
  const renderOptionsEditor = () => {
    switch (questionForm.question_format) {
      case "single_choice":
      case "multiple_choice":
        return (
          <div className="space-y-4">
            {["A", "B", "C", "D"].map((optionKey) => (
              <div key={optionKey} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label className="w-12">Option {optionKey}</Label>
                  {questionForm.question_format === "single_choice" ? (
                    <RadioGroup
                      value={questionForm.correct_answer}
                      onValueChange={(value) =>
                        setQuestionForm({ ...questionForm, correct_answer: value })
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value={optionKey} id={`radio-${optionKey}`} />
                        <Label htmlFor={`radio-${optionKey}`} className="text-xs">
                          Correct
                        </Label>
                      </div>
                    </RadioGroup>
                  ) : (
                    <Checkbox
                      checked={questionForm.correct_answer.includes(optionKey)}
                      onCheckedChange={(checked) => {
                        const current = questionForm.correct_answer.split(";").filter(Boolean);
                        const updated = checked
                          ? [...current, optionKey]
                          : current.filter((k) => k !== optionKey);
                        setQuestionForm({
                          ...questionForm,
                          correct_answer: updated.join(";"),
                        });
                      }}
                    />
                  )}
                </div>
                {questionForm.contains_formula ? (
                  <RichContentEditor
                    value={questionForm.options[optionKey]?.text || ""}
                    onChange={(value) =>
                      setQuestionForm({
                        ...questionForm,
                        options: {
                          ...questionForm.options,
                          [optionKey]: {
                            ...questionForm.options[optionKey],
                            text: value,
                          },
                        },
                      })
                    }
                    onImagesChange={(images) =>
                      setQuestionForm({
                        ...questionForm,
                        option_images: {
                          ...questionForm.option_images,
                          [optionKey]: images,
                        },
                      })
                    }
                    placeholder={`Enter option ${optionKey} text...`}
                    showFormulaSupport={questionForm.contains_formula}
                    allowImagePaste={true}
                    questionId={editingQuestion?.id || 'new'}
                    imageType={`option_${optionKey.toLowerCase()}` as any}
                    currentImages={questionForm.option_images[optionKey] || []}
                  />
                ) : (
                  <RichContentEditor
                    value={questionForm.options[optionKey]?.text || ""}
                    onChange={(value) =>
                      setQuestionForm({
                        ...questionForm,
                        options: {
                          ...questionForm.options,
                          [optionKey]: {
                            ...questionForm.options[optionKey],
                            text: value,
                          },
                        },
                      })
                    }
                    onImagesChange={(images) =>
                      setQuestionForm({
                        ...questionForm,
                        option_images: {
                          ...questionForm.option_images,
                          [optionKey]: images,
                        },
                      })
                    }
                    placeholder={`Enter option ${optionKey} text...`}
                    allowImagePaste={true}
                    questionId={editingQuestion?.id || 'new'}
                    imageType={`option_${optionKey.toLowerCase()}` as any}
                    currentImages={questionForm.option_images[optionKey] || []}
                  />
                )}
              </div>
            ))}
          </div>
        );

      case "true_false":
        return (
          <RadioGroup
            value={questionForm.correct_answer}
            onValueChange={(value) =>
              setQuestionForm({ ...questionForm, correct_answer: value })
            }
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="true" id="true" />
              <Label htmlFor="true">True</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="false" id="false" />
              <Label htmlFor="false">False</Label>
            </div>
          </RadioGroup>
        );

      case "fill_blank":
      case "numerical":
        return (
          <div className="space-y-2">
            <Label>Correct Answer</Label>
            {questionForm.contains_formula ? (
              <RichContentEditor
                value={questionForm.correct_answer}
                onChange={(value) =>
                  setQuestionForm({ ...questionForm, correct_answer: value })
                }
                placeholder={
                  questionForm.question_format === "numerical"
                    ? "Enter numerical answer (e.g., 42)"
                    : "Enter the correct answer"
                }
                showFormulaSupport={true}
                allowImagePaste={false}
              />
            ) : (
              <Input
                placeholder={
                  questionForm.question_format === "numerical"
                    ? "Enter numerical answer (e.g., 42)"
                    : "Enter the correct answer"
                }
                type={questionForm.question_format === "numerical" ? "number" : "text"}
                value={questionForm.correct_answer}
                onChange={(e) =>
                  setQuestionForm({ ...questionForm, correct_answer: e.target.value })
                }
              />
            )}
          </div>
        );

      case "subjective":
        return (
          <div className="space-y-2">
            <Label>Model Answer / Key Points</Label>
            <RichContentEditor
              value={questionForm.correct_answer}
              onChange={(value) =>
                setQuestionForm({ ...questionForm, correct_answer: value })
              }
              placeholder="Enter model answer or key points for evaluation..."
              showFormulaSupport={questionForm.contains_formula}
              allowImagePaste={false}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Question Bank</CardTitle>
                <CardDescription>Manage questions for {subjectName}</CardDescription>
              </div>
            </div>
            {/* Action Buttons Row */}
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCreateTestType("dpp")}>
                <FileText className="mr-2 h-4 w-4" />
                Create DPP
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCreateTestType("proficiency_test")}>
                <Brain className="mr-2 h-4 w-4" />
                Create Proficiency Test
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCreateTestType("previous_year")}>
                <Calendar className="mr-2 h-4 w-4" />
                Create PYQ Paper
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCreateTestType("exam")}>
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Create Test
              </Button>
              <Separator orientation="vertical" className="h-8 mx-1" />
              <Button 
                variant="outline" 
                size="sm" 
                onClick={async () => {
                  setIsDeduplicating(true);
                  try {
                    const { data, error } = await supabase.functions.invoke('deduplicate-questions', {
                      body: { subjectId }
                    });
                    if (error) throw error;
                    toast({
                      title: "Duplicates Removed",
                      description: `Removed ${data?.removedCount || 0} duplicate questions`,
                    });
                  } catch (err: any) {
                    toast({
                      title: "Error",
                      description: err.message || "Failed to remove duplicates",
                      variant: "destructive",
                    });
                  } finally {
                    setIsDeduplicating(false);
                  }
                }} 
                disabled={isDeduplicating}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeduplicating ? "Removing..." : "Remove Duplicates"}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  const exportData = questions.map(q => ({
                    topic_id: q.topic_id,
                    question_text: q.question_text,
                    question_format: q.question_format,
                    option_a: q.options?.A?.text || "",
                    option_b: q.options?.B?.text || "",
                    option_c: q.options?.C?.text || "",
                    option_d: q.options?.D?.text || "",
                    correct_answer: q.correct_answer,
                    explanation: q.explanation || "",
                    difficulty: q.difficulty,
                    marks: q.marks,
                    contains_formula: q.contains_formula,
                    formula_type: q.formula_type || "",
                  }));
                  const worksheet = XLSX.utils.json_to_sheet(exportData);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, "Questions");
                  XLSX.writeFile(workbook, `${subjectName.replace(/\s+/g, "_")}_questions_${Date.now()}.xlsx`);
                  toast({
                    title: "Export Successful",
                    description: `Exported ${questions.length} questions`,
                  });
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Separator orientation="vertical" className="h-8 mx-1" />
              <Button variant="outline" size="sm" onClick={() => setIsExcelImportOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Bulk Import
              </Button>
              <Dialog
                open={isAddManualOpen || !!editingQuestion}
                onOpenChange={(open) => {
                  if (!open) {
                    setIsAddManualOpen(false);
                    setEditingQuestion(null);
                    resetForm();
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button onClick={() => setIsAddManualOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Question
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingQuestion ? "Edit Question" : "Add New Question"}
                    </DialogTitle>
                    <DialogDescription>
                      Create a comprehensive question with multiple formats and formula support
                    </DialogDescription>
                  </DialogHeader>
                  <Tabs defaultValue="question" className="space-y-4">
                    <TabsList>
                      <TabsTrigger value="question">Question</TabsTrigger>
                      <TabsTrigger value="options">Options</TabsTrigger>
                      <TabsTrigger value="details">Details</TabsTrigger>
                    </TabsList>

                    <TabsContent value="question" className="space-y-4">
                      {/* Chapter & Topic Selection */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Chapter</Label>
                          <Select
                            value={questionForm.chapter_id}
                            onValueChange={(value) =>
                              setQuestionForm({ ...questionForm, chapter_id: value, topic_id: "" })
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
                          <Label>Topic *</Label>
                          <Select
                            value={questionForm.topic_id}
                            onValueChange={(value) =>
                              setQuestionForm({ ...questionForm, topic_id: value })
                            }
                            disabled={!questionForm.chapter_id}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select topic" />
                            </SelectTrigger>
                            <SelectContent>
                              {topics?.map((topic) => (
                                <SelectItem key={topic.id} value={topic.id}>
                                  {topic.topic_number}. {topic.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Question Format */}
                      <div className="space-y-2">
                        <Label>Question Format *</Label>
                        <Select
                          value={questionForm.question_format}
                          onValueChange={(value) =>
                            setQuestionForm({ ...questionForm, question_format: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single_choice">Single Choice (Radio)</SelectItem>
                            <SelectItem value="multiple_choice">
                              Multiple Choice (Checkbox)
                            </SelectItem>
                            <SelectItem value="true_false">True/False</SelectItem>
                            <SelectItem value="fill_blank">Fill in the Blank</SelectItem>
                            <SelectItem value="numerical">Numerical Answer</SelectItem>
                            <SelectItem value="subjective">Subjective (Long Answer)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Formula Support */}
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="contains-formula"
                          checked={questionForm.contains_formula}
                          onCheckedChange={(checked) =>
                            setQuestionForm({
                              ...questionForm,
                              contains_formula: checked as boolean,
                            })
                          }
                        />
                        <Label htmlFor="contains-formula">
                          This question contains formulas (Math/Chemistry/Accounting)
                        </Label>
                      </div>

                      {/* Question Text */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Question Text *</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openRephraseModal(
                                questionForm.question_text,
                                "question",
                                (text) => setQuestionForm({ ...questionForm, question_text: text })
                              )
                            }
                            disabled={!questionForm.question_text}
                          >
                            <Sparkles className="h-4 w-4 mr-1" />
                            AI Rephrase
                          </Button>
                        </div>
                        {questionForm.contains_formula ? (
                          <RichContentEditor
                            value={questionForm.question_text}
                            onChange={(value) =>
                              setQuestionForm({
                                ...questionForm,
                                question_text: value,
                              })
                            }
                            onImagesChange={(images) =>
                              setQuestionForm({ ...questionForm, question_images: images })
                            }
                            placeholder="Enter your question..."
                            showFormulaSupport={true}
                            allowImagePaste={true}
                            questionId={editingQuestion?.id || 'new'}
                            imageType="question"
                            currentImages={questionForm.question_images}
                          />
                        ) : (
                          <RichContentEditor
                            value={questionForm.question_text}
                            onChange={(value) =>
                              setQuestionForm({ ...questionForm, question_text: value })
                            }
                            onImagesChange={(images) =>
                              setQuestionForm({ ...questionForm, question_images: images })
                            }
                            placeholder="Enter your question... You can paste images directly!"
                            allowImagePaste={true}
                            questionId={editingQuestion?.id || 'new'}
                            imageType="question"
                            currentImages={questionForm.question_images}
                          />
                        )}
                      </div>
                    </TabsContent>

                    <TabsContent value="options" className="space-y-4">
                      {renderOptionsEditor()}
                    </TabsContent>

                    <TabsContent value="details" className="space-y-4">
                      {/* Explanation */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Explanation (Optional)</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              openRephraseModal(
                                questionForm.explanation,
                                "explanation",
                                (text) => setQuestionForm({ ...questionForm, explanation: text })
                              )
                            }
                            disabled={!questionForm.explanation}
                          >
                            <Sparkles className="h-4 w-4 mr-1" />
                            AI Rephrase
                          </Button>
                        </div>
                        {questionForm.contains_formula ? (
                          <RichContentEditor
                            value={questionForm.explanation}
                            onChange={(value) =>
                              setQuestionForm({ ...questionForm, explanation: value })
                            }
                            onImagesChange={(images) =>
                              setQuestionForm({ ...questionForm, explanation_images: images })
                            }
                            placeholder="Provide detailed explanation for the answer..."
                            showFormulaSupport={true}
                            allowImagePaste={true}
                            questionId={editingQuestion?.id || 'new'}
                            imageType="explanation"
                            currentImages={questionForm.explanation_images}
                          />
                        ) : (
                          <RichContentEditor
                            value={questionForm.explanation}
                            onChange={(value) =>
                              setQuestionForm({ ...questionForm, explanation: value })
                            }
                            onImagesChange={(images) =>
                              setQuestionForm({ ...questionForm, explanation_images: images })
                            }
                            placeholder="Provide detailed explanation for the answer..."
                            allowImagePaste={true}
                            questionId={editingQuestion?.id || 'new'}
                            imageType="explanation"
                            currentImages={questionForm.explanation_images}
                          />
                        )}
                      </div>

                      {/* Difficulty and Marks */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Difficulty</Label>
                          <Select
                            value={questionForm.difficulty}
                            onValueChange={(value) =>
                              setQuestionForm({ ...questionForm, difficulty: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Low">Low</SelectItem>
                              <SelectItem value="Medium">Medium</SelectItem>
                              <SelectItem value="Intermediate">Intermediate</SelectItem>
                              <SelectItem value="Advanced">Advanced</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Marks</Label>
                          <Input
                            type="number"
                            min={1}
                            value={questionForm.marks}
                            onChange={(e) =>
                              setQuestionForm({
                                ...questionForm,
                                marks: parseInt(e.target.value) || 1,
                              })
                            }
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsAddManualOpen(false);
                        setEditingQuestion(null);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={editingQuestion ? handleUpdateQuestion : handleCreateQuestion}
                      disabled={
                        !questionForm.question_text ||
                        !questionForm.correct_answer ||
                        createQuestion.isPending ||
                        updateQuestion.isPending
                      }
                    >
                      {createQuestion.isPending || updateQuestion.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : editingQuestion ? (
                        "Update Question"
                      ) : (
                        "Add Question"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Question Type Tabs */}
          <Tabs value={questionTypeTab} onValueChange={(v) => setQuestionTypeTab(v as "manual" | "previous_year")} className="mb-6">
            <TabsList>
              <TabsTrigger value="manual" className="gap-2">
                Manually Created
              </TabsTrigger>
              <TabsTrigger value="previous_year" className="gap-2">
                Previous Year Questions
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters */}
          <QuestionFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearFilters={handleClearFilters}
            chapters={chapters || []}
            topics={topics || []}
            activeFilterCount={activeFilterCount}
          />

          {/* Question Count */}
          {!isLoading && (
            <div className="text-sm text-muted-foreground mt-4">
              Showing {questions.length} of {totalCount} questions
            </div>
          )}

          {/* Questions Grid */}
          {isLoading && questions.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="relative">
              {/* Loading overlay when switching tabs */}
              {isFetching && !isFetchingNextPage && questions.length > 0 && (
                <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10 rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              
              {questions.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {questions.map((question) => (
                    <QuestionPreview
                      key={question.id}
                      question={question}
                      onEdit={setEditingQuestion}
                      onDelete={(id) => setDeleteQuestionId(id)}
                      onVerify={handleVerifyQuestion}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No questions found. {activeFilterCount > 0 ? "Try clearing some filters." : "Add your first question!"}
                </div>
              )}

              {/* Load More Button */}
              {hasNextPage && questions.length > 0 && (
                <div className="flex justify-center mt-6">
                  <Button
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    variant="outline"
                    size="lg"
                  >
                    {isFetchingNextPage ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      `Load More Questions (${questions.length} of ${totalCount})`
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Bulk Actions Bar */}
          <BulkActionsBar
            selectedCount={selectedQuestions.size}
            onClearSelection={handleClearSelection}
            onBulkVerify={handleBulkVerify}
            onBulkDelete={handleBulkDelete}
            onBulkExport={handleBulkExport}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteQuestionId} onOpenChange={() => setDeleteQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the question. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuestion}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AI Rephrase Modal */}
      <AIRephraseModal
        open={rephraseModalOpen}
        onOpenChange={setRephraseModalOpen}
        originalText={rephraseText}
        type={rephraseType}
        onAccept={handleRephraseAccept}
      />

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        subjectId={subjectId}
      />

      {/* Create Test Modal */}
      <CreateTestFromQuestionsModal
        isOpen={!!createTestType}
        onClose={() => setCreateTestType(null)}
        testType={createTestType || "dpp"}
        prefilledSubjectId={subjectId}
        prefilledCategoryId={categoryId}
      />
    </div>
  );
}
