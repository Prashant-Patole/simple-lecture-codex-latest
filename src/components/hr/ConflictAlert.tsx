import { AlertTriangle, AlertCircle, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConflictInfo } from "@/hooks/useInstructorConflicts";

interface ConflictAlertProps {
  conflicts: ConflictInfo[];
  onDismiss?: () => void;
  onProceedAnyway?: () => void;
  showActions?: boolean;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const ConflictAlert = ({
  conflicts,
  onDismiss,
  onProceedAnyway,
  showActions = false,
}: ConflictAlertProps) => {
  if (!conflicts || conflicts.length === 0) return null;

  const hardConflicts = conflicts.filter((c) => c.type === "hard");
  const softConflicts = conflicts.filter((c) => c.type === "soft");
  const hasHardConflict = hardConflicts.length > 0;

  return (
    <Alert variant={hasHardConflict ? "destructive" : "default"} className="relative">
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 h-6 w-6"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      
      {hasHardConflict ? (
        <AlertCircle className="h-4 w-4" />
      ) : (
        <AlertTriangle className="h-4 w-4" />
      )}
      
      <AlertTitle>
        {hasHardConflict
          ? `${hardConflicts.length} Scheduling Conflict${hardConflicts.length > 1 ? "s" : ""} Detected`
          : `${softConflicts.length} Schedule Warning${softConflicts.length > 1 ? "s" : ""}`}
      </AlertTitle>
      
      <AlertDescription className="mt-2">
        <ul className="space-y-1 text-sm">
          {conflicts.map((conflict, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className={conflict.type === "hard" ? "text-destructive" : "text-yellow-600"}>
                •
              </span>
              <span>
                <strong>{DAYS[conflict.existingEntry.day_of_week]}</strong>:{" "}
                {conflict.message}
                {conflict.existingEntry.course_name && (
                  <span className="text-muted-foreground">
                    {" "}
                    ({conflict.existingEntry.course_name})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        {showActions && (
          <div className="flex gap-2 mt-4">
            {!hasHardConflict && onProceedAnyway && (
              <Button variant="outline" size="sm" onClick={onProceedAnyway}>
                Proceed Anyway
              </Button>
            )}
            {onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Fix Schedule
              </Button>
            )}
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
};
