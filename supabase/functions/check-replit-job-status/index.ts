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

    if (!jobId) {
      throw new Error('Job ID is required');
    }

    console.log('Checking status for job:', jobId);

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get job details
    const { data: job, error: jobError } = await supabaseAdmin
      .from('document_processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    // If already completed or failed, return current status
    if (job.status === 'completed' || job.status === 'failed') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          job,
          message: `Job is already ${job.status}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Replit job ID from result_data
    const replitJobId = job.result_data?.replit_job_id;
    if (!replitJobId) {
      throw new Error('Replit job ID not found in job data');
    }

    console.log('Checking Replit job:', replitJobId);

    // Check Replit service status
    const statusResponse = await fetch(
      `https://mathpix-ocr-llm-service-utuberpraveen.replit.app/status/${replitJobId}`
    );

    // Handle 404 - job not found on Replit (expired or deleted)
    if (statusResponse.status === 404) {
      console.log('Replit job not found (404), marking as failed');
      
      await supabaseAdmin
        .from('document_processing_jobs')
        .update({
          status: 'failed',
          error_message: 'Job not found on Replit service (may have expired)',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      await supabaseAdmin
        .from('uploaded_question_documents')
        .update({
          status: 'failed',
          error_message: 'Processing job expired on external service'
        })
        .eq('id', job.document_id);

      await supabaseAdmin.from('job_logs').insert({
        job_id: jobId,
        log_level: 'error',
        message: 'Replit job not found (404)',
        details: { replit_job_id: replitJobId }
      });

      return new Response(
        JSON.stringify({ 
          success: false, 
          status: 'failed',
          message: 'Job not found on Replit service (may have expired)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!statusResponse.ok) {
      throw new Error(`Replit status check failed: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    const replitStatus = statusData.status;

    await supabaseAdmin.from('job_logs').insert({
      job_id: jobId,
      log_level: 'info',
      message: `Status check: ${replitStatus}`,
      details: { replit_job_id: replitJobId, replit_status: replitStatus }
    });

    // If still processing, update progress and return
    if (replitStatus === 'PROCESSING') {
      await supabaseAdmin
        .from('document_processing_jobs')
        .update({
          current_step: 'Still processing on Replit service',
          progress_percentage: Math.min(80, job.progress_percentage + 5)
        })
        .eq('id', jobId);

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'processing',
          replitStatus,
          message: 'Job is still processing on Replit'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If completed, fetch results and insert questions
    if (replitStatus === 'COMPLETED') {
      console.log('Job completed, fetching results...');

      await supabaseAdmin
        .from('document_processing_jobs')
        .update({
          current_step: 'Fetching results from Replit',
          progress_percentage: 85
        })
        .eq('id', jobId);

      // Fetch final results
      const resultResponse = await fetch(
        `https://mathpix-ocr-llm-service-utuberpraveen.replit.app/api/educational-result/${replitJobId}`
      );

      if (!resultResponse.ok) {
        throw new Error(`Failed to fetch results: ${resultResponse.status}`);
      }

      const structuredData = await resultResponse.json();
      
      // Extract nested result object (Replit API returns data nested under 'result')
      const resultData = structuredData.result || structuredData;
      
      console.log('Replit response structure:', JSON.stringify(structuredData, null, 2));
      console.log('Merged array length:', resultData.merged?.length || 0);

      await supabaseAdmin.from('job_logs').insert({
        job_id: jobId,
        log_level: 'info',
        message: 'Results fetched successfully',
        details: { 
          total_questions: resultData.total_questions,
          matched_count: resultData.matched_count
        }
      });

      // Get document details for inserting questions
      const { data: doc } = await supabaseAdmin
        .from('uploaded_question_documents')
        .select('category_id, subject_id, chapter_id, topic_id, subtopic_id')
        .eq('id', job.document_id)
        .single();

      if (!doc) {
        throw new Error('Document not found');
      }

      // Parse and insert questions
      await supabaseAdmin
        .from('document_processing_jobs')
        .update({
          current_step: 'Parsing questions and inserting into database',
          progress_percentage: 90
        })
        .eq('id', jobId);

      let insertedCount = 0;

      for (const item of resultData.merged || []) {
        try {
          // Parse question text to extract options
          const questionText = item.question_text || '';
          const questionNumber = item.question_number;
          
          // Extract options using regex: (a) text (b) text (c) text (d) text
          const optionsRegex = /\(([a-d])\)\s*([^(]+?)(?=\s*\([a-d]\)|$)/gi;
          const options: Record<string, string> = {};
          let match;
          
          while ((match = optionsRegex.exec(questionText)) !== null) {
            const key = match[1];
            const value = match[2].trim();
            options[key] = value;
          }
          
          // Clean question text
          let cleanQuestionText = questionText
            .replace(/^\d+\.\s*/, '')
            .trim();
          
          // Remove options section from end if present
          const optionsStartIndex = cleanQuestionText.search(/\([a-d]\)\s*/);
          if (optionsStartIndex > -1 && Object.keys(options).length > 0) {
            cleanQuestionText = cleanQuestionText.substring(0, optionsStartIndex).trim();
          }
          
          const hasOptions = Object.keys(options).length > 0;
          const questionFormat = hasOptions ? 'single_choice' : 'short_answer';
          
          // Map to objective/subjective based on format
          const objectiveFormats = ['single_choice', 'multiple_choice', 'true_false', 'fill_blank', 'numerical'];
          const questionType = hasOptions || objectiveFormats.includes(questionFormat) ? 'objective' : 'subjective';
          
          // Get solution data
          const solution = item.matched_solution;
          const correctAnswer = solution ? solution.answer_key : '';
          const explanation = solution ? solution.text : '';
          
          // Extract images
          const questionImages = item.question_images || [];
          const explanationImages: string[] = [];
          if (explanation) {
            const imageRegex = /!\[.*?\]\((\.\/images\/[^)]+)\)/g;
            let imgMatch;
            while ((imgMatch = imageRegex.exec(explanation)) !== null) {
              explanationImages.push(imgMatch[1]);
            }
          }
          
          // Insert into parsed_questions_pending
          const { error: insertError } = await supabaseAdmin
            .from('parsed_questions_pending')
            .insert({
              document_id: job.document_id,
              category_id: doc.category_id,
              subject_id: doc.subject_id,
              chapter_id: doc.chapter_id,
              topic_id: doc.topic_id,
              subtopic_id: doc.subtopic_id,
              question_text: cleanQuestionText,
              question_format: questionFormat,
              question_type: questionType,
              options: hasOptions ? options : null,
              correct_answer: correctAnswer || '',
              explanation: explanation || null,
              question_images: questionImages.length > 0 ? questionImages : null,
              explanation_images: explanationImages.length > 0 ? explanationImages : null,
              contains_formula: true,
              marks: 1,
              difficulty: 'Medium'
            });

          if (insertError) {
            await supabaseAdmin.from('job_logs').insert({
              job_id: jobId,
              log_level: 'warn',
              message: `Failed to insert question ${questionNumber}`,
              details: { 
                error: insertError.message,
                question_format: questionFormat,
                question_type: questionType,
                hasOptions,
                q_text_preview: cleanQuestionText.slice(0, 140)
              }
            });
          } else {
            insertedCount++;
          }
        } catch (parseError) {
          await supabaseAdmin.from('job_logs').insert({
            job_id: jobId,
            log_level: 'error',
            message: `Error parsing question ${item.question_number}`,
            details: { error: parseError instanceof Error ? parseError.message : 'Unknown error' }
          });
        }
      }

      // Check if no questions inserted despite merged items
      if ((resultData.merged?.length || 0) > 0 && insertedCount === 0) {
        await supabaseAdmin
          .from('document_processing_jobs')
          .update({
            status: 'failed',
            progress_percentage: 100,
            questions_extracted: 0,
            completed_at: new Date().toISOString(),
            current_step: 'Insert blocked by validation',
            error_message: 'No questions inserted due to DB validation. Check job_logs for details.',
            result_data: {
              replit_job_id: replitJobId,
              total_questions: resultData.total_questions,
              matched_count: resultData.matched_count,
              inserted_count: 0,
              raw_preview: {
                total_questions: resultData.total_questions,
                matched_count: resultData.matched_count,
                sample_items: (resultData.merged || []).slice(0, 2).map((x: any) => ({
                  question_number: x.question_number,
                  question_text: (x.question_text || '').slice(0, 140)
                }))
              }
            }
          })
          .eq('id', jobId);

        await supabaseAdmin
          .from('uploaded_question_documents')
          .update({
            status: 'failed',
            error_message: 'Validation failed - check job logs'
          })
          .eq('id', job.document_id);

        return new Response(
          JSON.stringify({ 
            success: false, 
            status: 'failed',
            message: 'No questions inserted due to validation errors'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update job status to completed
      await supabaseAdmin
        .from('document_processing_jobs')
        .update({
          status: 'completed',
          progress_percentage: 100,
          questions_extracted: insertedCount,
          completed_at: new Date().toISOString(),
          current_step: `Completed: ${insertedCount} questions inserted`,
          result_data: {
            replit_job_id: replitJobId,
            total_questions: resultData.total_questions,
            matched_count: resultData.matched_count,
            inserted_count: insertedCount,
            raw_preview: {
              total_questions: resultData.total_questions,
              matched_count: resultData.matched_count,
              sample_items: (resultData.merged || []).slice(0, 2).map((x: any) => ({
                question_number: x.question_number,
                question_text: (x.question_text || '').slice(0, 140)
              }))
            }
          }
        })
        .eq('id', jobId);

      // Update document status
      await supabaseAdmin
        .from('uploaded_question_documents')
        .update({
          status: 'completed',
          processing_completed_at: new Date().toISOString()
        })
        .eq('id', job.document_id);

      await supabaseAdmin.from('job_logs').insert({
        job_id: jobId,
        log_level: 'info',
        message: 'Processing completed successfully',
        details: { questions_inserted: insertedCount }
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          status: 'completed',
          questionsInserted: insertedCount,
          message: `Successfully processed ${insertedCount} questions`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If failed on Replit
    if (replitStatus === 'FAILED') {
      await supabaseAdmin
        .from('document_processing_jobs')
        .update({
          status: 'failed',
          error_message: 'Processing failed on Replit service',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      await supabaseAdmin
        .from('uploaded_question_documents')
        .update({
          status: 'failed',
          error_message: 'Processing failed on Replit'
        })
        .eq('id', job.document_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          status: 'failed',
          message: 'Job failed on Replit service'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle unknown status or timeout (job older than 60 minutes)
    const jobAgeMinutes = (Date.now() - new Date(job.created_at).getTime()) / (1000 * 60);
    if (jobAgeMinutes > 60 || !['PROCESSING', 'COMPLETED', 'FAILED'].includes(replitStatus)) {
      await supabaseAdmin
        .from('document_processing_jobs')
        .update({
          status: 'failed',
          error_message: `Timed out or invalid external status: ${replitStatus}`,
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId);

      await supabaseAdmin
        .from('uploaded_question_documents')
        .update({
          status: 'failed',
          error_message: 'Processing timeout or invalid status'
        })
        .eq('id', job.document_id);

      return new Response(
        JSON.stringify({ 
          success: false, 
          status: 'failed',
          message: `Job timed out or returned unknown status: ${replitStatus}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        status: replitStatus,
        message: `Current status: ${replitStatus}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking job status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
