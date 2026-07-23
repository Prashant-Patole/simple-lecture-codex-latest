import { forwardRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Star, ArrowRight } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { LazyCourseThumbnail } from "@/components/ui/course-thumbnail";

interface Course {
  id: string;
  slug: string;
  name: string;
  instructor_name?: string | null;
  price_inr?: number | null;
  rating?: number | null;
  is_coming_soon?: boolean | null;
}

interface FeaturedCourse {
  id: string;
  course_id: string;
  display_order: number | null;
  courses: Course;
}

interface MobileCourseSectionsProps {
  mostPopularCourses?: FeaturedCourse[];
  newestCourses?: FeaturedCourse[];
}

const CourseRow = forwardRef<HTMLDivElement, { courses?: FeaturedCourse[]; title: string; emoji?: string }>(({ courses, title, emoji }, ref) => {
  const navigate = useNavigate();
  
  return (
    <div ref={ref} className="px-4 mt-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-1.5">
          {emoji && <span>{emoji}</span>} {title}
        </h2>
        <Button 
          variant="ghost" 
          className="text-primary text-xs p-0 h-auto hover:bg-transparent font-medium"
          onClick={() => navigate("/programs")}
        >
          View All
        </Button>
      </div>

      <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4">
        <div className="flex gap-3 pb-2">
          {courses?.slice(0, 5).map((featured) => {
            const course = featured.courses;
            if (!course) return null;
            return (
              <Card 
                key={featured.id}
                className="w-40 flex-shrink-0 overflow-hidden cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98] border-0 shadow-sm"
                onClick={() => navigate(`/course/${course.slug}`)}
              >
                <div className="relative h-24 w-full bg-muted">
                  <LazyCourseThumbnail courseId={course.id} alt={course.name} className="h-full w-full" />
                  {course.is_coming_soon && (
                    <div className="absolute top-2 right-2 bg-amber-500 text-white px-1.5 py-0.5 rounded text-[10px] font-semibold">
                      Coming Soon
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-0.5">
                    <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                    {course.rating?.toFixed(1) || "4.5"}
                  </div>
                </div>
                <CardContent className="p-2">
                  <h3 className="font-medium text-foreground text-xs line-clamp-2 leading-tight whitespace-normal">
                    {course.name}
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">
                    {course.instructor_name || "Expert Instructor"}
                  </p>
                  <p className="text-xs font-bold text-primary mt-1">
                    {formatINR(course.price_inr || 0)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
          <div
            className="w-20 flex-shrink-0 h-[168px] flex items-center justify-center cursor-pointer active:scale-[0.95] transition-all"
            onClick={() => navigate("/programs")}
          >
            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 rounded-full bg-primary/10 dark:bg-primary/30 flex items-center justify-center">
                <ArrowRight className="h-4 w-4 text-primary dark:text-primary" />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">All</span>
            </div>
          </div>
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  );
});
CourseRow.displayName = "CourseRow";

export const MobileCourseSections = forwardRef<HTMLDivElement, MobileCourseSectionsProps>(({ mostPopularCourses, newestCourses }, ref) => {
  return (
    <div ref={ref}>
      <CourseRow courses={mostPopularCourses} title="Most Popular" emoji="🔥" />
      <div className="mt-1">
        <CourseRow courses={newestCourses} title="Newest Courses" />
      </div>
    </div>
  );
});
MobileCourseSections.displayName = "MobileCourseSections";

export default MobileCourseSections;
