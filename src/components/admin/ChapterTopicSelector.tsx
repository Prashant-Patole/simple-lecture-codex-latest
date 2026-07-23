import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { useAISuggestChapterTopic } from "@/hooks/useAISuggestChapterTopic";
import { useSubjectChapters, useChapterTopics } from "@/hooks/useSubjectManagement";
import { useSubtopics } from "@/hooks/useSubtopics";

interface ChapterTopicSelectorProps {
  questionText: string;
  subjectId: string;
  subjectName?: string;
  categoryName?: string;
  currentChapterId?: string;
  currentTopicId?: string;
  currentSubtopicId?: string;
  onAssignmentChange: (chapterId: string, topicId: string, subtopicId?: string | null) => void;
}

export const ChapterTopicSelector = ({
  questionText,
  subjectId,
  subjectName,
  categoryName,
  currentChapterId,
  currentTopicId,
  currentSubtopicId,
  onAssignmentChange
}: ChapterTopicSelectorProps) => {
  const [selectedChapterId, setSelectedChapterId] = useState(currentChapterId || "");
  const [selectedTopicId, setSelectedTopicId] = useState(currentTopicId || "");
  const [selectedSubtopicId, setSelectedSubtopicId] = useState(currentSubtopicId || "");
  const [showSuggestion, setShowSuggestion] = useState(false);

  const { data: chapters } = useSubjectChapters(subjectId);
  const { data: topics } = useChapterTopics(selectedChapterId);
  const { data: subtopics } = useSubtopics(selectedTopicId);

  const suggestionMutation = useAISuggestChapterTopic();

  const handleGetSuggestion = () => {
    suggestionMutation.mutate({
      questionText,
      subjectId,
      subjectName,
      categoryName,
      existingChapters: chapters,
      existingTopics: topics,
      existingSubtopics: subtopics
    }, {
      onSuccess: () => {
        setShowSuggestion(true);
      }
    });
  };

  const handleAcceptSuggestion = () => {
    if (suggestionMutation.data) {
      const { suggestedChapter, suggestedTopic, suggestedSubtopic } = suggestionMutation.data;
      
      if (suggestedChapter?.id) {
        setSelectedChapterId(suggestedChapter.id);
      }
      if (suggestedTopic?.id) {
        setSelectedTopicId(suggestedTopic.id);
      }
      if (suggestedSubtopic?.id) {
        setSelectedSubtopicId(suggestedSubtopic.id);
      }
      
      setShowSuggestion(false);
    }
  };

  const handleApplyChanges = () => {
    if (selectedChapterId && selectedTopicId) {
      onAssignmentChange(selectedChapterId, selectedTopicId, selectedSubtopicId || null);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-green-100 text-green-800">High ({(confidence * 100).toFixed(0)}%)</Badge>;
    if (confidence >= 0.5) return <Badge className="bg-yellow-100 text-yellow-800">Medium ({(confidence * 100).toFixed(0)}%)</Badge>;
    return <Badge className="bg-red-100 text-red-800">Low ({(confidence * 100).toFixed(0)}%)</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label>Chapter</Label>
          <Select value={selectedChapterId} onValueChange={setSelectedChapterId}>
            <SelectTrigger>
              <SelectValue placeholder="Select chapter" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {chapters?.map((chapter) => (
                <SelectItem key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Topic</Label>
          <Select 
            value={selectedTopicId} 
            onValueChange={setSelectedTopicId}
            disabled={!selectedChapterId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select topic" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {topics?.map((topic) => (
                <SelectItem key={topic.id} value={topic.id}>
                  {topic.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Subtopic (Optional)</Label>
          <Select 
            value={selectedSubtopicId} 
            onValueChange={setSelectedSubtopicId}
            disabled={!selectedTopicId}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select subtopic" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              {subtopics?.map((subtopic) => (
                <SelectItem key={subtopic.id} value={subtopic.id}>
                  {subtopic.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleGetSuggestion}
          disabled={suggestionMutation.isPending}
        >
          {suggestionMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Getting AI Suggestion...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              AI Suggest
            </>
          )}
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={handleApplyChanges}
          disabled={!selectedChapterId || !selectedTopicId}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Apply Changes
        </Button>
      </div>

      {showSuggestion && suggestionMutation.data && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600" />
                AI Suggestions
              </h4>
              <Button size="sm" onClick={handleAcceptSuggestion}>
                Accept All
              </Button>
            </div>

            {suggestionMutation.data.suggestedChapter && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Chapter:</span>
                  <span className="text-sm">{suggestionMutation.data.suggestedChapter.title}</span>
                  {getConfidenceBadge(suggestionMutation.data.suggestedChapter.confidence)}
                </div>
                <p className="text-xs text-muted-foreground">{suggestionMutation.data.suggestedChapter.reasoning}</p>
              </div>
            )}

            {suggestionMutation.data.suggestedTopic && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Topic:</span>
                  <span className="text-sm">{suggestionMutation.data.suggestedTopic.title}</span>
                  {getConfidenceBadge(suggestionMutation.data.suggestedTopic.confidence)}
                </div>
                <p className="text-xs text-muted-foreground">{suggestionMutation.data.suggestedTopic.reasoning}</p>
              </div>
            )}

            {suggestionMutation.data.suggestedSubtopic && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Subtopic:</span>
                  <span className="text-sm">{suggestionMutation.data.suggestedSubtopic.title}</span>
                  {getConfidenceBadge(suggestionMutation.data.suggestedSubtopic.confidence)}
                </div>
                <p className="text-xs text-muted-foreground">{suggestionMutation.data.suggestedSubtopic.reasoning}</p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
