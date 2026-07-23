import { NavLink, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Video, 
  BookOpen, 
  ClipboardList, 
  LogOut,
  User
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { toast } from "sonner";
import { useLogInstructorActivity } from "@/hooks/useLogInstructorActivity";

const menuItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/instructor" },
  { title: "My Classes", icon: Video, path: "/instructor/classes" },
  { title: "My Subjects", icon: BookOpen, path: "/instructor/subjects" },
  { title: "Activity Log", icon: ClipboardList, path: "/instructor/activity" },
];

export const InstructorSidebar = () => {
  const location = useLocation();
  const { data: currentUser } = useCurrentUser();
  const logActivity = useLogInstructorActivity();

  const handleLogout = async () => {
    await logActivity.mutateAsync({
      action: "Logged out",
      action_type: "LOGOUT",
      metadata: {}
    });
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    window.location.href = "/auth";
  };

  return (
    <div className="flex flex-col h-full w-64 bg-card border-r">
      {/* Header */}
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-primary">Instructor Panel</h2>
      </div>

      {/* User Info */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={currentUser?.profile?.avatar_url || undefined} />
            <AvatarFallback>
              <User className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="font-medium truncate">{currentUser?.profile?.full_name || "Instructor"}</p>
            <p className="text-xs text-muted-foreground truncate">{currentUser?.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== "/instructor" && location.pathname.startsWith(item.path));
          
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t">
        <Button 
          variant="outline" 
          className="w-full justify-start" 
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
};
