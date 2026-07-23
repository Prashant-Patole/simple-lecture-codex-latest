import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { V3Player } from './v3/V3Player';
import { V4Player } from './v4/V4Player';

// Per-(jobId, language) overrides that route specific lectures to the V4
// player (which honours the merged single-video field in presentation.json)
// instead of the default V3 section-wise renderer.
// Kept intentionally narrow — one entry per lecture we want to force to V4.
const V4_JOB_LANG_OVERRIDES: Record<string, Set<string>> = {
  // Social Science → Chapter 1 → Topic 1.3 "European Trade Companies In India"
  SocialScience_20260630115302591_5462fd6a: new Set(['kannada']),
};

const shouldForceV4 = (jobId: string, language?: string | null): boolean => {
  const langs = V4_JOB_LANG_OVERRIDES[jobId];
  if (!langs) return false;
  return langs.has((language || 'english').toLowerCase());
};

interface V3PlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentName?: string;
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  courseId?: string;
  initialJobId?: string;
  initialLanguage?: string | null;
  videoBeatsOnly?: boolean;
}

export const V3PlayerDialog = ({ open, onOpenChange, documentName, topicId, chapterId, subjectId, courseId, initialJobId, initialLanguage, videoBeatsOnly }: V3PlayerDialogProps) => {
  const [jobId, setJobId] = useState('');
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Auto-load if an initialJobId is provided
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

  // If player is active, render full-screen player (no dialog)
  if (activeJobId) {
    if (shouldForceV4(activeJobId, initialLanguage)) {
      return createPortal(
        <V4Player
          jobId={activeJobId}
          onClose={handleClose}
          topicId={topicId}
          chapterId={chapterId}
          subjectId={subjectId}
          courseId={courseId}
          topicTitle={documentName}
          initialLanguage={initialLanguage}
          restrictToLanguage={initialLanguage}
        />,
        document.body
      );
    }
    return createPortal(
      <V3Player jobId={activeJobId} onClose={handleClose} topicId={topicId} chapterId={chapterId} subjectId={subjectId} courseId={courseId} topicTitle={documentName} initialLanguage={initialLanguage} videoBeatsOnly={videoBeatsOnly} />,
      document.body
    );
  }

  // Job ID input dialog
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>V3 Player</DialogTitle>
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
