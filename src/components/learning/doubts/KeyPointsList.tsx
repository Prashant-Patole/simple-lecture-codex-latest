import { CheckCircle2 } from "lucide-react";
import { DoubtsMarkdown } from "@/components/learning/doubts/DoubtsMarkdown";

export const KeyPointsList = ({ items }: { items: string[] }) => {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((k, i) => (
        <li key={i} className="flex gap-2 items-start text-sm">
          <CheckCircle2 className="h-3.5 w-3.5 mt-1 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <DoubtsMarkdown variant="assistant" inline content={k} />
          </div>
        </li>
      ))}
    </ul>
  );
};
