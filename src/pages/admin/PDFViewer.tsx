import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL } from '@/lib/supabaseUrl';
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PDFViewer() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const filePath = searchParams.get("path");
  
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Derive filename from path
  const fileName = filePath 
    ? decodeURIComponent(filePath.split("/").pop() || "Document.pdf")
    : "Document.pdf";

  const loadPdf = useCallback(async () => {
    if (!filePath) {
      setError("No file path provided");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get current session for auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated. Please log in.");
      }

      // Build proxy URL
      const proxyUrl = `${SUPABASE_URL}/functions/v1/b2-proxy-file?path=${encodeURIComponent(filePath)}`;

      // Fetch PDF through proxy with Authorization header
      const response = await fetch(proxyUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to load PDF: ${response.status} - ${errorText}`);
      }

      // Create blob URL from response
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(blobUrl);
    } catch (err) {
      console.error("PDF fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    } finally {
      setIsLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    loadPdf();
    
    // Cleanup blob URL on unmount
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [loadPdf]);

  const handleDownload = () => {
    if (!pdfBlobUrl) return;
    
    const link = document.createElement("a");
    link.href = pdfBlobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/admin");
    }
  };

  if (!filePath) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No file path provided. Please go back and try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-lg font-medium truncate max-w-[300px] md:max-w-[500px]">
            {fileName}
          </h1>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleDownload}
          disabled={!pdfBlobUrl || isLoading}
        >
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading PDF...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full p-4">
            <Alert variant="destructive" className="max-w-md">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex flex-col gap-4">
                <span>{error}</span>
                <Button variant="outline" size="sm" onClick={loadPdf}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : pdfBlobUrl ? (
          <iframe
            src={pdfBlobUrl}
            className="w-full h-full border-0"
            title={`PDF Viewer: ${fileName}`}
          />
        ) : null}
      </div>
    </div>
  );
}
