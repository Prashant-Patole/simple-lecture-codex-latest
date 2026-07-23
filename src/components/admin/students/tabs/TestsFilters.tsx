import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface TestsFiltersProps {
  courses: string[];
  subjects: string[];
  selectedCourse: string;
  selectedSubject: string;
  selectedDateRange: string;
  selectedTestType: string;
  onCourseChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onDateRangeChange: (value: string) => void;
  onTestTypeChange: (value: string) => void;
  onReset: () => void;
}

export const TestsFilters = ({
  courses,
  subjects,
  selectedCourse,
  selectedSubject,
  selectedDateRange,
  selectedTestType,
  onCourseChange,
  onSubjectChange,
  onDateRangeChange,
  onTestTypeChange,
  onReset,
}: TestsFiltersProps) => {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-lg">
      <Select value={selectedCourse} onValueChange={onCourseChange}>
        <SelectTrigger className="w-[180px] bg-background">
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
        <SelectTrigger className="w-[180px] bg-background">
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

      <Select value={selectedDateRange} onValueChange={onDateRangeChange}>
        <SelectTrigger className="w-[150px] bg-background">
          <SelectValue placeholder="Date Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="7">Last 7 days</SelectItem>
          <SelectItem value="30">Last 30 days</SelectItem>
          <SelectItem value="90">Last 90 days</SelectItem>
        </SelectContent>
      </Select>

      <Select value={selectedTestType} onValueChange={onTestTypeChange}>
        <SelectTrigger className="w-[150px] bg-background">
          <SelectValue placeholder="Test Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="dpt">DPT</SelectItem>
          <SelectItem value="assignment">Assignments</SelectItem>
          <SelectItem value="quiz">Quizzes</SelectItem>
        </SelectContent>
      </Select>

      {(selectedCourse !== "all" || selectedSubject !== "all" || selectedDateRange !== "all" || selectedTestType !== "all") && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="h-4 w-4 mr-1" />
          Reset
        </Button>
      )}
    </div>
  );
};
