import { Button } from "@/components/ui/button";
import { Menu, Search, ChevronDown, Bell, User, LogOut, LayoutDashboard, X } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MegaMenu } from "@/components/MegaMenu";
import { supabase } from "@/integrations/supabase/client";
import { useSearchCourses } from "@/hooks/usePaginatedCourses";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import logo from "@/assets/website-logo.png";

export const Header = ({ minimal = false }: { minimal?: boolean } = {}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Use centralized auth context instead of duplicate listeners
  const { user } = useAuth();
  const { data: currentUserData } = useCurrentUser();
  const userProfile = currentUserData?.profile;

  const debouncedSearch = useDebounce(searchQuery, 300);
  const { data: searchResults, isLoading: searchLoading } = useSearchCourses(debouncedSearch, 8);

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const getUserInitials = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return user?.email?.[0]?.toUpperCase() || 'U';
  };

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
    <header className="sticky top-0 z-50 w-full border-b bg-background shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              sessionStorage.setItem('slStayHome', '1');
              navigate('/');
            }}
            className="flex items-center"
          >
            <img src={logo} alt="SimpleLecture" className="h-10 object-contain" />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-3 flex-1 max-w-4xl">
            {!minimal && <MegaMenu />}
            {!minimal && (
            <div ref={searchRef} className="relative flex-1 max-w-md">{/* Search Bar with Dropdown */}
              <form onSubmit={handleSearchSubmit}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  className="pl-10 pr-8 bg-muted/50"
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

              {/* Search Results Dropdown */}
              {isSearchOpen && searchQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {searchLoading ? (
                    <div className="p-4 text-center text-muted-foreground">
                      Searching...
                    </div>
                  ) : searchResults && searchResults.length > 0 ? (
                    <>
                      {searchResults.map((course) => (
                        <button
                          key={course.id}
                          onClick={() => handleSearchSelect(course.slug)}
                          className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left"
                        >
                          {course.thumbnail_url ? (
                            <img
                              src={course.thumbnail_url}
                              alt={course.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-primary/10 rounded flex items-center justify-center">
                              <Search className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{course.name}</p>
                            {course.short_description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {course.short_description}
                              </p>
                            )}
                            {course.price_inr !== null && (
                              <p className="text-xs font-semibold text-primary">
                                {course.price_inr === 0 ? "Free" : `₹${course.price_inr.toLocaleString()}`}
                              </p>
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
                    <div className="p-4 text-center text-muted-foreground">
                      No courses found for "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
            )}
          </div>

          {/* Desktop Right Menu */}
          <nav className="hidden lg:flex items-center gap-4">
            {user ? (
              <>
                <Button variant="ghost" size="icon">
                  <Bell className="h-5 w-5" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="hidden md:inline-block">
                        {userProfile?.full_name || user.email}
                      </span>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium">{userProfile?.full_name || 'User'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile" className="cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        My Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/dashboard" className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/my-courses" className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        My Courses
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to="/recordings" className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        My Recordings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-1">
                      More <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-background">
                    <div className="p-2 space-y-1">
                      <a href="#how-it-works" className="block px-3 py-2 text-sm hover:bg-muted rounded-md">How it works</a>
                      <a href="#contact" className="block px-3 py-2 text-sm hover:bg-muted rounded-md">Contact</a>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Link to="/auth?tab=login">
                  <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                    Login
                  </Button>
                </Link>
                <Link to="/auth?tab=signup">
                  <Button>Sign Up</Button>
                </Link>
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden py-4 border-t">
            <nav className="flex flex-col gap-4">
              <form onSubmit={handleSearchSubmit} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>
              
              {user ? (
                <>
                  <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{userProfile?.full_name || 'User'}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <Link to="/profile" className="text-sm font-medium hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>
                    Profile
                  </Link>
                  <Link to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>
                    Dashboard
                  </Link>
                  <Link to="/my-courses" className="text-sm font-medium hover:text-primary transition-colors" onClick={() => setIsMenuOpen(false)}>
                    My Courses
                  </Link>
                  <Button variant="destructive" onClick={handleLogout} className="w-full">
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <a href="#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">
                    How it works
                  </a>
                  <a href="#contact" className="text-sm font-medium hover:text-primary transition-colors">
                    Contact
                  </a>
                  <div className="flex gap-2 pt-4">
                    <Link to="/auth?tab=login" className="flex-1" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="w-full border-primary text-primary">
                        Login
                      </Button>
                    </Link>
                    <Link to="/auth?tab=signup" className="flex-1" onClick={() => setIsMenuOpen(false)}>
                      <Button className="w-full">Sign Up</Button>
                    </Link>
                  </div>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
