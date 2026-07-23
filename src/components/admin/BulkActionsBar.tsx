import { Button } from "@/components/ui/button";
import { CheckCircle2, Trash2, Download, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface BulkActionsBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkVerify: () => void;
  onBulkDelete: () => void;
  onBulkExport: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onClearSelection,
  onBulkVerify,
  onBulkDelete,
  onBulkExport,
}: BulkActionsBarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <>
      <Card className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 shadow-lg">
        <div className="flex items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">{selectedCount} selected</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="h-6 w-px bg-border" />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkVerify}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Verify All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkExport}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete All
            </Button>
          </div>
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} Questions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected questions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onBulkDelete();
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
