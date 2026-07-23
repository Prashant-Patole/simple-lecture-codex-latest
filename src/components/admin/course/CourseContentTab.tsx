import { Label } from "@/components/ui/label";
import { useCourseSubjects } from "@/hooks/useCourseSubjects";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, List } from "lucide-react";

interface CourseContentTabProps {
  courseId?: string;
}

export const CourseContentTab = ({ courseId }: CourseContentTabProps) => {
  const { data: courseSubjects } = useCourseSubjects(courseId);

  // Fetch chapters for all subjects at once
  const { data: allChapters } = useQuery({
    queryKey: ["all-subject-chapters", courseId],
    queryFn: async () => {
      if (!courseSubjects || courseSubjects.length === 0) return {};
      
      const subjectIds = courseSubjects.map((cs: any) => cs.subject_id);
      
      const { data, error } = await supabase
        .from("subject_chapters")
        .select(`
          *,
          subject_topics(*)
        `)
        .in("subject_id", subjectIds)
        .order("sequence_order");
      
      if (error) throw error;
      
      // Group chapters by subject_id
      const grouped = data.reduce((acc: any, chapter: any) => {
        if (!acc[chapter.subject_id]) {
          acc[chapter.subject_id] = [];
        }
        acc[chapter.subject_id].push(chapter);
        return acc;
      }, {});
      
      return grouped;
    },
    enabled: !!courseId && !!courseSubjects && courseSubjects.length > 0,
  });

  if (!courseId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Please save the course first
      </div>
    );
  }

  if (!courseSubjects || courseSubjects.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Please add subjects first in the Subjects tab
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-lg font-semibold">Course Content by Subject</Label>
        <p className="text-sm text-muted-foreground mt-1">
          Viewing all chapters and topics for {courseSubjects.length} subject(s)
        </p>
      </div>

      <div className="space-y-4">
        {courseSubjects.map((cs: any) => {
          const chapters = allChapters?.[cs.subject_id] || [];
          
          return (
            <Card key={cs.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  {cs.subject?.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {chapters.length > 0 ? (
                  <Accordion type="single" collapsible className="w-full">
                    {chapters.map((chapter: any) => (
                      <AccordionItem key={chapter.id} value={chapter.id}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2">
                            <List className="w-4 h-4" />
                            <span>Chapter {chapter.chapter_number}: {chapter.title}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {chapter.subject_topics && chapter.subject_topics.length > 0 ? (
                            <div className="space-y-2 ml-6 mt-2">
                              {chapter.subject_topics.map((topic: any) => (
                                <div key={topic.id} className="flex items-start gap-2 text-sm">
                                  <span className="text-muted-foreground">•</span>
                                  <div>
                                    <span className="font-medium">Topic {topic.topic_number}:</span>{" "}
                                    {topic.title}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground ml-6 mt-2">
                              No topics yet for this chapter
                            </p>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No chapters found for this subject
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};