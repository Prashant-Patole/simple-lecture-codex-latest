import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useStudentDetails = (studentId: string) => {
  return useQuery({
    queryKey: ["student-details", studentId],
    queryFn: async () => {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          avatar_url,
          phone_number,
          created_at
        `)
        .eq("id", studentId)
        .single();

      if (profileError) throw profileError;

      // Fetch enrollments with course details
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from("enrollments")
        .select(`
          id,
          course_id,
          enrolled_at,
          is_active,
          batch_id,
          courses (
            id,
            name,
            description,
            thumbnail_url
          ),
          batches (
            id,
            name
          )
        `)
        .eq("student_id", studentId);

      if (enrollmentsError) throw enrollmentsError;

      // Fetch doubt logs for AI activity
      const { data: doubts, error: doubtsError } = await supabase
        .from("doubt_logs")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (doubtsError) throw doubtsError;

      // Fetch DPT submissions for test history
      const { data: dptSubmissions, error: dptError } = await supabase
        .from("dpt_submissions")
        .select("*")
        .eq("student_id", studentId)
        .order("submitted_at", { ascending: false })
        .limit(10);

      if (dptError) throw dptError;

      // Fetch assignment submissions
      const { data: assignmentSubmissions, error: assignmentError } = await supabase
        .from("assignment_submissions")
        .select(`
          *,
          assignments (
            id,
            title,
            course_id
          )
        `)
        .eq("student_id", studentId)
        .order("submitted_at", { ascending: false })
        .limit(10);

      if (assignmentError) throw assignmentError;

      // Transform courses
      const courses = (enrollments || [])
        .filter((e: any) => e.courses)
        .map((e: any) => ({
          id: e.courses.id,
          name: e.courses.name,
          subjects: [],
          progress: 0,
          enrolled_at: e.enrolled_at,
          batch: e.batches?.name || null,
        }));

      // Calculate test stats
      const testsTaken = (dptSubmissions?.length || 0) + (assignmentSubmissions?.length || 0);
      const allScores = [
        ...(dptSubmissions?.map((d: any) => d.score / d.total_questions * 100) || []),
        ...(assignmentSubmissions?.map((a: any) => a.percentage) || []),
      ].filter((s) => s !== null && !isNaN(s));
      const avgTestScore = allScores.length > 0
        ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
        : 0;

      // Enrollment date
      const enrollmentDates = (enrollments || [])
        .map((e: any) => e.enrolled_at)
        .filter(Boolean);
      const enrollmentDate = enrollmentDates.length > 0
        ? enrollmentDates.sort()[0]
        : profile.created_at;

      return {
        id: profile.id,
        full_name: profile.full_name || "Unknown",
        email: "",
        phone: profile.phone_number || "",
        avatar_url: profile.avatar_url,
        enrollment_date: enrollmentDate,
        last_active: null,
        status: courses.length > 0 ? "active" : "inactive",
        courses,
        total_progress: 0,
        tests_taken: testsTaken,
        avg_test_score: avgTestScore,
        ai_queries: doubts?.length || 0,
        areas_of_improvement: [],
        followups_pending: 0,
        at_risk: false,
        progressData: {},
        testHistory: {
          dptSubmissions: dptSubmissions || [],
          assignmentSubmissions: assignmentSubmissions || [],
        },
        aiActivity: {
          doubts: doubts || [],
          total_queries: doubts?.length || 0,
        },
        followups: [],
        activityLog: [],
      };
    },
    enabled: !!studentId,
  });
};
