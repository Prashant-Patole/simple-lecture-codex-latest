import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ArrowLeft } from "lucide-react";
import { ImageUploadWidget } from "@/components/admin/ImageUploadWidget";
import { AIImageGenerator } from "@/components/admin/AIImageGenerator";
import { Label } from "@/components/ui/label";
import {
  useAdminCategories,
  useAdminCategory,
  useCreateCategory,
  useUpdateCategory,
} from "@/hooks/useAdminCategories";
import { useAdminExploreByGoal } from "@/hooks/useAdminExploreByGoal";
import { SearchableCategorySelector } from "@/components/admin/SearchableCategorySelector";
import { useUploadCategoryIcon } from "@/hooks/useUploadCategoryIcon";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  icon: z.string().optional(),
  description: z.string().max(500).optional(),
  parent_id: z.string().optional(),
  level: z.number().int().min(1).max(3),
  display_order: z.number().int().min(0).default(0),
  is_popular: z.boolean().default(false),
  is_active: z.boolean().default(true),
  goal_ids: z.array(z.string()).optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function CategoryForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const { data: categories } = useAdminCategories();
  const { data: category } = useAdminCategory(id);
  const { data: goals } = useAdminExploreByGoal();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const { uploadIcon, isUploading: isUploadingIcon } = useUploadCategoryIcon();

  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      icon: "",
      description: "",
      parent_id: "none",
      level: 1,
      display_order: 0,
      is_popular: false,
      is_active: true,
      goal_ids: [],
    },
  });

  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        slug: category.slug,
        icon: category.icon || "",
        description: category.description || "",
        parent_id: category.parent_id || "none",
        level: category.level,
        display_order: category.display_order,
        is_popular: category.is_popular,
        is_active: category.is_active,
        goal_ids: category.goal_ids || [],
      });
      setSelectedGoals(category.goal_ids || []);
    }
  }, [category, form]);

  // Auto-generate slug from name
  const nameValue = form.watch("name");
  useEffect(() => {
    if (nameValue && !isEdit) {
      const slug = nameValue
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      form.setValue("slug", slug);
    }
  }, [nameValue, isEdit, form]);

  // Auto-calculate level based on parent
  const parentId = form.watch("parent_id");
  useEffect(() => {
    if (parentId && parentId !== "none" && categories) {
      const parent = categories.find((c) => c.id === parentId);
      if (parent) {
        form.setValue("level", parent.level + 1);
      }
    } else {
      form.setValue("level", 1);
    }
  }, [parentId, categories, form]);

  const onSubmit = (data: FormData) => {
    const categoryData = {
      ...data,
      parent_id: data.parent_id === "none" ? null : data.parent_id,
      goal_ids: selectedGoals,
    };

    if (isEdit && id) {
      updateCategory.mutate(
        { id, ...categoryData },
        {
          onSuccess: () => navigate("/admin/categories"),
        }
      );
    } else {
      createCategory.mutate(categoryData as any, {
        onSuccess: () => navigate("/admin/categories"),
      });
    }
  };

  const level = form.watch("level");
  
  // Filter parent categories: exclude self and allow any other category
  // (descendants will be prevented by level auto-calculation)
  const parentCategories = categories?.filter((c) => {
    if (isEdit && id && c.id === id) return false; // Can't be own parent
    return true;
  });

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/categories")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEdit ? "Edit Category" : "Add Category"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Update category details" : "Create a new category"}
          </p>
        </div>
      </div>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Board Exams" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., board-exams" {...field} />
                    </FormControl>
                    <FormDescription>
                      URL-friendly identifier (auto-generated from name)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

                  <FormField
                    control={form.control}
                    name="icon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Icon (Emoji or Image URL)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 📚 🩺 ⚙️ 🎯 or image URL" {...field} />
                        </FormControl>
                        <FormDescription>
                          Use emoji or provide an image URL
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Image Upload Section */}
                  <div className="space-y-4">
                    <Label>Category Image (Optional)</Label>
                    <ImageUploadWidget
                      label=""
                      value={form.watch("icon")?.startsWith("http") ? form.watch("icon") : ""}
                      onChange={(url) => form.setValue("icon", url || "")}
                      onFileSelect={async (file) => {
                        const url = await uploadIcon(file, id);
                        return url;
                      }}
                    />
                    {isUploadingIcon && (
                      <p className="text-sm text-muted-foreground">Uploading icon...</p>
                    )}
                  </div>

                  {/* AI Image Generation */}
                  <div className="space-y-2">
                    <Label>Or Generate with AI</Label>
                    <AIImageGenerator
                      suggestedPrompt={`Icon representing ${form.watch("name") || "category"}, ${form.watch("description") || ""}, minimalist, modern, educational by Simple Lecture`}
                      onImageGenerated={(url) => form.setValue("icon", url)}
                    />
                  </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of this category..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hierarchy & Organization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="parent_id"
                render={({ field }) => (
                  <FormItem>
                    <SearchableCategorySelector
                      value={field.value || "none"}
                      onChange={field.onChange}
                      label="Parent Category"
                      placeholder="Search parent category (optional)"
                      showNoneOption
                      noneOptionLabel="None (Top Level)"
                      excludeId={id}
                    />
                    <FormDescription>
                      Leave empty for top-level category
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                        disabled
                      />
                    </FormControl>
                    <FormDescription>
                      Auto-calculated based on parent selection
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="display_order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription>
                      Lower numbers appear first
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Explore by Goal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {goals?.map((goal) => (
                  <div key={goal.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={goal.id}
                      checked={selectedGoals.includes(goal.id)}
                      onCheckedChange={(checked) => {
                        setSelectedGoals(
                          checked
                            ? [...selectedGoals, goal.id]
                            : selectedGoals.filter((id) => id !== goal.id)
                        );
                      }}
                    />
                    <label
                      htmlFor={goal.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {goal.icon} {goal.name}
                    </label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="is_popular"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Popular Category</FormLabel>
                      <FormDescription>
                        Mark this as a popular/featured category
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Make this category visible to users
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <Button
              type="submit"
              disabled={createCategory.isPending || updateCategory.isPending}
            >
              {isEdit ? "Update Category" : "Create Category"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/admin/categories")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
