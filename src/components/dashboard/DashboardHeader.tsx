import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Bell, Search, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logo from "@/assets/website-logo.png";
import { DashboardMenu } from "./DashboardMenu";
import { NotificationModal } from "./NotificationModal";
import { MegaMenu } from "@/components/MegaMenu";
import { useNotices } from "@/hooks/useNotices";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchCourses } from "@/hooks/usePaginatedCourses";

export const DashboardHeader = ({ minimal = false }: { minimal?: boolean } = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const { unreadCount } = useNotices();
  const { data: profile } = useUserProfile();

  const initials = (profile?.full_name || profile?.email || "U").slice(0, 2).toUpperCase();

  // Only show the search field on category/programs/explore pages
  const showSearch =
    !minimal &&
    (location.pathname.startsWith("/programs") || location.pathname.startsWith("/explore"));

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebounce(searchQuery, 300);
  const { data: searchResults, isLoading: searchLoading } = useSearchCourses(debouncedSearch, 8);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSelect = (slug: string) => {
    setSearchQuery("");
    setIsSearchOpen(false);
    navigate(`/programs/${slug}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearchOpen(false);
      navigate(`/programs?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              sessionStorage.setItem('slStayHome', '1');
              navigate('/');
            }}
            className="flex items-center"
          >
            <img src={logo} alt="SimpleLecture Logo" className="h-8" />
          </a>
          {!minimal && <MegaMenu />}
          {showSearch && (
            <div ref={searchRef} className="relative hidden md:flex w-[360px]">
              <form onSubmit={handleSearchSubmit} className="w-full relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses, assignments, classes..."
                  className="pl-9 pr-8"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsSearchOpen(true);
                  }}
                  onFocus={() => setIsSearchOpen(true)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchOpen(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </form>

              {isSearchOpen && searchQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {searchLoading ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">Searching...</div>
                  ) : searchResults && searchResults.length > 0 ? (
                    <>
                      {searchResults.map((course) => (
                        <button
                          key={course.id}
                          onClick={() => handleSearchSelect(course.slug)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left"
                        >
                          {course.thumbnail_url ? (
                            <img src={course.thumbnail_url} alt={course.name} className="w-10 h-10 object-cover rounded" />
                          ) : (
                            <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                              <Search className="w-4 h-4 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{course.name}</p>
                            {course.short_description && (
                              <p className="text-xs text-muted-foreground truncate">{course.short_description}</p>
                            )}
                          </div>
                        </button>
                      ))}
                      <button
                        onClick={handleSearchSubmit}
                        className="w-full px-4 py-3 text-center text-sm text-primary hover:bg-muted transition-colors border-t"
                      >
                        View all results for "{searchQuery}"
                      </button>
                    </>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      No courses found for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative" onClick={() => setNotificationOpen(true)}>
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>

          {/* Profile */}
          <Button variant="ghost" className="px-1" onClick={() => navigate("/profile")}>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name || "User"} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="hidden md:inline text-sm">{profile?.full_name || "Student"}</span>
            </div>
          </Button>

          {/* Right-side expanding menu */}
          <DashboardMenu />
        </div>
      </div>

      {/* Notification Modal */}
      <NotificationModal open={notificationOpen} onOpenChange={setNotificationOpen} />
    </header>
  );
};
