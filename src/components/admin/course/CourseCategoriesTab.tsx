import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAdminCategories, getCategoryHierarchyDisplay } from "@/hooks/useAdminCategories";
import { X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SearchableCategorySelector } from "@/components/admin/SearchableCategorySelector";

interface CourseCategoriesTabProps {
  selectedCategories: string[];
  onChange: (categories: string[]) => void;
}

export const CourseCategoriesTab = ({ selectedCategories, onChange }: CourseCategoriesTabProps) => {
  const { data: categories } = useAdminCategories();
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const addCategory = () => {
    if (selectedCategoryId && !selectedCategories.includes(selectedCategoryId)) {
      onChange([...selectedCategories, selectedCategoryId]);
      setSelectedCategoryId("");
    }
  };

  const removeCategory = (categoryId: string) => {
    onChange(selectedCategories.filter(id => id !== categoryId));
  };

  const getCategoryDisplay = (categoryId: string) => {
    if (!categories) return "";
    return getCategoryHierarchyDisplay(categoryId, categories);
  };

  return (
    <div className="space-y-6">
      <div>
        <Label>Add Category</Label>
        <div className="flex gap-2 mt-2 items-end">
          <div className="flex-1">
            <SearchableCategorySelector
              value={selectedCategoryId}
              onChange={setSelectedCategoryId}
              placeholder="Search and select a category"
            />
          </div>
          <Button onClick={addCategory} type="button">Add</Button>
        </div>
      </div>

      <div>
        <Label>Selected Categories</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {selectedCategories.length === 0 && (
            <p className="text-sm text-muted-foreground">No categories selected</p>
          )}
          {selectedCategories.map((categoryId) => (
            <Badge key={categoryId} variant="secondary" className="flex items-center gap-1">
              {getCategoryDisplay(categoryId)}
              <button
                onClick={() => removeCategory(categoryId)}
                className="ml-1 hover:bg-background rounded-full"
                type="button"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
};