import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useUploadCategoryIcon = () => {
  const [isUploading, setIsUploading] = useState(false);

  const uploadIcon = async (file: File, categoryId?: string): Promise<string> => {
    setIsUploading(true);

    try {
      // Validate file
      if (!file.type.startsWith("image/")) {
        throw new Error("Please upload an image file");
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image must be less than 5MB");
      }

      // Generate unique filename
      const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
      const fileName = `${categoryId || "new"}/icon_${Date.now()}.${fileExt}`;

      // Upload to storage
      const { data, error } = await supabase.storage
        .from("category-icons")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (error) {
        throw error;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("category-icons")
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload icon";
      toast.error(message);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadIcon, isUploading };
};
