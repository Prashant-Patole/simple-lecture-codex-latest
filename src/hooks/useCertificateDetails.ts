import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CertificateDetail {
  badgeId: string;
  courseId: string;
  courseName: string;
  completionDate: string;
  enrollmentDate: string;
  subjects: string[];
  studentName: string;
}

export const useCertificateDetails = () => {
  return useQuery({
    queryKey: ['certificate-details'],
    queryFn: async (): Promise<CertificateDetail[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get course_complete badges
      const { data: badges } = await supabase
        .from('student_badges')
        .select('id, course_id, earned_at')
        .eq('student_id', user.id)
        .eq('badge_type', 'course_complete');

      if (!badges || badges.length === 0) return [];

      // Get student name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      const studentName = profile?.full_name || user.email || 'Student';

      const results: CertificateDetail[] = [];

      for (const badge of badges) {
        if (!badge.course_id) continue;

        // Get course name
        const { data: course } = await supabase
          .from('courses')
          .select('name')
          .eq('id', badge.course_id)
          .single();

        // Get subjects
        const { data: courseSubjects } = await supabase
          .from('course_subjects')
          .select('subject_id, popular_subjects(name)')
          .eq('course_id', badge.course_id);

        const subjects = courseSubjects
          ?.map((cs: any) => cs.popular_subjects?.name)
          .filter(Boolean) || [];

        // Get enrollment date
        const { data: enrollment } = await supabase
          .from('enrollments')
          .select('enrolled_at')
          .eq('student_id', user.id)
          .eq('course_id', badge.course_id)
          .maybeSingle();

        results.push({
          badgeId: badge.id,
          courseId: badge.course_id,
          courseName: course?.name || 'Course',
          completionDate: badge.earned_at,
          enrollmentDate: enrollment?.enrolled_at || badge.earned_at,
          subjects,
          studentName,
        });
      }

      return results;
    },
    staleTime: 5 * 60 * 1000,
  });
};
