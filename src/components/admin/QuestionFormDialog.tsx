import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCreateQuestion, useUpdateQuestion } from "@/hooks/useSubjectQuestions";
import { toast } from "sonner";
import { useCategoriesWithSubjects } from "@/hooks/useCategoriesWithSubjects";
import { useAdminPopularSubjects } from "@/hooks/useAdminPopularSubjects";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectManagement";
import { QuestionTabContent } from "./question/QuestionTabContent";
import { OptionsTabContent } from "./question/OptionsTabContent";
import { DetailsTabContent } from "./question/DetailsTabContent";

interface QuestionFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editQuestion?: any;
  simpleEditMode?: boolean;
}

export function QuestionFormDialog({ isOpen, onClose, editQuestion, simpleEditMode }: QuestionFormDialogProps) {
  const [activeTab, setActiveTab] = useState("question");
  const [formData, setFormData] = useState({
    id: "",
    categoryId: "",
    subjectId: "",
    chapter_id: "",
    topic_id: "",
    question_text: "",
    question_format: "single_choice",
    question_type: "objective",
    difficulty: "Medium",
    marks: 1,
    correct_answer: "",
    explanation: "",
    contains_formula: false,
    options: {} as Record<string, string>,
    question_images: [] as string[],
    option_images: {} as Record<string, string[]>,
    explanation_images: [] as string[],
  });

  const { data: categories } = useCategoriesWithSubjects();
  const { data: allSubjects } = useAdminPopularSubjects();
  const { data: chapters } = useSubjectChapters(formData.subjectId);
  const { data: topics } = useChapterTopics(formData.chapter_id);
  const createQuestionMutation = useCreateQuestion();
  const updateQuestionMutation = useUpdateQuestion();

  // Populate form when editing
  useEffect(() => {
    if (editQuestion) {
      // Extract text from nested format { A: { text: "..." } } to flat { A: "..." }
      // Normalize keys to uppercase to prevent duplicates (a→A, b→B, etc.)
      const flatOptions: Record<string, string> = {};
      if (editQuestion.options) {
        Object.entries(editQuestion.options).forEach(([key, value]) => {
          const normalizedKey = key.toUpperCase();
          if (typeof value === 'object' && value !== null && 'text' in value) {
            flatOptions[normalizedKey] = (value as { text: string }).text;
          } else if (typeof value === 'string') {
            flatOptions[normalizedKey] = value;
          }
        });
      }

      // Auto-detect if question contains formulas
      const hasFormula = editQuestion.question_text?.includes('$') || false;

      setFormData({
        id: editQuestion.id,
        categoryId: editQuestion.categories?.id || "",
        subjectId: editQuestion.popular_subjects?.id || editQuestion.subject_id || "",
        chapter_id: editQuestion.chapter_id || "",
        topic_id: editQuestion.topic_id || "",
        question_text: editQuestion.question_text || "",
        question_format: editQuestion.question_format || "single_choice",
        question_type: editQuestion.question_type || "objective",
        difficulty: editQuestion.difficulty || "medium",
        marks: editQuestion.marks || 1,
        correct_answer: editQuestion.correct_answer || "",
        explanation: editQuestion.explanation || "",
        contains_formula: editQuestion.contains_formula || hasFormula,
        options: flatOptions,
        question_images: editQuestion.question_image_url ? [editQuestion.question_image_url] : [],
        option_images: editQuestion.option_images || {},
        explanation_images: [],
      });
    } else {
      resetForm();
    }
  }, [editQuestion]);

  // Filter subjects by selected category
  const subjects = allSubjects?.filter(subject => {
    if (!formData.categoryId) return true;
    return subject.category_id === formData.categoryId;
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Cascade reset logic - clear dependent fields when parent changes
      if (field === 'categoryId') {
        updated.subjectId = "";
        updated.chapter_id = "";
        updated.topic_id = "";
      }
      if (field === 'subjectId') {
        updated.chapter_id = "";
        updated.topic_id = "";
      }
      if (field === 'chapter_id') {
        updated.topic_id = "";
      }
      
      // Auto-determine question_type based on format
      if (field === 'question_format') {
        if (['single_choice', 'multiple_choice', 'true_false'].includes(value)) {
          updated.question_type = 'objective';
        } else if (['fill_blank', 'short_answer'].includes(value)) {
          updated.question_type = 'subjective';
        }
      }
      
      return updated;
    });
  };

  const handleOptionChange = (option: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      options: { ...prev.options, [option]: value }
    }));
  };

  const handleOptionImageChange = (option: string, images: string[]) => {
    setFormData(prev => ({
      ...prev,
      option_images: { ...prev.option_images, [option]: images }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Only validate location fields if NOT in simple edit mode
    if (!simpleEditMode) {
      if (!formData.categoryId) {
        toast.error("Please select a category");
        return;
      }

      if (!formData.subjectId) {
        toast.error("Please select a subject");
        return;
      }

      if (!formData.chapter_id) {
        toast.error("Please select a chapter");
        return;
      }
    }

    if (!formData.question_text || !formData.correct_answer) {
      toast.error("Question text and correct answer are required");
      return;
    }

    try {
      // Get primary image URL from images array
      const question_image_url = formData.question_images?.[0] || null;
      
      // Convert option_images arrays to single URLs (first image of each)
      const option_images_obj: Record<string, string> = {};
      Object.entries(formData.option_images || {}).forEach(([key, images]) => {
        if (images && images.length > 0) {
          option_images_obj[key] = images[0];
        }
      });

      // Convert flat format { A: "..." } to nested { A: { text: "..." } } for database
      const nestedOptions: Record<string, { text: string }> = {};
      Object.entries(formData.options).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          nestedOptions[key] = { text: value };
        }
      });

      const questionData = {
        question_text: formData.question_text,
        question_format: formData.question_format,
        question_type: formData.question_type,
        difficulty: formData.difficulty,
        marks: formData.marks,
        correct_answer: formData.correct_answer.toUpperCase(),
        explanation: formData.explanation || null,
        options: Object.keys(nestedOptions).length > 0 ? nestedOptions : null,
        topic_id: formData.topic_id || null,
        chapter_id: formData.chapter_id || null,
        is_verified: false,
        is_ai_generated: false,
        contains_formula: formData.contains_formula,
        question_image_url,
        option_images: Object.keys(option_images_obj).length > 0 ? option_images_obj : null,
      };

      if (editQuestion) {
        await updateQuestionMutation.mutateAsync({
          id: formData.id,
          updates: questionData,
        });
        toast.success("Question updated successfully");
      } else {
        await createQuestionMutation.mutateAsync(questionData);
        toast.success("Question created successfully");
      }

      onClose();
      resetForm();
    } catch (error: any) {
      toast.error(error.message || `Failed to ${editQuestion ? 'update' : 'create'} question`);
    }
  };

  const resetForm = () => {
    setFormData({
      id: "",
      categoryId: "",
      subjectId: "",
      chapter_id: "",
      topic_id: "",
      question_text: "",
      question_format: "single_choice",
      question_type: "objective",
      difficulty: "Medium",
      marks: 1,
      correct_answer: "",
      explanation: "",
      contains_formula: false,
      options: {},
      question_images: [],
      option_images: {},
      explanation_images: [],
    });
    setActiveTab("question");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editQuestion ? 'Edit Question' : 'Add New Question'}</DialogTitle>
          <DialogDescription>
            {editQuestion ? 'Update the question details below' : 'Create a new question with rich content and image support'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="question">Question</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>

            <TabsContent value="question" className="space-y-4 mt-4">
              <QuestionTabContent
                formData={formData}
                onChange={handleChange}
                categories={categories || []}
                subjects={subjects || []}
                chapters={chapters || []}
                topics={topics || []}
                simpleEditMode={simpleEditMode}
              />
            </TabsContent>

            <TabsContent value="options" className="space-y-4 mt-4">
              <OptionsTabContent
                formData={formData}
                onChange={handleChange}
                onOptionChange={handleOptionChange}
                onOptionImageChange={handleOptionImageChange}
              />
            </TabsContent>

            <TabsContent value="details" className="space-y-4 mt-4">
              <DetailsTabContent
                formData={formData}
                onChange={handleChange}
              />
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createQuestionMutation.isPending || updateQuestionMutation.isPending}
            >
              {(createQuestionMutation.isPending || updateQuestionMutation.isPending) && "Saving..."}
              {!createQuestionMutation.isPending && !updateQuestionMutation.isPending && (editQuestion ? 'Update Question' : 'Create Question')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}