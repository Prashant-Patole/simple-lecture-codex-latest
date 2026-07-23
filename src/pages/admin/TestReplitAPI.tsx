import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2, AlertCircle, StopCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

export default function TestReplitAPI() {
  const [questionsFile, setQuestionsFile] = useState<File | null>(null);
  const [solutionsFile, setSolutionsFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [uploadResponse, setUploadResponse] = useState<any>(null);
  const [statusResponse, setStatusResponse] = useState<any>(null);
  const [finalResult, setFinalResult] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
    setPollCount(0);
  };

  const startPolling = (docId: string) => {
    stopPolling(); // Clear any existing polling
    setIsPolling(true);
    setPollCount(0);
    
    // Poll immediately
    checkStatusInternal(docId);
    
    // Then poll every 5 seconds
    pollingIntervalRef.current = setInterval(() => {
      setPollCount(prev => prev + 1);
      checkStatusInternal(docId);
    }, 5000);
  };

  const checkStatusInternal = async (docId: string) => {
    try {
      // First get the latest job ID
      const { data: job, error: jobError } = await supabase
        .from('document_processing_jobs')
        .select('*')
        .eq('document_id', docId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (jobError && jobError.code !== 'PGRST116') throw jobError;

      if (!job) {
        setStatusResponse({ 
          status: 'No job found', 
          message: "Job may not have started yet"
        });
        return;
      }

      // If job is still running, call the edge function to check Replit status
      if (job.status === 'running') {
        console.log('Calling check-replit-job-status for job:', job.id);
        const { data: statusData, error: statusError } = await supabase.functions.invoke(
          'check-replit-job-status',
          { body: { jobId: job.id } }
        );

        if (statusError) {
          console.error('Status check error:', statusError);
          throw statusError;
        }

        console.log('Status check response:', statusData);
        
        // Refresh job data after status check
        const { data: updatedJob } = await supabase
          .from('document_processing_jobs')
          .select('*')
          .eq('id', job.id)
          .single();

        if (updatedJob) {
          const resultData = updatedJob.result_data as any;
          setStatusResponse({ 
            status: updatedJob.status, 
            job_id: updatedJob.id,
            replit_job_id: resultData?.replit_job_id,
            progress: updatedJob.progress_percentage,
            current_step: updatedJob.current_step,
            message: statusData?.message || updatedJob.current_step
          });
          
          if (updatedJob.status === 'completed') {
            setFinalResult(updatedJob.result_data);
            stopPolling();
            toast.success("Processing completed!", {
              description: `${updatedJob.questions_extracted || 0} questions extracted`
            });
          } else if (updatedJob.status === 'failed') {
            stopPolling();
            toast.error("Processing failed", {
              description: updatedJob.error_message || "Check logs for details"
            });
          }
        }
      } else {
        // Job already completed or failed
        const resultData = job.result_data as any;
        setStatusResponse({ 
          status: job.status, 
          job_id: job.id,
          replit_job_id: resultData?.replit_job_id,
          progress: job.progress_percentage,
          current_step: job.current_step,
          message: job.error_message || `Job ${job.status}`
        });
        
        if (job.status === 'completed' && job.result_data) {
          setFinalResult(job.result_data);
          stopPolling();
        } else if (job.status === 'failed') {
          stopPolling();
        }
      }
    } catch (error: any) {
      console.error("Auto-poll status check error:", error);
      setStatusResponse({
        status: 'error',
        message: error.message || 'Status check failed'
      });
    }
  };

  const handleQuestionsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      setQuestionsFile(file);
    }
  };

  const handleSolutionsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      setSolutionsFile(file);
    }
  };

  const handleUpload = async () => {
    if (!questionsFile || !solutionsFile) {
      toast.error("Please select both PDF files");
      return;
    }

    setIsUploading(true);
    setUploadResponse(null);
    setStatusResponse(null);
    setFinalResult(null);
    setDocumentId(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload files to Supabase storage
      const questionsPath = `${user.id}/${Date.now()}_questions.pdf`;
      const solutionsPath = `${user.id}/${Date.now()}_solutions.pdf`;

      console.log("Uploading files to Supabase storage...");
      const [questionsUpload, solutionsUpload] = await Promise.all([
        supabase.storage.from('uploaded-question-documents').upload(questionsPath, questionsFile),
        supabase.storage.from('uploaded-question-documents').upload(solutionsPath, solutionsFile)
      ]);

      if (questionsUpload.error) throw questionsUpload.error;
      if (solutionsUpload.error) throw solutionsUpload.error;

      // Get public URLs
      const { data: { publicUrl: questionsUrl } } = supabase.storage
        .from('uploaded-question-documents')
        .getPublicUrl(questionsPath);
      const { data: { publicUrl: solutionsUrl } } = supabase.storage
        .from('uploaded-question-documents')
        .getPublicUrl(solutionsPath);

      // Create document record
      console.log("Creating document record...");
      const { data: documents, error: docError } = await supabase
        .from('uploaded_question_documents')
        .insert([{
          questions_file_name: questionsFile.name,
          questions_file_url: questionsUrl,
          solutions_file_name: solutionsFile.name,
          solutions_file_url: solutionsUrl,
          uploaded_by: user.id,
          status: 'pending',
          file_type: 'pdf',
          category_id: '00000000-0000-0000-0000-000000000000', // placeholder
          subject_id: '00000000-0000-0000-0000-000000000000', // placeholder
          chapter_id: '00000000-0000-0000-0000-000000000000' // placeholder
        }])
        .select()
        .single();

      if (docError) throw docError;
      const document = documents;

      setDocumentId(document.id);

      // Call edge function
      console.log("Calling edge function with document ID:", document.id);
      const { data, error } = await supabase.functions.invoke('process-educational-pdfs', {
        body: { documentId: document.id }
      });

      if (error) throw error;

      console.log("Edge function response:", data);
      setUploadResponse(data);
      toast.success("Processing started via edge function!", {
        description: `Document ID: ${document.id}. Auto-checking status...`,
      });
      
      // Start automatic polling
      startPolling(document.id);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Upload failed", {
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!documentId) {
      toast.error("No document ID available");
      return;
    }

    setIsChecking(true);

    try {
      await checkStatusInternal(documentId);
      toast.success("Status refreshed");
    } catch (error: any) {
      console.error("Status check error:", error);
      toast.error("Status check failed", {
        description: error.message,
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test Document Processing</h1>
        <p className="text-muted-foreground mt-2">
          Test the full workflow: Upload → Edge Function → Replit API → Database
        </p>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>1. Upload PDFs via Edge Function</CardTitle>
          <CardDescription>
            Upload files to Supabase storage, then process via edge function
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="questions-file">Questions PDF</Label>
            <Input
              id="questions-file"
              type="file"
              accept=".pdf"
              onChange={handleQuestionsFileChange}
              disabled={isUploading}
            />
            {questionsFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {questionsFile.name} ({(questionsFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="solutions-file">Solutions PDF</Label>
            <Input
              id="solutions-file"
              type="file"
              accept=".pdf"
              onChange={handleSolutionsFileChange}
              disabled={isUploading}
            />
            {solutionsFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {solutionsFile.name} ({(solutionsFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={!questionsFile || !solutionsFile || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload & Process
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Upload Response */}
      {uploadResponse && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Edge Function Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
              {JSON.stringify(uploadResponse, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Status Check Section */}
      {documentId && (
        <Card>
          <CardHeader>
            <CardTitle>2. Check Processing Status</CardTitle>
            <CardDescription>
              Document ID: {documentId}
              {isPolling && (
                <span className="ml-2 text-xs text-muted-foreground">
                  • Auto-checking every 5s (Check #{pollCount + 1})
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={handleCheckStatus}
                disabled={isChecking}
                className="flex-1"
                variant={isPolling ? "outline" : "default"}
              >
                {isChecking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Check Status Now
                  </>
                )}
              </Button>
              {isPolling && (
                <Button
                  onClick={stopPolling}
                  variant="destructive"
                  size="icon"
                  title="Stop auto-polling"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              )}
            </div>

            {isPolling && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertTitle>Auto-polling Active</AlertTitle>
                <AlertDescription>
                  Automatically checking status every 5 seconds. This will stop when processing completes or fails.
                </AlertDescription>
              </Alert>
            )}

            {statusResponse && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Status: {statusResponse.status}</AlertTitle>
                <AlertDescription>
                  <pre className="mt-2 text-xs overflow-auto max-h-60">
                    {JSON.stringify(statusResponse, null, 2)}
                  </pre>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Final Result */}
      {finalResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Final Result (Structured JSON)
            </CardTitle>
            <CardDescription>
              Parsed questions and solutions from the PDFs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs">
              {JSON.stringify(finalResult, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Workflow Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Workflow</CardTitle>
          <CardDescription>How the data flows through the system</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex gap-3">
            <div className="font-mono text-muted-foreground">1.</div>
            <div>
              <p className="font-medium">Upload to Supabase Storage</p>
              <p className="text-muted-foreground">Files stored in uploaded-question-documents bucket</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="font-mono text-muted-foreground">2.</div>
            <div>
              <p className="font-medium">Create Database Record</p>
              <p className="text-muted-foreground">Document metadata saved to uploaded_question_documents table</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="font-mono text-muted-foreground">3.</div>
            <div>
              <p className="font-medium">Call Edge Function</p>
              <p className="text-muted-foreground">process-educational-pdfs downloads files and sends to Replit API</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="font-mono text-muted-foreground">4.</div>
            <div>
              <p className="font-medium">Replit API Processing</p>
              <p className="text-muted-foreground">OCR + LLM extraction of questions and solutions</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="font-mono text-muted-foreground">5.</div>
            <div>
              <p className="font-medium">Save Results</p>
              <p className="text-muted-foreground">Structured data saved to document_processing_jobs table</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
