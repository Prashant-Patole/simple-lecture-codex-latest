import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  FileText,
  Layers3,
  NotebookTabs,
} from 'lucide-react';
import { SEOHead } from '@/components/SEO';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { BottomNav } from '@/components/mobile/BottomNav';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { useCourseSubjects } from '@/hooks/useCourseSubjects';
import { useEnrolledCoursesWithCategories } from '@/hooks/useEnrolledCoursesWithCategories';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import './my-notes/my-notes.css';

const SEO_TITLE = 'My Notes | SimpleLecture';
const SEO_DESCRIPTION = 'Choose a subject notebook';

const useSubjectNoteCounts = (
  subjectIds: string[] | undefined,
  studentId: string | undefined,
) =>
  useQuery({
    queryKey: ['subject-note-counts', subjectIds?.join(',') ?? null, studentId],
    queryFn: async () => {
      if (!subjectIds?.length || !studentId) return {};

      const { data, error } = await supabase
        .from('student_lecture_notes')
        .select('subject_id')
        .eq('student_id', studentId)
        .in('subject_id', subjectIds);

      if (error) throw error;

      return (data || []).reduce<Record<string, number>>((counts, row) => {
        counts[row.subject_id] = (counts[row.subject_id] || 0) + 1;
        return counts;
      }, {});
    },
    enabled: !!subjectIds?.length && !!studentId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

const MyNotesSubjects = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { data: enrolledCourses = [] } = useEnrolledCoursesWithCategories();
  const { data: subjects = [], isLoading } = useCourseSubjects(courseId);

  const course = useMemo(
    () => enrolledCourses.find((item) => item.id === courseId),
    [enrolledCourses, courseId],
  );

  const subjectIds = useMemo(
    () =>
      subjects
        .map((item: any) => item.subject?.id || item.subject_id)
        .filter(Boolean) as string[],
    [subjects],
  );

  const { data: noteCounts = {} } = useSubjectNoteCounts(subjectIds, user?.id);
  const totalNotes = Object.values(noteCounts).reduce((sum, count) => sum + count, 0);

  const openSubject = (subject: any) => {
    const id = subject.subject?.id || subject.subject_id;
    navigate(`/my-notes/${courseId}/${id}`);
  };

  return (
    <>
      <SEOHead title={SEO_TITLE} description={SEO_DESCRIPTION} />
      {!isMobile && <DashboardHeader />}

      <main className="notes-app">
        <div className="notes-page">
          <section className="notes-hero">
            <div>
              <button className="notes-breadcrumb" onClick={() => navigate('/my-notes')}>
                <ArrowLeft size={14} />
                All course notebooks
              </button>
              <div className="notes-eyebrow">
                <NotebookTabs size={14} />
                Subject collection
              </div>
              <h1 className="notes-title">{course?.name || 'Choose a subject'}</h1>
              <p className="notes-subtitle">
                Each subject has its own notebook, with every chapter already indexed
                and ready for your ideas.
              </p>
            </div>
            <div className="notes-hero-stat" aria-label={`${totalNotes} saved notes`}>
              <strong>{isLoading ? '—' : totalNotes}</strong>
              <span>Saved notes</span>
            </div>
          </section>

          <div className="notes-section-heading">
            <div>
              <h2>Subject notebooks</h2>
              <p>
                {isLoading
                  ? 'Finding your subjects...'
                  : `${subjects.length} subject${subjects.length === 1 ? '' : 's'} in this course`}
              </p>
            </div>
          </div>

          {isLoading && (
            <div className="notes-card-grid" aria-label="Loading subjects">
              {[0, 1, 2, 3].map((item) => (
                <div className="notes-skeleton" key={item}>
                  <Skeleton className="h-full min-h-[236px] w-full" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && subjects.length === 0 && (
            <section className="notes-empty">
              <div>
                <div className="notes-empty-icon">
                  <Layers3 size={32} />
                </div>
                <h3>No subjects are available</h3>
                <p>This course does not have subject notebooks configured yet.</p>
              </div>
            </section>
          )}

          {!isLoading && subjects.length > 0 && (
            <div className="notes-card-grid">
              {subjects.map((subject: any, index: number) => {
                const subjectId = subject.subject?.id || subject.subject_id;
                const subjectName = subject.subject?.name || 'Untitled subject';
                const noteCount = noteCounts[subjectId] ?? 0;

                return (
                  <article
                    key={subject.id}
                    className="notes-library-card"
                    onClick={() => openSubject(subject)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') openSubject(subject);
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="notes-card-image">
                      {subject.subject?.thumbnail_url ? (
                        <img src={subject.subject.thumbnail_url} alt="" />
                      ) : (
                        <div className="notes-card-fallback">
                          <BookOpen size={48} />
                        </div>
                      )}
                      <span className="notes-card-badge">
                        <FileText size={12} />
                        {noteCount > 0
                          ? `${noteCount} note${noteCount === 1 ? '' : 's'}`
                          : 'Fresh notebook'}
                      </span>
                    </div>

                    <div className="notes-card-body">
                      <span className="notes-card-kicker">
                        Notebook {String(index + 1).padStart(2, '0')}
                      </span>
                      <h3 className="notes-card-title">{subjectName}</h3>
                      <p className="notes-card-description">
                        Browse the chapter index, revisit lecture notes, or begin a new
                        page for this subject.
                      </p>
                      <div className="notes-card-meta">
                        <span>{noteCount > 0 ? 'Notes synced' : 'Ready for your first note'}</span>
                        <span className="notes-card-action">
                          Open notebook
                          <ArrowUpRight size={14} />
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {!isMobile && <Footer />}
      {isMobile && <BottomNav />}
    </>
  );
};

export default MyNotesSubjects;
