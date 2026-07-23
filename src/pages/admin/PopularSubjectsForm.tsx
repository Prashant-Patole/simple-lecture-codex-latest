import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  useAdminSubject,
  useCreateSubject,
  useUpdateSubject,
} from "@/hooks/useAdminPopularSubjects";
import { SearchableCategorySelector } from "@/components/admin/SearchableCategorySelector";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z.string().min(1, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  description: z.string().max(500).optional(),
  category_id: z.string().min(1, "Category is required"),
  display_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

export default function PopularSubjectsForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const { data: subject } = useAdminSubject(id);
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      category_id: "",
      display_order: 0,
      is_active: true,
    },
  });

  useEffect(() => {
    if (subject) {
      const subjectData = subject as any;
      form.reset({
        name: subject.name,
        slug: subject.slug,
        description: subject.description || "",
        category_id: subjectData.category_id || "",
        display_order: subject.display_order,
        is_active: subject.is_active,
      });
    }
  }, [subject, form]);

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

  const onSubmit = (data: FormData) => {
    if (isEdit && id) {
      updateSubject.mutate(
        { id, ...data },
        {
          onSuccess: () => navigate("/admin/popular-subjects"),
        }
      );
    } else {
      createSubject.mutate(data as any, {
        onSuccess: () => navigate("/admin/popular-subjects"),
      });
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/popular-subjects")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">
            {isEdit ? "Edit Subject" : "Add Subject"}
          </h1>
          <p className="text-muted-foreground">
            {isEdit ? "Update subject details" : "Create a new popular subject"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Subject Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Physics (NEET/JEE)" {...field} />
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
                      <Input placeholder="e.g., physics-neet-jee" {...field} />
                    </FormControl>
                    <FormDescription>
                      URL-friendly identifier
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <SearchableCategorySelector
                      value={field.value}
                      onChange={field.onChange}
                      label="Category *"
                      placeholder="Search and select a category"
                    />
                    <FormDescription>
                      Choose the primary category for this subject
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of this subject..."
                        {...field}
                      />
                    </FormControl>
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

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <FormDescription>
                        Make this subject visible to users
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

          <div className="flex items-center gap-4">
            <Button
              type="submit"
              disabled={createSubject.isPending || updateSubject.isPending}
            >
              {isEdit ? "Update Subject" : "Create Subject"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/admin/popular-subjects")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
