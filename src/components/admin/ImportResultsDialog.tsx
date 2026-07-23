import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, FolderOpen, BookOpen, List, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface ImportResults {
  chapters: number;
  topics: number;
  subtopics: number;
  skippedChapters: number;
  skippedTopics: number;
  errors: string[];
}

interface ImportResultsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  results: ImportResults | null;
}

export function ImportResultsDialog({ isOpen, onClose, results }: ImportResultsDialogProps) {
  if (!results) return null;

  const totalImported = results.chapters + results.topics + results.subtopics;
  const totalSkipped = results.skippedChapters + results.skippedTopics;
  const hasErrors = results.errors.length > 0;
  const isSuccess = totalImported > 0 && !hasErrors;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : hasErrors ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
            )}
            Import Complete
          </DialogTitle>
          <DialogDescription>
            {isSuccess
              ? "Your curriculum data has been imported successfully."
              : hasErrors
              ? "Import completed with some errors."
              : "No new items were imported."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Imported Items */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Newly Imported</h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FolderOpen className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-lg font-semibold">{results.chapters}</p>
                  <p className="text-xs text-muted-foreground">Chapters</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <BookOpen className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-lg font-semibold">{results.topics}</p>
                  <p className="text-xs text-muted-foreground">Topics</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <List className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-lg font-semibold">{results.subtopics}</p>
                  <p className="text-xs text-muted-foreground">Subtopics</p>
                </div>
              </div>
            </div>
          </div>

          {/* Skipped Items */}
          {totalSkipped > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Already Existed (Skipped)</h4>
              <div className="flex gap-4">
                {results.skippedChapters > 0 && (
                  <Badge variant="secondary" className="text-sm">
                    {results.skippedChapters} existing chapter(s) reused
                  </Badge>
                )}
                {results.skippedTopics > 0 && (
                  <Badge variant="secondary" className="text-sm">
                    {results.skippedTopics} topic(s) skipped
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Existing items were not duplicated. Topics were added to existing chapters where applicable.
              </p>
            </div>
          )}

          {/* Errors */}
          {hasErrors && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-destructive flex items-center gap-1">
                <XCircle className="h-4 w-4" />
                Errors ({results.errors.length})
              </h4>
              <ScrollArea className="h-32 rounded-md border border-destructive/20 bg-destructive/5 p-2">
                <ul className="space-y-1 text-sm">
                  {results.errors.map((error, index) => (
                    <li key={index} className="text-destructive">
                      • {error}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
