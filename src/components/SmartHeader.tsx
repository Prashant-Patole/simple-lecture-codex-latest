import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";

interface SmartHeaderProps {
  minimal?: boolean;
}

export const SmartHeader = ({ minimal = false }: SmartHeaderProps = {}) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <Header minimal={minimal} />;
  }

  return isAuthenticated ? <DashboardHeader minimal={minimal} /> : <Header minimal={minimal} />;
};
