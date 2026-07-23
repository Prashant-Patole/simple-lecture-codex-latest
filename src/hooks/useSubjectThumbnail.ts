import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useSubjectThumbnail = (subjectId?: string) => {
  return useQuery({
    queryKey: ["subject-thumbnail", subjectId],
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    queryFn: async () => {
      if (!subjectId) return null;
      
      const { data, error } = await supabase
        .from("subject_thumbnails")
        .select("storage_url")
        .eq("subject_id", subjectId)
        .maybeSingle();
      
      if (error) throw error;
      return data?.storage_url || null;
    },
    enabled: !!subjectId,
  });
};

export const useUploadSubjectThumbnail = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ subjectId, file }: { subjectId: string; file: File }) => {
      // Generate unique filename
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `subjects/${subjectId}/thumbnail_${Date.now()}.${fileExt}`;
      
      // Upload to Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("course-thumbnails")
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from("course-thumbnails")
        .getPublicUrl(uploadData.path);
      
      const storageUrl = urlData.publicUrl;
      
      // Upsert into subject_thumbnails table
      const { error: dbError } = await supabase
        .from("subject_thumbnails")
        .upsert({
          subject_id: subjectId,
          storage_url: storageUrl,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'subject_id'
        });
      
      if (dbError) throw dbError;
      
      return storageUrl;
    },
    onSuccess: (storageUrl, { subjectId }) => {
      queryClient.invalidateQueries({ queryKey: ["subject-thumbnail", subjectId] });
      queryClient.invalidateQueries({ queryKey: ["admin-popular-subjects-base"] });
      toast({
        title: "Success",
        description: "Thumbnail uploaded successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload thumbnail",
        variant: "destructive",
      });
    },
  });
};

export const useDeleteSubjectThumbnail = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (subjectId: string) => {
      const { error } = await supabase
        .from("subject_thumbnails")
        .delete()
        .eq("subject_id", subjectId);
      
      if (error) throw error;
    },
    onSuccess: (_, subjectId) => {
      queryClient.invalidateQueries({ queryKey: ["subject-thumbnail", subjectId] });
      queryClient.invalidateQueries({ queryKey: ["admin-popular-subjects-base"] });
      toast({
        title: "Success",
        description: "Thumbnail removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove thumbnail",
        variant: "destructive",
      });
    },
  });
};
