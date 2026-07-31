import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LayoutDashboard, BookOpen, Video, Trophy, MessageSquare, HelpCircle, User, LogOut, Menu, Newspaper, CalendarClock, Grid3X3, FileText, NotebookPen } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { useUserProfile } from "@/hooks/useUserProfile";

const items = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { label: "Browse Courses", icon: Grid3X3, to: "/programs" },
  { label: "My Courses", icon: BookOpen, to: "/my-courses" },
  { label: "Live Classes", icon: Video, to: "/live" },
  { label: "Time Table", icon: CalendarClock, to: "/timetable" },
  { label: "My Tests", icon: FileText, to: "/my-tests" },
  { label: "My Notes", icon: NotebookPen, to: "/my-notes" },
  { label: "My Rewards", icon: Trophy, to: "/my-rewards" },
  { label: "Forum", icon: MessageSquare, to: "/forum" },
  { label: "Blog", icon: Newspaper, to: "/blog" },
  { label: "Support", icon: HelpCircle, to: "/support" },
  { label: "Profile", icon: User, to: "/profile" },
];

export const DashboardMenu = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: profile } = useUserProfile();

  const initials = (profile?.full_name || profile?.email || "U").slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    queryClient.clear();
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[360px] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-left">Menu</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="flex items-center gap-3 mt-4">
            <Avatar className="h-12 w-12">
              {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name || "User"} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium leading-tight">{profile?.full_name || "Student"}</p>
              <p className="text-xs text-muted-foreground">{profile?.email || ""}</p>
            </div>
          </div>

          <Separator className="my-4" />

          <nav className="space-y-1">
            {items.map(({ label, icon: Icon, to }) => {
              const active = location.pathname === to;
              return (
                <Link key={to} to={to} className="block">
                  <Button
                    variant={active ? "secondary" : "ghost"}
                    className="w-full justify-start gap-3"
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-t px-6 py-4">
          <Button variant="outline" className="w-full justify-start gap-3 text-destructive border-destructive" onClick={handleLogout}>
            <LogOut className="h-5 w-5" /> Logout
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
