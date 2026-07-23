import { BookOpen } from "lucide-react";
import type { AITextAnswerSource } from "@/types/aiTextAnswer";

export const SourceChips = ({ sources }: { sources: AITextAnswerSource[] }) => {
  if (!sources?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2 max-w-[85%]">
      {sources.map((s, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border bg-background/50 text-muted-foreground"
          title={s.section_title || s.doc_title}
        >
          <BookOpen className="h-3 w-3" />
          <span className="truncate max-w-[220px]">
            {s.doc_title}
            {s.section_title ? ` › ${s.section_title}` : ""}
          </span>
        </span>
      ))}
    </div>
  );
};
