import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clipboard,
  Download,
  ExternalLink,
  Film,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  UserCircle,
  Volume2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface DynamicAvatar {
  id: string;
  name?: string;
  video_url?: string;
  audio_url?: string;
  created_at?: string;
}

interface UploadResponse {
  success?: boolean;
  avatar_id?: string;
  name?: string;
  video_path?: string;
  audio_path?: string;
  error?: string;
}

interface GenerateResponse {
  success?: boolean;
  task_id?: string;
  message?: string;
  status_url?: string;
  error?: string;
}

const DEFAULT_BASE_URL = "http://69.197.145.4:5004";
const LANGUAGES = ["english", "kannada", "hindi", "bengali", "tamil", "telugu", "malayalam", "marathi", "gujarati", "punjabi", "odia", "assamese"];
const SPEAKERS = ["abhilash", "vidya", "manisha", "karun", "hitesh", "anushka", "arya"];

function cleanBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function buildUrl(baseUrl: string, path: string) {
  return `${cleanBaseUrl(baseUrl)}${path}`;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed with ${response.status}`);
  }

  return data as T;
}

export default function CounselorAvatars() {
  const { toast } = useToast();
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem("dynamicAvatarBaseUrl") || DEFAULT_BASE_URL);
  const [health, setHealth] = useState<any>(null);
  const [queue, setQueue] = useState<any>(null);
  const [avatars, setAvatars] = useState<DynamicAvatar[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [avatarName, setAvatarName] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [lastUpload, setLastUpload] = useState<UploadResponse | null>(null);
  const [selectedAvatarId, setSelectedAvatarId] = useState("");
  const [testText, setTestText] = useState("Hello, this is a quick dynamic avatar test from SimpleLecture.");
  const [language, setLanguage] = useState("english");
  const [speaker, setSpeaker] = useState("abhilash");
  const [ttsEngine, setTtsEngine] = useState("voxcpm");
  const [emotion, setEmotion] = useState("neutral");
  const [lastTask, setLastTask] = useState<GenerateResponse | null>(null);
  const [taskStatus, setTaskStatus] = useState<any>(null);

  const normalizedBaseUrl = useMemo(() => cleanBaseUrl(baseUrl), [baseUrl]);

  const saveBaseUrl = () => {
    localStorage.setItem("dynamicAvatarBaseUrl", normalizedBaseUrl);
    toast({ title: "Avatar server saved", description: normalizedBaseUrl });
  };

  const copyText = async (text: string, label = "Copied") => {
    await navigator.clipboard.writeText(text);
    toast({ title: label });
  };

  const loadServerData = async () => {
    setLoading(true);
    try {
      const [healthResult, queueResult, libraryResult] = await Promise.allSettled([
        fetch(buildUrl(normalizedBaseUrl, "/api/health")).then((r) => parseJsonResponse<any>(r)),
        fetch(buildUrl(normalizedBaseUrl, "/api/queue")).then((r) => parseJsonResponse<any>(r)),
        fetch(buildUrl(normalizedBaseUrl, "/api/library/list")).then((r) => parseJsonResponse<{ avatars?: DynamicAvatar[] }>(r)),
      ]);

      if (healthResult.status === "fulfilled") setHealth(healthResult.value);
      if (queueResult.status === "fulfilled") setQueue(queueResult.value);
      if (libraryResult.status === "fulfilled") setAvatars(libraryResult.value.avatars || []);

      const failed = [healthResult, queueResult, libraryResult].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (failed) {
        toast({
          title: "Some avatar server data could not load",
          description: failed.reason?.message || "Check the server URL and CORS/network access.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async () => {
    if (!videoFile) {
      toast({ title: "Select an avatar video first", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("video", videoFile);
      if (audioFile) form.append("audio", audioFile);
      if (avatarName.trim()) form.append("name", avatarName.trim());

      const data = await fetch(buildUrl(normalizedBaseUrl, "/api/library/upload"), {
        method: "POST",
        body: form,
      }).then((r) => parseJsonResponse<UploadResponse>(r));

      setLastUpload(data);
      if (data.avatar_id) setSelectedAvatarId(data.avatar_id);
      toast({ title: "Avatar uploaded", description: data.avatar_id ? `avatar_id: ${data.avatar_id}` : "Upload completed." });
      setVideoFile(null);
      setAudioFile(null);
      setAvatarName("");
      await loadServerData();
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (avatarId: string) => {
    if (!window.confirm(`Delete avatar ${avatarId}?`)) return;

    try {
      await fetch(buildUrl(normalizedBaseUrl, `/api/library/delete/${encodeURIComponent(avatarId)}`), {
        method: "DELETE",
      }).then((r) => parseJsonResponse<any>(r));
      toast({ title: "Avatar deleted" });
      if (selectedAvatarId === avatarId) setSelectedAvatarId("");
      await loadServerData();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
  };

  const handleGenerate = async () => {
    if (!testText.trim()) {
      toast({ title: "Enter narration text", variant: "destructive" });
      return;
    }

    setGenerating(true);
    setTaskStatus(null);
    try {
      const form = new FormData();
      form.append("text", testText.trim());
      if (selectedAvatarId) form.append("avatar_id", selectedAvatarId);
      form.append("language", language);
      form.append("speaker", speaker);
      form.append("tts_engine", ttsEngine);
      form.append("emotion", emotion);

      const data = await fetch(buildUrl(normalizedBaseUrl, "/api/generate"), {
        method: "POST",
        body: form,
      }).then((r) => parseJsonResponse<GenerateResponse>(r));

      setLastTask(data);
      toast({ title: "Avatar generation queued", description: data.task_id ? `task_id: ${data.task_id}` : data.message });
    } catch (error: any) {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const checkTaskStatus = async () => {
    if (!lastTask?.task_id) return;

    try {
      const data = await fetch(buildUrl(normalizedBaseUrl, `/api/status/${encodeURIComponent(lastTask.task_id)}`)).then((r) => parseJsonResponse<any>(r));
      setTaskStatus(data);
    } catch (error: any) {
      toast({ title: "Status check failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dynamic Avatars</h1>
        <p className="text-muted-foreground">Upload HeyGem/Chatterbox avatar videos, copy avatar IDs, and test generation from the admin panel.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Avatar Server
          </CardTitle>
          <CardDescription>Doc default is localhost:5004. For this admin panel, use the reachable server IP with port 5004.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="http://69.197.145.4:5004" />
            <Button variant="outline" onClick={saveBaseUrl}>Save</Button>
            <Button onClick={loadServerData} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Health</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant={health?.status === "healthy" ? "default" : "secondary"}>{health?.status || "unknown"}</Badge>
                <span className="text-sm">{health?.service || "Not loaded"}</span>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Queue</p>
              <p className="mt-1 text-sm font-medium">{queue?.queue_size ?? "-"} queued task(s)</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Library</p>
              <p className="mt-1 text-sm font-medium">{avatars.length} saved avatar(s)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Avatar To Library
            </CardTitle>
            <CardDescription>Calls POST /api/library/upload and returns an avatar_id for reuse.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Display name</Label>
              <Input value={avatarName} onChange={(e) => setAvatarName(e.target.value)} placeholder="My Kannada avatar" />
            </div>
            <div className="space-y-2">
              <Label>Avatar video MP4 *</Label>
              <Input type="file" accept="video/mp4,video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
              {videoFile && <p className="text-xs text-muted-foreground">{videoFile.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>Reference audio WAV (optional)</Label>
              <Input type="file" accept="audio/wav,audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
              {audioFile && <p className="text-xs text-muted-foreground">{audioFile.name}</p>}
            </div>
            <Button onClick={handleUpload} disabled={uploading || !videoFile} className="w-full">
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload And Get Avatar ID
            </Button>

            {lastUpload?.avatar_id && (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm font-medium">Latest avatar_id</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-2 py-1 text-xs">{lastUpload.avatar_id}</code>
                  <Button size="sm" variant="outline" onClick={() => copyText(lastUpload.avatar_id!, "Avatar ID copied")}>
                    <Clipboard className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-5 w-5" />
              Test Generate Video
            </CardTitle>
            <CardDescription>Calls POST /api/generate using a library avatar_id and narration text.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Avatar ID</Label>
              <Input value={selectedAvatarId} onChange={(e) => setSelectedAvatarId(e.target.value)} placeholder="avatar_id from library upload" />
            </div>
            <div className="space-y-2">
              <Label>Narration text *</Label>
              <Textarea value={testText} onChange={(e) => setTestText(e.target.value)} rows={4} />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Speaker</Label>
                <Select value={speaker} onValueChange={setSpeaker}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SPEAKERS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>TTS</Label>
                <Select value={ttsEngine} onValueChange={setTtsEngine}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="voxcpm">voxcpm</SelectItem>
                    <SelectItem value="chatterbox">chatterbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Emotion</Label>
              <Select value={emotion} onValueChange={setEmotion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["neutral", "happy", "sad", "angry", "surprised"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleGenerate} disabled={generating}>
                {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Film className="mr-2 h-4 w-4" />}
                Queue Test Video
              </Button>
              <Button variant="outline" onClick={checkTaskStatus} disabled={!lastTask?.task_id}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Check Status
              </Button>
              {lastTask?.task_id && (
                <Button variant="outline" asChild>
                  <a href={buildUrl(normalizedBaseUrl, `/api/download/${lastTask.task_id}`)} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </a>
                </Button>
              )}
            </div>
            {lastTask?.task_id && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p><span className="font-medium">task_id:</span> <code>{lastTask.task_id}</code></p>
                <p><span className="font-medium">status:</span> {taskStatus?.status || "not checked"}</p>
                {taskStatus?.error && <p className="text-destructive">{taskStatus.error}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Avatar Library
            </span>
            <Button variant="outline" size="sm" onClick={loadServerData} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>Calls GET /api/library/list. Use avatar_id from this list in generation payloads.</CardDescription>
        </CardHeader>
        <CardContent>
          {avatars.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">No dynamic avatars found on this server.</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {avatars.map((avatar) => {
                const videoUrl = avatar.video_url?.startsWith("http") ? avatar.video_url : buildUrl(normalizedBaseUrl, avatar.video_url || `/library/${avatar.id}/source.mp4`);
                const audioUrl = avatar.audio_url?.startsWith("http") ? avatar.audio_url : buildUrl(normalizedBaseUrl, avatar.audio_url || `/library/${avatar.id}/audio.wav`);

                return (
                  <div key={avatar.id} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{avatar.name || "Untitled Avatar"}</p>
                        <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">{avatar.id}</code>
                        {avatar.created_at && <p className="mt-1 text-xs text-muted-foreground">{new Date(avatar.created_at).toLocaleString()}</p>}
                      </div>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(avatar.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyText(avatar.id, "Avatar ID copied")}>
                        <Clipboard className="mr-2 h-4 w-4" />
                        Copy ID
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedAvatarId(avatar.id)}>
                        Use In Test
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={videoUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Video
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={audioUrl} target="_blank" rel="noreferrer">
                          <Volume2 className="mr-2 h-4 w-4" />
                          Audio
                        </a>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
