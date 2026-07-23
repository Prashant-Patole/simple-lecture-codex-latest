import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Global defaults for all queries
      staleTime: 1000 * 60 * 5, // 5 minutes default
      gcTime: 1000 * 60 * 30, // 30 minutes in cache
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Prefetch strategies for common data
export const prefetchCourses = async (category?: string) => {
  await queryClient.prefetchQuery({
    queryKey: category ? ["courses", "list", { filters: category }] : ["courses", "list"],
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      
      const query: any = supabase
        .from("courses")
        .select("*")
        .eq("is_active", true);
      
      const finalQuery = category ? query.eq("category", category) : query;
      const { data, error } = await finalQuery;
      
      if (error) throw error;
      return data || [];
    },
  });
};
