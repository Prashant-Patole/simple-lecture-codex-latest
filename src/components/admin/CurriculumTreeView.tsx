import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, BookOpen, FileText, List } from "lucide-react";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectManagement";
import { useSubtopics } from "@/hooks/useSubtopics";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface CurriculumTreeViewProps {
  subjectId: string;
  subjectName: string;
}

export function CurriculumTreeView({ subjectId, subjectName }: CurriculumTreeViewProps) {
  const { data: chapters, isLoading } = useSubjectChapters(subjectId);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const toggleChapter = (chapterId: string) => {
    const newSet = new Set(expandedChapters);
    if (newSet.has(chapterId)) {
      newSet.delete(chapterId);
    } else {
      newSet.add(chapterId);
    }
    setExpandedChapters(newSet);
  };

  const toggleTopic = (topicId: string) => {
    const newSet = new Set(expandedTopics);
    if (newSet.has(topicId)) {
      newSet.delete(topicId);
    } else {
      newSet.add(topicId);
    }
    setExpandedTopics(newSet);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Curriculum Tree View</CardTitle>
          <CardDescription>Loading curriculum structure...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!chapters || chapters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Curriculum Tree View</CardTitle>
          <CardDescription>No curriculum structure available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Add chapters to see the curriculum tree view
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Curriculum Tree View</CardTitle>
            <CardDescription>
              Hierarchical view of {subjectName} curriculum structure
            </CardDescription>
          </div>
          <Badge variant="secondary">
            {chapters.length} chapters
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-1">
            {chapters.map((chapter) => (
              <ChapterTreeNode
                key={chapter.id}
                chapter={chapter}
                isExpanded={expandedChapters.has(chapter.id)}
                onToggle={() => toggleChapter(chapter.id)}
                expandedTopics={expandedTopics}
                onToggleTopic={toggleTopic}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

interface ChapterTreeNodeProps {
  chapter: any;
  isExpanded: boolean;
  onToggle: () => void;
  expandedTopics: Set<string>;
  onToggleTopic: (topicId: string) => void;
}

function ChapterTreeNode({
  chapter,
  isExpanded,
  onToggle,
  expandedTopics,
  onToggleTopic,
}: ChapterTreeNodeProps) {
  const { data: topics } = useChapterTopics(chapter.id);

  return (
    <div className="border-l-2 border-border pl-2">
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}
        <BookOpen className="h-4 w-4 flex-shrink-0 text-primary" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge variant="outline" className="text-xs flex-shrink-0">
            Ch {chapter.chapter_number}
          </Badge>
          <span className="font-medium truncate">{chapter.title}</span>
          <Badge variant="secondary" className="text-xs ml-auto flex-shrink-0">
            {topics?.length || 0} topics
          </Badge>
        </div>
      </div>

      {isExpanded && topics && topics.length > 0 && (
        <div className="ml-4 mt-1 space-y-1">
          {topics.map((topic) => (
            <TopicTreeNode
              key={topic.id}
              topic={topic}
              isExpanded={expandedTopics.has(topic.id)}
              onToggle={() => onToggleTopic(topic.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TopicTreeNodeProps {
  topic: any;
  isExpanded: boolean;
  onToggle: () => void;
}

function TopicTreeNode({ topic, isExpanded, onToggle }: TopicTreeNodeProps) {
  const { data: subtopics } = useSubtopics(topic.id);

  return (
    <div className="border-l-2 border-border pl-2">
      <div
        className="flex items-center gap-2 py-1.5 px-3 rounded-md hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        {subtopics && subtopics.length > 0 ? (
          isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          )
        ) : (
          <div className="w-3.5" />
        )}
        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {topic.topic_number}
          </Badge>
          <span className="text-sm truncate">{topic.title}</span>
          {subtopics && subtopics.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-auto flex-shrink-0">
              {subtopics.length} subtopics
            </Badge>
          )}
        </div>
      </div>

      {isExpanded && subtopics && subtopics.length > 0 && (
        <div className="ml-4 mt-1 space-y-1">
          {subtopics.map((subtopic) => (
            <div
              key={subtopic.id}
              className="flex items-center gap-2 py-1 px-3 rounded-md hover:bg-muted/20"
            >
              <List className="h-3 w-3 flex-shrink-0 text-green-500" />
              <span className="text-xs truncate">{subtopic.title}</span>
              {subtopic.estimated_duration_minutes && (
                <Badge variant="outline" className="text-xs ml-auto flex-shrink-0">
                  {subtopic.estimated_duration_minutes} min
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
