import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, GripVertical, Link, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useUpdateTimetableEntry } from "@/hooks/useInstructorTimetable";
import { EditTimeSlotDialog } from "./EditTimeSlotDialog";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, subWeeks, addWeeks, isSameWeek } from "date-fns";

interface TimetableEntry {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject?: { id: string; name: string };
  chapter?: { title: string; chapter_number: number };
  instructor?: { id: string; full_name: string };
  course?: { id: string; name: string };
  batch?: { id: string; name: string };
  room_number?: string;
  meeting_link?: string;
}

interface DraggableTimetableGridProps {
  entries: TimetableEntry[];
  onSlotClick?: (entry: TimetableEntry) => void;
  enableDragDrop?: boolean;
  enableEdit?: boolean;
  showWeekNavigation?: boolean;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

// Draggable Entry Component
const DraggableEntry = ({ entry, enableEdit, onEditClick }: { 
  entry: TimetableEntry; 
  enableEdit?: boolean;
  onEditClick: (entry: TimetableEntry) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: entry.id,
    data: entry,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-primary/10 rounded-md p-2 cursor-grab active:cursor-grabbing",
        isDragging && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div {...attributes} {...listeners} className="cursor-grab mt-0.5">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{entry.subject?.name || "Class"}</p>
          {entry.chapter && (
            <Badge variant="secondary" className="text-xs mt-1">
              Ch. {entry.chapter.chapter_number}
            </Badge>
          )}
          {entry.instructor && (
            <p className="text-xs text-muted-foreground truncate mt-1">
              {entry.instructor.full_name}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {entry.start_time.substring(0, 5)} - {entry.end_time.substring(0, 5)}
          </p>
          <div className="flex items-center gap-1">
            {entry.room_number && (
              <p className="text-xs text-muted-foreground">
                {entry.room_number}
              </p>
            )}
            {entry.meeting_link && (
              <Link className="h-3 w-3 text-primary" />
            )}
          </div>
        </div>
        {enableEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onEditClick(entry);
            }}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
};

// Droppable Cell Component
const DroppableCell = ({ 
  day, 
  time, 
  children 
}: { 
  day: number; 
  time: string; 
  children: React.ReactNode;
}) => {
  const { isOver, setNodeRef } = useDroppable({
    id: `${day}-${time}`,
    data: { day, time },
  });

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "p-2 min-h-[80px] transition-all",
        isOver ? "bg-primary/20 ring-2 ring-primary" : "bg-muted/30",
        "hover:shadow-md"
      )}
    >
      {children}
    </Card>
  );
};

export const DraggableTimetableGrid = ({ 
  entries, 
  onSlotClick,
  enableDragDrop = true,
  enableEdit = true,
  showWeekNavigation = true,
}: DraggableTimetableGridProps) => {
  const [activeEntry, setActiveEntry] = useState<TimetableEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() => 
    startOfWeek(new Date(), { weekStartsOn: 0 })
  );
  const updateEntry = useUpdateTimetableEntry();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Calculate dates for the selected week
  const weekDates = useMemo(() => {
    return DAYS.map((_, idx) => addDays(selectedWeekStart, idx));
  }, [selectedWeekStart]);

  const isCurrentWeek = useMemo(() => {
    return isSameWeek(selectedWeekStart, new Date(), { weekStartsOn: 0 });
  }, [selectedWeekStart]);

  const handlePreviousWeek = () => {
    setSelectedWeekStart(prev => subWeeks(prev, 1));
  };

  const handleNextWeek = () => {
    setSelectedWeekStart(prev => addWeeks(prev, 1));
  };

  const handleToday = () => {
    setSelectedWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }));
  };

  const getEntryForSlot = (day: number, time: string) => {
    return entries.find((entry) => {
      const entryTime = entry.start_time.substring(0, 5);
      return entry.day_of_week === day && entryTime === time;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const entry = entries.find(e => e.id === event.active.id);
    if (entry) {
      setActiveEntry(entry);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveEntry(null);

    if (!over || active.id === over.id) return;

    const entryId = active.id as string;
    const dropData = over.data.current as { day: number; time: string } | undefined;

    if (!dropData) return;

    const existingEntry = getEntryForSlot(dropData.day, dropData.time);
    if (existingEntry && existingEntry.id !== entryId) {
      // Slot already occupied
      return;
    }

    const draggedEntry = entries.find(e => e.id === entryId);
    if (!draggedEntry) return;

    // Calculate duration
    const originalStart = new Date(`2000-01-01T${draggedEntry.start_time}`);
    const originalEnd = new Date(`2000-01-01T${draggedEntry.end_time}`);
    const durationMs = originalEnd.getTime() - originalStart.getTime();

    // Calculate new end time
    const newStart = new Date(`2000-01-01T${dropData.time}`);
    const newEnd = new Date(newStart.getTime() + durationMs);
    const newEndTime = `${newEnd.getHours().toString().padStart(2, '0')}:${newEnd.getMinutes().toString().padStart(2, '0')}`;

    await updateEntry.mutateAsync({
      id: entryId,
      data: {
        day_of_week: dropData.day,
        start_time: dropData.time,
        end_time: newEndTime,
      },
    });
  };

  const handleEditClick = (entry: TimetableEntry) => {
    setEditingEntry(entry);
  };

  const gridContent = (
    <div className="overflow-x-auto">
      <div className="min-w-[1000px]">
        {/* Week Navigation */}
        {showWeekNavigation && (
          <div className="flex items-center justify-between mb-4 p-2 bg-muted/30 rounded-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousWeek}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous Week
            </Button>
            
            <div className="flex items-center gap-3">
              <span className="font-semibold">
                {format(weekDates[0], "MMM d")} - {format(weekDates[6], "MMM d, yyyy")}
              </span>
              {!isCurrentWeek && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToday}
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Today
                </Button>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextWeek}
            >
              Next Week
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        <div className="grid grid-cols-8 gap-2">
          <div className="font-semibold p-2">Time</div>
          {DAYS.map((day, idx) => (
            <div key={day} className="font-semibold p-2 text-center">
              <div>{day}</div>
              <div className="text-xs text-muted-foreground font-normal">
                {format(weekDates[idx], "MMM d")}
              </div>
            </div>
          ))}
        </div>
        
        {TIME_SLOTS.map((time) => (
          <div key={time} className="grid grid-cols-8 gap-2 mb-2">
            <div className="p-2 text-sm text-muted-foreground flex items-center">
              {time}
            </div>
            {[0, 1, 2, 3, 4, 5, 6].map((day) => {
              const entry = getEntryForSlot(day, time);
              return (
                <DroppableCell key={`${day}-${time}`} day={day} time={time}>
                  {entry ? (
                    <DraggableEntry 
                      entry={entry} 
                      enableEdit={enableEdit}
                      onEditClick={handleEditClick}
                    />
                  ) : (
                    <div className="text-xs text-muted-foreground text-center h-full flex items-center justify-center">
                      -
                    </div>
                  )}
                </DroppableCell>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
      {enableDragDrop ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {gridContent}
          <DragOverlay>
            {activeEntry ? (
              <Card className="p-2 bg-primary/20 shadow-lg">
                <p className="font-medium text-sm">{activeEntry.subject?.name || "Class"}</p>
                <p className="text-xs text-muted-foreground">
                  {activeEntry.start_time.substring(0, 5)} - {activeEntry.end_time.substring(0, 5)}
                </p>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        gridContent
      )}

      <EditTimeSlotDialog
        open={!!editingEntry}
        onOpenChange={(open) => !open && setEditingEntry(null)}
        entry={editingEntry}
      />
    </>
  );
};
