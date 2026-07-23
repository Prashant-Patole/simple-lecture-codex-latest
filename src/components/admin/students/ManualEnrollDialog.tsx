import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ManualEnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

export function ManualEnrollDialog({ open, onOpenChange, userId, userName }: ManualEnrollDialogProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: courses, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses-for-enroll"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourseId) throw new Error("Please select a course");

      // Check existing enrollment
      const { data: existing } = await supabase
        .from("enrollments")
        .select("id")
        .eq("student_id", userId)
        .eq("course_id", selectedCourseId)
        .eq("is_active", true)
        .maybeSingle();

      if (existing) throw new Error("Student is already enrolled in this course");

      const { error } = await supabase.from("enrollments").insert({
        student_id: userId,
        course_id: selectedCourseId,
        is_active: true,
        enrolled_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      });

      if (error) throw error;

      // Also update any pending payment for this user+course to success
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("payment_id")
        .eq("course_id", selectedCourseId);

      if (orderItems && orderItems.length > 0) {
        const paymentIds = orderItems.map((oi) => oi.payment_id);
        await supabase
          .from("payments")
          .update({ status: "success", completed_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("status", "pending")
          .in("id", paymentIds);
      }
    },
    onSuccess: () => {
      toast.success(`${userName} enrolled successfully!`);
      queryClient.invalidateQueries({ queryKey: ["unenrolled-users"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      onOpenChange(false);
      setSelectedCourseId("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to enroll student");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual Enrollment</DialogTitle>
          <DialogDescription>
            Manually enroll <strong>{userName}</strong> into a course. Use this when bank payment is confirmed but Razorpay didn't capture.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <label className="text-sm font-medium mb-2 block">Select Course</label>
          {coursesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading courses...
            </div>
          ) : (
            <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a course" />
              </SelectTrigger>
              <SelectContent>
                {courses?.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => enrollMutation.mutate()}
            disabled={!selectedCourseId || enrollMutation.isPending}
          >
            {enrollMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enroll Student
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
