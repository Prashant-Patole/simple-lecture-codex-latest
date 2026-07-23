import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useInstructorTimetable } from "@/hooks/useInstructorTimetable";
import { DraggableTimetableGrid } from "@/components/hr/DraggableTimetableGrid";
import { TimetablePDFExport } from "@/components/hr/TimetablePDFExport";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInstructors } from "@/hooks/useInstructors";
import { AddTimeSlotDialog } from "@/components/hr/AddTimeSlotDialog";
import { Badge } from "@/components/ui/badge";

export default function TimetableManager() {
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { data: instructors } = useInstructors();
  const { data: timetable, isLoading } = useInstructorTimetable(selectedInstructorId || undefined);

  const selectedInstructor = instructors?.find(i => i.id === selectedInstructorId);

  // Calculate workload summary
  const calculateWorkload = () => {
    if (!timetable || timetable.length === 0) return { totalHours: 0, classesByDay: {} };
    
    const classesByDay: Record<number, number> = {};
    let totalMinutes = 0;

    timetable.forEach(entry => {
      const start = new Date(`2000-01-01T${entry.start_time}`);
      const end = new Date(`2000-01-01T${entry.end_time}`);
      const minutes = (end.getTime() - start.getTime()) / (1000 * 60);
      totalMinutes += minutes;
      
      classesByDay[entry.day_of_week] = (classesByDay[entry.day_of_week] || 0) + 1;
    });

    return {
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      classesByDay,
    };
  };

  const workload = calculateWorkload();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instructor Timetable</h1>
          <p className="text-muted-foreground">View and manage individual instructor schedules</p>
        </div>
        <div className="flex gap-2">
          {selectedInstructorId && timetable && timetable.length > 0 && (
            <TimetablePDFExport
              entries={timetable}
              title={`Timetable - ${selectedInstructor?.full_name || "Instructor"}`}
              subtitle={`Weekly Schedule`}
            />
          )}
          <Button 
            onClick={() => setIsAddDialogOpen(true)}
            disabled={!selectedInstructorId}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Time Slot
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Instructor</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedInstructorId} onValueChange={setSelectedInstructorId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select instructor" />
            </SelectTrigger>
            <SelectContent>
              {instructors?.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedInstructor && selectedInstructorId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Instructor Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{selectedInstructor.full_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subjects</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedInstructor.subjects?.map((subject: any) => (
                    <Badge key={subject.id} variant="secondary">
                      {subject.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-muted-foreground">Total Classes</p>
                  <p className="text-2xl font-bold">{timetable?.length || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Weekly Hours</p>
                  <p className="text-2xl font-bold">{workload.totalHours}h</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Weekly Schedule</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Drag entries to move them • Click edit icon to modify
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p>Loading timetable...</p>
              ) : timetable && timetable.length > 0 ? (
                <DraggableTimetableGrid 
                  entries={timetable} 
                  enableDragDrop={true}
                  enableEdit={true}
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No timetable entries found. Click "Add Time Slot" to create one.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedInstructorId && (
        <Card>
          <CardContent className="py-12">
            <p className="text-muted-foreground text-center">
              Select an instructor to view their timetable
            </p>
          </CardContent>
        </Card>
      )}

      {selectedInstructorId && (
        <AddTimeSlotDialog
          open={isAddDialogOpen}
          onOpenChange={setIsAddDialogOpen}
          instructorId={selectedInstructorId}
        />
      )}
    </div>
  );
}
