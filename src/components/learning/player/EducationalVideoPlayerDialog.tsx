import { useState, useCallback, useEffect } from 'react';
import { Loader2, AlertCircle, ArrowLeft, type LucideIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { EducationalVideoPlayer } from './EducationalVideoPlayer';
import { usePresentationReview } from '@/hooks/useVideoGenerationJobs';
import { getAdminMediaUrl } from './utils/mediaResolver';
import { cn } from '@/lib/utils';
import type { PresentationReview } from '@/hooks/useVideoGenerationJobs';

export interface QuickActionItem {
  value: string;
  label: string;
  icon: LucideIcon;
  desc: string;
}

interface EducationalVideoPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  externalJobId?: string;
  presentationData?: PresentationReview | null;
  documentName: string;
  initialLanguage?: string | null;
  serverIp?: string;
  purchasedLanguages?: string[];
  courseAvailableLanguages?: string[] | null;
  quickActions?: QuickActionItem[];
  onQuickAction?: (tabValue: string) => void;
  topicId?: string;
  chapterId?: string;
  subjectId?: string;
  courseId?: string;
}

export const EducationalVideoPlayerDialog = ({
  open,
  onOpenChange,
  externalJobId,
  presentationData: directPresentationData,
  documentName,
  initialLanguage = null,
  serverIp,
  purchasedLanguages,
  courseAvailableLanguages,
  quickActions,
  onQuickAction,
  topicId,
  chapterId,
  subjectId,
  courseId,
}: EducationalVideoPlayerDialogProps) => {
  const [layoutMode] = useState<'mobile' | 'desktop'>(() =>
    window.innerWidth < 768 ? 'mobile' : 'desktop'
  );
  const isMobile = layoutMode === 'mobile';

  console.log('[Dialog] Render, layoutMode:', layoutMode, 'open:', open);

  // Track mount/unmount
  useEffect(() => {
    console.log('[Dialog] MOUNTED, layoutMode:', layoutMode);
    return () => console.log('[Dialog] UNMOUNTED');
  }, []);

  // Wrap onOpenChange with full stack trace
  const trackedOnOpenChange = useCallback((newOpen: boolean) => {
    console.log('[Dialog] onOpenChange called with:', newOpen);
    console.trace('[Dialog] onOpenChange trace');
    onOpenChange(newOpen);
  }, [onOpenChange]);

  const shouldFetch = !directPresentationData && !!externalJobId;
  
  const { 
    data: fetchedPresentationData, 
    isLoading, 
    isError, 
    error 
  } = usePresentationReview(shouldFetch ? externalJobId : null, serverIp);

  const presentationData = directPresentationData || fetchedPresentationData;
  const showLoading = shouldFetch && isLoading;
  const showError = shouldFetch && isError;
  const effectiveJobId = externalJobId || '';

  if (presentationData && !externalJobId) {
    console.warn('[VideoPlayerDialog] presentationData provided without externalJobId - media will not load');
  }

  // Shared player/loading/error content
  const renderContent = () => {
    if (showLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading presentation...</p>
          </div>
        </div>
      );
    }
    if (showError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-destructive">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Failed to load presentation</p>
            <p className="text-xs text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        </div>
      );
    }
    if (!presentationData?.sections?.length) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No sections found in this presentation</p>
          </div>
        </div>
      );
    }
    return (
      <EducationalVideoPlayer
        presentationData={presentationData}
        jobId={effectiveJobId}
        getMediaUrl={getAdminMediaUrl}
        onClose={() => trackedOnOpenChange(false)}
        className="h-full"
        initialLanguage={initialLanguage}
        serverIp={serverIp}
        purchasedLanguages={purchasedLanguages}
        courseAvailableLanguages={courseAvailableLanguages}
        topicId={topicId}
        chapterId={chapterId}
        subjectId={subjectId}
        courseId={courseId}
        topicTitle={documentName}
      />
    );
  };

  // Mobile: inline portrait layout (no Dialog overlay)
  if (isMobile) {
    if (!open) return null;

    return (
      <div
        className="fixed top-0 left-0 right-0 bottom-0 z-50 bg-black flex flex-col"
        style={{ paddingTop: 0, marginTop: 0 }}
      >
        {/* Player container at top */}
        <div className="block w-full flex-shrink-0" style={{ height: 'calc(45vh - 50px)' }}>
          {renderContent()}
        </div>

        {/* Scrollable metadata below */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20 bg-background">
          {/* Back button + title */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => { console.log('[Dialog] Mobile back button clicked'); trackedOnOpenChange(false); }}
              className="p-1.5 rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <h2 className="text-lg font-semibold text-foreground line-clamp-2 flex-1">
              {documentName}
            </h2>
          </div>

          {/* Quick Actions Grid */}
          {quickActions && quickActions.length > 0 && onQuickAction ? (
            <div className="mt-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => onQuickAction(value)}
                    className="flex flex-col items-start gap-1.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent/50 p-3.5 text-left transition-all"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground leading-tight">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                AI-generated educational presentation
              </p>
              {presentationData?.sections?.length ? (
                <div className="space-y-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Sections</p>
                    <p className="text-sm text-foreground">{presentationData.sections.length} sections in this presentation</p>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    );
  }

  // Desktop: standard Dialog overlay
  return (
    <Dialog open={open} onOpenChange={trackedOnOpenChange}>
      <DialogContent className="max-w-[95vw] h-[95vh] p-0 overflow-hidden bg-background">
        <div className="h-full overflow-hidden relative">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};
