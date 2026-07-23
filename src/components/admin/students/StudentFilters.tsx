import { useState } from "react";
import { Search, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { useAdminCourses } from "@/hooks/useAdminCourses";

interface StudentFiltersProps {
  onFilterChange: (filters: any) => void;
}

export const StudentFilters = ({ onFilterChange }: StudentFiltersProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    course: "all",
    status: "all",
    enrollmentDateFrom: "",
    enrollmentDateTo: "",
  });

  const { data: courses, isLoading: coursesLoading } = useAdminCourses();

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleReset = () => {
    const resetFilters = {
      search: "",
      course: "all",
      status: "all",
      enrollmentDateFrom: "",
      enrollmentDateTo: "",
    };
    setFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <div className="flex items-center justify-between">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            {isOpen ? "Hide Filters" : "Show Filters"}
          </Button>
        </CollapsibleTrigger>
      </div>

      <CollapsibleContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/50">
          <div className="space-y-2">
            <Label>Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name or phone..."
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Course</Label>
            <Select value={filters.course} onValueChange={(v) => handleFilterChange("course", v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {!coursesLoading && courses?.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filters.status} onValueChange={(v) => handleFilterChange("status", v)}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Enrollment Date</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.enrollmentDateFrom}
                onChange={(e) => handleFilterChange("enrollmentDateFrom", e.target.value)}
              />
              <Input
                type="date"
                value={filters.enrollmentDateTo}
                onChange={(e) => handleFilterChange("enrollmentDateTo", e.target.value)}
              />
            </div>
          </div>

          <div className="col-span-full flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <X className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};
