import { useNavigate } from 'react-router-dom';
import { Sparkles, Loader2, X } from 'lucide-react';
import { useAIAssistantJob } from '@/contexts/AIAssistantJobContext';
import { Button } from '@/components/ui/button';
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

/**
 * Global, persistent UI that surfaces background AI-tab jobs:
 *  - Floating pill while the request is still in flight on another route.
 *  - "Answer ready" dialog when the response arrives and the AI tab is NOT active.
 */
export function AIAssistantBackgroundUI() {
  const { job, isActive, clearJob, acknowledgeAndConfirm } = useAIAssistantJob();
  const navigate = useNavigate();

  if (!job) return null;

  // Don't render anything when the AI tab is currently active — the inline
  // confirmation card inside AITeachingAssistant takes over.
  const showPill = job.status === 'pending' && !isActive;
  const showReadyDialog = job.status === 'ready' && job.requiresConfirmation && !isActive;
  const showErrorDialog = job.status === 'error' && !isActive;

  const openAnswer = () => {
    const [path, query = ''] = (job.params.returnPath || '/').split('?');
    const sp = new URLSearchParams(query);
    sp.set('tab', 'ai-assistant');
    sp.set('aiJob', job.id);
    // Close the dialog immediately, even if navigate is a no-op (same URL).
    acknowledgeAndConfirm();
    navigate(`${path}?${sp.toString()}`);
  };

  return (
    <>
      {showPill && (
        <button
          type="button"
          onClick={openAnswer}
          className="fixed bottom-20 right-4 z-[60] flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-primary-foreground shadow-lg ring-1 ring-black/10 transition hover:scale-[1.02] sm:bottom-6"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">AI is preparing your answer…</span>
        </button>
      )}

      <AlertDialog open={showReadyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Your AI answer is ready
            </AlertDialogTitle>
            <AlertDialogDescription>
              The presentation for your question is ready in the AI tab:
              <span className="mt-2 block rounded-md bg-muted p-2 text-sm italic text-foreground">
                "{job.question}"
              </span>
              Open the AI tab to start it whenever you're ready.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={clearJob}>Dismiss</AlertDialogCancel>
            <AlertDialogAction onClick={openAnswer}>Open AI tab</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showErrorDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <X className="h-5 w-5 text-destructive" /> AI couldn't answer
            </AlertDialogTitle>
            <AlertDialogDescription>
              {job.error || 'Something went wrong while preparing your answer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={clearJob}>Dismiss</AlertDialogCancel>
            <AlertDialogAction onClick={openAnswer}>Open AI tab</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
