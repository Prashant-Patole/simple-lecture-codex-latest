import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, Video, ClipboardList, FolderOpen, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RecordedVideos } from "@/components/learning/RecordedVideos";
import { MCQTest } from "@/components/learning/MCQTest";
import { SubjectNavigationBar } from "@/components/learning/SubjectNavigationBar";
import { useSubjectChapters } from "@/hooks/useLearningCourse";

// Fetch all active courses with their subjects
function useCheckerCourses() {
  return useQuery({
    queryKey: ["checker-courses"],
    queryFn: async () => {
      const { data: courses, error: cErr } = await supabase
        .from("courses")
        .select("id, name, slug, category, thumbnail_url")
        .eq("is_active", true)
        .order("name");
      if (cErr) throw cErr;

      const { data: courseSubjects, error: csErr } = await supabase
        .from("course_subjects")
        .select("course_id, subject_id, display_order, popular_subjects(id, name, slug, thumbnail_url)")
        .order("display_order");
      if (csErr) throw csErr;

      const map = new Map<string, { id: string; name: string; slug: string; thumbnail_url: string | null }[]>();
      for (const cs of courseSubjects || []) {
        const subj = cs.popular_subjects as any;
        if (!subj) continue;
        const list = map.get(cs.course_id) || [];
        list.push({ id: subj.id, name: subj.name, slug: subj.slug, thumbnail_url: subj.thumbnail_url });
        map.set(cs.course_id, list);
      }

      return (courses || []).map((c) => ({
        ...c,
        subjects: map.get(c.id) || [],
      }));
    },
  });
}

export default function CheckerDashboard() {
  const { data: courses, isLoading: coursesLoading } = useCheckerCourses();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [selectedChapter, setSelectedChapter] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("videos");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const selectedCourse = courses?.find((c) => c.id === selectedCourseId);
  const subjects = selectedCourse?.subjects || [];

  const { data: chapters, isLoading: chaptersLoading } = useSubjectChapters(selectedSubjectId || undefined);

  // Auto-select first subject when course is selected
  useEffect(() => {
    if (subjects.length && !selectedSubjectId) {
      setSelectedSubjectId(subjects[0].id);
    }
  }, [subjects, selectedSubjectId]);

  // Reset topic/chapter when subject changes
  useEffect(() => {
    setSelectedTopic(null);
    setSelectedChapter(null);
    setActiveTab("videos");
  }, [selectedSubjectId]);

  const handleSubjectChange = useCallback((subjectId: string) => {
    setSelectedSubjectId(subjectId);
  }, []);

  const handleTopicClick = useCallback((topic: any, chapter: any) => {
    setSelectedTopic(topic);
    setSelectedChapter(null);
    setActiveTab("videos");
  }, []);

  const handleChapterClick = useCallback((chapter: any) => {
    setSelectedChapter(chapter);
    setSelectedTopic(null);
    setActiveTab("videos");
  }, []);

  const handleBackToCourses = () => {
    setSelectedCourseId(null);
    setSelectedSubjectId(null);
    setSelectedTopic(null);
    setSelectedChapter(null);
  };

  // === Course selection grid ===
  if (!selectedCourseId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Select a Course to Review</h1>
        {coursesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses?.map((course) => (
              <Card
                key={course.id}
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
                onClick={() => setSelectedCourseId(course.id)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <BookOpen className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{course.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {course.subjects.length} subject{course.subjects.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // === Learning view ===
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Top bar: back + subject pills */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
        <Button variant="ghost" size="sm" onClick={handleBackToCourses} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Courses
        </Button>
        <span className="text-sm font-medium text-muted-foreground mr-2">
          {selectedCourse?.name}
        </span>
        {subjects.length > 1 && (
          <SubjectNavigationBar
            subjects={subjects}
            selectedSubjectId={selectedSubjectId}
            onSubjectChange={handleSubjectChange}
          />
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: chapters + topics */}
        <div className={cn(
          "border-r bg-muted/30 overflow-y-auto transition-all duration-200",
          sidebarCollapsed ? "w-0 opacity-0" : "w-72 min-w-[18rem]"
        )}>
          {chaptersLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded" />
              ))}
            </div>
          ) : !chapters?.length ? (
            <div className="p-6 text-center text-muted-foreground">
              <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No chapters found</p>
            </div>
          ) : (
            <Accordion type="multiple" className="p-2">
              {chapters.map((chapter: any) => (
                <AccordionItem key={chapter.chapter_id} value={chapter.chapter_id}>
                  <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                    <button
                      className={cn(
                        "text-left flex-1 font-medium",
                        selectedChapter?.id === chapter.chapter_id && !selectedTopic && "text-primary"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleChapterClick({ id: chapter.chapter_id, chapter_number: chapter.chapter_number, title: chapter.title });
                      }}
                    >
                      Ch {chapter.chapter_number}: {chapter.title}
                    </button>
                  </AccordionTrigger>
                  <AccordionContent className="pb-1">
                    <div className="space-y-0.5 pl-4">
                      {(chapter.topics || []).map((topic: any) => (
                        <button
                          key={topic.id}
                          className={cn(
                            "w-full text-left px-3 py-1.5 rounded text-sm transition-colors",
                            selectedTopic?.id === topic.id
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted text-foreground"
                          )}
                          onClick={() => handleTopicClick(topic, chapter)}
                        >
                          {topic.topic_number}. {topic.title}
                        </button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {!selectedTopic && !selectedChapter ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FolderOpen className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-lg font-medium">Select a chapter or topic</p>
              <p className="text-sm">Choose from the sidebar to review content</p>
            </div>
          ) : (
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-4">
                {selectedTopic
                  ? `${selectedTopic.topic_number}. ${selectedTopic.title}`
                  : `Ch ${selectedChapter.chapter_number}: ${selectedChapter.title}`}
              </h2>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="videos" className="gap-1.5">
                    <Video className="h-4 w-4" /> Classes
                  </TabsTrigger>
                  <TabsTrigger value="mcqs" className="gap-1.5">
                    <ClipboardList className="h-4 w-4" /> Question Bank
                  </TabsTrigger>
                </TabsList>

                {selectedTopic ? (
                  <>
                    <TabsContent value="videos">
                      <RecordedVideos
                        topicId={selectedTopic.id}
                        topicVideoId={selectedTopic.video_id}
                        aiGeneratedVideoUrl={selectedTopic.ai_generated_video_url}
                        topicTitle={`${selectedTopic.topic_number}. ${selectedTopic.title}`}
                      />
                    </TabsContent>
                    <TabsContent value="mcqs">
                      <MCQTest topicId={selectedTopic.id} />
                    </TabsContent>
                  </>
                ) : (
                  <>
                    <TabsContent value="videos">
                      <RecordedVideos
                        chapterId={selectedChapter.id}
                        topicTitle={`Ch ${selectedChapter.chapter_number}: ${selectedChapter.title}`}
                      />
                    </TabsContent>
                    <TabsContent value="mcqs">
                      <MCQTest chapterId={selectedChapter.id} chapterOnly />
                    </TabsContent>
                  </>
                )}
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
