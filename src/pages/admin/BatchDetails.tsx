import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Calendar, UserMinus, UserPlus } from "lucide-react";
import { useAdminBatches } from "@/hooks/useAdminBatches";
import { useBatchStudents } from "@/hooks/useBatchStudents";
import { useUpdateEnrollmentBatch, useUnenrollStudent } from "@/hooks/useEnrollmentWithBatch";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function BatchDetails() {
  const { batchId } = useParams();
  const navigate = useNavigate();
  const [moveStudentId, setMoveStudentId] = useState<string | null>(null);
  const [targetBatchId, setTargetBatchId] = useState("");
  const [unenrollStudentId, setUnenrollStudentId] = useState<string | null>(null);

  const { data: batches } = useAdminBatches();
  const { data: students } = useBatchStudents(batchId);
  const updateBatchMutation = useUpdateEnrollmentBatch();
  const unenrollMutation = useUnenrollStudent();

  const currentBatch = batches?.find(b => b.id === batchId);
  const otherBatches = batches?.filter(b => 
    b.id !== batchId && 
    b.course_id === currentBatch?.course_id && 
    b.is_active
  );

  const handleMoveToBatch = async () => {
    if (!moveStudentId || !targetBatchId) return;

    await updateBatchMutation.mutateAsync({
      enrollment_id: moveStudentId,
      old_batch_id: batchId || null,
      new_batch_id: targetBatchId,
    });

    setMoveStudentId(null);
    setTargetBatchId("");
  };

  const handleUnenroll = async () => {
    if (!unenrollStudentId) return;

    await unenrollMutation.mutateAsync({
      enrollment_id: unenrollStudentId,
      batch_id: batchId || null,
    });

    setUnenrollStudentId(null);
  };

  if (!currentBatch) {
    return (
      <div className="container mx-auto p-6">
        <p>Batch not found</p>
      </div>
    );
  }

  const capacityPercentage = currentBatch.max_students
    ? (currentBatch.current_students / currentBatch.max_students) * 100
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigate('/admin/batches')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{currentBatch.name}</h1>
          <p className="text-muted-foreground">Batch Details & Student Management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Enrollment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Students</span>
                <span className="font-medium">{currentBatch.current_students}</span>
              </div>
              {currentBatch.max_students && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Max Capacity</span>
                    <span className="font-medium">{currentBatch.max_students}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        capacityPercentage >= 100 ? 'bg-destructive' :
                        capacityPercentage >= 80 ? 'bg-yellow-500' : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(capacityPercentage, 100)}%` }}
                    />
                  </div>
                  <Badge variant={capacityPercentage >= 100 ? "destructive" : "secondary"}>
                    {capacityPercentage.toFixed(0)}% Full
                  </Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Start Date:</span>
                <p className="font-medium">{format(new Date(currentBatch.start_date), 'PPP')}</p>
              </div>
              {currentBatch.end_date && (
                <div>
                  <span className="text-muted-foreground">End Date:</span>
                  <p className="font-medium">{format(new Date(currentBatch.end_date), 'PPP')}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={currentBatch.is_active ? "default" : "secondary"}>
              {currentBatch.is_active ? "Active" : "Inactive"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enrolled Students ({students?.length || 0})</CardTitle>
          <CardDescription>Manage student enrollments for this batch</CardDescription>
        </CardHeader>
        <CardContent>
          {students && students.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Enrolled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((enrollment) => (
                  <TableRow key={enrollment.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={enrollment.profiles?.avatar_url || ""} />
                          <AvatarFallback>
                            {enrollment.profiles?.full_name?.charAt(0) || "S"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {enrollment.profiles?.full_name || "Unknown"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{enrollment.student_id}</TableCell>
                    <TableCell>{enrollment.profiles?.phone_number || "—"}</TableCell>
                    <TableCell>
                      {format(new Date(enrollment.enrolled_at), 'PP')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {otherBatches && otherBatches.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMoveStudentId(enrollment.id)}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Move
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setUnenrollStudentId(enrollment.id)}
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Unenroll
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No students enrolled in this batch yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Move Student Dialog */}
      <AlertDialog open={!!moveStudentId} onOpenChange={() => setMoveStudentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move Student to Another Batch</AlertDialogTitle>
            <AlertDialogDescription>
              Select the target batch for this student
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={targetBatchId} onValueChange={setTargetBatchId}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select target batch" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {otherBatches?.map((batch) => (
                  <SelectItem key={batch.id} value={batch.id}>
                    {batch.name} ({batch.current_students}/{batch.max_students || '∞'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setMoveStudentId(null);
              setTargetBatchId("");
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMoveToBatch}
              disabled={!targetBatchId || updateBatchMutation.isPending}
            >
              {updateBatchMutation.isPending ? "Moving..." : "Move Student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unenroll Confirmation */}
      <AlertDialog open={!!unenrollStudentId} onOpenChange={() => setUnenrollStudentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unenroll Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unenroll this student? This will remove their access to the course.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              disabled={unenrollMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {unenrollMutation.isPending ? "Unenrolling..." : "Unenroll"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}