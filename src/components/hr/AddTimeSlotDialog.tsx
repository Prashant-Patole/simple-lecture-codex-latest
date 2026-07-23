import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTimetableEntry } from "@/hooks/useInstructorTimetable";
import { useAllSubjects } from "@/hooks/useAllSubjects";
import { useInstructorSubjects } from "@/hooks/useInstructors";
import { useAdminBatches } from "@/hooks/useAdminBatches";
import { usePaginatedCourses } from "@/hooks/usePaginatedCourses";
import { useInstructorConflicts, checkConflicts, checkSubjectConflicts, checkLiveClassConflicts, ConflictInfo } from "@/hooks/useInstructorConflicts";
import { ConflictAlert } from "./ConflictAlert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AddTimeSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instructorId: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const AddTimeSlotDialog = ({ open, onOpenChange, instructorId }: AddTimeSlotDialogProps) => {
  const { data: allSubjects } = useAllSubjects();
  const { data: instructorSubjects } = useInstructorSubjects(instructorId);
  const { data: batches } = useAdminBatches();
  const { data: coursesData } = usePaginatedCourses({ page: 1, pageSize: 100 });
  const { data: existingEntries } = useInstructorConflicts(instructorId);
  const createEntry = useCreateTimetableEntry();
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);
  const [formData, setFormData] = useState({
    course_id: "",
    subject_id: "",
    batch_id: "",
    day_of_week: "",
    start_time: "",
    end_time: "",
    room_number: "",
    meeting_link: "",
    academic_year: "2024-2025",
    valid_from: new Date().toISOString().split("T")[0],
    valid_until: "",
  });

  // Separate instructor's assigned subjects vs other subjects
  const assignedSubjectIds = new Set(instructorSubjects?.map(is => is.subject_id) || []);
  const assignedSubjects = allSubjects?.filter(s => assignedSubjectIds.has(s.id)) || [];
  const otherSubjects = allSubjects?.filter(s => !assignedSubjectIds.has(s.id)) || [];

  // Check for all conflicts when day/time/subject changes
  useEffect(() => {
    const checkAllConflicts = async () => {
      if (!formData.day_of_week || !formData.start_time || !formData.end_time) {
        setConflicts([]);
        return;
      }

      setIsCheckingConflicts(true);
      const allConflicts: ConflictInfo[] = [];

      // 1. Check instructor time conflicts
      if (existingEntries) {
        const instructorConflicts = checkConflicts(
          {
            day_of_week: parseInt(formData.day_of_week),
            start_time: formData.start_time,
            end_time: formData.end_time,
            instructor_id: instructorId,
          },
          existingEntries
        );
        allConflicts.push(...instructorConflicts);
      }

      // 2. Check subject conflicts (same subject at same time)
      if (formData.subject_id) {
        const subjectConflicts = await checkSubjectConflicts({
          day_of_week: parseInt(formData.day_of_week),
          start_time: formData.start_time,
          end_time: formData.end_time,
          instructor_id: instructorId,
          subject_id: formData.subject_id,
        });
        allConflicts.push(...subjectConflicts);
      }

      // 3. Check live class conflicts
      const liveClassConflicts = await checkLiveClassConflicts(
        instructorId,
        parseInt(formData.day_of_week),
        formData.start_time,
        formData.end_time
      );
      allConflicts.push(...liveClassConflicts);

      setConflicts(allConflicts);
      setIsCheckingConflicts(false);
    };

    checkAllConflicts();
  }, [formData.day_of_week, formData.start_time, formData.end_time, formData.subject_id, existingEntries, instructorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.course_id) {
      toast.error("Please select a course");
      return;
    }
    if (!formData.subject_id) {
      toast.error("Please select a subject");
      return;
    }
    if (!formData.day_of_week) {
      toast.error("Please select a day of week");
      return;
    }

    // Block on hard conflicts
    const hardConflicts = conflicts.filter(c => c.type === "hard");
    if (hardConflicts.length > 0) {
      toast.error("Cannot save: There are scheduling conflicts. Please fix them first.");
      return;
    }
    
    // Create the timetable entry
    await createEntry.mutateAsync({
      course_id: formData.course_id,
      instructor_id: instructorId,
      subject_id: formData.subject_id || null,
      batch_id: formData.batch_id || null,
      day_of_week: parseInt(formData.day_of_week),
      start_time: formData.start_time,
      end_time: formData.end_time,
      room_number: formData.room_number || null,
      meeting_link: formData.meeting_link || null,
      academic_year: formData.academic_year,
      valid_from: formData.valid_from,
      valid_until: formData.valid_until || null,
      is_active: true,
    });

    // If subject is selected, auto-map it to the instructor
    if (formData.subject_id && !assignedSubjectIds.has(formData.subject_id)) {
      try {
        // Check if mapping already exists
        const { data: existing } = await supabase
          .from("instructor_subjects")
          .select("id")
          .eq("instructor_id", instructorId)
          .eq("subject_id", formData.subject_id)
          .maybeSingle();

        if (!existing) {
          // Create the mapping
          const { error } = await supabase
            .from("instructor_subjects")
            .insert({
              instructor_id: instructorId,
              subject_id: formData.subject_id,
            });

          if (error) {
            console.error("Error mapping subject:", error);
          } else {
            toast.success("Subject automatically mapped to instructor");
          }
        }
      } catch (error) {
        console.error("Error checking/creating subject mapping:", error);
      }
    }

    onOpenChange(false);
    setFormData({
      course_id: "",
      subject_id: "",
      batch_id: "",
      day_of_week: "",
      start_time: "",
      end_time: "",
      room_number: "",
      meeting_link: "",
      academic_year: "2024-2025",
      valid_from: new Date().toISOString().split("T")[0],
      valid_until: "",
    });
    setConflicts([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Time Slot</DialogTitle>
        </DialogHeader>
        
        {conflicts.length > 0 && (
          <ConflictAlert conflicts={conflicts} />
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Course *</Label>
            <Select value={formData.course_id} onValueChange={(val) => setFormData({ ...formData, course_id: val })} required>
              <SelectTrigger>
                <SelectValue placeholder="Select course" />
              </SelectTrigger>
              <SelectContent>
                {coursesData?.courses?.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Subject *</Label>
            <Select value={formData.subject_id} onValueChange={(val) => setFormData({ ...formData, subject_id: val })} required>
              <SelectTrigger>
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                {assignedSubjects.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Assigned Subjects
                    </div>
                    {assignedSubjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </>
                )}
                {otherSubjects.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                      Other Subjects (will auto-assign)
                    </div>
                    {otherSubjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Day of Week *</Label>
            <Select value={formData.day_of_week} onValueChange={(val) => setFormData({ ...formData, day_of_week: val })} required>
              <SelectTrigger>
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day, idx) => (
                  <SelectItem key={idx} value={idx.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start Time *</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>End Time *</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label>Batch (Optional)</Label>
            <Select value={formData.batch_id} onValueChange={(val) => setFormData({ ...formData, batch_id: val })}>
              <SelectTrigger>
                <SelectValue placeholder="Select batch" />
              </SelectTrigger>
              <SelectContent>
                {batches?.filter(b => !formData.course_id || b.course_id === formData.course_id).map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Room Number</Label>
            <Input
              value={formData.room_number}
              onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              placeholder="Optional"
            />
          </div>

          <div>
            <Label>Meeting Link (Recurring)</Label>
            <Input
              type="url"
              value={formData.meeting_link}
              onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
              placeholder="e.g., https://meet.google.com/abc-xyz"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This link will be used for all occurrences of this class
            </p>
          </div>

          <div>
            <Label>Academic Year</Label>
            <Input
              value={formData.academic_year}
              onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Valid From</Label>
              <Input
                type="date"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>Valid Until</Label>
              <Input
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createEntry.isPending || isCheckingConflicts || conflicts.some(c => c.type === "hard")}
            >
              {createEntry.isPending ? "Adding..." : isCheckingConflicts ? "Checking..." : "Add Time Slot"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
