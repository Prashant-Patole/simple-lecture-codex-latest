import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useSubjectInstructors, useAddSubjectInstructor, useRemoveSubjectInstructor } from "@/hooks/useSubjectInstructors";
import { useInstructors } from "@/hooks/useInstructors";
import { toast } from "@/hooks/use-toast";

interface SubjectInstructorsTabProps {
  subjectId: string;
  subjectName: string;
}

export const SubjectInstructorsTab = ({ subjectId, subjectName }: SubjectInstructorsTabProps) => {
  const { data: subjectInstructors, isLoading, error, refetch } = useSubjectInstructors(subjectId);
  const { data: allInstructors } = useInstructors();

  // Show error toast if query fails
  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading instructors",
        description: "Failed to fetch subject instructors. Please try again.",
        variant: "destructive",
        action: (
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        ),
      });
    }
  }, [error, refetch]);
  const addInstructor = useAddSubjectInstructor();
  const removeInstructor = useRemoveSubjectInstructor();
  
  const [selectedInstructorId, setSelectedInstructorId] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddInstructor = () => {
    if (selectedInstructorId) {
      addInstructor.mutate(
        { subjectId, instructorId: selectedInstructorId },
        {
          onSuccess: () => {
            setSelectedInstructorId("");
            setDialogOpen(false);
          },
        }
      );
    }
  };

  const handleRemoveInstructor = (instructorId: string) => {
    removeInstructor.mutate({ subjectId, instructorId });
  };

  // Filter out instructors already assigned to this subject
  const availableInstructors = allInstructors?.filter(
    (inst) => !subjectInstructors?.some((si) => si.instructor_id === inst.id)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Instructors for {subjectName}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage instructors assigned to teach this subject
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Instructor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Instructor</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Select Instructor</Label>
                  <Select value={selectedInstructorId} onValueChange={setSelectedInstructorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an instructor" />
                    </SelectTrigger>
                    <SelectContent className="bg-background z-50">
                      {availableInstructors?.map((instructor) => (
                        <SelectItem key={instructor.id} value={instructor.id}>
                          {instructor.full_name} ({instructor.department?.name || "No Department"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleAddInstructor} disabled={!selectedInstructorId || addInstructor.isPending}>
                  {addInstructor.isPending ? "Adding..." : "Add Instructor"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Loading instructors...</p>
        ) : subjectInstructors && subjectInstructors.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjectInstructors.map((si) => (
                <TableRow key={si.id}>
                  <TableCell className="font-medium">{si.teacher?.full_name || "N/A"}</TableCell>
                  <TableCell>{si.teacher?.email || "N/A"}</TableCell>
                  <TableCell>{si.teacher?.phone_number || "N/A"}</TableCell>
                  <TableCell>{si.teacher?.department?.name || "N/A"}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveInstructor(si.instructor_id)}
                      disabled={removeInstructor.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            No instructors assigned to this subject yet
          </p>
        )}
      </CardContent>
    </Card>
  );
};
