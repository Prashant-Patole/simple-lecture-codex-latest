import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Clock, Users, ChevronRight, GraduationCap, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useFeaturedCourses } from "@/hooks/useFeaturedCourses";
import { useNavigate } from "react-router-dom";
import { CourseThumbnail } from "@/components/ui/course-thumbnail";

interface BestsellersSectionProps {
  featuredCoursesData?: any[];
}

export const BestsellersSection = ({ featuredCoursesData }: BestsellersSectionProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const navigate = useNavigate();
  
  // Only fetch if no props provided (skip redundant query when data comes from parent)
  const shouldFetch = !Array.isArray(featuredCoursesData);
  const { data: fetchedCourses, isLoading, isError, refetch } = useFeaturedCourses('bestsellers', shouldFetch);
  
  // Use props if available
  const featuredCourses = Array.isArray(featuredCoursesData)
    ? featuredCoursesData
    : Array.isArray(fetchedCourses)
      ? fetchedCourses
      : [];

  // Memoize course mapping to prevent recreation on every render
  const bestsellerCourses = useMemo(() => 
    featuredCourses.map(fc => ({
      id: fc.courses?.id || fc.course_id,
      title: fc.courses?.name || "Course",
      instructor: fc.courses?.instructor_name || "SimpleLecture Team",
      instructorRole: "Expert",
      rating: fc.courses?.rating || 5.0,
      students: fc.courses?.student_count || 0,
      duration: `${(fc.courses?.duration_months || 6) * 50} Hours`,
      price: fc.courses?.price_inr || 1000,
      originalPrice: fc.courses?.original_price_inr || 25000,
      slug: fc.courses?.slug || "",
      isComingSoon: fc.courses?.is_coming_soon || false,
      thumbnailUrl: (() => {
        const ct = (fc.courses as any)?.course_thumbnails;
        return Array.isArray(ct) ? ct[0]?.storage_url : ct?.storage_url || null;
      })(),
    })) || [],
    [featuredCourses]
  );

  // Don't render if no courses after loading completes
  if (!isLoading && bestsellerCourses.length === 0) {
    return null;
  }

  return (
    <section className="py-20 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-primary/80">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:40px_40px]" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Error state */}
        {isError && (
          <div className="text-center text-white py-12">
            <p className="mb-4">Unable to load bestsellers. Please try again.</p>
            <Button variant="outline" className="text-white border-white hover:bg-white/10" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && !featuredCourses && !isError && (
          <div className="flex items-center justify-center py-20 min-h-[320px] text-white">
            <Loader2 className="h-8 w-8 animate-spin mr-3" />
            <span className="text-white/80">Loading bestsellers...</span>
          </div>
        )}

        {/* Main content */}
        {!isLoading && !isError && bestsellerCourses.length > 0 && (
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-6 text-white">
            <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm">
              <Star className="w-4 h-4 mr-2 fill-white" />
              Top Rated
            </Badge>
            
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              Bestsellers Chosen by Our Students
            </h2>
            
            <p className="text-lg text-white/90 leading-relaxed">
              Explore our top-rated courses, chosen by thousands of students who've enrolled and benefited.
              These bestsellers reflect what's most in-demand and valuable across our platform.
            </p>

            <Button 
              size="lg" 
              className="bg-white text-primary hover:bg-white/90 shadow-xl group"
              onClick={() => navigate('/programs')}
            >
              View More Courses
              <ChevronRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>

            {/* Decorative Graduation Cap */}
            <div className="hidden lg:block absolute bottom-0 left-0 opacity-10">
              <GraduationCap className="w-64 h-64" />
            </div>
          </div>

          {/* Right Carousel */}
          <div className="relative">
            <div className="overflow-hidden">
              <div 
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              >
                {bestsellerCourses.map((course) => (
                  <div key={course.id} className="w-full flex-shrink-0 px-2">
                    <Card 
                      className="bg-white hover:shadow-2xl transition-all duration-300 group overflow-hidden cursor-pointer"
                      onClick={() => navigate(`/course/${course.slug}`)}
                    >
                      {/* Course Image */}
                      <div className="relative h-48 overflow-hidden">
                         <CourseThumbnail
                           thumbnailUrl={course.thumbnailUrl}
                          alt={course.title}
                          className="w-full h-full group-hover:scale-110 transition-transform duration-500"
                         />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        {course.isComingSoon && (
                          <Badge className="absolute top-4 left-4 bg-amber-500 text-white border-0">
                            Coming Soon
                          </Badge>
                        )}
                        <Badge className="absolute top-4 right-4 bg-primary">
                          Bestseller
                        </Badge>
                      </div>

                      <CardContent className="p-6 space-y-4">
                        {/* Course Title */}
                        <h3 className="text-xl font-bold line-clamp-2 group-hover:text-primary transition-colors">
                          {course.title}
                        </h3>

                        {/* Instructor */}
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold">
                            {course.instructor.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{course.instructor}</p>
                            <p className="text-xs text-muted-foreground">{course.instructorRole}</p>
                          </div>
                        </div>

                        {/* Rating & Students */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              ))}
                            </div>
                            <span className="font-bold">{course.rating}</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground text-sm">
                            <Users className="w-4 h-4" />
                            {course.students.toLocaleString()}
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Clock className="w-4 h-4" />
                          {course.duration} of content
                        </div>

                        {/* Price */}
                        <div className="pt-4 border-t space-y-2">
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
                          <p className="text-xs text-muted-foreground">
                            + Optional AI Tutoring & Live Classes add-ons
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Dots */}
            <div className="flex justify-center gap-2 mt-6">
              {bestsellerCourses.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`h-2 rounded-full transition-all ${
                    currentIndex === index ? "bg-white w-8" : "bg-white/40 w-2"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
        )}
      </div>
    </section>
  );
};
