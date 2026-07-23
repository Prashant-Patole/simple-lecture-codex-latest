import { useInstructorTimetable } from "@/hooks/useInstructorTimetable";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface InstructorTimetableViewProps {
  instructorId: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const InstructorTimetableView = ({ instructorId }: InstructorTimetableViewProps) => {
  const { data: timetable, isLoading } = useInstructorTimetable(instructorId);

  if (isLoading) {
    return <p>Loading timetable...</p>;
  }

  if (!timetable || timetable.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        No timetable entries yet. Click "Add Time Slot" to get started.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Day</TableHead>
          <TableHead>Time</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Batch</TableHead>
          <TableHead>Room</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {timetable.map((entry: any) => (
          <TableRow key={entry.id}>
            <TableCell>{DAYS[entry.day_of_week]}</TableCell>
            <TableCell>
              {entry.start_time} - {entry.end_time}
            </TableCell>
            <TableCell>{entry.subject?.name || "-"}</TableCell>
            <TableCell>{entry.batch?.name || "-"}</TableCell>
            <TableCell>{entry.room_number || "-"}</TableCell>
            <TableCell>
              <Badge variant={entry.is_active ? "default" : "secondary"}>
                {entry.is_active ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
