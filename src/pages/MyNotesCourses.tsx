import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Clock3,
  LibraryBig,
  Sparkles,
} from 'lucide-react';
import { SEOHead } from '@/components/SEO';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { BottomNav } from '@/components/mobile/BottomNav';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useEnrolledCoursesWithCategories,
  type EnrolledCourse,
} from '@/hooks/useEnrolledCoursesWithCategories';
import { useIsMobile } from '@/hooks/use-mobile';
import './my-notes/my-notes.css';

const SEO_TITLE = 'My Notes | SimpleLecture';
const SEO_DESCRIPTION = 'Access and organize your course notes';

const MyNotesCourses = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: enrolledCourses = [], isLoading } = useEnrolledCoursesWithCategories();

  const openCourse = (course: EnrolledCourse) => {
    navigate(`/my-notes/${course.id}`);
  };

  return (
    <>
      <SEOHead title={SEO_TITLE} description={SEO_DESCRIPTION} />
      {!isMobile && <DashboardHeader />}

      <main className="notes-app">
        <div className="notes-page">
          <section className="notes-hero">
            <div>
              <button className="notes-breadcrumb" onClick={() => navigate('/dashboard')}>
                <ArrowLeft size={14} />
                Student dashboard
              </button>
              <div className="notes-eyebrow">
                <Sparkles size={14} />
                Your study archive
              </div>
              <h1 className="notes-title">Every idea, in one place.</h1>
              <p className="notes-subtitle">
                Return to the notes you captured during lectures, organized by course,
                subject, and chapter.
              </p>
            </div>
            <div className="notes-hero-stat" aria-label={`${enrolledCourses.length} courses`}>
              <strong>{isLoading ? '—' : enrolledCourses.length}</strong>
              <span>Course notebooks</span>
            </div>
          </section>

          <div className="notes-section-heading">
            <div>
              <h2>Your courses</h2>
              <p>Choose a course to continue into its subject notebooks.</p>
            </div>
          </div>

          {isLoading && (
            <div className="notes-card-grid" aria-label="Loading courses">
              {[0, 1, 2, 3].map((item) => (
                <div className="notes-skeleton" key={item}>
                  <Skeleton className="h-full min-h-[236px] w-full" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && enrolledCourses.length === 0 && (
            <section className="notes-empty">
              <div>
                <div className="notes-empty-icon">
                  <LibraryBig size={32} />
                </div>
                <h3>Your shelf is waiting</h3>
                <p>
                  Enroll in a course and your lecture notebooks will appear here
                  automatically.
                </p>
                <Button onClick={() => navigate('/programs')}>Browse courses</Button>
              </div>
            </section>
          )}

          {!isLoading && enrolledCourses.length > 0 && (
            <div className="notes-card-grid">
              {enrolledCourses.map((course) => (
                <article
                  key={course.id}
                  className="notes-library-card"
                  onClick={() => openCourse(course)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') openCourse(course);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="notes-card-image">
                    {course.thumbnail_url ? (
                      <img src={course.thumbnail_url} alt="" />
                    ) : (
                      <div className="notes-card-fallback">
                        <BookOpen size={48} />
                      </div>
                    )}
                    {course.parentCategoryName && (
                      <span className="notes-card-badge">
                        <LibraryBig size={12} />
                        {course.parentCategoryName}
                      </span>
                    )}
                  </div>

                  <div className="notes-card-body">
                    <span className="notes-card-kicker">Course notebook</span>
                    <h3 className="notes-card-title">{course.name}</h3>
                    <p className="notes-card-description">
                      {course.short_description ||
                        'Open your subject collection and continue writing where you left off.'}
                    </p>

                    <div className="notes-progress-track" aria-label={`${course.progress}% complete`}>
                      <div
                        className="notes-progress-fill"
                        style={{ width: `${Math.max(2, course.progress)}%` }}
                      />
                    </div>
                    <div className="notes-card-meta">
                      <span>
                        {course.progress > 0 ? `${course.progress}% complete` : 'Ready to begin'}
                      </span>
                      {course.duration_months ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 size={12} />
                          {course.duration_months} months
                        </span>
                      ) : (
                        <span className="notes-card-action">
                          Open notes
                          <ArrowUpRight size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      {!isMobile && <Footer />}
      {isMobile && <BottomNav />}
    </>
  );
};

export default MyNotesCourses;
