import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let documentId: string | undefined;

  try {
    const { documentId: docId } = await req.json();
    documentId = docId;

    console.log('Processing document with Replit service:', documentId);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get auth user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) throw new Error('Unauthorized');

    // Helper functions for job tracking
    const logJobProgress = async (jobId: string, level: string, message: string, details?: any) => {
      await supabaseAdmin.from('job_logs').insert({
        job_id: jobId,
        log_level: level,
        message,
        details
      });
    };

    const updateJobProgress = async (jobId: string, percentage: number, step: string, status?: string) => {
      const update: any = {
        progress_percentage: percentage,
        current_step: step
      };
      if (status) update.status = status;

      await supabaseAdmin
        .from('document_processing_jobs')
        .update(update)
        .eq('id', jobId);
    };

    // Create job record
    const { data: job, error: jobError } = await supabaseAdmin
      .from('document_processing_jobs')
      .insert({
        document_id: documentId,
        job_type: 'mathpix_processing',
        status: 'running',
        created_by: user.id,
        started_at: new Date().toISOString(),
        progress_percentage: 0,
        current_step: 'Initializing Replit service processing'
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('Job creation error:', jobError);
      throw new Error(`Failed to create job record: ${jobError?.message || 'No job returned'} - Details: ${JSON.stringify(jobError)}`);
    }

    await logJobProgress(job.id, 'info', 'Job created', { job_id: job.id });

    // Update document status
    await supabaseAdmin
      .from('uploaded_question_documents')
      .update({
        status: 'processing',
        current_job_id: job.id,
        processing_started_at: new Date().toISOString()
      })
      .eq('id', documentId);

    await updateJobProgress(job.id, 10, 'Fetching PDFs from storage');

    // Get document details
    const { data: doc, error: docError } = await supabaseAdmin
      .from('uploaded_question_documents')
      .select(`
        questions_file_name, 
        questions_file_url, 
        solutions_file_name, 
        solutions_file_url,
        category_id,
        subject_id,
        chapter_id,
        topic_id,
        subtopic_id
      `)
      .eq('id', documentId)
      .single();

    if (docError || !doc || !doc.questions_file_url || !doc.solutions_file_url) {
      throw new Error('Document not found or missing file URLs');
    }

    await logJobProgress(job.id, 'info', 'Documents fetched', { 
      questions_file: doc.questions_file_name,
      solutions_file: doc.solutions_file_name 
    });

    // Download PDFs from Supabase Storage
    const downloadFile = async (fileUrl: string, fileName: string) => {
      const urlParts = fileUrl.split('/storage/v1/object/public/');
      if (urlParts.length < 2) throw new Error('Invalid file URL format');
      const fullPath = urlParts[1];
      const storagePath = fullPath.split('/').slice(1).join('/');

      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('uploaded-question-documents')
        .download(storagePath);

      if (downloadError || !fileData) {
        throw new Error(`Failed to download ${fileName}: ${downloadError?.message}`);
      }

      return fileData;
    };

    await updateJobProgress(job.id, 20, 'Downloading PDFs');
    const questionsFile = await downloadFile(doc.questions_file_url, doc.questions_file_name);
    const solutionsFile = await downloadFile(doc.solutions_file_url, doc.solutions_file_name);

    await logJobProgress(job.id, 'info', 'PDFs downloaded successfully');

    // Upload to Replit service
    await updateJobProgress(job.id, 30, 'Uploading PDFs to Replit service');

    const formData = new FormData();
    formData.append('questions_file', questionsFile, doc.questions_file_name);
    formData.append('solutions_file', solutionsFile, doc.solutions_file_name);
    formData.append('use_llm', 'false');

    const uploadResponse = await fetch(
      'https://mathpix-ocr-llm-service-utuberpraveen.replit.app/process-educational-content',
      {
        method: 'POST',
        body: formData
      }
    );

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Replit service upload failed: ${uploadResponse.status} - ${errorText}`);
    }

    const uploadData = await uploadResponse.json();
    const replitJobId = uploadData.job_id;

    await logJobProgress(job.id, 'info', 'PDFs uploaded to Replit', { replit_job_id: replitJobId });

    // Store Replit job ID
    await supabaseAdmin
      .from('document_processing_jobs')
      .update({
        result_data: { replit_job_id: replitJobId }
      })
      .eq('id', job.id);

    await updateJobProgress(job.id, 40, 'Job submitted to Replit. Use "Check Status" button to update.');

    return new Response(
      JSON.stringify({
        success: true,
        jobId: job.id,
        replitJobId,
        message: 'Job submitted to Replit service. Status will be checked automatically or click "Check Status" button.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing document:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    if (documentId) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      );

      const { data: doc } = await supabaseAdmin
        .from('uploaded_question_documents')
        .select('current_job_id')
        .eq('id', documentId)
        .single();

      if (doc?.current_job_id) {
        await supabaseAdmin
          .from('document_processing_jobs')
          .update({
            status: 'failed',
            error_message: errorMessage,
            error_details: { error: errorMessage, stack: error instanceof Error ? error.stack : undefined },
            completed_at: new Date().toISOString()
          })
          .eq('id', doc.current_job_id);

        await supabaseAdmin.from('job_logs').insert({
          job_id: doc.current_job_id,
          log_level: 'error',
          message: 'Job failed',
          details: { error: errorMessage }
        });
      }

      await supabaseAdmin
        .from('uploaded_question_documents')
        .update({
          status: 'failed',
          error_message: errorMessage
        })
        .eq('id', documentId);
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
