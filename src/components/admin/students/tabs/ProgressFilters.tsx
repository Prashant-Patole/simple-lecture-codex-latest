import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ProgressFiltersProps {
  courses: string[];
  subjects: string[];
  selectedCourse: string;
  selectedSubject: string;
  onCourseChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onReset: () => void;
  onCourseChangeCallback?: () => void;
}

export const ProgressFilters = ({
  courses,
  subjects,
  selectedCourse,
  selectedSubject,
  onCourseChange,
  onSubjectChange,
  onReset,
  onCourseChangeCallback,
}: ProgressFiltersProps) => {
  const handleCourseChange = (value: string) => {
    onCourseChange(value);
    onCourseChangeCallback?.();
  };
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-lg">
      <Select value={selectedCourse} onValueChange={handleCourseChange}>
        <SelectTrigger className="w-[200px] bg-background">
          <SelectValue placeholder="All Courses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Courses</SelectItem>
          {courses.map((course) => (
            <SelectItem key={course} value={course}>
              {course}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={selectedSubject} onValueChange={onSubjectChange}>
        <SelectTrigger className="w-[200px] bg-background">
          <SelectValue placeholder="All Subjects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Subjects</SelectItem>
          {subjects.map((subject) => (
            <SelectItem key={subject} value={subject}>
              {subject}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(selectedCourse !== "all" || selectedSubject !== "all") && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="h-4 w-4 mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
};
