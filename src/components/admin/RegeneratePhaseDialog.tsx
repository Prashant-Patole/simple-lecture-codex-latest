import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
  RefreshCw,
  User,
  Video,
  Code,
  Film,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Volume2,
  MessageSquare,
} from 'lucide-react';
import { 
  useRetryPhase, 
  useRegenerateFailedAvatars,
  RegenerationPhase, 
  SanityCheckData, 
  SectionHealth 
} from '@/hooks/useVideoGenerationJobs';
import { cn } from '@/lib/utils';

interface RegeneratePhaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  externalJobId: string;
  sanityData: SanityCheckData;
  onRegenStarted?: (phase: string, message: string) => void;
  serverIp?: string;
}

interface PhaseInfo {
  phase: RegenerationPhase;
  label: string;
  description: string;
  icon: React.ElementType;
  sections: number[];
  color: string;
}

// Analyze sanity data to determine which phases need regeneration
function getMissingPhases(sanityData: SanityCheckData): PhaseInfo[] {
  const phases: PhaseInfo[] = [];
  
  // Check for missing avatars
  const missingAvatars = sanityData.sections.filter(
    s => s.avatar_video.status === null || s.avatar_video.status >= 400 || s.avatar_video.status === 0
  );
  if (missingAvatars.length > 0) {
    phases.push({
      phase: 'avatar_generation',
      label: 'Avatar Generation',
      description: 'Regenerate avatar videos for sections with missing or broken avatars',
      icon: User,
      sections: missingAvatars.map(s => s.section_id),
      color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400'
    });
  }
  
  // Check for missing Manim videos
  const missingManim = sanityData.sections.filter(
    s => s.renderer === 'MANIM' && (s.topic_video.status === null || s.topic_video.status >= 400 || s.topic_video.status === 0)
  );
  if (missingManim.length > 0) {
    phases.push({
      phase: 'manim_codegen',
      label: 'Manim Code Generation',
      description: 'Regenerate Python code AND re-render the Manim animation',
      icon: Code,
      sections: missingManim.map(s => s.section_id),
      color: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-400'
    });
  }
  
  // Check for Manim render issues (code exists but video missing)
  const manimRenderIssues = sanityData.sections.filter(
    s => s.renderer === 'MANIM' && 
         s.topic_video.status !== null && 
         s.topic_video.status >= 400 &&
         !missingManim.some(m => m.section_id === s.section_id)
  );
  if (manimRenderIssues.length > 0) {
    phases.push({
      phase: 'manim_render',
      label: 'Manim Re-render',
      description: 'Re-render existing Manim code (use when code is correct but rendering failed)',
      icon: Video,
      sections: manimRenderIssues.map(s => s.section_id),
      color: 'bg-violet-100 text-violet-700 border-violet-300 dark:bg-violet-950/50 dark:text-violet-400'
    });
  }
  
  // Check for WAN/Kie video issues
  const missingWan = sanityData.sections.filter(
    s => s.prompts_vs_disk.status === 'MISMATCH'
  );
  if (missingWan.length > 0) {
    phases.push({
      phase: 'wan_render',
      label: 'Visual Video Render',
      description: 'Regenerate background/visual videos using WAN/Kie',
      icon: Film,
      sections: missingWan.map(s => s.section_id),
      color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400'
    });
  }
  
  // Check for missing TTS audio
  const missingTTS = sanityData.sections.filter(
    s => (s as any).audio?.status === null || (s as any).audio?.status >= 400 || (s as any).audio?.status === 0
  );
  if (missingTTS.length > 0) {
    phases.push({
      phase: 'tts_generation',
      label: 'TTS Audio Generation',
      description: 'Regenerate text-to-speech audio narration',
      icon: Volume2,
      sections: missingTTS.map(s => s.section_id),
      color: 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950/50 dark:text-green-400'
    });
  }
  
  return phases;
}

export function RegeneratePhaseDialog({
  open,
  onOpenChange,
  externalJobId,
  sanityData,
  onRegenStarted,
  serverIp,
}: RegeneratePhaseDialogProps) {
  const [selectedPhase, setSelectedPhase] = useState<RegenerationPhase | null>(null);
  const [targetSpecificSections, setTargetSpecificSections] = useState(false);
  const [selectedSections, setSelectedSections] = useState<number[]>([]);
  const [userFeedback, setUserFeedback] = useState('');
  const sectionTargetingRef = useRef<HTMLDivElement>(null);
  
  const retryPhaseMutation = useRetryPhase();
  const regenerateFailedAvatarsMutation = useRegenerateFailedAvatars();
  
  const missingPhases = useMemo(() => getMissingPhases(sanityData), [sanityData]);
  
  const currentPhaseInfo = missingPhases.find(p => p.phase === selectedPhase);
  const hasAvatarIssues = missingPhases.some(p => p.phase === 'avatar_generation');
  
  const handlePhaseSelect = (phase: RegenerationPhase) => {
    setSelectedPhase(phase);
    setTargetSpecificSections(false);
    setSelectedSections([]);
    // Keep feedback when switching phases (user might want to reuse it)
  };
  
  // Auto-scroll to section targeting area when phase is selected
  useEffect(() => {
    if (selectedPhase && sectionTargetingRef.current) {
      setTimeout(() => {
        sectionTargetingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    }
  }, [selectedPhase]);
  
  const handleSectionToggle = (sectionId: number) => {
    setSelectedSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };
  
  const handleQuickFixAvatars = () => {
    regenerateFailedAvatarsMutation.mutate({ externalJobId, serverIp }, {
      onSuccess: () => {
        onRegenStarted?.('avatar_generation', 'Quick fix: Regenerating all failed avatars');
        onOpenChange(false);
      }
    });
  };
  
  const handleRegenerate = () => {
    if (!selectedPhase || !currentPhaseInfo) return;
    
    const phaseLabel = currentPhaseInfo.label || selectedPhase;
    
    const sectionsToSend = targetSpecificSections && selectedSections.length > 0 
      ? selectedSections 
      : currentPhaseInfo.sections;
    
    const sectionsCount = sectionsToSend.length;
    const feedbackToSend = userFeedback.trim() || undefined;
    
    console.log(`[Regen] Starting ${selectedPhase} for sections:`, sectionsToSend, feedbackToSend ? `with feedback: ${feedbackToSend}` : '');
    
    const onMutationSuccess = (data: any) => {
      const feedbackNote = feedbackToSend ? ' with feedback' : '';
      const statusMessage = data?.timeout 
        ? `Started ${phaseLabel} for ${sectionsCount} section${sectionsCount !== 1 ? 's' : ''}${feedbackNote} (processing in background)`
        : `Started ${phaseLabel} for ${sectionsCount} section${sectionsCount !== 1 ? 's' : ''}${feedbackNote}`;
      
      onRegenStarted?.(selectedPhase, statusMessage);
      onOpenChange(false);
      setSelectedPhase(null);
      setTargetSpecificSections(false);
      setSelectedSections([]);
      setUserFeedback('');
    };

    retryPhaseMutation.mutate({
      externalJobId,
      phase: selectedPhase,
      sectionIds: sectionsToSend,
      userFeedback: feedbackToSend,
      serverIp
    }, { onSuccess: onMutationSuccess });
  };
  
  const isAnyMutationPending = retryPhaseMutation.isPending || 
    regenerateFailedAvatarsMutation.isPending;
  
  const totalMissing = missingPhases.reduce((acc, p) => acc + p.sections.length, 0);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] h-[85vh] min-h-0 overflow-hidden !flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Regenerate Missing Components
          </DialogTitle>
          <DialogDescription>
            Select a phase to regenerate. This will trigger the external API to retry 
            specific parts of the video generation process.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="space-y-3 py-2 pr-4">
          {/* Quick Fix Button for Avatars */}
          {hasAvatarIssues && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Quick Fix Available</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleQuickFixAvatars}
                disabled={isAnyMutationPending}
              >
                {regenerateFailedAvatarsMutation.isPending ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Fixing...
                  </>
                ) : (
                  <>
                    <User className="h-3 w-3 mr-1" />
                    Fix All Avatars
                  </>
                )}
              </Button>
            </div>
          )}
          
          {/* Summary */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span>
              {totalMissing} missing component{totalMissing !== 1 ? 's' : ''} detected across {missingPhases.length} phase{missingPhases.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {/* Phase Selection */}
          {missingPhases.length === 0 ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertDescription>
                No missing components detected! All assets appear to be healthy.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Phase to Regenerate</Label>
              <div className="grid gap-2">
                {missingPhases.map((phaseInfo) => {
                  const Icon = phaseInfo.icon;
                  const isSelected = selectedPhase === phaseInfo.phase;
                  
                  return (
                    <button
                      key={phaseInfo.phase}
                      onClick={() => handlePhaseSelect(phaseInfo.phase)}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border text-left transition-all",
                        isSelected 
                          ? "border-primary bg-primary/5 ring-1 ring-primary" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                    >
                      <div className={cn("p-2 rounded-lg", phaseInfo.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{phaseInfo.label}</span>
                          <Badge variant="secondary" className="text-xs">
                            {phaseInfo.sections.length} section{phaseInfo.sections.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {phaseInfo.description}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Section targeting option */}
          {selectedPhase && currentPhaseInfo && currentPhaseInfo.sections.length > 0 && (
            <div ref={sectionTargetingRef} className="space-y-3 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="target-specific"
                  checked={targetSpecificSections}
                  onCheckedChange={(checked) => {
                    setTargetSpecificSections(checked === true);
                    if (!checked) setSelectedSections([]);
                  }}
                />
                <Label htmlFor="target-specific" className="text-sm cursor-pointer">
                  Target specific sections only
                </Label>
              </div>
              
              {targetSpecificSections && (
                <ScrollArea className="h-[200px] border rounded-lg p-2">
                  <div className="space-y-1">
                    {currentPhaseInfo.sections.map((sectionId) => {
                      const section = sanityData.sections.find(s => s.section_id === sectionId);
                      return (
                        <div key={sectionId} className="flex items-center space-x-2">
                          <Checkbox
                            id={`section-${sectionId}`}
                            checked={selectedSections.includes(sectionId)}
                            onCheckedChange={() => handleSectionToggle(sectionId)}
                          />
                          <Label 
                            htmlFor={`section-${sectionId}`} 
                            className="text-sm cursor-pointer flex items-center gap-2"
                          >
                            <Badge variant="outline" className="text-xs font-mono">
                              {sectionId}
                            </Badge>
                            <span className="text-muted-foreground truncate">
                              {section?.title || `Section ${sectionId}`}
                            </span>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
          
          {/* Feedback Input (shown when any phase is selected) */}
          {selectedPhase && (
            <div className="space-y-2 pt-2 border-t">
              <Label htmlFor="user-feedback" className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Feedback for AI (optional)
              </Label>
              <Textarea
                id="user-feedback"
                placeholder="e.g., Make animations slower, use brighter colors, improve audio clarity..."
                value={userFeedback}
                onChange={(e) => setUserFeedback(e.target.value)}
                className="h-20 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Provide guidance to improve the regeneration. Works for any phase.
              </p>
            </div>
          )}
          
          {/* Error display */}
          {retryPhaseMutation.isError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {retryPhaseMutation.error?.message || 'Failed to start regeneration'}
              </AlertDescription>
            </Alert>
          )}
            </div>
          </div>
        </div>
        
        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleRegenerate}
            disabled={!selectedPhase || isAnyMutationPending || (targetSpecificSections && selectedSections.length === 0)}
          >
            {isAnyMutationPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Regenerate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
