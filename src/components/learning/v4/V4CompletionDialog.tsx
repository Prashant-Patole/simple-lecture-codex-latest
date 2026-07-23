import { useEffect } from 'react';
import { Trophy, X } from 'lucide-react';

interface V4CompletionDialogProps {
  show: boolean;
  onDismiss: () => void;
  topicTitle?: string;
}

export const V4CompletionDialog = ({ show, onDismiss, topicTitle }: V4CompletionDialogProps) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onDismiss, 6000);
      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div className="absolute bottom-20 right-4 z-50 animate-in slide-in-from-right-5 fade-in duration-500">
      <div className="bg-gradient-to-r from-amber-500/90 to-yellow-500/90 backdrop-blur-md text-white rounded-xl p-4 shadow-2xl max-w-[280px] border border-white/20">
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-0.5 rounded-full hover:bg-white/20 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="flex items-start gap-3">
          <div className="bg-white/20 rounded-full p-2 shrink-0">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-sm">🎉 Congrats!</p>
            <p className="text-xs mt-0.5 opacity-90">
              You completed {topicTitle ? `"${topicTitle}"` : 'this topic'}!
            </p>
            <p className="text-xs mt-1 font-semibold">
              🥈 Silver Badge earned!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
