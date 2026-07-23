import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EnrollStudentParams {
  student_id: string;
  course_id: string;
  batch_id?: string;
}

export const useEnrollStudent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ student_id, course_id, batch_id }: EnrollStudentParams) => {
      // Check if enrollment already exists
      const { data: existing } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', student_id)
        .eq('course_id', course_id)
        .single();

      if (existing) {
        throw new Error("Student is already enrolled in this course");
      }

      // If batch_id provided, verify batch capacity
      if (batch_id) {
        const { data: batch } = await supabase
          .from('batches')
          .select('current_students, max_students')
          .eq('id', batch_id)
          .single();

        if (batch && batch.max_students && batch.current_students >= batch.max_students) {
          throw new Error("Batch is full. Please select another batch or increase capacity.");
        }
      }

      // Create enrollment
      const { data, error } = await supabase
        .from('enrollments')
        .insert({
          student_id,
          course_id,
          batch_id: batch_id || null,
          enrolled_at: new Date().toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Update batch student count if batch assigned
      if (batch_id) {
        await supabase.rpc('increment_batch_students', { batch_id });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success("Student enrolled successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to enroll student");
    },
  });
};

export const useUpdateEnrollmentBatch = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      enrollment_id, 
      old_batch_id, 
      new_batch_id 
    }: { 
      enrollment_id: string; 
      old_batch_id: string | null; 
      new_batch_id: string;
    }) => {
      // Verify new batch capacity
      const { data: batch } = await supabase
        .from('batches')
        .select('current_students, max_students')
        .eq('id', new_batch_id)
        .single();

      if (batch && batch.max_students && batch.current_students >= batch.max_students) {
        throw new Error("Target batch is full");
      }

      // Update enrollment
      const { error } = await supabase
        .from('enrollments')
        .update({ batch_id: new_batch_id })
        .eq('id', enrollment_id);

      if (error) throw error;

      // Update batch counts
      if (old_batch_id) {
        await supabase.rpc('decrement_batch_students', { batch_id: old_batch_id });
      }
      await supabase.rpc('increment_batch_students', { batch_id: new_batch_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success("Student moved to new batch");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to move student");
    },
  });
};

export const useUnenrollStudent = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      enrollment_id, 
      batch_id 
    }: { 
      enrollment_id: string; 
      batch_id: string | null;
    }) => {
      // Delete enrollment
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', enrollment_id);

      if (error) throw error;

      // Update batch count
      if (batch_id) {
        await supabase.rpc('decrement_batch_students', { batch_id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      toast.success("Student unenrolled");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to unenroll student");
    },
  });
};