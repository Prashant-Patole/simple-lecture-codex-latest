# Category Dropdown Implementation Guide

## Overview
This guide explains how to implement multi-level hierarchical category dropdowns across the application. Categories are displayed in "Child - Parent - Grandparent" format.

## Quick Start - Using CategorySelector Component (Recommended)

The easiest way to add a category dropdown is to use the pre-built `CategorySelector` component:

```typescript
import { CategorySelector } from "@/components/admin/CategorySelector";

// Basic usage
<CategorySelector
  value={categoryId}
  onChange={setCategoryId}
  label="Category"
  placeholder="Select a category"
/>

// With "All" option
<CategorySelector
  value={categoryId}
  onChange={setCategoryId}
  label="Category"
  showAllOption
  allOptionLabel="All Categories"
/>

// Disabled state
<CategorySelector
  value={categoryId}
  onChange={setCategoryId}
  disabled={!someCondition}
/>
```

### CategorySelector Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | required | Selected category ID |
| `onChange` | `(value: string) => void` | required | Callback when selection changes |
| `label` | `string` | `"Category"` | Label text above dropdown |
| `placeholder` | `string` | `"Select category"` | Placeholder text |
| `showAllOption` | `boolean` | `false` | Show "All" option at top |
| `allOptionLabel` | `string` | `"All"` | Label for "All" option |
| `disabled` | `boolean` | `false` | Disable the dropdown |

## Manual Implementation (Advanced)

If you need custom behavior, you can implement manually:

### 1. Import Required Functions
```typescript
import { useAdminCategories, getCategoryHierarchyDisplay } from "@/hooks/useAdminCategories";
```

### 2. Fetch Categories Data
```typescript
const { data: categories } = useAdminCategories();
```

### 3. Display in Dropdown
```typescript
<Select value={categoryId} onValueChange={setCategoryId}>
  <SelectTrigger>
    <SelectValue placeholder="Select a category" />
  </SelectTrigger>
  <SelectContent className="bg-background z-50">
    {categories?.map((category) => (
      <SelectItem key={category.id} value={category.id}>
        {getCategoryHierarchyDisplay(category.id, categories)}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 4. Display Selected Category (outside dropdown)
```typescript
const getCategoryDisplay = (categoryId: string) => {
  if (!categories) return "";
  return getCategoryHierarchyDisplay(categoryId, categories);
};

// Usage
<div>{getCategoryDisplay(selectedCategoryId)}</div>
```

## How It Works

The `getCategoryHierarchyDisplay` function:
- Recursively traverses up the category tree using `parent_id`
- Builds a path like: `["NEET UG", "Medical Entrance", "Board Exams"]`
- Joins with " - " separator to create: `"NEET UG - Medical Entrance - Board Exams"`
- For top-level categories with no parent, displays just the name: `"Board Exams"`

## Examples

### Example 1: Single Parent
```
Category: NEET UG
Parent: Medical Entrance
Display: "NEET UG - Medical Entrance"
```

### Example 2: Multiple Levels
```
Category: PUC + NEET
Parent: NEET UG
Grandparent: Medical Entrance
Great-grandparent: Board Exams
Display: "PUC + NEET - NEET UG - Medical Entrance - Board Exams"
```

### Example 3: Top Level (No Parent)
```
Category: Board Exams
Parent: None
Display: "Board Exams"
```

## Pages Already Updated

1. ✅ `/admin/subjects/:id/edit` - SubjectForm.tsx
2. ✅ `/admin/courses/:id/edit` (Categories Tab) - CourseCategoriesTab.tsx
3. ✅ `/admin/categories/:id/edit` - CategoryForm.tsx
4. ✅ `/admin/hr/instructors/:id` - InstructorSubjectMapper.tsx
5. ✅ `/admin/enroll-student` - EnrollStudentDialog.tsx
6. ✅ `/admin/excel-import` - EnhancedExcelImportModal.tsx
7. ✅ `/admin/question-bank` - QuestionBank.tsx
8. ✅ `/admin/academics/timetable` - AcademicsTimetable.tsx

## Reusable Component Created

✅ **CategorySelector** - `src/components/admin/CategorySelector.tsx`  
A pre-built, reusable component that handles all the complexity for you.

## Pages That May Need Updating (Low Priority)

### Public-facing
- `/programs` - ExploreProgramsSection.tsx (consider UX for public users - may want simplified display)

## Implementation Checklist for New Pages

When you encounter a category dropdown, follow these steps:

1. [ ] Import `useAdminCategories` and `getCategoryHierarchyDisplay`
2. [ ] Replace inline display logic with `getCategoryHierarchyDisplay()`
3. [ ] Ensure `SelectContent` has `className="bg-background z-50"` for proper styling
4. [ ] Test with multi-level categories (3+ levels)
5. [ ] Test with top-level categories (no parent)

## Common Patterns

### Pattern 1: Simple Dropdown
```typescript
<SelectContent className="bg-background z-50">
  {categories?.map((cat) => (
    <SelectItem key={cat.id} value={cat.id}>
      {getCategoryHierarchyDisplay(cat.id, categories)}
    </SelectItem>
  ))}
</SelectContent>
```

### Pattern 2: Filtered Dropdown (exclude current item)
```typescript
const filteredCategories = categories?.filter(c => c.id !== currentId);

<SelectContent className="bg-background z-50">
  {filteredCategories?.map((cat) => (
    <SelectItem key={cat.id} value={cat.id}>
      {getCategoryHierarchyDisplay(cat.id, categories)} (Level {cat.level})
    </SelectItem>
  ))}
</SelectContent>
```

### Pattern 3: Display in Badge/Label
```typescript
<Badge>
  {getCategoryHierarchyDisplay(categoryId, categories)}
</Badge>
```

## Troubleshooting

### Issue: "Cannot read property 'id' of undefined"
**Solution:** Add null checks:
```typescript
const getCategoryDisplay = (categoryId: string) => {
  if (!categories) return "";
  return getCategoryHierarchyDisplay(categoryId, categories);
};
```

### Issue: Dropdown showing old format
**Solution:** Ensure you're importing `getCategoryHierarchyDisplay` and not using inline logic like:
```typescript
// ❌ Old way (only shows immediate parent)
{cat.parent_name ? `${cat.name} - ${cat.parent_name}` : cat.name}

// ✅ New way (shows full hierarchy)
{getCategoryHierarchyDisplay(cat.id, categories)}
```

### Issue: Dropdown is transparent
**Solution:** Add `className="bg-background z-50"` to `SelectContent`:
```typescript
<SelectContent className="bg-background z-50">
```

## Testing

Test with these scenarios:
1. Top-level category (Board Exams)
2. Two-level category (NEET UG - Medical Entrance)
3. Three-level category (PUC + NEET - NEET UG - Medical Entrance)
4. Four-level category (if exists in your data)

Expected behavior:
- All levels shown in reverse order (child first)
- Separated by " - "
- No trailing or leading " - "
- No "undefined" in display
