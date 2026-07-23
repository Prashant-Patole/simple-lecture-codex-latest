import { useNavigate } from 'react-router-dom';
import { Sparkles, Clock } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  open: boolean;
  onLater: () => void;
  selfTestId: string;
  chapterTitle: string;
}

export const ChapterTestReadyDialog = ({ open, onLater, selfTestId, chapterTitle }: Props) => {
  const navigate = useNavigate();

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onLater(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Chapter complete! 🎉
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            You finished every lecture in <span className="font-semibold text-foreground">{chapterTitle}</span>.
            Your chapter test is ready.
            <span className="mt-3 inline-flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" /> 3 hours · 30 questions
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-center">
          <AlertDialogCancel onClick={onLater}>Later</AlertDialogCancel>
          <AlertDialogAction onClick={() => navigate(`/my-tests/${selfTestId}/take`)}>
            Start Test Now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
