import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export const useUserProfile = () => {
  return useQuery({
    queryKey: ["user-profile"],
    queryFn: async (): Promise<UserProfile | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      return { ...data, email: user.email, id: user.id } as UserProfile;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes - profile doesn't change often
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
  });
};
