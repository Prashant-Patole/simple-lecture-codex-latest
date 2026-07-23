import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PageLoader } from "@/components/ui/page-loader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CheckerProtectedRoute = () => {
  const { user, isLoading: authLoading } = useAuth();

  const { data: hasAccess, isLoading: roleLoading, isFetching, isError } = useQuery({
    queryKey: ["checker-role-check", user?.id],
    queryFn: async () => {
      if (!user) return false;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["checker", "admin"]);

      if (error) {
        console.error("Checker role check error:", error);
        throw error;
      }

      return (data?.length ?? 0) > 0;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const isCheckingRole = user && (roleLoading || isFetching);

  if (authLoading || isCheckingRole || (user && isError)) {
    return <PageLoader message="Checking access..." />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (hasAccess === false) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
