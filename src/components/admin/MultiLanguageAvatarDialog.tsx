import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Globe,
  Loader2,
  Sparkles,
  Languages,
  Mic,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  useLanguageAvatarJobs,
  useGenerateLanguageAvatarV2,
  useAutoSyncLanguageAvatarStatus,
  SUPPORTED_LANGUAGES,
  SUPPORTED_VOICES,
} from '@/hooks/useLanguageAvatarJobs';
import { LanguageAvatarJobsTable } from './LanguageAvatarJobsTable';
import { SectionAvatarProgressGrid } from './SectionAvatarProgressGrid';

interface MultiLanguageAvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  externalJobId: string;
  videoJobId: string;
  documentName: string;
  serverIp?: string;
}

interface Section {
  section_id: number;
  title: string;
  narration_text: string;
  char_count: number;
}

export function MultiLanguageAvatarDialog({
  open,
  onOpenChange,
  externalJobId,
  videoJobId,
  documentName,
  serverIp,
}: MultiLanguageAvatarDialogProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [bulkLanguages, setBulkLanguages] = useState<string[]>([]);
  const [bulkVoice, setBulkVoice] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const { data: jobs, isLoading: isLoadingJobs } = useLanguageAvatarJobs(videoJobId);
  const generateV2Mutation = useGenerateLanguageAvatarV2();
  
  // Auto-sync job statuses
  useAutoSyncLanguageAvatarStatus(jobs, videoJobId);

  // Load presentation.json to extract sections
  useEffect(() => {
    if (!open || !externalJobId) return;
    
    const loadSections = async () => {
      setIsLoadingSections(true);
      try {
        const { data, error } = await supabase.functions.invoke('video-generation-proxy', {
          body: { action: 'review', job_id: externalJobId, server_ip: serverIp },
        });
        
        if (error) throw error;
        
        const presentationSections = data.sections || [];
        const extractedSections: Section[] = presentationSections.map((section: any, index: number) => {
          // Extract narration from multiple possible locations
          let narrationText = section.narration?.full_text || '';
          
          // Fallback 1: narration.segments
          if (!narrationText && section.narration?.segments) {
            narrationText = section.narration.segments.map((s: any) => s.text).join(' ');
          }
          
          // Fallback 2: explanation_plan.visual_beats (for Long Answer / MCQ sections)
          if (!narrationText && section.explanation_plan?.visual_beats) {
            const texts: string[] = [];
            section.explanation_plan.visual_beats.forEach((beat: any) => {
              if (beat.segments) {
                beat.segments.forEach((seg: any) => {
                  if (seg.text) texts.push(seg.text);
                });
              }
            });
            narrationText = texts.join(' ');
          }
          
          return {
            section_id: index,
            title: section.title || `Section ${index}`,
            narration_text: narrationText,
            char_count: narrationText.length,
          };
        }).filter((s: Section) => s.narration_text.length > 0);
        
        setSections(extractedSections);
        
      } catch (error) {
        console.error('Failed to load sections:', error);
        toast.error('Failed to load presentation sections');
      } finally {
        setIsLoadingSections(false);
      }
    };
    
    loadSections();
  }, [open, externalJobId]);


  // Calculate completion stats for bulk generation (checks all selected languages)
  const getCompletionStats = () => {
    if (!jobs || sections.length === 0) return { completed: 0, total: bulkLanguages.length, pending: bulkLanguages.length };
    
    const completedCount = bulkLanguages.filter(lang => 
      jobs.find(j => j.language === lang && (j.status === 'completed' || j.status === 'processing'))
    ).length;
    
    return {
      completed: completedCount,
      total: bulkLanguages.length,
      pending: bulkLanguages.length - completedCount,
    };
  };

  // Toggle language selection for bulk generation
  const toggleBulkLanguage = (langCode: string) => {
    setBulkLanguages(prev => {
      if (prev.includes(langCode)) {
        return prev.filter(l => l !== langCode);
      }
      return [...prev, langCode];
    });
  };

  // V2.5 API: Bulk generate all sections with a single API call for multiple languages
  const handleBulkGenerate = async () => {
    setIsGenerating(true);
    
    try {
      // V2.5 API generates ALL sections automatically when no target_sections is provided
      // Supports multiple languages in a single call
      await generateV2Mutation.mutateAsync({
        videoJobId,
        externalJobId,
        languages: bulkLanguages, // e.g., ['en', 'hi', 'te', 'ta']
        speaker: bulkVoice,
        serverIp,
      });
      
      toast.success(`Started avatar generation for ${bulkLanguages.length} language(s)`);
    } finally {
      setIsGenerating(false);
    }
  };

  // V2.5 API: Retry a failed job
  const handleRetry = async (job: any) => {
    const sectionStringId = `section_${job.section_id}`;
    
    await generateV2Mutation.mutateAsync({
      videoJobId,
      externalJobId,
      languages: [job.language],
      speaker: job.speaker,
      targetSections: [sectionStringId],
      forceRegenerate: true,
      serverIp,
    });
  };

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[1000px] overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-600" />
            Multi-Language Avatars
          </SheetTitle>
          <SheetDescription>
            Generate avatar videos in Indian languages for "{documentName}"
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 mt-4">
          <div className="space-y-6 pr-4">
            {/* Bulk Generate */}
            {sections.length > 0 && (
              <>
                <Separator />
                <Card className="bg-gradient-to-r from-indigo-500/5 to-purple-500/5 border-indigo-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      Bulk Generate All Sections
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Progress UI during bulk generation */}
                    {generateV2Mutation.isPending && (
                      <div className="space-y-3 p-4 bg-muted rounded-lg mb-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm font-medium">Generating avatars...</span>
                        </div>
                        <p className="text-xs text-amber-600">
                          V2.5 API is processing all sections. This may take a few minutes.
                        </p>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3 flex-wrap">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Languages className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Languages:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {SUPPORTED_LANGUAGES.filter((l) => l.code !== 'english').map((lang) => (
                            <Badge
                              key={lang.code}
                              variant={bulkLanguages.includes(lang.code) ? "default" : "outline"}
                              className="cursor-pointer hover:bg-primary/80 transition-colors"
                              onClick={() => !generateV2Mutation.isPending && toggleBulkLanguage(lang.code)}
                            >
                              {lang.flag} {lang.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Mic className="h-4 w-4 text-muted-foreground" />
                          <Select value={bulkVoice} onValueChange={setBulkVoice} disabled={generateV2Mutation.isPending}>
                            <SelectTrigger className="h-8 w-[200px]">
                              <SelectValue placeholder="Select speaker" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Male Voices</SelectLabel>
                                {SUPPORTED_VOICES.filter(v => v.gender === 'male').map((voice) => (
                                  <SelectItem key={voice.id} value={voice.id}>
                                    {voice.name} - {voice.description}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                              <SelectGroup>
                                <SelectLabel>Female Voices</SelectLabel>
                                {SUPPORTED_VOICES.filter(v => v.gender === 'female').map((voice) => (
                                  <SelectItem key={voice.id} value={voice.id}>
                                    {voice.name} - {voice.description}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          English uses voice cloning (speaker ignored)
                        </p>
                      </div>
                      <Button
                        onClick={() => setShowConfirmDialog(true)}
                        disabled={generateV2Mutation.isPending || bulkLanguages.length === 0 || bulkVoice === ''}
                        className="gap-2"
                        variant="default"
                      >
                        {generateV2Mutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {(() => {
                          const stats = getCompletionStats();
                          if (stats.pending === bulkLanguages.length) {
                            return `Generate All (${bulkLanguages.length} languages)`;
                          } else if (stats.pending === 0) {
                            return `All ${stats.completed} Done ✓`;
                          } else {
                            return `Resume (${stats.pending} remaining)`;
                          }
                        })()}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {/* Section Progress Grid - shows when generating or has jobs */}
            {externalJobId && (isGenerating || generateV2Mutation.isPending || jobs?.some(j => j.status === 'processing' || j.status === 'completed')) && (
              <>
                <Separator />
                <SectionAvatarProgressGrid
                  externalJobId={externalJobId}
                  serverIp={serverIp}
                  selectedLanguages={bulkLanguages}
                  isGenerating={isGenerating || generateV2Mutation.isPending}
                />
              </>
            )}

            {/* Jobs Table */}
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Generation Jobs</h3>
                {isLoadingJobs && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
              
              <Card>
                <CardContent className="p-0">
                  <LanguageAvatarJobsTable
                    jobs={jobs || []}
                    onRetry={handleRetry}
                    isRetrying={generateV2Mutation.isPending}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>

    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Avatar Generation</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>You are about to generate avatars with the following settings:</p>
              <div className="space-y-2">
                <div>
                  <span className="text-sm font-medium">Languages:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {bulkLanguages.map(lang => {
                      const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === lang);
                      return (
                        <Badge key={lang} variant="default">
                          {langInfo?.flag} {langInfo?.name || lang}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium">Speaker: </span>
                  <span>{SUPPORTED_VOICES.find(v => v.id === bulkVoice)?.name || bulkVoice}</span>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => { setShowConfirmDialog(false); handleBulkGenerate(); }}>
            Confirm & Generate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
