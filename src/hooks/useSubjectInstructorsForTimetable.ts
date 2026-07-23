import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Fetch all instructors who are mapped to a specific subject
export const useSubjectInstructorsForTimetable = (subjectId?: string) => {
  return useQuery({
    queryKey: ["subject-instructors-timetable", subjectId],
    queryFn: async () => {
      if (!subjectId) return [];

      // Get instructor IDs from instructor_subjects
      const { data: instructorSubjects, error: isError } = await supabase
        .from("instructor_subjects")
        .select("instructor_id")
        .eq("subject_id", subjectId);

      if (isError) throw isError;
      if (!instructorSubjects || instructorSubjects.length === 0) return [];

      const instructorIds = [...new Set(instructorSubjects.map(row => row.instructor_id).filter(Boolean))];

      // Fetch teacher profiles
      const { data: teachers, error: teachersError } = await supabase
        .from("teacher_profiles")
        .select(`
          id,
          full_name,
          email,
          phone_number,
          department:departments!teacher_profiles_department_id_fkey(id, name)
        `)
        .in("id", instructorIds)
        .order("full_name");

      if (teachersError) throw teachersError;
      return teachers || [];
    },
    enabled: !!subjectId,
  });
};

// Fetch all instructors (fallback when no subject-specific instructors)
export const useAllInstructorsForTimetable = () => {
  return useQuery({
    queryKey: ["all-instructors-timetable"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_profiles")
        .select(`
          id,
          full_name,
          email,
          phone_number,
          department:departments!teacher_profiles_department_id_fkey(id, name)
        `)
        .order("full_name");

      if (error) throw error;
      return data || [];
    },
  });
};
