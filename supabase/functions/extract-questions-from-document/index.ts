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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get auth user
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      userId = user?.id;
    }

    // Helper functions
    const logJobProgress = async (jobId: string, level: string, message: string, details?: any) => {
      await supabaseAdmin.from('job_logs').insert({
        job_id: jobId,
        log_level: level,
        message,
        details: details || null
      });
    };

    const updateJobProgress = async (jobId: string, percentage: number, step: string, data?: any) => {
      const updateData: any = {
        progress_percentage: percentage,
        current_step: step
      };
      if (data) {
        updateData.result_data = data;
      }
      await supabaseAdmin
        .from('document_processing_jobs')
        .update(updateData)
        .eq('id', jobId);
    };

    // Create job record
    const { data: job, error: jobError } = await supabaseAdmin
      .from('document_processing_jobs')
      .insert({
        document_id: documentId,
        job_type: 'llm_extraction',
        status: 'running',
        current_step: 'Starting question extraction',
        total_steps: 2,
        started_at: new Date().toISOString(),
        created_by: userId
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Invoke worker function asynchronously (no await - fire and forget)
    supabaseAdmin.functions.invoke('process-llm-extraction', {
      body: { jobId: job.id, documentId }
    }).catch(error => {
      console.error('Failed to invoke worker function:', error);
      // Log error but don't block response
      supabaseAdmin.from('job_logs').insert({
        job_id: job.id,
        log_level: 'error',
        message: 'Failed to invoke worker function',
        details: { error: error.message }
      });
    });

    // Return immediately to client (202 Accepted)
    return new Response(
      JSON.stringify({ 
        success: true, 
        started: true,
        jobId: job.id,
        documentId,
        message: 'Extraction started. Track progress in Processing Jobs Monitor.'
      }),
      { 
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error extracting questions:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const { documentId } = await req.json().catch(() => ({ documentId: null }));

    if (documentId) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get current running job
      const { data: jobs } = await supabaseAdmin
        .from('document_processing_jobs')
        .select('id')
        .eq('document_id', documentId)
        .eq('job_type', 'llm_extraction')
        .eq('status', 'running')
        .order('created_at', { ascending: false })
        .limit(1);

      if (jobs && jobs.length > 0) {
        const jobId = jobs[0].id;
        await supabaseAdmin
          .from('document_processing_jobs')
          .update({
            status: 'failed',
            error_message: errorMessage,
            error_details: {
              stack: error instanceof Error ? error.stack : undefined,
              name: error instanceof Error ? error.name : 'Error'
            },
            completed_at: new Date().toISOString()
          })
          .eq('id', jobId);

        await supabaseAdmin.from('job_logs').insert({
          job_id: jobId,
          log_level: 'error',
          message: `Extraction failed: ${errorMessage}`,
          details: { 
            error_type: error instanceof Error ? error.name : 'Error',
            stack: error instanceof Error ? error.stack : undefined 
          }
        });
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
