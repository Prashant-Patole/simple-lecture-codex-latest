import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { toast } from "sonner";
import { Sparkles, Save, Bot, Zap, Cloud, Cpu, Volume2, Globe, UserCheck, ShieldAlert } from "lucide-react";

export interface MarketingPayloadConfig {
  avatar_id: string;
  /** null = "None of these" — no multi-language dubbing list in payload */
  target_languages: string[] | null;
  avatar_speaker: string;
  avatar_language: string;
  tts_engine: "default" | "sarvam" | "indicf5";
  llm_routing: Record<string, string>;
}

interface Props {
  subjectId: string;
  subjectName: string;
  onChange?: (config: MarketingPayloadConfig) => void;
}

export const TARGET_LANGUAGES_LIST = [
  { code: "hindi", name: "Hindi", flagText: "IN" },
  { code: "bengali", name: "Bengali", flagText: "IN" },
  { code: "gujarati", name: "Gujarati", flagText: "IN" },
  { code: "kannada", name: "Kannada", flagText: "IN" },
  { code: "malayalam", name: "Malayalam", flagText: "IN" },
  { code: "marathi", name: "Marathi", flagText: "IN" },
  { code: "odia", name: "Odia", flagText: "IN" },
  { code: "punjabi", name: "Punjabi", flagText: "IN" },
  { code: "tamil", name: "Tamil", flagText: "IN" },
  { code: "telugu", name: "Telugu", flagText: "IN" },
  { code: "assamese", name: "Assamese (অসমীয়া)", flagText: "IN" },
];

export const AVATAR_LANGUAGE_OPTIONS = [
  { code: "english", name: "English" },
  ...TARGET_LANGUAGES_LIST.map(({ code, name }) => ({ code, name })),
];

export const TTS_ENGINE_OPTIONS = [
  {
    id: "default" as const,
    name: "Default (VoxCPM / English)",
    hint: "No tts_engine sent — backend default for English",
  },
  {
    id: "sarvam" as const,
    name: "Sarvam TTS",
    hint: "Requires a speaker voice (e.g. abhilash)",
  },
  {
    id: "indicf5" as const,
    name: "IndicF5 (voice clone)",
    hint: "Uses avatar reference audio; speaker is suppressed downstream",
  },
];

export const VOICE_OPTIONS = [
  { id: "abhilash", name: "Abhilash — Clear, Professional (M)" },
  { id: "karun", name: "Karun — Warm, Friendly (M)" },
  { id: "hitesh", name: "Hitesh — Energetic, Youthful (M)" },
  { id: "anushka", name: "Anushka — Soft, Gentle (F)" },
  { id: "manisha", name: "Manisha — Professional, Clear (F)" },
  { id: "vidya", name: "Vidya — Warm, Expressive (F)" },
  { id: "arya", name: "Arya — Young, Energetic (F)" },
];

export const DEFAULT_LLM_ROUTING: Record<string, string> = {
  chunker: "local",
  director: "local",
  manim_renderer: "openrouter",
  remotion_renderer: "local",
  video_renderer: "local",
  prompt_enhancer: "local",
  story_enhancer: "local",
};

export function MarketingPayloadConfigCard({ subjectId, subjectName, onChange }: Props) {
  const queryClient = useQueryClient();

  // State for payload options
  const [avatarId, setAvatarId] = useState<string>("");
  const [targetLanguages, setTargetLanguages] = useState<string[]>(["kannada", "hindi"]);
  const [voice, setVoice] = useState<string>("abhilash");
  const [avatarLanguage, setAvatarLanguage] = useState<string>("english");
  const [ttsEngine, setTtsEngine] = useState<"default" | "sarvam" | "indicf5">("default");
  const [llmRouting, setLlmRouting] = useState<Record<string, string>>(DEFAULT_LLM_ROUTING);

  // Confirmation dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSaveConfig, setPendingSaveConfig] = useState<MarketingPayloadConfig | null>(null);

  // 1. Fetch Subject from DB to get saved avatar_id
  const { data: subjectData } = useQuery({
    queryKey: ["popular-subject-avatar", subjectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("popular_subjects")
        .select("id, name, avatar_id")
        .eq("id", subjectId)
        .maybeSingle();
      if (error) console.error("Error fetching subject avatar_id:", error);
      return data;
    },
    enabled: !!subjectId,
  });

  // 2. Fetch saved Marketing Config from ai_settings
  const { data: savedAiSetting } = useQuery({
    queryKey: ["marketing-payload-setting", subjectId],
    queryFn: async () => {
      const settingKey = `marketing_payload_config_${subjectId}`;
      const { data, error } = await supabase
        .from("ai_settings")
        .select("setting_value")
        .eq("setting_key", settingKey)
        .maybeSingle();
      if (error) console.error("Error fetching ai_settings:", error);
      return data?.setting_value as MarketingPayloadConfig | null;
    },
    enabled: !!subjectId,
  });

  // Populate state on load
  useEffect(() => {
    if (savedAiSetting) {
      if (savedAiSetting.avatar_id) setAvatarId(savedAiSetting.avatar_id);
      else if (subjectData?.avatar_id) setAvatarId(subjectData.avatar_id);

      if (Array.isArray(savedAiSetting.target_languages)) {
        setTargetLanguages(savedAiSetting.target_languages);
      } else if (savedAiSetting.target_languages === null) {
        setTargetLanguages([]);
      }
      if (savedAiSetting.avatar_speaker) setVoice(savedAiSetting.avatar_speaker);
      if (savedAiSetting.avatar_language) setAvatarLanguage(savedAiSetting.avatar_language);
      if (savedAiSetting.tts_engine === "sarvam" || savedAiSetting.tts_engine === "indicf5" || savedAiSetting.tts_engine === "default") {
        setTtsEngine(savedAiSetting.tts_engine);
      }
      if (savedAiSetting.llm_routing) setLlmRouting({ ...DEFAULT_LLM_ROUTING, ...savedAiSetting.llm_routing });
    } else if (subjectData?.avatar_id) {
      setAvatarId(subjectData.avatar_id);
    }
  }, [savedAiSetting, subjectData]);

  // Sync back to parent whenever local state updates
  useEffect(() => {
    if (onChange) {
      onChange({
        avatar_id: avatarId,
        target_languages: targetLanguages.length > 0 ? targetLanguages : null,
        avatar_speaker: voice,
        avatar_language: avatarLanguage,
        tts_engine: ttsEngine,
        llm_routing: llmRouting,
      });
    }
  }, [avatarId, targetLanguages, voice, avatarLanguage, ttsEngine, llmRouting, onChange]);

  // Save Config Mutation with confirmation
  const saveConfigMutation = useMutation({
    mutationFn: async (newConfig: MarketingPayloadConfig) => {
      const settingKey = `marketing_payload_config_${subjectId}`;

      // Update ai_settings
      const { error: aiError } = await supabase
        .from("ai_settings")
        .upsert(
          {
            setting_key: settingKey,
            setting_value: newConfig as any,
            description: `Marketing payload config for subject ${subjectName} (${subjectId})`,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "setting_key" }
        );
      if (aiError) throw aiError;

      // Update popular_subjects avatar_id if changed
      if (newConfig.avatar_id) {
        const { error: subError } = await supabase
          .from("popular_subjects")
          .update({ avatar_id: newConfig.avatar_id })
          .eq("id", subjectId);
        if (subError) console.warn("Failed to update popular_subjects.avatar_id:", subError);
      }
    },
    onSuccess: () => {
      toast.success(`Saved default marketing payload settings for ${subjectName}!`);
      queryClient.invalidateQueries({ queryKey: ["marketing-payload-setting", subjectId] });
      queryClient.invalidateQueries({ queryKey: ["popular-subject-avatar", subjectId] });
    },
    onError: (err: any) => {
      toast.error(`Failed to save settings: ${err.message || String(err)}`);
    },
  });

  const handleRequestSave = (newConfig?: Partial<MarketingPayloadConfig>) => {
    const langs = newConfig?.target_languages !== undefined
      ? newConfig.target_languages
      : (targetLanguages.length > 0 ? targetLanguages : null);
    const configToSave: MarketingPayloadConfig = {
      avatar_id: newConfig?.avatar_id ?? avatarId,
      target_languages: langs,
      avatar_speaker: newConfig?.avatar_speaker ?? voice,
      avatar_language: newConfig?.avatar_language ?? avatarLanguage,
      tts_engine: newConfig?.tts_engine ?? ttsEngine,
      llm_routing: newConfig?.llm_routing ?? llmRouting,
    };
    setPendingSaveConfig(configToSave);
    setConfirmOpen(true);
  };

  const handleConfirmSave = () => {
    if (pendingSaveConfig) {
      saveConfigMutation.mutate(pendingSaveConfig);
    }
    setConfirmOpen(false);
  };

  const toggleLanguage = (code: string) => {
    let next: string[];
    if (targetLanguages.includes(code)) {
      next = targetLanguages.filter((l) => l !== code);
    } else {
      next = [...targetLanguages, code];
    }
    setTargetLanguages(next);
  };

  const selectNoneOfTheseLanguages = () => {
    setTargetLanguages([]);
  };

  const handleSetAllLlm = (provider: string) => {
    const next: Record<string, string> = {
      chunker: provider,
      director: provider,
      manim_renderer: provider === "openrouter" ? "openrouter" : provider,
      remotion_renderer: provider,
      video_renderer: provider,
      prompt_enhancer: provider,
      story_enhancer: provider,
    };
    setLlmRouting(next);
  };

  const handleSetComponentLlm = (comp: string, provider: string) => {
    setLlmRouting((prev) => ({
      ...prev,
      [comp]: provider,
    }));
  };

  return (
    <Card className="border border-purple-500/30 bg-[#121827] text-white shadow-xl">
      <CardHeader className="border-b border-purple-500/20 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-purple-200">
              <Sparkles className="h-5 w-5 text-purple-400" />
              Marketing Video Payload Configuration ({subjectName})
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Customize Avatar ID, narration language, TTS engine (Sarvam / IndicF5), target languages, voice, and LLM routing. Saved settings apply to all future marketing jobs for this subject.
            </CardDescription>
          </div>
          <Button
            onClick={() => handleRequestSave()}
            disabled={saveConfigMutation.isPending}
            className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 font-semibold text-slate-950 hover:from-amber-400 hover:to-amber-500"
          >
            <Save className="h-4 w-4" />
            {saveConfigMutation.isPending ? "Saving..." : "Save as Default"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        {/* Row 1: Avatar ID & Voice */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Avatar ID */}
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-sm font-semibold text-purple-300">
                <UserCheck className="h-4 w-4 text-purple-400" />
                1. Avatar ID
              </Label>
              {subjectData?.avatar_id && (
                <span className="text-[11px] text-purple-400/80 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
                  DB Saved: {subjectData.avatar_id}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={avatarId}
                onChange={(e) => setAvatarId(e.target.value)}
                placeholder="e.g. avatar_5ab07dea or pramod"
                className="bg-slate-950 text-white border-slate-700 text-sm font-mono focus:border-purple-500"
              />
              <Select
                value={avatarId}
                onValueChange={(val) => {
                  setAvatarId(val);
                  handleRequestSave({ avatar_id: val });
                }}
              >
                <SelectTrigger className="w-[140px] bg-slate-950 text-xs border-slate-700">
                  <SelectValue placeholder="Preset" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-white border-slate-700">
                  {subjectData?.avatar_id && (
                    <SelectItem value={subjectData.avatar_id}>
                      DB Saved ({subjectData.avatar_id.slice(0, 12)}...)
                    </SelectItem>
                  )}
                  <SelectItem value="avatar_46e03dc2">Avatar 1 (46e03dc2)</SelectItem>
                  <SelectItem value="avatar_9ff87c46">Avatar 2 (9ff87c46)</SelectItem>
                  <SelectItem value="avatar_d8825fc9">Avatar 3 (d8825fc9)</SelectItem>
                  <SelectItem value="avatar_5ab07dea">Avatar 4 (5ab07dea)</SelectItem>
                  <SelectItem value="avatar_947bb537">Avatar 5 (947bb537)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-slate-400">
              Visual avatar character sent as <code className="text-purple-300">avatar_id</code>. Editing requires admin confirmation.
            </p>
          </div>

          {/* 3. Voice / Speaker */}
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <Label className="flex items-center gap-2 text-sm font-semibold text-blue-300">
              <Volume2 className="h-4 w-4 text-blue-400" />
              3. Voice (avatar_speaker)
            </Label>
            <Select
              value={voice}
              onValueChange={(val) => {
                setVoice(val);
              }}
              disabled={ttsEngine === "indicf5"}
            >
              <SelectTrigger className="w-full bg-slate-950 text-white border-slate-700 text-sm">
                <SelectValue placeholder="Select Voice" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-white border-slate-700">
                {VOICE_OPTIONS.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">
              {ttsEngine === "indicf5"
                ? "IndicF5 clones the avatar reference audio — speaker is not used by HeyGem."
                : ttsEngine === "sarvam"
                  ? "Required for Sarvam TTS (catalog voice, not avatar clone)."
                  : "Default voice speaker used for audio generation in marketing videos."}
            </p>
          </div>
        </div>

        {/* Row 1b: Avatar language & TTS engine */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <Label className="flex items-center gap-2 text-sm font-semibold text-amber-300">
              <Globe className="h-4 w-4 text-amber-400" />
              Avatar Language (avatar_language)
            </Label>
            <Select value={avatarLanguage} onValueChange={setAvatarLanguage}>
              <SelectTrigger className="w-full bg-slate-950 text-white border-slate-700 text-sm">
                <SelectValue placeholder="Select narration language" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-white border-slate-700 max-h-72">
                {AVATAR_LANGUAGE_OPTIONS.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">
              Primary narration language for the avatar. Non-English jobs auto-select IndicF5 if no TTS engine is set on the server.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
            <Label className="flex items-center gap-2 text-sm font-semibold text-rose-300">
              <Cpu className="h-4 w-4 text-rose-400" />
              TTS Engine (tts_engine)
            </Label>
            <Select
              value={ttsEngine}
              onValueChange={(val: "default" | "sarvam" | "indicf5") => setTtsEngine(val)}
            >
              <SelectTrigger className="w-full bg-slate-950 text-white border-slate-700 text-sm">
                <SelectValue placeholder="Select TTS engine" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-white border-slate-700">
                {TTS_ENGINE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-slate-400">
              {TTS_ENGINE_OPTIONS.find((o) => o.id === ttsEngine)?.hint}
            </p>
          </div>
        </div>

        {/* 2. Targeted Languages */}
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <Globe className="h-4 w-4 text-emerald-400" />
              2. Targeted Languages ({targetLanguages.length === 0 ? "None" : `${targetLanguages.length} Selected`})
            </Label>
            <span className="text-[11px] text-slate-400">
              {targetLanguages.length === 0
                ? <>Payload sends <code className="text-rose-300">target_languages: null</code></>
                : <>Multi-language dubbing list sent as <code className="text-emerald-300">target_languages</code>.</>}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={selectNoneOfTheseLanguages}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                targetLanguages.length === 0
                  ? "bg-slate-800 text-white border-2 border-rose-400 shadow-md shadow-rose-400/10 font-bold"
                  : "bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
              }`}
            >
              <span className="text-[11px] font-bold text-rose-400">∅</span>
              <span>None of these</span>
            </button>
            {TARGET_LANGUAGES_LIST.map((lang) => {
              const isSelected = targetLanguages.includes(lang.code);
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => toggleLanguage(lang.code)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? "bg-slate-800 text-white border-2 border-amber-400 shadow-md shadow-amber-400/10 font-bold"
                      : "bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-slate-200"
                  }`}
                >
                  <span className="text-[11px] font-bold text-amber-400">{lang.flagText}</span>
                  <span>{lang.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4. LLM Provider per Component */}
        <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
              <Zap className="h-4 w-4 text-cyan-400" />
              <span>4. LLM Provider per Component</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Default: <span className="text-purple-300">🦙 Local Ollama</span> · manim always <span className="text-emerald-400">OpenRouter</span>
            </div>
          </div>

          {/* Quick set buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium mr-1">Set all:</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleSetAllLlm("local")}
                className="h-7 text-xs gap-1 border-purple-500/50 bg-purple-950/50 text-purple-200 hover:bg-purple-900/70"
              >
                🦙 All Ollama
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleSetAllLlm("freellmapi")}
                className="h-7 text-xs gap-1 border-cyan-500/50 bg-cyan-950/50 text-cyan-200 hover:bg-cyan-900/70"
              >
                ⚡ All FreeLLM
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleSetAllLlm("openrouter")}
                className="h-7 text-xs gap-1 border-emerald-500/50 bg-emerald-950/50 text-emerald-200 hover:bg-emerald-900/70"
              >
                ☁️ All OpenRouter
              </Button>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => handleRequestSave()}
              className="h-7 text-xs gap-1 border border-amber-500/60 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 font-semibold"
            >
              <Save className="h-3 w-3" /> Save as Default
            </Button>
          </div>

          {/* Component rows */}
          <div className="space-y-2.5 text-xs pt-1">
            {[
              { id: "chunker", icon: "✂️", label: "Chunker" },
              { id: "director", icon: "🎬", label: "Director" },
              { id: "manim_renderer", icon: "🎨", label: "Manim Renderer" },
              { id: "remotion_renderer", icon: "🎥", label: "Remotion Renderer", disabled: true },
              { id: "video_renderer", icon: "📹", label: "Video Renderer", disabled: true },
              { id: "prompt_enhancer", icon: "✨", label: "Prompt Enhancer" },
            ].map((comp) => {
              const currentVal = llmRouting[comp.id] || "local";
              return (
                <div
                  key={comp.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-950 p-2 border border-slate-800/80"
                >
                  <div className="flex items-center gap-2 min-w-[150px] font-medium text-slate-200">
                    <span>{comp.icon}</span>
                    <span>{comp.label}</span>
                  </div>

                  {comp.disabled ? (
                    <div className="flex items-center justify-end">
                      <span className="rounded-full bg-pink-950/80 text-pink-300 border border-pink-700/60 px-3 py-1 text-[11px] font-semibold">
                        ⛔ V3 N/A
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[
                        { id: "opusmax", label: "⚡ OpusMax", color: "border-cyan-500/50 bg-cyan-950/60 text-cyan-200" },
                        { id: "freellmapi", label: "⚡ FreeLLMAPI", color: "border-cyan-500/50 bg-cyan-950/60 text-cyan-200" },
                        { id: "openrouter", label: "☁️ OpenRouter", color: "border-emerald-500/50 bg-emerald-950/60 text-emerald-200" },
                        { id: "local", label: "🦙 Local Ollama", color: "border-purple-500/50 bg-purple-950/60 text-purple-200" },
                      ].map((opt) => {
                        const active = currentVal === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => handleSetComponentLlm(comp.id, opt.id)}
                            className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                              active
                                ? `${opt.color} border-2 shadow-sm font-bold scale-[1.02]`
                                : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>

      {/* Confirmation Dialog for Changing Avatar ID or Marketing Settings */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-slate-900 text-white border-purple-500/40">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-purple-300">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
              Confirm Marketing Payload Change
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-300 text-sm space-y-2">
              <p>
                Are you sure you want to update the saved default marketing payload settings for{" "}
                <span className="font-bold text-white">{subjectName}</span>?
              </p>
              {pendingSaveConfig && (
                <div className="rounded border border-slate-800 bg-slate-950 p-2.5 text-xs font-mono space-y-1 text-slate-300">
                  <div>Avatar ID: <span className="text-purple-300 font-bold">{pendingSaveConfig.avatar_id || "(None)"}</span></div>
                  <div>Avatar Language: <span className="text-amber-300">{pendingSaveConfig.avatar_language}</span></div>
                  <div>TTS Engine: <span className="text-rose-300">{pendingSaveConfig.tts_engine}</span></div>
                  <div>Voice: <span className="text-blue-300">{pendingSaveConfig.avatar_speaker}</span></div>
                  <div>
                    Languages:{" "}
                    <span className="text-emerald-300">
                      {pendingSaveConfig.target_languages?.length
                        ? pendingSaveConfig.target_languages.join(", ")
                        : "null (none of these)"}
                    </span>
                  </div>
                </div>
              )}
              <p className="text-xs text-amber-400">
                Every subsequent job submitted in the marketing pipeline for this subject will use this payload.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-slate-800 text-slate-300 hover:bg-slate-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSave}
              className="bg-purple-600 hover:bg-purple-500 text-white font-semibold"
            >
              Confirm & Save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
