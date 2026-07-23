import { Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Users, Edit, Trash2, UserPlus, Eye } from "lucide-react";
import { EnrollStudentDialog } from "@/components/admin/EnrollStudentDialog";
import { useAdminBatches, useDeleteBatch } from "@/hooks/useAdminBatches";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

export default function BatchesList() {
  const { data: batches, isLoading } = useAdminBatches();
  const deleteBatch = useDeleteBatch();
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);

  const handleDelete = (id: string) => {
    deleteBatch.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Manage Batches</h1>
          <p className="text-muted-foreground">Create and manage course batches</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEnrollDialogOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Enroll Student
          </Button>
          <Button asChild>
            <Link to="/admin/batches/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Batch
            </Link>
          </Button>
        </div>
      </div>

      {batches && batches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No batches yet</p>
            <p className="text-muted-foreground mb-4">Create your first batch to get started</p>
            <Button asChild>
              <Link to="/admin/batches/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Batch
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {batches?.map((batch) => (
            <Card key={batch.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-2">{batch.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {batch.course?.name || "Course"}
                    </CardDescription>
                  </div>
                  <Badge variant={batch.is_active ? "default" : "secondary"}>
                    {batch.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>
                      {format(new Date(batch.start_date), "MMM dd, yyyy")}
                      {batch.end_date && ` - ${format(new Date(batch.end_date), "MMM dd, yyyy")}`}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="mr-2 h-4 w-4" />
                    <span>
                      {batch.current_students} / {batch.max_students || "Unlimited"} students
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/batches/${batch.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      Students
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/batches/${batch.id}/edit`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Batch</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{batch.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(batch.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EnrollStudentDialog 
        isOpen={enrollDialogOpen} 
        onClose={() => setEnrollDialogOpen(false)} 
      />
    </div>
  );
}
