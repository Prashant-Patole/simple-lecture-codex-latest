import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

interface EnrolledCourse {
  id: string;
  name: string;
  thumbnail_url: string;
  enrollmentId: string;
  enrolledAt: string;
  progressPercentage: number;
  totalChapters: number;
  completedChapters: number;
  lastAccessed: string;
  subjects: any; // Json type from database
}

interface EnrolledCourseCardProps {
  course: EnrolledCourse;
}

export const EnrolledCourseCard = ({ course }: EnrolledCourseCardProps) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {course.thumbnail_url && (
            <img 
              src={course.thumbnail_url} 
              alt={course.name}
              className="h-12 w-12 rounded object-cover"
            />
          )}
          
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm mb-1 line-clamp-1">
              {course.name}
            </h3>
            
            <div className="flex items-center gap-2 mb-2">
              <Progress value={course.progressPercentage} className="h-1.5 flex-1" />
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {course.progressPercentage}%
              </span>
            </div>
            
            <p className="text-xs text-muted-foreground">
              {course.completedChapters} of {course.totalChapters} chapters • 
              Last accessed {format(new Date(course.lastAccessed), 'MMM dd')}
            </p>
          </div>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-muted rounded"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </div>
        
        {expanded && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs font-medium mb-2">Subjects:</p>
            <div className="flex flex-wrap gap-2">
              {Array.isArray(course.subjects) ? course.subjects.map((subject: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {subject}
                </Badge>
              )) : (
                <Badge variant="secondary" className="text-xs">
                  {String(course.subjects || 'General')}
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
