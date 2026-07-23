import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCourseFAQs, useCreateCourseFAQ, useUpdateCourseFAQ, useDeleteCourseFAQ } from "@/hooks/useCourseFAQs";
import { useAICourseContent } from "@/hooks/useAICourseContent";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CourseFAQsTabProps {
  courseId?: string;
  courseName: string;
  shortDescription?: string;
}

export const CourseFAQsTab = ({ courseId, courseName, shortDescription }: CourseFAQsTabProps) => {
  const { data: faqs } = useCourseFAQs(courseId);
  const createFAQ = useCreateCourseFAQ();
  const updateFAQ = useUpdateCourseFAQ();
  const deleteFAQ = useDeleteCourseFAQ();
  const generateAnswer = useAICourseContent();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<any>(null);
  const [formData, setFormData] = useState({ question: "", answer: "" });

  const handleOpenDialog = (faq?: any) => {
    if (faq) {
      setEditingFAQ(faq);
      setFormData({ question: faq.question, answer: faq.answer });
    } else {
      setEditingFAQ(null);
      setFormData({ question: "", answer: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) return;

    if (editingFAQ) {
      await updateFAQ.mutateAsync({
        id: editingFAQ.id,
        courseId,
        question: formData.question,
        answer: formData.answer,
      });
    } else {
      const displayOrder = (faqs?.length || 0) + 1;
      await createFAQ.mutateAsync({
        course_id: courseId,
        question: formData.question,
        answer: formData.answer,
        display_order: displayOrder,
      });
    }

    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!courseId || !confirm("Are you sure you want to delete this FAQ?")) return;
    await deleteFAQ.mutateAsync({ id, courseId });
  };

  const handleGenerateAnswer = () => {
    generateAnswer.mutate({
      type: "faq_answer",
      context: {
        courseName,
        shortDescription,
        question: formData.question,
      },
    }, {
      onSuccess: (data) => {
        setFormData(prev => ({ ...prev, answer: data.content }));
      },
    });
  };

  if (!courseId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Please save the course first before adding FAQs
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Label>Course FAQs</Label>
        <Button onClick={() => handleOpenDialog()} type="button">
          <Plus className="w-4 h-4 mr-2" />
          Add FAQ
        </Button>
      </div>

      {faqs && faqs.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Question</TableHead>
              <TableHead>Answer</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {faqs.map((faq) => (
              <TableRow key={faq.id}>
                <TableCell className="font-medium">{faq.question}</TableCell>
                <TableCell className="max-w-md truncate">{faq.answer}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(faq)}
                      type="button"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(faq.id)}
                      type="button"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground">No FAQs added yet</p>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingFAQ ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                value={formData.question}
                onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                placeholder="Enter question"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="answer">Answer</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateAnswer}
                  disabled={!formData.question || generateAnswer.isPending}
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  {generateAnswer.isPending ? "Generating..." : "Generate with AI"}
                </Button>
              </div>
              <Textarea
                id="answer"
                value={formData.answer}
                onChange={(e) => setFormData(prev => ({ ...prev, answer: e.target.value }))}
                placeholder="Enter answer"
                rows={5}
                required
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createFAQ.isPending || updateFAQ.isPending}>
                {editingFAQ ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};