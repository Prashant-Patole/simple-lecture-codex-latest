import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Server, Globe, Languages, Loader2, CheckCircle2, Cloud } from "lucide-react";
import { VideoStreamSettings, PrimaryVideoSource, DEFAULT_VIDEO_STREAM_SETTINGS, useUpdateVideoStreamSettings } from "@/hooks/useVideoStreamSettings";
import { VIDEO_SERVER_OPTIONS } from "@/hooks/useAdminPopularSubjects";

interface VideoSourceConfigCardProps {
  settings: VideoStreamSettings;
  onChange: (settings: VideoStreamSettings) => void;
}

const SOURCE_OPTIONS: { value: PrimaryVideoSource; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'vimeo',
    label: 'Vimeo (Recommended)',
    description: 'All videos loaded from your Vimeo account',
    icon: <Globe className="h-4 w-4" />,
  },
  {
    value: 'local_server',
    label: 'Local Server',
    description: 'Videos served from generation server',
    icon: <Server className="h-4 w-4" />,
  },
  {
    value: 'language_priority',
    label: 'Language Avatar Priority',
    description: 'Use localized avatars when available, then fallback',
    icon: <Languages className="h-4 w-4" />,
  },
  {
    value: 'cdn_server',
    label: 'CDN Server (Production)',
    description: 'Videos served from CDN with HTTPS (recommended for production)',
    icon: <Cloud className="h-4 w-4" />,
  },
];

export function VideoSourceConfigCard({ 
  settings, 
  onChange, 
}: VideoSourceConfigCardProps) {
  const updateVideoSettings = useUpdateVideoStreamSettings();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialMount = useRef(true);
  
  // Auto-save with debounce
  useEffect(() => {
    // Skip initial mount to avoid saving default values
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set saving status and debounce the save
    setSaveStatus('saving');
    saveTimeoutRef.current = setTimeout(() => {
      updateVideoSettings.mutate(settings, {
        onSuccess: () => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
        },
        onError: () => {
          setSaveStatus('idle');
        }
      });
    }, 800);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [settings]);
  
  const primarySource = settings.primary_video_source || DEFAULT_VIDEO_STREAM_SETTINGS.primary_video_source;
  const localServerIp = settings.local_server_ip || DEFAULT_VIDEO_STREAM_SETTINGS.local_server_ip;
  const languageAvatarServerIp = settings.language_avatar_server_ip || DEFAULT_VIDEO_STREAM_SETTINGS.language_avatar_server_ip;
  const languageFallback = settings.language_fallback || DEFAULT_VIDEO_STREAM_SETTINGS.language_fallback;
  const vimeoFallback = settings.vimeo_fallback || DEFAULT_VIDEO_STREAM_SETTINGS.vimeo_fallback;
  const localServerFallback = settings.local_server_fallback || DEFAULT_VIDEO_STREAM_SETTINGS.local_server_fallback;
  const fallbackServerIp = settings.fallback_server_ip || DEFAULT_VIDEO_STREAM_SETTINGS.fallback_server_ip;
  const cdnBaseUrl = settings.cdn_base_url || DEFAULT_VIDEO_STREAM_SETTINGS.cdn_base_url;
  const cdnFallback = settings.cdn_fallback || DEFAULT_VIDEO_STREAM_SETTINGS.cdn_fallback;

  const handleSourceChange = (value: PrimaryVideoSource) => {
    onChange({ ...settings, primary_video_source: value });
  };

  const handleServerIpChange = (ip: string) => {
    onChange({ ...settings, local_server_ip: ip });
  };

  const handleLanguageAvatarServerIpChange = (ip: string) => {
    onChange({ ...settings, language_avatar_server_ip: ip });
  };

  const handleFallbackServerIpChange = (ip: string) => {
    onChange({ ...settings, fallback_server_ip: ip });
  };

  const handleVimeoFallbackChange = (fallback: 'local_server' | 'none') => {
    onChange({ ...settings, vimeo_fallback: fallback });
  };

  const handleLocalServerFallbackChange = (fallback: 'vimeo' | 'none') => {
    onChange({ ...settings, local_server_fallback: fallback });
  };

  const handleLanguageFallbackChange = (fallback: 'vimeo' | 'local_server') => {
    onChange({ ...settings, language_fallback: fallback });
  };

  const handleCdnBaseUrlChange = (url: string) => {
    onChange({ ...settings, cdn_base_url: url });
  };

  const handleCdnFallbackChange = (fallback: 'local_server' | 'vimeo' | 'none') => {
    onChange({ ...settings, cdn_fallback: fallback });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Video Source Configuration</CardTitle>
            <CardDescription>Choose where to fetch all lecture videos from</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Primary Video Source */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Primary Video Source</Label>
          
          <RadioGroup
            value={primarySource}
            onValueChange={(value) => handleSourceChange(value as PrimaryVideoSource)}
            className="space-y-4"
          >
            {SOURCE_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-start space-x-3">
                <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                <div className="flex-1 space-y-3">
                  <Label 
                    htmlFor={option.value} 
                    className="flex items-center gap-2 font-medium cursor-pointer"
                  >
                    {option.icon}
                    {option.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                  
                  {/* Vimeo Options */}
                  {option.value === 'vimeo' && (
                    <div className="ml-6 space-y-3 border-l-2 border-muted pl-4">
                      <div>
                        <Label className="text-sm">Fallback when unavailable</Label>
                        <Select value={vimeoFallback} onValueChange={(v) => handleVimeoFallbackChange(v as 'local_server' | 'none')}>
                          <SelectTrigger className="w-[280px] mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="local_server">Local Server</SelectItem>
                            <SelectItem value="none">None (No Fallback)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {vimeoFallback === 'local_server' && (
                        <div>
                          <Label className="text-sm">Fallback Server IP</Label>
                          <Select value={fallbackServerIp} onValueChange={handleFallbackServerIpChange}>
                            <SelectTrigger className="w-[280px] mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background">
                              {VIDEO_SERVER_OPTIONS.map((server) => (
                                <SelectItem key={server.ip} value={server.ip}>
                                  {server.label} ({server.ip})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Local Server Options */}
                  {option.value === 'local_server' && (
                    <div className="ml-6 space-y-3 border-l-2 border-muted pl-4">
                      <div>
                        <Label className="text-sm">Server IP</Label>
                        <Select value={localServerIp} onValueChange={handleServerIpChange}>
                          <SelectTrigger className="w-[280px] mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            {VIDEO_SERVER_OPTIONS.map((server) => (
                              <SelectItem key={server.ip} value={server.ip}>
                                {server.label} ({server.ip})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-sm">Fallback when unavailable</Label>
                        <Select value={localServerFallback} onValueChange={(v) => handleLocalServerFallbackChange(v as 'vimeo' | 'none')}>
                          <SelectTrigger className="w-[280px] mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="vimeo">Vimeo</SelectItem>
                            <SelectItem value="none">None (No Fallback)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  
                  {/* Language Avatar Priority Options */}
                  {option.value === 'language_priority' && (
                    <div className="ml-6 space-y-3 border-l-2 border-muted pl-4">
                      <div>
                        <Label className="text-sm">Language Avatar Server IP</Label>
                        <Select value={languageAvatarServerIp} onValueChange={handleLanguageAvatarServerIpChange}>
                          <SelectTrigger className="w-[280px] mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            {VIDEO_SERVER_OPTIONS.map((server) => (
                              <SelectItem key={server.ip} value={server.ip}>
                                {server.label} ({server.ip})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <Label className="text-sm">Fallback when language avatar unavailable</Label>
                        <Select 
                          value={languageFallback} 
                          onValueChange={(v) => handleLanguageFallbackChange(v as 'vimeo' | 'local_server')}
                        >
                          <SelectTrigger className="w-[280px] mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="vimeo">Vimeo</SelectItem>
                            <SelectItem value="local_server">Local Server</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {languageFallback === 'local_server' && (
                        <div>
                          <Label className="text-sm">Fallback Server IP</Label>
                          <Select value={fallbackServerIp} onValueChange={handleFallbackServerIpChange}>
                            <SelectTrigger className="w-[280px] mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background">
                              {VIDEO_SERVER_OPTIONS.map((server) => (
                                <SelectItem key={server.ip} value={server.ip}>
                                  {server.label} ({server.ip})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* CDN Server Options */}
                  {option.value === 'cdn_server' && (
                    <div className="ml-6 space-y-3 border-l-2 border-muted pl-4">
                      <div>
                        <Label className="text-sm">CDN Base URL</Label>
                        <Input 
                          value={cdnBaseUrl}
                          onChange={(e) => handleCdnBaseUrlChange(e.target.value)}
                          placeholder="https://server1.simplelecture.com/video"
                          className="w-[400px] mt-1"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Videos will be loaded from: {cdnBaseUrl}/{'{jobId}'}/videos/...
                        </p>
                      </div>
                      
                      <div>
                        <Label className="text-sm">Fallback when unavailable</Label>
                        <Select value={cdnFallback} onValueChange={(v) => handleCdnFallbackChange(v as 'local_server' | 'vimeo' | 'none')}>
                          <SelectTrigger className="w-[280px] mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-background">
                            <SelectItem value="local_server">Local Server</SelectItem>
                            <SelectItem value="vimeo">Vimeo</SelectItem>
                            <SelectItem value="none">None (No Fallback)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {cdnFallback === 'local_server' && (
                        <div>
                          <Label className="text-sm">Fallback Server IP</Label>
                          <Select value={fallbackServerIp} onValueChange={handleFallbackServerIpChange}>
                            <SelectTrigger className="w-[280px] mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-background">
                              {VIDEO_SERVER_OPTIONS.map((server) => (
                                <SelectItem key={server.ip} value={server.ip}>
                                  {server.label} ({server.ip})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <Separator />

        <div className="flex items-center justify-end gap-2">
          {saveStatus === 'saving' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Saving...</span>
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Saved</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
