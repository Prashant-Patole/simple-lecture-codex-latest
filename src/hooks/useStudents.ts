import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StudentFilters {
  search?: string;
  subject?: string;
  course?: string;
  category?: string;
  enrollmentDateFrom?: string;
  enrollmentDateTo?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface Student {
  id: string;
  full_name: string;
  email?: string;
  phone: string;
  avatar_url: string | null;
  registered_at: string;
  enrollment_date: string;
  last_active: string | null;
  status: string;
  courses: {
    id: string;
    name: string;
    progress: number;
    enrolled_at: string;
  }[];
  total_progress: number;
  tests_taken: number;
  avg_test_score: number;
  at_risk: boolean;
}

export const useStudents = (filters: StudentFilters = {}) => {
  return useQuery({
    queryKey: ["students", filters],
    queryFn: async () => {
      // Fetch profiles with enrollments
      let query = supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          avatar_url,
          phone_number,
          created_at,
          enrollments (
            id,
            course_id,
            enrolled_at,
            is_active,
            courses (
              id,
              name
            )
          )
        `)
        .order("created_at", { ascending: false });

      const { data: profiles, error } = await query;

      if (error) throw error;

      // Transform data to match expected Student interface
      let students: Student[] = (profiles || []).map((profile) => {
        const enrollments = profile.enrollments || [];
        const courses = enrollments
          .filter((e: any) => e.is_active && e.courses)
          .map((e: any) => ({
            id: e.courses.id,
            name: e.courses.name,
            progress: 0, // Would need separate progress tracking table
            enrolled_at: e.enrolled_at,
          }));

        // Determine enrollment date (earliest enrollment)
        const enrollmentDates = enrollments
          .map((e: any) => e.enrolled_at)
          .filter(Boolean);
        const enrollmentDate = enrollmentDates.length > 0
          ? enrollmentDates.sort()[0]
          : profile.created_at;

        return {
          id: profile.id,
          full_name: profile.full_name || "Unknown",
          phone: profile.phone_number || "",
          avatar_url: profile.avatar_url,
          registered_at: profile.created_at,
          enrollment_date: enrollmentDate,
          last_active: null,
          status: courses.length > 0 ? "active" : "inactive",
          courses,
          total_progress: 0,
          tests_taken: 0,
          avg_test_score: 0,
          at_risk: false,
        };
      });

      // Apply filters
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        students = students.filter(
          (s) =>
            s.full_name.toLowerCase().includes(searchLower) ||
            s.phone.includes(searchLower)
        );
      }

      if (filters.course && filters.course !== "all") {
        students = students.filter((s) =>
          s.courses.some((c) => c.id === filters.course)
        );
      }

      if (filters.status && filters.status !== "all") {
        students = students.filter((s) => s.status === filters.status);
      }

      if (filters.enrollmentDateFrom) {
        students = students.filter(
          (s) => s.enrollment_date >= filters.enrollmentDateFrom!
        );
      }

      if (filters.enrollmentDateTo) {
        students = students.filter(
          (s) => s.enrollment_date <= filters.enrollmentDateTo!
        );
      }

      // Pagination
      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const start = (page - 1) * limit;
      const end = start + limit;

      return {
        students: students.slice(start, end),
        total: students.length,
        page,
        limit,
        totalPages: Math.ceil(students.length / limit),
      };
    },
  });
};

// Hook to get student stats
export const useStudentStats = () => {
  return useQuery({
    queryKey: ["student-stats"],
    queryFn: async () => {
      const { count: total, error: totalError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      if (totalError) throw totalError;

      // Get active students (those with active enrollments)
      const { data: activeEnrollments, error: activeError } = await supabase
        .from("enrollments")
        .select("student_id")
        .eq("is_active", true);

      if (activeError) throw activeError;

      const activeStudentIds = new Set(activeEnrollments?.map((e) => e.student_id) || []);

      // Get students enrolled in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: recentEnrollments, error: recentError } = await supabase
        .from("enrollments")
        .select("student_id")
        .gte("enrolled_at", thirtyDaysAgo.toISOString());

      if (recentError) throw recentError;

      const recentStudentIds = new Set(recentEnrollments?.map((e) => e.student_id) || []);

      return {
        total: total || 0,
        active: activeStudentIds.size,
        atRisk: 0, // Would need activity tracking to determine
        newStudents: recentStudentIds.size,
      };
    },
  });
};
