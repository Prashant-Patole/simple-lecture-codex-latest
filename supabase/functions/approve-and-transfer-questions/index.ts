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
    const { questionIds } = await req.json();
    
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0].trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);

    if (!user) throw new Error('Unauthorized');

    // Update approved questions with IP and instructor ID
    const { data: approvedQuestions, error: updateError } = await supabaseAdmin
      .from('parsed_questions_pending')
      .update({
        is_approved: true,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        approved_ip_address: clientIp,
      })
      .in('id', questionIds)
      .select();

    if (updateError) throw updateError;

    const transferredQuestions = [];
    
    for (const question of approvedQuestions) {
      // Check if question already exists in questions table (inserted during extraction)
      const { data: existingQuestions } = await supabaseAdmin
        .from('questions')
        .select('id')
        .eq('source_document_id', question.document_id)
        .eq('question_text', question.question_text)
        .limit(1);

      if (existingQuestions && existingQuestions.length > 0) {
        // Question already exists — mark as verified instead of duplicating
        const { error: verifyError } = await supabaseAdmin
          .from('questions')
          .update({
            is_verified: true,
            verified_by: user.id,
            // Also update fields that admin may have edited
            difficulty: question.difficulty,
            correct_answer: question.correct_answer,
            explanation: question.explanation,
            options: question.options,
          })
          .eq('id', existingQuestions[0].id);

        if (!verifyError) {
          await supabaseAdmin
            .from('parsed_questions_pending')
            .update({
              transferred_to_question_bank: true,
              question_bank_id: existingQuestions[0].id,
              transferred_at: new Date().toISOString()
            })
            .eq('id', question.id);

          transferredQuestions.push(existingQuestions[0].id);
        }
      } else {
        // Fallback: insert new question (for older documents processed before this change)
        const { data: newQuestion, error: insertError } = await supabaseAdmin
          .from('questions')
          .insert({
            topic_id: question.topic_id,
            chapter_id: question.chapter_id,
            subtopic_id: question.subtopic_id,
            question_text: question.question_text,
            question_format: question.question_format,
            question_type: question.question_type,
            difficulty: question.difficulty,
            marks: question.marks,
            options: question.options,
            correct_answer: question.correct_answer,
            explanation: question.explanation,
            question_image_url: question.question_images?.[0],
            option_images: question.option_images,
            contains_formula: question.contains_formula,
            source_document_id: question.document_id,
            is_ai_generated: true,
            is_verified: true,
            verified_by: user.id
          })
          .select()
          .single();

        if (!insertError) {
          await supabaseAdmin
            .from('parsed_questions_pending')
            .update({
              transferred_to_question_bank: true,
              question_bank_id: newQuestion.id,
              transferred_at: new Date().toISOString()
            })
            .eq('id', question.id);

          transferredQuestions.push(newQuestion.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        transferredCount: transferredQuestions.length,
        questionIds: transferredQuestions,
        approvedBy: user.id,
        approvedFrom: clientIp
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error approving questions:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
