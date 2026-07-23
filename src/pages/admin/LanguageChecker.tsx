import { useMemo, useState } from 'react';
import { useAllSubjects } from '@/hooks/useAllSubjects';
import { useVideoGenerationJobs } from '@/hooks/useVideoGenerationJobs';
import { useSubjectChaptersWithTopics } from '@/hooks/useSubjectChaptersOptimized';
import { CloudLanguageCheckerDialog } from '@/components/admin/CloudLanguageCheckerDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Languages, Loader2, PlayCircle } from 'lucide-react';

export default function LanguageChecker() {
  const { data: subjects = [], isLoading: subjectsLoading } = useAllSubjects();
  const [subjectId, setSubjectId] = useState<string>('');
  const [open, setOpen] = useState(false);

  const { data: jobs = [], isLoading: jobsLoading } = useVideoGenerationJobs({
    subjectId: subjectId || undefined,
    enabled: !!subjectId,
  });

  const { data: chapters = [] } = useSubjectChaptersWithTopics(subjectId || undefined);

  const subjectName = useMemo(
    () => subjects.find((s: any) => s.id === subjectId)?.name || 'Subject',
    [subjects, subjectId],
  );

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Languages className="h-7 w-7" /> Cloud Job Language Checker
        </h1>
        <p className="text-muted-foreground">
          Verify English &amp; Kannada avatars (JSON + physical .mp4 on FTP) for a subject, and export a full report of published jobs.
        </p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">Subject</label>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={subjectsLoading}>
              <SelectTrigger>
                <SelectValue placeholder={subjectsLoading ? 'Loading…' : 'Select a subject'} />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.categories?.name ? `— ${s.categories.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => setOpen(true)}
            disabled={!subjectId || jobsLoading || jobs.length === 0}
            className="gap-2"
          >
            {jobsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            Open Language Checker {jobs.length ? `(${jobs.length} jobs)` : ''}
          </Button>
        </div>
        {subjectId && !jobsLoading && jobs.length === 0 && (
          <p className="text-sm text-muted-foreground">No video generation jobs for this subject.</p>
        )}
      </Card>

      <CloudLanguageCheckerDialog
        open={open}
        onOpenChange={setOpen}
        jobs={jobs}
        subjectName={subjectName}
        chapters={chapters}
      />
    </div>
  );
}
