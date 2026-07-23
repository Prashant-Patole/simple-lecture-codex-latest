import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, eachDayOfInterval, parseISO, startOfDay } from "date-fns";

export interface StudentData {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  enrollment_date: string;
  last_active: string;
  status: "active" | "inactive" | "at_risk";
  courses: Array<{
    id: string;
    name: string;
    subjects: string[];
    progress: number;
    enrolled_at: string;
  }>;
  total_progress: number;
  tests_taken: number;
  avg_test_score: number;
  ai_queries: number;
  areas_of_improvement: string[];
  followups_pending: number;
  at_risk: boolean;
  live_classes: {
    total_scheduled: number;
    attended: number;
    attendance_percentage: number;
    missed: number;
    upcoming: number;
    recent_classes: Array<{
      id: string;
      subject: string;
      topic: string;
      date: string;
      attended: boolean;
      duration_minutes: number;
    }>;
  };
  ai_video_usage: {
    total_videos: number;
    watched_count: number;
    total_watch_time_minutes: number;
    completion_rate: number;
    recent_videos: Array<{
      title: string;
      subject: string;
      duration: number;
      watched_percentage: number;
      date: string;
    }>;
  };
  podcast_usage: {
    total_listened: number;
    total_time_minutes: number;
    favorite_topics: string[];
    recent_podcasts: Array<{
      title: string;
      subject: string;
      duration: number;
      date: string;
    }>;
  };
  mcq_practice: {
    total_attempted: number;
    total_correct: number;
    accuracy_percentage: number;
    by_subject: Record<string, { attempted: number; correct: number; accuracy: number }>;
    recent_sessions: Array<{
      subject: string;
      questions: number;
      correct: number;
      date: string;
    }>;
  };
  doubt_clearing: {
    total_doubts: number;
    resolved: number;
    pending: number;
    avg_resolution_time_minutes: number;
    by_subject: Record<string, number>;
    recent_doubts: Array<{
      question: string;
      subject: string;
      status: string;
      date: string;
    }>;
  };
  activity_score: number;
  activity_breakdown: Record<string, number>;
  activity_trends: Array<{
    date: string;
    score: number;
    live_class_minutes: number;
    video_watch_minutes: number;
    podcast_listen_minutes: number;
    mcq_attempts: number;
    doubts_asked: number;
  }>;
  timetable: Array<{
    day: number;
    subject: string;
    topic: string;
    start_time: string;
    end_time: string;
    instructor: string;
    type: string;
  }>;
  notifications: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
    priority: string;
  }>;
}

export const useCurrentStudent = () => {
  return useQuery({
    queryKey: ["current-student"],
    queryFn: async (): Promise<StudentData> => {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Not authenticated");
      }

      // ======== OPTIMIZED: Split into core vs deferred queries ========
      // Core queries needed for initial render (profile + enrollments + recent activity)

      // Fetch all data in parallel for maximum speed
      const [
        profileResult,
        enrollmentsResult,
        studentProgressResult,
        attendanceResult,
        doubtLogsResult,
        dptSubmissionsResult,
        assignmentSubmissionsResult,
        videoLogsResult,
        podcastLogsResult,
        activityLogsResult,
        paperTestResultsResult,
        testResultsResult,
        dppTopicSubmissionsResult
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('enrollments').select(`
          id, enrolled_at, is_active, course_id, batch_id,
          courses (id, name, description, course_subjects (subject_id, popular_subjects (id, name))),
          batches (id, name)
        `).eq('student_id', user.id).eq('is_active', true),
        supabase.from('student_progress').select('*').eq('student_id', user.id),
        supabase.from('class_attendance').select(`
          id, status, marked_at, scheduled_class_id, duration_seconds,
          scheduled_classes (id, subject, course_id, teacher_id, scheduled_at, duration_minutes)
        `).eq('student_id', user.id).order('marked_at', { ascending: false }),
        // Fixed: Use subject_topics with proper FK path
        supabase.from('doubt_logs').select(`
          id, question, answer, created_at, response_time_ms, topic_id
        `).eq('student_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('dpt_submissions').select('*').eq('student_id', user.id)
          .order('submitted_at', { ascending: false }),
        supabase.from('assignment_submissions').select('*').eq('student_id', user.id)
          .order('submitted_at', { ascending: false }),
        // Fetch AI video watch logs with joins
        supabase.from('ai_video_watch_logs').select(`
          id, video_title, duration_seconds, watched_seconds, completion_percentage, created_at,
          popular_subjects (id, name)
        `).eq('student_id', user.id).order('created_at', { ascending: false }).limit(20),
        // Fetch podcast listen logs with joins
        supabase.from('podcast_listen_logs').select(`
          id, podcast_title, duration_seconds, listened_seconds, created_at,
          popular_subjects (id, name)
        `).eq('student_id', user.id).order('created_at', { ascending: false }).limit(20),
        // Fetch daily activity logs for last 30 days
        supabase.from('daily_activity_logs').select('*')
          .eq('student_id', user.id)
          .order('activity_date', { ascending: false })
          .limit(30),
        // Fetch paper test results for PYQ scores
        supabase.from('paper_test_results').select('id, score, total_questions, percentage, paper_category, submitted_at')
          .eq('student_id', user.id),
        // Fetch test_results for practice/proficiency tests
        supabase.from('test_results').select('id, test_type, submitted_at')
          .eq('student_id', user.id),
        // Fetch dpp_topic_submissions for DPP tracking
        supabase.from('dpp_topic_submissions').select('id, submitted_at, test_date')
          .eq('student_id', user.id)
      ]);

      const profile = profileResult.data;
      const enrollments = enrollmentsResult.data;
      const studentProgress = studentProgressResult.data;
      const attendance = attendanceResult.data;
      const doubtLogs = doubtLogsResult.data;
      const dptSubmissions = dptSubmissionsResult.data;
      const assignmentSubmissions = assignmentSubmissionsResult.data;
      const videoLogs = videoLogsResult.data || [];
      const podcastLogs = podcastLogsResult.data || [];
      const activityLogs = activityLogsResult.data || [];
      const paperTestResults = paperTestResultsResult.data || [];
      const testResults = testResultsResult.data || [];
      const dppTopicSubmissions = dppTopicSubmissionsResult.data || [];

      if (profileResult.error) {
        console.error("Error fetching profile:", profileResult.error);
        throw new Error("Failed to fetch profile");
      }

      // Fetch timetable only if we have batch IDs - with proper joins
      const batchIds = enrollments?.map(e => e.batch_id).filter(Boolean) || [];
      let timetableData: any[] = [];
      
      if (batchIds.length > 0) {
        const { data: timetable } = await supabase
          .from('instructor_timetables')
          .select(`
            id, day_of_week, start_time, end_time, is_active,
            popular_subjects (id, name),
            subject_chapters (id, title),
            teacher_profiles (id, full_name)
          `)
          .in('batch_id', batchIds)
          .eq('is_active', true);
        timetableData = timetable || [];
      }

      // Process enrollments into courses
      const courses = (enrollments || []).map((enrollment: any) => {
        const course = Array.isArray(enrollment.courses) 
          ? enrollment.courses[0] 
          : enrollment.courses;
        
        if (!course) return null;

        const subjects = course.course_subjects?.map((cs: any) => {
          const ps = Array.isArray(cs.popular_subjects) 
            ? cs.popular_subjects[0] 
            : cs.popular_subjects;
          return ps?.name;
        }).filter(Boolean) || [];

        // Calculate progress from student_progress
        const courseProgress = studentProgress?.filter((p: any) => {
          return true; // Will refine when we have proper progress data
        }) || [];
        
        const completedCount = courseProgress.filter((p: any) => p.is_completed).length;
        const totalCount = courseProgress.length || 1;
        const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return {
          id: course.id,
          name: course.name,
          subjects,
          progress,
          enrolled_at: enrollment.enrolled_at
        };
      }).filter(Boolean);

      // Calculate overall stats
      const totalProgress = courses.length > 0 
        ? Math.round(courses.reduce((sum: number, c: any) => sum + c.progress, 0) / courses.length)
        : 0;

      // Process test data - Calculate real test score from Mock + PYQ
      const allTests = [...(dptSubmissions || []), ...(assignmentSubmissions || [])];
      const testsTaken = allTests.length + paperTestResults.length;
      
      // Calculate Mock Test average from dpt_submissions
      const mockTestPercentages = (dptSubmissions || [])
        .filter((s: any) => s.total_questions > 0)
        .map((s: any) => (s.score / s.total_questions) * 100);
      const mockTestAvg = mockTestPercentages.length > 0
        ? mockTestPercentages.reduce((a: number, b: number) => a + b, 0) / mockTestPercentages.length
        : 0;

      // Calculate PYQ average from paper_test_results
      const pyqResults = paperTestResults.filter((p: any) => 
        p.paper_category === 'previous_year' && p.percentage != null
      );
      const pyqAvg = pyqResults.length > 0
        ? pyqResults.reduce((sum: number, p: any) => sum + p.percentage, 0) / pyqResults.length
        : 0;

      // Calculate combined test score (average of Mock and PYQ if both exist)
      let avgTestScore = 0;
      if (mockTestPercentages.length > 0 && pyqResults.length > 0) {
        avgTestScore = Math.round((mockTestAvg + pyqAvg) / 2);
      } else if (mockTestPercentages.length > 0) {
        avgTestScore = Math.round(mockTestAvg);
      } else if (pyqResults.length > 0) {
        avgTestScore = Math.round(pyqAvg);
      }

      // Get total scheduled classes for enrolled courses
      const courseIds = enrollments?.map((e: any) => e.course_id).filter(Boolean) || [];
      let totalScheduledClasses = 0;
      if (courseIds.length > 0) {
        const { count } = await supabase
          .from('scheduled_classes')
          .select('id', { count: 'exact', head: true })
          .in('course_id', courseIds)
          .eq('is_cancelled', false)
          .lte('scheduled_at', new Date().toISOString());
        
        totalScheduledClasses = count || 0;
      }

      // Process attendance data with accurate counts
      const attendanceRecords = attendance || [];
      const attendedClasses = attendanceRecords.filter((a: any) => a.status === 'present').length;
      const missedClasses = Math.max(0, totalScheduledClasses - attendedClasses);
      const attendancePercentage = totalScheduledClasses > 0 
        ? Math.round((attendedClasses / totalScheduledClasses) * 100)
        : 0;

      // Process recent classes with real scheduled class data
      const recentClasses = attendanceRecords.slice(0, 5).map((a: any) => {
        const scheduledClass = a.scheduled_classes;
        return {
          id: a.id,
          subject: scheduledClass?.subject || 'Class Session',
          topic: scheduledClass?.subject || 'Session',
          date: a.marked_at,
          attended: a.status === 'present',
          duration_minutes: scheduledClass?.duration_minutes || Math.round((a.duration_seconds || 3600) / 60)
        };
      });

      // Process doubt logs
      const aiQueries = doubtLogs?.length || 0;
      const doubtsBySubject: Record<string, number> = {};
      const recentDoubts = (doubtLogs || []).slice(0, 5).map((d: any) => {
        const subjectName = 'General';
        doubtsBySubject[subjectName] = (doubtsBySubject[subjectName] || 0) + 1;
        
        return {
          question: d.question?.substring(0, 100) || 'Question',
          subject: subjectName,
          status: d.answer ? 'resolved' : 'pending',
          date: d.created_at
        };
      });

      // Process AI video usage from new table
      const totalVideos = videoLogs.length;
      const completedVideos = videoLogs.filter((v: any) => v.completion_percentage >= 80).length;
      const totalWatchTimeMinutes = Math.round(videoLogs.reduce((sum: number, v: any) => sum + (v.watched_seconds || 0), 0) / 60);
      const avgCompletionRate = totalVideos > 0 
        ? Math.round(videoLogs.reduce((sum: number, v: any) => sum + (v.completion_percentage || 0), 0) / totalVideos)
        : 0;

      const recentVideos = videoLogs.slice(0, 5).map((v: any) => ({
        title: v.video_title,
        subject: (Array.isArray(v.popular_subjects) ? v.popular_subjects[0]?.name : v.popular_subjects?.name) || 'General',
        duration: Math.round((v.duration_seconds || 0) / 60),
        watched_percentage: v.completion_percentage || 0,
        date: v.created_at
      }));

      // Process podcast usage from new table
      const totalPodcasts = podcastLogs.length;
      const totalPodcastTimeMinutes = Math.round(podcastLogs.reduce((sum: number, p: any) => sum + (p.listened_seconds || 0), 0) / 60);
      
      // Get favorite topics from podcasts
      const podcastTopics: Record<string, number> = {};
      podcastLogs.forEach((p: any) => {
        const subjectName = (Array.isArray(p.popular_subjects) ? p.popular_subjects[0]?.name : p.popular_subjects?.name) || 'General';
        podcastTopics[subjectName] = (podcastTopics[subjectName] || 0) + 1;
      });
      const favoriteTopics = Object.entries(podcastTopics)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([topic]) => topic);

      const recentPodcasts = podcastLogs.slice(0, 5).map((p: any) => ({
        title: p.podcast_title,
        subject: (Array.isArray(p.popular_subjects) ? p.popular_subjects[0]?.name : p.popular_subjects?.name) || 'General',
        duration: Math.round((p.duration_seconds || 0) / 60),
        date: p.created_at
      }));

      // Process timetable with real subject/instructor names
      const formattedTimetable = timetableData.map((t: any) => {
        const subjectData = Array.isArray(t.popular_subjects) ? t.popular_subjects[0] : t.popular_subjects;
        const chapterData = Array.isArray(t.subject_chapters) ? t.subject_chapters[0] : t.subject_chapters;
        const instructorData = Array.isArray(t.teacher_profiles) ? t.teacher_profiles[0] : t.teacher_profiles;
        
        return {
          day: t.day_of_week,
          subject: subjectData?.name || 'Subject',
          topic: chapterData?.title || 'Topic',
          start_time: t.start_time,
          end_time: t.end_time,
          instructor: instructorData?.full_name || 'Instructor',
          type: 'live_class'
        };
      });

      // Generate dynamic 30-day activity trends based on real activity data
      const today = startOfDay(new Date());
      const thirtyDaysAgo = subDays(today, 29);
      const dateRange = eachDayOfInterval({ start: thirtyDaysAgo, end: today });

      // Helper to check if date matches
      const isSameDate = (d1: Date | string, d2: Date) => {
        if (!d1) return false;
        const date1 = typeof d1 === 'string' ? parseISO(d1) : d1;
        return format(startOfDay(date1), 'yyyy-MM-dd') === format(d2, 'yyyy-MM-dd');
      };

      // Calculate activity score for each day based on 4 activities
      const activityTrends = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // +25 for watching any AI lecture
        const hasLecture = videoLogs.some((v: any) => 
          v.created_at && isSameDate(v.created_at, date)
        );
        
        // +25 for attending live class (status = present)
        const hasLiveClass = (attendance || []).some((a: any) => 
          a.status === 'present' && a.marked_at && isSameDate(a.marked_at, date)
        );
        
        // +25 for taking test (practice, proficiency, pyq - NOT dpp)
        const hasTest = [
          ...(testResults || []).filter((t: any) => t.test_type !== 'dpp'),
          ...(paperTestResults || [])
        ].some((t: any) => t.submitted_at && isSameDate(t.submitted_at, date));
        
        // +25 for solving DPP
        const hasDPP = [
          ...(dppTopicSubmissions || []),
          ...(testResults || []).filter((t: any) => t.test_type === 'dpp')
        ].some((s: any) => {
          const submitDate = s.submitted_at || s.test_date;
          return submitDate && isSameDate(submitDate, date);
        });
        
        const score = (hasLecture ? 25 : 0) + (hasLiveClass ? 25 : 0) + 
                      (hasTest ? 25 : 0) + (hasDPP ? 25 : 0);
        
        return {
          date: dateStr,
          score,
          live_class_minutes: 0,
          video_watch_minutes: 0,
          podcast_listen_minutes: 0,
          mcq_attempts: 0,
          doubts_asked: 0
        };
      });

      // Calculate activity breakdown from real data
      const videoEngagement = totalVideos > 0 ? Math.min(100, avgCompletionRate) : 0;
      const podcastEngagement = totalPodcasts > 0 ? Math.min(100, Math.round((totalPodcastTimeMinutes / (totalPodcasts * 30)) * 100)) : 0;
      const mcqEngagement = (dptSubmissions?.length || 0) > 0 ? Math.min(100, avgTestScore) : 0;
      const doubtEngagement = aiQueries > 0 ? 100 : 0;

      // Build the student data object with real data
      const studentData: StudentData = {
        id: user.id,
        full_name: profile?.full_name || user.email?.split('@')[0] || 'Student',
        email: user.email || '',
        phone: profile?.phone_number || 'Not provided',
        avatar_url: profile?.avatar_url || null,
        enrollment_date: enrollments?.[0]?.enrolled_at || new Date().toISOString(),
        last_active: new Date().toISOString(),
        status: 'active',
        courses,
        total_progress: totalProgress,
        tests_taken: testsTaken,
        avg_test_score: avgTestScore,
        ai_queries: aiQueries,
        areas_of_improvement: [],
        followups_pending: 0,
        at_risk: false,
        live_classes: {
          total_scheduled: totalScheduledClasses,
          attended: attendedClasses,
          attendance_percentage: attendancePercentage,
          missed: missedClasses,
          upcoming: 0,
          recent_classes: recentClasses
        },
        ai_video_usage: {
          total_videos: totalVideos,
          watched_count: completedVideos,
          total_watch_time_minutes: totalWatchTimeMinutes,
          completion_rate: avgCompletionRate,
          recent_videos: recentVideos
        },
        podcast_usage: {
          total_listened: totalPodcasts,
          total_time_minutes: totalPodcastTimeMinutes,
          favorite_topics: favoriteTopics,
          recent_podcasts: recentPodcasts
        },
        mcq_practice: {
          total_attempted: dptSubmissions?.reduce((sum: number, d: any) => sum + (d.total_questions || 0), 0) || 0,
          total_correct: dptSubmissions?.reduce((sum: number, d: any) => sum + (d.score || 0), 0) || 0,
          accuracy_percentage: avgTestScore,
          by_subject: {},
          recent_sessions: (dptSubmissions || []).slice(0, 5).map((d: any) => ({
            subject: 'General',
            questions: d.total_questions || 0,
            correct: d.score || 0,
            date: d.test_date || d.submitted_at
          }))
        },
        doubt_clearing: {
          total_doubts: aiQueries,
          resolved: (doubtLogs || []).filter((d: any) => d.answer).length,
          pending: (doubtLogs || []).filter((d: any) => !d.answer).length,
          avg_resolution_time_minutes: doubtLogs?.length > 0 
            ? Math.round(doubtLogs.reduce((sum: number, d: any) => sum + (d.response_time_ms || 15000), 0) / doubtLogs.length / 1000 / 60) 
            : 0,
          by_subject: doubtsBySubject,
          recent_doubts: recentDoubts
        },
        activity_score: Math.min(100, Math.round(
          (totalProgress * 0.2) + 
          (attendancePercentage * 0.2) + 
          (avgTestScore * 0.2) +
          (videoEngagement * 0.2) +
          (podcastEngagement * 0.1) +
          (doubtEngagement * 0.1)
        )),
        activity_breakdown: {
          live_class_participation: attendancePercentage,
          ai_video_engagement: videoEngagement,
          podcast_listening: podcastEngagement,
          mcq_practice: mcqEngagement,
          doubt_clearing: doubtEngagement
        },
        activity_trends: activityTrends,
        timetable: formattedTimetable,
        notifications: []
      };

      return studentData;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });
};
