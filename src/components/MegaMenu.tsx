import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { useExploreByGoalPublic } from "@/hooks/useExploreByGoalPublic";
import { useCategoriesHierarchy } from "@/hooks/useCategoriesHierarchy";
import { ChevronDown, ChevronRight, GraduationCap, Menu } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";

const getCategoryDisplayName = (name: string) => {
  const isBoardExams = name.toLowerCase().includes('board exam');
  const alreadyComingSoon = name.toLowerCase().includes('coming soon');
  if (isBoardExams || alreadyComingSoon) return name;
  return `${name} (Coming Soon)`;
};

export const MegaMenu = () => {
  const { data: goals } = useExploreByGoalPublic();
  const { data: categories } = useCategoriesHierarchy();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [menuValue, setMenuValue] = useState<string>("");
  const navigate = useNavigate();

  const closeMenu = () => setMenuValue("");

  const handleGoalClick = (goal: any, e: React.MouseEvent) => {
    if (goal.link_type === 'external' && goal.link_url) {
      e.preventDefault();
      if (goal.open_in_new_tab) {
        window.open(goal.link_url, '_blank');
      } else {
        window.location.href = goal.link_url;
      }
    }
    closeMenu();
  };

  const handleMobileNavigate = (path: string) => {
    setSheetOpen(false);
    navigate(path);
  };


  // Mobile: Sheet-based menu
  if (isMobile) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1 px-2 text-sm font-medium"
          onClick={() => setSheetOpen(true)}
        >
          <GraduationCap className="h-4 w-4" />
          <span>Courses</span>
          <ChevronDown className="h-3 w-3" />
        </Button>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl p-0">
            <SheetHeader className="px-5 pt-5 pb-3 border-b">
              <SheetTitle className="text-left text-lg">All Courses</SheetTitle>
            </SheetHeader>

            <ScrollArea className="h-[calc(85vh-70px)]">
              <div className="px-5 py-4 space-y-6">
                {/* Explore by Goal */}
                {goals && goals.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Explore by Goal
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {goals.map((goal: any) => (
                        <button
                          key={goal.id}
                          onClick={(e) => {
                            handleGoalClick(goal, e);
                            if (goal.link_type !== 'external') {
                              handleMobileNavigate(
                                goal.link_type === 'courses'
                                  ? `/explore/${goal.slug}`
                                  : (goal.link_url || `/explore/${goal.slug}`)
                              );
                            }
                          }}
                          className="px-3 py-1.5 rounded-full text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          {goal.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Browse by Class/Exam */}
                {categories && categories.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Browse by Class / Exam
                    </h3>
                    <div className="space-y-1">
                      {categories.map((category) => (
                        <Collapsible key={category.id}>
                          <div className="flex items-center">
                            <button
                              onClick={() => handleMobileNavigate(`/programs/${category.slug}`)}
                              className="flex-1 flex items-center gap-3 py-2.5 px-3 rounded-lg text-sm font-medium hover:bg-accent transition-colors text-left"
                            >
                              <CategoryIcon icon={category.icon} size="sm" />
                              <span>{getCategoryDisplayName(category.name)}</span>
                            </button>
                            {category.subcategories.length > 0 && (
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                  <ChevronRight className="h-4 w-4 transition-transform duration-200 [[data-state=open]>&]:rotate-90" />
                                </Button>
                              </CollapsibleTrigger>
                            )}
                          </div>

                          {category.subcategories.length > 0 && (
                            <CollapsibleContent>
                              <div className="ml-4 pl-4 border-l border-border space-y-0.5 pb-1">
                                {category.subcategories.map((sub) => (
                                  <div key={sub.id}>
                                    <button
                                      onClick={() => handleMobileNavigate(`/programs/${category.slug}/${sub.slug}`)}
                                      className="w-full flex items-center gap-2 py-2 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-left"
                                    >
                                      {sub.name}
                                    </button>
                                    {/* Sub-subcategories */}
                                    {sub.subcategories && sub.subcategories.length > 0 && (
                                      <div className="ml-4 pl-3 border-l border-border/50 space-y-0.5">
                                        {sub.subcategories.map((subsub) => (
                                          <button
                                            key={subsub.id}
                                            onClick={() => handleMobileNavigate(`/programs/${category.slug}/${sub.slug}`)}
                                            className="w-full flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-left"
                                          >
                                            {subsub.name}
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </CollapsibleContent>
                          )}
                        </Collapsible>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop: existing NavigationMenu
  return (
    <NavigationMenu value={menuValue} onValueChange={setMenuValue}>
      <NavigationMenuList>
        <NavigationMenuItem value="courses">
          <NavigationMenuTrigger className="bg-transparent hover:bg-accent">
            <span>All Courses</span>
            <ChevronDown className="ml-1 h-4 w-4" />
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="w-[1100px] p-6 max-h-[600px] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-4">
                    Explore by Goal
                  </h3>
                  <ul className="space-y-2">
                    {goals?.map((goal: any) => (
                      <li key={goal.id}>
                        <Link
                          to={goal.link_type === 'courses' ? `/explore/${goal.slug}` : (goal.link_url || `/explore/${goal.slug}`)}
                          className="text-sm text-muted-foreground hover:text-primary transition-colors block py-1"
                          onClick={(e) => handleGoalClick(goal, e)}
                        >
                          {goal.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-4">
                    Browse by Class/Exam
                  </h3>
                  <ul className="space-y-3">
                    {categories?.slice(0, Math.ceil((categories?.length || 0) / 2)).map((category) => (
                      <li key={category.id}>
                        <Link
                          to={`/programs/${category.slug}`}
                          onClick={closeMenu} className="text-sm font-medium text-foreground hover:text-primary transition-colors block"
                        >
                          <CategoryIcon icon={category.icon} className="mr-2" size="sm" />
                          {getCategoryDisplayName(category.name)}
                        </Link>
                        <ul className="ml-6 mt-1 space-y-1">
                          {category.subcategories.map((sub) => (
                            <li key={sub.id}>
                              <Link
                                to={`/programs/${category.slug}/${sub.slug}`}
                                onClick={closeMenu} className="text-xs text-muted-foreground hover:text-primary transition-colors block"
                              >
                                {sub.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-4 invisible">
                    Browse by Class/Exam
                  </h3>
                  <ul className="space-y-3">
                    {categories?.slice(Math.ceil((categories?.length || 0) / 2)).map((category) => (
                      <li key={category.id}>
                        <Link
                          to={`/programs/${category.slug}`}
                          onClick={closeMenu} className="text-sm font-medium text-foreground hover:text-primary transition-colors block"
                        >
                          <CategoryIcon icon={category.icon} className="mr-2" size="sm" />
                          {getCategoryDisplayName(category.name)}
                        </Link>
                        <ul className="ml-6 mt-1 space-y-1">
                          {category.subcategories.map((sub) => (
                            <li key={sub.id}>
                              <Link
                                to={`/programs/${category.slug}/${sub.slug}`}
                                onClick={closeMenu} className="text-xs text-muted-foreground hover:text-primary transition-colors block"
                              >
                                {sub.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
};
