import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, CheckCircle2, AlertCircle, Pencil } from "lucide-react";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectManagement";
import { useAdminPopularSubjects } from "@/hooks/useAdminPopularSubjects";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';
import { ResolvedImage } from './ResolvedImage';

// Strip duplicate alt text that appears after markdown image tags
const stripDuplicateAltText = (text: string): string => {
  if (!text) return '';
  // Pattern: ![ALT TEXT](filename)\nALT TEXT  — remove the duplicate line
  return text.replace(/!\[([^\]]*)\]\([^)]+\)\s*\n\s*\1/g, (match, alt) => {
    return match.replace('\n' + alt, '').replace(alt + '\n', '');
  });
};

const markdownComponents = {
  img: ({ node, ...imgProps }: any) => <ResolvedImage {...imgProps} />,
};
import { QuestionFormDialog } from "./QuestionFormDialog";

export type TestType = "dpp" | "proficiency_test" | "previous_year" | "exam";

interface CreateTestFromQuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  testType: TestType;
  prefilledSubjectId?: string;
  prefilledCategoryId?: string;
}

const testTypeLabels: Record<TestType, string> = {
  dpp: "Daily Practice Problems (DPP)",
  proficiency_test: "Proficiency Test",
  previous_year: "Previous Year Paper",
  exam: "Exam / Test",
};

export function CreateTestFromQuestionsModal({
  isOpen,
  onClose,
  testType,
  prefilledSubjectId,
  prefilledCategoryId,
}: CreateTestFromQuestionsModalProps) {
  const queryClient = useQueryClient();
  
  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  
  // Selection state - initialize with prefilled values
  const [categoryId, setCategoryId] = useState(prefilledCategoryId || "");
  const [subjectId, setSubjectId] = useState(prefilledSubjectId || "");
  const [chapterId, setChapterId] = useState("");
  const [topicId, setTopicId] = useState("");
  
  const isPrefilled = !!(prefilledSubjectId && prefilledCategoryId);
  
  // Question selection
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  
  // Question editing
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  
  // Test config
  const [testTitle, setTestTitle] = useState("");
  const [testDuration, setTestDuration] = useState("30");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [examName, setExamName] = useState("");
  
  // Data hooks
  const { data: categories } = useAdminCategories();
  const { data: allSubjects } = useAdminPopularSubjects();
  const { data: chapters } = useSubjectChapters(subjectId || undefined);
  const { data: topics } = useChapterTopics(chapterId || undefined);
  
  const subjects = allSubjects?.filter(s => s.category_id === categoryId) || [];
  
  // Fetch ALL questions for chapter/topic - no purpose filtering (universal selection)
  const { data: questions, isLoading: isLoadingQuestions } = useQuery({
    queryKey: ["all-questions-for-test", chapterId, topicId],
    queryFn: async () => {
      if (!chapterId) return [];
      
      let query = supabase
        .from("questions")
        .select("*");
      
      if (topicId) {
        query = query.eq("topic_id", topicId);
      } else {
        // Get all topics for this chapter
        const { data: chapterTopics } = await supabase
          .from("subject_topics")
          .select("id")
          .eq("chapter_id", chapterId);
        
        if (chapterTopics && chapterTopics.length > 0) {
          query = query.in("topic_id", chapterTopics.map(t => t.id));
        }
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!chapterId && isOpen && step === 2,
  });
  
  // Create test mutation
  const createTestMutation = useMutation({
    mutationFn: async () => {
      const selectedIds = Array.from(selectedQuestionIds);
      
      if (testType === "dpp") {
        // Ensure DPP title always has "DPP - " prefix for reliable filtering
        const normalizedTitle = testTitle.toLowerCase().startsWith("dpp") 
          ? testTitle 
          : `DPP - ${testTitle}`;
        
        // Create DPP in tests table (unified with other test types)
        const { data: test, error: testError } = await (supabase as any)
          .from("tests")
          .insert({
            title: normalizedTitle,
            description: `DPP for ${chapters?.find(c => c.id === chapterId)?.title || "Chapter"}${topicId ? ` - ${topics?.find(t => t.id === topicId)?.title || "Topic"}` : ""}`,
            subject_id: subjectId,
            chapter_id: chapterId,
            topic_id: topicId || null,
            duration_minutes: parseInt(testDuration),
            total_marks: selectedIds.length * 4,
            test_type: "practice",
            is_active: true,
          })
          .select()
          .single();
        
        if (testError) throw testError;
        
        // Create test_questions entries (same as proficiency/exam)
        const testQuestions = selectedIds.map((qId, index) => ({
          test_id: test.id,
          question_id: qId,
          order_number: index + 1,
          marks: 4,
        }));
        
        const { error: linkError } = await (supabase as any)
          .from("test_questions")
          .insert(testQuestions);
        
        if (linkError) throw linkError;
        
        return { type: "dpp", id: test.id };
      } else if (testType === "previous_year") {
        // Create Previous Year Paper in subject_previous_year_papers table
        const { data: pyq, error: pyqError } = await supabase
          .from("subject_previous_year_papers")
          .insert({
            subject_id: subjectId,
            chapter_id: chapterId,
            topic_id: topicId || null,
            year: parseInt(year),
            exam_name: examName,
            paper_category: "previous_year",
            total_questions: selectedIds.length,
          })
          .select()
          .single();
        
        if (pyqError) throw pyqError;
        
        // Link questions to PYQ
        const { error: linkError } = await supabase
          .from("questions")
          .update({ previous_year_paper_id: pyq.id })
          .in("id", selectedIds);
        
        if (linkError) throw linkError;
        
        return { type: "previous_year", id: pyq.id };
      } else if (testType === "proficiency_test" || testType === "exam") {
        // Create a test in tests table using type assertion
        const { data: test, error: testError } = await (supabase as any)
          .from("tests")
          .insert({
            title: testTitle,
            description: `${testTypeLabels[testType]} for ${chapters?.find(c => c.id === chapterId)?.title || "Chapter"}`,
            subject_id: subjectId,
            chapter_id: chapterId,
            topic_id: topicId || null,
            duration_minutes: parseInt(testDuration),
            total_marks: selectedIds.length * 4,
            test_type: testType === "proficiency_test" ? "proficiency" : "practice",
            is_active: true,
          })
          .select()
          .single();
        
        if (testError) throw testError;
        
        // Create test_questions entries
        const testQuestions = selectedIds.map((qId, index) => ({
          test_id: test.id,
          question_id: qId,
          order_number: index + 1,
          marks: 4,
        }));
        
        const { error: linkError } = await (supabase as any)
          .from("test_questions")
          .insert(testQuestions);
        
        if (linkError) throw linkError;
        
        return { type: testType, id: test.id };
      }
      
      throw new Error("Unknown test type");
    },
    onSuccess: (result) => {
      toast.success(`${testTypeLabels[testType]} created successfully!`);
      queryClient.invalidateQueries({ queryKey: ["dpp-documents"] });
      queryClient.invalidateQueries({ queryKey: ["previous-year-papers"] });
      queryClient.invalidateQueries({ queryKey: ["tests"] });
      onClose();
      resetState();
    },
    onError: (error: Error) => {
      toast.error("Failed to create", { description: error.message });
    },
  });
  
  const resetState = () => {
    setStep(1);
    setCategoryId(prefilledCategoryId || "");
    setSubjectId(prefilledSubjectId || "");
    setChapterId("");
    setTopicId("");
    setSelectedQuestionIds(new Set());
    setSearchQuery("");
    setTestTitle("");
    setTestDuration("30");
    setYear(new Date().getFullYear().toString());
    setExamName("");
  };
  
  useEffect(() => {
    if (!isOpen) {
      resetState();
    } else if (isOpen && isPrefilled) {
      // Re-apply prefilled values when modal opens
      setCategoryId(prefilledCategoryId || "");
      setSubjectId(prefilledSubjectId || "");
    }
  }, [isOpen, prefilledCategoryId, prefilledSubjectId, isPrefilled]);
  
  // All questions from single unified query - no merging needed
  const allAvailableQuestions = questions || [];
  
  const filteredQuestions = allAvailableQuestions.filter(q => {
    if (!searchQuery) return true;
    return q.question_text?.toLowerCase().includes(searchQuery.toLowerCase());
  });
  
  const toggleQuestion = (id: string) => {
    const newSet = new Set(selectedQuestionIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedQuestionIds(newSet);
  };
  
  const selectAll = () => {
    setSelectedQuestionIds(new Set(filteredQuestions.map(q => q.id)));
  };
  
  const deselectAll = () => {
    setSelectedQuestionIds(new Set());
  };
  
  // Handle editing a question
  const handleEditQuestion = (question: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection toggle
    
    // Transform the question data to match QuestionFormDialog's expected format
    setEditingQuestion({
      id: question.id,
      question_text: question.question_text,
      question_format: question.question_format || 'single_choice',
      question_type: question.question_type || 'objective',
      difficulty: question.difficulty || 'Medium',
      marks: question.marks || 1,
      correct_answer: question.correct_answer || '',
      explanation: question.explanation || '',
      contains_formula: question.contains_formula || false,
      options: question.options || {},
      question_image_url: question.question_image_url,
      option_images: question.option_images || {},
      // Include subject/chapter/topic for proper context
      subject_id: subjectId,
      chapter_id: chapterId,
      topic_id: question.topic_id || topicId,
    });
  };
  
  const handleEditClose = () => {
    setEditingQuestion(null);
    // Invalidate queries to refresh the question list
    queryClient.invalidateQueries({ queryKey: ["all-questions-for-test"] });
  };
  
  const canProceedStep1 = categoryId && subjectId && chapterId;
  const canProceedStep2 = selectedQuestionIds.size > 0;
  const canCreate = testTitle.trim() && (testType !== "previous_year" || (year && examName));
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Create {testTypeLabels[testType]}</DialogTitle>
          <DialogDescription>
            Step {step} of 3: {step === 1 ? "Select Chapter/Topic" : step === 2 ? "Select Questions" : "Configure Details"}
          </DialogDescription>
        </DialogHeader>
        
        {/* Scrollable content area */}
        <div className="flex-1 min-h-0 overflow-y-auto py-4">
          {/* Step 1: Select Chapter/Topic */}
          {step === 1 && (
            <div className="space-y-4">
              {isPrefilled && (
                <div className="bg-muted/50 p-4 rounded-lg mb-4">
                  <p className="text-sm font-medium">Creating test for current subject</p>
                  <p className="text-sm text-muted-foreground">Category and subject have been pre-selected. Just choose a chapter and optionally a topic.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                {!isPrefilled && (
                  <>
                    <div className="space-y-2">
                      <Label>Category *</Label>
                      <Select value={categoryId} onValueChange={(v) => {
                        setCategoryId(v);
                        setSubjectId("");
                        setChapterId("");
                        setTopicId("");
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50 max-h-[250px] overflow-y-auto" position="popper" sideOffset={4}>
                          {categories?.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Subject *</Label>
                      <Select value={subjectId} onValueChange={(v) => {
                        setSubjectId(v);
                        setChapterId("");
                        setTopicId("");
                      }} disabled={!categoryId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50 max-h-[250px] overflow-y-auto" position="popper" sideOffset={4}>
                          {subjects.map(sub => (
                            <SelectItem key={sub.id} value={sub.id}>
                              {sub.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <Label>Chapter *</Label>
                  <Select value={chapterId} onValueChange={(v) => {
                    setChapterId(v);
                    setTopicId("");
                  }} disabled={!subjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select chapter" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50 max-h-[250px] overflow-y-auto" position="popper" sideOffset={4}>
                      {chapters?.map(ch => (
                        <SelectItem key={ch.id} value={ch.id}>
                          Ch {ch.chapter_number}: {ch.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Topic (Optional)</Label>
                  <Select value={topicId || "all"} onValueChange={(v) => setTopicId(v === "all" ? "" : v)} disabled={!chapterId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All topics" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50 max-h-[250px] overflow-y-auto" position="popper" sideOffset={4}>
                      <SelectItem value="all">All Topics</SelectItem>
                      {topics?.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Questions will be filtered to show only those from documents tagged as "{testTypeLabels[testType]}"
                </p>
              </div>
            </div>
          )}
          
          {/* Step 2: Select Questions */}
          {step === 2 && (
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search questions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
                <Button variant="outline" size="sm" onClick={deselectAll}>Deselect All</Button>
                <Badge variant="secondary">
                  {selectedQuestionIds.size} selected
                </Badge>
              </div>
              
              {isLoadingQuestions ? (
                <div className="flex-1 flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground py-12">
                  <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
                  <p className="font-medium">No questions found</p>
                  <p className="text-sm">No questions available for the selected chapter/topic</p>
                </div>
              ) : (
                <div className="border rounded-md max-h-[350px] overflow-y-auto">
                  <div className="p-4 space-y-3">
                    {filteredQuestions.map((q, index) => (
                      <Card 
                        key={q.id}
                        className={`cursor-pointer transition-colors ${
                          selectedQuestionIds.has(q.id) ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                        }`}
                        onClick={() => toggleQuestion(q.id)}
                      >
                        <CardContent className="p-3 flex items-start gap-3">
                          <Checkbox 
                            checked={selectedQuestionIds.has(q.id)}
                            onCheckedChange={() => toggleQuestion(q.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          
                          {/* Edit Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-primary"
                            onClick={(e) => handleEditQuestion(q, e)}
                            title="Edit Question"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium prose prose-sm dark:prose-invert max-w-none [&_p]:m-0">
                              <span>{index + 1}. </span>
                              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex, rehypeRaw]} components={markdownComponents}>
                                {stripDuplicateAltText(q.question_text)}
                              </ReactMarkdown>
                            </div>
                            
                            {/* Answer Display - handles all question types */}
                            {(() => {
                              const qType = q.question_type?.toLowerCase();
                              const qFormat = q.question_format?.toLowerCase();
                              
                              // MCQ with options
                              if ((qType === 'mcq' || qFormat === 'single_choice' || qFormat === 'multiple_choice') 
                                  && q.options && typeof q.options === 'object') {
                                return (
                                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                    {Object.entries(q.options as Record<string, { text: string }>).map(([key, option]) => (
                                      <div 
                                        key={key}
                                        className={`p-2 rounded border ${
                                          q.correct_answer === key 
                                            ? "bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600" 
                                            : "bg-muted/50 border-border"
                                        }`}
                                      >
                                        <span className="font-medium">{key}.</span>{' '}
                                        <span className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_p]:inline">
                                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex, rehypeRaw]} components={markdownComponents}>
                                            {stripDuplicateAltText(option?.text || '')}
                                          </ReactMarkdown>
                                        </span>
                                        {q.correct_answer === key && (
                                          <CheckCircle2 className="inline h-4 w-4 ml-1 text-green-600" />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              
                              // Subjective/Written answer
                              if (qType === 'subjective' || qFormat === 'subjective') {
                                return (
                                  <div className="mt-2 p-2 rounded border bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600 text-sm">
                                    <span className="font-medium">Answer:</span>{' '}
                                    <span className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_p]:inline">
                                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex, rehypeRaw]} components={markdownComponents}>
                                        {stripDuplicateAltText(q.correct_answer || 'Not specified')}
                                      </ReactMarkdown>
                                    </span>
                                  </div>
                                );
                              }
                              
                              // True/False
                              if (qType === 'true_false' || qFormat === 'true_false') {
                                return (
                                  <div className="mt-2 p-2 rounded border bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600 text-sm">
                                    <span className="font-medium">Answer:</span>{' '}
                                    <span className="font-semibold text-green-700 dark:text-green-300">
                                      {q.correct_answer?.toString() || 'Not specified'}
                                    </span>
                                  </div>
                                );
                              }
                              
                              // Integer/Numerical
                              if (qType === 'integer' || qFormat === 'integer') {
                                return (
                                  <div className="mt-2 p-2 rounded border bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600 text-sm">
                                    <span className="font-medium">Answer:</span>{' '}
                                    <span className="font-semibold text-green-700 dark:text-green-300">
                                      {q.correct_answer || 'Not specified'}
                                    </span>
                                  </div>
                                );
                              }
                              
                              // Fallback: show answer if available but type unknown
                              if (q.correct_answer) {
                                return (
                                  <div className="mt-2 p-2 rounded border bg-green-100 border-green-500 dark:bg-green-900/30 dark:border-green-600 text-sm">
                                    <span className="font-medium">Answer:</span>{' '}
                                    <span className="prose prose-sm dark:prose-invert max-w-none [&_p]:m-0 [&_p]:inline">
                                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex, rehypeRaw]} components={markdownComponents}>
                                        {stripDuplicateAltText(q.correct_answer)}
                                      </ReactMarkdown>
                                    </span>
                                  </div>
                                );
                              }
                              
                              return null;
                            })()}
                            
                            <div className="flex flex-wrap gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {q.difficulty || "Medium"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {q.marks || 4} marks
                              </Badge>
                              {q.question_type && (
                                <Badge variant="secondary" className="text-xs">
                                  {q.question_type}
                                </Badge>
                              )}
                              {q.source_document_purpose && (
                                <Badge variant="secondary" className="text-xs">
                                  {q.source_document_purpose}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {selectedQuestionIds.has(q.id) && (
                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Step 3: Configure Test */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder={`Enter ${testTypeLabels[testType]} title`}
                />
              </div>
              
              {testType === "previous_year" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Year *</Label>
                      <Input
                        type="number"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        placeholder="2024"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Exam Name *</Label>
                      <Input
                        value={examName}
                        onChange={(e) => setExamName(e.target.value)}
                        placeholder="JEE Main, NEET, etc."
                      />
                    </div>
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={testDuration}
                  onChange={(e) => setTestDuration(e.target.value)}
                  placeholder="30"
                />
              </div>
              
              <Card className="bg-muted/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Summary</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p><strong>Questions:</strong> {selectedQuestionIds.size}</p>
                  <p><strong>Total Marks:</strong> {selectedQuestionIds.size * 4}</p>
                  <p><strong>Chapter:</strong> {chapters?.find(c => c.id === chapterId)?.title}</p>
                  {topicId && <p><strong>Topic:</strong> {topics?.find(t => t.id === topicId)?.title}</p>}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        
        {/* Fixed footer - always visible */}
        <DialogFooter className="shrink-0 pt-4 border-t bg-background">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((step - 1) as 1 | 2)}>
              Back
            </Button>
          )}
          
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!canProceedStep1}>
              Next: Select Questions
            </Button>
          )}
          
          {step === 2 && (
            <Button onClick={() => setStep(3)} disabled={!canProceedStep2}>
              Next: Configure ({selectedQuestionIds.size} selected)
            </Button>
          )}
          
          {step === 3 && (
            <Button 
              onClick={() => createTestMutation.mutate()} 
              disabled={!canCreate || createTestMutation.isPending}
            >
              {createTestMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create {testTypeLabels[testType]}
            </Button>
          )}
        </DialogFooter>
        
        {/* Question Edit Dialog */}
        <QuestionFormDialog
          isOpen={!!editingQuestion}
          onClose={handleEditClose}
          editQuestion={editingQuestion}
          simpleEditMode={true}
        />
      </DialogContent>
    </Dialog>
  );
}
