import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Mail, Phone } from "lucide-react";
import { useTeachers } from "@/hooks/useTeachers";
import { Button } from "@/components/ui/button";

export const TeachersList = () => {
  const { teachers, isLoading } = useTeachers();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Teachers Assigned</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Teachers Assigned ({teachers.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {teachers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No teachers assigned yet</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {teachers.map((teacher) => (
                <div
                  key={teacher.id}
                  className="p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={teacher.avatar_url || ''} />
                      <AvatarFallback>
                        {teacher.full_name[0]}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm mb-1">{teacher.full_name}</h4>
                      
                      <div className="flex flex-wrap gap-1 mb-2">
                        {teacher.subjects.map((subject) => (
                          <Badge key={subject} variant="secondary" className="text-xs">
                            {subject}
                          </Badge>
                        ))}
                      </div>

                      {teacher.bio && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {teacher.bio}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 text-xs">
                        {teacher.email && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            asChild
                          >
                            <a href={`mailto:${teacher.email}`}>
                              <Mail className="h-3 w-3 mr-1" />
                              Email
                            </a>
                          </Button>
                        )}
                        {teacher.phone_number && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            asChild
                          >
                            <a href={`tel:${teacher.phone_number}`}>
                              <Phone className="h-3 w-3 mr-1" />
                              Call
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
