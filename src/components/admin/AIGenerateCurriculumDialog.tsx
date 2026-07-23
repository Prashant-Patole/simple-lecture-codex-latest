import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, ChevronRight, ChevronDown, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBulkImportChapters } from "@/hooks/useSubjectManagement";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AIGenerateCurriculumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectId: string;
  subjectName: string;
  categoryName?: string;
}

export function AIGenerateCurriculumDialog({
  open,
  onOpenChange,
  subjectId,
  subjectName,
  categoryName,
}: AIGenerateCurriculumDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [numberOfChapters, setNumberOfChapters] = useState(10);
  const [generatedCurriculum, setGeneratedCurriculum] = useState<any[]>([]);
  const [expandedChapters, setExpandedChapters] = useState<Set<number>>(new Set());
  const [editingItem, setEditingItem] = useState<{ type: 'chapter' | 'topic' | 'subtopic', chapterIdx: number, topicIdx?: number, subtopicIdx?: number } | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string, chapterIdx: number, topicIdx?: number, subtopicIdx?: number } | null>(null);
  const bulkImport = useBulkImportChapters();

  const toggleChapter = (index: number) => {
    const newExpanded = new Set(expandedChapters);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedChapters(newExpanded);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedCurriculum([]);

    try {
      const { data, error } = await supabase.functions.invoke('ai-generate-curriculum', {
        body: {
          subjectName,
          categoryName,
          numberOfChapters,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Generation Failed",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      setGeneratedCurriculum(data.curriculum || []);
      setExpandedChapters(new Set([0, 1])); // Expand first 2 chapters by default
      
      toast({
        title: "Curriculum Generated",
        description: `Generated ${data.curriculum?.length || 0} chapters. Review and approve to add to subject.`,
      });
    } catch (error: any) {
      console.error("AI generation error:", error);
      toast({
        title: "Generation Error",
        description: error.message || "Failed to generate curriculum",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const startEdit = (type: 'chapter' | 'topic' | 'subtopic', chapterIdx: number, topicIdx?: number, subtopicIdx?: number) => {
    setEditingItem({ type, chapterIdx, topicIdx, subtopicIdx });
    
    if (type === 'chapter') {
      setEditValues({
        title: generatedCurriculum[chapterIdx].title,
        description: generatedCurriculum[chapterIdx].description,
      });
    } else if (type === 'topic' && topicIdx !== undefined) {
      const topic = generatedCurriculum[chapterIdx].topics[topicIdx];
      setEditValues({
        title: topic.title,
        estimated_duration_minutes: topic.estimated_duration_minutes,
        content_markdown: topic.content_markdown || '',
      });
    } else if (type === 'subtopic' && topicIdx !== undefined && subtopicIdx !== undefined) {
      const subtopic = generatedCurriculum[chapterIdx].topics[topicIdx].subtopics[subtopicIdx];
      setEditValues({
        title: subtopic.title,
        description: subtopic.description,
        estimated_duration_minutes: subtopic.estimated_duration_minutes,
      });
    }
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditValues({});
  };

  const saveEdit = () => {
    if (!editingItem) return;

    const newCurriculum = [...generatedCurriculum];
    const { type, chapterIdx, topicIdx, subtopicIdx } = editingItem;

    if (type === 'chapter') {
      newCurriculum[chapterIdx] = {
        ...newCurriculum[chapterIdx],
        title: editValues.title,
        description: editValues.description,
      };
    } else if (type === 'topic' && topicIdx !== undefined) {
      newCurriculum[chapterIdx].topics[topicIdx] = {
        ...newCurriculum[chapterIdx].topics[topicIdx],
        title: editValues.title,
        estimated_duration_minutes: parseInt(editValues.estimated_duration_minutes) || 60,
        content_markdown: editValues.content_markdown,
      };
    } else if (type === 'subtopic' && topicIdx !== undefined && subtopicIdx !== undefined) {
      newCurriculum[chapterIdx].topics[topicIdx].subtopics[subtopicIdx] = {
        ...newCurriculum[chapterIdx].topics[topicIdx].subtopics[subtopicIdx],
        title: editValues.title,
        description: editValues.description,
        estimated_duration_minutes: parseInt(editValues.estimated_duration_minutes) || 30,
      };
    }

    setGeneratedCurriculum(newCurriculum);
    setEditingItem(null);
    setEditValues({});
    toast({ title: "Updated", description: "Changes saved successfully" });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;

    const newCurriculum = [...generatedCurriculum];
    const { type, chapterIdx, topicIdx, subtopicIdx } = deleteConfirm;

    if (type === 'chapter') {
      newCurriculum.splice(chapterIdx, 1);
    } else if (type === 'topic' && topicIdx !== undefined) {
      newCurriculum[chapterIdx].topics.splice(topicIdx, 1);
    } else if (type === 'subtopic' && topicIdx !== undefined && subtopicIdx !== undefined) {
      newCurriculum[chapterIdx].topics[topicIdx].subtopics.splice(subtopicIdx, 1);
    }

    setGeneratedCurriculum(newCurriculum);
    setDeleteConfirm(null);
    toast({ title: "Deleted", description: `${type} removed successfully` });
  };

  const addNewTopic = (chapterIdx: number) => {
    const newCurriculum = [...generatedCurriculum];
    const nextTopicNumber = (newCurriculum[chapterIdx].topics?.length || 0) + 1;
    
    if (!newCurriculum[chapterIdx].topics) {
      newCurriculum[chapterIdx].topics = [];
    }
    
    newCurriculum[chapterIdx].topics.push({
      topic_number: nextTopicNumber,
      title: `New Topic ${nextTopicNumber}`,
      estimated_duration_minutes: 60,
      content_markdown: '',
      subtopics: [],
    });
    
    setGeneratedCurriculum(newCurriculum);
    toast({ title: "Topic Added", description: "New topic created" });
  };

  const addNewSubtopic = (chapterIdx: number, topicIdx: number) => {
    const newCurriculum = [...generatedCurriculum];
    const nextOrder = (newCurriculum[chapterIdx].topics[topicIdx].subtopics?.length || 0) + 1;
    
    if (!newCurriculum[chapterIdx].topics[topicIdx].subtopics) {
      newCurriculum[chapterIdx].topics[topicIdx].subtopics = [];
    }
    
    newCurriculum[chapterIdx].topics[topicIdx].subtopics.push({
      title: `New Subtopic ${nextOrder}`,
      description: '',
      estimated_duration_minutes: 30,
      sequence_order: nextOrder,
    });
    
    setGeneratedCurriculum(newCurriculum);
    toast({ title: "Subtopic Added", description: "New subtopic created" });
  };

  const handleApprove = async () => {
    if (generatedCurriculum.length === 0) return;

    try {
      const result = await bulkImport.mutateAsync({
        subjectId,
        chapters: generatedCurriculum,
      });

      toast({
        title: "Curriculum Imported",
        description: `Successfully imported ${result.chapters} chapters, ${result.topics} topics, and ${result.subtopics} subtopics.`,
      });

      onOpenChange(false);
      setGeneratedCurriculum([]);
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import curriculum",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Curriculum Generator
          </DialogTitle>
          <DialogDescription>
            Generate a comprehensive chapter structure for {subjectName}
            {categoryName && ` (${categoryName})`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Generation Settings */}
          {generatedCurriculum.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Generation Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="numChapters">Number of Chapters</Label>
                  <Input
                    id="numChapters"
                    type="number"
                    min={3}
                    max={20}
                    value={numberOfChapters}
                    onChange={(e) => setNumberOfChapters(parseInt(e.target.value) || 10)}
                    disabled={isGenerating}
                  />
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Curriculum...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Curriculum
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Preview Generated Curriculum */}
          {generatedCurriculum.length > 0 && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Preview Generated Curriculum</CardTitle>
                    <Badge variant="secondary">
                      {generatedCurriculum.length} Chapters
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-2">
                      {generatedCurriculum.map((chapter, chapterIndex) => (
                        <Collapsible
                          key={chapterIndex}
                          open={expandedChapters.has(chapterIndex)}
                          onOpenChange={() => toggleChapter(chapterIndex)}
                        >
                           <Card>
                            <CollapsibleTrigger className="w-full">
                              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 text-left flex-1">
                                    {expandedChapters.has(chapterIndex) ? (
                                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                                    )}
                                    {editingItem?.type === 'chapter' && editingItem.chapterIdx === chapterIndex ? (
                                      <div className="flex-1 space-y-2" onClick={(e) => e.stopPropagation()}>
                                        <Input
                                          value={editValues.title}
                                          onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                                          placeholder="Chapter title"
                                          className="h-8"
                                        />
                                        <Textarea
                                          value={editValues.description}
                                          onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                                          placeholder="Chapter description"
                                          className="min-h-[60px]"
                                        />
                                        <div className="flex gap-2">
                                          <Button size="sm" onClick={saveEdit} variant="default">
                                            <Check className="h-3 w-3 mr-1" /> Save
                                          </Button>
                                          <Button size="sm" onClick={cancelEdit} variant="outline">
                                            <X className="h-3 w-3 mr-1" /> Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <Badge variant="outline" className="text-xs">
                                            {chapter.chapter_number}
                                          </Badge>
                                          <span className="font-semibold">{chapter.title}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {chapter.description}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <Badge variant="secondary" className="text-xs">
                                      {chapter.topics?.length || 0} topics
                                    </Badge>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startEdit('chapter', chapterIndex)}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setDeleteConfirm({ type: 'chapter', chapterIdx: chapterIndex })}
                                    >
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <CardContent className="pt-0 space-y-2">
                                {chapter.topics?.map((topic: any, topicIndex: number) => (
                                  <Card key={topicIndex} className="bg-muted/30">
                                    <CardContent className="p-3">
                                      {editingItem?.type === 'topic' && editingItem.chapterIdx === chapterIndex && editingItem.topicIdx === topicIndex ? (
                                        <div className="space-y-2">
                                          <Input
                                            value={editValues.title}
                                            onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                                            placeholder="Topic title"
                                            className="h-8"
                                          />
                                          <Input
                                            type="number"
                                            value={editValues.estimated_duration_minutes}
                                            onChange={(e) => setEditValues({ ...editValues, estimated_duration_minutes: e.target.value })}
                                            placeholder="Duration (minutes)"
                                            className="h-8"
                                          />
                                          <div className="flex gap-2">
                                            <Button size="sm" onClick={saveEdit} variant="default">
                                              <Check className="h-3 w-3 mr-1" /> Save
                                            </Button>
                                            <Button size="sm" onClick={cancelEdit} variant="outline">
                                              <X className="h-3 w-3 mr-1" /> Cancel
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                              {topic.topic_number}
                                            </Badge>
                                            <span className="text-sm font-medium flex-1">{topic.title}</span>
                                            <Badge variant="secondary" className="text-xs">
                                              {topic.estimated_duration_minutes} min
                                            </Badge>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => startEdit('topic', chapterIndex, topicIndex)}
                                            >
                                              <Pencil className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => setDeleteConfirm({ type: 'topic', chapterIdx: chapterIndex, topicIdx: topicIndex })}
                                            >
                                              <Trash2 className="h-3 w-3 text-destructive" />
                                            </Button>
                                          </div>
                                          {topic.subtopics && topic.subtopics.length > 0 && (
                                            <div className="ml-6 space-y-1">
                                              {topic.subtopics.map((subtopic: any, subIndex: number) => (
                                                <div key={subIndex}>
                                                  {editingItem?.type === 'subtopic' && editingItem.chapterIdx === chapterIndex && editingItem.topicIdx === topicIndex && editingItem.subtopicIdx === subIndex ? (
                                                    <div className="space-y-2 p-2 border rounded">
                                                      <Input
                                                        value={editValues.title}
                                                        onChange={(e) => setEditValues({ ...editValues, title: e.target.value })}
                                                        placeholder="Subtopic title"
                                                        className="h-7 text-xs"
                                                      />
                                                      <Input
                                                        value={editValues.description}
                                                        onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                                                        placeholder="Description"
                                                        className="h-7 text-xs"
                                                      />
                                                      <Input
                                                        type="number"
                                                        value={editValues.estimated_duration_minutes}
                                                        onChange={(e) => setEditValues({ ...editValues, estimated_duration_minutes: e.target.value })}
                                                        placeholder="Duration"
                                                        className="h-7 text-xs"
                                                      />
                                                      <div className="flex gap-2">
                                                        <Button size="sm" onClick={saveEdit} variant="default" className="h-7 text-xs">
                                                          <Check className="h-3 w-3" />
                                                        </Button>
                                                        <Button size="sm" onClick={cancelEdit} variant="outline" className="h-7 text-xs">
                                                          <X className="h-3 w-3" />
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center gap-2 text-xs group">
                                                      <span className="text-muted-foreground">•</span>
                                                      <span className="flex-1">{subtopic.title}</span>
                                                      <Badge variant="outline" className="text-xs">
                                                        {subtopic.estimated_duration_minutes} min
                                                      </Badge>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                                        onClick={() => startEdit('subtopic', chapterIndex, topicIndex, subIndex)}
                                                      >
                                                        <Pencil className="h-3 w-3" />
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                                        onClick={() => setDeleteConfirm({ type: 'subtopic', chapterIdx: chapterIndex, topicIdx: topicIndex, subtopicIdx: subIndex })}
                                                      >
                                                        <Trash2 className="h-3 w-3 text-destructive" />
                                                      </Button>
                                                    </div>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => addNewSubtopic(chapterIndex, topicIndex)}
                                            className="h-7 text-xs ml-6"
                                          >
                                            <Plus className="h-3 w-3 mr-1" /> Add Subtopic
                                          </Button>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ))}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => addNewTopic(chapterIndex)}
                                  className="w-full"
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Add Topic
                                </Button>
                              </CardContent>
                            </CollapsibleContent>
                          </Card>
                        </Collapsible>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm text-muted-foreground">
                  Review and edit the generated curriculum. Click edit icons to modify any item, or "Approve & Import" to add to {subjectName}.
                </p>
              </div>
            </>
          )}
        </div>

        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this {deleteConfirm?.type}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <DialogFooter>
          {generatedCurriculum.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setGeneratedCurriculum([]);
                  setExpandedChapters(new Set());
                }}
              >
                Regenerate
              </Button>
              <Button
                onClick={handleApprove}
                disabled={bulkImport.isPending}
              >
                {bulkImport.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Approve & Import"
                )}
              </Button>
            </>
          )}
          {generatedCurriculum.length === 0 && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
