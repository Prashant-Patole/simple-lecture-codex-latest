import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Video } from "lucide-react";
import { useScheduledClasses } from "@/hooks/useScheduledClasses";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { LiveClassDialog } from "@/components/hr/LiveClassDialog";

export default function LiveClassesManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<any>(null);
  const { classes, isLoading } = useScheduledClasses();

  const handleCreateNew = () => {
    setSelectedClass(null);
    setDialogOpen(true);
  };

  const handleEdit = (cls: any) => {
    setSelectedClass(cls);
    setDialogOpen(true);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live Classes</h1>
          <p className="text-muted-foreground">Manage scheduled live classes and meetings</p>
        </div>
        <Button onClick={handleCreateNew}>
          <Video className="mr-2 h-4 w-4" />
          Create Live Class
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Scheduled Classes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Instructor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Meeting Link</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {classes?.map((cls) => (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">{cls.subject}</TableCell>
                    <TableCell>
                      {format(new Date(cls.scheduled_at), "MMM dd, yyyy h:mm a")}
                    </TableCell>
                    <TableCell>{cls.teacher?.full_name || "-"}</TableCell>
                    <TableCell>
                      {cls.is_live ? (
                        <Badge className="bg-green-500">Live</Badge>
                      ) : cls.is_cancelled ? (
                        <Badge variant="destructive">Cancelled</Badge>
                      ) : (
                        <Badge variant="secondary">Scheduled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {cls.meeting_link ? (
                        <a
                          href={cls.meeting_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Join
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(cls)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LiveClassDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        classData={selectedClass}
      />
    </div>
  );
}
