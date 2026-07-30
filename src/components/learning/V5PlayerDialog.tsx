import { createPortal } from 'react-dom';
import { V5Player } from './v5';
import type { V5Language } from './v5';

interface V5PlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialJobId: string;
  initialLanguage?: string | null;
}

const normalizeLanguage = (language?: string | null): V5Language => {
  const normalized = language?.trim().toLowerCase();
  return normalized === 'kannada' || normalized === 'kn' || normalized === 'kn-in'
    ? 'kannada'
    : 'english';
};

export function V5PlayerDialog({
  open,
  onOpenChange,
  initialJobId,
  initialLanguage,
}: V5PlayerDialogProps) {
  if (!open) return null;

  return createPortal(
    <div className="v5-player-portal">
      <V5Player
        exitLabel="Close player"
        jobId={initialJobId}
        initialLanguage={normalizeLanguage(initialLanguage)}
        onExit={() => onOpenChange(false)}
      />
    </div>,
    document.body,
  );
}
