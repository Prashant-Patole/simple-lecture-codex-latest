import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, notificationType, customMessage } = await req.json();

    if (!documentId || !notificationType) {
      return new Response(
        JSON.stringify({ error: 'documentId and notificationType are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch document details with subject info
    const { data: document, error: docError } = await supabaseClient
      .from('uploaded_question_documents')
      .select(`
        *,
        categories(name),
        popular_subjects(name),
        subject_chapters(title),
        subject_topics(title)
      `)
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error('Document not found');
    }

    // Find instructors assigned to this subject
    const { data: instructors, error: instructorsError } = await supabaseClient
      .from('instructor_subjects')
      .select('instructor_id, profiles(id, full_name)')
      .eq('subject_id', document.subject_id);

    if (instructorsError) throw instructorsError;

    if (!instructors || instructors.length === 0) {
      console.log('No instructors found for subject:', document.subject_id);
      return new Response(
        JSON.stringify({ message: 'No instructors assigned to this subject', notificationsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate message based on notification type
    let message = customMessage;
    if (!message) {
      const fileName = document.questions_file_name || document.file_name;
      const subject = document.popular_subjects?.name || 'Unknown Subject';
      const chapter = document.subject_chapters?.title || 'Unknown Chapter';
      
      switch (notificationType) {
        case 'verification_needed':
          message = `New document "${fileName}" uploaded for ${subject} > ${chapter}. Verification needed.`;
          break;
        case 'verification_completed':
          message = `Document "${fileName}" for ${subject} > ${chapter} has been verified and approved.`;
          break;
        case 'issues_found':
          message = `Issues found in document "${fileName}" for ${subject} > ${chapter}. Please review.`;
          break;
        default:
          message = `Update on document "${fileName}" for ${subject} > ${chapter}.`;
      }
    }

    // Create notifications for all instructors
    const notifications = instructors.map(instructor => ({
      document_id: documentId,
      recipient_id: instructor.instructor_id,
      notification_type: notificationType,
      message: message,
      is_read: false
    }));

    const { error: insertError } = await supabaseClient
      .from('verification_notifications')
      .insert(notifications);

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        message: `Notifications sent to ${instructors.length} instructor(s)`,
        notificationsSent: instructors.length,
        recipients: instructors.map(i => i.profiles?.full_name || 'Unknown')
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-verification-notification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
