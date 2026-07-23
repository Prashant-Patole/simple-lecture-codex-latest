import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePdfPageRenderer } from "./usePdfPageRenderer";

interface UploadedImage {
  url: string;
  pageNumber: number;
  name?: string;
}

interface DatalabResult {
  success: boolean;
  request_id: string;
  content_json: any | null;
  content_markdown: string | null;
  images: Record<string, string>;
  uploaded_images: UploadedImage[];
  metadata: {
    pages: number;
    ocr_stats: any | null;
  };
}

// Helper to poll the edge function for completion
async function pollForCompletion(
  requestId: string,
  maxAttempts: number = 120,
  intervalMs: number = 3000,
  onProgress?: (attempt: number, maxAttempts: number) => void,
  signal?: AbortSignal,
  skipImages?: boolean
): Promise<DatalabResult> {
  const { SUPABASE_URL } = await import('@/lib/supabaseUrl');
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Check for cancellation before each attempt
    if (signal?.aborted) {
      throw new Error('CANCELLED');
    }

    onProgress?.(attempt, maxAttempts);

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token || SUPABASE_ANON_KEY;

    let response: Response;
    let fetchRetries = 0;
    const maxFetchRetries = 3;

    while (true) {
      try {
        console.log(`[useDatalab] Poll attempt ${attempt}/${maxAttempts}, fetch try ${fetchRetries + 1}`);
        const pollUrl = `${SUPABASE_URL}/functions/v1/parse-pdf-to-json?request_id=${requestId}${skipImages ? '&skip_images=true' : ''}`;
        response = await fetch(
          pollUrl,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${token}`,
              "apikey": SUPABASE_ANON_KEY,
            },
          }
        );
        break; // fetch succeeded
      } catch (fetchError: any) {
        fetchRetries++;
        console.warn(`[useDatalab] Fetch failed (${fetchRetries}/${maxFetchRetries}): ${fetchError.message}`);
        if (fetchRetries >= maxFetchRetries) {
          throw new Error(`Network error after ${maxFetchRetries} retries: ${fetchError.message}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Poll failed: ${response.status} - ${errorText}`);
    }

    const pollData = await response.json();

    if (pollData.status === "complete") {
      return pollData as DatalabResult;
    } else if (pollData.status === "failed") {
      throw new Error("Document processing failed on server");
    }

    // Still processing, wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Document processing timed out after 6 minutes");
}

export function useDatalab() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const { toast } = useToast();
  const { renderPdfPages, renderPdfFromBlob, progress: renderProgress } = usePdfPageRenderer();

  const parsePdfFile = async (file: File, signal?: AbortSignal, options?: { skipImages?: boolean }): Promise<DatalabResult | null> => {
    setIsLoading(true);
    setProgress("Uploading document...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setProgress("Submitting document for processing...");

      const { data, error } = await supabase.functions.invoke("parse-pdf-to-json", {
        body: formData,
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to submit document");
      }

      const requestId = data.request_id;

      // If already complete (small files processed quickly), skip polling
      if (data.status === "complete") {
        if (!options?.skipImages) {
          setProgress("Rendering PDF pages...");
          const pages = await renderPdfFromBlob(file, requestId);
          const renderedPages = pages.map((p) => ({
            url: p.url,
            pageNumber: p.pageNumber,
            name: `page_${p.pageNumber}.png`,
          }));
          data.uploaded_images = renderedPages;
          data.metadata = { ...data.metadata, pages: renderedPages.length || data.metadata?.pages || 0 };
        }

        setProgress("Complete!");
        toast({
          title: "Document Parsed Successfully",
          description: `Extracted ${data.metadata?.pages || 0} pages`,
        });

        return data as DatalabResult;
      }

      // Check for cancellation before polling
      if (signal?.aborted) {
        throw new Error('CANCELLED');
      }

      // Poll for completion
      setProgress("Extracting text with AI... This may take a few minutes.");
      const completedData = await pollForCompletion(requestId, 120, 3000, (attempt, max) => {
        setProgress(`Processing document... (${Math.round((attempt / max) * 100)}%)`);
      }, signal, options?.skipImages);

      if (!options?.skipImages) {
        // Now render pages with PDF.js using the original file blob
        setProgress("Rendering PDF pages...");
        const pages = await renderPdfFromBlob(file, requestId);
        const renderedPages = pages.map((p) => ({
          url: p.url,
          pageNumber: p.pageNumber,
          name: `page_${p.pageNumber}.png`,
        }));
        completedData.uploaded_images = renderedPages;
        completedData.metadata = { ...completedData.metadata, pages: renderedPages.length || completedData.metadata?.pages || 0 };
      }

      const result: DatalabResult = completedData;

      setProgress("Complete!");
      toast({
        title: "Document Parsed Successfully",
        description: `Extracted ${result.metadata?.pages || 0} pages`,
      });

      return result;
    } catch (error: any) {
      // Don't show error toast for cancellation
      if (error.message === 'CANCELLED') {
        throw error; // Re-throw to let caller handle it
      }
      console.error("Error parsing PDF:", error);
      toast({
        title: "Document Parsing Failed",
        description: error.message || "Failed to parse document",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
      setProgress("");
    }
  };

  const parsePdfFromUrl = async (pdfUrl: string): Promise<DatalabResult | null> => {
    setIsLoading(true);
    setProgress("Starting document parsing...");

    try {
      const formData = new FormData();
      formData.append("pdf_url", pdfUrl);

      setProgress("Submitting document for processing...");

      const { data, error } = await supabase.functions.invoke("parse-pdf-to-json", {
        body: formData,
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || "Failed to submit document");
      }

      const requestId = data.request_id;

      // If already complete, skip polling
      if (data.status === "complete") {
        setProgress("Rendering PDF pages...");
        const pages = await renderPdfPages(pdfUrl, requestId);
        const renderedPages = pages.map((p) => ({
          url: p.url,
          pageNumber: p.pageNumber,
          name: `page_${p.pageNumber}.png`,
        }));

        const result: DatalabResult = {
          ...data,
          uploaded_images: renderedPages,
          metadata: {
            ...data.metadata,
            pages: renderedPages.length || data.metadata?.pages || 0,
          },
        };

        setProgress("Complete!");
        toast({
          title: "Document Parsed Successfully",
          description: `Extracted ${result.metadata?.pages || 0} pages`,
        });

        return result;
      }

      // Poll for completion
      setProgress("Extracting text with AI... This may take a few minutes.");
      const completedData = await pollForCompletion(requestId, 120, 3000, (attempt, max) => {
        setProgress(`Processing document... (${Math.round((attempt / max) * 100)}%)`);
      });

      // Now render pages with PDF.js using the B2 proxy
      setProgress("Rendering PDF pages...");
      const pages = await renderPdfPages(pdfUrl, requestId);
      const renderedPages = pages.map((p) => ({
        url: p.url,
        pageNumber: p.pageNumber,
        name: `page_${p.pageNumber}.png`,
      }));

      const result: DatalabResult = {
        ...completedData,
        uploaded_images: renderedPages,
        metadata: {
          ...completedData.metadata,
          pages: renderedPages.length || completedData.metadata?.pages || 0,
        },
      };

      setProgress("Complete!");
      toast({
        title: "Document Parsed Successfully",
        description: `Extracted ${result.metadata?.pages || 0} pages`,
      });

      return result;
    } catch (error: any) {
      console.error("Error parsing document:", error);
      toast({
        title: "Document Parsing Failed",
        description: error.message || "Failed to parse document",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
      setProgress("");
    }
  };

  // Get detailed progress message
  const getDetailedProgress = (): string => {
    if (renderProgress && renderProgress.phase !== "complete") {
      const { currentPage, totalPages, phase } = renderProgress;
      if (phase === "loading") return "Loading PDF...";
      if (phase === "rendering") return `Rendering page ${currentPage} of ${totalPages}...`;
      if (phase === "uploading") return `Uploading page ${currentPage} of ${totalPages}...`;
    }
    return progress;
  };

  return {
    parsePdfFile,
    parsePdfFromUrl,
    isLoading,
    progress: getDetailedProgress(),
  };
}
