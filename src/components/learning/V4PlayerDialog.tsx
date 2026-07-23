import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { V4Player } from './v4/V4Player';

interface V4PlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName?: string;
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  courseId?: string;
  initialJobId?: string;
  initialLanguage?: string | null;
  restrictToLanguage?: string | null;
}

export const V4PlayerDialog = ({ open, onOpenChange, documentName, topicId, chapterId, subjectId, courseId, initialJobId, initialLanguage, restrictToLanguage }: V4PlayerDialogProps) => {
  const [jobId, setJobId] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  useEffect(() => {
    if (open && initialJobId && !activeJobId) {
      setActiveJobId(initialJobId);
    }
  }, [open, initialJobId, activeJobId]);

  const handleLoad = () => {
    const trimmed = jobId.trim();
    if (!trimmed) return;
    setActiveJobId(trimmed);
  };

  const handleClose = () => {
    setActiveJobId(null);
    setJobId('');
    onOpenChange(false);
  };

  if (activeJobId) {
    return createPortal(
      <V4Player jobId={activeJobId} onClose={handleClose} topicId={topicId} chapterId={chapterId} subjectId={subjectId} courseId={courseId} topicTitle={documentName} initialLanguage={initialLanguage ?? null} restrictToLanguage={restrictToLanguage} />,
      document.body
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>V4 Player <span className="text-xs font-mono text-muted-foreground">(testing)</span></DialogTitle>
          <DialogDescription>
            Enter the Job ID to load the presentation
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <input
            type="text"
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
            placeholder="e.g. 103_162_120_230_fcc1b377"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            autoFocus
          />
          <button
            onClick={handleLoad}
            disabled={!jobId.trim()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
          >
            Load Presentation
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
