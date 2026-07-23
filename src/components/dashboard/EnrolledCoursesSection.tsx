import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, GraduationCap, Search } from 'lucide-react';
import { useDashboardCourseDetails } from '@/hooks/useDashboardCourseDetails';
import { CourseTabContent } from './CourseTabContent';

export const EnrolledCoursesSection = () => {
  const { data: courses, isLoading } = useDashboardCourseDetails();
  const [selectedCourse, setSelectedCourse] = useState<string>('');

  // Set first course as default when data loads
  useEffect(() => {
    if (courses?.length && !selectedCourse) {
      setSelectedCourse(courses[0].id);
    }
  }, [courses, selectedCourse]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-6">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // No courses enrolled - show browse CTA
  if (!courses?.length) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-foreground mb-2">
            No Courses Enrolled Yet
          </h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Start your learning journey by exploring our courses and enrolling in the ones that interest you.
          </p>
          <Button asChild size="lg" className="bg-gradient-to-r from-primary to-primary/80">
            <Link to="/programs">
              <Search className="h-5 w-5 mr-2" />
              Browse Courses
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentCourse = courses.find(c => c.id === selectedCourse) || courses[0];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          My Courses
        </CardTitle>
        <Button asChild variant="outline" size="sm">
          <Link to="/programs">
            <Search className="h-4 w-4 mr-1" />
            Browse More
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedCourse} onValueChange={setSelectedCourse}>
          <TabsList className="mb-6 flex-wrap h-auto gap-2 bg-muted/50 p-2">
            {courses.map((course) => (
              <TabsTrigger 
                key={course.id} 
                value={course.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {course.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {courses.map((course) => (
            <TabsContent key={course.id} value={course.id} className="mt-0">
              <CourseTabContent course={course} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
