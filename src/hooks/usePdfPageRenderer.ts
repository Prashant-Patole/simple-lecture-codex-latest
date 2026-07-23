import { useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from '@/lib/supabaseUrl';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface RenderedPage {
  url: string;
  pageNumber: number;
}

interface RenderProgress {
  currentPage: number;
  totalPages: number;
  phase: "loading" | "rendering" | "uploading" | "complete";
}

interface UsePdfPageRendererResult {
  renderPdfPages: (pdfUrl: string, requestId: string) => Promise<RenderedPage[]>;
  renderPdfFromBlob: (blob: Blob, requestId: string) => Promise<RenderedPage[]>;
  isRendering: boolean;
  progress: RenderProgress | null;
  error: string | null;
}

export function usePdfPageRenderer(): UsePdfPageRendererResult {
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState<RenderProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const renderPdfFromData = useCallback(async (
    pdfData: string | ArrayBuffer | Uint8Array,
    requestId: string
  ): Promise<RenderedPage[]> => {
    setProgress({ currentPage: 0, totalPages: 0, phase: "loading" });

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: pdfData,
      cMapUrl: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/cmaps/",
      cMapPacked: true,
    });

    const pdf = await loadingTask.promise;
      const totalPages = pdf.numPages;
      
      console.log(`PDF loaded: ${totalPages} pages`);
      setProgress({ currentPage: 0, totalPages, phase: "rendering" });

      const renderedPages: RenderedPage[] = [];

      // Render each page
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setProgress({ currentPage: pageNum, totalPages, phase: "rendering" });

        try {
          const page = await pdf.getPage(pageNum);
          
          // Use scale 2.0 for good quality
          const scale = 2.0;
          const viewport = page.getViewport({ scale });

          // Create canvas
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          
          if (!context) {
            throw new Error("Failed to get canvas context");
          }

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          // Render page to canvas
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;

          // Convert canvas to blob
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(
              (b) => {
                if (b) resolve(b);
                else reject(new Error("Failed to create blob"));
              },
              "image/png",
              0.9
            );
          });

          // Upload to Supabase Storage
          setProgress({ currentPage: pageNum, totalPages, phase: "uploading" });
          
          const fileName = `${requestId}/page_${pageNum.toString().padStart(3, "0")}.png`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("pdf-images")
            .upload(fileName, blob, {
              contentType: "image/png",
              upsert: true,
            });

          if (uploadError) {
            console.error(`Failed to upload page ${pageNum}:`, uploadError);
            throw uploadError;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("pdf-images")
            .getPublicUrl(fileName);

          renderedPages.push({
            url: urlData.publicUrl,
            pageNumber: pageNum,
          });

          console.log(`Rendered and uploaded page ${pageNum}/${totalPages}`);

          // Clean up canvas
          canvas.width = 0;
          canvas.height = 0;

        } catch (pageError) {
          console.error(`Error processing page ${pageNum}:`, pageError);
          // Continue with other pages even if one fails
        }
      }

    setProgress({ currentPage: totalPages, totalPages, phase: "complete" });
    console.log(`Successfully rendered ${renderedPages.length} pages`);
    
    return renderedPages;
  }, []);

  // Render from a Blob (for direct file uploads)
  const renderPdfFromBlob = useCallback(async (blob: Blob, requestId: string): Promise<RenderedPage[]> => {
    setIsRendering(true);
    setError(null);

    try {
      const arrayBuffer = await blob.arrayBuffer();
      return await renderPdfFromData(arrayBuffer, requestId);
    } catch (err: any) {
      console.error("Error rendering PDF from blob:", err);
      setError(err.message || "Failed to render PDF pages");
      return [];
    } finally {
      setIsRendering(false);
    }
  }, [renderPdfFromData]);

  // Render from a URL (for B2 paths - uses proxy)
  const renderPdfPages = useCallback(async (pdfUrl: string, requestId: string): Promise<RenderedPage[]> => {
    setIsRendering(true);
    setError(null);

    try {
      let pdfData: ArrayBuffer;

      if (pdfUrl.startsWith("blob:") || pdfUrl.startsWith("data:")) {
        // Local blob URL - fetch directly
        const response = await fetch(pdfUrl);
        pdfData = await response.arrayBuffer();
      } else if (pdfUrl.startsWith("http")) {
        // Full URL - try to fetch directly
        const response = await fetch(pdfUrl);
        pdfData = await response.arrayBuffer();
      } else {
        // B2 path - use proxy endpoint
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        
        if (!token) {
          throw new Error("Not authenticated");
        }

        console.log(`Fetching PDF from B2 proxy: ${pdfUrl}`);
        const proxyUrl = `${SUPABASE_URL}/functions/v1/b2-proxy-file?path=${encodeURIComponent(pdfUrl)}`;
        
        const response = await fetch(proxyUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }

        pdfData = await response.arrayBuffer();
      }

      return await renderPdfFromData(pdfData, requestId);
    } catch (err: any) {
      console.error("Error rendering PDF:", err);
      setError(err.message || "Failed to render PDF pages");
      return [];
    } finally {
      setIsRendering(false);
    }
  }, [renderPdfFromData]);

  return {
    renderPdfPages,
    renderPdfFromBlob,
    isRendering,
    progress,
    error,
  };
}
