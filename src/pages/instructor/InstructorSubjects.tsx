import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Layers, FileText } from "lucide-react";
import { useInstructorSubjectsAssigned } from "@/hooks/useInstructorSubjectsAssigned";
import { useLogInstructorActivity } from "@/hooks/useLogInstructorActivity";
import { Loader2 } from "lucide-react";

export default function InstructorSubjects() {
  const { data: subjects, isLoading } = useInstructorSubjectsAssigned();
  const logActivity = useLogInstructorActivity();

  useEffect(() => {
    logActivity.mutate({
      action: "Viewed assigned subjects",
      action_type: "VIEW_SUBJECTS",
      metadata: {}
    });
  }, []);

  const handleViewSubject = (subject: any) => {
    logActivity.mutate({
      action: `Viewed subject: ${subject.subject?.name}`,
      action_type: "VIEW_SUBJECT",
      metadata: { 
        subject_id: subject.subject?.id,
        subject_name: subject.subject?.name,
        course_name: subject.course?.name
      }
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Subjects</h1>
        <p className="text-muted-foreground">View the subjects assigned to you.</p>
      </div>

      {subjects?.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No subjects have been assigned to you yet.</p>
            <p className="text-sm">Contact your administrator to get subjects assigned.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {subjects?.map((item) => (
            <Card 
              key={item.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleViewSubject(item)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{(item.subject as any)?.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {(item.course as any)?.name}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {(item.subject as any)?.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {(item.subject as any).description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    Subject
                  </Badge>
                  {item.course && (
                    <Badge variant="outline" className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {item.course.name}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
