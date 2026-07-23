import { AlertTriangle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConflictInfo } from "@/hooks/useInstructorConflicts";

interface ConflictBadgeProps {
  conflicts: ConflictInfo[];
  className?: string;
}

export const ConflictBadge = ({ conflicts, className }: ConflictBadgeProps) => {
  if (!conflicts || conflicts.length === 0) return null;

  const hardConflicts = conflicts.filter((c) => c.type === "hard");
  const softConflicts = conflicts.filter((c) => c.type === "soft");

  const hasHardConflict = hardConflicts.length > 0;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={hasHardConflict ? "destructive" : "secondary"}
            className={`cursor-pointer ${className}`}
          >
            {hasHardConflict ? (
              <AlertCircle className="h-3 w-3 mr-1" />
            ) : (
              <AlertTriangle className="h-3 w-3 mr-1" />
            )}
            {conflicts.length} {conflicts.length === 1 ? "conflict" : "conflicts"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">
          <div className="space-y-2">
            {hardConflicts.length > 0 && (
              <div>
                <p className="font-semibold text-destructive">Time Conflicts:</p>
                <ul className="text-sm list-disc pl-4">
                  {hardConflicts.map((c, idx) => (
                    <li key={idx}>{c.message}</li>
                  ))}
                </ul>
              </div>
            )}
            {softConflicts.length > 0 && (
              <div>
                <p className="font-semibold text-yellow-600">Warnings:</p>
                <ul className="text-sm list-disc pl-4">
                  {softConflicts.map((c, idx) => (
                    <li key={idx}>{c.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
