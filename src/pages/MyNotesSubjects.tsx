import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEO';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen, ChevronRight, NotebookPen, ArrowLeft, FileText
} from 'lucide-react';
import { useCourseSubjects } from '@/hooks/useCourseSubjects';
import { useEnrolledCoursesWithCategories } from '@/hooks/useEnrolledCoursesWithCategories';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNav } from '@/components/mobile/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

const SEO_TITLE = "My Notes | SimpleLecture";
const SEO_DESCRIPTION = "Select a subject to view your notes";

// Hook to get note count for a list of subject IDs
const useSubjectNoteCounts = (subjectIds: string[] | undefined, studentId: string | undefined) => {
  return useQuery({
    queryKey: ['subject-note-counts', subjectIds?.join(',') ?? null, studentId],
    queryFn: async () => {
      if (!subjectIds?.length || !studentId) return {};
      
      const counts: Record<string, number> = {};
      // Fetch all notes for this student across all specified subjects in one query
      const { data, error } = await supabase
        .from('student_lecture_notes')
        .select('subject_id')
        .eq('student_id', studentId)
        .in('subject_id', subjectIds);

      if (error) throw error;

      (data || []).forEach(row => {
        counts[row.subject_id] = (counts[row.subject_id] || 0) + 1;
      });

      return counts;
    },
    enabled: !!subjectIds?.length && !!studentId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
};

const MyNotesSubjects = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { data: enrolledCourses } = useEnrolledCoursesWithCategories();
  const { data: subjects, isLoading: subjectsLoading } = useCourseSubjects(courseId);

  const course = useMemo(
    () => enrolledCourses?.find(c => c.id === courseId),
    [enrolledCourses, courseId]
  );

  // Extract subject IDs from course subjects
  const subjectIds = useMemo(() => {
    if (!subjects) return [];
    return subjects.map((s: any) => s.subject?.id || s.subject_id).filter(Boolean) as string[];
  }, [subjects]);

  const { data: noteCounts = {} } = useSubjectNoteCounts(subjectIds, user?.id);

  const handleSubjectClick = (subject: any) => {
    const subjectId = subject.subject?.id || subject.subject_id;
    navigate(`/my-notes/${courseId}/${subjectId}`);
  };

  const renderSubjectCards = () => {
    if (!subjects) return null;

    return subjects.map((subject: any) => {
      const subjectId = subject.subject?.id || subject.subject_id;
      const subjectName = subject.subject?.name || 'Unknown Subject';
      const noteCount = subjectId ? (noteCounts[subjectId] ?? 0) : 0;

      return (
        <Card
          key={subject.id}
          className="overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 group"
          onClick={() => handleSubjectClick(subject)}
        >
          <div className="relative h-40 bg-muted">
            {subject.subject?.thumbnail_url ? (
              <img
                src={subject.subject.thumbnail_url}
                alt={subjectName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary/5">
                <BookOpen className="h-12 w-12 text-primary/20" />
              </div>
            )}
            {noteCount > 0 && (
              <Badge className="absolute top-3 left-3 text-xs" variant="secondary">
                <FileText className="h-3 w-3 mr-1" />
                {noteCount} note{noteCount !== 1 ? 's' : ''}
              </Badge>
            )}
            {noteCount === 0 && (
              <Badge className="absolute top-3 left-3 text-xs" variant="outline">
                No notes yet
              </Badge>
            )}
          </div>
          <CardContent className="p-4">
            <h3 className="font-semibold text-lg leading-tight mb-3">
              {subjectName}
            </h3>
            <Button className="w-full" variant="outline" size="sm">
              <NotebookPen className="h-4 w-4 mr-2" />
              Open Notebook
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </CardContent>
        </Card>
      );
    });
  };

  if (isMobile) {
    return (
      <>
        <SEOHead title={SEO_TITLE} description={SEO_DESCRIPTION} />
        <div className="min-h-screen bg-muted/30 pb-24">
          <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-5 pt-12 pb-6 rounded-b-3xl">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(`/my-notes`)} className="flex-shrink-0" aria-label="Go back">
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold truncate">{course?.name || 'Select Subject'}</h1>
                <p className="text-primary-foreground/70 text-sm mt-1">
                  {subjectsLoading ? 'Loading...' : `${subjects?.length ?? 0} subject${(subjects?.length ?? 0) !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3">
            {subjectsLoading && (
              [...Array(4)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-28 w-full" />
                  <div className="p-2.5 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-7 w-full rounded-md" />
                  </div>
                </Card>
              ))
            )}

            {!subjectsLoading && subjects?.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="font-medium text-muted-foreground">No subjects found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This course doesn't have any subjects configured.
                </p>
              </div>
            )}

            {renderSubjectCards()}
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <SEOHead title={SEO_TITLE} description={SEO_DESCRIPTION} />
      <DashboardHeader />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/my-notes')}
              className="p-2 hover:bg-muted rounded-full transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold truncate">{course?.name || 'Select Subject'}</h1>
              <p className="text-muted-foreground mt-1">
                Choose a subject to view your handwritten notes
              </p>
            </div>
          </div>
        </div>

        {subjectsLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-40 w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-8 w-full rounded-md" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {!subjectsLoading && subjects && subjects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No subjects found</h3>
            <p className="text-muted-foreground">
              This course doesn't have any subjects configured yet.
            </p>
          </div>
        )}

        {!subjectsLoading && subjects && subjects.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {renderSubjectCards()}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
};

export default MyNotesSubjects;
