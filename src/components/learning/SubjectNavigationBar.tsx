import { Button } from "@/components/ui/button";
import { BookOpen, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface SubjectNavigationBarProps {
  subjects: { name: string; slug: string; id: string }[];
  selectedSubjectId?: string | null;
  onSubjectChange?: (subjectId: string) => void;
  courseName?: string;
  onBack?: () => void;
}

export const SubjectNavigationBar = ({ 
  subjects, 
  selectedSubjectId,
  onSubjectChange,
  courseName,
  onBack,
}: SubjectNavigationBarProps) => {
  const navigate = useNavigate();

  return (
    <div className="border-b sticky top-0 z-40">
      <div className="flex items-center gap-3 px-6 py-3 overflow-x-auto">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (onBack ? onBack() : navigate("/my-courses"))}
          className="flex-shrink-0 hover:bg-primary/10 transition-all duration-300"
        >
          <div className="p-1 rounded-lg bg-primary/10 mr-1">
            <ChevronLeft className="h-3 w-3 text-primary" />
          </div>
          Back
        </Button>
        
        <div className="h-6 w-px bg-primary/20 mx-2" />
        
        <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex-shrink-0">
          <BookOpen className="h-5 w-5 text-primary" />
        </div>
        
        {courseName && (
          <span className="font-semibold text-sm flex-shrink-0 mr-4 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary/15 to-primary/5 text-foreground">
            {courseName}
          </span>
        )}
        
        <div className="flex gap-2">
          {subjects.map((subject) => (
            <Button
              key={subject.id}
              variant={selectedSubjectId === subject.id ? "default" : "ghost"}
              size="sm"
              onClick={() => onSubjectChange?.(subject.id)}
              className={cn(
                "whitespace-nowrap transition-all duration-300",
                selectedSubjectId === subject.id 
                  ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-md hover:shadow-lg" 
                  : "bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 border border-primary/20"
              )}
            >
              {subject.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
