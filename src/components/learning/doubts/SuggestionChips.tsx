import { Presentation, MessageCircleQuestion } from "lucide-react";
import type { AITextAnswerSuggestion } from "@/types/aiTextAnswer";
import { DoubtsMarkdown } from "@/components/learning/doubts/DoubtsMarkdown";

interface Props {
  items: AITextAnswerSuggestion[];
  onAsk: (question: string) => void;
  disabled?: boolean;
}

export const SuggestionChips = ({ items, onAsk, disabled }: Props) => {
  if (!items?.length) return null;
  return (
    <div className="flex flex-col gap-1.5 max-w-[85%]">
      <p className="text-xs text-muted-foreground px-1">Explore related:</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => onAsk(s.question)}
            className="text-xs px-3 py-1.5 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-foreground transition-colors text-left disabled:opacity-50 max-w-full break-words whitespace-normal inline-flex items-center gap-1.5"
          >
            {s.has_slides ? (
              <Presentation className="h-3 w-3 shrink-0 text-primary" />
            ) : (
              <MessageCircleQuestion className="h-3 w-3 shrink-0 text-muted-foreground" />
            )}
            <DoubtsMarkdown content={s.question} variant="assistant" inline className="text-xs" />
          </button>
        ))}
      </div>
    </div>
  );
};
