import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useLanguageTopupStatus = (courseId?: string) => {
  return useQuery({
    queryKey: ["language-topup-status", courseId],
    queryFn: async () => {
      if (!courseId) return { hasPurchased: false, purchasedLanguages: [] };
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { hasPurchased: false, purchasedLanguages: [] };

      const { data, error } = await supabase
        .from("language_topup_purchases")
        .select("id, status, selected_languages")
        .eq("course_id", courseId)
        .eq("user_id", user.id)
        .eq("status", "success")
        .maybeSingle();

      if (error) {
        console.error("Error checking topup status:", error);
        return { hasPurchased: false, purchasedLanguages: [] };
      }

      const purchasedLanguages = (data?.selected_languages as string[]) || [];

      return {
        hasPurchased: !!data,
        purchasedLanguages,
        purchase: data,
      };
    },
    enabled: !!courseId,
    staleTime: 60000, // Cache for 1 minute
  });
};
