import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type SectionType = 'bestsellers' | 'top_courses';

// Helper to get safe thumbnail URL (skip base64 data)
export const getSafeThumbnailUrl = (url: string | null): string => {
  if (!url) return "/placeholder-course.jpg";
  // Only return if it's a proper URL, not base64
  if (url.startsWith('http') || url.startsWith('/')) return url;
  return "/placeholder-course.jpg"; // Skip base64 images
};

export interface FeaturedCourse {
  id: string;
  course_id: string;
  section_type: SectionType;
  display_order: number;
  is_active: boolean;
  created_at: string;
  courses?: {
    id: string;
    name: string;
    slug: string;
    thumbnail_url: string | null;
    price_inr: number | null;
    original_price_inr: number | null;
    instructor_name: string | null;
    rating: number | null;
    student_count: number | null;
    duration_months?: number | null;
    short_description?: string | null;
  } | null;
}

export const useFeaturedCourses = (sectionType?: SectionType, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["featured-courses", sectionType],
    staleTime: 1000 * 60 * 15, // 15 minutes - featured courses don't change often
    enabled, // Allow skipping query when data is provided via props
    queryFn: async () => {
      let query = supabase
        .from("featured_courses")
        .select(`
          *,
          courses (
            id, name, slug, price_inr, original_price_inr,
            instructor_name, rating, student_count, duration_months, short_description,
            course_thumbnails(storage_url)
          )
        `)
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (sectionType) {
        query = query.eq("section_type", sectionType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as FeaturedCourse[];
    },
  });
};

export const useAdminFeaturedCourses = (sectionType?: SectionType) => {
  return useQuery({
    queryKey: ["admin-featured-courses", sectionType],
    queryFn: async () => {
      let query = supabase
        .from("featured_courses")
        .select(`
          *,
          courses (
            id, name, slug, price_inr, original_price_inr,
            instructor_name, rating, student_count,
            course_thumbnails(storage_url)
          )
        `)
        .order("display_order", { ascending: true });

      if (sectionType) {
        query = query.eq("section_type", sectionType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as FeaturedCourse[];
    },
  });
};

export const useAddFeaturedCourse = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      courseId, 
      sectionType, 
      displayOrder = 0 
    }: { 
      courseId: string; 
      sectionType: SectionType; 
      displayOrder?: number;
    }) => {
      const { data, error } = await supabase
        .from("featured_courses")
        .insert({
          course_id: courseId,
          section_type: sectionType,
          display_order: displayOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["featured-courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-featured-courses"] });
      toast({ title: "Success", description: "Course added to section" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message.includes("duplicate") 
          ? "Course already exists in this section" 
          : error.message,
        variant: "destructive",
      });
    },
  });
};

export const useRemoveFeaturedCourse = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("featured_courses")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["featured-courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-featured-courses"] });
      toast({ title: "Success", description: "Course removed from section" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
};

export const useUpdateFeaturedCourseOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: { id: string; display_order: number }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from("featured_courses")
          .update({ display_order: update.display_order })
          .eq("id", update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["featured-courses"] });
      queryClient.invalidateQueries({ queryKey: ["admin-featured-courses"] });
    },
  });
};
