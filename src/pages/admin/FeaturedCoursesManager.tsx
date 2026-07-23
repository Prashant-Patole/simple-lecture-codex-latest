import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, GripVertical, Star, Users, ArrowUp, ArrowDown } from "lucide-react";
import { useAdminCategories } from "@/hooks/useAdminCategories";
import { SearchableCategorySelector } from "@/components/admin/SearchableCategorySelector";
import { useAdminCourses } from "@/hooks/useAdminCourses";
import { 
  useAdminFeaturedCourses, 
  useAddFeaturedCourse, 
  useRemoveFeaturedCourse,
  useUpdateFeaturedCourseOrder,
  SectionType 
} from "@/hooks/useFeaturedCourses";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const FeaturedCoursesManager = () => {
  const [activeTab, setActiveTab] = useState<SectionType>("bestsellers");
  const [selectedParentCategory, setSelectedParentCategory] = useState<string>("");
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  const { data: categories } = useAdminCategories();
  const { data: featuredCourses, isLoading } = useAdminFeaturedCourses(activeTab);
  const addFeaturedCourse = useAddFeaturedCourse();
  const removeFeaturedCourse = useRemoveFeaturedCourse();
  const updateOrder = useUpdateFeaturedCourseOrder();

  // Get parent categories (level 1)
  const parentCategories = categories?.filter(c => c.level === 1) || [];
  
  // Get sub-categories based on selected parent
  const subCategories = categories?.filter(
    c => c.level === 2 && c.parent_id === selectedParentCategory
  ) || [];

  // Fetch courses filtered by category
  const { data: filteredCourses } = useQuery({
    queryKey: ["courses-by-category", selectedParentCategory, selectedSubCategory],
    queryFn: async () => {
      if (!selectedParentCategory && !selectedSubCategory) {
        const { data, error } = await supabase
          .from("courses")
          .select("id, name, slug")
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        return data;
      }

      // Get courses mapped to selected category or its children
      const categoryId = selectedSubCategory || selectedParentCategory;
      
      // Get all child category IDs if parent selected
      let categoryIds = [categoryId];
      if (!selectedSubCategory && selectedParentCategory) {
        const childIds = categories
          ?.filter(c => c.parent_id === selectedParentCategory)
          .map(c => c.id) || [];
        categoryIds = [categoryId, ...childIds];
      }

      const { data, error } = await supabase
        .from("course_categories")
        .select("course_id, courses!inner(id, name, slug, is_active)")
        .in("category_id", categoryIds)
        .eq("courses.is_active", true);

      if (error) throw error;
      
      // Deduplicate courses
      const uniqueCourses = data?.reduce((acc, item) => {
        const course = item.courses as any;
        if (!acc.find(c => c.id === course.id)) {
          acc.push(course);
        }
        return acc;
      }, [] as any[]) || [];

      return uniqueCourses.sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: true,
  });

  const handleAddCourse = () => {
    if (!selectedCourseId) return;
    
    const maxOrder = featuredCourses?.length 
      ? Math.max(...featuredCourses.map(fc => fc.display_order)) + 1 
      : 0;

    addFeaturedCourse.mutate({
      courseId: selectedCourseId,
      sectionType: activeTab,
      displayOrder: maxOrder,
    });
    setSelectedCourseId("");
  };

  const handleMoveUp = (index: number) => {
    if (index === 0 || !featuredCourses) return;
    
    const updates = [
      { id: featuredCourses[index].id, display_order: featuredCourses[index - 1].display_order },
      { id: featuredCourses[index - 1].id, display_order: featuredCourses[index].display_order },
    ];
    updateOrder.mutate(updates);
  };

  const handleMoveDown = (index: number) => {
    if (!featuredCourses || index === featuredCourses.length - 1) return;
    
    const updates = [
      { id: featuredCourses[index].id, display_order: featuredCourses[index + 1].display_order },
      { id: featuredCourses[index + 1].id, display_order: featuredCourses[index].display_order },
    ];
    updateOrder.mutate(updates);
  };

  // Filter out courses already in the section
  const availableCourses = filteredCourses?.filter(
    course => !featuredCourses?.some(fc => fc.course_id === course.id)
  ) || [];

  return (
    <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Featured Courses Manager</h1>
          <p className="text-muted-foreground">
            Manage courses displayed in Bestsellers and Top Courses sections on the home page
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SectionType)}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="bestsellers">
              <Star className="w-4 h-4 mr-2" />
              Bestsellers
            </TabsTrigger>
            <TabsTrigger value="top_courses">
              <Users className="w-4 h-4 mr-2" />
              Top Courses
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {/* Add Course Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Add Course to {activeTab === 'bestsellers' ? 'Bestsellers' : 'Top Courses'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Parent Category Filter */}
                  <SearchableCategorySelector
                    value={selectedParentCategory || "all"}
                    onChange={(v) => {
                      setSelectedParentCategory(v === "all" ? "" : v);
                      setSelectedSubCategory("");
                      setSelectedCourseId("");
                    }}
                    showAllOption
                    allOptionLabel="All Categories"
                    placeholder="Search category..."
                  />

                  {/* Sub-Category Filter */}
                  <Select 
                    value={selectedSubCategory || "__all__"} 
                    onValueChange={(v) => {
                      setSelectedSubCategory(v === "__all__" ? "" : v);
                      setSelectedCourseId("");
                    }}
                    disabled={!selectedParentCategory}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Sub-Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Sub-Categories</SelectItem>
                      {subCategories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Course Selection */}
                  <Select 
                    value={selectedCourseId} 
                    onValueChange={setSelectedCourseId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Course" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCourses.length === 0 ? (
                        <SelectItem value="__none__" disabled>No courses available</SelectItem>
                      ) : (
                        availableCourses.map(course => (
                          <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>

                  <Button 
                    onClick={handleAddCourse} 
                    disabled={!selectedCourseId || addFeaturedCourse.isPending}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Course
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Featured Courses List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {activeTab === 'bestsellers' ? 'Bestsellers' : 'Top Courses'} 
                  <Badge variant="secondary">{featuredCourses?.length || 0} courses</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : featuredCourses?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No courses added yet. Add courses using the form above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {featuredCourses?.map((fc, index) => (
                      <div 
                        key={fc.id} 
                        className="flex items-center gap-4 p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                      >
                        <GripVertical className="w-5 h-5 text-muted-foreground" />
                        
                        <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                          {fc.courses?.thumbnail_url ? (
                            <img 
                              src={fc.courses.thumbnail_url} 
                              alt={fc.courses.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-muted flex items-center justify-center text-xs">
                              No img
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium truncate">{fc.courses?.name}</h4>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>₹{fc.courses?.price_inr?.toLocaleString() || 0}</span>
                            {fc.courses?.rating && (
                              <span className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                {fc.courses.rating}
                              </span>
                            )}
                            {fc.courses?.student_count && (
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {fc.courses.student_count.toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === (featuredCourses?.length || 0) - 1}
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeFeaturedCourse.mutate(fc.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
  );
};

export default FeaturedCoursesManager;
