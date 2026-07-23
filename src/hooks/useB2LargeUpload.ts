import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseB2LargeUploadOptions {
  onProgress?: (progress: number) => void;
  onSuccess?: (filePath: string, fileId: string) => void;
  onError?: (error: Error) => void;
}

interface UseB2LargeUploadReturn {
  upload: (file: File, filePath: string) => Promise<{ filePath: string; fileId: string }>;
  progress: number;
  isUploading: boolean;
  cancel: () => void;
  isPaused: boolean;
  pause: () => void;
  resume: () => void;
}

const MIN_PART_SIZE = 5 * 1024 * 1024; // 5MB minimum part size for B2
const RECOMMENDED_PART_SIZE = 6 * 1024 * 1024; // 6MB - small enough for edge function payload

export function useB2LargeUpload({
  onProgress,
  onSuccess,
  onError,
}: UseB2LargeUploadOptions = {}): UseB2LargeUploadReturn {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const abortRef = useRef(false);
  const pauseRef = useRef(false);
  const fileIdRef = useRef<string | null>(null);
  const uploadStateRef = useRef<{
    file: File;
    filePath: string;
    partNumber: number;
    partSha1Array: string[];
    bytesUploaded: number;
  } | null>(null);

  const upload = useCallback(async (file: File, filePath: string): Promise<{ filePath: string; fileId: string }> => {
    abortRef.current = false;
    pauseRef.current = false;
    setIsUploading(true);
    setProgress(0);

    try {
      // Determine part size based on file size
      // B2 allows max 10,000 parts, so we need to calculate appropriate part size
      const partSize = Math.max(
        MIN_PART_SIZE,
        Math.min(RECOMMENDED_PART_SIZE, Math.ceil(file.size / 9000))
      );

      // Step 1: Start large file upload
      const { data: startData, error: startError } = await supabase.functions.invoke('b2-large-upload', {
        body: {
          action: 'start',
          fileName: filePath,
          contentType: file.type || 'video/mp4'
        }
      });

      if (startError || !startData?.success) {
        throw new Error(startData?.error || startError?.message || 'Failed to start upload');
      }

      const fileId = startData.fileId;
      fileIdRef.current = fileId;

      // Calculate total parts
      const totalParts = Math.ceil(file.size / partSize);
      const partSha1Array: string[] = [];
      let bytesUploaded = 0;

      // Store state for resume
      uploadStateRef.current = {
        file,
        filePath,
        partNumber: 1,
        partSha1Array,
        bytesUploaded: 0
      };

      // Step 2: Upload each part
      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        // Check for abort
        if (abortRef.current) {
          // Cancel the large file on B2
          await supabase.functions.invoke('b2-large-upload', {
            body: { action: 'cancel', fileId }
          });
          throw new Error('Upload cancelled');
        }

        // Check for pause
        while (pauseRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
          if (abortRef.current) {
            await supabase.functions.invoke('b2-large-upload', {
              body: { action: 'cancel', fileId }
            });
            throw new Error('Upload cancelled');
          }
        }

        // Read the part from the file
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const partBlob = file.slice(start, end);
        const partBuffer = await partBlob.arrayBuffer();

        // Convert to base64 for sending through edge function
        const partBytes = new Uint8Array(partBuffer);
        let binary = '';
        for (let i = 0; i < partBytes.byteLength; i++) {
          binary += String.fromCharCode(partBytes[i]);
        }
        const partBase64 = btoa(binary);

        // Upload via edge function (bypasses CORS)
        const { data: uploadData, error: uploadError } = await supabase.functions.invoke('b2-large-upload', {
          body: {
            action: 'upload-part',
            fileId,
            partNumber,
            partData: partBase64
          }
        });

        if (uploadError || !uploadData?.success) {
          throw new Error(uploadData?.error || uploadError?.message || `Part ${partNumber} upload failed`);
        }

        partSha1Array.push(uploadData.partSha1);
        bytesUploaded += partBuffer.byteLength;

        // Update progress
        const progressPercent = Math.round((bytesUploaded / file.size) * 100);
        setProgress(progressPercent);
        onProgress?.(progressPercent);

        // Update state for resume
        uploadStateRef.current = {
          file,
          filePath,
          partNumber: partNumber + 1,
          partSha1Array: [...partSha1Array],
          bytesUploaded
        };
      }

      // Step 3: Finish the large file
      const { data: finishData, error: finishError } = await supabase.functions.invoke('b2-large-upload', {
        body: {
          action: 'finish',
          fileId,
          partSha1Array
        }
      });

      if (finishError || !finishData?.success) {
        throw new Error(finishData?.error || finishError?.message || 'Failed to finish upload');
      }

      setProgress(100);
      setIsUploading(false);
      onSuccess?.(filePath, fileId);
      
      return { filePath, fileId };

    } catch (error) {
      setIsUploading(false);
      setProgress(0);
      const err = error instanceof Error ? error : new Error('Upload failed');
      onError?.(err);
      throw err;
    }
  }, [onProgress, onSuccess, onError]);

  const cancel = useCallback(() => {
    abortRef.current = true;
    setIsUploading(false);
    setProgress(0);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    if (isUploading) {
      pauseRef.current = true;
      setIsPaused(true);
    }
  }, [isUploading]);

  const resume = useCallback(() => {
    if (isPaused) {
      pauseRef.current = false;
      setIsPaused(false);
    }
  }, [isPaused]);

  return {
    upload,
    progress,
    isUploading,
    cancel,
    isPaused,
    pause,
    resume,
  };
}
