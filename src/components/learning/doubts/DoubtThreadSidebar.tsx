import { useState } from "react";
import { Plus, MessageSquare, Trash2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { DoubtThread } from "./doubtThreadsStore";

interface Props {
  threads: DoubtThread[];
  activeThreadId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

const relativeTime = (ts: number) => {
  const diff = Date.now() - ts;
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
};

const ThreadList = ({ threads, activeThreadId, onSelect, onNew, onDelete }: Props) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 border-b">
        <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={onNew}>
          <Plus className="h-4 w-4" /> New doubt
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sorted.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6 px-2">
              No past doubts yet. Ask something to start.
            </p>
          )}
          {sorted.map((t) => {
            const active = t.id === activeThreadId;
            return (
              <div
                key={t.id}
                className={cn(
                  "group flex items-start gap-2 px-2 py-2 rounded-md cursor-pointer text-sm hover:bg-muted transition-colors",
                  active && "bg-muted"
                )}
                onClick={() => onSelect(t.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[13px] leading-tight">{t.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {relativeTime(t.updatedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmId(t.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                  aria-label="Delete doubt thread"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this doubt?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the conversation from this device.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmId) onDelete(confirmId);
                setConfirmId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export const DoubtThreadSidebar = (props: Props) => {
  return (
    <div className="hidden md:flex w-[240px] shrink-0 border-r flex-col bg-muted/20 rounded-l-xl">
      <ThreadList {...props} />
    </div>
  );
};

export const DoubtThreadMobileTrigger = (props: Props) => {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost" className="md:hidden gap-1 h-7 px-2">
          <History className="h-3.5 w-3.5" />
          <span className="text-xs">History</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetHeader className="p-3 border-b">
          <SheetTitle className="text-sm">Your doubts</SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100%-3.5rem)]">
          <ThreadList
            {...props}
            onSelect={(id) => {
              props.onSelect(id);
              setOpen(false);
            }}
            onNew={() => {
              props.onNew();
              setOpen(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};
