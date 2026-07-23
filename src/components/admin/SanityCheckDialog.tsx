import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  Video,
  Image as ImageIcon,
  User,
  Copy,
  Wrench,
  Link,
  Zap,
  FileText,
  RotateCcw,
  Activity,
} from 'lucide-react';
import { useSanityCheck, SanityCheckData, SectionHealth, useRepairUrls, useStitchAssets, useRepairMissingAssets, useRegenJobStatus, useAvatarGenerationStatus } from '@/hooks/useVideoGenerationJobs';
import { useHasActiveTasks, useCleanupStaleTasks } from '@/hooks/useRegenerationTasks';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { RegeneratePhaseDialog } from './RegeneratePhaseDialog';
import { RegenerationStatusPanel } from './RegenerationStatusPanel';

interface SanityCheckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  externalJobId: string;
  documentName: string; serverIp?: string;
}

// Status badge with inline path - clickable to open in new tab
function FileStatusCell({ 
  path, 
  status, 
  externalJobId, serverIp
}: { 
  path: string; 
  status: number | null; 
  externalJobId: string; serverIp?: string;
}) {
  if (status === null) {
    return <span className="text-sm text-muted-foreground">None</span>;
  }
  
  const isHealthy = status >= 200 && status < 300;
  const fileName = path.split('/').pop() || path;
  
  // Construct full URL for the file
  const fullUrl = path.startsWith('http') 
    ? path 
    : `http://${serverIp || '69.197.145.4'}:5005/player/jobs/${externalJobId}/${path}`;
  
  return (
    <div className="flex items-center gap-2">
      <a 
        href={fullUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-sm truncate max-w-[160px] hover:underline hover:text-primary cursor-pointer"
        title={`Click to open: ${path}`}
      >
        {fileName}
      </a>
      <Badge 
        variant="outline" 
        className={cn(
          "text-xs px-1.5 py-0 h-5 font-mono flex-shrink-0",
          isHealthy 
            ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-700"
            : "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-400 dark:border-red-700"
        )}
      >
        {status}
      </Badge>
    </div>
  );
}

// Prompts vs Disk cell with expandable file list
function PromptsVsDiskCell({ data, externalJobId, serverIp }: { data: { status: string; prompts?: number; disk?: number; files?: Array<{ path: string; status: number }> }; externalJobId: string; serverIp?: string }) {
  const [expanded, setExpanded] = useState(false);
  
  if (data.status === 'N/A') {
    return <span className="text-xs text-muted-foreground">N/A</span>;
  }
  
  const isMatch = data.status === 'MATCH';
  const hasFiles = data.files && data.files.length > 0;
  
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-xs">
        {isMatch ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        ) : (
          <XCircle className="h-3 w-3 text-red-500" />
        )}
        <span className={isMatch ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
          {data.disk}/{data.prompts}
        </span>
        {hasFiles && (
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="ml-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
          </button>
        )}
      </div>
      {expanded && hasFiles && (
        <div className="flex flex-col gap-0.5 mt-1">
          {data.files!.map((file, idx) => {
            const fileName = file.path.split('/').pop() || file.path;
            const isHealthy = file.status >= 200 && file.status < 300;
            const fullUrl = `http://${serverIp || '69.197.145.4'}:5005/player/jobs/${externalJobId}/${file.path}`;
            return (
              <div key={idx} className="flex items-center gap-1 text-[10px]">
                <a
                  href={fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono truncate max-w-[140px] hover:underline hover:text-primary"
                  title={file.path}
                >
                  {fileName}
                </a>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "text-[9px] px-1 py-0 h-3.5 font-mono",
                    isHealthy 
                      ? "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400"
                      : "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-400"
                  )}
                >
                  {file.status}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// URL Health cell
function UrlHealthCell({ data }: { data: { clean: boolean; issues: string[] } }) {
  if (data.clean) {
    return (
      <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        <span>Clean</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400" title={data.issues.join(', ')}>
      <XCircle className="h-3 w-3" />
      <span>{data.issues.length} issue{data.issues.length > 1 ? 's' : ''}</span>
    </div>
  );
}

// V2.5 Logic Check cell
function V25LogicCell({ data }: { data: { status: string; type: string | null; details: Record<string, number> | null } }) {
  if (data.status === 'N/A') {
    return <span className="text-xs text-muted-foreground">N/A</span>;
  }
  
  const isPassing = data.status === 'PASS';
  const detailsStr = data.details 
    ? Object.entries(data.details).map(([k, v]) => `${k}: ${v}`).join(', ')
    : '';
  
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-xs">
        {isPassing ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        ) : (
          <XCircle className="h-3 w-3 text-red-500" />
        )}
        <span className={isPassing ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
          {data.status}
        </span>
        {data.type && (
          <span className="text-muted-foreground">({data.type})</span>
        )}
      </div>
      {detailsStr && (
        <span className="text-[10px] text-muted-foreground pl-4">{detailsStr}</span>
      )}
    </div>
  );
}

// Summary card component
function SummaryCard({ 
  icon: Icon, 
  label, 
  healthy, 
  total, 
  iconColor 
}: { 
  icon: React.ElementType; 
  label: string; 
  healthy: number; 
  total: number; 
  iconColor: string;
}) {
  const percentage = total > 0 ? Math.round((healthy / total) * 100) : 100;
  const isFullyHealthy = percentage === 100;
  const isPartiallyHealthy = percentage >= 80;
  
  return (
    <Card className={cn(
      "border-0",
      isFullyHealthy && "bg-emerald-50 dark:bg-emerald-950/30",
      !isFullyHealthy && isPartiallyHealthy && "bg-amber-50 dark:bg-amber-950/30",
      !isPartiallyHealthy && "bg-red-50 dark:bg-red-950/30"
    )}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-lg", iconColor)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-bold">
              {healthy}/{total}
            </div>
            <div className="text-[10px] text-muted-foreground">{label}</div>
          </div>
          {total > 0 && (
            <div className="ml-auto">
              {isFullyHealthy ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : isPartiallyHealthy ? (
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Section row with expandable images
function SectionRow({ section, externalJobId, serverIp }: { section: SectionHealth; externalJobId: string; serverIp?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasImages = section.images && section.images.length > 0;
  const healthyImages = section.images?.filter(img => img.status >= 200 && img.status < 300).length || 0;
  const totalImages = section.images?.length || 0;
  
  return (
    <>
      <tr className="hover:bg-muted/50 border-b border-border">
        <td className="font-mono text-sm text-center py-3 px-4 border-r border-border">{section.section_id}</td>
        <td className="py-3 px-4 border-r border-border">
          <Badge variant="outline" className="text-xs px-2 py-0.5">
            {section.section_type}
          </Badge>
        </td>
        <td className="py-3 px-4 border-r border-border">
          <Badge 
            variant="outline" 
            className={cn(
              "text-xs px-2 py-0.5",
              section.renderer === 'MANIM' && "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/50 dark:text-purple-400"
            )}
          >
            {section.renderer || 'NONE'}
          </Badge>
        </td>
        <td className="py-3 px-4 border-r border-border">
          <FileStatusCell path={section.avatar_video.path} status={section.avatar_video.status} externalJobId={externalJobId} serverIp={serverIp} />
        </td>
        <td className="py-3 px-4 border-r border-border">
          {section.topic_video.path ? (
            <FileStatusCell path={section.topic_video.path} status={section.topic_video.status} externalJobId={externalJobId} serverIp={serverIp} />
          ) : section.topic_video.orphan ? (
            <div className="flex items-center gap-2">
              <a
                href={`http://${serverIp || '69.197.145.4'}:5005/player/jobs/${externalJobId}/${section.topic_video.orphan.path}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm truncate max-w-[120px] text-amber-600 hover:underline hover:text-amber-700 dark:text-amber-500"
                title={`Orphan file (exists on disk but not in JSON): ${section.topic_video.orphan.path}`}
              >
                {section.topic_video.orphan.path.split('/').pop()}
              </a>
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs px-1.5 py-0 h-5 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-700">
                ORPHAN
              </Badge>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">None</span>
          )}
        </td>
        <td className="py-3 px-4 text-center border-r border-border">
          <PromptsVsDiskCell data={section.prompts_vs_disk} externalJobId={externalJobId} serverIp={serverIp} />
        </td>
        <td className="py-3 px-4 text-center border-r border-border">
          {hasImages ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                "h-7 gap-1.5 px-2 text-sm",
                healthyImages === totalImages 
                  ? "text-emerald-600 hover:text-emerald-700 dark:text-emerald-400" 
                  : healthyImages > 0 
                    ? "text-amber-600 hover:text-amber-700 dark:text-amber-400"
                    : "text-red-600 hover:text-red-700 dark:text-red-400"
              )}
            >
              {healthyImages === totalImages ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {healthyImages}/{totalImages}
              <ChevronDown className={cn(
                "h-4 w-4 transition-transform",
                isExpanded && "rotate-180"
              )} />
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </td>
        <td className="py-3 px-4 text-center border-r border-border">
          <UrlHealthCell data={section.url_health} />
        </td>
        <td className="py-3 px-4">
          <V25LogicCell data={section.v25_logic_check} />
        </td>
      </tr>
      
      {hasImages && isExpanded && (
        <tr className="bg-muted/30 border-b border-border">
          <td colSpan={9} className="py-3 px-6">
            <div className="text-xs font-medium text-muted-foreground mb-2">Visual Beats</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {section.images?.map((img, idx) => (
                <div 
                  key={idx} 
                  className={cn(
                    "flex items-center gap-1.5 p-2 rounded text-xs",
                    img.status >= 200 && img.status < 300 
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20" 
                      : "bg-red-50/50 dark:bg-red-950/20"
                  )}
                >
                  {(() => {
                    let normalizedId = img.image_id;
                    if (normalizedId.endsWith('.jpg') || normalizedId.endsWith('.jpeg')) {
                      normalizedId = normalizedId.replace(/\.jpe?g$/, '.png');
                    }
                    const imagePath = normalizedId.includes('/') 
                      ? normalizedId 
                      : `images/${normalizedId}`;
                    const imageUrl = `http://${serverIp || '69.197.145.4'}:5005/player/jobs/${externalJobId}/${imagePath}`;
                    return (
                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 flex-1 min-w-0 hover:underline hover:text-primary"
                        title={`Click to open: ${imagePath}`}
                      >
                        <ImageIcon className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate font-mono">{img.image_id}</span>
                      </a>
                    );
                  })()}
                  <Badge
                    variant="outline" 
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-4",
                      img.status >= 200 && img.status < 300 
                        ? "bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-red-100 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400"
                    )}
                  >
                    {img.status}
                  </Badge>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// Terminal-style status display
function CheckStatusPanel({ isLoading, data }: { isLoading: boolean; data: SanityCheckData | null }) {
  return (
    <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-3 font-mono text-xs">
      <div className="space-y-1">
        <div className="text-cyan-400">
          {isLoading ? '⏳' : '✓'} Checking Job: {data?.job_id || '...'}
        </div>
        {isLoading ? (
          <>
            <div className="text-slate-400">Fetching presentation.json...</div>
            <div className="text-slate-400">Validating media integrity...</div>
          </>
        ) : data ? (
          <>
            <div className="text-slate-400">
              Found {data.summary.total_sections} sections. Validating media integrity...
            </div>
            <div className="text-emerald-400 font-medium">✓ Check Complete!</div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Self-healing alert panel
function SelfHealingPanel({ 
  orphansFound, 
  orphanFiles,
  externalJobId,
  onRefresh,
  isRefetching,
  summary,
  serverIp
}: { 
  orphansFound: boolean; 
  orphanFiles: string[];
  externalJobId: string;
  onRefresh: () => void;
  isRefetching: boolean;
  summary?: { avatar_healthy: number; avatar_total: number; topic_healthy: number; topic_total: number; images_healthy: number; images_total: number };
  serverIp?: string;
}) {
  const repairUrlsMutation = useRepairUrls();
  const stitchAssetsMutation = useStitchAssets();
  const repairMissingAssetsMutation = useRepairMissingAssets();
  
  // Show panel if orphans found OR if any assets are missing
  const hasMissingAssets = summary && (
    summary.avatar_healthy < summary.avatar_total ||
    summary.topic_healthy < summary.topic_total ||
    summary.images_healthy < summary.images_total
  );
  
  if (!orphansFound && !hasMissingAssets) return null;
  
  const handleStitch = () => {
    stitchAssetsMutation.mutate(externalJobId);
  };
  
  const handleFixUrls = () => {
    repairUrlsMutation.mutate(externalJobId);
  };
  
  return (
    <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
      <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-800 dark:text-amber-300 text-sm">
        Self-Healing: {orphansFound ? 'Orphan Files Detected' : 'Missing Assets Detected'}
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs mt-1">
        {orphansFound 
          ? 'The checker found media files on disk that are NOT linked to presentation.json, or vice-versa. You can attempt to auto-repair these issues.'
          : 'Some media assets are missing or broken. Use the buttons below to attempt recovery.'
        }
        {orphanFiles.length > 0 && (
          <div className="mt-1 font-mono text-[10px]">
            Orphans: {orphanFiles.slice(0, 3).join(', ')}{orphanFiles.length > 3 && ` +${orphanFiles.length - 3} more`}
          </div>
        )}
      </AlertDescription>
      <div className="flex gap-2 mt-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs bg-amber-100 hover:bg-amber-200 border-amber-300 dark:bg-amber-900/50 dark:hover:bg-amber-900/70"
          onClick={handleStitch}
          disabled={stitchAssetsMutation.isPending}
        >
          {stitchAssetsMutation.isPending ? (
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Link className="h-3 w-3 mr-1" />
          )}
          {stitchAssetsMutation.isPending ? 'Stitching...' : 'Stitch Missing Assets'}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs bg-amber-100 hover:bg-amber-200 border-amber-300 dark:bg-amber-900/50 dark:hover:bg-amber-900/70"
          onClick={handleFixUrls}
          disabled={repairUrlsMutation.isPending}
        >
          {repairUrlsMutation.isPending ? (
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Zap className="h-3 w-3 mr-1" />
          )}
          {repairUrlsMutation.isPending ? 'Fixing...' : 'Fix Malformed URLs'}
        </Button>
        {summary && summary.avatar_healthy < summary.avatar_total && (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs bg-amber-100 hover:bg-amber-200 border-amber-300 dark:bg-amber-900/50 dark:hover:bg-amber-900/70"
            onClick={() => repairMissingAssetsMutation.mutate({ externalJobId, serverIp })}
            disabled={repairMissingAssetsMutation.isPending}
          >
            {repairMissingAssetsMutation.isPending ? (
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3 mr-1" />
            )}
            {repairMissingAssetsMutation.isPending ? 'Repairing...' : 'Repair Missing Avatars'}
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 text-xs bg-amber-100 hover:bg-amber-200 border-amber-300 dark:bg-amber-900/50 dark:hover:bg-amber-900/70"
          onClick={onRefresh}
          disabled={isRefetching}
        >
          <RefreshCw className={cn("h-3 w-3 mr-1", isRefetching && "animate-spin")} />
          {isRefetching ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>
      
      {/* Error display below buttons */}
      {stitchAssetsMutation.isError && (
        <Alert variant="destructive" className="mt-2 py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Failed to stitch assets: {stitchAssetsMutation.error?.message || 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}
      {repairUrlsMutation.isError && (
        <Alert variant="destructive" className="mt-2 py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Failed to repair URLs: {repairUrlsMutation.error?.message || 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}
      {repairMissingAssetsMutation.isError && (
        <Alert variant="destructive" className="mt-2 py-2">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Failed to repair missing avatars: {repairMissingAssetsMutation.error?.message || 'Unknown error'}
          </AlertDescription>
        </Alert>
      )}
    </Alert>
  );
}

// Loading skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-16 bg-slate-800" />
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-[300px]" />
    </div>
  );
}

export function SanityCheckDialog({
  open,
  onOpenChange,
  externalJobId,
  documentName, serverIp
}: SanityCheckDialogProps) {
  const { data, isLoading, isFetching, isError, refetch } = useSanityCheck(externalJobId, serverIp);
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [showStatusPanel, setShowStatusPanel] = useState(false);
  
  // Run cleanup for stale tasks at dialog level (ensures 1-hour timeout works even if panel is hidden)
  useCleanupStaleTasks(externalJobId);
  
  // Check for active regeneration tasks from database
  const { hasActiveTasks, hasTasks } = useHasActiveTasks(externalJobId);
  
  // Also check external API for active processing (covers auto-pipeline-triggered repairs)
  const { data: externalJobStatus } = useRegenJobStatus(externalJobId, open, serverIp);
  const { data: externalAvatarStatus } = useAvatarGenerationStatus(externalJobId, open, serverIp);
  
  const hasExternalProcessing = 
    externalJobStatus?.status === 'processing' || 
    externalAvatarStatus?.state === 'processing';
  
  // Show button if there are local tasks OR external processing is detected
  const shouldShowStatusButton = hasTasks || hasActiveTasks || hasExternalProcessing;
  
  // Auto-show status panel when external processing is detected
  useEffect(() => {
    if (hasExternalProcessing && !showStatusPanel) {
      setShowStatusPanel(true);
    }
  }, [hasExternalProcessing]);
  
  // Callback for when regeneration starts - auto-show status panel
  const handleRegenStarted = (_phase: string, _message: string) => {
    setShowStatusPanel(true);
  };
  
  const handleStatusClose = () => {
    setShowStatusPanel(false);
  };

  const copyJobId = () => {
    navigator.clipboard.writeText(externalJobId);
    toast.success('Job ID copied to clipboard');
  };

  // Calculate overall health percentage
  const getOverallHealth = (data: SanityCheckData) => {
    const total = data.summary.avatar_total + data.summary.topic_total + data.summary.images_total;
    const healthy = data.summary.avatar_healthy + data.summary.topic_healthy + data.summary.images_healthy;
    return total > 0 ? Math.round((healthy / total) * 100) : 100;
  };

  // Check if there are any missing assets that could be regenerated
  const hasMissingAssets = (data: SanityCheckData) => {
    return (
      data.summary.avatar_healthy < data.summary.avatar_total ||
      data.summary.topic_healthy < data.summary.topic_total ||
      data.sections.some(s => s.prompts_vs_disk.status === 'MISMATCH')
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[90vw] lg:max-w-[1400px] overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-cyan-600" />
              Sanity Check (Deep Check)
            </SheetTitle>
            <div className="flex items-center gap-2">
              {/* Status button - show when there are any tasks */}
              {shouldShowStatusButton && (
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5",
                    hasActiveTasks
                      ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50"
                      : "border-muted"
                  )}
                  onClick={() => setShowStatusPanel(!showStatusPanel)}
                >
                  <Activity className={cn("h-4 w-4", hasActiveTasks && "animate-pulse")} />
                  Status
                  {hasActiveTasks && (
                    <span className="ml-1 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  )}
                </Button>
              )}
              {/* Regen button - show when there are missing assets */}
              {data && hasMissingAssets(data) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-400 dark:hover:bg-orange-950/50"
                  onClick={() => setRegenDialogOpen(true)}
                >
                  <RotateCcw className="h-4 w-4" />
                  Regen
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span 
              className="font-mono text-xs bg-muted px-2 py-1 rounded cursor-pointer hover:bg-muted/80 flex items-center gap-1"
              onClick={copyJobId}
              title="Click to copy"
            >
              {externalJobId}
              <Copy className="h-3 w-3" />
            </span>
            <span>•</span>
            <span className="truncate max-w-[300px]">{documentName || data?.presentation_title}</span>
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="flex-1 overflow-hidden flex flex-col gap-3 mt-3">
            <LoadingSkeleton />
          </div>
        ) : isError || !data ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <XCircle className="h-12 w-12 mb-4 text-red-500" />
            <p className="mb-4">Failed to load sanity check data</p>
            <Button onClick={() => refetch()} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : (
          <ScrollArea className="flex-1 mt-3">
            <div className="space-y-3 pr-4">
              {/* Terminal-style status */}
              <CheckStatusPanel isLoading={isLoading} data={data} />
              
              {/* Regeneration Status Panel */}
              {showStatusPanel && (
                <RegenerationStatusPanel
                  externalJobId={externalJobId}
                  serverIp={serverIp}
                  onClose={handleStatusClose}
                />
              )}
              
              {/* Self-healing panel */}
              <SelfHealingPanel 
                orphansFound={data.orphans_found || false} 
                orphanFiles={data.orphan_files || []} 
                externalJobId={externalJobId}
                onRefresh={() => refetch()}
                isRefetching={isFetching}
                summary={data.summary}
                serverIp={serverIp}
              />
              
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryCard
                  icon={User}
                  label="Avatars"
                  healthy={data.summary.avatar_healthy}
                  total={data.summary.avatar_total}
                  iconColor="bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
                />
                <SummaryCard
                  icon={Video}
                  label="Topic Videos"
                  healthy={data.summary.topic_healthy}
                  total={data.summary.topic_total}
                  iconColor="bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400"
                />
                <SummaryCard
                  icon={ImageIcon}
                  label="Images"
                  healthy={data.summary.images_healthy}
                  total={data.summary.images_total}
                  iconColor="bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400"
                />
                <Card className={cn(
                  "border-0",
                  getOverallHealth(data) >= 90 && "bg-emerald-50 dark:bg-emerald-950/30",
                  getOverallHealth(data) >= 70 && getOverallHealth(data) < 90 && "bg-amber-50 dark:bg-amber-950/30",
                  getOverallHealth(data) < 70 && "bg-red-50 dark:bg-red-950/30"
                )}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "p-1.5 rounded-lg",
                        getOverallHealth(data) >= 90 && "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400",
                        getOverallHealth(data) >= 70 && getOverallHealth(data) < 90 && "bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400",
                        getOverallHealth(data) < 70 && "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400"
                      )}>
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-lg font-bold">
                          {getOverallHealth(data)}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">Overall Health</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sections Table */}
              <div className="border border-border rounded-lg overflow-x-auto">
                <table className="w-full min-w-[1100px] text-sm">
                  <thead className="bg-muted/80">
                    <tr className="border-b border-border">
                      <th className="w-[60px] text-center font-semibold py-3 px-4 border-r border-border">Sec</th>
                      <th className="w-[100px] font-semibold py-3 px-4 border-r border-border text-left">Type</th>
                      <th className="w-[90px] font-semibold py-3 px-4 border-r border-border text-left">Renderer</th>
                      <th className="w-[200px] font-semibold py-3 px-4 border-r border-border text-left">Avatar</th>
                      <th className="w-[200px] font-semibold py-3 px-4 border-r border-border text-left">Topic Video</th>
                      <th className="w-[80px] text-center font-semibold py-3 px-4 border-r border-border">P vs D</th>
                      <th className="w-[90px] text-center font-semibold py-3 px-4 border-r border-border">Images</th>
                      <th className="w-[80px] text-center font-semibold py-3 px-4 border-r border-border">URL</th>
                      <th className="w-[180px] font-semibold py-3 px-4 text-left">V2.5 Logic</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sections.map((section) => (
                      <SectionRow key={section.section_id} section={section} externalJobId={externalJobId} serverIp={serverIp} />
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer info */}
              <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-4 py-3 border-t bg-muted/30 rounded-b-lg">
                <span className="font-medium">{data.sections.length} sections</span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  {data.summary.v25_pass || 0} V2.5 pass / {data.summary.v25_fail || 0} fail
                </span>
                <span>•</span>
                <span>{data.summary.url_issues || 0} URL issues</span>
              </div>
            </div>
          </ScrollArea>
        )}
        
        {/* Regenerate Phase Dialog */}
        {data && (
          <RegeneratePhaseDialog
            open={regenDialogOpen}
            onOpenChange={setRegenDialogOpen}
            externalJobId={externalJobId}
            sanityData={data}
            onRegenStarted={handleRegenStarted}
            serverIp={serverIp}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
