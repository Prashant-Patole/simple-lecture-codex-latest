import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Copy, Merge, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";

interface ChapterBulkOperationsProps {
  subjectId: string;
  chapters: any[];
  subjects: any[];
}

export function ChapterBulkOperations({
  subjectId,
  chapters,
  subjects,
}: ChapterBulkOperationsProps) {
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedChapter, setSelectedChapter] = useState<string>("");
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [targetSubject, setTargetSubject] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const handleDuplicateChapter = async () => {
    if (!selectedChapter) return;

    setIsProcessing(true);
    try {
      const chapter = chapters.find((c) => c.id === selectedChapter);
      if (!chapter) throw new Error("Chapter not found");

      // Fetch topics
      const { data: topics, error: topicsError } = await supabase
        .from("subject_topics")
        .select("*")
        .eq("chapter_id", selectedChapter);

      if (topicsError) throw topicsError;

      // Create duplicate chapter
      const { data: newChapter, error: chapterError } = await supabase
        .from("subject_chapters")
        .insert({
          subject_id: subjectId,
          chapter_number: chapter.chapter_number + 100, // Temporary number
          title: `${chapter.title} (Copy)`,
          description: chapter.description,
          sequence_order: chapters.length + 1,
        })
        .select()
        .single();

      if (chapterError) throw chapterError;

      // Duplicate topics and subtopics
      for (const topic of topics || []) {
        const { data: newTopic, error: topicError } = await supabase
          .from("subject_topics")
          .insert({
            chapter_id: newChapter.id,
            topic_number: topic.topic_number,
            title: topic.title,
            estimated_duration_minutes: topic.estimated_duration_minutes,
            content_markdown: topic.content_markdown,
            sequence_order: topic.sequence_order,
          })
          .select()
          .single();

        if (topicError) throw topicError;

        // Fetch and duplicate subtopics
        const { data: subtopics } = await supabase
          .from("subtopics")
          .select("*")
          .eq("topic_id", topic.id);

        if (subtopics && subtopics.length > 0) {
          const subtopicsToInsert = subtopics.map((st) => ({
            topic_id: newTopic.id,
            title: st.title,
            description: st.description,
            estimated_duration_minutes: st.estimated_duration_minutes,
            sequence_order: st.sequence_order,
          }));

          await supabase.from("subtopics").insert(subtopicsToInsert);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["subject-chapters", subjectId] });
      toast({
        title: "Chapter Duplicated",
        description: `${chapter.title} has been duplicated successfully`,
      });
      setDuplicateDialogOpen(false);
      setSelectedChapter("");
    } catch (error: any) {
      toast({
        title: "Duplication Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyToSubject = async () => {
    if (!selectedChapter || !targetSubject) return;

    setIsProcessing(true);
    try {
      const chapter = chapters.find((c) => c.id === selectedChapter);
      if (!chapter) throw new Error("Chapter not found");

      // Fetch topics
      const { data: topics, error: topicsError } = await supabase
        .from("subject_topics")
        .select("*")
        .eq("chapter_id", selectedChapter);

      if (topicsError) throw topicsError;

      // Get target subject's chapter count
      const { data: targetChapters } = await supabase
        .from("subject_chapters")
        .select("chapter_number")
        .eq("subject_id", targetSubject)
        .order("chapter_number", { ascending: false })
        .limit(1);

      const nextChapterNumber = (targetChapters?.[0]?.chapter_number || 0) + 1;

      // Create chapter in target subject
      const { data: newChapter, error: chapterError } = await supabase
        .from("subject_chapters")
        .insert({
          subject_id: targetSubject,
          chapter_number: nextChapterNumber,
          title: chapter.title,
          description: chapter.description,
          sequence_order: nextChapterNumber,
        })
        .select()
        .single();

      if (chapterError) throw chapterError;

      // Copy topics and subtopics
      for (const topic of topics || []) {
        const { data: newTopic, error: topicError } = await supabase
          .from("subject_topics")
          .insert({
            chapter_id: newChapter.id,
            topic_number: topic.topic_number,
            title: topic.title,
            estimated_duration_minutes: topic.estimated_duration_minutes,
            content_markdown: topic.content_markdown,
            sequence_order: topic.sequence_order,
          })
          .select()
          .single();

        if (topicError) throw topicError;

        const { data: subtopics } = await supabase
          .from("subtopics")
          .select("*")
          .eq("topic_id", topic.id);

        if (subtopics && subtopics.length > 0) {
          const subtopicsToInsert = subtopics.map((st) => ({
            topic_id: newTopic.id,
            title: st.title,
            description: st.description,
            estimated_duration_minutes: st.estimated_duration_minutes,
            sequence_order: st.sequence_order,
          }));

          await supabase.from("subtopics").insert(subtopicsToInsert);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["subject-chapters"] });
      toast({
        title: "Chapter Copied",
        description: `${chapter.title} has been copied to target subject`,
      });
      setCopyDialogOpen(false);
      setSelectedChapter("");
      setTargetSubject("");
    } catch (error: any) {
      toast({
        title: "Copy Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMergeTopics = async () => {
    if (selectedTopics.size < 2) {
      toast({
        title: "Selection Required",
        description: "Please select at least 2 topics to merge",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Coming Soon",
      description: "Topic merging will be available in the next update",
    });
    setMergeDialogOpen(false);
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDuplicateDialogOpen(true)}
      >
        <Copy className="h-4 w-4 mr-2" />
        Duplicate Chapter
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setCopyDialogOpen(true)}
      >
        <Copy className="h-4 w-4 mr-2" />
        Copy to Subject
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setMergeDialogOpen(true)}
      >
        <Merge className="h-4 w-4 mr-2" />
        Merge Topics
      </Button>

      {/* Duplicate Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Chapter</DialogTitle>
            <DialogDescription>
              Select a chapter to duplicate with all its topics and subtopics
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Chapter</Label>
              <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a chapter" />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      Ch {chapter.chapter_number}: {chapter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDuplicateChapter}
              disabled={!selectedChapter || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Duplicating...
                </>
              ) : (
                "Duplicate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy to Subject Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Chapter to Another Subject</DialogTitle>
            <DialogDescription>
              Copy a chapter with all its content to another subject
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Chapter</Label>
              <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a chapter" />
                </SelectTrigger>
                <SelectContent>
                  {chapters.map((chapter) => (
                    <SelectItem key={chapter.id} value={chapter.id}>
                      Ch {chapter.chapter_number}: {chapter.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target Subject</Label>
              <Select value={targetSubject} onValueChange={setTargetSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose target subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects
                    .filter((s) => s.id !== subjectId)
                    .map((subject) => (
                      <SelectItem key={subject.id} value={subject.id}>
                        {subject.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCopyToSubject}
              disabled={!selectedChapter || !targetSubject || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Copying...
                </>
              ) : (
                "Copy"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Topics Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge Topics</DialogTitle>
            <DialogDescription>
              Select multiple topics to merge into one (Coming Soon)
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
