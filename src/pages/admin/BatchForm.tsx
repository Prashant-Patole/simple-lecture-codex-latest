import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useAdminBatch, useCreateBatch, useUpdateBatch } from "@/hooks/useAdminBatches";
import { useCourses } from "@/hooks/useCourses";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  name: z.string().min(1, "Batch name is required"),
  course_id: z.string().min(1, "Course is required"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().optional(),
  max_students: z.coerce.number().min(0).optional(),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

export default function BatchForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: batch, isLoading: batchLoading } = useAdminBatch(id);
  const { data: courses } = useCourses();
  const createBatch = useCreateBatch();
  const updateBatch = useUpdateBatch();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      course_id: "",
      start_date: "",
      end_date: "",
      max_students: undefined,
      is_active: true,
    },
  });

  useEffect(() => {
    if (batch && isEdit) {
      form.reset({
        name: batch.name,
        course_id: batch.course_id,
        start_date: batch.start_date,
        end_date: batch.end_date || "",
        max_students: batch.max_students || undefined,
        is_active: batch.is_active,
      });
    }
  }, [batch, isEdit, form]);

  const onSubmit = (data: FormData) => {
    if (isEdit && id) {
      updateBatch.mutate(
        {
          id,
          name: data.name,
          course_id: data.course_id,
          start_date: data.start_date,
          end_date: data.end_date || undefined,
          max_students: data.max_students || undefined,
          is_active: data.is_active,
        },
        {
          onSuccess: () => navigate("/admin/batches"),
        }
      );
    } else {
      createBatch.mutate(
        {
          name: data.name,
          course_id: data.course_id,
          start_date: data.start_date,
          end_date: data.end_date || undefined,
          max_students: data.max_students || undefined,
          is_active: data.is_active,
        },
        {
          onSuccess: () => navigate("/admin/batches"),
        }
      );
    }
  };

  if (batchLoading && isEdit) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/batches")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{isEdit ? "Edit Batch" : "Create New Batch"}</h1>
          <p className="text-muted-foreground">
            {isEdit ? "Update batch details" : "Add a new batch to a course"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Batch Information</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Batch Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Morning Batch 2024" {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter a unique name to identify this batch
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="course_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a course" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background">
                        {courses?.map((course) => (
                          <SelectItem key={course.id} value={course.id}>
                            {course.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the course this batch belongs to
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date (Optional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="max_students"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Students (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Leave empty for unlimited"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      Set a maximum capacity for this batch
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
                        Make this batch available for enrollment
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/admin/batches")}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createBatch.isPending || updateBatch.isPending}
                >
                  {createBatch.isPending || updateBatch.isPending
                    ? "Saving..."
                    : isEdit
                    ? "Update Batch"
                    : "Create Batch"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
