import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useCourseSubjects } from "@/hooks/useCourseSubjects";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface CourseInstructorsTabProps {
  courseId?: string;
}

export const CourseInstructorsTab = ({ courseId }: CourseInstructorsTabProps) => {
  const { data: courseSubjects } = useCourseSubjects(courseId);

  // Fetch all instructors mapped to the course's subjects
  const subjectIds = courseSubjects?.map((cs: any) => cs.subject_id) || [];
  
  const { data: subjectInstructors = [], isLoading } = useQuery({
    queryKey: ["subject-instructors", courseId, subjectIds],
    queryFn: async () => {
      if (!courseId || subjectIds.length === 0) return [];

      const { data, error } = await supabase
        .from("instructor_subjects")
        .select(`
          id,
          instructor_id,
          subject_id,
          instructor:teacher_profiles!instructor_subjects_instructor_id_fkey (
            id,
            full_name,
            email
          ),
          subject:popular_subjects (
            id,
            name
          )
        `)
        .in("subject_id", subjectIds);

      if (error) throw error;

      // Format and return all instructors with their subjects
      return data?.filter((item: any) => item.instructor && item.subject).map((item: any) => ({
        id: item.id,
        instructorId: item.instructor.id,
        instructorName: item.instructor.full_name,
        instructorEmail: item.instructor.email,
        subjectId: item.subject.id,
        subjectName: item.subject.name,
      })) || [];
    },
    enabled: !!courseId && subjectIds.length > 0,
  });


  if (!courseId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Save the course first to manage instructors
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Course Instructors</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Instructors mapped to subjects in this course
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading instructors...</p>
        ) : subjectInstructors && subjectInstructors.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Instructor Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Mapped Subject</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjectInstructors.map((si) => (
                <TableRow key={si.id}>
                  <TableCell className="font-medium">{si.instructorName}</TableCell>
                  <TableCell>{si.instructorEmail}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{si.subjectName}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No instructors mapped to the subjects in this course yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
