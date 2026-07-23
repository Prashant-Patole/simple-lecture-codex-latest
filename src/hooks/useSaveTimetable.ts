import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TimetableEntry {
  course_id: string;
  batch_id?: string;
  subject_id?: string;
  instructor_id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_number?: string;
  valid_from: string;
  valid_until?: string;
  academic_year: string;
}

export const useSaveTimetable = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entries: TimetableEntry[]) => {
      if (entries.length === 0) {
        throw new Error("No timetable entries to save");
      }

      // Validate required fields
      for (const entry of entries) {
        if (!entry.course_id || entry.day_of_week === undefined || entry.day_of_week === null || !entry.start_time || !entry.end_time || !entry.academic_year) {
          throw new Error("Missing required fields: course, day, times, and academic year are mandatory");
        }
      }

      const { data, error } = await supabase
        .from('course_timetables')
        .insert(entries)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['course-timetables'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-timetable'] });
      queryClient.invalidateQueries({ queryKey: ['instructor-conflicts'] });
      toast.success(`Successfully saved ${data.length} timetable entries`);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save timetable");
    },
  });
};