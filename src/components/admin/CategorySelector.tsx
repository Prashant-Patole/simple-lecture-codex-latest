import { SearchableCategorySelector } from "./SearchableCategorySelector";

interface CategorySelectorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  showAllOption?: boolean;
  allOptionLabel?: string;
  disabled?: boolean;
}

/**
 * CategorySelector Component
 * 
 * A reusable searchable dropdown component for selecting categories with hierarchical display.
 * Categories are shown in "Child - Parent - Grandparent" format, supporting unlimited nesting levels.
 * 
 * @example
 * ```tsx
 * <CategorySelector
 *   value={categoryId}
 *   onChange={setCategoryId}
 *   label="Category"
 *   placeholder="Select a category"
 * />
 * ```
 * 
 * @example With "All" option
 * ```tsx
 * <CategorySelector
 *   value={categoryId}
 *   onChange={setCategoryId}
 *   showAllOption
 *   allOptionLabel="All Categories"
 * />
 * ```
 */
export const CategorySelector = ({
  value,
  onChange,
  label = "Category",
  placeholder = "Select category",
  showAllOption = false,
  allOptionLabel = "All",
  disabled = false,
}: CategorySelectorProps) => {
  return (
    <SearchableCategorySelector
      value={value}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
      showAllOption={showAllOption}
      allOptionLabel={allOptionLabel}
      disabled={disabled}
    />
  );
};
