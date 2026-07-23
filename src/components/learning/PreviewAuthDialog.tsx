import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface PreviewAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignUp: () => void;
}

export const PreviewAuthDialog: React.FC<PreviewAuthDialogProps> = ({ open, onOpenChange, onSignUp }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sign up to watch this lecture</DialogTitle>
          <DialogDescription>
            Create a free account to play this lecture. It only takes a few seconds.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSignUp}>
            Sign up for free
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PreviewAuthDialog;
