import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useFlagPost } from '@/hooks/useForumPosts';

interface FlagContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: { type: 'post' | 'reply'; id: string } | null;
}

const FlagContentDialog: React.FC<FlagContentDialogProps> = ({ open, onOpenChange, target }) => {
  const [reason, setReason] = useState('');
  const flagPost = useFlagPost();

  const handleSubmit = async () => {
    if (!reason.trim() || !target) return;
    await flagPost.mutateAsync({ postId: target.id, reason });
    setReason('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report Content</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Reason for reporting</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why this content should be reviewed..." rows={3} />
          </div>
          <Button onClick={handleSubmit} disabled={flagPost.isPending || !reason} className="w-full" variant="destructive">
            {flagPost.isPending ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FlagContentDialog;
