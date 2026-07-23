import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { V4_PROXY_BASE } from "@/components/learning/v4/constants";

const KNOWN_ORIGINS: Array<{ ip: string; port: number; label: string }> = [
  { ip: "204.12.237.78", port: 5006, label: "204.12.237.78:5006" },
  { ip: "69.197.145.4", port: 5006, label: "69.197.145.4:5006" },
];

interface Props {
  reelJobRowId: string;
  externalJobId: string;
  subjectId: string;
  currentIp: string | null;
  currentPort: number | null;
}

export function ReelJobRebindDialog({
  reelJobRowId,
  externalJobId,
  subjectId,
  currentIp,
  currentPort,
}: Props) {
  const [open, setOpen] = useState(false);
  const [ip, setIp] = useState(currentIp || "204.12.237.78");
  const [port, setPort] = useState<string>(String(currentPort ?? 5006));
  const [saving, setSaving] = useState(false);
  const [probing, setProbing] = useState(false);
  const qc = useQueryClient();

  const save = async (nextIp: string, nextPort: number) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("reel_jobs")
        .update({ server_ip: nextIp, target_port: nextPort })
        .eq("id", reelJobRowId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["reel-jobs", subjectId] });
      qc.invalidateQueries({ queryKey: ["reel-job-manifest", externalJobId] });
      qc.invalidateQueries({ queryKey: ["published-reels-for-job", externalJobId] });
      toast.success(`Rebound to ${nextIp}:${nextPort}`);
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Failed to rebind");
    } finally {
      setSaving(false);
    }
  };

  const autoDetect = async () => {
    setProbing(true);
    try {
      for (const o of KNOWN_ORIGINS) {
        try {
          const res = await fetch(
            `${V4_PROXY_BASE}/job/${externalJobId}/reels?__ip=${encodeURIComponent(o.ip)}&__port=${o.port}`,
          );
          if (!res.ok) continue;
          const json = await res.json();
          if (json?.reels?.length) {
            setIp(o.ip);
            setPort(String(o.port));
            await save(o.ip, o.port);
            return;
          }
        } catch {
          // try next
        }
      }
      toast.error("No known origin returned a manifest for this job.");
    } finally {
      setProbing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 px-2" title="Rebind server IP/port">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rebind reel job server</DialogTitle>
          <DialogDescription className="text-xs">
            Point this job at the IP/port where it actually ran. Only updates the
            row — the upstream submission is unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {KNOWN_ORIGINS.map((o) => (
              <Button
                key={o.label}
                size="sm"
                variant={ip === o.ip && Number(port) === o.port ? "default" : "outline"}
                onClick={() => {
                  setIp(o.ip);
                  setPort(String(o.port));
                }}
              >
                {o.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">IP</Label>
              <Input value={ip} onChange={(e) => setIp(e.target.value.trim())} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Port</Label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value.trim())}
              />
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="w-full gap-2"
            onClick={autoDetect}
            disabled={probing || saving}
          >
            {probing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            Auto-detect from known origins
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const p = Number(port);
              if (!ip || !Number.isFinite(p) || p <= 0) {
                toast.error("Enter a valid IP and port.");
                return;
              }
              save(ip, p);
            }}
            disabled={saving}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
