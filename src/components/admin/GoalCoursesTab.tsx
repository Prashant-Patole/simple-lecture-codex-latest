import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGoalCourses, useAddCourseToGoal, useRemoveCourseFromGoal } from "@/hooks/useGoalCourses";
import { useCoursesByCategory } from "@/hooks/useCoursesByCategory";
import { CategorySelector } from "@/components/admin/CategorySelector";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GoalCoursesTabProps {
  goalId: string;
}

export const GoalCoursesTab = ({ goalId }: GoalCoursesTabProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<string>("");

  const { data: mappedCourses, isLoading: loadingMapped } = useGoalCourses(goalId);
  const { data: allCourses, isLoading: loadingCourses } = useCoursesByCategory(
    selectedCategory === "all" ? undefined : selectedCategory
  );
  const addMutation = useAddCourseToGoal();
  const removeMutation = useRemoveCourseFromGoal();

  const mappedCourseIds = mappedCourses?.map((mc: any) => mc.course_id) || [];
  
  const availableCourses = allCourses?.filter((course) => 
    !mappedCourseIds.includes(course.id)
  );

  const handleAddCourse = () => {
    if (!selectedCourse) return;
    addMutation.mutate({ goalId, courseId: selectedCourse });
    setSelectedCourse("");
  };

  const handleRemoveCourse = (mappingId: string) => {
    removeMutation.mutate({ mappingId, goalId });
  };

  if (loadingMapped || loadingCourses) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add Courses to Goal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CategorySelector
            value={selectedCategory}
            onChange={setSelectedCategory}
            label="Filter by Category"
            showAllOption
            allOptionLabel="All Categories"
          />

          <div className="flex gap-2">
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a course to add" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {availableCourses?.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAddCourse}
              disabled={!selectedCourse || addMutation.isPending}
            >
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mapped Courses ({mappedCourses?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {!mappedCourses || mappedCourses.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No courses mapped yet. Add courses above to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {mappedCourses.map((mapping: any) => (
                <div
                  key={mapping.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{mapping.courses?.name}</h4>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary">
                        ₹{mapping.courses?.price_inr || 0}
                      </Badge>
                      {mapping.courses?.duration_months && (
                        <Badge variant="outline">
                          {mapping.courses.duration_months} {mapping.courses.duration_months === 1 ? 'month' : 'months'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleRemoveCourse(mapping.id)}
                    disabled={removeMutation.isPending}
                  >
                    {removeMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
