import { useNavigate } from "react-router-dom";
import { Sparkles, PlayCircle, ArrowRight } from "lucide-react";

interface Props {
  courseSlug: string;
  chapterCount: number;
}

export function FreePreviewCard({ courseSlug, chapterCount }: Props) {
  const navigate = useNavigate();

  if (chapterCount <= 0) return null;

  const handleClick = () => {
    navigate(`/course/${courseSlug}/preview`);
  };

  return (
    <div className="container mx-auto px-4 mt-6">
      <button
        type="button"
        onClick={handleClick}
        className="group relative block w-full text-left overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-5 md:p-6 shadow-lg transition-all hover:shadow-2xl hover:border-primary/60 hover:scale-[1.01]"
      >
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <PlayCircle className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                Free Preview Available
              </span>
            </div>
            <h3 className="text-lg md:text-xl font-bold">
              Try {chapterCount} chapter{chapterCount > 1 ? "s" : ""} free
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Get a real feel of the course experience before you buy.
            </p>
          </div>
          <div className="flex items-center gap-2 font-semibold text-primary md:self-center">
            Preview now
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </div>
      </button>
    </div>
  );
}
