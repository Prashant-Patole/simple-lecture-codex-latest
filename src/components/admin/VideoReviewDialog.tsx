import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Play,
  List,
  BookOpen,
  Brain,
  RefreshCw,
  FileText,
  Loader2,
  AlertCircle,
  Image as ImageIcon,
  MessageSquare,
  Send,
} from 'lucide-react';
import { 
  usePresentationReview, 
  useSubmitReview, 
  useRecreateFromReview, 
  PresentationSection, 
  VisualBeat 
} from '@/hooks/useVideoGenerationJobs';

interface VideoReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  externalJobId: string;
  documentName: string;
  serverIp?: string;
}

export function VideoReviewDialog({
  open,
  onOpenChange,
  externalJobId,
  documentName,
  serverIp,
}: VideoReviewDialogProps) {
  const { data: review, isLoading, isError, error } = usePresentationReview(externalJobId, serverIp);

  // Direct HTTP URL to external server (admin panel only)
  const getMediaUrl = (jobId: string, filePath: string) => {
    const serverAddress = serverIp || '69.197.145.4';
    return `http://${serverAddress}:5005/player/jobs/${jobId}/${filePath}`;
  };
  const [sectionNotes, setSectionNotes] = useState<Record<number, string>>({});
  
  const submitReviewMutation = useSubmitReview();
  const recreateFromReviewMutation = useRecreateFromReview();
  
  const isSubmitting = submitReviewMutation.isPending || recreateFromReviewMutation.isPending;
  
  const notesCount = Object.values(sectionNotes).filter(n => n.trim()).length;
  
  const collectSections = () => {
    return Object.entries(sectionNotes)
      .filter(([_, notes]) => notes.trim())
      .map(([sectionId, notes]) => ({
        section_id: parseInt(sectionId),
        notes: notes.trim()
      }));
  };
  
  const handleSubmitReview = async () => {
    const sections = collectSections();
    if (sections.length === 0) return;
    
    try {
      await submitReviewMutation.mutateAsync({ externalJobId, sections });
      setSectionNotes({});
    } catch (error) {
      console.error('Submit review error:', error);
    }
  };
  
  const handleSubmitAndRegenerate = async () => {
    const sections = collectSections();
    if (sections.length === 0) return;
    
    try {
      // First submit the review
      await submitReviewMutation.mutateAsync({ externalJobId, sections });
      
      // Then trigger regeneration for those sections, passing edits inline as backup
      const sectionIds = sections.map(s => s.section_id);
      await recreateFromReviewMutation.mutateAsync({ 
        externalJobId, 
        sectionIds,
        edits: sections  // Pass edits inline for APIs that need them
      });
      
      setSectionNotes({});
      onOpenChange(false);
    } catch (error) {
      console.error('Submit and regenerate error:', error);
    }
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case 'intro':
        return <Play className="h-4 w-4" />;
      case 'summary':
        return <List className="h-4 w-4" />;
      case 'content':
        return <BookOpen className="h-4 w-4" />;
      case 'memory':
        return <Brain className="h-4 w-4" />;
      case 'recap':
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getSectionTypeColor = (type: string) => {
    switch (type) {
      case 'intro':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'summary':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'content':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'memory':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'recap':
        return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const renderSectionContent = (section: PresentationSection) => {
    // DEBUG: Log section data to understand structure
    console.log('Section:', section.title, section);
    console.log('Visual beats:', section.visual_beats);
    console.log('Explanation plan:', section.explanation_plan);
    
    // Extract content from new structure
    const narrationText = section.narration?.full_text || '';
    
    // Extract bullet items from visual_beats
    const bulletItems = section.visual_beats
      ?.filter(b => b.visual_type === 'bullet_list')
      .map(b => b.display_text) || [];
    
    // Extract text content from visual_beats
    const textItems = section.visual_beats
      ?.filter(b => b.visual_type === 'text')
      .map(b => b.display_text) || [];
    
    // Extract images - check both image_id presence AND visual_type === 'image'
    const imagesFromBeats = section.visual_beats?.filter(b => 
      b.image_id || b.visual_type === 'image'
    ) || [];
    const imagesFromPlan = section.explanation_plan?.visual_beats?.filter(b => 
      b.image_id || b.visual_type === 'image'
    ) || [];
    const images = [...imagesFromBeats, ...imagesFromPlan];
    
    console.log('Extracted images:', images);
    
    // Extract LaTeX content
    const latexItems = section.visual_beats
      ?.filter(b => b.latex_content)
      .map(b => ({ beat_id: b.beat_id, latex: b.latex_content! })) || [];
    
    // Helper to construct proper image path
    const getImagePath = (imageId: string | null | undefined): string => {
      if (!imageId) return '';
      // If already has path prefix, use as-is
      if (imageId.includes('/')) return imageId;
      // Otherwise add images/ prefix
      return `images/${imageId}`;
    };
    
    return (
      <div className="space-y-4">
        {/* Narration Text */}
        {narrationText && (
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4" />
              Narration Text
            </Label>
            <div className="bg-muted p-3 rounded-lg text-sm leading-relaxed">
              {narrationText}
            </div>
          </div>
        )}

        {/* Text Content */}
        {textItems.length > 0 && (
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4" />
              Text Content ({textItems.length})
            </Label>
            <div className="space-y-2">
              {textItems.map((text, i) => (
                <div key={i} className="bg-muted p-3 rounded-lg text-sm">
                  {text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bullet Items */}
        {bulletItems.length > 0 && (
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <List className="h-4 w-4" />
              Bullet Points ({bulletItems.length})
            </Label>
            <ul className="list-disc list-inside space-y-1 bg-muted p-3 rounded-lg">
              {bulletItems.map((item, i) => (
                <li key={i} className="text-sm">{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* LaTeX/Math Content */}
        {latexItems.length > 0 && (
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4" />
              Math Formulas ({latexItems.length})
            </Label>
            <div className="space-y-2">
              {latexItems.map((item, i) => (
                <div key={i} className="bg-muted p-3 rounded-lg text-sm font-mono overflow-x-auto">
                  {item.latex}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Images */}
        {images.length > 0 && (
          <div>
            <Label className="flex items-center gap-2 mb-2">
              <ImageIcon className="h-4 w-4" />
              Images ({images.length})
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {images.map((beat, i) => {
                const imagePath = getImagePath(beat.image_id);
                const imageUrl = getMediaUrl(externalJobId, imagePath);
                
                return (
                  <Card key={i} className="p-2 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={beat.display_text || 'Visual content'}
                      className="rounded w-full h-32 object-cover mb-2"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <a 
                      href={imageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <ImageIcon className="h-3 w-3" />
                      Open Image
                    </a>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{beat.display_text}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Editable Notes Field */}
        <div className="border-t pt-4 mt-4">
          <Label className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4" />
            Add Missing Content / Notes
          </Label>
          <Textarea
            value={sectionNotes[section.section_id] || ''}
            onChange={(e) => setSectionNotes(prev => ({
              ...prev,
              [section.section_id]: e.target.value
            }))}
            placeholder="Add any missing content, corrections, or notes for this section..."
            className="min-h-[80px]"
          />
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Review Presentation
          </SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span className="truncate">{documentName}</span>
            {review?.sections && (
              <Badge variant="outline">{review.sections.length} sections</Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-hidden mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading presentation data...</p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-destructive">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Failed to load presentation</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
            </div>
          ) : !review?.sections?.length ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sections found in this presentation</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="pr-4">
                {/* Title */}
                {review.presentation_title && (
                  <div className="mb-4 p-3 bg-muted rounded-lg">
                    <h3 className="font-semibold">{review.presentation_title}</h3>
                  </div>
                )}

                <Accordion type="multiple" className="space-y-2">
                  {review.sections.map((section) => (
                    <AccordionItem
                      key={section.section_id}
                      value={`section-${section.section_id}`}
                      className="border rounded-lg px-3"
                    >
                      <AccordionTrigger className="hover:no-underline py-3">
                        <div className="flex items-center gap-3 text-left">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                            {section.section_id}
                          </span>
                          {getSectionIcon(section.section_type)}
                          <span className="font-medium truncate max-w-[250px]">
                            {section.title}
                          </span>
                          <Badge className={`ml-auto ${getSectionTypeColor(section.section_type)}`}>
                            {section.section_type}
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-4">
                        {renderSectionContent(section)}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-4 border-t flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            {notesCount} section(s) with notes
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={handleSubmitReview}
              disabled={notesCount === 0 || isSubmitting}
              className="gap-2"
            >
              {submitReviewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Submit Review
            </Button>
            <Button 
              variant="default" 
              onClick={handleSubmitAndRegenerate}
              disabled={notesCount === 0 || isSubmitting}
              className="gap-2"
            >
              {recreateFromReviewMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Submit & Regenerate
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}