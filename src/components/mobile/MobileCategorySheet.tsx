import { useState } from "react";
import { ArrowLeft, SlidersHorizontal, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CategoryIcon } from "@/components/CategoryIcon";

interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  [key: string]: unknown;
}

interface MobileCategorySheetProps {
  categorySlug: string | null;
  subcategorySlug: string | null;
  subSubcategorySlug: string | null;
  selectedParentCategory: CategoryItem | null | undefined;
  selectedSubcategory: CategoryItem | null | undefined;
  selectedSubSubcategory: CategoryItem | null | undefined;
  parentCategories: CategoryItem[];
  subcategories: CategoryItem[];
  subSubcategories: CategoryItem[];
  navigateToCategory: (category?: string, subcategory?: string, subsubcategory?: string) => void;
}

export const MobileCategorySheet = ({
  categorySlug,
  subcategorySlug,
  subSubcategorySlug,
  selectedParentCategory,
  selectedSubcategory,
  selectedSubSubcategory,
  parentCategories,
  subcategories,
  subSubcategories,
  navigateToCategory,
}: MobileCategorySheetProps) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  // Track drill-down inside the sheet: 1 = level1, 2 = level2, 3 = level3
  const [sheetLevel, setSheetLevel] = useState<1 | 2 | 3>(1);
  const [sheetParent, setSheetParent] = useState<CategoryItem | null>(null);
  const [sheetGrandparent, setSheetGrandparent] = useState<CategoryItem | null>(null);

  // Build breadcrumb text
  const breadcrumbText = (() => {
    if (selectedSubSubcategory) {
      return `${selectedParentCategory?.name} › ${selectedSubcategory?.name} › ${selectedSubSubcategory.name}`;
    }
    if (selectedSubcategory) {
      return `${selectedParentCategory?.name} › ${selectedSubcategory.name}`;
    }
    if (selectedParentCategory) {
      return selectedParentCategory.name;
    }
    return "All Categories";
  })();

  const handleOpenSheet = () => {
    // Open sheet at the appropriate level based on current selection
    if (subcategorySlug && selectedSubcategory && subSubcategories.length > 0) {
      setSheetLevel(3);
      setSheetGrandparent(selectedParentCategory || null);
      setSheetParent(selectedSubcategory || null);
    } else if (categorySlug && selectedParentCategory && subcategories.length > 0) {
      setSheetLevel(2);
      setSheetParent(selectedParentCategory || null);
      setSheetGrandparent(null);
    } else {
      setSheetLevel(1);
      setSheetParent(null);
      setSheetGrandparent(null);
    }
    setSheetOpen(true);
  };

  const handleCategorySelect = (cat: CategoryItem, level: 1 | 2 | 3) => {
    if (level === 1) {
      // Check if this category has subcategories
      const hasChildren = subcategories.length > 0 && selectedParentCategory?.id === cat.id
        ? true
        : parentCategories.some(p => p.id === cat.id); // We need to drill in
      // Always drill into level 1 to show subcategories
      setSheetParent(cat);
      setSheetLevel(2);
      // Temporarily navigate to set subcategories
      navigateToCategory(cat.slug);
    } else if (level === 2) {
      // Drill into level 3 or close
      setSheetGrandparent(sheetParent);
      setSheetParent(cat);
      setSheetLevel(3);
      navigateToCategory(
        sheetParent?.slug || categorySlug || undefined,
        cat.slug
      );
    } else {
      // Level 3 - close and navigate
      setSheetOpen(false);
      navigateToCategory(
        sheetGrandparent?.slug || categorySlug || undefined,
        sheetParent?.slug || subcategorySlug || undefined,
        cat.slug
      );
    }
  };

  const handleSelectAll = () => {
    setSheetOpen(false);
    if (sheetLevel === 1) {
      navigateToCategory();
    } else if (sheetLevel === 2 && sheetParent) {
      navigateToCategory(sheetParent.slug);
    } else if (sheetLevel === 3 && sheetGrandparent && sheetParent) {
      navigateToCategory(sheetGrandparent.slug, sheetParent.slug);
    }
  };

  const handleBack = () => {
    if (sheetLevel === 3) {
      setSheetLevel(2);
      setSheetParent(sheetGrandparent);
      setSheetGrandparent(null);
      if (sheetGrandparent) {
        navigateToCategory(sheetGrandparent.slug);
      }
    } else if (sheetLevel === 2) {
      setSheetLevel(1);
      setSheetParent(null);
      navigateToCategory();
    }
  };

  // Determine which items to show in the grid
  const getSheetItems = (): CategoryItem[] => {
    if (sheetLevel === 1) {
      // Pin Board Exams (SSLC) to the top, keep other order intact
      const boardSlug = "board-exams-sslc";
      const sorted = [...parentCategories].sort((a, b) => {
        if (a.slug === boardSlug && b.slug !== boardSlug) return -1;
        if (b.slug === boardSlug && a.slug !== boardSlug) return 1;
        return 0;
      });
      return sorted;
    }
    if (sheetLevel === 2) return subcategories;
    if (sheetLevel === 3) return subSubcategories;
    return [];
  };

  const sheetTitle = (() => {
    if (sheetLevel === 3 && sheetParent) return sheetParent.name;
    if (sheetLevel === 2 && sheetParent) return sheetParent.name;
    return "Select Category";
  })();

  const currentSlug = (() => {
    if (sheetLevel === 3) return subSubcategorySlug;
    if (sheetLevel === 2) return subcategorySlug;
    return categorySlug;
  })();

  const items = getSheetItems();

  return (
    <>
      {/* Compact breadcrumb bar */}
      <div className="px-4 py-3">
        <button
          onClick={handleOpenSheet}
          className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-card shadow-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            {selectedParentCategory && (
              <CategoryIcon icon={selectedParentCategory.icon} size="sm" />
            )}
            <span className="text-sm font-medium text-foreground truncate">
              {breadcrumbText}
            </span>
          </div>
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </button>
      </div>

      {/* Bottom Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh]">
          <SheetHeader className="pb-2">
            <div className="flex items-center gap-2">
              {sheetLevel > 1 && (
                <button
                  onClick={handleBack}
                  className="p-1 rounded-md hover:bg-accent"
                >
                  <ArrowLeft className="h-4 w-4 text-foreground" />
                </button>
              )}
              <SheetTitle className="text-base">{sheetTitle}</SheetTitle>
            </div>
          </SheetHeader>

          <div className="overflow-y-auto max-h-[55vh] pb-4">
            {/* "All" option */}
            <button
              onClick={handleSelectAll}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-3 text-sm font-medium transition-colors ${
                !currentSlug
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-foreground hover:bg-accent"
              }`}
            >
              <span className="text-base">✨</span>
              {sheetLevel === 1
                ? "All Categories"
                : `All ${sheetParent?.name || ""}`}
            </button>

            {/* 2-column grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {items.map((item) => {
                const isSelected = currentSlug === item.slug;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleCategorySelect(item, sheetLevel)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card hover:bg-accent hover:border-accent"
                    }`}
                  >
                    <CategoryIcon icon={item.icon} size="lg" alt={item.name} />
                    <span className="text-xs font-medium leading-tight line-clamp-2">
                      {item.name}
                    </span>
                    {sheetLevel < 3 && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
