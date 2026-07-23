import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, HelpCircle } from "lucide-react";
import { VideoPreview } from "./VideoPreview";
import { PDFPreview } from "./PDFPreview";
import { B2FileUploadWidget } from "./B2FileUploadWidget";
import { JsonUploadParseWidget } from "./JsonUploadParseWidget";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  useSubtopics,
  useCreateSubtopic,
  useUpdateSubtopic,
  useDeleteSubtopic,
} from "@/hooks/useSubtopics";
import { toast } from "@/hooks/use-toast";
import { useDatalab } from "@/hooks/useDatalab";
import { useAddAIAssistantDocument } from "@/hooks/useAIAssistantDocuments";

interface SubtopicsSectionProps {
  topicId: string;
  topicTitle: string;
  subjectId: string;
  subjectName: string;
  categoryId: string;
  parentCategoryName: string;
  subCategoryName: string;
  chapterName: string;
  chapterId: string;
}

export function SubjectSubtopicsSection({ 
  topicId, 
  topicTitle,
  subjectId,
  subjectName,
  categoryId,
  parentCategoryName,
  subCategoryName,
  chapterName,
  chapterId
}: SubtopicsSectionProps) {
  const [isAddSubtopicOpen, setIsAddSubtopicOpen] = useState(false);
  const [editingSubtopic, setEditingSubtopic] = useState<any>(null);
  const [deleteSubtopicId, setDeleteSubtopicId] = useState<string | null>(null);

  const [subtopicForm, setSubtopicForm] = useState({
    title: "",
    description: "",
    sequence_order: 1,
    estimated_duration_minutes: 30,
    video_id: "",
    video_platform: "",
    notes_markdown: "",
    content_markdown: "",
    pdf_url: "",
    content_json: null as any,
  });

  const { data: subtopics, isLoading } = useSubtopics(topicId);
  const createSubtopic = useCreateSubtopic();
  const updateSubtopic = useUpdateSubtopic();
  const deleteSubtopic = useDeleteSubtopic();
  
  // PDF parsing hooks for auto-parse after upload
  const { parsePdfFromUrl, isLoading: isParsingPdf } = useDatalab();
  const addDocument = useAddAIAssistantDocument();

  // Auto-parse handler for subtopic PDF uploads
  const handleSubtopicPdfUploadAndParse = async (pdfUrl: string) => {
    const result = await parsePdfFromUrl(pdfUrl);
    if (result) {
      const parsedContent = result.content_json || result;
      setSubtopicForm(prev => ({ ...prev, content_json: parsedContent }));
      
      if (subjectId) {
        try {
          const fileName = pdfUrl.split('/').pop() || "document.pdf";
          await addDocument.mutateAsync({
            subjectId,
            chapterId,
            topicId,
            displayName: `${subtopicForm.title || 'Subtopic'} (${topicTitle})`,
            sourceType: "pdf",
            sourceUrl: pdfUrl,
            fileName,
            contentPreview: JSON.stringify(parsedContent).substring(0, 500),
            fullContent: parsedContent,
          });
          toast({
            title: "PDF Parsed & Saved",
            description: `Document parsed and added to AI Assistant`,
          });
        } catch (error) {
          toast({
            title: "PDF Parsed",
            description: `Parsed successfully but couldn't save to Documents`,
          });
        }
      }
    }
  };

  const resetForm = () => {
    setSubtopicForm({
      title: "",
      description: "",
      sequence_order: (subtopics?.length || 0) + 1,
      estimated_duration_minutes: 30,
      video_id: "",
      video_platform: "",
      notes_markdown: "",
      content_markdown: "",
      pdf_url: "",
      content_json: null,
    });
  };

  const handleCreateSubtopic = () => {
    if (!subtopicForm.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Subtopic title is required",
        variant: "destructive",
      });
      return;
    }

    // Sanitize video fields - convert empty strings to null
    const sanitizedSubtopicForm = {
      ...subtopicForm,
      video_platform: subtopicForm.video_platform || null,
      video_id: subtopicForm.video_id || null,
    };

    createSubtopic.mutate(
      {
        topic_id: topicId,
        ...sanitizedSubtopicForm,
      },
      {
        onSuccess: () => {
          setIsAddSubtopicOpen(false);
          resetForm();
        },
      }
    );
  };

  const handleUpdateSubtopic = () => {
    if (!editingSubtopic) return;
    
    // Sanitize video fields - convert empty strings to null
    const sanitizedSubtopicForm = {
      ...subtopicForm,
      video_platform: subtopicForm.video_platform || null,
      video_id: subtopicForm.video_id || null,
    };

    updateSubtopic.mutate(
      {
        id: editingSubtopic.id,
        ...sanitizedSubtopicForm,
      },
      {
        onSuccess: () => {
          setEditingSubtopic(null);
          resetForm();
        },
      }
    );
  };

  const handleDeleteSubtopic = () => {
    if (!deleteSubtopicId) return;
    
    deleteSubtopic.mutate(deleteSubtopicId, {
      onSuccess: () => setDeleteSubtopicId(null),
    });
  };

  const openEditDialog = (subtopic: any) => {
    setEditingSubtopic(subtopic);
    setSubtopicForm({
      title: subtopic.title,
      description: subtopic.description || "",
      sequence_order: subtopic.sequence_order,
      estimated_duration_minutes: subtopic.estimated_duration_minutes || 30,
      video_id: subtopic.video_id || "",
      video_platform: subtopic.video_platform || "",
      notes_markdown: subtopic.notes_markdown || "",
      content_markdown: subtopic.content_markdown || "",
      pdf_url: subtopic.pdf_url || "",
      content_json: subtopic.content_json || null,
    });
  };

  return (
    <div className="ml-8 mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">
          Subtopics ({subtopics?.length || 0})
        </h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            resetForm();
            setIsAddSubtopicOpen(true);
          }}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Subtopic
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading subtopics...</p>
      ) : subtopics && subtopics.length > 0 ? (
        <div className="space-y-2">
          {subtopics.map((subtopic) => (
            <div
              key={subtopic.id}
              className="flex items-center justify-between p-3 bg-muted/30 rounded-md"
            >
              <div className="flex-1">
                <p className="font-medium text-sm">{subtopic.title}</p>
                {subtopic.description && (
                  <p className="text-xs text-muted-foreground">{subtopic.description}</p>
                )}
                <div className="flex gap-2 mt-1">
                  {subtopic.estimated_duration_minutes && (
                    <Badge variant="outline" className="text-xs">
                      {subtopic.estimated_duration_minutes} min
                    </Badge>
                  )}
                  {subtopic.video_id && (
                    <Badge variant="outline" className="text-xs">
                      Has Video
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEditDialog(subtopic)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteSubtopicId(subtopic.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No subtopics yet. Add your first one!</p>
      )}

      {/* Add/Edit Dialog */}
      <Dialog
        open={isAddSubtopicOpen || !!editingSubtopic}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddSubtopicOpen(false);
            setEditingSubtopic(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSubtopic ? "Edit Subtopic" : "Add New Subtopic"}
            </DialogTitle>
            <DialogDescription>
              Add subtopics to break down "{topicTitle}" into smaller learning units
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={subtopicForm.title}
                  onChange={(e) =>
                    setSubtopicForm({ ...subtopicForm, title: e.target.value })
                  }
                  placeholder="e.g., Introduction to..."
                />
              </div>

              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Input
                  type="number"
                  value={subtopicForm.estimated_duration_minutes}
                  onChange={(e) =>
                    setSubtopicForm({
                      ...subtopicForm,
                      estimated_duration_minutes: parseInt(e.target.value) || 30,
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={subtopicForm.description}
                onChange={(e) =>
                  setSubtopicForm({ ...subtopicForm, description: e.target.value })
                }
                placeholder="Brief description of this subtopic"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Video Platform</Label>
                <Select
                  value={subtopicForm.video_platform}
                  onValueChange={(value) =>
                    setSubtopicForm({ ...subtopicForm, video_platform: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="vimeo">Vimeo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Video ID</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        <p>Enter the video ID from the URL</p>
                        <p className="text-muted-foreground mt-1">YouTube: dQw4w9WgXcQ | Vimeo: 123456789</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={subtopicForm.video_id}
                    onChange={(e) =>
                      setSubtopicForm({ ...subtopicForm, video_id: e.target.value })
                    }
                    placeholder="e.g., dQw4w9WgXcQ"
                  />
                  {subtopicForm.video_id && subtopicForm.video_platform && (
                    <VideoPreview 
                      platform={subtopicForm.video_platform} 
                      videoId={subtopicForm.video_id} 
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes (Markdown)</Label>
              <Textarea
                value={subtopicForm.notes_markdown}
                onChange={(e) =>
                  setSubtopicForm({ ...subtopicForm, notes_markdown: e.target.value })
                }
                placeholder="# Notes for students..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Content (Markdown)</Label>
              <Textarea
                value={subtopicForm.content_markdown}
                onChange={(e) =>
                  setSubtopicForm({ ...subtopicForm, content_markdown: e.target.value })
                }
                placeholder="# Main content..."
                rows={4}
              />
            </div>

            {/* PDF Upload for Subtopics */}
            <div className="space-y-2">
              <Label>Subtopic PDF Document</Label>
              <B2FileUploadWidget
                currentFileUrl={subtopicForm.pdf_url}
                onFileUploaded={(url) =>
                  setSubtopicForm({ ...subtopicForm, pdf_url: url })
                }
                onParseAfterUpload={handleSubtopicPdfUploadAndParse}
                isParsingPdf={isParsingPdf}
                label="Upload Subtopic PDF"
                acceptedTypes="application/pdf"
                maxSizeMB={50}
                pathParams={{
                  parentCategoryName,
                  subCategoryName,
                  subjectName,
                  chapterName,
                  entityType: 'subtopic',
                  entityName: subtopicForm.title || 'New_Subtopic',
                }}
                metadata={{
                  entityType: 'subtopic',
                  categoryId,
                  subjectId,
                  topicId,
                  subtopicId: editingSubtopic?.id || '',
                }}
              />
              {subtopicForm.pdf_url && (
                <PDFPreview 
                  pdfUrl={subtopicForm.pdf_url} 
                  fileName={`${subtopicForm.title || 'Subtopic'}.pdf`}
                />
              )}
            </div>

            {/* JSON Upload/Parse for Subtopics */}
            <JsonUploadParseWidget
              currentJson={subtopicForm.content_json}
              onJsonChange={(json) => setSubtopicForm({ ...subtopicForm, content_json: json })}
              pdfUrl={subtopicForm.pdf_url}
              entityType="subtopic"
              entityName={subtopicForm.title || "New Subtopic"}
              subjectId={subjectId}
              chapterId={chapterId}
              topicId={topicId}
              subtopicId={editingSubtopic?.id}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddSubtopicOpen(false);
                setEditingSubtopic(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingSubtopic ? handleUpdateSubtopic : handleCreateSubtopic}
              disabled={createSubtopic.isPending || updateSubtopic.isPending}
            >
              {editingSubtopic ? "Update" : "Create"} Subtopic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSubtopicId} onOpenChange={() => setDeleteSubtopicId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subtopic?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this subtopic.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSubtopic}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
