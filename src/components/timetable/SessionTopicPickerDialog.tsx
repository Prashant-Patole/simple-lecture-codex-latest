import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colorForSubject } from '@/components/timetable/dayStyling';
import type { StudySession } from '@/hooks/useStudyTimetable';

interface TitlesMap {
  subject: Map<string, string>;
  chapter: Map<string, string>;
  topic: Map<string, string>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessions: StudySession[];
  titles: TitlesMap;
  onSelect: (s: StudySession) => void;
}

export const SessionTopicPickerDialog = ({ open, onOpenChange, sessions, titles, onSelect }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose a topic to play</DialogTitle>
          <DialogDescription>This time slot has multiple topics. Pick one to jump into the lecture.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {sessions.map((s) => {
            const subj = s.subject_id ? titles.subject.get(s.subject_id) : undefined;
            const chap = s.chapter_id ? titles.chapter.get(s.chapter_id) : undefined;
            const top = s.topic_id ? titles.topic.get(s.topic_id) : undefined;
            const start = new Date(s.scheduled_at);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => { onSelect(s); onOpenChange(false); }}
                className={cn(
                  'w-full text-left rounded-lg border p-3 hover:shadow-md transition-all flex items-start gap-3',
                  colorForSubject(s.subject_id),
                )}
              >
                <PlayCircle className="h-5 w-5 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{format(start, 'p')}</p>
                  {subj && <p className="text-sm font-medium">{subj}</p>}
                  {chap && <p className="text-xs opacity-80 truncate">{chap}</p>}
                  {top && <p className="text-xs opacity-70 italic truncate">{top}</p>}
                  {!top && s.title && <p className="text-xs opacity-80 truncate">{s.title}</p>}
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SessionTopicPickerDialog;
