import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface TimetableEntry {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  subject?: { name: string };
  chapter?: { title: string; chapter_number: number };
  instructor?: { full_name: string };
}

interface TimetableGridProps {
  entries: TimetableEntry[];
  onSlotClick?: (entry: TimetableEntry) => void;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

export const TimetableGrid = ({ entries, onSlotClick }: TimetableGridProps) => {
  const getEntryForSlot = (day: number, time: string) => {
    return entries.find((entry) => {
      const entryTime = entry.start_time.substring(0, 5);
      return entry.day_of_week === day && entryTime === time;
    });
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1000px]">
        <div className="grid grid-cols-8 gap-2">
          <div className="font-semibold p-2">Time</div>
          {DAYS.map((day) => (
            <div key={day} className="font-semibold p-2 text-center">
              {day}
            </div>
          ))}
        </div>
        
        {TIME_SLOTS.map((time) => (
          <div key={time} className="grid grid-cols-8 gap-2 mb-2">
            <div className="p-2 text-sm text-muted-foreground">{time}</div>
            {[0, 1, 2, 3, 4, 5, 6].map((day) => {
              const entry = getEntryForSlot(day, time);
              return (
                <Card
                  key={`${day}-${time}`}
                  className={`p-2 cursor-pointer hover:shadow-md transition-shadow ${
                    entry ? "bg-primary/10" : "bg-muted/30"
                  }`}
                  onClick={() => entry && onSlotClick?.(entry)}
                >
                  {entry ? (
                    <div className="space-y-1">
                      <p className="font-medium text-sm truncate">{entry.subject?.name}</p>
                      {entry.chapter && (
                        <Badge variant="secondary" className="text-xs">
                          Ch. {entry.chapter.chapter_number}
                        </Badge>
                      )}
                      {entry.instructor && (
                        <p className="text-xs text-muted-foreground truncate">
                          {entry.instructor.full_name}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {entry.start_time.substring(0, 5)} - {entry.end_time.substring(0, 5)}
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground text-center">-</div>
                  )}
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
