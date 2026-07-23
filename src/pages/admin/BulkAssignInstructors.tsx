import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, UserCheck, AlertCircle, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Subject {
  id: string;
  name: string;
  instructors: { id: string; name: string }[];
}

interface Instructor {
  id: string;
  full_name: string;
  email: string;
  department?: { name: string } | null;
}

const BulkAssignInstructors = () => {
  const queryClient = useQueryClient();
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedInstructor, setSelectedInstructor] = useState<string>("");

  // Fetch all subjects with their current instructors
  const { data: subjects, isLoading: loadingSubjects } = useQuery({
    queryKey: ["subjects-with-instructors"],
    queryFn: async () => {
      const { data: subjectsData, error: subjectsError } = await supabase
        .from("popular_subjects")
        .select("id, name")
        .order("name");

      if (subjectsError) throw subjectsError;

      const { data: assignments, error: assignError } = await supabase
        .from("instructor_subjects")
        .select(`
          subject_id,
          instructor_id,
          teacher_profiles!instructor_subjects_instructor_id_fkey (id, full_name)
        `);

      if (assignError) throw assignError;

      return subjectsData.map((subject) => {
        const subjectAssignments = assignments?.filter(a => a.subject_id === subject.id) || [];
        return {
          id: subject.id,
          name: subject.name,
          instructors: subjectAssignments
            .filter(a => a.teacher_profiles)
            .map(a => ({
              id: a.instructor_id!,
              name: (a.teacher_profiles as any)?.full_name || "Unknown"
            }))
        };
      }) as Subject[];
    }
  });

  // Fetch all instructors
  const { data: instructors, isLoading: loadingInstructors } = useQuery({
    queryKey: ["all-instructors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_profiles")
        .select(`
          id,
          full_name,
          email,
          departments!teacher_profiles_department_id_fkey (name)
        `)
        .order("full_name");

      if (error) throw error;
      return data.map(i => ({
        id: i.id,
        full_name: i.full_name,
        email: i.email,
        department: i.departments
      })) as Instructor[];
    }
  });

  // Bulk assign mutation
  const bulkAssign = useMutation({
    mutationFn: async ({ subjectIds, instructorId }: { subjectIds: string[]; instructorId: string }) => {
      const { data: existing, error: fetchError } = await supabase
        .from("instructor_subjects")
        .select("subject_id")
        .eq("instructor_id", instructorId);

      if (fetchError) throw fetchError;

      const existingSubjectIds = new Set(existing?.map(e => e.subject_id) || []);
      const newSubjectIds = subjectIds.filter(id => !existingSubjectIds.has(id));

      if (newSubjectIds.length === 0) {
        throw new Error("All selected subjects are already assigned to this instructor");
      }

      const { error: insertError } = await supabase
        .from("instructor_subjects")
        .insert(newSubjectIds.map(subjectId => ({
          subject_id: subjectId,
          instructor_id: instructorId
        })));

      if (insertError) throw insertError;

      return { assigned: newSubjectIds.length, skipped: subjectIds.length - newSubjectIds.length };
    },
    onSuccess: (result) => {
      toast.success(`Assigned ${result.assigned} subjects${result.skipped > 0 ? ` (${result.skipped} already assigned)` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["subjects-with-instructors"] });
      queryClient.invalidateQueries({ queryKey: ["instructors"] });
      queryClient.invalidateQueries({ queryKey: ["subject-instructors"] });
      queryClient.invalidateQueries({ queryKey: ["course-instructors"] });
      setSelectedSubjects([]);
      setSelectedInstructor("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSubjects(subjects?.map(s => s.id) || []);
    } else {
      setSelectedSubjects([]);
    }
  };

  const handleSelectSubject = (subjectId: string, checked: boolean) => {
    if (checked) {
      setSelectedSubjects([...selectedSubjects, subjectId]);
    } else {
      setSelectedSubjects(selectedSubjects.filter(id => id !== subjectId));
    }
  };

  const handleBulkAssign = () => {
    if (!selectedInstructor || selectedSubjects.length === 0) {
      toast.error("Please select an instructor and at least one subject");
      return;
    }
    bulkAssign.mutate({ subjectIds: selectedSubjects, instructorId: selectedInstructor });
  };

  const subjectsWithoutInstructors = useMemo(() => 
    subjects?.filter(s => s.instructors.length === 0) || [],
    [subjects]
  );

  const selectSubjectsWithoutInstructors = () => {
    setSelectedSubjects(subjectsWithoutInstructors.map(s => s.id));
  };

  const selectedInstructorName = instructors?.find(i => i.id === selectedInstructor)?.full_name;

  if (loadingSubjects || loadingInstructors) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Assign Instructors</h1>
        <p className="text-muted-foreground">
          Assign one instructor to multiple subjects at once
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{subjects?.length || 0}</p>
                <p className="text-sm text-muted-foreground">Total Subjects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <UserCheck className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {subjects?.filter(s => s.instructors.length > 0).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">With Instructors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{subjectsWithoutInstructors.length}</p>
                <p className="text-sm text-muted-foreground">Without Instructors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Assignment Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Assign Instructor to Subjects</CardTitle>
          <CardDescription>
            Select subjects below and choose an instructor to assign them to
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[250px]">
              <label className="text-sm font-medium mb-2 block">Select Instructor</label>
              <Select value={selectedInstructor} onValueChange={setSelectedInstructor}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an instructor" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {instructors?.map((instructor) => (
                    <SelectItem key={instructor.id} value={instructor.id}>
                      {instructor.full_name} ({instructor.department?.name || "No Dept"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              {subjectsWithoutInstructors.length > 0 && (
                <Button
                  variant="outline"
                  onClick={selectSubjectsWithoutInstructors}
                >
                  Select Unassigned ({subjectsWithoutInstructors.length})
                </Button>
              )}
              <Button
                onClick={handleBulkAssign}
                disabled={!selectedInstructor || selectedSubjects.length === 0 || bulkAssign.isPending}
              >
                {bulkAssign.isPending ? "Assigning..." : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Assign {selectedSubjects.length > 0 ? `(${selectedSubjects.length})` : ""}
                  </>
                )}
              </Button>
            </div>
          </div>

          {selectedInstructor && selectedSubjects.length > 0 && (
            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              Assigning <strong>{selectedSubjects.length}</strong> subject(s) to{" "}
              <strong>{selectedInstructorName}</strong>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subjects Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Subjects</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedSubjects.length === subjects?.length && subjects?.length > 0}
                    onCheckedChange={(checked) => handleSelectAll(checked as boolean)}
                  />
                </TableHead>
                <TableHead>Subject Name</TableHead>
                <TableHead>Assigned Instructors</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects?.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedSubjects.includes(subject.id)}
                      onCheckedChange={(checked) => handleSelectSubject(subject.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{subject.name}</TableCell>
                  <TableCell>
                    {subject.instructors.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {subject.instructors.map((inst) => (
                          <Badge key={inst.id} variant="secondary">
                            {inst.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {subject.instructors.length > 0 ? (
                      <Badge variant="default" className="bg-green-500">Assigned</Badge>
                    ) : (
                      <Badge variant="destructive">Unassigned</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default BulkAssignInstructors;
