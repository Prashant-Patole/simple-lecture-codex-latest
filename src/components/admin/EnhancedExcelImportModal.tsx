import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { SearchableCategorySelector } from "@/components/admin/SearchableCategorySelector";
import { useCourses } from "@/hooks/useCourses";
import { useCourseSubjects } from "@/hooks/useCourseSubjects";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectManagement";
import { useBulkImportQuestions } from "@/hooks/useSubjectQuestions";
import * as XLSX from 'xlsx';
import { toast } from "sonner";

interface EnhancedExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EnhancedExcelImportModal({ isOpen, onClose }: EnhancedExcelImportModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [categoryId, setCategoryId] = useState<string>("");
  const [courseId, setCourseId] = useState<string>("");
  const [chapterId, setChapterId] = useState<string>("");
  const [topicId, setTopicId] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState(0);

  
  const { data: allCourses } = useCourses();
  const { data: courseSubjects } = useCourseSubjects(courseId);
  const { data: chapters } = useSubjectChapters(courseSubjects?.[0]?.subject_id || "");
  const { data: topics } = useChapterTopics(chapterId);
  const bulkImportMutation = useBulkImportQuestions();

  const courses = allCourses?.filter(course => {
    if (!categoryId) return true;
    return course.course_categories?.some(cc => cc.category_id === categoryId);
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrors([]);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        question_text: "What is 2 + 2?",
        question_format: "single_choice",
        option_a: "3",
        option_b: "4",
        option_c: "5",
        option_d: "6",
        correct_answer: "B",
        explanation: "2 + 2 equals 4",
        difficulty: "easy",
        marks: 1,
        question_type: "objective"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    
    // Set column widths
    ws['!cols'] = [
      { wch: 50 }, // question_text
      { wch: 15 }, // question_format
      { wch: 30 }, // option_a
      { wch: 30 }, // option_b
      { wch: 30 }, // option_c
      { wch: 30 }, // option_d
      { wch: 15 }, // correct_answer
      { wch: 50 }, // explanation
      { wch: 10 }, // difficulty
      { wch: 5 },  // marks
      { wch: 15 }  // question_type
    ];

    XLSX.writeFile(wb, "question_import_template.xlsx");
    toast.success("Template downloaded successfully");
  };

  const processExcelFile = async () => {
    if (!selectedFile) {
      toast.error("Please select a file");
      return;
    }

    if (!courseId) {
      toast.error("Please select a course");
      return;
    }

    setProcessing(true);
    setProgress(0);
    setErrors([]);
    setSuccessCount(0);

    try {
      const data = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error("The Excel file is empty");
      }

      setProgress(20);

      const questions = jsonData.map((row: any) => {
        const options: any = {};
        
        if (row.option_a) options.A = String(row.option_a);
        if (row.option_b) options.B = String(row.option_b);
        if (row.option_c) options.C = String(row.option_c);
        if (row.option_d) options.D = String(row.option_d);

        return {
          question_text: String(row.question_text || ''),
          question_format: row.question_format || 'single_choice',
          options: Object.keys(options).length > 0 ? options : null,
          correct_answer: String(row.correct_answer || '').toUpperCase(),
          explanation: row.explanation ? String(row.explanation) : null,
          difficulty: row.difficulty || 'medium',
          marks: parseInt(row.marks) || 1,
          question_type: row.question_type || 'objective',
          topic_id: topicId || null,
          is_verified: false,
          is_ai_generated: false,
          contains_formula: false,
        };
      });

      setProgress(40);

      await bulkImportMutation.mutateAsync(
        { questions },
        {
          onSuccess: (result) => {
            setSuccessCount(result.success);
            if (result.errors.length > 0) {
              setErrors(result.errors);
            }
            setProgress(100);
          },
        }
      );

    } catch (error: any) {
      setErrors([error.message || "Failed to process file"]);
      toast.error("Failed to import questions");
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setCategoryId("");
    setCourseId("");
    setChapterId("");
    setTopicId("");
    setProcessing(false);
    setProgress(0);
    setErrors([]);
    setSuccessCount(0);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Questions from Excel</DialogTitle>
          <DialogDescription>
            Upload an Excel file with questions. Select the category and course for these questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Download */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Download Template</p>
                <p className="text-sm text-muted-foreground">Get the Excel template with correct format</p>
              </div>
            </div>
            <Button onClick={downloadTemplate} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>

          {/* Category & Course Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <SearchableCategorySelector
                value={categoryId}
                onChange={(value) => {
                  setCategoryId(value);
                  setCourseId("");
                  setChapterId("");
                  setTopicId("");
                }}
                label="Category"
                placeholder="Search category..."
              />
            </div>

            <div className="space-y-2">
              <Label>Course *</Label>
              <Select value={courseId} onValueChange={(value) => {
                setCourseId(value);
                setChapterId("");
                setTopicId("");
              }} disabled={!categoryId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {courses?.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Chapter & Topic Selection (Optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Chapter (Optional)</Label>
              <Select value={chapterId} onValueChange={(value) => {
                setChapterId(value);
                setTopicId("");
              }} disabled={!courseId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select chapter" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {chapters?.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Topic (Optional)</Label>
              <Select value={topicId} onValueChange={setTopicId} disabled={!chapterId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select topic" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {topics?.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Upload Excel File *</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                disabled={processing || !courseId}
              />
              {selectedFile && (
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              )}
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name}
              </p>
            )}
          </div>

          {/* Progress */}
          {processing && (
            <div className="space-y-2">
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Processing... {progress}%
              </p>
            </div>
          )}

          {/* Results */}
          {successCount > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Successfully imported {successCount} question(s)
              </AlertDescription>
            </Alert>
          )}

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium">Errors occurred:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {errors.slice(0, 5).map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                  {errors.length > 5 && (
                    <li className="text-sm">... and {errors.length - 5} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={processing}>
              Close
            </Button>
            <Button 
              onClick={processExcelFile} 
              disabled={!selectedFile || !courseId || processing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Questions
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}