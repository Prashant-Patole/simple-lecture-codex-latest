import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAISettings, useUpdateAISettings, AISettings } from "@/hooks/useAISettings";
import { usePaymentSettings, useUpdatePaymentSettings, PaymentSettings, DEFAULT_PAYMENT_SETTINGS } from "@/hooks/usePaymentSettings";
import { useBBBSettings, useUpdateBBBSettings, useTestBBBConnection, BBBSettings, DEFAULT_BBB_SETTINGS } from "@/hooks/useBBBSettings";
import { useVideoStreamSettings, useUpdateVideoStreamSettings, useTestCloudflareConnection, VideoStreamSettings, DEFAULT_VIDEO_STREAM_SETTINGS } from "@/hooks/useVideoStreamSettings";
import { useAIApiSettings, useUpdateAIApiSettings, useTestAIConnection, AIApiSettings, DEFAULT_AI_API_SETTINGS, GOOGLE_MODELS, OPENAI_MODELS, OPENROUTER_MODELS } from "@/hooks/useAIApiSettings";
import { useHeroVideoSettings, useUpdateHeroVideoSettings, HeroVideoSettings, DEFAULT_HERO_VIDEO_SETTINGS } from "@/hooks/useHeroVideoSettings";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Sparkles, CreditCard, Eye, EyeOff, Video, Loader2, CheckCircle2, Copy, ExternalLink, Cloud, Download, Wifi, Key, Play } from "lucide-react";
import { VideoSourceConfigCard } from "@/components/admin/settings/VideoSourceConfigCard";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const { data: aiSettings, isLoading } = useAISettings();
  const updateSettings = useUpdateAISettings();
  
  const { data: paymentSettings, isLoading: paymentLoading } = usePaymentSettings();
  const updatePaymentSettings = useUpdatePaymentSettings();

  const { data: bbbSettings, isLoading: bbbLoading } = useBBBSettings();
  const updateBBBSettings = useUpdateBBBSettings();
  const testBBBConnection = useTestBBBConnection();

  const { data: videoSettings, isLoading: videoLoading } = useVideoStreamSettings();
  const updateVideoSettings = useUpdateVideoStreamSettings();
  const testCloudflare = useTestCloudflareConnection();

  const { data: aiApiSettings, isLoading: aiApiLoading } = useAIApiSettings();
  const updateAIApiSettings = useUpdateAIApiSettings();
  const testAIConnection = useTestAIConnection();

  const { data: heroVideoSettings, isLoading: heroVideoLoading } = useHeroVideoSettings();
  const updateHeroVideoSettings = useUpdateHeroVideoSettings();
  
  const [localSettings, setLocalSettings] = useState<AISettings | null>(null);
  const [localPaymentSettings, setLocalPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [localBBBSettings, setLocalBBBSettings] = useState<BBBSettings>(DEFAULT_BBB_SETTINGS);
  const [localVideoSettings, setLocalVideoSettings] = useState<VideoStreamSettings>(DEFAULT_VIDEO_STREAM_SETTINGS);
  const [localAIApiSettings, setLocalAIApiSettings] = useState<AIApiSettings>(DEFAULT_AI_API_SETTINGS);
  const [localHeroVideoSettings, setLocalHeroVideoSettings] = useState<HeroVideoSettings>(DEFAULT_HERO_VIDEO_SETTINGS);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showBBBSecret, setShowBBBSecret] = useState(false);
  const [showCloudflareToken, setShowCloudflareToken] = useState(false);
  const [showBunnyKey, setShowBunnyKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);

  useEffect(() => {
    if (aiSettings) {
      setLocalSettings(aiSettings);
    }
  }, [aiSettings]);

  useEffect(() => {
    if (paymentSettings) {
      setLocalPaymentSettings(paymentSettings);
    }
  }, [paymentSettings]);

  useEffect(() => {
    if (bbbSettings) {
      setLocalBBBSettings(bbbSettings);
    }
  }, [bbbSettings]);

  useEffect(() => {
    if (videoSettings) {
      setLocalVideoSettings(videoSettings);
    }
  }, [videoSettings]);

  useEffect(() => {
    if (aiApiSettings) {
      setLocalAIApiSettings(aiApiSettings);
    }
  }, [aiApiSettings]);

  useEffect(() => {
    if (heroVideoSettings) {
      setLocalHeroVideoSettings(heroVideoSettings);
    }
  }, [heroVideoSettings]);

  const handleSaveAI = () => {
    if (localSettings) {
      updateSettings.mutate(localSettings);
    }
  };

  const handleSavePayment = () => {
    updatePaymentSettings.mutate(localPaymentSettings);
  };

  const handleSaveBBB = () => {
    updateBBBSettings.mutate(localBBBSettings);
  };

  const handleSaveVideo = () => {
    updateVideoSettings.mutate(localVideoSettings);
  };

  const handleSaveAIApi = () => {
    updateAIApiSettings.mutate(localAIApiSettings);
  };

  const handleSaveHeroVideo = () => {
    updateHeroVideoSettings.mutate(localHeroVideoSettings);
  };

  const handleTestAIConnection = () => {
    const apiKey =
      localAIApiSettings.provider === 'google' ? localAIApiSettings.google_api_key :
      localAIApiSettings.provider === 'openai' ? localAIApiSettings.openai_api_key :
      localAIApiSettings.provider === 'openrouter' ? localAIApiSettings.openrouter_api_key :
      '';

    if (!apiKey) {
      const label =
        localAIApiSettings.provider === 'google' ? 'Google' :
        localAIApiSettings.provider === 'openai' ? 'OpenAI' : 'OpenRouter';
      toast({
        title: 'Missing API Key',
        description: `Please enter your ${label} API key`,
        variant: 'destructive',
      });
      return;
    }

    testAIConnection.mutate({
      provider: localAIApiSettings.provider as 'google' | 'openai' | 'openrouter',
      apiKey,
      model: localAIApiSettings.default_model,
    });
  };


  const handleTestCloudflare = () => {
    if (!localVideoSettings.cloudflare_zone_id || !localVideoSettings.cloudflare_api_token) {
      toast({
        title: 'Missing fields',
        description: 'Please enter Zone ID and API Token',
        variant: 'destructive',
      });
      return;
    }
    testCloudflare.mutate({
      zoneId: localVideoSettings.cloudflare_zone_id,
      apiToken: localVideoSettings.cloudflare_api_token,
    });
  };

  const handleTestBBBConnection = () => {
    if (!localBBBSettings.server_url || !localBBBSettings.shared_secret) {
      toast({
        title: 'Missing fields',
        description: 'Please enter both Server URL and Shared Secret',
        variant: 'destructive',
      });
      return;
    }
    testBBBConnection.mutate({
      serverUrl: localBBBSettings.server_url,
      sharedSecret: localBBBSettings.shared_secret,
    });
  };

  const webhookUrl = `https://oxwhqvsoelqqsblmqkxx.supabase.co/functions/v1/bbb-webhooks`; // NOTE: Webhooks use direct URL (server-to-server, not browser)

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: 'Copied',
      description: 'Webhook URL copied to clipboard',
    });
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your application settings</p>
      </div>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.location.href = '/admin/settings/documentation'}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Documentation</h3>
                <p className="text-sm text-muted-foreground">View comprehensive guides</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => window.location.href = '/admin/settings/generate-images'}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Sparkles className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold">Generate Images</h3>
                <p className="text-sm text-muted-foreground">AI image generation for seed data</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Configure basic application settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="site-name">Site Name</Label>
            <Input id="site-name" defaultValue="SimpleLecture" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="site-description">Site Description</Label>
            <Input id="site-description" defaultValue="Online Learning Platform" />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">
                Enable maintenance mode to prevent user access
              </p>
            </div>
            <Switch />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Send email notifications to users
              </p>
            </div>
            <Switch defaultChecked />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Allow New Registrations</Label>
              <p className="text-sm text-muted-foreground">
                Allow new users to register
              </p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Hero Video Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Play className="h-5 w-5 text-red-500" />
            <div>
              <CardTitle>Homepage Hero Video</CardTitle>
              <CardDescription>Configure the promotional video on the homepage hero section</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {heroVideoLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Hero Video</Label>
                  <p className="text-sm text-muted-foreground">
                    Show a YouTube video in the homepage hero section
                  </p>
                </div>
                <Switch
                  checked={localHeroVideoSettings.enabled}
                  onCheckedChange={(checked) => setLocalHeroVideoSettings({
                    ...localHeroVideoSettings,
                    enabled: checked
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hero-youtube-url">YouTube Video URL</Label>
                <Input
                  id="hero-youtube-url"
                  value={localHeroVideoSettings.youtube_url}
                  onChange={(e) => setLocalHeroVideoSettings({
                    ...localHeroVideoSettings,
                    youtube_url: e.target.value
                  })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  disabled={!localHeroVideoSettings.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  This video will autoplay (muted) in the hero section. Users can unmute via YouTube controls.
                </p>
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => heroVideoSettings && setLocalHeroVideoSettings(heroVideoSettings)}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSaveHeroVideo}
                  disabled={updateHeroVideoSettings.isPending}
                >
                  {updateHeroVideoSettings.isPending ? "Saving..." : "Save Hero Video Settings"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-green-600" />
            <div>
              <CardTitle>Payment Gateway Settings</CardTitle>
              <CardDescription>Configure Razorpay payment gateway credentials</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {paymentLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="payment-provider">Payment Provider</Label>
                <Select
                  value={localPaymentSettings.provider}
                  onValueChange={(value) => setLocalPaymentSettings({ ...localPaymentSettings, provider: value })}
                >
                  <SelectTrigger id="payment-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="razorpay">Razorpay</SelectItem>
                    <SelectItem value="demo">Demo Mode (No Real Payments)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select your payment gateway provider
                </p>
              </div>

              {localPaymentSettings.provider === "razorpay" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="razorpay-key-id">Razorpay Key ID</Label>
                    <Input
                      id="razorpay-key-id"
                      value={localPaymentSettings.razorpay_key_id}
                      onChange={(e) => setLocalPaymentSettings({
                        ...localPaymentSettings,
                        razorpay_key_id: e.target.value
                      })}
                      placeholder="rzp_live_xxxxxxxxxxxxx or rzp_test_xxxxxxxxxxxxx"
                    />
                    <p className="text-xs text-muted-foreground">
                      Your Razorpay Key ID (starts with rzp_live_ or rzp_test_)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="razorpay-key-secret">Razorpay Key Secret</Label>
                    <div className="relative">
                      <Input
                        id="razorpay-key-secret"
                        type={showSecretKey ? "text" : "password"}
                        value={localPaymentSettings.razorpay_key_secret}
                        onChange={(e) => setLocalPaymentSettings({
                          ...localPaymentSettings,
                          razorpay_key_secret: e.target.value
                        })}
                        placeholder="Enter your Razorpay Key Secret"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                      >
                        {showSecretKey ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Your Razorpay Key Secret (keep this confidential)
                    </p>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Test Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable test mode to use sandbox credentials
                  </p>
                </div>
                <Switch
                  checked={localPaymentSettings.test_mode}
                  onCheckedChange={(checked) => setLocalPaymentSettings({
                    ...localPaymentSettings,
                    test_mode: checked
                  })}
                />
              </div>

              <Separator />

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> These settings are stored in the database for reference. 
                  For production use, ensure the <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> 
                  are also configured in your Supabase Edge Function secrets for secure server-side processing.
                </p>
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => paymentSettings && setLocalPaymentSettings(paymentSettings)}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSavePayment}
                  disabled={updatePaymentSettings.isPending}
                >
                  {updatePaymentSettings.isPending ? "Saving..." : "Save Payment Settings"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* AI Functions API Key Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-orange-500" />
            <div>
              <CardTitle>AI Functions API Key Settings</CardTitle>
              <CardDescription>Configure your own AI API key for all AI-powered features</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {aiApiLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Custom AI API</Label>
                  <p className="text-sm text-muted-foreground">
                    Use your own API key instead of the default Platform AI Gateway
                  </p>
                </div>
                <Switch
                  checked={localAIApiSettings.enabled}
                  onCheckedChange={(checked) => setLocalAIApiSettings({
                    ...localAIApiSettings,
                    enabled: checked
                  })}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="ai-provider">AI Provider</Label>
                <Select
                  value={localAIApiSettings.provider}
                  onValueChange={(value: 'google' | 'openai' | 'lovable' | 'openrouter') => {
                    const defaultModel =
                      value === 'google' ? 'gemini-2.5-flash' :
                      value === 'openai' ? 'gpt-4o-mini' :
                      value === 'openrouter' ? 'google/gemini-2.5-flash' :
                      'google/gemini-2.5-flash';
                    setLocalAIApiSettings({
                      ...localAIApiSettings,
                      provider: value,
                      default_model: defaultModel
                    });
                  }}
                  disabled={!localAIApiSettings.enabled}
                >
                  <SelectTrigger id="ai-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="openrouter">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-orange-500" />
                        OpenRouter (Recommended)
                      </div>
                    </SelectItem>
                    <SelectItem value="lovable">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        Platform AI Gateway
                      </div>
                    </SelectItem>
                    <SelectItem value="google">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-blue-500" />
                        Google Gemini (direct)
                      </div>
                    </SelectItem>
                    <SelectItem value="openai">
                      <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-green-500" />
                        OpenAI (direct)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose which AI provider powers all AI functions across the platform
                </p>
              </div>

              {localAIApiSettings.provider === 'openrouter' && localAIApiSettings.enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="openrouter-api-key">OpenRouter API Key</Label>
                    <div className="relative">
                      <Input
                        id="openrouter-api-key"
                        type={showOpenRouterKey ? "text" : "password"}
                        value={localAIApiSettings.openrouter_api_key}
                        onChange={(e) => setLocalAIApiSettings({
                          ...localAIApiSettings,
                          openrouter_api_key: e.target.value
                        })}
                        placeholder="Enter your OpenRouter API key (sk-or-v1-...)"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowOpenRouterKey(!showOpenRouterKey)}
                      >
                        {showOpenRouterKey ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{" "}
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        OpenRouter <ExternalLink className="inline h-3 w-3" />
                      </a>
                      . Routes to many models (Gemini, GPT, Claude, Llama) through one key.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openrouter-model">Default Model</Label>
                    <Select
                      value={localAIApiSettings.default_model}
                      onValueChange={(value) => setLocalAIApiSettings({
                        ...localAIApiSettings,
                        default_model: value
                      })}
                    >
                      <SelectTrigger id="openrouter-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {OPENROUTER_MODELS.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}


              {localAIApiSettings.provider === 'google' && localAIApiSettings.enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="google-api-key">Google AI API Key</Label>
                    <div className="relative">
                      <Input
                        id="google-api-key"
                        type={showGoogleKey ? "text" : "password"}
                        value={localAIApiSettings.google_api_key}
                        onChange={(e) => setLocalAIApiSettings({
                          ...localAIApiSettings,
                          google_api_key: e.target.value
                        })}
                        placeholder="Enter your Google AI Studio API key"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowGoogleKey(!showGoogleKey)}
                      >
                        {showGoogleKey ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{" "}
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Google AI Studio <ExternalLink className="inline h-3 w-3" />
                      </a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="google-model">Default Model</Label>
                    <Select
                      value={localAIApiSettings.default_model}
                      onValueChange={(value) => setLocalAIApiSettings({
                        ...localAIApiSettings,
                        default_model: value
                      })}
                    >
                      <SelectTrigger id="google-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {GOOGLE_MODELS.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {localAIApiSettings.provider === 'openai' && localAIApiSettings.enabled && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="openai-api-key">OpenAI API Key</Label>
                    <div className="relative">
                      <Input
                        id="openai-api-key"
                        type={showOpenAIKey ? "text" : "password"}
                        value={localAIApiSettings.openai_api_key}
                        onChange={(e) => setLocalAIApiSettings({
                          ...localAIApiSettings,
                          openai_api_key: e.target.value
                        })}
                        placeholder="Enter your OpenAI API key (sk-...)"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                      >
                        {showOpenAIKey ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get your API key from{" "}
                      <a 
                        href="https://platform.openai.com/api-keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        OpenAI Platform <ExternalLink className="inline h-3 w-3" />
                      </a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="openai-model">Default Model</Label>
                    <Select
                      value={localAIApiSettings.default_model}
                      onValueChange={(value) => setLocalAIApiSettings({
                        ...localAIApiSettings,
                        default_model: value
                      })}
                    >
                      <SelectTrigger id="openai-model">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background">
                        {OPENAI_MODELS.map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {localAIApiSettings.enabled && localAIApiSettings.provider !== 'lovable' && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Fallback</Label>
                      <p className="text-sm text-muted-foreground">
                        Fall back to Platform Gateway if your API fails
                      </p>
                    </div>
                    <Switch
                      checked={localAIApiSettings.fallback_enabled}
                      onCheckedChange={(checked) => setLocalAIApiSettings({
                        ...localAIApiSettings,
                        fallback_enabled: checked
                      })}
                    />
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleTestAIConnection}
                    disabled={testAIConnection.isPending ||
                      (localAIApiSettings.provider === 'google' && !localAIApiSettings.google_api_key) ||
                      (localAIApiSettings.provider === 'openai' && !localAIApiSettings.openai_api_key) ||
                      (localAIApiSettings.provider === 'openrouter' && !localAIApiSettings.openrouter_api_key)
                    }
                    className="w-full"
                  >
                    {testAIConnection.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing Connection...
                      </>
                    ) : testAIConnection.isSuccess ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                        Connection Successful
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                </>
              )}

              <Separator />

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> When enabled, all AI-powered features (question generation, 
                  doubt clearing, FAQ generation, etc.) will use your configured API key. 
                  This gives you full control over AI costs and usage.
                </p>
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => aiApiSettings && setLocalAIApiSettings(aiApiSettings)}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSaveAIApi}
                  disabled={updateAIApiSettings.isPending}
                >
                  {updateAIApiSettings.isPending ? "Saving..." : "Save AI API Settings"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>AI Question Generation Settings</CardTitle>
              <CardDescription>Configure AI model and parameters for automatic question generation</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading || !localSettings ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-model">AI Model</Label>
                  <Select
                    value={localSettings.model}
                    onValueChange={(value) => setLocalSettings({ ...localSettings, model: value })}
                  >
                    <SelectTrigger id="ai-model">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      <SelectItem value="google/gemini-2.5-flash">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Gemini 2.5 Flash (Recommended)
                        </div>
                      </SelectItem>
                      <SelectItem value="google/gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                      <SelectItem value="google/gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</SelectItem>
                      <SelectItem value="openai/gpt-5">GPT-5</SelectItem>
                      <SelectItem value="openai/gpt-5-mini">GPT-5 Mini</SelectItem>
                      <SelectItem value="openai/gpt-5-nano">GPT-5 Nano</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the AI model for question generation
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="questions-per-topic">Questions per Topic</Label>
                  <Input
                    id="questions-per-topic"
                    type="number"
                    min="1"
                    max="50"
                    value={localSettings.questions_per_topic}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      questions_per_topic: parseInt(e.target.value)
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of questions to generate per topic
                  </p>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature: {localSettings.temperature}</Label>
                  <Input
                    id="temperature"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={localSettings.temperature}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      temperature: parseFloat(e.target.value)
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls randomness (0 = focused, 1 = creative)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-tokens">Max Tokens</Label>
                  <Input
                    id="max-tokens"
                    type="number"
                    min="500"
                    max="4000"
                    step="100"
                    value={localSettings.max_tokens}
                    onChange={(e) => setLocalSettings({
                      ...localSettings,
                      max_tokens: parseInt(e.target.value)
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum response length
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Difficulty Distribution (%)</Label>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="easy" className="text-sm font-normal">Easy</Label>
                    <Input
                      id="easy"
                      type="number"
                      min="0"
                      max="100"
                      value={localSettings.difficulty_distribution.easy}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        difficulty_distribution: {
                          ...localSettings.difficulty_distribution,
                          easy: parseInt(e.target.value)
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="medium" className="text-sm font-normal">Medium</Label>
                    <Input
                      id="medium"
                      type="number"
                      min="0"
                      max="100"
                      value={localSettings.difficulty_distribution.medium}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        difficulty_distribution: {
                          ...localSettings.difficulty_distribution,
                          medium: parseInt(e.target.value)
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hard" className="text-sm font-normal">Hard</Label>
                    <Input
                      id="hard"
                      type="number"
                      min="0"
                      max="100"
                      value={localSettings.difficulty_distribution.hard}
                      onChange={(e) => setLocalSettings({
                        ...localSettings,
                        difficulty_distribution: {
                          ...localSettings.difficulty_distribution,
                          hard: parseInt(e.target.value)
                        }
                      })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Distribution should total 100%
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Textarea
                  id="system-prompt"
                  rows={6}
                  value={localSettings.system_prompt}
                  onChange={(e) => setLocalSettings({
                    ...localSettings,
                    system_prompt: e.target.value
                  })}
                  placeholder="Enter the system prompt for AI question generation..."
                />
                <p className="text-xs text-muted-foreground">
                  Instructions for the AI model when generating questions
                </p>
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => aiSettings && setLocalSettings(aiSettings)}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSaveAI}
                  disabled={updateSettings.isPending}
                >
                  {updateSettings.isPending ? "Saving..." : "Save AI Settings"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* BigBlueButton Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>BigBlueButton Settings</CardTitle>
              <CardDescription>Configure your self-hosted BigBlueButton server for live classes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {bbbLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable BigBlueButton</Label>
                  <p className="text-sm text-muted-foreground">
                    Use BBB for live classes instead of external meeting links
                  </p>
                </div>
                <Switch
                  checked={localBBBSettings.enabled}
                  onCheckedChange={(checked) => setLocalBBBSettings({
                    ...localBBBSettings,
                    enabled: checked
                  })}
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="bbb-server-url">BBB Server URL</Label>
                <Input
                  id="bbb-server-url"
                  value={localBBBSettings.server_url}
                  onChange={(e) => setLocalBBBSettings({
                    ...localBBBSettings,
                    server_url: e.target.value
                  })}
                  placeholder="https://bbb.yourschool.com/bigbluebutton/api"
                />
                <p className="text-xs text-muted-foreground">
                  Your BigBlueButton API endpoint (e.g., https://bbb.example.com/bigbluebutton/api)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bbb-shared-secret">Shared Secret</Label>
                <div className="relative">
                  <Input
                    id="bbb-shared-secret"
                    type={showBBBSecret ? "text" : "password"}
                    value={localBBBSettings.shared_secret}
                    onChange={(e) => setLocalBBBSettings({
                      ...localBBBSettings,
                      shared_secret: e.target.value
                    })}
                    placeholder="Enter your BBB shared secret"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowBBBSecret(!showBBBSecret)}
                  >
                    {showBBBSecret ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Get this by running <code className="bg-muted px-1 rounded">sudo bbb-conf --secret</code> on your BBB server
                </p>
              </div>

              <Button
                variant="outline"
                onClick={handleTestBBBConnection}
                disabled={testBBBConnection.isPending || !localBBBSettings.server_url || !localBBBSettings.shared_secret}
                className="w-full"
              >
                {testBBBConnection.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Testing Connection...
                  </>
                ) : testBBBConnection.isSuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                    Connection Successful
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Meeting Options</h4>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Webhooks</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically track attendance when students join/leave
                    </p>
                  </div>
                  <Switch
                    checked={localBBBSettings.webhook_enabled}
                    onCheckedChange={(checked) => setLocalBBBSettings({
                      ...localBBBSettings,
                      webhook_enabled: checked
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Recording</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable meeting recording capability
                    </p>
                  </div>
                  <Switch
                    checked={localBBBSettings.allow_recording}
                    onCheckedChange={(checked) => setLocalBBBSettings({
                      ...localBBBSettings,
                      allow_recording: checked
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-start Recording</Label>
                    <p className="text-sm text-muted-foreground">
                      Start recording automatically when meeting begins
                    </p>
                  </div>
                  <Switch
                    checked={localBBBSettings.auto_start_recording}
                    onCheckedChange={(checked) => setLocalBBBSettings({
                      ...localBBBSettings,
                      auto_start_recording: checked
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mute on Start</Label>
                    <p className="text-sm text-muted-foreground">
                      Mute attendees when they join the meeting
                    </p>
                  </div>
                  <Switch
                    checked={localBBBSettings.mute_on_start}
                    onCheckedChange={(checked) => setLocalBBBSettings({
                      ...localBBBSettings,
                      mute_on_start: checked
                    })}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="bbb-welcome-message">Welcome Message</Label>
                <Input
                  id="bbb-welcome-message"
                  value={localBBBSettings.default_welcome_message}
                  onChange={(e) => setLocalBBBSettings({
                    ...localBBBSettings,
                    default_welcome_message: e.target.value
                  })}
                  placeholder="Welcome to the class!"
                />
              </div>

              {localBBBSettings.webhook_enabled && (
                <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Webhook Configuration
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Configure this URL in your BBB server to enable automatic attendance tracking:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={webhookUrl}
                      readOnly
                      className="bg-background font-mono text-xs"
                    />
                    <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Run on your BBB server: <code className="bg-muted px-1 rounded">bbb-conf --setwebhook {webhookUrl}</code>
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => bbbSettings && setLocalBBBSettings(bbbSettings)}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSaveBBB}
                  disabled={updateBBBSettings.isPending}
                >
                  {updateBBBSettings.isPending ? "Saving..." : "Save BBB Settings"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Video Streaming Settings Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-orange-600" />
            <div>
              <CardTitle>Video Streaming Settings</CardTitle>
              <CardDescription>Configure CDN, adaptive quality, and offline downloads for recorded classes</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {videoLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Primary Provider</Label>
                <Select
                  value={localVideoSettings.primary_provider}
                  onValueChange={(value: 'cloudflare_b2' | 'bunny' | 'both') => setLocalVideoSettings({
                    ...localVideoSettings,
                    primary_provider: value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="cloudflare_b2">Cloudflare + Backblaze B2</SelectItem>
                    <SelectItem value="bunny">Bunny.net Stream</SelectItem>
                    <SelectItem value="both">Both (Fallback)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Cloudflare+B2 is cost-effective; Bunny.net offers built-in transcoding
                </p>
              </div>

              <Separator />

              {/* Cloudflare Settings */}
              {(localVideoSettings.primary_provider === 'cloudflare_b2' || localVideoSettings.primary_provider === 'both') && (
                <div className="space-y-4">
                  <h4 className="font-medium flex items-center gap-2">
                    <Cloud className="h-4 w-4" />
                    Cloudflare CDN Settings
                  </h4>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Zone ID</Label>
                      <Input
                        value={localVideoSettings.cloudflare_zone_id}
                        onChange={(e) => setLocalVideoSettings({
                          ...localVideoSettings,
                          cloudflare_zone_id: e.target.value
                        })}
                        placeholder="your-zone-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account ID</Label>
                      <Input
                        value={localVideoSettings.cloudflare_account_id}
                        onChange={(e) => setLocalVideoSettings({
                          ...localVideoSettings,
                          cloudflare_account_id: e.target.value
                        })}
                        placeholder="your-account-id"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>API Token</Label>
                    <div className="relative">
                      <Input
                        type={showCloudflareToken ? "text" : "password"}
                        value={localVideoSettings.cloudflare_api_token}
                        onChange={(e) => setLocalVideoSettings({
                          ...localVideoSettings,
                          cloudflare_api_token: e.target.value
                        })}
                        placeholder="Enter Cloudflare API token"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowCloudflareToken(!showCloudflareToken)}
                      >
                        {showCloudflareToken ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>CDN Hostname</Label>
                    <Input
                      value={localVideoSettings.cdn_hostname}
                      onChange={(e) => setLocalVideoSettings({
                        ...localVideoSettings,
                        cdn_hostname: e.target.value
                      })}
                      placeholder="cdn.yourdomain.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Point this CNAME to your B2 bucket through Cloudflare
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={handleTestCloudflare}
                    disabled={testCloudflare.isPending || !localVideoSettings.cloudflare_zone_id || !localVideoSettings.cloudflare_api_token}
                    className="w-full"
                  >
                    {testCloudflare.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : testCloudflare.isSuccess ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                        Connected
                      </>
                    ) : (
                      'Test Cloudflare Connection'
                    )}
                  </Button>
                </div>
              )}

              {/* Bunny.net Settings */}
              {(localVideoSettings.primary_provider === 'bunny' || localVideoSettings.primary_provider === 'both') && (
                <div className="space-y-4">
                  <Separator />
                  <h4 className="font-medium">Bunny.net Stream Settings</h4>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Library ID</Label>
                      <Input
                        value={localVideoSettings.bunny_library_id}
                        onChange={(e) => setLocalVideoSettings({
                          ...localVideoSettings,
                          bunny_library_id: e.target.value
                        })}
                        placeholder="your-library-id"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CDN Hostname</Label>
                      <Input
                        value={localVideoSettings.bunny_cdn_hostname}
                        onChange={(e) => setLocalVideoSettings({
                          ...localVideoSettings,
                          bunny_cdn_hostname: e.target.value
                        })}
                        placeholder="vz-xxxxx.b-cdn.net"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="relative">
                      <Input
                        type={showBunnyKey ? "text" : "password"}
                        value={localVideoSettings.bunny_api_key}
                        onChange={(e) => setLocalVideoSettings({
                          ...localVideoSettings,
                          bunny_api_key: e.target.value
                        })}
                        placeholder="Enter Bunny.net API key"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowBunnyKey(!showBunnyKey)}
                      >
                        {showBunnyKey ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Use Bunny for Transcoding</Label>
                      <p className="text-sm text-muted-foreground">
                        Auto-transcode to HLS with multiple qualities
                      </p>
                    </div>
                    <Switch
                      checked={localVideoSettings.use_bunny_for_transcoding}
                      onCheckedChange={(checked) => setLocalVideoSettings({
                        ...localVideoSettings,
                        use_bunny_for_transcoding: checked
                      })}
                    />
                  </div>
                </div>
              )}

              <Separator />

              {/* Quality Settings */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Adaptive Quality Settings
                </h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Adaptive Quality</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically adjust video quality based on network speed
                    </p>
                  </div>
                  <Switch
                    checked={localVideoSettings.enable_adaptive_quality}
                    onCheckedChange={(checked) => setLocalVideoSettings({
                      ...localVideoSettings,
                      enable_adaptive_quality: checked
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Default Quality</Label>
                  <Select
                    value={localVideoSettings.default_quality}
                    onValueChange={(value) => setLocalVideoSettings({
                      ...localVideoSettings,
                      default_quality: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background">
                      <SelectItem value="360p">360p (Low)</SelectItem>
                      <SelectItem value="480p">480p (Medium)</SelectItem>
                      <SelectItem value="720p">720p (HD)</SelectItem>
                      <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Offline Downloads */}
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Offline Downloads
                </h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Offline Downloads</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow students to download recordings for offline viewing
                    </p>
                  </div>
                  <Switch
                    checked={localVideoSettings.enable_offline_downloads}
                    onCheckedChange={(checked) => setLocalVideoSettings({
                      ...localVideoSettings,
                      enable_offline_downloads: checked
                    })}
                  />
                </div>

                {localVideoSettings.enable_offline_downloads && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Max Downloads per User</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={localVideoSettings.max_downloads_per_user}
                        onChange={(e) => setLocalVideoSettings({
                          ...localVideoSettings,
                          max_downloads_per_user: parseInt(e.target.value)
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Download Expiry (Days)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={localVideoSettings.offline_download_expiry_days}
                        onChange={(e) => setLocalVideoSettings({
                          ...localVideoSettings,
                          offline_download_expiry_days: parseInt(e.target.value)
                        })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Auto Transfer Settings */}
              <div className="space-y-4">
                <h4 className="font-medium">BBB Recording Transfer</h4>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-transfer BBB Recordings</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically transfer recordings to CDN when ready
                    </p>
                  </div>
                  <Switch
                    checked={localVideoSettings.auto_transfer_bbb_recordings}
                    onCheckedChange={(checked) => setLocalVideoSettings({
                      ...localVideoSettings,
                      auto_transfer_bbb_recordings: checked
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Delete from BBB After Transfer</Label>
                    <p className="text-sm text-muted-foreground">
                      Free up BBB storage after successful transfer
                    </p>
                  </div>
                  <Switch
                    checked={localVideoSettings.delete_from_bbb_after_transfer}
                    onCheckedChange={(checked) => setLocalVideoSettings({
                      ...localVideoSettings,
                      delete_from_bbb_after_transfer: checked
                    })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  variant="outline"
                  onClick={() => videoSettings && setLocalVideoSettings(videoSettings)}
                >
                  Reset
                </Button>
                <Button
                  onClick={handleSaveVideo}
                  disabled={updateVideoSettings.isPending}
                >
                  {updateVideoSettings.isPending ? "Saving..." : "Save Video Settings"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Video Source Configuration Card - Auto-saves on change */}
      <VideoSourceConfigCard
        settings={localVideoSettings}
        onChange={setLocalVideoSettings}
      />
    </div>
  );
}
