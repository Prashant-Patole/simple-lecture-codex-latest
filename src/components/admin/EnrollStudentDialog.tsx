import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { SearchableCategorySelector } from "@/components/admin/SearchableCategorySelector";
import { useCourses } from "@/hooks/useCourses";
import { useAdminBatches } from "@/hooks/useAdminBatches";
import { useEnrollStudent } from "@/hooks/useEnrollmentWithBatch";
import { Badge } from "@/components/ui/badge";

interface EnrollStudentDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EnrollStudentDialog({ isOpen, onClose }: EnrollStudentDialogProps) {
  const [categoryId, setCategoryId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [studentEmail, setStudentEmail] = useState("");

  
  const { data: allCourses } = useCourses();
  const { data: batches } = useAdminBatches();
  const enrollMutation = useEnrollStudent();

  const courses = allCourses?.filter(course => {
    if (!categoryId) return true;
    return course.course_categories?.some(cc => cc.category_id === categoryId);
  });

  const courseBatches = batches?.filter(b => b.course_id === courseId && b.is_active);

  const handleEnroll = async () => {
    if (!studentEmail || !courseId) {
      return;
    }

    // In production, you'd look up the student by email first
    // For now, we'll assume the email is the student_id
    await enrollMutation.mutateAsync({
      student_id: studentEmail,
      course_id: courseId,
      batch_id: batchId || undefined,
    });

    handleClose();
  };

  const handleClose = () => {
    setCategoryId("");
    setCourseId("");
    setBatchId("");
    setStudentEmail("");
    onClose();
  };

  const selectedBatch = courseBatches?.find(b => b.id === batchId);
  const isBatchFull = selectedBatch && selectedBatch.max_students 
    ? selectedBatch.current_students >= selectedBatch.max_students 
    : false;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enroll Student</DialogTitle>
          <DialogDescription>
            Assign a student to a course and batch
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Student Email *</Label>
            <Input
              type="email"
              value={studentEmail}
              onChange={(e) => setStudentEmail(e.target.value)}
              placeholder="student@example.com"
            />
          </div>

          <div className="space-y-2">
            <SearchableCategorySelector
              value={categoryId}
              onChange={(v) => {
                setCategoryId(v);
                setCourseId("");
                setBatchId("");
              }}
              label="Category"
              placeholder="Search category..."
            />
          </div>

          <div className="space-y-2">
            <Label>Course *</Label>
            <Select value={courseId} onValueChange={(v) => {
              setCourseId(v);
              setBatchId("");
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

          <div className="space-y-2">
            <Label>Batch (Optional)</Label>
            <Select value={batchId} onValueChange={setBatchId} disabled={!courseId}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select batch" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {courseBatches?.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    <div className="flex items-center gap-2">
                      {batch.name}
                      {batch.max_students && (
                        <Badge variant={batch.current_students >= batch.max_students ? "destructive" : "secondary"}>
                          {batch.current_students}/{batch.max_students}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isBatchFull && (
              <p className="text-sm text-destructive">This batch is full</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleEnroll} 
              disabled={!studentEmail || !courseId || enrollMutation.isPending || isBatchFull}
            >
              {enrollMutation.isPending ? "Enrolling..." : "Enroll Student"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}