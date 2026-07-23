import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SEOHead } from '@/components/SEO';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, Clock, Home, ChevronRight, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { useEnrolledCoursesWithCategories } from '@/hooks/useEnrolledCoursesWithCategories';
import { useIsChecker } from '@/hooks/useIsChecker';
import { useCheckerAllCourses } from '@/hooks/useCheckerAllCourses';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNav } from '@/components/mobile/BottomNav';
import { format } from 'date-fns';
import { mcLog, getNavType, installBFCacheProbes } from '@/lib/debug/myCoursesLogger';

interface CategoryTab {
  id: string;
  name: string;
  icon: string | null;
}

const MyCourses = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isChecker, isLoading: checkerLoading } = useIsChecker();
  const { data: enrolledCourses, isLoading: enrolledLoading } = useEnrolledCoursesWithCategories();
  const { data: allCourses, isLoading: allCoursesLoading } = useCheckerAllCourses(isChecker);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const coursesData = isChecker ? allCourses : enrolledCourses;
  const isLoading = (checkerLoading || (isChecker ? allCoursesLoading : enrolledLoading)) && !coursesData;

  // --- Strict logging (Step A diagnostic) ---
  const renderCount = useRef(0);
  renderCount.current += 1;
  const mountedAt = useRef<number>(0);

  useEffect(() => {
    installBFCacheProbes();
    mountedAt.current = performance.now();
    mcLog('MyCourses', 'mount', {
      navType: getNavType(),
      referrer: document.referrer || null,
      isMobile,
      url: location.pathname,
    });
    return () => {
      mcLog('MyCourses', 'unmount', {
        elapsedMs: Math.round(performance.now() - mountedAt.current),
        renderCount: renderCount.current,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  mcLog('MyCourses', 'render', {
    n: renderCount.current,
    isLoading,
    coursesCount: coursesData?.length ?? null,
    isChecker,
  });

  const enrolledCategories = useMemo(() => {
    if (!coursesData) return [];
    const categoryMap = new Map<string, CategoryTab>();
    for (const course of coursesData) {
      if (course.parentCategoryId && !categoryMap.has(course.parentCategoryId)) {
        categoryMap.set(course.parentCategoryId, {
          id: course.parentCategoryId,
          name: course.parentCategoryName || 'Unknown',
          icon: course.parentCategoryIcon,
        });
      }
    }
    return Array.from(categoryMap.values());
  }, [coursesData]);

  const filteredCourses = useMemo(() => {
    if (!coursesData) return [];
    if (selectedCategory === 'all') return coursesData;
    return coursesData.filter(c => c.parentCategoryId === selectedCategory);
  }, [coursesData, selectedCategory]);

  const handleCourseClick = (course: { id: string }) => {
    navigate(`/learning/${course.id}`);
  };

  if (isMobile) {
    return (
      <>
        <SEOHead title="My Courses | SimpleLecture" description="View and continue your enrolled courses" />
        <div className="min-h-screen bg-muted/30 pb-24">
          {/* Mobile Header */}
          <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-5 pt-12 pb-6 rounded-b-3xl">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="flex-shrink-0" aria-label="Go back">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">My Courses</h1>
                <p className="text-primary-foreground/70 text-sm mt-1">
                  {isLoading ? 'Loading...' : `${filteredCourses.length} course${filteredCourses.length !== 1 ? 's' : ''} enrolled`}
                </p>
              </div>
            </div>
          </div>

          {/* Scrollable Category Pills */}
          <div className="px-4 py-3 overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 w-max">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground border border-border'
                }`}
              >
                All
              </button>
              {enrolledCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground border border-border'
                  }`}
                >
                  {cat.icon && <span className="mr-1">{cat.icon}</span>}
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-4 grid grid-cols-2 gap-3">
            {isLoading && (
              [...Array(4)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-28 w-full" />
                  <div className="p-2.5 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-2 w-full" />
                    <Skeleton className="h-7 w-full rounded-md" />
                  </div>
                </Card>
              ))
            )}

            {!isLoading && filteredCourses.length === 0 && (
              <div className="text-center py-16 px-4 col-span-2">
                <BookOpen className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-1">No courses found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedCategory === 'all' ? "You haven't enrolled yet" : "No courses in this category"}
                </p>
                <Button onClick={() => navigate('/programs')} size="sm">Browse Programs</Button>
              </div>
            )}

            {!isLoading && filteredCourses.map((course) => (
              <Card
                key={course.id}
                className="overflow-hidden active:scale-[0.98] transition-transform cursor-pointer shadow-sm"
                onClick={() => handleCourseClick(course)}
              >
                <div className="relative h-28 overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5">
                  {course.thumbnail_url ? (
                    <img src={course.thumbnail_url} alt={course.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <BookOpen className="h-8 w-8 text-primary/40" />
                    </div>
                  )}
                  {!isChecker && (
                    <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
                      <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                      Enrolled
                    </Badge>
                  )}
                  {isChecker && (
                    <Badge className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5">
                      Checker
                    </Badge>
                  )}
                  {course.parentCategoryName && (
                    <Badge variant="secondary" className="absolute top-2 left-2 text-[10px] px-1.5 py-0.5">
                      {course.parentCategoryName}
                    </Badge>
                  )}
                </div>
                <CardContent className="p-2.5">
                  <h3 className="font-semibold text-xs line-clamp-2 mb-1">{course.name}</h3>
                  {course.short_description && (
                    <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1.5">{course.short_description}</p>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-2 flex-wrap">
                    {course.duration_months && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {course.duration_months}mo
                      </span>
                    )}
                    {!isChecker && (
                      <span className="flex items-center gap-0.5">
                        <BookOpen className="h-2.5 w-2.5" />
                        {format(new Date(course.enrolled_at), 'MMM yyyy')}
                      </span>
                    )}
                  </div>
                  <Button size="sm" className="w-full h-7 text-xs" variant="default">
                    {isChecker ? 'Review' : course.progress > 0 ? 'Continue' : 'Start'} <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <BottomNav />
      </>
    );
  }

  // Desktop layout unchanged
  return (
    <>
      <SEOHead title="My Courses | SimpleLecture" description="View and continue your enrolled courses" />
      {!isChecker && <DashboardHeader />}
      
      <main className="min-h-screen bg-background">
        {/* Breadcrumb */}
        {!isChecker && (
        <div className="bg-muted/30 border-b">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-primary transition-colors flex items-center gap-1">
                <Home className="h-4 w-4" />
                Home
              </Link>
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground font-medium">My Courses</span>
            </div>
          </div>
        </div>
        )}

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-8">
          <div className="container mx-auto px-4">
            <h1 className="text-4xl font-bold mb-2">My Courses</h1>
            <p className="text-muted-foreground">
              Continue your learning journey with your enrolled programs
            </p>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="container mx-auto px-4 py-8">
          <h2 className="text-2xl font-semibold mb-6">Browse by Category</h2>
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-2 bg-muted/50 p-2">
              <TabsTrigger 
                value="all"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                All Programs
              </TabsTrigger>
              {enrolledCategories.map((category) => (
                <TabsTrigger
                  key={category.id}
                  value={category.id}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  {category.icon && <span className="mr-2">{category.icon}</span>}
                  {category.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="container mx-auto px-4 pb-12">
          <div className="mb-6 h-5">
            {isLoading ? (
              <span className="text-sm text-muted-foreground">Loading your courses...</span>
            ) : (
              <span className="text-sm text-muted-foreground">
                {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} enrolled
              </span>
            )}
          </div>

          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-2 w-full" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {!isLoading && filteredCourses.length === 0 && (
            <Card className="p-12 text-center">
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-xl font-semibold mb-2">No courses found</h3>
              <p className="text-muted-foreground mb-4">
                {selectedCategory === 'all' 
                  ? "You haven't enrolled in any courses yet"
                  : "No courses found in this category"
                }
              </p>
              <Button onClick={() => navigate('/programs')}>
                Browse Programs
              </Button>
            </Card>
          )}

          {!isLoading && filteredCourses.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCourses.map((course) => (
                <Card 
                  key={course.id} 
                  className="h-full overflow-hidden hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer"
                  onClick={() => handleCourseClick(course)}
                >
                  <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/20 to-primary/5">
                    {course.thumbnail_url && (
                      <img src={course.thumbnail_url} alt={course.name} className="w-full h-full object-cover" loading="lazy" />
                    )}
                    {!isChecker ? (
                      <Badge className="absolute top-3 right-3 bg-primary text-primary-foreground">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Enrolled
                      </Badge>
                    ) : (
                      <Badge className="absolute top-3 right-3 bg-amber-500 text-white">
                        Checker
                      </Badge>
                    )}
                    {course.parentCategoryName && (
                      <Badge variant="secondary" className="absolute top-3 left-3">
                        {course.parentCategoryName}
                      </Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-2 line-clamp-2">{course.name}</h3>
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{course.short_description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      {course.duration_months && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {course.duration_months} {course.duration_months === 1 ? 'month' : 'months'}
                        </div>
                      )}
                      {!isChecker && (
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          Enrolled {format(new Date(course.enrolled_at), 'MMM dd, yyyy')}
                        </div>
                      )}
                    </div>
                    <Button className="w-full" variant="default">
                      {isChecker ? 'Review Content' : course.progress > 0 ? 'Continue Learning' : 'Start Learning'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
};

export default MyCourses;
