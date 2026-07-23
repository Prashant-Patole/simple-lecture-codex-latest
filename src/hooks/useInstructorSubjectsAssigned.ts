import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentAuthUser } from "@/hooks/useCurrentAuthUser";

export const useInstructorSubjectsAssigned = () => {
  const { data: authUser } = useCurrentAuthUser();

  return useQuery({
    queryKey: ["instructor-subjects-assigned", authUser?.id],
    queryFn: async () => {
      if (!authUser?.id) return [];

      const { data, error } = await supabase
        .from("instructor_subjects")
        .select(`
          id,
          subject:popular_subjects(
            id,
            name,
            slug,
            description,
            image_url
          ),
          course:courses(
            id,
            name,
            slug
          )
        `)
        .eq("instructor_id", authUser.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!authUser?.id,
  });
};
