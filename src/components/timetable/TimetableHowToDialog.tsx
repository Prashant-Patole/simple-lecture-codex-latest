import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  HelpCircle,
  CalendarDays,
  BookOpen,
  Wand2,
  ListChecks,
  Pencil,
  GraduationCap,
  Lightbulb,
  LifeBuoy,
  Clock,
  Bell,
  Target,
  BarChart3,
} from 'lucide-react';

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  what: string;
  how: string;
  example: string;
};

const StepsList = ({ steps }: { steps: Step[] }) => (
  <>
    {steps.map((s, i) => {
      const Icon = s.icon;
      return (
        <div key={i} className="rounded-lg border p-4 space-y-2">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="font-semibold text-sm">{s.title}</h4>
              <p className="text-sm text-foreground">
                <span className="font-medium">What: </span>
                {s.what}
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">How: </span>
                {s.how}
              </p>
              <p className="text-xs text-muted-foreground italic">{s.example}</p>
            </div>
          </div>
        </div>
      );
    })}
  </>
);

const TipsBlock = ({ tips }: { tips: string[] }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <Lightbulb className="h-4 w-4 text-primary" />
      <h4 className="font-semibold text-sm">Quick tips</h4>
    </div>
    <ul className="space-y-1.5">
      {tips.map((t, i) => (
        <li key={i} className="text-sm text-muted-foreground flex gap-2">
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] shrink-0">
            {i + 1}
          </Badge>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  </div>
);

const HelpFooter = () => (
  <div className="rounded-lg bg-muted p-3 text-sm flex items-start gap-2">
    <LifeBuoy className="h-4 w-4 text-primary mt-0.5 shrink-0" />
    <div>
      <span className="font-medium text-foreground">Need more help?</span>{' '}
      <span className="text-muted-foreground">
        Reach out via the Support page or post in the Forum — we usually reply within a few hours.
      </span>
    </div>
  </div>
);

/* ---------------- Time Table Guide ---------------- */

const timetableSteps: Step[] = [
  {
    icon: CalendarDays,
    title: 'Step 1 — Pick your exam date',
    what: 'Tell the planner when your final exam is.',
    how: 'Open the "Exam Date" picker at the top and choose the date. The planner counts the days left and splits study evenly.',
    example: 'Exam on 25 Dec → planner gives you daily targets till that date.',
  },
  {
    icon: BookOpen,
    title: 'Step 2 — Select your subjects',
    what: 'Choose which courses you want to study.',
    how: 'Tick the subjects from your enrolled courses. You can add or remove them anytime.',
    example: 'Pick Physics + Maths only if those are your weak areas.',
  },
  {
    icon: Wand2,
    title: 'Step 3 — Generate the plan',
    what: 'Let AI build a day-by-day schedule for you.',
    how: 'Click "Generate Timetable". AI balances chapters, revision and rest days automatically.',
    example: 'You will see slots like "Mon 6–7 PM: Physics – Kinematics".',
  },
  {
    icon: ListChecks,
    title: "Step 4 — Use it daily",
    what: "Check today's tasks and mark them done.",
    how: 'Open the "Today" tab. Tap ✓ on each slot as you finish it. Your progress bar updates automatically.',
    example: 'Finished 3 of 4 tasks today? You will see 75% progress.',
  },
  {
    icon: Pencil,
    title: 'Step 5 — Edit or reschedule',
    what: 'Move things around when life happens.',
    how: 'Click any slot to edit time, subject, or delete it. Hit "Regenerate" to rebuild the plan from today onwards.',
    example: 'Missed a day? Just regenerate — AI will adjust the rest.',
  },
];

const timetableTips = [
  'Study at the same time every day — consistency beats long hours.',
  'Take a 10-min break after every 50 min of study.',
  'Keep 1 day per week only for revision, no new topics.',
];

export const TimetableHowToDialog = () => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">How to Use Time Table</span>
          <span className="sm:hidden">Time Table</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <HelpCircle className="h-5 w-5 text-primary" />
            How to use your Time Table
          </DialogTitle>
          <DialogDescription>
            A simple step-by-step guide to plan your daily study and stay on track.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">What is this page?</span>{' '}
            Your personal study planner. It tells you what to study and when, all the way till your exam day.
          </div>
          <StepsList steps={timetableSteps} />
          <Separator />
          <TipsBlock tips={timetableTips} />
          <HelpFooter />
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ---------------- Schedule Test Guide ---------------- */

const testSteps: Step[] = [
  {
    icon: GraduationCap,
    title: 'Step 1 — Open "Add Slot"',
    what: 'Start a new test entry on your timetable.',
    how: 'Click the "Add Slot" button on the timetable page and select type "Mock Exam / Test".',
    example: 'You can also long-press any empty slot on the calendar to add a test there.',
  },
  {
    icon: CalendarDays,
    title: 'Step 2 — Pick date & start time',
    what: 'Choose when the test will begin.',
    how: 'Select the date from the calendar and set the start time (e.g. 10:00 AM).',
    example: 'Sunday 10:00 AM is a popular slot for full-length mocks.',
  },
  {
    icon: Clock,
    title: 'Step 3 — Set the duration',
    what: 'Decide how long the test will run.',
    how: 'Pick a preset (1h, 2h, 3h) or enter a custom duration.',
    example: 'Subject test → 1h. Full mock → 3h.',
  },
  {
    icon: Target,
    title: 'Step 4 — Choose subject / chapters',
    what: 'Tell the system what the test will cover.',
    how: 'Select a subject and (optionally) specific chapters. Leave blank for a full syllabus mock.',
    example: 'Physics → Chapters 1–5 for a unit test.',
  },
  {
    icon: Bell,
    title: 'Step 5 — Turn on reminders',
    what: "Don't miss the test you scheduled.",
    how: 'Enable email and push reminders. You will be alerted 1 day before and 30 mins before the test.',
    example: 'Reminder pings you at 9:30 AM for a 10:00 AM test.',
  },
  {
    icon: BarChart3,
    title: 'Step 6 — Take it & review results',
    what: 'Sit the test on time, then check your score.',
    how: 'At the scheduled time, the test opens automatically. After submitting, view your score and weak areas in "My Tests".',
    example: 'Scored 60% in Physics? Add an extra revision slot for that subject.',
  },
];

const testTips = [
  'Schedule one mock test every week — it builds exam confidence.',
  'Take at least 3 full-length mocks before the real exam.',
  'Always review wrong answers the same day — that is where real learning happens.',
  'Treat every mock like the real exam: no phone, no breaks, strict timing.',
];

export const ScheduleTestHowToDialog = () => {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <GraduationCap className="h-4 w-4" />
          <span className="hidden sm:inline">How to Schedule a Test</span>
          <span className="sm:hidden">Schedule Test</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <GraduationCap className="h-5 w-5 text-primary" />
            How to schedule a test
          </DialogTitle>
          <DialogDescription>
            A simple guide to add mock exams and practice tests to your timetable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Why schedule tests?</span>{' '}
            Regular mock tests reveal weak areas, improve speed, and reduce exam-day anxiety.
          </div>
          <StepsList steps={testSteps} />
          <Separator />
          <TipsBlock tips={testTips} />
          <HelpFooter />
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
