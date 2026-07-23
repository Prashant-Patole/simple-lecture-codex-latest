import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimetableEntry {
  id: string;
  course_id: string;
  subject_id: string;
  instructor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  meeting_link: string | null;
  subject: { name: string }[] | null;
  instructor: { full_name: string }[] | null;
  course: { name: string }[] | null;
}

interface PushToken {
  token: string;
  platform: 'ios' | 'android' | 'web';
  user_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current time and calculate target window (15-17 minutes from now)
    const now = new Date();
    const currentDayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Calculate time 15 minutes from now
    const targetTime = new Date(now.getTime() + 15 * 60 * 1000);
    const targetTimeStr = targetTime.toTimeString().slice(0, 5); // HH:MM
    
    // Calculate time 17 minutes from now (2 minute window)
    const endWindow = new Date(now.getTime() + 17 * 60 * 1000);
    const endWindowStr = endWindow.toTimeString().slice(0, 5);

    console.log(`Checking for classes starting between ${targetTimeStr} and ${endWindowStr} on day ${currentDayOfWeek}`);

    // Find timetable entries starting in the next 15-17 minutes
    const { data: upcomingClasses, error: classError } = await supabase
      .from('course_timetables')
      .select(`
        id,
        course_id,
        subject_id,
        instructor_id,
        day_of_week,
        start_time,
        end_time,
        meeting_link,
        subject:popular_subjects(name),
        instructor:teacher_profiles(full_name),
        course:courses(name)
      `)
      .eq('is_active', true)
      .eq('day_of_week', currentDayOfWeek)
      .gte('start_time', targetTimeStr)
      .lte('start_time', endWindowStr);

    if (classError) {
      console.error('Error fetching upcoming classes:', classError);
      throw classError;
    }

    if (!upcomingClasses || upcomingClasses.length === 0) {
      console.log('No classes starting in the next 15-17 minutes');
      return new Response(
        JSON.stringify({ message: 'No upcoming classes to notify', notificationsSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${upcomingClasses.length} classes starting soon`);

    let totalNotificationsSent = 0;

    for (const classEntry of upcomingClasses as TimetableEntry[]) {
      // Get all enrolled students for this course
      const { data: enrollments, error: enrollError } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('course_id', classEntry.course_id)
        .eq('is_active', true);

      if (enrollError) {
        console.error('Error fetching enrollments:', enrollError);
        continue;
      }

      if (!enrollments || enrollments.length === 0) {
        console.log(`No enrolled students for course ${classEntry.course_id}`);
        continue;
      }

      const studentIds = enrollments.map(e => e.student_id);

      // Get push tokens for these students
      const { data: tokens, error: tokenError } = await supabase
        .from('push_notification_tokens')
        .select('token, platform, user_id')
        .in('user_id', studentIds)
        .eq('is_active', true);

      if (tokenError) {
        console.error('Error fetching push tokens:', tokenError);
        continue;
      }

      if (!tokens || tokens.length === 0) {
        console.log(`No push tokens found for students in course ${classEntry.course_id}`);
        continue;
      }

      // Prepare notification content
      const subjectName = classEntry.subject?.[0]?.name || 'Class';
      const instructorName = classEntry.instructor?.[0]?.full_name || 'Instructor';
      const courseName = classEntry.course?.[0]?.name || 'Course';

      const notificationTitle = '📚 Class Starting Soon!';
      const notificationBody = `${subjectName} with ${instructorName} starts in 15 minutes`;

      // Send notifications to each token
      for (const tokenData of tokens as PushToken[]) {
        try {
          // Log the notification (in a real implementation, you'd send to FCM/APNS)
          console.log(`Sending notification to ${tokenData.platform} device: ${notificationTitle}`);

          // Store notification in database for tracking
          await supabase
            .from('notices')
            .insert({
              title: notificationTitle,
              description: notificationBody,
              category: 'class_reminder',
              priority: 'high',
              is_global: false,
              created_by: null, // System-generated
            });

          totalNotificationsSent++;

          // TODO: Integrate with actual push notification service (FCM for Android, APNS for iOS)
          // For FCM, you would make a request to https://fcm.googleapis.com/fcm/send
          // with the appropriate headers and payload

        } catch (sendError) {
          console.error('Error sending notification:', sendError);
        }
      }
    }

    console.log(`Total notifications sent: ${totalNotificationsSent}`);

    return new Response(
      JSON.stringify({ 
        message: 'Class reminders processed', 
        classesFound: upcomingClasses.length,
        notificationsSent: totalNotificationsSent 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-class-reminders:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
