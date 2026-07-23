import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, LayoutDashboard, BookOpen, Video, Trophy, MessageSquare, HelpCircle, User, LogOut, Home, Grid3X3, LogIn, UserPlus, Newspaper, FileText } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/contexts/AuthContext";

const authenticatedMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Grid3X3, label: "Browse Courses", path: "/programs" },
  { icon: BookOpen, label: "My Courses", path: "/my-courses" },
  { icon: Video, label: "Live Classes", path: "/live" },
  { icon: FileText, label: "My Tests", path: "/my-tests" },
  { icon: MessageSquare, label: "Forum", path: "/forum" },
  { icon: Newspaper, label: "Blog", path: "/blog" },
  { icon: HelpCircle, label: "Support", path: "/support" },
  { icon: User, label: "Profile", path: "/profile" },
];

const guestMenuItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Grid3X3, label: "Browse Courses", path: "/programs" },
  { icon: Newspaper, label: "Blog", path: "/blog" },
  { icon: HelpCircle, label: "Support", path: "/auth?tab=login" },
];

export const HamburgerMenu = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { data: profile } = useUserProfile();

  const initials = (profile?.full_name || profile?.email || "U").slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    queryClient.clear();
    await supabase.auth.signOut();
    navigate("/");
  };

  const menuItems = isAuthenticated ? authenticatedMenuItems : guestMenuItems;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] sm:w-[320px]">
        <SheetHeader className="mb-6">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-foreground">{profile?.full_name || "Student"}</p>
                <p className="text-sm text-muted-foreground">{profile?.email || ""}</p>
              </div>
            </div>
          ) : (
            <div className="text-left">
              <p className="font-semibold text-foreground text-lg">Welcome!</p>
              <p className="text-sm text-muted-foreground">Sign in to access all features</p>
            </div>
          )}
        </SheetHeader>
        
        <Separator className="my-4" />
        
        <nav className="flex flex-col gap-1">
          {menuItems.map(({ icon: Icon, label, path }) => {
            const isActive = location.pathname === path;
            return (
              <Link key={path} to={path}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className="w-full justify-start gap-3 h-11"
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </Button>
              </Link>
            );
          })}
          
          <Separator className="my-2" />

          {isAuthenticated ? (
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-11 text-destructive border-destructive hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </Button>
          ) : (
            <div className="flex flex-col gap-2">
              <Link to="/auth?tab=login">
                <Button variant="outline" className="w-full justify-start gap-3 h-11">
                  <LogIn className="h-5 w-5" />
                  <span>Login</span>
                </Button>
              </Link>
              <Link to="/auth?tab=signup">
                <Button className="w-full justify-start gap-3 h-11">
                  <UserPlus className="h-5 w-5" />
                  <span>Sign Up</span>
                </Button>
              </Link>
            </div>
          )}
        </nav>
        
        <div className="absolute bottom-4 left-6 right-6">
          <Separator className="my-4" />
          <p className="text-xs text-muted-foreground text-center">
            SimpleLecture v1.0.0
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
