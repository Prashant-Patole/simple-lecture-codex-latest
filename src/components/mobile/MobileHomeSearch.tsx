import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, X, SlidersHorizontal, Loader2, FolderOpen, BookOpen, ArrowRight } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchCourses } from "@/hooks/usePaginatedCourses";
import { supabase } from "@/integrations/supabase/client";
import { formatINR } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";

export const MobileHomeSearch = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(searchQuery, 300);

  // Course search
  const { data: courseResults, isLoading: coursesLoading } = useSearchCourses(debouncedQuery, 6);

  // Category search
  const { data: categoryResults, isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories-search", debouncedQuery],
    queryFn: async () => {
      const search = `%${debouncedQuery.trim()}%`;
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, level")
        .eq("is_active", true)
        .ilike("name", search)
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 60000,
  });

  // Category list for bottom sheet
  const { data: allCategories } = useQuery({
    queryKey: ["categories-level1"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug, icon")
        .eq("is_active", true)
        .eq("level", 1)
        .order("display_order");
      if (error) throw error;
      return data || [];
    },
    staleTime: 300000,
  });

  const isSearching = debouncedQuery.trim().length >= 2;
  const isLoading = coursesLoading || categoriesLoading;
  const hasResults = (courseResults && courseResults.length > 0) || (categoryResults && categoryResults.length > 0);

  // Show results when we have a debounced query
  useEffect(() => {
    setShowResults(isSearching);
  }, [isSearching]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/programs?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setShowResults(false);
    }
  };

  const handleCategoryClick = (slug: string) => {
    navigate(`/programs?category=${slug}`);
    setShowResults(false);
    setSearchQuery("");
    setDrawerOpen(false);
  };

  const handleCourseClick = (slug: string) => {
    navigate(`/enroll/${slug}`);
    setShowResults(false);
    setSearchQuery("");
  };

  const levelLabel = (level: number) => {
    if (level === 1) return "Category";
    if (level === 2) return "Subcategory";
    return "Sub-subcategory";
  };

  return (
    <div ref={containerRef} className="relative">
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search courses, categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 pr-10 h-11 bg-white border-0 rounded-full shadow-lg text-foreground placeholder:text-muted-foreground text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(""); setShowResults(false); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors flex-shrink-0"
          aria-label="Browse categories"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </form>

      {/* Live Search Results Dropdown */}
      {showResults && (
        <div className="absolute left-0 right-12 top-full mt-2 bg-background rounded-xl shadow-xl border z-50 max-h-80 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && !hasResults && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results for "{debouncedQuery}"
            </div>
          )}

          {!isLoading && hasResults && (
            <>
              {/* Category matches */}
              {categoryResults && categoryResults.length > 0 && (
                <div className="p-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Categories</p>
                  {categoryResults.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => handleCategoryClick(cat.slug)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-accent text-left transition-colors"
                    >
                      <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{cat.name}</p>
                        <p className="text-[10px] text-muted-foreground">{levelLabel(cat.level)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Course matches */}
              {courseResults && courseResults.length > 0 && (
                <div className="p-2 border-t">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Courses</p>
                  {courseResults.map((course) => (
                    <button
                      key={course.id}
                      onClick={() => handleCourseClick(course.slug)}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-accent text-left transition-colors"
                    >
                      <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{course.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatINR(course.price_inr || 0)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* View all */}
              <button
                onClick={() => {
                  navigate(`/programs?q=${encodeURIComponent(searchQuery.trim())}`);
                  setSearchQuery("");
                  setShowResults(false);
                }}
                className="w-full flex items-center justify-center gap-1.5 py-3 border-t text-sm font-medium text-primary hover:bg-accent transition-colors"
              >
                View all results
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Category Bottom Sheet */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Browse Categories</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 grid grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto">
            {allCategories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategoryClick(cat.slug)}
                className="flex items-center gap-2 p-3 rounded-xl border bg-background hover:bg-accent text-left transition-colors"
              >
                {cat.icon ? (
                  <span className="text-lg">{cat.icon}</span>
                ) : (
                  <FolderOpen className="h-4 w-4 text-primary" />
                )}
                <span className="text-sm font-medium text-foreground truncate">{cat.name}</span>
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
