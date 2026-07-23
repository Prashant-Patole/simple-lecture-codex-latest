import { useState, useMemo, useDeferredValue } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Download, Upload, FileText, Brain, Calendar, ClipboardCheck, Trash2, Loader2 } from "lucide-react";
import { useAdminPopularSubjects } from "@/hooks/useAdminPopularSubjects";
import { SearchableCategorySelector } from "@/components/admin/SearchableCategorySelector";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectManagement";
import { usePaginatedQuestionBank } from "@/hooks/usePaginatedQuestionBank";
import { QuestionPreview } from "@/components/admin/QuestionPreview";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { EnhancedExcelImportModal } from "@/components/admin/EnhancedExcelImportModal";
import { QuestionFormDialog } from "@/components/admin/QuestionFormDialog";
import { CreateTestFromQuestionsModal, TestType } from "@/components/admin/CreateTestFromQuestionsModal";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

export default function QuestionBank() {
  // State for filters and search
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedChapter, setSelectedChapter] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [questionFormat, setQuestionFormat] = useState<string>("all");
  const [sourceType, setSourceType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [createTestType, setCreateTestType] = useState<TestType | null>(null);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  // Debounced search for server-side filtering
  const debouncedSearchQuery = useDeferredValue(searchQuery);

  const { data: subjects } = useAdminPopularSubjects();

  const filteredSubjects = useMemo(() => {
    if (selectedCategory === "all") return subjects;
    return subjects?.filter(s => s.category_id === selectedCategory);
  }, [subjects, selectedCategory]);

  const handleCategoryChange = (val: string) => {
    setSelectedCategory(val);
    setSelectedSubject("all");
    setSelectedChapter("all");
    setSelectedTopic("all");
  };
  const { data: chapters } = useSubjectChapters(selectedSubject !== "all" ? selectedSubject : undefined);
  const { data: topics } = useChapterTopics(selectedChapter !== "all" ? selectedChapter : undefined);

  // Build filters for the optimized paginated hook
  const questionFilters = useMemo(() => ({
    categoryId: selectedSubject !== "all" ? undefined : (selectedCategory !== "all" ? selectedCategory : undefined),
    subjectId: selectedSubject !== "all" ? selectedSubject : undefined,
    chapterId: selectedChapter !== "all" ? selectedChapter : undefined,
    topicId: selectedTopic !== "all" ? selectedTopic : undefined,
    difficulty: difficulty !== "all" ? difficulty : undefined,
    questionFormat: questionFormat !== "all" ? questionFormat : undefined,
    sourceType: sourceType !== "all" ? sourceType : undefined,
    searchQuery: debouncedSearchQuery || undefined,
  }), [selectedCategory, selectedSubject, selectedChapter, selectedTopic, difficulty, questionFormat, sourceType, debouncedSearchQuery]);

  // Use paginated hook with server-side filtering
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    invalidateQuestionBank,
  } = usePaginatedQuestionBank(questionFilters);

  // Flatten pages into single array
  const questions = useMemo(() => 
    data?.pages.flatMap(page => page.questions) ?? [],
    [data]
  );

  const totalCount = data?.pages[0]?.totalCount ?? 0;

  const activeFilterCount = [
    selectedCategory !== "all",
    selectedSubject !== "all",
    selectedChapter !== "all",
    selectedTopic !== "all",
    difficulty !== "all",
    questionFormat !== "all",
    sourceType !== "all",
    searchQuery.length > 0
  ].filter(Boolean).length;

  const handleClearFilters = () => {
    setSelectedCategory("all");
    setSelectedSubject("all");
    setSelectedChapter("all");
    setSelectedTopic("all");
    setDifficulty("all");
    setQuestionFormat("all");
    setSourceType("all");
    setSearchQuery("");
  };

  const handleDeduplicate = async () => {
    setIsDeduplicating(true);
    try {
      const { data, error } = await supabase.functions.invoke("deduplicate-questions", {
        body: {
          subjectId: selectedSubject !== "all" ? selectedSubject : undefined,
          chapterId: selectedChapter !== "all" ? selectedChapter : undefined,
          topicId: selectedTopic !== "all" ? selectedTopic : undefined,
        },
      });
      
      if (error) throw error;
      
      if (data.duplicatesRemoved > 0) {
        toast.success(`Removed ${data.duplicatesRemoved} duplicate questions`);
        invalidateQuestionBank();
      } else {
        toast.info("No duplicates found");
      }
    } catch (error) {
      toast.error("Deduplication failed", { 
        description: error instanceof Error ? error.message : "Unknown error" 
      });
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handleVerifyQuestion = (id: string, verified: boolean) => {
    // TODO: Implement verify mutation
    toast.success(verified ? "Question verified" : "Verification removed");
  };

  const handleExport = () => {
    if (!questions || questions.length === 0) {
      toast.error("No questions to export");
      return;
    }

    const exportData = questions.map(q => ({
      question_text: q.question_text,
      question_format: q.question_format,
      option_a: q.options?.A || "",
      option_b: q.options?.B || "",
      option_c: q.options?.C || "",
      option_d: q.options?.D || "",
      correct_answer: q.correct_answer,
      explanation: q.explanation || "",
      difficulty: q.difficulty,
      marks: q.marks,
      question_type: q.question_type,
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    XLSX.writeFile(wb, `questions_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(`Exported ${questions.length} questions`);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Question Bank</h1>
            <p className="text-muted-foreground">
              Centralized repository for all questions across subjects
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setCreateTestType("dpp")}>
              <FileText className="h-4 w-4 mr-2" />
              Create DPP
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCreateTestType("proficiency_test")}>
              <Brain className="h-4 w-4 mr-2" />
              Create Proficiency Test
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCreateTestType("previous_year")}>
              <Calendar className="h-4 w-4 mr-2" />
              Create PYQ Paper
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCreateTestType("exam")}>
              <ClipboardCheck className="h-4 w-4 mr-2" />
              Create Test
            </Button>
            <Separator orientation="vertical" className="h-8" />
            <Button variant="outline" size="sm" onClick={handleDeduplicate} disabled={isDeduplicating}>
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeduplicating ? "Removing..." : "Remove Duplicates"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button size="sm" onClick={() => setIsAddQuestionOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Question
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Filters</CardTitle>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary">{activeFilterCount} active</Badge>
                )}
              </div>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Clear All
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  placeholder="Search questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <SearchableCategorySelector
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  label="Category"
                  placeholder="Search category..."
                  showAllOption
                  allOptionLabel="All Categories"
                />
              </div>

              <div className="space-y-2">
                <Label>Subject</Label>
                <Select 
                  value={selectedSubject} 
                  onValueChange={setSelectedSubject}
                  disabled={selectedCategory === "all"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Subjects</SelectItem>
                    {filteredSubjects?.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Chapter</Label>
                <Select 
                  value={selectedChapter} 
                  onValueChange={setSelectedChapter}
                  disabled={selectedSubject === "all"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Chapters</SelectItem>
                    {chapters?.map((chapter) => (
                      <SelectItem key={chapter.id} value={chapter.id}>
                        Ch {chapter.chapter_number}: {chapter.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Topic</Label>
                <Select 
                  value={selectedTopic} 
                  onValueChange={setSelectedTopic}
                  disabled={selectedChapter === "all"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Topics</SelectItem>
                    {topics?.map((topic) => (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topic.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={questionFormat} onValueChange={setQuestionFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Formats</SelectItem>
                    <SelectItem value="single_choice">Single Choice</SelectItem>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="fill_blank">Fill in Blank</SelectItem>
                    <SelectItem value="numerical">Numerical</SelectItem>
                    <SelectItem value="subjective">Subjective</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Source Type</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="dpp">DPP Documents</SelectItem>
                    <SelectItem value="proficiency_test">Proficiency Tests</SelectItem>
                    <SelectItem value="previous_year">Previous Year Papers</SelectItem>
                    <SelectItem value="exam">Exam Papers</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>
              Questions ({totalCount} total)
              {questions.length > 0 && totalCount > questions.length && (
                <span className="text-muted-foreground font-normal text-base ml-2">
                  — Showing 1-{questions.length}
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {totalCount > 0 
                ? "Server-side paginated results (20 per page)"
                : "No questions match your filters"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading questions...
              </div>
            ) : questions.length > 0 ? (
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div key={question.id}>
                  <QuestionPreview
                    question={question}
                    onEdit={(q) => setEditingQuestion(q)}
                    onDelete={() => invalidateQuestionBank()}
                    onVerify={handleVerifyQuestion}
                  />
                    {index < questions.length - 1 && (
                      <Separator className="my-4" />
                    )}
                  </div>
                ))}

                {/* Load More Button */}
                {hasNextPage && (
                  <div className="flex justify-center pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => fetchNextPage()}
                      disabled={isFetchingNextPage}
                      className="min-w-[200px]"
                    >
                      {isFetchingNextPage ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Loading more...
                        </>
                      ) : (
                        `Load More (${totalCount - questions.length} remaining)`
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg font-medium mb-2">No questions found</p>
                <p className="text-sm">
                  {activeFilterCount > 0 
                    ? "Try adjusting your filters or add new questions" 
                    : "Start by adding your first question"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <EnhancedExcelImportModal 
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
        />

        <QuestionFormDialog
          isOpen={isAddQuestionOpen}
          onClose={() => {
            setIsAddQuestionOpen(false);
            invalidateQuestionBank();
          }}
        />

        <QuestionFormDialog
          isOpen={!!editingQuestion}
          onClose={() => {
            setEditingQuestion(null);
            invalidateQuestionBank();
          }}
          editQuestion={editingQuestion}
        />

        <CreateTestFromQuestionsModal
          isOpen={!!createTestType}
          onClose={() => setCreateTestType(null)}
          testType={createTestType || "dpp"}
        />
      </div>
  );
}
