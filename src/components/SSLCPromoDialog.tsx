import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GraduationCap, Sparkles, BookOpen, Target } from "lucide-react";
import { safeSessionStorage } from "@/lib/safeStorage";

export const SSLCPromoDialog = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const sessionKey = "sslc-promo-dismissed";

  useEffect(() => {
    if (safeSessionStorage.getItem(sessionKey)) return;
    const timer = setTimeout(() => setOpen(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setOpen(false);
    safeSessionStorage.setItem(sessionKey, "1");
  };

  const handleJoin = () => {
    handleDismiss();
    navigate("/course/Class-10");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent className="max-w-[320px] border-0 bg-gradient-to-br from-primary/5 via-background to-accent/10 shadow-2xl p-3">
        <DialogHeader className="text-center space-y-1.5">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <GraduationCap className="h-4 w-4 text-primary" />
          </div>
          <DialogTitle className="text-base font-bold tracking-tight">
            Board Exam Success Starts Here 🚀
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">Top your SSLC Exams</span> with AI-powered learning.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5 py-1.5">
          {[
            { icon: Sparkles, text: "24/7 AI Tutoring" },
            { icon: BookOpen, text: "All subjects with video lessons" },
            { icon: Target, text: "Practice tests & past papers" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
              <Icon className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{text}</span>
            </div>
          ))}
        </div>

        <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900 leading-relaxed">
          <span className="font-semibold">Note:</span> Expect 70–80% questions from our Model Papers.
        </div>

        <Button
          onClick={handleJoin}
          className="w-full mt-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-9 rounded-xl shadow-lg"
        >
          Join SSLC Board Course →
        </Button>
      </DialogContent>
    </Dialog>
  );
};
