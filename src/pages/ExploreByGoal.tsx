import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { goHome } from "@/lib/goHome";
import { SmartHeader } from "@/components/SmartHeader";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/mobile/BottomNav";
import { SEOHead } from "@/components/SEO";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCoursesByGoal } from "@/hooks/useExploreByGoalPublic";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { CategorySelector } from "@/components/admin/CategorySelector";
import { Users, Clock, Star, BookOpen } from "lucide-react";

const ExploreByGoal = () => {
  const { goalSlug } = useParams<{ goalSlug: string }>();
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  const { data, isLoading } = useCoursesByGoal(goalSlug, selectedCategory);
  const { data: categories } = useAdminCategories();

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <SmartHeader />
        <main className="flex-1">
          <div className="container mx-auto px-4 py-8">
            <Skeleton className="h-12 w-64 mb-4" />
            <Skeleton className="h-6 w-96 mb-8" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-96" />
              ))}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col">
        <SmartHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Goal Not Found</h1>
            <p className="text-muted-foreground mb-6">
              The goal you're looking for doesn't exist or is no longer available.
            </p>
            <Button onClick={() => goHome(navigate)}>Back to Home</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const { goal, courses } = data;

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      <SEOHead
        title={`${goal.name} – Online Coaching & Courses`}
        description={goal.description || `Best online coaching for ${goal.name}. Live classes, video lectures, mock tests, AI doubt solver. Browse top courses for ${goal.name} preparation.`}
        keywords={`${goal.name}, ${goal.name} online coaching, ${goal.name} online classes, ${goal.name} preparation, ${goal.name} courses, online learning India`}
        canonicalUrl={goalSlug ? `https://simplelecture.com/explore/${goalSlug}` : undefined}
      />
      <SmartHeader />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-b from-primary/10 to-background py-8 md:py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-2xl md:text-5xl font-bold mb-2 md:mb-4">{goal.name}</h1>
            {goal.description && (
              <p className="text-base md:text-xl text-muted-foreground max-w-3xl">
                {goal.description}
              </p>
            )}
          </div>
        </section>

        {/* Filters and Courses */}
        <section className="py-8 md:py-12">
          <div className="container mx-auto px-4">
            <div className="mb-8">
              <CategorySelector
                value={selectedCategory}
                onChange={setSelectedCategory}
                label="Filter by Category"
                showAllOption
                allOptionLabel="All Categories"
              />
            </div>

            {courses.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg">
                  No courses found for this goal{selectedCategory !== "all" && " in the selected category"}.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold">
                    {courses.length} Course{courses.length !== 1 ? "s" : ""} Available
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {courses.map((course: any) => (
                    <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                      <Link to={`/course/${course.slug}`}>
                        <div className="aspect-video overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 relative">
                          {(course.course_thumbnails?.storage_url || course.thumbnail_url) && (
                            <img
                              src={course.course_thumbnails?.storage_url || course.thumbnail_url}
                              alt={course.name}
                              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                            />
                          )}
                          {course.is_coming_soon && (
                            <Badge className="absolute top-2 left-2 bg-amber-500 text-white hover:bg-amber-600">Coming Soon</Badge>
                          )}
                        </div>
                        <CardContent className="p-4 md:p-6">
                          <h3 className="text-lg md:text-xl font-semibold mb-2 line-clamp-2">
                            {course.name}
                          </h3>
                          
                          {course.short_description && (
                            <p className="text-muted-foreground text-xs md:text-sm mb-3 md:mb-4 line-clamp-2 md:line-clamp-3">
                              {course.short_description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1.5 md:gap-2 mb-3 md:mb-4">
                            {course.course_subjects && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <BookOpen className="h-3 w-3" />
                                {course.course_subjects.length} Subject{course.course_subjects.length !== 1 ? "s" : ""}
                              </Badge>
                            )}
                            {course.duration_months && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {course.duration_months} {course.duration_months === 1 ? 'month' : 'months'}
                              </Badge>
                            )}
                            {course.student_count > 0 && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {course.student_count}
                              </Badge>
                            )}
                            {course.rating > 0 && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                {course.rating}
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xl md:text-2xl font-bold">
                                ₹{course.price_inr || 0}
                              </span>
                              {course.original_price_inr && course.original_price_inr > course.price_inr && (
                                <span className="text-xs md:text-sm text-muted-foreground line-through">
                                  ₹{course.original_price_inr}
                                </span>
                              )}
                            </div>
                            <Button size="sm" className="text-xs md:text-sm">View Details</Button>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
};

export default ExploreByGoal;
