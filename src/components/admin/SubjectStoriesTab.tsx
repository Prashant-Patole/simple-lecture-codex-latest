import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Sparkles, Film } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useReelJobs } from "@/hooks/useReelJobs";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";

interface Props {
  subjectId: string;
}

const SERVER_IP = "204.12.237.78";
const TARGET_PORT = 5006;

export function SubjectStoriesTab({ subjectId }: Props) {
  const [storyHint, setStoryHint] = useState("");
  const [grade, setGrade] = useState("Young Adults");
  const [avatarLanguage, setAvatarLanguage] = useState("english");
  const [avatarSpeaker, setAvatarSpeaker] = useState("abhilash");
  const [videoProvider, setVideoProvider] = useState("kie");
  const [submitting, setSubmitting] = useState(false);

  const { data: subject } = useQuery({
    queryKey: ["subject-name", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("popular_subjects")
        .select("id, name")
        .eq("id", subjectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!subjectId,
  });

  const qc = useQueryClient();
  const { data: reelJobs = [] } = useReelJobs(subjectId);
  const storyJobs = useMemo(
    () => reelJobs.filter((j: any) => (j.file_name || "").startsWith("Story:")),
    [reelJobs]
  );

  const wordCount = useMemo(
    () => storyHint.trim().split(/\s+/).filter(Boolean).length,
    [storyHint]
  );
  const wordCountOk = wordCount >= 30 && wordCount <= 100;

  const handleSubmit = async () => {
    if (!storyHint.trim()) {
      toast.error("Please write a story hint");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        action: "submit",
        server_ip: SERVER_IP,
        target_port: TARGET_PORT,
        subject: subject?.name || "General Science",
        grade: grade || "12",
        dry_run: false,
        skip_wan: false,
        skip_avatar: false,
        audio_only: false,
        reel_with_avatar: true,
        tts_provider: "our_tts",
        pipeline_version: "v3",
        generation_scope: "full",
        video_provider: videoProvider,
        ocr_provider: "local",
        skip_threejs: false,
        llm_routing: {
          chunker: "openrouter",
          director: "openrouter",
          manim_renderer: "openrouter",
          remotion_renderer: "openrouter",
          video_renderer: "openrouter",
          prompt_enhancer: "openrouter",
        },
        avatar_language: avatarLanguage,
        avatar_speaker: avatarSpeaker,
        reel_variant: "story",
        story_hint: storyHint.trim(),
      };

      const { data, error } = await supabase.functions.invoke(
        "video-generation-proxy",
        { body: payload }
      );
      if (error) throw new Error(error.message || "Failed to submit story");
      if (data?.error) throw new Error(data.error);
      if (!data?.job_id) throw new Error(data?.message || "No job_id returned");

      const { data: authData } = await supabase.auth.getUser();
      await supabase.from("reel_jobs").insert({
        subject_id: subjectId,
        document_id: null,
        file_name: `Story: ${storyHint.trim().slice(0, 60)}`,
        job_id: data.job_id,
        server_ip: SERVER_IP,
        target_port: TARGET_PORT,
        status: data.status || "queued",
        status_message: data.message || null,
        submitted_by: authData.user?.id || null,
      });
      qc.invalidateQueries({ queryKey: ["reel-jobs", subjectId] });

      toast.success(`Story job submitted: ${data.job_id}`);
      setStoryHint("");
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit story");
    } finally {
      setSubmitting(false);
    }
  };

  const statusVariant = (s: string): "default" | "secondary" | "outline" | "destructive" => {
    if (s === "completed") return "default";
    if (s === "failed" || s === "error") return "destructive";
    if (s === "processing" || s === "accepted" || s === "queued") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Submit Story
          </CardTitle>
          <CardDescription>
            Write a 30–100 word narrative seed. The story pipeline will generate a
            full cinematic video on the configured GPU server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="story_hint">Story hint</Label>
            <Textarea
              id="story_hint"
              value={storyHint}
              onChange={(e) => setStoryHint(e.target.value)}
              rows={6}
              placeholder="In ancient Takshashila, a young student named Arya fails his guru's final test of wisdom and is cast out in shame. Wandering alone through dense forests, he discovers an old hermit's forgotten teaching carved in stone and realizes the answer was inside him all along."
            />
            <div className="flex justify-between text-xs">
              <span className={wordCountOk ? "text-muted-foreground" : "text-destructive"}>
                {wordCount} words {wordCountOk ? "✓" : "(aim for 30–100)"}
              </span>
              <span className="text-muted-foreground">
                Subject: {subject?.name || "—"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="grade">Grade / Audience</Label>
              <Input
                id="grade"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="Young Adults"
              />
            </div>
            <div className="space-y-2">
              <Label>Avatar language</Label>
              <Select value={avatarLanguage} onValueChange={setAvatarLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="hindi">Hindi</SelectItem>
                  <SelectItem value="kannada">Kannada</SelectItem>
                  <SelectItem value="tamil">Tamil</SelectItem>
                  <SelectItem value="telugu">Telugu</SelectItem>
                  <SelectItem value="malayalam">Malayalam</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Avatar speaker</Label>
              <Select value={avatarSpeaker} onValueChange={setAvatarSpeaker}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="abhilash">abhilash</SelectItem>
                  <SelectItem value="anushka">anushka</SelectItem>
                  <SelectItem value="manisha">manisha</SelectItem>
                  <SelectItem value="vidya">vidya</SelectItem>
                  <SelectItem value="arya">arya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Video provider</Label>
              <Select value={videoProvider} onValueChange={setVideoProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kie">kie (default)</SelectItem>
                  <SelectItem value="ltx">ltx (local GPU)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting || !storyHint.trim()}>
              {submitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Submit Story
            </Button>
          </div>
        </CardContent>
      </Card>

      {storyJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Film className="h-4 w-4" /> Story Jobs
            </CardTitle>
            <CardDescription>
              Live status of story jobs submitted for this subject. Auto-refreshes every 5s.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Story</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-[160px]">Progress</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {storyJobs.map((j: any) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium max-w-[240px]">
                      <div className="truncate">{(j.file_name || "").replace(/^Story:\s*/, "")}</div>
                      <div className="text-xs text-muted-foreground truncate">{j.job_id}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(j.status)}>{j.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[320px]">
                      <div className="truncate" title={j.status_message || j.error || ""}>
                        {j.error || j.status_message || "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={j.progress} className="h-2" />
                        <div className="text-xs text-muted-foreground">{j.progress}%</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(j.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
