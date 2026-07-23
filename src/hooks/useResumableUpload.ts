import { useState, useRef, useCallback } from 'react';
import * as tus from 'tus-js-client';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL } from '@/lib/supabaseUrl';

interface UseResumableUploadOptions {
  bucketName: string;
  onProgress?: (progress: number) => void;
  onSuccess?: (filePath: string) => void;
  onError?: (error: Error) => void;
}

interface UseResumableUploadReturn {
  upload: (file: File, filePath: string) => Promise<string>;
  progress: number;
  isUploading: boolean;
  cancel: () => void;
  isPaused: boolean;
  pause: () => void;
  resume: () => void;
}

const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks (Supabase requirement)

export function useResumableUpload({
  bucketName,
  onProgress,
  onSuccess,
  onError,
}: UseResumableUploadOptions): UseResumableUploadReturn {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const uploadRef = useRef<tus.Upload | null>(null);

  const upload = useCallback(async (file: File, filePath: string): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        // Get current session for authorization
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('You must be logged in to upload files');
        }

        setIsUploading(true);
        setProgress(0);

        const tusUpload = new tus.Upload(file, {
          endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
          retryDelays: [0, 1000, 3000, 5000],
          chunkSize: CHUNK_SIZE,
          headers: {
            authorization: `Bearer ${session.access_token}`,
            'x-upsert': 'false',
          },
          uploadDataDuringCreation: true,
          removeFingerprintOnSuccess: true,
          metadata: {
            bucketName: bucketName,
            objectName: filePath,
            contentType: file.type || 'video/mp4',
            cacheControl: '3600',
          },
          onError: (error) => {
            console.error('TUS upload error:', error);
            setIsUploading(false);
            setProgress(0);
            onError?.(error);
            reject(error);
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const percentage = Math.round((bytesUploaded / bytesTotal) * 100);
            setProgress(percentage);
            onProgress?.(percentage);
          },
          onSuccess: () => {
            setIsUploading(false);
            setProgress(100);
            onSuccess?.(filePath);
            resolve(filePath);
          },
        });

        uploadRef.current = tusUpload;

        // Check for previous upload to resume
        const previousUploads = await tusUpload.findPreviousUploads();
        if (previousUploads.length > 0) {
          tusUpload.resumeFromPreviousUpload(previousUploads[0]);
        }

        tusUpload.start();
      } catch (error) {
        setIsUploading(false);
        setProgress(0);
        const err = error instanceof Error ? error : new Error('Upload failed');
        onError?.(err);
        reject(err);
      }
    });
  }, [bucketName, onProgress, onSuccess, onError]);

  const cancel = useCallback(() => {
    if (uploadRef.current) {
      uploadRef.current.abort();
      setIsUploading(false);
      setProgress(0);
      setIsPaused(false);
    }
  }, []);

  const pause = useCallback(() => {
    if (uploadRef.current && isUploading) {
      uploadRef.current.abort();
      setIsPaused(true);
    }
  }, [isUploading]);

  const resume = useCallback(() => {
    if (uploadRef.current && isPaused) {
      uploadRef.current.start();
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
