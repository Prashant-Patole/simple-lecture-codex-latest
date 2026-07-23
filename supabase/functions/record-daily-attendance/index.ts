import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create authenticated client
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const studentId = user.id;
    
    // Get device type from query params
    const url = new URL(req.url);
    const deviceType = url.searchParams.get('device_type') || 'web';
    
    const today = new Date().toISOString().split('T')[0];
    
    // Check if attendance exists for today
    const { data: existingAttendance, error: fetchError } = await supabase
      .from('daily_login_attendance')
      .select('*')
      .eq('student_id', studentId)
      .eq('attendance_date', today)
      .maybeSingle();

    if (fetchError) {
      console.error('[Attendance] Fetch error:', fetchError);
      throw fetchError;
    }

    let todayRecord;
    
    if (existingAttendance) {
      // Update existing record
      const { data: updated, error: updateError } = await supabase
        .from('daily_login_attendance')
        .update({
          last_active_at: new Date().toISOString(),
          login_count: (existingAttendance.login_count || 1) + 1,
        })
        .eq('id', existingAttendance.id)
        .select()
        .single();

      if (updateError) {
        console.error('[Attendance] Update error:', updateError);
        throw updateError;
      }
      todayRecord = updated;
      console.log(`[Attendance] Updated for ${studentId}, login_count: ${todayRecord.login_count}`);
    } else {
      // Insert new record
      const { data: inserted, error: insertError } = await supabase
        .from('daily_login_attendance')
        .insert({
          student_id: studentId,
          attendance_date: today,
          device_type: deviceType,
          first_login_at: new Date().toISOString(),
          last_active_at: new Date().toISOString(),
          login_count: 1,
        })
        .select()
        .single();

      if (insertError) {
        console.error('[Attendance] Insert error:', insertError);
        throw insertError;
      }
      todayRecord = inserted;
      console.log(`[Attendance] New record created for ${studentId}`);
    }

    // Calculate stats
    const stats = await calculateAttendanceStats(supabase, studentId);

    return new Response(
      JSON.stringify({
        success: true,
        today: {
          marked: true,
          first_login_at: todayRecord.first_login_at,
          login_count: todayRecord.login_count,
        },
        stats,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[Attendance] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateAttendanceStats(supabase: any, studentId: string) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Get first day of current month
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  
  // Get last 30 days of attendance for streak calculation
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Fetch all attendance records for this month and last 30 days
  const { data: attendanceRecords, error } = await supabase
    .from('daily_login_attendance')
    .select('attendance_date')
    .eq('student_id', studentId)
    .gte('attendance_date', thirtyDaysAgo)
    .order('attendance_date', { ascending: false });

  if (error) {
    console.error('[Attendance Stats] Error fetching records:', error);
    return {
      current_streak: 0,
      monthly_attendance_percentage: 0,
      days_present_this_month: 0,
      total_days_this_month: now.getDate(),
      last_7_days: [],
    };
  }

  const attendedDates = new Set(attendanceRecords?.map((r: any) => r.attendance_date) || []);
  
  // Calculate current streak (consecutive days including today)
  let streak = 0;
  let checkDate = new Date(now);
  
  while (true) {
    const dateStr = checkDate.toISOString().split('T')[0];
    if (attendedDates.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate monthly attendance
  const daysInMonthSoFar = now.getDate();
  let daysPresent = 0;
  
  for (let i = 1; i <= daysInMonthSoFar; i++) {
    const dateStr = new Date(now.getFullYear(), now.getMonth(), i).toISOString().split('T')[0];
    if (attendedDates.has(dateStr)) {
      daysPresent++;
    }
  }
  
  const monthlyPercentage = daysInMonthSoFar > 0 
    ? Math.round((daysPresent / daysInMonthSoFar) * 100) 
    : 0;

  // Last 7 days
  const last7Days = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    last7Days.push({
      date: dateStr,
      present: attendedDates.has(dateStr),
    });
  }

  return {
    current_streak: streak,
    monthly_attendance_percentage: monthlyPercentage,
    days_present_this_month: daysPresent,
    total_days_this_month: daysInMonthSoFar,
    last_7_days: last7Days,
  };
}
