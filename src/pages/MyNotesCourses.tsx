import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEOHead } from '@/components/SEO';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, ChevronRight, NotebookPen, Loader2 } from 'lucide-react';
import { useEnrolledCoursesWithCategories, type EnrolledCourse } from '@/hooks/useEnrolledCoursesWithCategories';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNav } from '@/components/mobile/BottomNav';

const SEO_TITLE = "My Notes | SimpleLecture";
const SEO_DESCRIPTION = "Access your handwritten notes from all your courses";

const MyNotesCourses = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { data: enrolledCourses, isLoading } = useEnrolledCoursesWithCategories();

  const handleCourseClick = (course: EnrolledCourse) => {
    navigate(`/my-notes/${course.id}`);
  };

  if (isMobile) {
    return (
      <>
        <SEOHead title={SEO_TITLE} description={SEO_DESCRIPTION} />
        <div className="min-h-screen bg-muted/30 pb-24">
          <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-5 pt-12 pb-6 rounded-b-3xl">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="flex-shrink-0" aria-label="Go back">
                <ChevronRight className="h-5 w-5 rotate-180" />
              </button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">My Notes</h1>
                <p className="text-primary-foreground/70 text-sm mt-1">
                  {isLoading ? 'Loading...' : `${enrolledCourses?.length ?? 0} course${(enrolledCourses?.length ?? 0) !== 1 ? 's' : ''} available`}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 grid grid-cols-2 gap-3">
            {isLoading && (
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

            {!isLoading && enrolledCourses && enrolledCourses.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center py-16 text-center">
                <NotebookPen className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="font-medium text-muted-foreground">No courses enrolled yet</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Enroll in a course to start taking notes
                </p>
                <Button onClick={() => navigate('/programs')}>
                  Browse Courses
                </Button>
              </div>
            )}

            {enrolledCourses?.map((course) => (
              <Card
                key={course.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
                onClick={() => handleCourseClick(course)}
              >
                <div className="relative h-28 bg-muted">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10">
                      <BookOpen className="h-8 w-8 text-primary/40" />
                    </div>
                  )}
                  {course.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2">{course.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {course.progress > 0 ? `${course.progress}% complete` : 'Not started'}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full mt-2 justify-between px-2 h-8 text-xs"
                  >
                    <span className="flex items-center gap-1">
                      <NotebookPen className="h-3 w-3" />
                      View Notes
                    </span>
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
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
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-muted rounded-full transition-colors"
              aria-label="Go back"
            >
              <ChevronRight className="h-5 w-5 rotate-180" />
            </button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <NotebookPen className="h-7 w-7 text-primary" />
                My Notes
              </h1>
              <p className="text-muted-foreground mt-1">
                Select a course to view your handwritten notes
              </p>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
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

        {!isLoading && enrolledCourses && enrolledCourses.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <NotebookPen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No courses enrolled yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Enroll in a course to start taking and organizing your notes
            </p>
            <Button onClick={() => navigate('/programs')} size="lg">
              Browse Courses
            </Button>
          </div>
        )}

        {!isLoading && enrolledCourses && enrolledCourses.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {enrolledCourses.map((course) => (
              <Card
                key={course.id}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1 group"
                onClick={() => handleCourseClick(course)}
              >
                <div className="relative h-40 bg-muted">
                  {course.thumbnail_url ? (
                    <img
                      src={course.thumbnail_url}
                      alt={course.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10">
                      <BookOpen className="h-12 w-12 text-primary/30" />
                    </div>
                  )}
                  {course.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                  )}
                  {course.parentCategoryIcon && (
                    <Badge className="absolute top-3 left-3 text-xs" variant="secondary">
                      {course.parentCategoryIcon} {course.parentCategoryName}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-base leading-tight line-clamp-2 mb-2">
                    {course.name}
                  </h3>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-3">
                    <span>
                      {course.progress > 0 ? `${course.progress}% complete` : 'Not started'}
                    </span>
                    {course.duration_months && (
                      <span>{course.duration_months} months</span>
                    )}
                  </div>
                  <Button className="w-full" variant="outline" size="sm">
                    <NotebookPen className="h-4 w-4 mr-2" />
                    View Notes
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
};

export default MyNotesCourses;
