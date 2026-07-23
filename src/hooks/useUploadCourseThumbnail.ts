 import { useMutation, useQueryClient } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "sonner";
 
 interface UploadThumbnailParams {
   courseId: string;
   file: File;
 }
 
 export const useUploadCourseThumbnail = () => {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async ({ courseId, file }: UploadThumbnailParams) => {
       // Generate unique filename
       const fileExt = file.name.split(".").pop();
       const fileName = `${courseId}/thumbnail_${Date.now()}.${fileExt}`;
 
       // Upload to storage bucket
       const { data: uploadData, error: uploadError } = await supabase.storage
         .from("course-thumbnails")
         .upload(fileName, file, {
           cacheControl: "3600",
           upsert: true,
         });
 
       if (uploadError) {
         console.error("Upload error:", uploadError);
         throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
       }
 
       // Get public URL
       const { data: urlData } = supabase.storage
         .from("course-thumbnails")
         .getPublicUrl(uploadData.path);
 
       const publicUrl = urlData.publicUrl;
 
       // Upsert into course_thumbnails table
       const { error: dbError } = await supabase
         .from("course_thumbnails")
         .upsert(
           {
             course_id: courseId,
             storage_url: publicUrl,
           },
           {
             onConflict: "course_id",
           }
         );
 
       if (dbError) {
         console.error("Database error:", dbError);
         throw new Error(`Failed to save thumbnail reference: ${dbError.message}`);
       }
 
       return publicUrl;
     },
     onSuccess: (url, { courseId }) => {
       // Invalidate the thumbnail query for this course
       queryClient.invalidateQueries({ queryKey: ["course-thumbnail", courseId] });
       // Invalidate featured courses so homepage shows new thumbnail
       queryClient.invalidateQueries({ queryKey: ["featured-courses"] });
       queryClient.invalidateQueries({ queryKey: ["admin-featured-courses"] });
       // Invalidate homepage data so ExploreProgramsSection shows new thumbnail
       queryClient.invalidateQueries({ queryKey: ["homepage-data"] });
       toast.success("Thumbnail uploaded successfully!");
       return url;
     },
     onError: (error) => {
       toast.error(error.message || "Failed to upload thumbnail");
     },
   });
 };