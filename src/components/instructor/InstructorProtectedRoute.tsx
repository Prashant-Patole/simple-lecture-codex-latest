import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/ui/page-loader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const InstructorProtectedRoute = () => {
  const { user, isLoading: authLoading } = useAuth();

  // Check instructor/admin role - only runs when user is authenticated
  const { data: isAuthorized, isLoading: roleLoading, isFetching } = useQuery({
    queryKey: ["instructor-role-check", user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["teacher", "admin"])
        .maybeSingle();

      if (error) {
        console.error("Role check error:", error);
        return false;
      }

      return data?.role === "teacher" || data?.role === "admin";
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // Cache role for 10 minutes
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });

  // Show loading while:
  // 1. Auth is still loading
  // 2. User exists but role query hasn't returned yet
  // 3. Role query is still fetching
  const isCheckingRole = user && (roleLoading || isFetching);

  if (authLoading || isCheckingRole) {
    return <PageLoader message="Checking instructor access..." />;
  }

  // Not logged in - redirect to auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Logged in but not instructor/admin - redirect to home
  if (isAuthorized === false) {
    return <Navigate to="/" replace />;
  }

  // Authorized - render the protected content
  return <Outlet />;
};
