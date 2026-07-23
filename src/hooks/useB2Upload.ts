import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UploadMetadata {
  entityType: 'chapter' | 'topic' | 'subtopic' | 'previous_year_paper' | 'dpp';
  categoryId?: string;
  subjectId: string;
  chapterId?: string;
  topicId?: string;
  subtopicId?: string;
}

interface UploadResult {
  success: boolean;
  fileId: string;
  filePath: string;
  storageFile?: any;
}

// TEMP: B2 account suspended — route uploads to Supabase Storage instead.
// Flip back to false once B2 is restored.
const USE_SUPABASE_STORAGE_FOR_DOCS = true;
const SUPABASE_DOCS_BUCKET = 'uploaded-question-documents';

export function useB2Upload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (
    file: File,
    filePath: string,
    metadata: UploadMetadata
  ): Promise<UploadResult | null> => {
    setUploading(true);
    setProgress(0);

    // Generate unique temp path to avoid collisions
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const tempPath = `${crypto.randomUUID()}_${sanitizedName}`;

    // --- TEMP: Supabase Storage fallback (B2 account suspended) ---
    if (USE_SUPABASE_STORAGE_FOR_DOCS) {
      try {
        setProgress(20);
        const { error: upErr } = await supabase.storage
          .from(SUPABASE_DOCS_BUCKET)
          .upload(filePath, file, { cacheControl: '3600', upsert: true, contentType: file.type });

        if (upErr) throw upErr;
        setProgress(100);

        toast({
          title: "Upload successful",
          description: `File uploaded to ${filePath}`,
        });

        return {
          success: true,
          fileId: crypto.randomUUID(),
          filePath, // bucket-relative path; downloader resolves via signed URL
        };
      } catch (error: any) {
        console.error('[B2Upload→Supabase] Upload error:', error);
        toast({
          title: "Upload failed",
          description: error.message || "Failed to upload file",
          variant: "destructive",
        });
        return null;
      } finally {
        setUploading(false);
        setTimeout(() => setProgress(0), 1000);
      }
    }
    // --- end fallback ---


    try {
      // Step 1: Upload to Supabase Storage (temp-uploads bucket)
      setProgress(10);
      console.log('[B2Upload] Uploading to temp storage:', tempPath);
      
      const { error: storageError } = await supabase.storage
        .from('temp-uploads')
        .upload(tempPath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (storageError) {
        console.error('[B2Upload] Supabase storage upload failed:', storageError);
        throw new Error(`Failed to upload to temp storage: ${storageError.message}`);
      }

      setProgress(40);
      console.log('[B2Upload] Temp upload complete, calling edge function');

      // Step 2: Call edge function with storage path (not file content)
      const { data, error } = await supabase.functions.invoke('b2-upload', {
        body: {
          storagePath: tempPath,
          filePath,
          metadata,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }
      });

      if (error) {
        throw error;
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Upload failed');
      }

      setProgress(100);

      toast({
        title: "Upload successful",
        description: `File uploaded to ${filePath}`,
      });

      return data as UploadResult;

    } catch (error: any) {
      console.error('[B2Upload] Upload error:', error);
      
      // Try to clean up temp file on error
      try {
        await supabase.storage.from('temp-uploads').remove([tempPath]);
      } catch (cleanupError) {
        console.warn('[B2Upload] Failed to cleanup temp file:', cleanupError);
      }
      
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
      return null;
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1000);
    }
  };

  return {
    uploadFile,
    uploading,
    progress
  };
}
