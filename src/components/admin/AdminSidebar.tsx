import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard, 
  FolderTree, 
  Target, 
  BookOpen, 
  BookMarked,
  GraduationCap,
  Users,
  Settings,
  LogOut,
  Flame,
  ChevronRight,
  UserCheck,
  UserCircle,
  UsersRound,
  ShieldCheck,
  Calendar,
  HelpCircle,
  FileText,
  Building2,
  UserPlus,
  CalendarDays,
  Video,
  Upload,
  CheckSquare,
  TestTube2,
  Folder,
  Home,
  Star,
  ShoppingCart,
  MessageSquare,
  Wallet,
  ClipboardList,
  BarChart3,
  Activity,
  ClipboardCheck,
  Eye,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Headphones, RefreshCw } from "lucide-react";
import { useBadReportCount } from "@/hooks/useAutoPipelineReports";
import { useActivePipelineRunCount } from "@/hooks/useAllPipelineRuns";

export const AdminSidebar = () => {
  const navigate = useNavigate();
  const [openCategories, setOpenCategories] = useState(true);
  const [openPrograms, setOpenPrograms] = useState(false);
  const [openUsers, setOpenUsers] = useState(false);
  const [openHR, setOpenHR] = useState(false);

  // Get current user email for access control
  const { user } = useAuth();
  const isRestrictedAdmin = user?.email === 'admin@simplelecture.com';

  // Fetch escalated ticket count for badge
  const { data: escalatedCount = 0 } = useQuery({
    queryKey: ['escalated-ticket-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'escalated_to_admin');
      if (error) return 0;
      return count || 0;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch bad pipeline report count for badge
  const { data: badReportCount = 0 } = useBadReportCount();

  // Fetch active pipeline run count for badge
  const activePipelineCount = useActivePipelineRunCount();

  const handleLogout = async () => {
    const { queryClient } = await import("@/lib/queryClient");
    queryClient.clear();
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border min-h-screen flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border bg-background">
        <h1 className="text-xl font-bold tracking-tight text-foreground">SIMPLE LECTURE</h1>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {/* Analytics */}
        {!isRestrictedAdmin && (
        <NavLink
          to="/admin/analytics"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )
          }
        >
          <BarChart3 className="h-4 w-4" />
          <span>Analytics</span>
        </NavLink>
        )}

        <NavLink
          to="/admin/ask-ai"
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )
          }
        >
          <Sparkles className="h-4 w-4" />
          <span>Ask AI</span>
        </NavLink>


        {/* Dashboard */}
        <NavLink
          to="/admin"
          end
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50"
            )
          }
        >
          <Flame className="h-4 w-4" />
          <span>Dashboard</span>
        </NavLink>

        {/* Manage Category */}
        <Collapsible open={openCategories} onOpenChange={setOpenCategories}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2.5 rounded-md hover:bg-sidebar-accent/50 text-sm font-medium text-sidebar-foreground transition-all group">
            <div className="flex items-center gap-3">
              <FolderTree className="h-4 w-4" />
              <span>Manage Category</span>
            </div>
            <ChevronRight className={cn("h-4 w-4 transition-transform", openCategories && "rotate-90")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0.5 mt-1 ml-7 pl-3 border-l border-sidebar-border">
            <NavLink
              to="/admin/categories"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              Categories
            </NavLink>
            <NavLink
              to="/admin/explore-by-goal"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              Explore by Goal
            </NavLink>
            <NavLink
              to="/admin/settings/featured-courses"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              <Star className="h-4 w-4" />
              Featured Courses
            </NavLink>
          </CollapsibleContent>
        </Collapsible>

        {/* Manage Programs */}
        <Collapsible open={openPrograms} onOpenChange={setOpenPrograms}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2.5 rounded-md hover:bg-sidebar-accent/50 text-sm font-medium text-sidebar-foreground transition-all">
            <div className="flex items-center gap-3">
              <BookMarked className="h-4 w-4" />
              <span>Manage Programs</span>
            </div>
            <ChevronRight className={cn("h-4 w-4 transition-transform", openPrograms && "rotate-90")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0.5 mt-1 ml-7 pl-3 border-l border-sidebar-border">
            <NavLink
              to="/admin/courses"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              Courses
            </NavLink>
            <NavLink
              to="/admin/popular-subjects"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              Subjects
            </NavLink>
            <NavLink
              to="/admin/question-bank"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              <HelpCircle className="h-4 w-4" />
              Question Bank
            </NavLink>
            <NavLink
              to="/admin/question-bank/upload"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              <Upload className="h-4 w-4" />
              Upload Questions
            </NavLink>
            <NavLink
              to="/admin/question-bank/verify"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              <CheckSquare className="h-4 w-4" />
              Verify Questions
            </NavLink>
            <NavLink
              to="/admin/assignments"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              Assignments
            </NavLink>
          </CollapsibleContent>
        </Collapsible>

        {/* Enrollments */}
        <Collapsible open={openUsers} onOpenChange={setOpenUsers}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2.5 rounded-md hover:bg-sidebar-accent/50 text-sm font-medium text-sidebar-foreground transition-all">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4" />
              <span>Enrollments</span>
            </div>
            <ChevronRight className={cn("h-4 w-4 transition-transform", openUsers && "rotate-90")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0.5 mt-1 ml-7 pl-3 border-l border-sidebar-border">
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              Student Management
            </NavLink>
            {!isRestrictedAdmin && (
            <NavLink
              to="/admin/batches"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              Batches
            </NavLink>
            )}
            <NavLink
              to="/admin/orders"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              <ShoppingCart className="h-4 w-4" />
              Order Management
            </NavLink>
            {!isRestrictedAdmin && (<>
            <NavLink
              to="/admin/promo-codes"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              Promo Codes
            </NavLink>
            <NavLink
              to="/admin/parents"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              Parents
            </NavLink>
            <NavLink
              to="/admin/instructors"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              Instructors
            </NavLink>
            <NavLink
              to="/admin/staff"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )
              }
            >
              Staff
            </NavLink>
            </>)}
          </CollapsibleContent>
        </Collapsible>

        {/* Forum Moderation */}
        <NavLink to="/admin/forum-moderation" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><MessageSquare className="h-4 w-4" /><span>Forum Moderation</span></NavLink>

        {/* Support Tickets */}
        <NavLink to="/admin/support" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>
          <Headphones className="h-4 w-4" /><span>Support Tickets</span>
          {escalatedCount > 0 && (<Badge variant="destructive" className="ml-auto h-5 min-w-5 flex items-center justify-center text-xs">{escalatedCount}</Badge>)}
        </NavLink>

        {/* Sales Leads */}
        <NavLink to="/admin/sales-leads" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Users className="h-4 w-4" /><span>Sales Leads</span></NavLink>

        {/* Visitor Analytics */}
        <NavLink to="/admin/visitor-analytics" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Eye className="h-4 w-4" /><span>Visitor Analytics</span></NavLink>

        {/* Kannada Coverage Scan */}
        {!isRestrictedAdmin && (<>
          <NavLink to="/admin/kannada-scan" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Video className="h-4 w-4" /><span>Kannada Scan</span></NavLink>
          <NavLink to="/admin/kannada-queue" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Video className="h-4 w-4" /><span>Kannada Queue</span></NavLink>
          <NavLink to="/admin/server4-jobs" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Video className="h-4 w-4" /><span>.4 Server Jobs</span></NavLink>
          <NavLink to="/admin/settings/counselor-avatars" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><UserCircle className="h-4 w-4" /><span>Avatars</span></NavLink>
          <NavLink to="/admin/server78-jobs" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Video className="h-4 w-4" /><span>.78 Cloud Jobs</span></NavLink>
          <NavLink to="/admin/video-coverage" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Video className="h-4 w-4" /><span>Video Coverage</span></NavLink>
          <NavLink to="/admin/completed-integrity" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Video className="h-4 w-4" /><span>Completed Integrity</span></NavLink>
          <NavLink to="/admin/language-checker" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Video className="h-4 w-4" /><span>Language Checker</span></NavLink>
          <NavLink to="/admin/cdn-presentation-refresh" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><RefreshCw className="h-4 w-4" /><span>CDN Presentation Refresh</span></NavLink>
        </>)}

        {!isRestrictedAdmin && (<>
        {/* Human Resource */}
        <Collapsible open={openHR} onOpenChange={setOpenHR}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2.5 rounded-md hover:bg-sidebar-accent/50 text-sm font-medium text-sidebar-foreground transition-all">
            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4" />
              <span>Human Resource</span>
            </div>
            <ChevronRight className={cn("h-4 w-4 transition-transform", openHR && "rotate-90")} />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-0.5 mt-1 ml-7 pl-3 border-l border-sidebar-border">
            <NavLink to="/admin/hr/instructors" className={({ isActive }) => cn("flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>Manage Instructors</NavLink>
            <NavLink to="/admin/hr/departments" className={({ isActive }) => cn("flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>Departments</NavLink>
            <NavLink to="/admin/hr/timetable" className={({ isActive }) => cn("flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>Timetable</NavLink>
            <NavLink to="/admin/hr/live-classes" className={({ isActive }) => cn("flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}>Manage Live Classes</NavLink>
            <NavLink to="/admin/hr/recordings" className={({ isActive }) => cn("flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Video className="h-4 w-4" />Class Recordings</NavLink>
            <NavLink to="/admin/hr/bulk-assign-instructors" className={({ isActive }) => cn("flex items-center gap-2 px-3 py-2 rounded-md transition-all text-sm", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><UserPlus className="h-4 w-4" />Bulk Assign Instructors</NavLink>
          </CollapsibleContent>
        </Collapsible>

        {/* Manage Academics */}
        <NavLink to="/admin/academics" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Calendar className="h-4 w-4" /><span>Manage Academics</span></NavLink>

        {/* Content Audit */}
        <NavLink to="/admin/content-audit" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><ClipboardCheck className="h-4 w-4" /><span>Content Audit</span></NavLink>
        <NavLink to="/admin/doc-coverage" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><ClipboardCheck className="h-4 w-4" /><span>Doc Coverage</span></NavLink>
        <NavLink to="/admin/cdn-doc-coverage" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><ClipboardCheck className="h-4 w-4" /><span>CDN Doc Coverage</span></NavLink>
        <NavLink to="/admin/coverage-analyzer" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><ClipboardCheck className="h-4 w-4" /><span>Coverage Analyzer</span></NavLink>

        {/* Documentation */}
        <NavLink to="/admin/settings/documentation" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><HelpCircle className="h-4 w-4" /><span>Documentation</span></NavLink>

        {/* Settings */}
        <NavLink to="/admin/settings" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Settings className="h-4 w-4" /><span>Settings</span></NavLink>

        {/* Counselor Avatars */}
        <NavLink to="/admin/settings/counselor-avatars" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><UserCircle className="h-4 w-4" /><span>Counselor Avatars</span></NavLink>

        {/* File Manager */}
        <NavLink to="/admin/files" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Folder className="h-4 w-4" /><span>File Manager</span></NavLink>

        {/* KIE.AI Balance */}
        <NavLink to="/admin/kie-balance" className={({ isActive }) => cn("flex items-center gap-3 px-3 py-2.5 rounded-md transition-all text-sm font-medium", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50")}><Wallet className="h-4 w-4" /><span>Check Balance</span></NavLink>
        </>)}
      </nav>

      {/* Logout Button */}
      <div className="p-3 border-t border-sidebar-border">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start gap-3 text-sm text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </div>
    </aside>
  );
};
