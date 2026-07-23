import { CourseSubjectCard } from './CourseSubjectCard';
import { BookOpen } from 'lucide-react';
import type { CourseWithSubjects } from '@/hooks/useDashboardCourseDetails';

interface CourseTabContentProps {
  course: CourseWithSubjects;
}

export const CourseTabContent = ({ course }: CourseTabContentProps) => {
  if (!course.subjects.length) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No subjects found</h3>
        <p className="text-muted-foreground">
          Subjects will appear here once they are added to this course.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {course.subjects.map((subject) => (
        <CourseSubjectCard 
          key={subject.id} 
          subject={subject} 
          courseId={course.id}
        />
      ))}
    </div>
  );
};
