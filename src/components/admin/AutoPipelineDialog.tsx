import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Server } from "lucide-react";
import { VIDEO_SERVER_OPTIONS } from "@/hooks/useAdminPopularSubjects";
import type { SubjectChapter } from "@/hooks/useSubjectManagement";

interface AutoPipelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: SubjectChapter[];
  subjectName: string;
  onStart: (selectedIps: string[], selectedChapters: SubjectChapter[]) => void;
}

export function AutoPipelineDialog({ open, onOpenChange, chapters, subjectName, onStart }: AutoPipelineDialogProps) {
  const [selectedIps, setSelectedIps] = useState<string[]>([VIDEO_SERVER_OPTIONS[0].ip]);
  const [selectedChapterIds, setSelectedChapterIds] = useState<Set<string>>(() => new Set(chapters.map(c => c.id)));

  // Re-sync when chapters change
  useEffect(() => {
    setSelectedChapterIds(new Set(chapters.map(c => c.id)));
  }, [chapters]);

  const toggleIp = (ip: string) => {
    setSelectedIps(prev =>
      prev.includes(ip) ? prev.filter(i => i !== ip) : [...prev, ip]
    );
  };

  const toggleChapter = (id: string) => {
    setSelectedChapterIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allChaptersSelected = selectedChapterIds.size === chapters.length;

  const toggleAllChapters = () => {
    if (allChaptersSelected) {
      setSelectedChapterIds(new Set());
    } else {
      setSelectedChapterIds(new Set(chapters.map(c => c.id)));
    }
  };

  const handleStart = () => {
    if (selectedIps.length === 0 || selectedChapterIds.size === 0) return;
    const filtered = chapters.filter(c => selectedChapterIds.has(c.id));
    onStart(selectedIps, filtered);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Scan & Review Pipeline
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh] pr-3">
        <div className="space-y-4">

          <div>
            <p className="text-sm text-muted-foreground mb-1">Subject: <span className="font-medium text-foreground">{subjectName}</span></p>
            <p className="text-sm text-muted-foreground">Select chapters to scan. The system will audit all topics, run sanity checks on completed jobs, and present an interactive report before starting.</p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Server className="h-4 w-4" />
              Select Server IPs (for new jobs, max 2 per IP)
            </p>
            <div className="grid grid-cols-1 gap-2 max-h-[200px] overflow-y-auto">
              {VIDEO_SERVER_OPTIONS.map(server => (
                <label
                  key={server.ip}
                  className="flex items-center gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    checked={selectedIps.includes(server.ip)}
                    onCheckedChange={() => toggleIp(server.ip)}
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">{server.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{server.ip}</span>
                  </div>
                </label>
              ))}
            </div>
            {selectedIps.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Max concurrent new jobs: {selectedIps.length * 2} (2 per IP × {selectedIps.length} IPs)
              </p>
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Chapters ({selectedChapterIds.size}/{chapters.length})</p>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAllChapters}>
                {allChaptersSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            {chapters.map(ch => (
              <label
                key={ch.id}
                className={`flex items-center gap-2 text-sm py-1.5 px-2 rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
                  selectedChapterIds.has(ch.id) ? 'bg-primary/5' : ''
                }`}
              >
                <Checkbox
                  checked={selectedChapterIds.has(ch.id)}
                  onCheckedChange={() => toggleChapter(ch.id)}
                />
                <Badge variant="outline" className="text-xs">Ch {ch.chapter_number}</Badge>
                <span className="truncate">{ch.title}</span>
              </label>
            ))}
          </div>
        </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleStart} disabled={selectedIps.length === 0 || selectedChapterIds.size === 0} className="gap-2">
            <Search className="h-4 w-4" />
            Scan & Review ({selectedChapterIds.size} ch)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
