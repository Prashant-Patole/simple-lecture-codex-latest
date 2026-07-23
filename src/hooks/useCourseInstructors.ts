import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export const useCourseInstructors = (courseId?: string) => {
  return useQuery({
    queryKey: ["course-instructors", courseId],
    queryFn: async () => {
      if (!courseId) return [];

      // Step 1: Get subjects for this course
      const { data: courseSubjects, error: csError } = await supabase
        .from("course_subjects")
        .select("subject_id")
        .eq("course_id", courseId);

      if (csError) throw csError;
      if (!courseSubjects || courseSubjects.length === 0) return [];

      const subjectIds = courseSubjects.map(cs => cs.subject_id);

      // Step 2: Get instructor_subjects for these subjects
      const { data: instructorSubjects, error: isError } = await supabase
        .from("instructor_subjects")
        .select("*")
        .in("subject_id", subjectIds);

      if (isError) throw isError;
      if (!instructorSubjects || instructorSubjects.length === 0) return [];

      // Step 3: Get unique instructor IDs
      const instructorIds = [...new Set(instructorSubjects.map(row => row.instructor_id).filter(Boolean))];

      // Step 4: Fetch teachers with departments
      const { data: teachers, error: teachersError } = await supabase
        .from("teacher_profiles")
        .select(`
          id,
          full_name,
          email,
          phone_number,
          departments(id, name)
        `)
        .in("id", instructorIds);

      if (teachersError) throw teachersError;

      // Step 5: Fetch subjects
      const { data: subjects, error: subsError } = await supabase
        .from("popular_subjects")
        .select("id, name")
        .in("id", subjectIds);

      if (subsError) throw subsError;

      // Step 6: Filter out null instructor_ids and map the data
      return instructorSubjects
        .filter(is => is.instructor_id !== null)
        .map(is => {
          const teacher = teachers?.find(t => t.id === is.instructor_id);
          const subject = subjects?.find(s => s.id === is.subject_id);
          
          return {
            ...is,
            teacher: teacher || null,
            subject: subject || null
          };
        });
    },
    enabled: !!courseId,
  });
};

export const useAddCourseInstructor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      courseId,
      instructorId,
      subjectId,
    }: {
      courseId: string;
      instructorId: string;
      subjectId: string;
    }) => {
      const { data, error } = await supabase
        .from("instructor_subjects")
        .insert({
          instructor_id: instructorId,
          subject_id: subjectId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["course-instructors", variables.courseId] });
      queryClient.invalidateQueries({ queryKey: ["instructor-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
      toast({ title: "Success", description: "Instructor added to course" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};

export const useRemoveCourseInstructor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      courseId,
    }: {
      id: string;
      courseId: string;
    }) => {
      const { error } = await supabase
        .from("instructor_subjects")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return { courseId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["course-instructors", data.courseId] });
      queryClient.invalidateQueries({ queryKey: ["instructor-subjects"] });
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
      toast({ title: "Success", description: "Instructor removed from course" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
};
