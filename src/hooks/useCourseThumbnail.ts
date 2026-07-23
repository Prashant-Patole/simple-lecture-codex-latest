import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rewriteStorageUrl } from "@/lib/proxyUrl";
 
 interface UseCourseThumbnailOptions {
   courseId: string;
   enabled?: boolean;
 }
 
 export const useCourseThumbnail = ({ courseId, enabled = true }: UseCourseThumbnailOptions) => {
   return useQuery({
     queryKey: ["course-thumbnail", courseId],
     queryFn: async () => {
      // First, try to get from course_thumbnails table (new system)
       const { data, error } = await supabase
         .from("course_thumbnails")
         .select("storage_url")
         .eq("course_id", courseId)
         .maybeSingle();
 
       if (error) {
         console.error("Error fetching course thumbnail:", error);
        // Fall through to check courses table
      }

      if (data?.storage_url) {
        return rewriteStorageUrl(data.storage_url);
       }
 
      // Fallback: Check courses.thumbnail_url (but skip base64 data)
      const { data: courseData, error: courseError } = await supabase
        .from("courses")
        .select("thumbnail_url")
        .eq("id", courseId)
        .maybeSingle();

      if (courseError) {
        console.error("Error fetching course thumbnail from courses:", courseError);
        return null;
      }

      const thumbnailUrl = courseData?.thumbnail_url;
      
      // Skip base64 data (too large, causes performance issues)
      if (thumbnailUrl && !thumbnailUrl.startsWith("data:")) {
        return rewriteStorageUrl(thumbnailUrl);
      }

      return null;
     },
     enabled: enabled && !!courseId,
     staleTime: 30 * 60 * 1000, // 30 minutes
     gcTime: 60 * 60 * 1000, // 1 hour
   });
 };