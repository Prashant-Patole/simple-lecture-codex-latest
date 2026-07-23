import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Student } from "@/hooks/useStudents";
import { format } from "date-fns";

interface StudentListTableProps {
  students: Student[];
  onStudentClick: (studentId: string) => void;
}

export const StudentListTable = ({ students, onStudentClick }: StudentListTableProps) => {
  const getStatusBadge = (status: string, atRisk: boolean) => {
    if (atRisk) {
      return <Badge variant="destructive">At Risk</Badge>;
    }
    if (status === "active") {
      return <Badge variant="default">Active</Badge>;
    }
    return <Badge variant="secondary">Inactive</Badge>;
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return format(new Date(dateStr), "dd MMM yyyy, hh:mm a");
    } catch {
      return "—";
    }
  };

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Registered At</TableHead>
            <TableHead>Courses Purchased</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                No students found
              </TableCell>
            </TableRow>
          ) : (
            students.map((student) => (
              <TableRow
                key={student.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onStudentClick(student.id)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={student.avatar_url || undefined} />
                      <AvatarFallback>{student.full_name.split(" ").map(n => n[0]).join("")}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{student.full_name}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground">{student.phone || "No phone"}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm">{formatDateTime(student.registered_at)}</p>
                </TableCell>
                <TableCell>
                  {student.courses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No courses</p>
                  ) : (
                    <div className="space-y-1.5 max-w-[300px]">
                      {student.courses.map((course) => (
                        <div key={course.id} className="flex items-start gap-2 text-sm">
                          <Badge variant="outline" className="shrink-0 text-xs font-normal">
                            {formatDateTime(course.enrolled_at)}
                          </Badge>
                          <span className="truncate font-medium">{course.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {getStatusBadge(student.status, student.at_risk)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};