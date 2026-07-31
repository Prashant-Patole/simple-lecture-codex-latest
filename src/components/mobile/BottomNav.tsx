import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, BookOpen, Home, LayoutDashboard, Film, NotebookPen } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navItems = [
  { icon: LayoutGrid, label: "Browse", path: "/programs", requiresAuth: false },
  { icon: BookOpen, label: "My Class", path: "/my-courses", requiresAuth: true },
  { icon: Home, label: "Home", path: "/", isCenter: true, requiresAuth: false },
  { icon: NotebookPen, label: "My Notes", path: "/my-notes", requiresAuth: true },
  { icon: Film, label: "Reels", path: "/reels", requiresAuth: true },
];

export const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Hide on admin, auth, checker, and instructor pages
  const excludedPrefixes = ['/admin', '/checker', '/instructor', '/learning'];
  if (excludedPrefixes.some(prefix => location.pathname.startsWith(prefix))) return null;

  const handleNavClick = (e: React.MouseEvent, item: typeof navItems[0]) => {
    if (item.requiresAuth && !isAuthenticated) {
      e.preventDefault();
      navigate("/auth?tab=login");
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 md:hidden shadow-lg">
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
        {navItems.map(({ icon: Icon, label, path, isCenter, requiresAuth }) => {
          const isActive = location.pathname === path || 
            (path === "/" && location.pathname === "/");
          
          if (isCenter) {
            return (
              <button
                key={path}
                type="button"
                onClick={() => {
                  try { sessionStorage.setItem('slStayHome', '1'); } catch {}
                  navigate('/');
                }}
                className="relative -mt-6"
                aria-label="Home"
              >
                <div className={`h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  isActive 
                    ? "bg-primary" 
                    : "bg-primary hover:bg-primary"
                }`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </button>
            );
          }

          
          return (
            <Link
              key={path}
              to={requiresAuth && !isAuthenticated ? "#" : path}
              onClick={(e) => handleNavClick(e, { icon: Icon, label, path, requiresAuth })}
              className={`flex flex-col items-center justify-center flex-1 h-full min-w-[50px] transition-all ${
                isActive
                  ? "text-primary"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : ""}`} />
              <span className={`text-[10px] mt-1 ${isActive ? "font-semibold" : "font-medium"}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
