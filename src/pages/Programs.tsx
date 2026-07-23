import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/SEO";
import { SmartHeader } from "@/components/SmartHeader";
import { Footer } from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ChevronLeft, ChevronRight, Users, Clock, Search, Home, ChevronRight as ChevronRightIcon, CheckCircle, Star, ArrowLeft, Shield, IndianRupee, Headphones } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePaginatedCourses } from "@/hooks/usePaginatedCourses";
import { useDebounce } from "@/hooks/useDebounce";
import { useEnrolledCourseIds } from "@/hooks/useEnrolledCoursesWithCategories";
import { useIsMobile } from "@/hooks/use-mobile";
import { BottomNav } from "@/components/mobile/BottomNav";
import { MobileCategorySheet } from "@/components/mobile/MobileCategorySheet";
import { formatINR } from "@/lib/utils";
import { rewriteStorageUrl } from "@/lib/proxyUrl";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/constants";

import { generateBreadcrumbSchema, generateCollectionPageSchema } from "@/lib/seo/structuredData";

/** Compact trust badges for Programs page */
const ProgramsTrustBadges = () => {
  const badges = [
    { icon: Users, label: "1,00,000+ Students" },
    { icon: Star, label: "4.9★ Rating" },
    { icon: Headphones, label: "24/7 AI Support" },
    { icon: IndianRupee, label: "From ₹1000/yr" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 py-4">
      {badges.map((badge) => {
        const Icon = badge.icon;
        return (
          <div key={badge.label} className="flex items-center gap-1.5 px-3 py-1.5 bg-card rounded-full border shadow-sm text-xs font-medium">
            <Icon className="w-3.5 h-3.5 text-primary" />
            <span>{badge.label}</span>
          </div>
        );
      })}
    </div>
  );
};

/** Category-specific AI-search content block */
const CategoryAIContent = ({ categoryName }: { categoryName: string }) => {
  const contentMap: Record<string, { question: string; answer: string }> = {
    "Board Exams": {
      question: "What are the best online courses for board exam preparation?",
      answer: "SimpleLecture offers AI-powered board exam courses for SSLC 10th and PUC with personalised learning, 24/7 AI doubt clearing, chapter-wise video lessons, and board-pattern mock tests — all starting at just ₹1000/year. Join 1,00,000+ students scoring 90+ with our mastery-based approach."
    },
    "Entrance Exams": {
      question: "Which online platform is best for NEET and JEE entrance exam preparation?",
      answer: "SimpleLecture provides comprehensive NEET and JEE preparation with AI tutors available round the clock, adaptive practice tests, and expert-curated content. Our affordable courses help students master concepts through personalised learning paths and instant doubt resolution."
    },
    "Professional Courses": {
      question: "Where can I find affordable professional courses online in India?",
      answer: "SimpleLecture offers professional courses including Pharmacy (D.Pharm & B.Pharm) and Nursing (GNM & B.Sc Nursing) preparation with AI-powered learning, curriculum-aligned content, and expert guidance — making quality professional education accessible to all."
    },
    "Skill Development": {
      question: "What are the best skill development courses for students in India?",
      answer: "SimpleLecture's skill development courses combine AI-powered adaptive learning with practical, industry-relevant content. Our platform offers personalised learning paths, instant AI doubt clearing, and affordable pricing to help students build future-ready skills."
    },
  };

  const content = contentMap[categoryName];
  if (!content) return null;

  return (
    <section className="container mx-auto px-4 py-4 md:py-6">
      <div className="max-w-3xl">
        <h2 className="text-lg md:text-xl font-bold mb-2">{content.question}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{content.answer}</p>
      </div>
    </section>
  );
};

const Programs = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Support both path params (SEO-friendly) and query params (backward compatibility)
  const categorySlug = params.categorySlug || searchParams.get("category");
  const subcategorySlug = params.subcategorySlug || searchParams.get("subcategory");
  const subSubcategorySlug = params.subsubcategorySlug || searchParams.get("subsubcategory");
  const pageParam = searchParams.get("page");
  const searchParam = searchParams.get("q");
  
  // Check if we're using path-based routing
  const isPathBasedRouting = !!params.categorySlug;
  
  const [searchQuery, setSearchQuery] = useState(searchParam || "");
  const [sortBy, setSortBy] = useState<"newest" | "popular" | "price-low" | "price-high">("popular");
  const [currentPage, setCurrentPage] = useState(pageParam ? parseInt(pageParam) : 1);
  const coursesPerPage = 12;

  // Debounce search query to avoid excessive API calls
  const debouncedSearch = useDebounce(searchQuery, 400);

  // Fetch categories with SEO metadata (lightweight query)
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories-list-seo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, parent_id, level, icon, description, display_order, meta_title, meta_description, meta_keywords")
        .eq("is_active", true)
        .order("display_order");
      
      if (error) throw error;
      return data;
    },
    staleTime: 300000, // Cache for 5 minutes
  });

  // Get parent categories (level 1)
  const parentCategories = categories?.filter(cat => cat.level === 1) || [];

  // Get selected parent category
  const selectedParentCategory = categorySlug 
    ? categories?.find(cat => cat.slug === categorySlug)
    : null;

  // Get subcategories for selected parent (level 2)
  const subcategories = selectedParentCategory
    ? categories?.filter(cat => cat.parent_id === selectedParentCategory.id) || []
    : [];

  // Get selected subcategory (level 2)
  const selectedSubcategory = subcategorySlug
    ? categories?.find(cat => cat.slug === subcategorySlug)
    : null;

  // Get sub-subcategories for selected subcategory (level 3)
  const subSubcategories = selectedSubcategory
    ? categories?.filter(cat => cat.parent_id === selectedSubcategory.id) || []
    : [];

  // Get selected sub-subcategory (level 3)
  const selectedSubSubcategory = subSubcategorySlug
    ? categories?.find(cat => cat.slug === subSubcategorySlug)
    : null;

  // Dynamic SEO metadata generation
  const pageTitle = useMemo(() => {
    const selected = selectedSubSubcategory || selectedSubcategory || selectedParentCategory;
    if (selected?.meta_title) return selected.meta_title;
    if (selected?.name) return `${selected.name} Online Courses`;
    return "Programs & Courses";
  }, [selectedParentCategory, selectedSubcategory, selectedSubSubcategory]);

  const pageDescription = useMemo(() => {
    const selected = selectedSubSubcategory || selectedSubcategory || selectedParentCategory;
    if (selected?.meta_description) return selected.meta_description;
    if (selected?.description) return selected.description;
    if (selected?.name) return `Explore ${selected.name} courses at SimpleLecture. Comprehensive preparation and expert guidance.`;
    return "Explore our comprehensive programs for board exams, NEET, JEE, and more";
  }, [selectedParentCategory, selectedSubcategory, selectedSubSubcategory]);

  const pageKeywords = useMemo(() => {
    const selected = selectedSubSubcategory || selectedSubcategory || selectedParentCategory;
    if (selected?.meta_keywords) return selected.meta_keywords;
    const parts = [
      selectedParentCategory?.name,
      selectedSubcategory?.name,
      selectedSubSubcategory?.name,
      "online courses",
      "SimpleLecture"
    ].filter(Boolean);
    return parts.join(", ");
  }, [selectedParentCategory, selectedSubcategory, selectedSubSubcategory]);

  const canonicalUrl = useMemo(() => {
    const base = "https://simplelecture.com/programs";
    const parts = [categorySlug, subcategorySlug, subSubcategorySlug].filter(Boolean);
    return parts.length > 0 ? `${base}/${parts.join("/")}` : base;
  }, [categorySlug, subcategorySlug, subSubcategorySlug]);

  // Generate breadcrumb structured data
  const breadcrumbSchema = useMemo(() => {
    const items = [
      { name: "Home", url: "https://simplelecture.com" },
      { name: "Programs", url: "https://simplelecture.com/programs" }
    ];
    
    if (selectedParentCategory) {
      items.push({
        name: selectedParentCategory.name,
        url: `https://simplelecture.com/programs/${categorySlug}`
      });
    }
    if (selectedSubcategory) {
      items.push({
        name: selectedSubcategory.name,
        url: `https://simplelecture.com/programs/${categorySlug}/${subcategorySlug}`
      });
    }
    if (selectedSubSubcategory) {
      items.push({
        name: selectedSubSubcategory.name,
        url: `https://simplelecture.com/programs/${categorySlug}/${subcategorySlug}/${subSubcategorySlug}`
      });
    }
    
    return generateBreadcrumbSchema(items);
  }, [categorySlug, subcategorySlug, subSubcategorySlug, selectedParentCategory, selectedSubcategory, selectedSubSubcategory]);

  // Only run courses query when categories are loaded (prevents double execution)
  const categoriesReady = !categoriesLoading && (
    !categorySlug || selectedParentCategory !== undefined
  );

  // Fetch courses with server-side pagination and search
  const { data: paginatedData, isLoading: coursesLoading, isFetching } = usePaginatedCourses({
    page: currentPage,
    pageSize: coursesPerPage,
    searchQuery: debouncedSearch,
    categoryId: selectedParentCategory?.id,
    subcategoryId: selectedSubcategory?.id,
    subSubcategoryId: selectedSubSubcategory?.id,
    sortBy,
    enabled: categoriesReady,
  });

  const { courses = [], totalCount = 0, totalPages = 0 } = paginatedData || {};

  // Generate combined structured data (breadcrumb + optional CollectionPage)
  const combinedStructuredData = useMemo(() => {
    const selected = selectedSubSubcategory || selectedSubcategory || selectedParentCategory;
    if (!selected || !courses || courses.length === 0) return breadcrumbSchema;

    const collectionSchema = generateCollectionPageSchema(
      `${selected.name} Courses`,
      canonicalUrl,
      pageDescription,
      courses.map((c: any) => ({
        name: c.name,
        url: `https://simplelecture.com/course/${c.slug}`
      }))
    );

    return {
      "@context": "https://schema.org",
      "@graph": [breadcrumbSchema, collectionSchema]
    };
  }, [breadcrumbSchema, selectedParentCategory, selectedSubcategory, selectedSubSubcategory, courses, canonicalUrl, pageDescription]);

  // Get enrolled course IDs to show "Enrolled" badge
  const { data: enrolledCourseIds } = useEnrolledCourseIds();

  // Navigation helper for path-based routing
  const navigateToCategory = useCallback((category?: string, subcategory?: string, subsubcategory?: string) => {
    const parts = [category, subcategory, subsubcategory].filter(Boolean);
    if (parts.length > 0) {
      navigate(`/programs/${parts.join("/")}`);
    } else {
      navigate("/programs");
    }
  }, [navigate]);

  // Reset page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [debouncedSearch, categorySlug, subcategorySlug, subSubcategorySlug, sortBy]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Update URL with page param
    if (isPathBasedRouting) {
      const newParams = new URLSearchParams(searchParams);
      if (page > 1) {
        newParams.set("page", page.toString());
      } else {
        newParams.delete("page");
      }
      setSearchParams(newParams);
    } else {
      const params = new URLSearchParams();
      if (categorySlug) params.set("category", categorySlug);
      if (subcategorySlug) params.set("subcategory", subcategorySlug);
      if (subSubcategorySlug) params.set("subsubcategory", subSubcategorySlug);
      if (page > 1) params.set("page", page.toString());
      if (debouncedSearch) params.set("q", debouncedSearch);
      setSearchParams(params);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  // Mobile layout
  if (isMobile) {
    return (
      <>
        <SEOHead
          title={pageTitle}
          description={pageDescription}
          keywords={pageKeywords}
          canonicalUrl={canonicalUrl}
          ogImage={DEFAULT_OG_IMAGE}
          structuredData={combinedStructuredData}
        />
        
        {/* Mobile Header */}
        <div className="bg-gradient-to-br from-primary via-primary to-primary px-4 pt-10 pb-6 rounded-b-[1.5rem]">
          <div className="flex items-center gap-3 mb-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/10"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-white text-lg font-bold">
              {selectedSubSubcategory?.name || selectedSubcategory?.name || selectedParentCategory?.name || "Browse Courses"}
            </h1>
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 h-11 bg-white border-0 rounded-full shadow-lg text-foreground placeholder:text-muted-foreground text-sm"
            />
          </div>
        </div>

        <MobileCategorySheet
          categorySlug={categorySlug}
          subcategorySlug={subcategorySlug}
          subSubcategorySlug={subSubcategorySlug}
          selectedParentCategory={selectedParentCategory}
          selectedSubcategory={selectedSubcategory}
          selectedSubSubcategory={selectedSubSubcategory}
          parentCategories={parentCategories}
          subcategories={subcategories}
          subSubcategories={subSubcategories}
          navigateToCategory={navigateToCategory}
        />

        <div className="min-h-screen bg-background pb-24">

          {/* Results Count & Sort */}
          <div className="px-4 flex items-center justify-between mb-3">
            <span className="text-xs text-muted-foreground">
              {isFetching ? "Loading..." : `${totalCount} courses`}
            </span>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="popular">Popular</SelectItem>
                <SelectItem value="price-low">Price ↑</SelectItem>
                <SelectItem value="price-high">Price ↓</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Course List */}
          <div className="px-4 space-y-3">
            {coursesLoading || categoriesLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="flex gap-3 p-2">
                    <Skeleton className="h-20 w-20 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2 py-1">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2 w-1/2" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                </Card>
              ))
            ) : courses.length > 0 ? (
              courses.map((course) => (
                <Link key={course.id} to={`/course/${course.slug}`}>
                  <Card className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99] border-0 shadow-sm">
                    <div className="flex gap-3 p-2">
                      {/* Course Image */}
                      <div className="relative h-20 w-20 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-accent/20">
                        {(course.course_thumbnails?.storage_url || course.thumbnail_url) && (
                          <img
                            src={rewriteStorageUrl(course.course_thumbnails?.storage_url || course.thumbnail_url) || undefined}
                            alt={course.name}
                            className="h-full w-full object-cover"
                          />
                        )}
                        {enrolledCourseIds?.has(course.id) && (
                          <div className="absolute top-1 left-1 bg-green-500 text-white px-1 py-0.5 rounded text-[8px] font-medium">
                            ✓ Enrolled
                          </div>
                        )}
                        {!enrolledCourseIds?.has(course.id) && course.rating && (
                          <div className="absolute top-1 left-1 bg-black/60 text-white px-1 py-0.5 rounded text-[9px] font-medium flex items-center gap-0.5">
                            <Star className="h-2 w-2 fill-yellow-400 text-yellow-400" />
                            {course.rating.toFixed(1)}
                          </div>
                        )}
                      </div>

                      {/* Course Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <h3 className="font-medium text-foreground line-clamp-2 text-xs leading-tight">
                            {course.name}
                          </h3>
                          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">
                            {course.short_description || course.instructor_name || "Expert Instructor"}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {course.price_inr > 0 ? (
                            <>
                              <span className="font-bold text-primary text-sm">
                                {formatINR(course.price_inr)}
                              </span>
                              {course.original_price_inr && course.original_price_inr > course.price_inr && (
                                <span className="text-[10px] text-muted-foreground line-through">
                                  {formatINR(course.original_price_inr)}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="font-bold text-green-600 text-sm">Free</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))
            ) : (
              <Card className="p-8 text-center">
                <p className="font-medium mb-2">No courses found</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Try adjusting your search or filters
                </p>
                <Button 
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    navigateToCategory();
                  }}
                >
                  Clear Filters
                </Button>
              </Card>
            )}
          </div>

          {/* Load More */}
          {totalPages > 1 && currentPage < totalPages && (
            <div className="px-4 py-6 text-center">
              <Button
                variant="outline"
                onClick={() => handlePageChange(currentPage + 1)}
                className="w-full"
              >
                Load More
              </Button>
            </div>
          )}
        </div>

        <BottomNav />
      </>
    );
  }

  // Desktop layout
  return (
    <>
      <SEOHead
        title={pageTitle}
        description={pageDescription}
        keywords={pageKeywords}
        canonicalUrl={canonicalUrl}
        ogImage={DEFAULT_OG_IMAGE}
        structuredData={combinedStructuredData}
      />
      <SmartHeader />
      
      <main className="min-h-screen bg-background">
        {/* Breadcrumb - Hidden on mobile, visible on md+ */}
        <div className="bg-muted/30 border-b hidden md:block">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-primary transition-colors flex items-center gap-1">
                <Home className="h-4 w-4" />
                Home
              </Link>
              <ChevronRightIcon className="h-4 w-4" />
              {selectedParentCategory ? (
                <Link to="/programs" className="hover:text-primary transition-colors">
                  Programs
                </Link>
              ) : (
                <span className="text-foreground font-medium">Programs</span>
              )}
              {selectedParentCategory && (
                <>
                  <ChevronRightIcon className="h-4 w-4" />
                  {selectedSubcategory ? (
                    <Link 
                      to={`/programs/${categorySlug}`} 
                      className="hover:text-primary transition-colors"
                    >
                      {selectedParentCategory.name}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium">{selectedParentCategory.name}</span>
                  )}
                </>
              )}
              {selectedSubcategory && (
                <>
                  <ChevronRightIcon className="h-4 w-4" />
                  {selectedSubSubcategory ? (
                    <Link 
                      to={`/programs/${categorySlug}/${subcategorySlug}`}
                      className="hover:text-primary transition-colors"
                    >
                      {selectedSubcategory.name}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium">{selectedSubcategory.name}</span>
                  )}
                </>
              )}
              {selectedSubSubcategory && (
                <>
                  <ChevronRightIcon className="h-4 w-4" />
                  <span className="text-foreground font-medium">{selectedSubSubcategory.name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-6 md:py-8">
          <div className="container mx-auto px-4">
            <h1 className="text-2xl md:text-4xl font-bold mb-2">
              {selectedSubSubcategory?.name || selectedSubcategory?.name || selectedParentCategory?.name || "All Programs"}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {selectedSubSubcategory?.description || selectedSubcategory?.description || selectedParentCategory?.description || 
               "Explore our comprehensive courses designed for your success"}
            </p>
          </div>
        </div>

        {/* Category AI Content + Trust Badges */}
        {selectedParentCategory && (
          <>
            <CategoryAIContent categoryName={selectedParentCategory.name} />
            <div className="container mx-auto px-4">
              <ProgramsTrustBadges />
            </div>
          </>
        )}

        {/* Category Navigation */}
        {!categorySlug && (
          <div className="container mx-auto px-4 py-8">
            <h2 className="text-2xl font-semibold mb-6">Browse by Category</h2>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto gap-2 bg-muted/50 p-2">
                <TabsTrigger 
                  value="all"
                  onClick={() => navigateToCategory()}
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                >
                  All Programs
                </TabsTrigger>
                {parentCategories.map((category) => (
                  <TabsTrigger
                    key={category.id}
                    value={category.slug}
                    onClick={() => navigateToCategory(category.slug)}
                    className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <span className="mr-2">{category.icon}</span>
                    {category.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Subcategory Cards (Level 2) */}
        {categorySlug && !subcategorySlug && subcategories.length > 0 && (
          <div className="container mx-auto px-4 py-8">
            <h2 className="text-2xl font-semibold mb-6">Choose Subcategory</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2"
                onClick={() => navigateToCategory(categorySlug)}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-3">📚</div>
                  <p className="font-semibold text-sm">All</p>
                  <p className="text-xs text-muted-foreground mt-1">View all courses</p>
                </CardContent>
              </Card>
              {subcategories.map((subcat) => (
                <Card
                  key={subcat.id}
                  className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 hover:border-primary"
                  onClick={() => navigateToCategory(categorySlug, subcat.slug)}
                >
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl mb-3">{subcat.icon || "📖"}</div>
                    <p className="font-semibold text-sm">{subcat.name}</p>
                    {subcat.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {subcat.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Sub-Subcategory Cards (Level 3) */}
        {categorySlug && subcategorySlug && !subSubcategorySlug && subSubcategories.length > 0 && (
          <div className="container mx-auto px-4 py-8">
            <h2 className="text-2xl font-semibold mb-6">Choose Specific Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2"
                onClick={() => navigateToCategory(categorySlug, subcategorySlug)}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-3">📚</div>
                  <p className="font-semibold text-sm">All</p>
                  <p className="text-xs text-muted-foreground mt-1">View all {selectedSubcategory?.name}</p>
                </CardContent>
              </Card>
              {subSubcategories.map((subsubcat) => (
                <Card
                  key={subsubcat.id}
                  className="cursor-pointer hover:shadow-lg transition-all hover:scale-105 border-2 hover:border-primary"
                  onClick={() => navigateToCategory(categorySlug, subcategorySlug, subsubcat.slug)}
                >
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl mb-3">{subsubcat.icon || "📖"}</div>
                    <p className="font-semibold text-sm">{subsubcat.name}</p>
                    {subsubcat.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {subsubcat.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Filters & Search */}
        <div className="container mx-auto px-4 py-4 md:py-6">
          <div className="flex flex-col gap-3 md:gap-4 mb-4 md:mb-6">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search courses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="flex gap-2 md:gap-4 items-center justify-between">
              <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">
                {isFetching ? "Loading..." : `${totalCount} courses`}
              </span>
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[140px] md:w-[180px] text-xs md:text-sm">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="popular">Most Popular</SelectItem>
                  <SelectItem value="price-low">Price: Low to High</SelectItem>
                  <SelectItem value="price-high">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Course Grid */}
          {coursesLoading || categoriesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </Card>
              ))}
            </div>
          ) : courses.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                {courses.map((course) => (
                  <Link key={course.id} to={`/course/${course.slug}`}>
                    <Card className="h-full overflow-hidden hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer">
                      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20">
                        {(course.course_thumbnails?.storage_url || course.thumbnail_url) && (
                          <img
                          src={rewriteStorageUrl(course.course_thumbnails?.storage_url || course.thumbnail_url) || undefined}
                            alt={course.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                        {enrolledCourseIds?.has(course.id) ? (
                          <Badge className="absolute top-3 right-3 bg-green-500">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Enrolled
                          </Badge>
                        ) : course.price_inr === 0 ? (
                          <Badge className="absolute top-3 right-3 bg-green-500">Free</Badge>
                        ) : null}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-lg mb-2 line-clamp-2">{course.name}</h3>
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {course.short_description || course.detailed_description}
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
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((pageNum, idx) => (
                      pageNum === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">...</span>
                      ) : (
                        <Button
                          key={pageNum}
                          variant={currentPage === pageNum ? "default" : "outline"}
                          size="sm"
                          onClick={() => handlePageChange(pageNum as number)}
                        >
                          {pageNum}
                        </Button>
                      )
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Card className="p-12 text-center">
              <p className="text-xl font-semibold mb-2">No courses found</p>
              <p className="text-muted-foreground mb-6">
                Try adjusting your search or filters
              </p>
              <Button onClick={() => {
                setSearchQuery("");
                navigateToCategory();
                setCurrentPage(1);
              }}>
                Clear All Filters
              </Button>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
};

export default Programs;
