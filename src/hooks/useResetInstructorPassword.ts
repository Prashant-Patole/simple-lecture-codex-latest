import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useResetInstructorPassword = () => {
  return useMutation({
    mutationFn: async ({ instructorId, newPassword }: { instructorId: string; newPassword: string }) => {
      const { data, error } = await supabase.functions.invoke('update-instructor-password', {
        body: { instructorId, newPassword }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Password reset successfully");
    },
    onError: (error: Error) => {
      toast.error(`Failed to reset password: ${error.message}`);
    },
  });
};
