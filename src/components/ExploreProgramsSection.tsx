import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useCategoriesHierarchy } from "@/hooks/useCategoriesHierarchy";
import { useCoursesByHierarchy } from "@/hooks/useCoursesByHierarchy";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Users, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { CourseThumbnail } from "@/components/ui/course-thumbnail";

interface CategoryHierarchy {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  subcategories: CategoryHierarchy[];
}

interface ExploreProgramsSectionProps {
  categoriesData?: CategoryHierarchy[];
  coursesData?: any[];
}

export const ExploreProgramsSection = ({ categoriesData, coursesData }: ExploreProgramsSectionProps) => {
  const [selectedParentId, setSelectedParentId] = useState<string | undefined>(undefined);
  const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<string | undefined>(undefined);
  const [selectedSubSubCategoryId, setSelectedSubSubCategoryId] = useState<string | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const coursesPerPage = 9;
  
  // Only fetch categories if no props provided (skip redundant query when data comes from parent)
  const shouldFetchCategories = !Array.isArray(categoriesData);
  const { 
    data: fetchedCategories, 
    isLoading: categoriesLoading,
    isError: categoriesError,
    refetch: refetchCategories
  } = useCategoriesHierarchy(shouldFetchCategories);
  
  // For courses: only fetch if we're filtering OR if no initial data was provided
  const hasFilter = !!(selectedParentId || selectedSubCategoryId || selectedSubSubCategoryId);
  const shouldFetchCourses = hasFilter || !coursesData;
  const { 
    data: fetchedCourses, 
    isLoading: coursesLoading,
    isError: coursesError,
    refetch: refetchCourses
  } = useCoursesByHierarchy(
    selectedParentId,
    selectedSubCategoryId,
    selectedSubSubCategoryId,
    shouldFetchCourses
  );

  // Use props if provided, otherwise use fetched data
  // Sort: "Board Exams" first, others after
  const rawCategories = Array.isArray(categoriesData)
    ? categoriesData
    : Array.isArray(fetchedCategories)
      ? fetchedCategories
      : [];
  const categoriesHierarchy = useMemo(() => {
    return [...rawCategories].sort((a, b) => {
      const aIsBoard = a.name.toLowerCase().includes('board exam');
      const bIsBoard = b.name.toLowerCase().includes('board exam');
      if (aIsBoard && !bIsBoard) return -1;
      if (!aIsBoard && bIsBoard) return 1;
      return 0;
    });
  }, [rawCategories]);
  // Only use coursesData prop when no filter is selected (showing all)
  const courses = (!hasFilter && Array.isArray(coursesData))
    ? coursesData
    : (Array.isArray(fetchedCourses) ? fetchedCourses : []);

  // Get subcategories (level 2) for selected parent
  const subCategories = useMemo(() => {
    if (!selectedParentId || !categoriesHierarchy) return [];
    const parent = categoriesHierarchy.find(cat => cat.id === selectedParentId);
    return parent?.subcategories || [];
  }, [selectedParentId, categoriesHierarchy]);

  // Get sub-subcategories (level 3) for selected sub-category
  const subSubCategories = useMemo(() => {
    if (!selectedSubCategoryId || !subCategories.length) return [];
    const subCat = subCategories.find(cat => cat.id === selectedSubCategoryId);
    return subCat?.subcategories || [];
  }, [selectedSubCategoryId, subCategories]);

  // Pagination logic
  const totalCourses = courses?.length || 0;
  const totalPages = Math.ceil(totalCourses / coursesPerPage);
  const startIndex = (currentPage - 1) * coursesPerPage;
  const endIndex = startIndex + coursesPerPage;
  const paginatedCourses = courses?.slice(startIndex, endIndex) || [];

  const handleParentChange = (categoryId: string | undefined) => {
    setSelectedParentId(categoryId);
    setSelectedSubCategoryId(undefined);
    setSelectedSubSubCategoryId(undefined);
    setCurrentPage(1);
  };

  const handleSubCategoryChange = (categoryId: string | undefined) => {
    setSelectedSubCategoryId(categoryId);
    setSelectedSubSubCategoryId(undefined);
    setCurrentPage(1);
  };

  const handleSubSubCategoryChange = (categoryId: string | undefined) => {
    setSelectedSubSubCategoryId(categoryId);
    setCurrentPage(1);
  };

  // Determine loading and error states
  const isInitialLoading = categoriesLoading && !categoriesHierarchy;
  const hasError = categoriesError || coursesError;

  return (
    <section id="explore-programs" className="py-16 bg-muted/30 scroll-mt-24">
      <div className="container mx-auto px-4">
        <h2 className="text-4xl font-bold mb-8">Explore Our Top Programs</h2>

        {/* Error state */}
        {hasError && (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Unable to load courses</h3>
            <p className="text-muted-foreground mb-4">
              We're having trouble connecting. Please try again.
            </p>
            <Button onClick={() => { refetchCategories(); refetchCourses(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        )}

        {/* Loading state */}
        {isInitialLoading && !hasError && (
          <div className="flex items-center justify-center py-20 min-h-[320px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary mr-3" />
            <span className="text-muted-foreground">Loading courses...</span>
          </div>
        )}

        {/* Main content */}
        {!isInitialLoading && !hasError && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Parent Categories (Level 1) */}
          <Card className="h-fit">
            <CardContent className="p-4">
              <div className="space-y-2">
                {/* Most Popular */}
                <button
                  onClick={() => handleParentChange(undefined)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    !selectedParentId 
                      ? "bg-primary text-primary-foreground font-semibold" 
                      : "hover:bg-muted"
                  }`}
                >
                  Most Popular
                </button>

                {categoriesHierarchy?.map((category) => {
                  const isBoard = category.name.toLowerCase().includes('board exam');
                  const displayName = isBoard || category.name.toLowerCase().includes('coming soon') 
                    ? category.name 
                    : `${category.name} (Coming Soon)`;
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleParentChange(category.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                        selectedParentId === category.id 
                          ? "bg-primary text-primary-foreground font-semibold" 
                          : "hover:bg-muted"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <CategoryIcon icon={category.icon} alt={category.name} size="sm" />
                        {displayName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Right Content - Filters + Courses */}
          <div className="lg:col-span-3 space-y-4">
            {/* Sub-category Filter (Level 2) - Shows when parent is selected */}
            {selectedParentId && subCategories.length > 0 && (
              <Card>
                <CardContent className="p-3">
                  <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex gap-2 pb-2">
                      <Badge
                        variant={!selectedSubCategoryId ? "default" : "outline"}
                        className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/90 transition-colors"
                        onClick={() => handleSubCategoryChange(undefined)}
                      >
                        All
                      </Badge>
                      {subCategories.map((subCat) => (
                        <Badge
                          key={subCat.id}
                          variant={selectedSubCategoryId === subCat.id ? "default" : "outline"}
                          className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/90 transition-colors whitespace-nowrap"
                          onClick={() => handleSubCategoryChange(subCat.id)}
                        >
                          {subCat.icon && <CategoryIcon icon={subCat.icon} size="sm" className="mr-1" />}
                          {subCat.name}
                        </Badge>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Sub-sub-category Filter (Level 3) - Shows when sub-category is selected */}
            {selectedSubCategoryId && subSubCategories.length > 0 && (
              <Card>
                <CardContent className="p-3">
                  <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex gap-2 pb-2">
                      <Badge
                        variant={!selectedSubSubCategoryId ? "secondary" : "outline"}
                        className="cursor-pointer px-3 py-1.5 text-xs hover:bg-secondary/90 transition-colors"
                        onClick={() => handleSubSubCategoryChange(undefined)}
                      >
                        All {subCategories.find(c => c.id === selectedSubCategoryId)?.name}
                      </Badge>
                      {subSubCategories.map((subSubCat) => (
                        <Badge
                          key={subSubCat.id}
                          variant={selectedSubSubCategoryId === subSubCat.id ? "secondary" : "outline"}
                          className="cursor-pointer px-3 py-1.5 text-xs hover:bg-secondary/90 transition-colors whitespace-nowrap"
                          onClick={() => handleSubSubCategoryChange(subSubCat.id)}
                        >
                          {subSubCat.icon && <CategoryIcon icon={subSubCat.icon} size="sm" className="mr-1" />}
                          {subSubCat.name}
                        </Badge>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </CardContent>
              </Card>
            )}

            {/* Course Cards Grid */}
            {paginatedCourses && paginatedCourses.length > 0 ? (
              <>
                {/* Course count indicator */}
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalCourses)} of {totalCourses} courses
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {paginatedCourses.map((course) => (
                    <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow group">
                      <Link to={`/course/${course.slug}`} className="block">
                        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10">
                          <CourseThumbnail
                            thumbnailUrl={(() => {
                              const ct = (course as any).course_thumbnails;
                              return Array.isArray(ct) ? ct[0]?.storage_url : ct?.storage_url;
                            })()}
                            alt={course.name}
                            className="w-full h-full group-hover:scale-105 transition-transform"
                          />
                          {course.is_coming_soon && (
                            <Badge className="absolute top-3 left-3 bg-amber-500 text-white hover:bg-amber-600">Coming Soon</Badge>
                          )}
                          {course.price_inr === 0 && (
                            <Badge className="absolute top-3 right-3 bg-green-500">Free</Badge>
                          )}
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-semibold text-lg mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                            {course.name}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {course.short_description || ""}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                            {course.duration_months && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {course.duration_months} {course.duration_months === 1 ? 'month' : 'months'}
                              </div>
                            )}
                            {course.student_count > 0 && (
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {course.student_count.toLocaleString()} students
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              {course.price_inr > 0 ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-lg font-bold">₹{course.price_inr.toLocaleString()}</span>
                                  {course.original_price_inr && course.original_price_inr > course.price_inr && (
                                    <span className="text-xs text-muted-foreground line-through">
                                      ₹{course.original_price_inr.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-lg font-bold text-green-600">Free</span>
                              )}
                            </div>
                            <Button size="sm" variant="outline">View Details</Button>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                        let pageNum = i + 1;
                        if (totalPages > 5) {
                          if (currentPage > 3) {
                            pageNum = currentPage - 2 + i;
                          }
                          if (pageNum > totalPages) {
                            pageNum = totalPages - 4 + i;
                          }
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button asChild variant="outline" size="lg">
                    <Link to="/programs">View All Courses</Link>
                  </Button>
                </div>
              </>
            ) : (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground mb-4">No courses available in this category</p>
                <Button asChild variant="outline">
                  <Link to="/programs">Browse All Courses</Link>
                </Button>
              </Card>
            )}
          </div>
          </div>
        )}
      </div>
    </section>
  );
};
