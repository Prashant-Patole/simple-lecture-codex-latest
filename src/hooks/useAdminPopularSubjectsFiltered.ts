import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubjectFilters {
  categoryId?: string;
  courseId?: string;
  searchTerm?: string;
}

interface PaginationParams {
  page: number;
  pageSize: number;
  categoryId?: string;
  courseId?: string;
  searchTerm?: string;
}

interface PaginatedResult {
  data: SubjectWithCourses[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
}

interface SubjectWithCourses {
  id: string;
  name: string;
  slug: string;
  description?: string;
  category_id: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  content_json?: any;
  json_source_pdf_url?: string;
  thumbnail_url?: string;
  server_ip?: string;
  category_name?: string;
  courses: Array<{ id: string; name: string } | null>;
}

// Explicit field selection - excludes large columns (thumbnail_url, content_json, json_source_pdf_url)
// This reduces payload from ~3.6MB to ~5KB
const LIST_SELECT_FIELDS = `
  id, name, slug, description, category_id, display_order, 
  is_active, created_at, updated_at, server_ip
`;

// Base query - fetch ALL subjects with categories and courses in ONE call
const useAdminPopularSubjectsBase = () => {
  return useQuery({
    queryKey: ["admin-popular-subjects-base"],
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    queryFn: async () => {
      // Single query with all joins - O(1) API call
      // Uses explicit fields to exclude large base64 thumbnails
      const { data: subjects, error } = await supabase
        .from("popular_subjects")
        .select(`
          ${LIST_SELECT_FIELDS},
          categories(id, name),
          course_subjects(
            courses(id, name)
          )
        `)
        .order("display_order");

      if (error) throw error;

      // O(n) transformation - no nested loops
      return subjects?.map(subject => ({
        ...subject,
        category_name: subject.categories?.name,
        courses: subject.course_subjects
          ?.map((cs: any) => cs.courses)
          ?.filter(Boolean) || []
      })) as SubjectWithCourses[];
    },
  });
};

// Client-side filtering hook - O(n) filtering, no API calls on filter change
export const useAdminPopularSubjectsFiltered = (filters: SubjectFilters) => {
  const baseQuery = useAdminPopularSubjectsBase();

  // O(n) client-side filtering with useMemo
  const filteredSubjects = useMemo(() => {
    if (!baseQuery.data) return [];

    const searchLower = filters.searchTerm?.toLowerCase() || "";

    return baseQuery.data.filter(subject => {
      // Search filter - O(1) per subject
      const matchesSearch = !filters.searchTerm ||
        subject.name.toLowerCase().includes(searchLower);

      // Category filter - O(1) per subject
      const matchesCategory = !filters.categoryId || 
        filters.categoryId === "all" ||
        subject.category_id === filters.categoryId;

      // Course filter - O(k) where k is courses per subject (typically 1-3)
      const matchesCourse = !filters.courseId || 
        filters.courseId === "all" ||
        subject.courses?.some(c => c?.id === filters.courseId);

      return matchesSearch && matchesCategory && matchesCourse;
    });
  }, [baseQuery.data, filters.categoryId, filters.courseId, filters.searchTerm]);

  return {
    data: filteredSubjects,
    isLoading: baseQuery.isLoading,
    isError: baseQuery.isError,
    error: baseQuery.error,
    refetch: baseQuery.refetch,
  };
};

// Server-side paginated hook - O(n) where n=pageSize
export const useAdminPopularSubjectsPaginated = (params: PaginationParams) => {
  const { page, pageSize, categoryId, courseId, searchTerm } = params;

  return useQuery({
    queryKey: ["admin-popular-subjects-paginated", page, pageSize, categoryId, courseId, searchTerm],
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    queryFn: async (): Promise<PaginatedResult> => {
      // Build query with server-side filters
      let query = supabase
        .from("popular_subjects")
        .select(`
          ${LIST_SELECT_FIELDS},
          categories(id, name),
          course_subjects(courses(id, name))
        `, { count: 'exact' });

      // Server-side filters - O(1) WHERE clauses
      if (categoryId && categoryId !== "all") {
        query = query.eq("category_id", categoryId);
      }
      if (searchTerm) {
        query = query.ilike("name", `%${searchTerm}%`);
      }

      // Calculate range - O(1)
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query
        .order("display_order")
        .range(from, to);

      if (error) throw error;

      // O(n) single-pass transformation where n=pageSize
      let subjects = data?.map(subject => ({
        ...subject,
        category_name: subject.categories?.name,
        courses: subject.course_subjects
          ?.map((cs: any) => cs.courses)
          ?.filter(Boolean) || []
      })) as SubjectWithCourses[];

      // Client-side course filter (join can't filter server-side)
      if (courseId && courseId !== "all") {
        subjects = subjects.filter(s =>
          s.courses?.some(c => c?.id === courseId)
        );
      }

      return {
        data: subjects,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page,
      };
    },
  });
};

// Export base hook for cases where unfiltered data is needed
export { useAdminPopularSubjectsBase };
