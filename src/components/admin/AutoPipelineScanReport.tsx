import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

import { Progress } from "@/components/ui/progress";
import { Loader2, Rocket, CheckCircle2, Wrench, PlusCircle, FileX, PartyPopper, AlertTriangle } from "lucide-react";
import type { ScanResult } from "@/hooks/useAutoPipeline";

interface AutoPipelineScanReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanResults: ScanResult[];
  isScanning: boolean;
  scanProgress: { current: number; total: number };
  onStart: (selectedItems: ScanResult[]) => void;
  onCancel: () => void;
}

const categoryConfig = {
  healthy: { label: "Healthy", icon: CheckCircle2, className: "text-green-600 border-green-300 bg-green-50 dark:bg-green-950/20" },
  needs_repair: { label: "Repair", icon: Wrench, className: "text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20" },
  needs_new_job: { label: "New Job", icon: PlusCircle, className: "text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/20" },
  no_document: { label: "No Doc", icon: FileX, className: "text-muted-foreground border-muted bg-muted/30" },
};

export function AutoPipelineScanReport({
  open,
  onOpenChange,
  scanResults,
  isScanning,
  scanProgress,
  onStart,
  onCancel,
}: AutoPipelineScanReportProps) {
  const [selections, setSelections] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    scanResults.forEach(r => { map[r.topicId] = r.selected; });
    return map;
  });

  const [activeFilter, setActiveFilter] = useState<'needs_repair' | 'needs_new_job' | 'failed_jobs' | null>(null);

  // Re-init selections when scanResults change (e.g. scan completes)
  useEffect(() => {
    const map: Record<string, boolean> = {};
    scanResults.forEach(r => { map[r.topicId] = r.selected; });
    setSelections(map);
    setActiveFilter(null);
  }, [scanResults]);

  const toggleSelection = (topicId: string) => {
    setSelections(prev => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const toggleChapter = (group: { items: ScanResult[] }) => {
    const selectableIds = group.items
      .filter(item => item.category !== 'no_document')
      .map(item => item.topicId);
    const allSelected = selectableIds.length > 0 && selectableIds.every(id => selections[id]);
    setSelections(prev => {
      const next = { ...prev };
      selectableIds.forEach(id => { next[id] = !allSelected; });
      return next;
    });
  };

  const stats = useMemo(() => {
    const healthy = scanResults.filter(r => r.category === 'healthy').length;
    const repair = scanResults.filter(r => r.category === 'needs_repair').length;
    const newJob = scanResults.filter(r => r.category === 'needs_new_job').length;
    const noDoc = scanResults.filter(r => r.category === 'no_document').length;
    const failed = scanResults.filter(r => r.existingJobId && (r.category === 'needs_repair' || r.category === 'needs_new_job')).length;
    const selectedRepairs = scanResults.filter(r => r.category === 'needs_repair' && selections[r.topicId]).length;
    const selectedNew = scanResults.filter(r => r.category === 'needs_new_job' && selections[r.topicId]).length;
    const selectedHealthy = scanResults.filter(r => r.category === 'healthy' && selections[r.topicId]).length;
    return { healthy, repair, newJob, noDoc, failed, selectedRepairs, selectedNew, selectedHealthy, totalSelected: selectedRepairs + selectedNew + selectedHealthy };
  }, [scanResults, selections]);

  const handleChipClick = (filter: 'needs_repair' | 'needs_new_job' | 'failed_jobs') => {
    if (isScanning) return;
    const newFilter = activeFilter === filter ? null : filter;
    setActiveFilter(newFilter);

    if (!newFilter) {
      const map: Record<string, boolean> = {};
      scanResults.forEach(r => { map[r.topicId] = r.selected; });
      setSelections(map);
      return;
    }

    const map: Record<string, boolean> = {};
    scanResults.forEach(r => {
      if (newFilter === 'needs_repair') {
        map[r.topicId] = r.category === 'needs_repair';
      } else if (newFilter === 'needs_new_job') {
        map[r.topicId] = r.category === 'needs_new_job';
      } else if (newFilter === 'failed_jobs') {
        map[r.topicId] = !!r.existingJobId && (r.category === 'needs_repair' || r.category === 'needs_new_job');
      }
    });
    setSelections(map);
  };

  // Group by chapter
  const groupedByChapter = useMemo(() => {
    const map = new Map<string, { chapterName: string; chapterNumber: number; items: ScanResult[] }>();
    for (const r of scanResults) {
      if (!map.has(r.chapterId)) {
        map.set(r.chapterId, { chapterName: r.chapterName, chapterNumber: r.chapterNumber, items: [] });
      }
      map.get(r.chapterId)!.items.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.chapterNumber - b.chapterNumber);
  }, [scanResults]);

  const handleStart = () => {
    const selected = scanResults.map(r => ({ ...r, selected: !!selections[r.topicId] }));
    onStart(selected);
  };

  const allHealthy = !isScanning && stats.repair === 0 && stats.newJob === 0;
  const progressPct = scanProgress.total > 0 ? Math.round((scanProgress.current / scanProgress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95dvh] sm:max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {isScanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
            {isScanning 
              ? `Scanning... ${scanProgress.current}/${scanProgress.total} topics` 
              : "Scan Report"}
          </DialogTitle>
        </DialogHeader>

        {/* Scanning progress */}
        {isScanning && (
          <div className="space-y-2 py-3">
            <Progress value={progressPct} className="h-2" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {scanProgress.current}/{scanProgress.total} topics scanned
              </span>
              <span className="text-muted-foreground">
                {groupedByChapter.length} chapter{groupedByChapter.length !== 1 ? 's' : ''} found
              </span>
            </div>
          </div>
        )}

        {/* Stats bar */}
        {scanResults.length > 0 && (
          <div className="flex flex-wrap gap-2 py-2">
            <Badge
              variant="outline"
              className={`gap-1 text-green-600 border-green-300 ${!isScanning ? 'cursor-pointer hover:bg-green-100 dark:hover:bg-green-950/40' : ''} ${activeFilter === null && !isScanning ? '' : ''}`}
              onClick={() => {}}
            >
              <CheckCircle2 className="h-3 w-3" /> {stats.healthy} Healthy
            </Badge>
            <Badge
              variant="outline"
              className={`gap-1 text-amber-600 border-amber-300 ${!isScanning ? 'cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/40' : ''} ${activeFilter === 'needs_repair' ? 'ring-2 ring-amber-400 bg-amber-100 dark:bg-amber-950/40' : ''}`}
              onClick={() => handleChipClick('needs_repair')}
            >
              <Wrench className="h-3 w-3" /> {stats.repair} Repair
            </Badge>
            <Badge
              variant="outline"
              className={`gap-1 text-blue-600 border-blue-300 ${!isScanning ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/40' : ''} ${activeFilter === 'needs_new_job' ? 'ring-2 ring-blue-400 bg-blue-100 dark:bg-blue-950/40' : ''}`}
              onClick={() => handleChipClick('needs_new_job')}
            >
              <PlusCircle className="h-3 w-3" /> {stats.newJob} New Job
            </Badge>
            {stats.failed > 0 && (
              <Badge
                variant="outline"
                className={`gap-1 text-red-600 border-red-300 ${!isScanning ? 'cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/40' : ''} ${activeFilter === 'failed_jobs' ? 'ring-2 ring-red-400 bg-red-100 dark:bg-red-950/40' : ''}`}
                onClick={() => handleChipClick('failed_jobs')}
              >
                <AlertTriangle className="h-3 w-3" /> {stats.failed} Failed
              </Badge>
            )}
            {stats.noDoc > 0 && (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <FileX className="h-3 w-3" /> {stats.noDoc} No Doc
              </Badge>
            )}
            <div className="ml-auto text-xs text-muted-foreground self-center">
              {stats.totalSelected} selected
            </div>
          </div>
        )}

        {/* All healthy message */}
        {allHealthy && scanResults.length > 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <PartyPopper className="h-10 w-10 text-green-500" />
            <p className="text-sm font-medium">All topics are healthy! No action needed.</p>
            <p className="text-xs text-muted-foreground">You can still force re-run individual topics by selecting them below.</p>
          </div>
        )}

        {/* Topic list */}
        {scanResults.length > 0 && (
          <div className="flex-1 min-h-0 max-h-[50vh] overflow-y-auto pr-3">
            <div className="space-y-4">
              {groupedByChapter.map(group => (
                <div key={group.chapterNumber}>
                  {(() => {
                    const selectableItems = group.items.filter(i => i.category !== 'no_document');
                    const selectedCount = selectableItems.filter(i => selections[i.topicId]).length;
                    const selectableCount = selectableItems.length;
                    const allSelected = selectableCount > 0 && selectedCount === selectableCount;
                    const indeterminate = selectedCount > 0 && selectedCount < selectableCount;
                    return (
                      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1 z-10">
                        <Checkbox
                          checked={indeterminate ? "indeterminate" : allSelected}
                          onCheckedChange={() => toggleChapter(group)}
                          disabled={selectableCount === 0}
                        />
                        <Badge variant="outline" className="text-xs">Ch {group.chapterNumber}</Badge>
                        <span className="text-sm font-medium truncate">{group.chapterName}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{selectedCount}/{selectableCount}</span>
                      </div>
                    );
                  })()}
                  <div className="space-y-1 ml-2">
                    {group.items.map(item => {
                      const config = categoryConfig[item.category];
                      const Icon = config.icon;
                      const isDisabled = item.category === 'no_document';
                      const isChecked = !!selections[item.topicId];

                      return (
                        <label
                          key={item.topicId}
                          className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors text-sm ${
                            isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'
                          } ${isChecked && !isDisabled ? 'border-primary/30 bg-primary/5' : ''}`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => !isDisabled && toggleSelection(item.topicId)}
                            disabled={isDisabled}
                          />
                          <span className="text-xs text-muted-foreground w-8">T{item.topicNumber}</span>
                          <span className="flex-1 truncate">{item.topicName}</span>
                          <Badge variant="outline" className={`text-[10px] gap-1 ${config.className}`}>
                            <Icon className="h-3 w-3" />
                            {config.label}
                          </Badge>
                          {item.category === 'needs_repair' && item.missingPhases.length > 0 && (
                            <span className="text-[10px] text-amber-600 max-w-[120px] truncate">
                              Missing: {item.missingPhases.join(', ')}
                            </span>
                          )}
                          {item.category === 'healthy' && item.serverIp && (
                            <span className="text-[10px] text-muted-foreground">
                              {item.serverIp.split('.').slice(-1)[0]}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 flex-shrink-0 pt-2 border-t">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          {!isScanning && (
            <Button onClick={handleStart} disabled={stats.totalSelected === 0 || isScanning} className="gap-2">
              <Rocket className="h-4 w-4" />
              {activeFilter === 'needs_repair' ? `Start Repair (${stats.totalSelected})`
                : activeFilter === 'needs_new_job' ? `Start New Jobs (${stats.totalSelected})`
                : activeFilter === 'failed_jobs' ? `Start Failed Jobs (${stats.totalSelected})`
                : `Start Pipeline (${stats.totalSelected})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
