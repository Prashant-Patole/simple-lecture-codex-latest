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

  try {
    const { jobId } = await req.json();
    console.log('Retrying job:', jobId);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get auth user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) throw new Error('Unauthorized');

    // Get the job
    const { data: job, error: jobError } = await supabaseAdmin
      .from('document_processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    // Check retry limit
    if (job.retry_count >= job.max_retries) {
      throw new Error(`Maximum retry attempts (${job.max_retries}) exceeded`);
    }

    // Log retry attempt
    await supabaseAdmin.from('job_logs').insert({
      job_id: jobId,
      log_level: 'info',
      message: `Retry attempt ${job.retry_count + 1}/${job.max_retries}`,
      details: { previous_error: job.error_message }
    });

    // Reset job status
    await supabaseAdmin
      .from('document_processing_jobs')
      .update({
        status: 'pending',
        retry_count: job.retry_count + 1,
        error_message: null,
        error_details: null,
        progress_percentage: 0,
        current_step: 'Retry scheduled',
        started_at: null,
        completed_at: null
      })
      .eq('id', jobId);

    // Re-trigger appropriate function based on job type
    let invokeResult;
    if (job.job_type === 'mathpix_processing') {
      invokeResult = await supabaseAdmin.functions.invoke('process-uploaded-document', {
        body: { documentId: job.document_id }
      });
    } else if (job.job_type === 'llm_extraction') {
      // Get document metadata for extraction
      const { data: doc } = await supabaseAdmin
        .from('uploaded_question_documents')
        .select('*')
        .eq('id', job.document_id)
        .single();

      if (!doc) {
        throw new Error('Document not found for extraction retry');
      }

      invokeResult = await supabaseAdmin.functions.invoke('extract-questions-from-document', {
        body: {
          documentId: job.document_id,
          categoryId: doc.category_id,
          subjectId: doc.subject_id,
          chapterId: doc.chapter_id,
          topicId: doc.topic_id,
          subtopicId: doc.subtopic_id
        }
      });
    } else if (job.job_type === 'llm_verification') {
      invokeResult = await supabaseAdmin.functions.invoke('llm-verify-questions', {
        body: { documentId: job.document_id }
      });
    } else {
      throw new Error(`Unknown job type: ${job.job_type}`);
    }

    if (invokeResult.error) {
      throw new Error(`Failed to invoke function: ${invokeResult.error.message}`);
    }

    await supabaseAdmin.from('job_logs').insert({
      job_id: jobId,
      log_level: 'info',
      message: 'Job retry triggered successfully',
      details: { job_type: job.job_type }
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Job retry ${job.retry_count + 1}/${job.max_retries} initiated`,
        jobId: jobId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error retrying job:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});