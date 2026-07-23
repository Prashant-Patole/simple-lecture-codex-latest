import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSubjectCourses } from "@/hooks/useSubjectCourses";

interface SubjectCoursesTabProps {
  subjectId: string;
  subjectName: string;
}

export const SubjectCoursesTab = ({ subjectId, subjectName }: SubjectCoursesTabProps) => {
  const { data: courses, isLoading } = useSubjectCourses(subjectId);
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Courses using {subjectName}</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          List of all courses where this subject is included
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading courses...</p>
        ) : courses && courses.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course Name</TableHead>
                <TableHead>Price (INR)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="font-medium">{course.name}</TableCell>
                  <TableCell>₹{course.price_inr?.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={course.is_active ? "default" : "secondary"}>
                      {course.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/admin/courses/${course.id}/edit`)}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Course
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            This subject is not used in any courses yet
          </p>
        )}
      </CardContent>
    </Card>
  );
};
