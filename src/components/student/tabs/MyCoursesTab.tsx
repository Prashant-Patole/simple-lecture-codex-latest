import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, CheckCircle, FolderOpen, Video, FileText, ClipboardCheck, History, Award } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useChapterWiseProgress, type ChapterDetailedProgress } from "@/hooks/useChapterWiseProgress";

interface ChapterProgressCardProps {
  chapter: ChapterDetailedProgress;
}

const ChapterProgressCard = ({ chapter }: ChapterProgressCardProps) => {
  const progressItems = [
    { 
      icon: Video, 
      label: "Lectures", 
      value: `${chapter.lectures.watched}/${chapter.lectures.total}`,
      color: "text-primary",
      hasContent: chapter.lectures.total > 0
    },
    { 
      icon: FileText, 
      label: "DPPs", 
      value: `${chapter.dpps.solved}/${chapter.dpps.total}`,
      color: "text-orange-500",
      hasContent: chapter.dpps.total > 0
    },
    { 
      icon: ClipboardCheck, 
      label: "Tests", 
      value: `${chapter.tests.completed}/${chapter.tests.total}`,
      color: "text-green-500",
      hasContent: chapter.tests.total > 0
    },
    { 
      icon: History, 
      label: "PYQ", 
      value: `${chapter.pyqs.completed}/${chapter.pyqs.total}`,
      color: "text-primary",
      hasContent: chapter.pyqs.total > 0
    },
    { 
      icon: Award, 
      label: "Proficiency", 
      value: `${chapter.proficiency.completed}/${chapter.proficiency.total}`,
      color: "text-yellow-600",
      hasContent: chapter.proficiency.total > 0
    }
  ];

  const activeItems = progressItems.filter(item => item.hasContent);

  return (
    <div className="pt-2 space-y-3">
      <div className="flex items-center gap-2">
        <Progress value={chapter.overallProgress} className="h-2 flex-1" />
        <span className="text-sm font-medium text-muted-foreground w-12 text-right">
          {chapter.overallProgress}%
        </span>
      </div>
      
      {activeItems.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
          {progressItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div 
                key={idx} 
                className={`flex items-center gap-2 p-2 bg-muted/50 rounded ${!item.hasContent ? 'opacity-50' : ''}`}
              >
                <Icon className={`h-4 w-4 ${item.color}`} />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                  <p className="font-medium">{item.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No content available yet for this chapter.</p>
      )}
    </div>
  );
};

export const MyCoursesTab = ({ student }: { student: any }) => {
  const courseIds = student?.courses?.map((c: any) => c.id) || [];
  
  const { data: coursesData, isLoading } = useChapterWiseProgress(courseIds);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Empty state
  if (!student?.courses?.length || !coursesData?.length) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Courses Enrolled</h3>
            <p className="text-muted-foreground mb-4">
              You haven't enrolled in any courses yet. Browse our catalog to get started!
            </p>
            <Link to="/">
              <Button>Browse Courses</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {coursesData.map((course) => (
        <Card key={course.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              {course.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {course.subjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No subjects added to this course yet.</p>
            ) : (
              course.subjects.map((subject) => (
                <div key={subject.id} className="space-y-3">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    {subject.name}
                    <Badge variant="secondary">{subject.chapters.length} Chapters</Badge>
                  </h3>
                  
                  {subject.chapters.length === 0 ? (
                    <p className="text-sm text-muted-foreground pl-4">No chapters available yet.</p>
                  ) : (
                    <Accordion type="single" collapsible className="w-full">
                      {subject.chapters.map((chapter) => (
                        <AccordionItem key={chapter.id} value={chapter.id}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-2">
                                <CheckCircle className={`h-4 w-4 ${chapter.overallProgress === 100 ? 'text-green-600' : chapter.overallProgress > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`} />
                                <span className="font-medium text-left">{chapter.name}</span>
                              </div>
                              <span className="text-sm text-muted-foreground">{chapter.overallProgress}%</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <ChapterProgressCard chapter={chapter} />
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
