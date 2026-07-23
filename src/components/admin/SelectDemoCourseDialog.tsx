import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Star, Check } from 'lucide-react';
import { useAdminCourses } from '@/hooks/useAdminCourses';
import { useSetCourseDemoVideo } from '@/hooks/useCourseDemoVideo';
import type { VideoJobWithDocument } from '@/hooks/useVideoGenerationJobs';

interface SelectDemoCourseDialogProps {
  job: VideoJobWithDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SelectDemoCourseDialog({ job, open, onOpenChange }: SelectDemoCourseDialogProps) {
  const { data: courses = [], isLoading } = useAdminCourses();
  const setDemo = useSetCourseDemoVideo();
  const [search, setSearch] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c: any) =>
      c.name?.toLowerCase().includes(q) || c.slug?.toLowerCase().includes(q)
    );
  }, [courses, search]);

  const handleSave = async () => {
    if (!job || !selectedCourseId || !job.external_job_id) return;
    await setDemo.mutateAsync({
      course_id: selectedCourseId,
      video_job_id: job.id,
      external_job_id: job.external_job_id,
      server_ip: job.server_ip || null,
      document_name: job.document_name || null,
    });
    onOpenChange(false);
    setSelectedCourseId(null);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            Select Course for Demo
          </DialogTitle>
          <DialogDescription>
            Choose the course where this video will appear as a free demo on the course page.
            {job?.document_name && (
              <span className="block mt-1 text-xs text-muted-foreground">
                Job: {job.document_name}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-72 border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No courses found</div>
            ) : (
              <ul className="divide-y">
                {filtered.map((c: any) => {
                  const selected = selectedCourseId === c.id;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCourseId(c.id)}
                        className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-accent transition-colors ${
                          selected ? 'bg-accent' : ''
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{c.name}</div>
                          {c.slug && (
                            <div className="text-xs text-muted-foreground truncate">/{c.slug}</div>
                          )}
                        </div>
                        {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={setDemo.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedCourseId || setDemo.isPending}
            className="gap-2"
          >
            {setDemo.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Set as Demo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
