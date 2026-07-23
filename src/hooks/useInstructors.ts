import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useInstructors = () => {
  return useQuery({
    queryKey: ['instructors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_profiles')
        .select(`
          *,
          department:departments!teacher_profiles_department_id_fkey(id, name),
          subjects:instructor_subjects(
            id,
            subject_id,
            subject:popular_subjects(id, name, category_id, categories(id, name))
          )
        `)
        .order('full_name');

      if (error) throw error;
      return data || [];
    },
  });
};

export const useInstructor = (id: string) => {
  return useQuery({
    queryKey: ['instructor', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teacher_profiles')
        .select(`
          *,
          department:departments!teacher_profiles_department_id_fkey(id, name),
          subjects:instructor_subjects(
            id,
            subject_id,
            subject:popular_subjects(id, name, category_id, categories(id, name))
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
};

export const useCreateInstructor = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: any) => {
      // Call edge function to create instructor with proper auth user
      const { data: result, error } = await supabase.functions.invoke('create-instructor', {
        body: { instructorData: data },
      });

      if (error) {
        // Handle edge function errors
        throw new Error(error.message || 'Failed to create instructor');
      }
      
      if (result?.error) {
        throw new Error(result.error);
      }
      
      if (!result?.success) {
        throw new Error('Failed to create instructor');
      }

      return result.profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      toast.success('Instructor created successfully. They can now log in with their credentials.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create instructor');
    },
  });
};

export const useUpdateInstructor = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const { error } = await supabase
        .from('teacher_profiles')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      toast.success('Instructor updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update instructor');
    },
  });
};

export const useInstructorSubjects = (instructorId: string) => {
  return useQuery({
    queryKey: ['instructor-subjects', instructorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('instructor_subjects')
        .select(`
          *,
          subject:popular_subjects(id, name, category_id, categories(id, name))
        `)
        .eq('instructor_id', instructorId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!instructorId,
  });
};

export const useUpdateInstructorSubjects = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ instructorId, subjects }: { instructorId: string; subjects: any[] }) => {
      // Delete existing subjects
      await supabase
        .from('instructor_subjects')
        .delete()
        .eq('instructor_id', instructorId);

      // Insert new subjects
      if (subjects.length > 0) {
        const { error } = await supabase
          .from('instructor_subjects')
          .insert(subjects.map(s => ({
            instructor_id: instructorId,
            subject_id: s.subject_id,
          })));
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructor-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      queryClient.invalidateQueries({ queryKey: ['subject-instructors'] });
      toast.success('Subjects updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update subjects');
    },
  });
};
