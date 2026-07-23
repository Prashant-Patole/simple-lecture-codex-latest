import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAuthUser } from "@/hooks/useCurrentAuthUser";

interface ScheduledClass {
  id: string;
  scheduled_at: string;
  is_live: boolean;
  bbb_meeting_id: string | null;
  recording_url: string | null;
  course_id: string | null;
  subject_id: string | null;
  teacher_id: string | null;
  course: { id: string; name: string; slug: string } | null;
  subject: { id: string; name: string } | null;
  instructor: { id: string; full_name: string; avatar_url: string | null } | null;
}

export const useInstructorClasses = (dateFilter?: string) => {
  const { data: authUser } = useCurrentAuthUser();

  return useQuery({
    queryKey: ["instructor-classes", authUser?.id, dateFilter],
    queryFn: async () => {
      if (!authUser?.id) return [] as ScheduledClass[];

      let query = supabase
        .from("scheduled_classes")
        .select(`
          id,
          scheduled_at,
          is_live,
          bbb_meeting_id,
          recording_url,
          course_id,
          subject_id,
          teacher_id,
          course:courses(id, name, slug),
          instructor:teacher_profiles(id, full_name, avatar_url)
        `)
        .eq("teacher_id", authUser.id)
        .order("scheduled_at", { ascending: true });

      if (dateFilter === "today") {
        const today = new Date().toISOString().split("T")[0];
        query = query.gte("scheduled_at", `${today}T00:00:00`)
          .lt("scheduled_at", `${today}T23:59:59`);
      } else if (dateFilter === "upcoming") {
        query = query.gte("scheduled_at", new Date().toISOString());
      } else if (dateFilter === "past") {
        query = query.lt("scheduled_at", new Date().toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch subject names separately since there's no direct relation
      const classesWithSubjects = await Promise.all((data || []).map(async (classItem: any) => {
        let subject = null;
        if (classItem.subject_id) {
          const { data: subjectData } = await supabase
            .from("popular_subjects")
            .select("id, name")
            .eq("id", classItem.subject_id)
            .single();
          subject = subjectData;
        }
        return { ...classItem, subject };
      }));

      return classesWithSubjects as ScheduledClass[];
    },
    enabled: !!authUser?.id,
  });
};

export const useInstructorTodayClasses = () => {
  return useInstructorClasses("today");
};

export const useInstructorUpcomingClasses = () => {
  return useInstructorClasses("upcoming");
};
