import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, phone_number } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'user_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Clean up all possible referencing tables
    const cleanupTables = [
      { table: 'welcome_email_logs', column: 'user_id' },
      { table: 'purchase_reminder_email_logs', column: 'user_id' },
      { table: 'daily_motivation_email_logs', column: 'user_id' },
      { table: 'daily_login_attendance', column: 'student_id' },
      { table: 'daily_activity_logs', column: 'student_id' },
      { table: 'doubt_logs', column: 'student_id' },
      { table: 'dpp_attempted_questions', column: 'student_id' },
      { table: 'dpp_topic_submissions', column: 'student_id' },
      { table: 'dpt_submissions', column: 'student_id' },
      { table: 'assignment_submissions', column: 'student_id' },
      { table: 'class_attendance', column: 'student_id' },
      { table: 'test_results', column: 'student_id' },
      { table: 'cart_items', column: 'user_id' },
      { table: 'ai_video_watch_logs', column: 'student_id' },
      { table: 'student_progress', column: 'student_id' },
      { table: 'enrollments', column: 'student_id' },
      { table: 'payments', column: 'user_id' },
      { table: 'user_roles', column: 'user_id' },
      { table: 'profiles', column: 'id' },
    ];

    const results: string[] = [];
    for (const { table, column } of cleanupTables) {
      const { error, count } = await supabase.from(table).delete().eq(column, user_id);
      if (error) {
        console.log(`Cleanup ${table}: ${error.message}`);
        results.push(`${table}: ERROR - ${error.message}`);
      } else {
        results.push(`${table}: OK`);
      }
    }

    // Delete phone OTP records
    if (phone_number) {
      await supabase.from('phone_otp_verifications').delete().eq('phone_number', phone_number);
      results.push('phone_otp: OK');
    }

    // Now delete from auth.users
    console.log('Attempting auth.admin.deleteUser...');
    const { data, error } = await supabase.auth.admin.deleteUser(user_id);
    
    if (error) {
      console.error('deleteUser error:', JSON.stringify(error));
      return new Response(JSON.stringify({ 
        error: error.message, 
        error_details: error,
        cleanup_results: results 
      }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('deleteUser success:', JSON.stringify(data));
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'User deleted successfully',
      cleanup_results: results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Caught error:', err);
    return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
