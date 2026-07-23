import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateLiveClassFromTimetable } from "@/hooks/useInstructorTimetable";
import { useInstructors } from "@/hooks/useInstructors";
import { useCourses } from "@/hooks/useCourses";
import { useCourseSubjects } from "@/hooks/useCourseSubjects";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectChaptersTopics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface LiveClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classData?: any;
  timetableEntry?: any;
}

export const LiveClassDialog = ({ open, onOpenChange, classData, timetableEntry }: LiveClassDialogProps) => {
  const [formData, setFormData] = useState({
    course_id: "",
    subject_id: "",
    chapter_id: "",
    topic_id: "",
    teacher_id: "",
    scheduled_at: "",
    duration_minutes: "60",
    meeting_link: "",
    notes: "",
  });

  const { data: courses } = useCourses();
  const { data: courseSubjects } = useCourseSubjects(formData.course_id || undefined);
  const { data: chapters } = useSubjectChapters(formData.subject_id || undefined);
  const { data: topics } = useChapterTopics(formData.chapter_id || undefined);
  const { data: instructors } = useInstructors();
  const createClass = useCreateLiveClassFromTimetable();

  useEffect(() => {
    if (timetableEntry) {
      setFormData({
        ...formData,
        subject_id: timetableEntry.subject_id || "",
        teacher_id: timetableEntry.instructor_id || "",
        chapter_id: timetableEntry.chapter_id || "",
        duration_minutes: timetableEntry.duration_minutes?.toString() || "60",
      });
    } else if (classData) {
      setFormData({
        course_id: classData.course_id || "",
        subject_id: classData.subject_id || "",
        chapter_id: classData.chapter_id || "",
        topic_id: classData.topic_id || "",
        teacher_id: classData.teacher_id || "",
        scheduled_at: classData.scheduled_at ? new Date(classData.scheduled_at).toISOString().slice(0, 16) : "",
        duration_minutes: classData.duration_minutes?.toString() || "60",
        meeting_link: classData.meeting_link || "",
        notes: classData.notes || "",
      });
    }
  }, [classData, timetableEntry]);

  // Reset dependent fields when parent changes
  const handleCourseChange = (value: string) => {
    setFormData({
      ...formData,
      course_id: value,
      subject_id: "",
      chapter_id: "",
      topic_id: "",
    });
  };

  const handleSubjectChange = (value: string) => {
    setFormData({
      ...formData,
      subject_id: value,
      chapter_id: "",
      topic_id: "",
    });
  };

  const handleChapterChange = (value: string) => {
    setFormData({
      ...formData,
      chapter_id: value,
      topic_id: "",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.course_id) {
      toast.error("Please select a course");
      return;
    }
    if (!formData.subject_id) {
      toast.error("Please select a subject");
      return;
    }
    if (!formData.teacher_id) {
      toast.error("Please select an instructor");
      return;
    }
    if (!formData.scheduled_at) {
      toast.error("Please select a date and time");
      return;
    }

    // Get subject name for the subject field
    const selectedSubject = courseSubjects?.find(s => s.subject?.id === formData.subject_id);
    const subjectName = selectedSubject?.subject?.name || "";

    const data = {
      subject: subjectName,
      course_id: formData.course_id,
      subject_id: formData.subject_id,
      chapter_id: formData.chapter_id || null,
      topic_id: formData.topic_id || null,
      teacher_id: formData.teacher_id,
      duration_minutes: parseInt(formData.duration_minutes),
      scheduled_at: new Date(formData.scheduled_at).toISOString(),
      meeting_link: formData.meeting_link || null,
      notes: formData.notes || null,
      timetable_entry_id: timetableEntry?.id || null,
      is_live: false,
      is_cancelled: false,
    };

    await createClass.mutateAsync(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {classData ? "Edit" : "Create"} Live Class
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Course Selection */}
            <div>
              <Label>Course *</Label>
              <Select
                value={formData.course_id}
                onValueChange={handleCourseChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject Selection */}
            <div>
              <Label>Subject *</Label>
              <Select
                value={formData.subject_id}
                onValueChange={handleSubjectChange}
                disabled={!formData.course_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.course_id ? "Select subject" : "Select course first"} />
                </SelectTrigger>
                <SelectContent>
                  {courseSubjects?.map((cs) => (
                    <SelectItem key={cs.subject?.id} value={cs.subject?.id || ""}>
                      {cs.subject?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Chapter Selection */}
            <div>
              <Label>Chapter</Label>
              <Select
                value={formData.chapter_id}
                onValueChange={handleChapterChange}
                disabled={!formData.subject_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.subject_id ? "Select chapter (optional)" : "Select subject first"} />
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

            {/* Topic Selection */}
            <div>
              <Label>Topic</Label>
              <Select
                value={formData.topic_id}
                onValueChange={(value) => setFormData({ ...formData, topic_id: value })}
                disabled={!formData.chapter_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.chapter_id ? "Select topic (optional)" : "Select chapter first"} />
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

            {/* Instructor Selection */}
            <div>
              <Label>Instructor *</Label>
              <Select
                value={formData.teacher_id}
                onValueChange={(value) => setFormData({ ...formData, teacher_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select instructor" />
                </SelectTrigger>
                <SelectContent>
                  {instructors?.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date & Time */}
            <div>
              <Label htmlFor="scheduled_at">Date & Time *</Label>
              <Input
                id="scheduled_at"
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                required
              />
            </div>

            {/* Duration */}
            <div>
              <Label htmlFor="duration_minutes">Duration (minutes) *</Label>
              <Input
                id="duration_minutes"
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                required
              />
            </div>

            {/* Meeting Link */}
            <div>
              <Label htmlFor="meeting_link">Meeting Link</Label>
              <Input
                id="meeting_link"
                type="url"
                placeholder="https://zoom.us/j/..."
                value={formData.meeting_link}
                onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes / Description</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={createClass.isPending}>
              {createClass.isPending ? "Saving..." : classData ? "Update" : "Create"} Live Class
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
