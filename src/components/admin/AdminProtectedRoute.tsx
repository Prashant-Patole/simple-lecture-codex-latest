import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/ui/page-loader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const AdminProtectedRoute = () => {
  const { user, isLoading: authLoading } = useAuth();

  // Check admin role - only runs when user is authenticated
  const { data: isAdmin, isLoading: roleLoading, isFetching, isError } = useQuery({
    queryKey: ["admin-role-check", user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error) {
        console.error("Role check error:", error);
        throw error; // Let React Query handle retry
      }

      return data?.role === "admin";
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // Cache role for 10 minutes
    gcTime: 1000 * 60 * 30,
    retry: 3, // Retry 3 times on failure
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Show loading while:
  // 1. Auth is still loading
  // 2. User exists but role query hasn't returned yet
  // 3. Role query is still fetching
  // 4. Role query errored (let retry happen)
  const isCheckingRole = user && (roleLoading || isFetching);

  if (authLoading || isCheckingRole || (user && isError)) {
    return <PageLoader message="Checking admin access..." />;
  }

  // Not logged in - redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Logged in but not admin - redirect to home
  if (isAdmin === false) {
    return <Navigate to="/" replace />;
  }

  // Admin - render the protected content
  return <Outlet />;
};
