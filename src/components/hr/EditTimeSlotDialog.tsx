import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateTimetableEntry, useDeleteTimetableEntry } from "@/hooks/useInstructorTimetable";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Link } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface EditTimeSlotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: {
    id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    room_number?: string;
    meeting_link?: string;
    subject?: { id: string; name: string };
    instructor?: { id: string; full_name: string };
    course?: { id: string; name: string };
    batch?: { id: string; name: string };
  } | null;
}

export const EditTimeSlotDialog = ({ open, onOpenChange, entry }: EditTimeSlotDialogProps) => {
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [roomNumber, setRoomNumber] = useState("");
  const [meetingLink, setMeetingLink] = useState("");

  const updateEntry = useUpdateTimetableEntry();
  const deleteEntry = useDeleteTimetableEntry();

  useEffect(() => {
    if (entry) {
      setDayOfWeek(entry.day_of_week);
      setStartTime(entry.start_time.substring(0, 5));
      setEndTime(entry.end_time.substring(0, 5));
      setRoomNumber(entry.room_number || "");
      setMeetingLink(entry.meeting_link || "");
    }
  }, [entry]);

  const handleSave = async () => {
    if (!entry) return;

    await updateEntry.mutateAsync({
      id: entry.id,
      data: {
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        room_number: roomNumber || null,
        meeting_link: meetingLink || null,
      },
    });
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!entry) return;
    await deleteEntry.mutateAsync(entry.id);
    onOpenChange(false);
  };

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Time Slot</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {entry.subject && (
            <div>
              <Label className="text-muted-foreground">Subject</Label>
              <p className="font-medium">{entry.subject.name}</p>
            </div>
          )}

          {entry.instructor && (
            <div>
              <Label className="text-muted-foreground">Instructor</Label>
              <p className="font-medium">{entry.instructor.full_name}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Day of Week</Label>
            <Select value={dayOfWeek.toString()} onValueChange={(v) => setDayOfWeek(parseInt(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((day, idx) => (
                  <SelectItem key={idx} value={idx.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Room Number (Optional)</Label>
            <Input
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g., Room 101"
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Meeting Link (Recurring)
            </Label>
            <Input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="e.g., https://meet.google.com/abc-xyz"
            />
            <p className="text-xs text-muted-foreground">
              This link will auto-populate for all class occurrences
            </p>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Time Slot?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will remove this time slot from the timetable. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateEntry.isPending}>
              {updateEntry.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
