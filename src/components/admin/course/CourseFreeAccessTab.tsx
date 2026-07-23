import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { Save, Sparkles, BookOpen, Brain, MessageCircleQuestion } from "lucide-react";
import { useCourseSubjects } from "@/hooks/useCourseSubjects";
import { useSubjectChapters } from "@/hooks/useLearningCourse";
import {
  useCourseFreeAccess,
  useCourseFreePreviewLimits,
  useSaveCourseFreeAccess,
} from "@/hooks/useCourseFreeAccess";

interface Props {
  courseId?: string;
}

function SubjectChaptersBlock({
  subjectId,
  selectedChapterIds,
  onToggle,
}: {
  subjectId: string;
  selectedChapterIds: Set<string>;
  onToggle: (subjectId: string, chapterId: string, checked: boolean) => void;
}) {
  const { data: chapters, isLoading } = useSubjectChapters(subjectId);

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!chapters || chapters.length === 0)
    return (
      <p className="text-sm text-muted-foreground py-2">
        No chapters in this subject yet.
      </p>
    );

  return (
    <div className="space-y-2">
      {chapters.map((ch) => (
        <label
          key={ch.id}
          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
        >
          <Checkbox
            checked={selectedChapterIds.has(ch.id)}
            onCheckedChange={(c) => onToggle(subjectId, ch.id, !!c)}
          />
          <span className="text-sm">
            Ch {ch.chapter_number}: {ch.title}
          </span>
        </label>
      ))}
    </div>
  );
}

export function CourseFreeAccessTab({ courseId }: Props) {
  const { data: courseSubjects, isLoading: subjectsLoading } =
    useCourseSubjects(courseId);
  const { data: existing, isLoading: existingLoading } =
    useCourseFreeAccess(courseId);
  const { data: limits, isLoading: limitsLoading } =
    useCourseFreePreviewLimits(courseId);
  const save = useSaveCourseFreeAccess(courseId);

  // Map<subjectId, Set<chapterId>>
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [aiLimit, setAiLimit] = useState<number>(0);
  const [doubtsLimit, setDoubtsLimit] = useState<number>(0);

  useEffect(() => {
    if (!existing) return;
    const next: Record<string, Set<string>> = {};
    for (const row of existing) {
      if (!next[row.subject_id]) next[row.subject_id] = new Set();
      next[row.subject_id].add(row.chapter_id);
    }
    setSelected(next);
  }, [existing]);

  useEffect(() => {
    if (!limits) return;
    setAiLimit(limits.ai);
    setDoubtsLimit(limits.doubts);
  }, [limits]);

  const toggle = (subjectId: string, chapterId: string, checked: boolean) => {
    setSelected((prev) => {
      const set = new Set(prev[subjectId] || []);
      if (checked) set.add(chapterId);
      else set.delete(chapterId);
      return { ...prev, [subjectId]: set };
    });
  };

  const totalSelected = useMemo(
    () =>
      Object.values(selected).reduce((sum, s) => sum + s.size, 0),
    [selected],
  );

  const handleSave = () => {
    const flat: { subjectId: string; chapterId: string }[] = [];
    for (const [subjectId, set] of Object.entries(selected)) {
      for (const chapterId of set) flat.push({ subjectId, chapterId });
    }
    save.mutate({
      selections: flat,
      limits: { ai: aiLimit, doubts: doubtsLimit },
    });
  };

  if (!courseId) {
    return (
      <p className="text-muted-foreground">
        Save the course first to manage free access.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Free preview chapters</p>
            <p className="text-muted-foreground">
              Pick chapters students can access for free before buying. Selected
              chapters appear unlocked in the preview; all other chapters show a
              "Purchase required" dialog.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div>
            <p className="font-semibold text-sm mb-1">Preview question quotas</p>
            <p className="text-xs text-muted-foreground">
              How many questions a free-preview student may ask before being
              prompted to purchase. Set to 0 to disable that tab in preview.
            </p>
          </div>
          {limitsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ai-limit" className="flex items-center gap-2 text-sm">
                  <Brain className="h-4 w-4 text-primary" />
                  AI tab — questions allowed
                </Label>
                <Input
                  id="ai-limit"
                  type="number"
                  min={0}
                  value={aiLimit}
                  onChange={(e) => setAiLimit(parseInt(e.target.value || "0", 10))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="doubts-limit" className="flex items-center gap-2 text-sm">
                  <MessageCircleQuestion className="h-4 w-4 text-primary" />
                  Doubts tab — questions allowed
                </Label>
                <Input
                  id="doubts-limit"
                  type="number"
                  min={0}
                  value={doubtsLimit}
                  onChange={(e) =>
                    setDoubtsLimit(parseInt(e.target.value || "0", 10))
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {subjectsLoading || existingLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !courseSubjects || courseSubjects.length === 0 ? (
        <p className="text-muted-foreground">
          Add subjects to this course first (Subjects tab).
        </p>
      ) : (
        <Accordion type="multiple" className="border rounded-lg divide-y">
          {courseSubjects.map((cs: any) => {
            const subject = cs.subject;
            if (!subject) return null;
            const count = selected[subject.id]?.size || 0;
            return (
              <AccordionItem key={subject.id} value={subject.id} className="px-4">
                <AccordionTrigger>
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="font-medium">{subject.name}</span>
                    {count > 0 && (
                      <span className="ml-2 text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                        {count} free
                      </span>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <SubjectChaptersBlock
                    subjectId={subject.id}
                    selectedChapterIds={selected[subject.id] || new Set()}
                    onToggle={toggle}
                  />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">
          {totalSelected} chapter{totalSelected === 1 ? "" : "s"} selected
        </p>
        <Button onClick={handleSave} disabled={save.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {save.isPending ? "Saving..." : "Save free access"}
        </Button>
      </div>
    </div>
  );
}
