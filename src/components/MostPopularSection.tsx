import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, Users, ChevronLeft, ChevronRight, ArrowRight, Flame } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CourseThumbnail } from "@/components/ui/course-thumbnail";

interface MostPopularSectionProps {
  featuredCoursesData?: any[];
}

export const MostPopularSection = ({ featuredCoursesData }: MostPopularSectionProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();

  const courses = Array.isArray(featuredCoursesData)
    ? featuredCoursesData.map(fc => ({
    id: fc.courses?.id || fc.course_id,
    title: fc.courses?.name || "Course",
    rating: fc.courses?.rating || 4.9,
    students: fc.courses?.student_count || 0,
    duration: `${(fc.courses?.duration_months || 6) * 50} Hours`,
    price: fc.courses?.price_inr || 1000,
    originalPrice: fc.courses?.original_price_inr || 25000,
    instructor: fc.courses?.instructor_name || "SimpleLecture Team",
    slug: fc.courses?.slug || "",
    isComingSoon: fc.courses?.is_coming_soon || false,
    thumbnailUrl: (() => {
      const ct = (fc.courses as any)?.course_thumbnails;
      return Array.isArray(ct) ? ct[0]?.storage_url : ct?.storage_url || null;
    })(),
  }))
    : [];

  if (courses.length === 0) return null;

  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % courses.length);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + courses.length) % courses.length);

  const visibleCourses = courses.length >= 3
    ? [
        courses[currentIndex],
        courses[(currentIndex + 1) % courses.length],
        courses[(currentIndex + 2) % courses.length],
      ]
    : courses;

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-destructive/10 text-destructive border-destructive/20">
            <Flame className="w-3 h-3 mr-1" />
            Trending Now
          </Badge>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Most <span className="text-primary">Popular</span> Courses
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Courses loved by thousands of students across India
          </p>
        </div>

        <div className="relative">
          {courses.length > 3 && (
            <>
              <Button
                variant="outline"
                size="icon"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 rounded-full shadow-lg hidden md:flex"
                onClick={prevSlide}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 rounded-full shadow-lg hidden md:flex"
                onClick={nextSlide}
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleCourses.map((course, idx) => (
              <Card
                key={`${course.id}-${idx}`}
                className="group hover:shadow-hover transition-all duration-300 overflow-hidden animate-fade-in cursor-pointer border-2 border-transparent hover:border-primary/20"
                onClick={() => navigate(`/course/${course.slug}`)}
              >
                <div className="relative h-48 overflow-hidden">
                  <CourseThumbnail
                    thumbnailUrl={course.thumbnailUrl}
                    alt={course.title}
                    className="w-full h-full group-hover:scale-110 transition-transform duration-500"
                  />
                  {course.isComingSoon ? (
                    <Badge className="absolute top-4 left-4 bg-amber-500 text-white border-0">
                      Coming Soon
                    </Badge>
                  ) : (
                    <Badge className="absolute top-4 left-4 bg-destructive">
                      <Flame className="w-3 h-3 mr-1" />
                      Most Popular
                    </Badge>
                  )}
                  <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1 flex items-center gap-2 text-white text-sm">
                    <Clock className="w-4 h-4" />
                    {course.duration}
                  </div>
                </div>

                <CardContent className="pt-6">
                  <h3 className="text-xl font-bold mb-3 line-clamp-2 group-hover:text-primary transition-colors">
                    {course.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    by {course.instructor}
                  </p>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-bold">{course.rating}</span>
                      <span className="text-muted-foreground text-sm">({course.students.toLocaleString()})</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground text-sm">
                      <Users className="w-4 h-4" />
                      {course.students.toLocaleString()}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-primary">₹{course.price}</span>
                        <span className="text-lg line-through text-muted-foreground">
                          ₹{course.originalPrice.toLocaleString()}
                        </span>
                      </div>
                      <Badge className="bg-success text-white">
                        {Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100)}% OFF
                      </Badge>
                    </div>
                  </div>
                </CardContent>

                <CardFooter>
                  <Button className="w-full group" onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/enroll/${course.slug}`);
                  }}>
                    Enroll now
                    <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

          {courses.length > 3 && (
            <div className="flex justify-center gap-2 mt-8 md:hidden">
              <Button variant="outline" size="icon" onClick={prevSlide}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextSlide}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
