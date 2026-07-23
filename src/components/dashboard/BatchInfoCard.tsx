import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";
import { useStudentBatchInfo } from "@/hooks/useBatchStudents";

export function BatchInfoCard() {
  const { data: enrollments, isLoading } = useStudentBatchInfo();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Batches</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (!enrollments || enrollments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Batches</CardTitle>
          <CardDescription>You are not enrolled in any courses yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {enrollments.map((enrollment) => (
        <Card key={enrollment.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg">{enrollment.courses?.name}</CardTitle>
                {enrollment.batches && (
                  <CardDescription className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">{enrollment.batches.name}</Badge>
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          
          {enrollment.batches && (
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Started:</span>
                  <span>{format(new Date(enrollment.batches.start_date), 'PPP')}</span>
                </div>

                {enrollment.batches.end_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Ends:</span>
                    <span>{format(new Date(enrollment.batches.end_date), 'PPP')}</span>
                  </div>
                )}

                {enrollment.batches.max_students && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Students:</span>
                    <span>
                      {enrollment.batches.current_students}/{enrollment.batches.max_students}
                    </span>
                    <div className="flex-1">
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary"
                          style={{ 
                            width: `${(enrollment.batches.current_students / enrollment.batches.max_students) * 100}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}