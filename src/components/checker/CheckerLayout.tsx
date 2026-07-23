import { Outlet, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NoIndex } from "@/components/SEO";

export const CheckerLayout = () => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NoIndex />
      <header className="h-14 bg-primary flex items-center justify-between px-6 shadow-md">
        <div className="flex items-center gap-2 text-primary-foreground">
          <ShieldCheck className="h-5 w-5" />
          <span className="font-semibold text-lg">Content Checker</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-primary-foreground hover:bg-primary/80 gap-2"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
};
