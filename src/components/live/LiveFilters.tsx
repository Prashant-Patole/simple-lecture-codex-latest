import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface FilterOption {
  id: string;
  name?: string;
  title?: string;
  course_id?: string;
  subject_id?: string;
}

interface LiveFiltersProps {
  courses: FilterOption[];
  subjects: FilterOption[];
  chapters: FilterOption[];
  courseFilter: string;
  subjectFilter: string;
  chapterFilter: string;
  onCourseChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onChapterChange: (value: string) => void;
  onClearFilters: () => void;
}

export function LiveFilters({
  courses,
  subjects,
  chapters,
  courseFilter,
  subjectFilter,
  chapterFilter,
  onCourseChange,
  onSubjectChange,
  onChapterChange,
  onClearFilters,
}: LiveFiltersProps) {
  // Filter subjects based on selected course
  const filteredSubjects = courseFilter === 'all' 
    ? subjects 
    : subjects.filter(s => s.course_id === courseFilter);

  // Filter chapters based on selected subject
  const filteredChapters = subjectFilter === 'all'
    ? chapters
    : chapters.filter(c => c.subject_id === subjectFilter);

  const hasActiveFilters = courseFilter !== 'all' || subjectFilter !== 'all' || chapterFilter !== 'all';

  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3 mb-6">
      <Select value={courseFilter} onValueChange={onCourseChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Courses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Courses</SelectItem>
          {courses.map((course) => (
            <SelectItem key={course.id} value={course.id}>
              {course.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={subjectFilter} onValueChange={onSubjectChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Subjects" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Subjects</SelectItem>
          {filteredSubjects.map((subject) => (
            <SelectItem key={subject.id} value={subject.id}>
              {subject.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={chapterFilter} onValueChange={onChapterChange}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <SelectValue placeholder="All Chapters" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Chapters</SelectItem>
          {filteredChapters.map((chapter) => (
            <SelectItem key={chapter.id} value={chapter.id}>
              {chapter.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClearFilters}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
