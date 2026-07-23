import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

import { SEOHead } from "@/components/SEO";
import { Footer } from "@/components/Footer";
import { BottomNav } from "@/components/mobile/BottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sparkles, Users, Award, Zap, Shield, Smartphone, ArrowLeft, Loader2, Mail, KeyRound, ChevronRight, MessageSquare, Info, ShieldCheck, Bot, MessageCircle, FileText, Globe, Tag, Quote } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { safeSessionStorage } from "@/lib/safeStorage";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/website-logo.png";

const promos = [
  "Welcome! Start your learning journey",
  "Access 1,000+ courses instantly",
  "Your AI tutor is ready to help",
];

const benefits = [
  { icon: Sparkles, title: "AI-Powered Tutors", description: "Get instant doubt clearing 24/7" },
  { icon: Users, title: "1,00,000+ Students", description: "Join our thriving community" },
  { icon: Award, title: "Certificates", description: "From top institutions" },
  { icon: Zap, title: "Fast Learning", description: "At your own pace" },
  { icon: Shield, title: "Secure & Trusted", description: "Your data is safe" },
  { icon: Smartphone, title: "Learn Anywhere", description: "Web, iOS & Android" },
];

import { SUPABASE_URL } from '@/lib/supabaseUrl';
const SUPABASE_BASE_URL = SUPABASE_URL;

type AuthMethod = "phone" | "emailOtp" | "email";

// Moved outside Auth to prevent re-mount on every state change
const OtpVerifyForm = ({
  onSubmit,
  otp,
  setOtp,
  onBack,
  sentTo,
  onResend,
  buttonText = "Verify & Login",
  loading,
  resendCooldown,
}: {
  onSubmit: (e: React.FormEvent) => void;
  otp: string;
  setOtp: (v: string) => void;
  onBack: () => void;
  sentTo: string;
  onResend: () => void;
  buttonText?: string;
  loading: boolean;
  resendCooldown: number;
}) => (
  <form onSubmit={onSubmit} className="space-y-3">
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
    >
      <ArrowLeft className="h-4 w-4" /> Back
    </button>

    <p className="text-sm text-muted-foreground">
      Enter the 6-digit OTP sent to <span className="font-semibold text-foreground">{sentTo}</span>
    </p>

    <div className="flex justify-center overflow-hidden">
      <InputOTP
        maxLength={6}
        value={otp}
        onChange={(value) => setOtp(value.replace(/\D/g, "").slice(0, 6))}
        autoComplete="one-time-code"
        aria-label="One-time password"
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <InputOTPSlot
              key={index}
              index={index}
              className="h-11 w-9 text-base font-semibold sm:h-12 sm:w-11 sm:text-lg"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>

    <Button type="submit" className="w-full h-12 text-lg" disabled={loading || otp.length !== 6}>
      {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Verifying...</> : buttonText}
    </Button>

    <div className="text-center">
      <button
        type="button"
        onClick={onResend}
        disabled={resendCooldown > 0 || loading}
        className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
      >
        {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : "Resend OTP"}
      </button>
    </div>
  </form>
);

// Moved outside Auth to prevent re-mount on every state change
const MethodToggle = ({ method, setMethod }: { method: AuthMethod; setMethod: (m: AuthMethod) => void }) => (
  <div className="flex gap-1.5 mb-4">
    <Button
      type="button"
      variant={method === "phone" ? "default" : "outline"}
      className="flex-1 h-9 text-xs px-2"
      onClick={() => setMethod("phone")}
    >
      <Smartphone className="h-3.5 w-3.5 mr-1" />
      Phone OTP
    </Button>
    <Button
      type="button"
      variant={method === "emailOtp" ? "default" : "outline"}
      className="flex-1 h-9 text-xs px-2"
      onClick={() => setMethod("emailOtp")}
    >
      <Mail className="h-3.5 w-3.5 mr-1" />
      Email OTP
    </Button>
    <Button
      type="button"
      variant={method === "email" ? "default" : "outline"}
      className="flex-1 h-9 text-xs px-2"
      onClick={() => setMethod("email")}
    >
      <KeyRound className="h-3.5 w-3.5 mr-1" />
      Password
    </Button>
  </div>
);


const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "login");
  const [currentPromo, setCurrentPromo] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mobileMethodSelected, setMobileMethodSelected] = useState(false);
  const isHydrated = useRef(false);
  const isMobile = useIsMobile();

  // Login state
  const [loginMethod, setLoginMethod] = useState<AuthMethod>("phone");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPhoneChannel, setLoginPhoneChannel] = useState<"sms" | "whatsapp">("sms");
  const [loginStep, setLoginStep] = useState<"input" | "otp">("input");
  const [loginOtp, setLoginOtp] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginEmailOtpEmail, setLoginEmailOtpEmail] = useState("");
  const [pinlessLogin, setPinlessLogin] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);

  // Signup state
  const [signupMethod, setSignupMethod] = useState<AuthMethod>("phone");
  const signupPhoneChannel = "sms" as const;
  const [signupStep, setSignupStep] = useState<"details" | "otp">("details");
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    phone: "",
    acceptTerms: false,
  });
  const [signupOtp, setSignupOtp] = useState("");
  const [signupPassword, setSignupPassword] = useState("");

  // Resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);

  // Error dialog state
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorDialogTitle, setErrorDialogTitle] = useState("");
  const [errorDialogMessage, setErrorDialogMessage] = useState("");

  // --- sessionStorage persistence for OTP flow (mobile tab discard fix) ---
  const clearAuthFlowState = useCallback(() => {
    safeSessionStorage.removeItem('auth_flow_state');
  }, []);

  const saveAuthFlowState = useCallback(() => {
    safeSessionStorage.setItem('auth_flow_state', JSON.stringify({
      activeTab, loginMethod, loginStep, loginPhone,
      loginEmailOtpEmail, signupMethod, signupStep,
      signupData, mobileMethodSelected,
    }));
  }, [activeTab, loginMethod, loginStep, loginPhone,
      loginEmailOtpEmail, signupMethod, signupStep,
      signupData, mobileMethodSelected]);

  // Restore state from sessionStorage on mount
  useEffect(() => {
    const saved = safeSessionStorage.getItem('auth_flow_state');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.activeTab) setActiveTab(s.activeTab);
        if (s.loginMethod) setLoginMethod(s.loginMethod);
        if (s.loginStep) setLoginStep(s.loginStep);
        if (s.loginPhone) setLoginPhone(s.loginPhone);
        if (s.loginEmailOtpEmail) setLoginEmailOtpEmail(s.loginEmailOtpEmail);
        if (s.signupMethod) setSignupMethod(s.signupMethod);
        if (s.signupStep) setSignupStep(s.signupStep);
        if (s.signupData) setSignupData(s.signupData);
        if (s.mobileMethodSelected !== undefined) setMobileMethodSelected(s.mobileMethodSelected);
      } catch {}
    }
    // Mark hydration complete after restore so Tabs onValueChange won't reset state
    isHydrated.current = true;
  }, []);

  // Auto-save when on OTP step
  useEffect(() => {
    if (loginStep === 'otp' || signupStep === 'otp') {
      saveAuthFlowState();
    }
  }, [loginStep, signupStep, saveAuthFlowState]);

  useEffect(() => {
    const getRedirectParam = () => {
      const params = new URLSearchParams(window.location.search);
      const r = params.get('redirect');
      // only allow internal paths
      if (r && r.startsWith('/') && !r.startsWith('//')) return r;
      return null;
    };

    const redirectByRole = async (userId: string) => {
      const redirectTo = getRedirectParam();
      if (redirectTo) { navigate(redirectTo, { replace: true }); return; }

      const { data: enr } = await supabase
        .from('enrollments')
        .select('id')
        .eq('student_id', userId)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      navigate(enr ? '/dashboard' : '/');
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectByRole(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        clearAuthFlowState();
        redirectByRole(session.user.id);
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, clearAuthFlowState]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPromo((prev) => (prev + 1) % promos.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // ---- Phone OTP helpers ----
  const sendPhoneOtp = useCallback(async (phone: string, purpose: "login" | "signup", channel: "sms" | "whatsapp" = "sms") => {
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_BASE_URL}/functions/v1/send-phone-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, purpose, channel }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
      toast({ title: "OTP Sent!", description: `OTP sent via ${channelLabel} to ******${data.phone}` });
      setResendCooldown(30);
      return true;
    } catch (error: any) {
      setErrorDialogTitle("Failed to send OTP");
      setErrorDialogMessage(error.message || String(error));
      setErrorDialogOpen(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyPhoneOtp = useCallback(async (
    phone: string,
    otpCode: string,
    purpose: "login" | "signup",
    signupInfo?: { full_name: string; email: string }
  ) => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(
        `${SUPABASE_BASE_URL}/functions/v1/verify-phone-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, otp_code: otpCode, purpose, signup_data: signupInfo }),
          signal: controller.signal,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      toast({
        title: purpose === "login" ? "Welcome back!" : "Account Created!",
        description: purpose === "login" ? "You've successfully logged in." : "Welcome to SimpleLecture!",
      });
    } catch (error: any) {
      const message = error.name === 'AbortError'
        ? 'Request timed out. Please check your connection and try again.'
        : (error.message || String(error));
      setErrorDialogTitle("Phone OTP Verification Failed");
      setErrorDialogMessage(message);
      setErrorDialogOpen(true);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  // ---- Email OTP helpers ----
  const sendEmailOtp = useCallback(async (emailAddr: string, purpose: "login" | "signup") => {
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_BASE_URL}/functions/v1/send-email-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailAddr, purpose }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send OTP");

      toast({ title: "OTP Sent!", description: `OTP sent to ${data.email}` });
      setResendCooldown(30);
      return true;
    } catch (error: any) {
      setErrorDialogTitle("Failed to send Email OTP");
      setErrorDialogMessage(error.message || String(error));
      setErrorDialogOpen(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyEmailOtp = useCallback(async (
    emailAddr: string,
    otpCode: string,
    purpose: "login" | "signup",
    signupInfo?: { full_name: string; phone: string }
  ) => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(
        `${SUPABASE_BASE_URL}/functions/v1/verify-email-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: emailAddr, otp_code: otpCode, purpose, signup_data: signupInfo }),
          signal: controller.signal,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }

      toast({
        title: purpose === "login" ? "Welcome back!" : "Account Created!",
        description: purpose === "login" ? "You've successfully logged in." : "Welcome to SimpleLecture!",
      });
    } catch (error: any) {
      const message = error.name === 'AbortError'
        ? 'Request timed out. Please check your connection and try again.'
        : (error.message || String(error));
      setErrorDialogTitle("Email OTP Verification Failed");
      setErrorDialogMessage(message);
      setErrorDialogOpen(true);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }, []);

  // ---- Login handlers ----
  const handleLoginSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await sendPhoneOtp(loginPhone, "login", loginPhoneChannel);
    if (success) setLoginStep("otp");
  };

  const handleLoginVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyPhoneOtp(loginPhone, loginOtp, "login");
  };

  const handleLoginSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await sendEmailOtp(loginEmailOtpEmail, "login");
    if (success) setLoginStep("otp");
  };

  const handleLoginVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyEmailOtp(loginEmailOtpEmail, loginOtp, "login");
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      toast({ title: "Welcome back!", description: "You've successfully logged in." });
    } catch (error: any) {
      toast({ title: "Login Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ---- Signup handlers ----
  const handleSignupSendPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupData.acceptTerms) {
      toast({ title: "Accept Terms", description: "Please accept the terms and conditions.", variant: "destructive" });
      return;
    }
    const success = await sendPhoneOtp(signupData.phone, "signup", signupPhoneChannel);
    if (success) setSignupStep("otp");
  };

  const handleSignupVerifyPhoneOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyPhoneOtp(signupData.phone, signupOtp, "signup", {
      full_name: signupData.fullName,
      email: signupData.email,
    });
  };

  const handleSignupSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupData.acceptTerms) {
      toast({ title: "Accept Terms", description: "Please accept the terms and conditions.", variant: "destructive" });
      return;
    }
    const success = await sendEmailOtp(signupData.email, "signup");
    if (success) setSignupStep("otp");
  };

  const handleSignupVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyEmailOtp(signupData.email, signupOtp, "signup", {
      full_name: signupData.fullName,
      phone: signupData.phone,
    });
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupData.acceptTerms) {
      toast({ title: "Accept Terms", description: "Please accept the terms and conditions.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupPassword,
        options: {
          data: {
            full_name: signupData.fullName,
            phone: signupData.phone.replace(/\D/g, ''),
          },
        },
      });
      if (error) throw error;
      toast({ title: "Account Created!", description: "Please check your email to verify your account." });
    } catch (error: any) {
      toast({ title: "Signup Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  const handleResendPhone = async (phone: string, purpose: "login" | "signup", channel: "sms" | "whatsapp" = "sms") => {
    if (resendCooldown > 0) return;
    await sendPhoneOtp(phone, purpose, channel);
  };

  const handleResendEmail = async (emailAddr: string, purpose: "login" | "signup") => {
    if (resendCooldown > 0) return;
    await sendEmailOtp(emailAddr, purpose);
  };

  // Google OAuth handler
  const handleGoogleSignIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      toast({ title: "Google Sign-In Failed", description: error.message, variant: "destructive" });
    }
  };

  const GoogleButton = () => (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      className="w-full flex items-center justify-center gap-3 h-12 px-6 rounded-xl bg-card border border-border shadow-sm active:scale-[0.98] transition-all hover:bg-accent"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      <span className="font-semibold text-foreground">Continue with Google</span>
    </button>
  );


  const OrDivider = () => (
    <div className="flex items-center gap-3 my-3">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs text-muted-foreground font-semibold tracking-wider">OR</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );


  // MethodToggle is now defined outside Auth component

  return (
    <>
      <SEOHead
        title={activeTab === "login" ? "Login - SimpleLecture | Access Your Courses" : "Sign Up - SimpleLecture | Start Learning Today"}
        description={activeTab === "login" ? "Login to SimpleLecture to continue your learning journey." : "Join 1,00,000+ students on SimpleLecture."}
        keywords="login, sign up, online learning India, SimpleLecture, NEET, JEE, board exams"
        canonicalUrl={`https://simplelecture.com/auth?tab=${activeTab}`}
      />

      {/* Header - mobile only; desktop uses the in-page logo on the left promo column */}
      <div className="hidden">
        <div className="container mx-auto px-4 py-4">
          <Link to="/"><img src={logo} alt="SimpleLecture" className="h-12" /></Link>
        </div>
      </div>

      <div className="min-h-screen bg-background pt-2 md:pt-6 pb-10 md:pb-6">
        <div className="container mx-auto px-4 md:px-8 py-2 md:py-4 pb-safe">
          <div className="md:grid md:grid-cols-2 md:gap-8 max-w-7xl mx-auto items-center">
            {/* Left promo panel (desktop only) */}
            <aside className="hidden md:flex flex-col gap-8 pr-4">
              <Link to="/" className="flex items-center gap-3">
                <img src={logo} alt="SimpleLecture" className="h-10" />
              </Link>

              <div>
                <h1 className="text-5xl font-bold leading-tight tracking-tight text-foreground">
                  Learn Smarter
                  <br />
                  <span className="text-primary">with AI</span>
                </h1>
                <p className="mt-4 text-base text-muted-foreground max-w-md">
                  AI-powered platform for SSLC, CET, JEE & NEET concepts. Learn anytime, clear doubts instantly.
                </p>
              </div>

              <div className="grid grid-cols-5 gap-3 max-w-lg">
                {[
                  { icon: Bot, label: "AI Avatar Teacher" },
                  { icon: MessageCircle, label: "Instant Doubt Solving" },
                  { icon: FileText, label: "Mock Tests & DPPs" },
                  { icon: Globe, label: "Kannada & English Support" },
                  { icon: Tag, label: "₹1000 Per Year" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center text-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-accent/60 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-xs leading-tight text-foreground">{label}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl bg-accent/40 border border-primary/10 p-5 max-w-lg">
                <Quote className="h-6 w-6 text-primary/60 mb-2" />
                <p className="italic text-sm text-foreground">
                  Learning with Simple Lecture's AI has made studying easier and more engaging.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-sm font-semibold text-primary">
                    AS
                  </div>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-foreground">Ananya S.</p>
                    <p className="text-xs text-muted-foreground">SSLC Student, Karnataka</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-primary" />
                <span>Trusted by students across Karnataka</span>
              </div>
            </aside>

            {/* Right column: auth card */}
            <div className="max-w-md w-full mx-auto md:mx-0">
              <div className="flex items-center">

              <Card className="w-full shadow-none border-0 bg-transparent md:shadow-xl md:border md:bg-card md:rounded-2xl">
                <CardContent className="p-0 md:p-6">
                  <Tabs value={activeTab} onValueChange={(v) => {
                    setActiveTab(v);
                    // Only reset state on genuine user interaction, not during hydration restore
                    if (isHydrated.current) {
                      setLoginStep("input");
                      setSignupStep("details");
                      setLoginOtp("");
                      setSignupOtp("");
                      setSignupMethod("phone");
                      setLoginMethod("phone");
                      setSignupPassword("");
                      setMobileMethodSelected(false);
                    }
                  }} className="w-full">
                    <TabsList className="hidden md:grid w-full grid-cols-2 mb-4 p-1 h-12 rounded-xl bg-[hsl(140_30%_92%)]">
                      <TabsTrigger
                        value="login"
                        className="rounded-lg h-10 text-sm font-semibold data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm text-muted-foreground"
                      >
                        Login
                      </TabsTrigger>
                      <TabsTrigger
                        value="signup"
                        className="rounded-lg h-10 text-sm font-semibold data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm text-muted-foreground"
                      >
                        Sign Up
                      </TabsTrigger>
                    </TabsList>


                    {/* ===== LOGIN TAB ===== */}
                    <TabsContent value="login">
                      {isMobile && !mobileMethodSelected ? (
                        <div className="flex flex-col min-h-[calc(100vh-12rem)]">
                          {/* Heading */}
                          <div className="text-left">
                            <h2 className="text-2xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary">
                              Let's Sign You In 👋
                            </h2>
                            <p className="text-muted-foreground">Welcome back, you've been missed!</p>
                          </div>

                          {/* Logo with gradient glow */}
                          <div className="flex justify-center mb-4">
                            <div className="relative">
                              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-primary/30 blur-xl scale-150" />
                              <img src={logo} alt="SimpleLecture" className="h-16 w-auto max-w-[200px] relative z-10" />
                            </div>
                          </div>

                          {/* Method buttons */}
                          <div className="mt-auto space-y-3">
                            <button
                              type="button"
                              onClick={() => { setLoginMethod("phone"); setMobileMethodSelected(true); }}
                              className="w-full flex items-center justify-center gap-3 h-13 px-6 py-3 rounded-2xl bg-card border border-border/50 shadow-sm active:scale-[0.98] transition-all"
                            >
                              <Smartphone className="h-5 w-5 text-foreground" />
                              <span className="font-medium text-foreground">Continue with Phone OTP</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => { setLoginMethod("emailOtp"); setMobileMethodSelected(true); }}
                              className="w-full flex items-center justify-center gap-3 h-13 px-6 py-3 rounded-2xl bg-card border border-border/50 shadow-sm active:scale-[0.98] transition-all"
                            >
                              <Mail className="h-5 w-5 text-foreground" />
                              <span className="font-medium text-foreground">Continue with Email OTP</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => { setLoginMethod("email"); setMobileMethodSelected(true); }}
                              className="w-full flex items-center justify-center gap-3 h-13 px-6 py-3 rounded-2xl bg-card border border-border/50 shadow-sm active:scale-[0.98] transition-all"
                            >
                              <KeyRound className="h-5 w-5 text-foreground" />
                              <span className="font-medium text-foreground">Continue with Password</span>
                            </button>
                          </div>

                          {/* Bottom toggle */}
                          <p className="text-center text-sm text-muted-foreground pt-2">
                            Don't have an account?{" "}
                            <button type="button" onClick={() => setActiveTab("signup")} className="text-primary font-semibold hover:underline">
                              Sign Up
                            </button>
                          </p>
                        </div>
                      ) : (
                        <div className="mb-4">
                          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-primary">Welcome Back!</h2>
                          <p className="text-muted-foreground">Continue your learning journey</p>
                        </div>
                      )}


                      {/* Mobile Step 2 back button + method chip */}
                      {isMobile && mobileMethodSelected && (
                        <div className="mb-5 space-y-3">
                          <button
                            type="button"
                            onClick={() => setMobileMethodSelected(false)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 text-sm font-medium text-foreground active:scale-95 transition-all"
                          >
                            <ArrowLeft className="h-4 w-4" /> Back to options
                          </button>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              loginMethod === "phone" ? "bg-gradient-to-br from-primary to-primary" :
                              loginMethod === "emailOtp" ? "bg-gradient-to-br from-primary to-cyan-500" :
                              "bg-gradient-to-br from-amber-500 to-orange-500"
                            }`}>
                              {loginMethod === "phone" ? <Smartphone className="h-4 w-4 text-white" /> :
                               loginMethod === "emailOtp" ? <Mail className="h-4 w-4 text-white" /> :
                               <KeyRound className="h-4 w-4 text-white" />}
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {loginMethod === "phone" ? "Phone OTP" : loginMethod === "emailOtp" ? "Email OTP" : "Password"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Pinless Login toggle (visible on all sizes) */}
                      {(!isMobile || mobileMethodSelected) && (
                        <div className="mb-4 flex items-center gap-2 flex-wrap">
                          <Checkbox
                            id="pinless-login"
                            checked={pinlessLogin}
                            onCheckedChange={(v) => {
                              const checked = v === true;
                              setPinlessLogin(checked);
                              if (checked) {
                                if (loginMethod === "email") setLoginMethod("phone");
                              } else {
                                setLoginMethod("email");
                              }
                            }}
                          />
                          <Label htmlFor="pinless-login" className="cursor-pointer text-sm font-medium">
                            Login with OTP (Pinless Login)
                          </Label>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent text-accent-foreground border border-primary/20">
                            Recommended
                          </span>
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="More info">
                                  <Info className="h-4 w-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs">
                                Skip your password — we'll send a one-time code to your phone or email.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      )}

                      {/* Passwordless info card */}
                      {pinlessLogin && (!isMobile || mobileMethodSelected) && loginMethod !== "email" && loginStep === "input" && (
                        <div className="mb-5 flex gap-3 p-4 rounded-xl bg-accent/40 border border-primary/20">
                          <div className="shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-primary">Passwordless Login</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              We'll send a one-time code to your registered number or email — no password needed.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Desktop: Google + MethodToggle */}
                      <div className="hidden md:block">
                        <MethodToggle method={loginMethod} setMethod={setLoginMethod} />
                      </div>

                      {/* Show form fields: always on desktop, only after method selected on mobile */}
                      {(!isMobile || mobileMethodSelected) && (
                        <>

                      {/* Phone OTP Login */}
                      {loginMethod === "phone" && (
                        <>
                          {loginStep === "input" ? (
                            <form onSubmit={handleLoginSendPhoneOtp} className="space-y-3">
                              <div>
                                <Label htmlFor="login-phone">Phone Number</Label>
                                <div className="flex gap-2 mt-1">
                                  <div className="w-16 flex items-center justify-center bg-muted rounded-md border border-0 border-b border-muted-foreground/30 rounded-none md:rounded-md md:border md:bg-muted">
                                    <span className="text-sm font-medium">+91</span>
                                  </div>
                                  <Input
                                    id="login-phone"
                                    type="tel"
                                    placeholder="9876543210"
                                    maxLength={10}
                                    value={loginPhone}
                                    onChange={(e) => setLoginPhone(e.target.value.replace(/\D/g, ''))}
                                    required
                                    className="flex-1 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                                  />
                                </div>
                              </div>

                              {/* Channel Toggle */}
                              <div>
                                <Label className="text-xs text-muted-foreground mb-1 block">Send OTP via</Label>
                                <div className="flex gap-2">
                                  <Button type="button" variant={loginPhoneChannel === "sms" ? "default" : "outline"} size="sm" className="flex-1 h-8 text-xs" onClick={() => setLoginPhoneChannel("sms")}>
                                    <Smartphone className="h-3.5 w-3.5 mr-1" /> SMS
                                  </Button>
                                  <Button type="button" variant={loginPhoneChannel === "whatsapp" ? "default" : "outline"} size="sm" className="flex-1 h-8 text-xs" onClick={() => setLoginPhoneChannel("whatsapp")}>
                                    <MessageSquare className="h-3.5 w-3.5 mr-1" /> WhatsApp
                                  </Button>
                                </div>
                              </div>

                              <Button type="submit" className="w-full h-11 text-base rounded-full md:rounded-md bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary-dark md:from-primary md:to-primary md:hover:from-primary/90 md:hover:to-primary/90" disabled={loading || loginPhone.length !== 10}>
                                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Sending OTP...</> : "Send OTP"}
                              </Button>

                              <div className="text-center">
                                <Link to="/forgot-password" className="text-sm text-primary hover:underline">Forgot Password?</Link>
                              </div>

                            </form>
                          ) : (
                            <OtpVerifyForm
                              onSubmit={handleLoginVerifyPhoneOtp}
                              otp={loginOtp}
                              setOtp={setLoginOtp}
                              onBack={() => { setLoginStep("input"); setLoginOtp(""); clearAuthFlowState(); }}
                              sentTo={`+91 ${loginPhone}`}
                              onResend={() => handleResendPhone(loginPhone, "login", loginPhoneChannel)}
                              buttonText="Verify & Login"
                              loading={loading}
                              resendCooldown={resendCooldown}
                            />
                          )}
                        </>
                      )}

                      {/* Email OTP Login */}
                      {loginMethod === "emailOtp" && (
                        <>
                          {loginStep === "input" ? (
                            <form onSubmit={handleLoginSendEmailOtp} className="space-y-3">
                              <div>
                                <Label htmlFor="login-email-otp">Email Address</Label>
                                <div className="relative mt-1">
                                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground md:hidden" />
                                  <Input
                                    id="login-email-otp"
                                    type="email"
                                    placeholder="your.email@example.com"
                                    value={loginEmailOtpEmail}
                                    onChange={(e) => setLoginEmailOtpEmail(e.target.value)}
                                    required
                                    className="pl-10 md:pl-3 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                                  />
                                </div>
                              </div>

                              <Button type="submit" className="w-full h-11 text-base rounded-full md:rounded-md bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary-dark md:from-primary md:to-primary md:hover:from-primary/90 md:hover:to-primary/90" disabled={loading || !loginEmailOtpEmail}>
                                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Sending OTP...</> : "Send OTP to Email"}
                              </Button>

                              <div className="text-center">
                                <Link to="/forgot-password" className="text-sm text-primary hover:underline">Forgot Password?</Link>
                              </div>

                            </form>
                          ) : (
                            <OtpVerifyForm
                              onSubmit={handleLoginVerifyEmailOtp}
                              otp={loginOtp}
                              setOtp={setLoginOtp}
                              onBack={() => { setLoginStep("input"); setLoginOtp(""); clearAuthFlowState(); }}
                              sentTo={loginEmailOtpEmail}
                              onResend={() => handleResendEmail(loginEmailOtpEmail, "login")}
                              buttonText="Verify & Login"
                              loading={loading}
                              resendCooldown={resendCooldown}
                            />
                          )}
                        </>
                      )}

                      {/* Email + Password Login */}
                      {loginMethod === "email" && (
                        <form onSubmit={handleEmailLogin} className="space-y-3">
                          <div>
                            <Label htmlFor="login-email">Email</Label>
                            <div className="relative mt-1">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground md:hidden" />
                              <Input
                                id="login-email"
                                type="email"
                                placeholder="your.email@example.com"
                                value={loginEmail}
                                onChange={(e) => setLoginEmail(e.target.value)}
                                required
                                className="pl-10 md:pl-3 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="login-password">Password</Label>
                            <div className="relative mt-1">
                              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground md:hidden" />
                              <Input
                                id="login-password"
                                type="password"
                                placeholder="Enter your password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                required
                                className="pl-10 md:pl-3 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id="remember-me"
                                checked={rememberMe}
                                onCheckedChange={(v) => setRememberMe(v === true)}
                              />
                              <Label htmlFor="remember-me" className="cursor-pointer text-sm">Remember me</Label>
                            </div>
                            <Link to="/forgot-password" className="text-sm text-primary hover:underline">Forgot Password?</Link>
                          </div>

                          <Button type="submit" className="w-full h-11 text-base rounded-full md:rounded-md bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary-dark md:from-primary md:to-primary md:hover:from-primary/90 md:hover:to-primary/90" disabled={loading || !loginEmail || !loginPassword}>
                            {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Logging in...</> : "Login"}
                          </Button>


                          
                        </form>
                      )}
                      </>
                      )}
                    </TabsContent>

                    {/* ===== SIGN UP TAB ===== */}
                    <TabsContent value="signup">
                      {/* Desktop heading */}
                      {!isMobile && (
                        <div className="mb-4">
                          <h2 className="text-2xl md:text-3xl font-bold mb-2 text-primary">Create Your Account</h2>
                          <p className="text-muted-foreground">Start your learning journey today</p>

                        </div>
                      )}

                      {/* Mobile Step 1: Method Selection */}
                      {isMobile && !mobileMethodSelected && (
                        <div className="flex flex-col min-h-[calc(100vh-12rem)]">
                          {/* Mobile heading */}
                          <div className="text-left">
                            <h2 className="text-2xl font-bold mb-1 text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary">Getting Started 🚀</h2>
                            <p className="text-muted-foreground text-sm">Create an account to continue!</p>
                          </div>
                          {/* Logo with gradient glow */}
                          <div className="flex justify-center mb-4">
                            <div className="relative">
                              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/30 to-primary/30 blur-xl scale-150" />
                              <img src={logo} alt="SimpleLecture" className="h-16 w-auto max-w-[200px] relative z-10" />
                            </div>
                          </div>

                          {/* Method buttons */}
                          <div className="mt-auto space-y-3">
                            <button
                              type="button"
                              onClick={() => { setSignupMethod("phone"); setMobileMethodSelected(true); }}
                              className="w-full flex items-center justify-center gap-3 h-13 px-6 py-3 rounded-2xl bg-card border border-border/50 shadow-sm active:scale-[0.98] transition-all"
                            >
                              <Smartphone className="h-5 w-5 text-foreground" />
                              <span className="font-medium text-foreground">Continue with Phone OTP</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => { setSignupMethod("emailOtp"); setMobileMethodSelected(true); }}
                              className="w-full flex items-center justify-center gap-3 h-13 px-6 py-3 rounded-2xl bg-card border border-border/50 shadow-sm active:scale-[0.98] transition-all"
                            >
                              <Mail className="h-5 w-5 text-foreground" />
                              <span className="font-medium text-foreground">Continue with Email OTP</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => { setSignupMethod("email"); setMobileMethodSelected(true); }}
                              className="w-full flex items-center justify-center gap-3 h-13 px-6 py-3 rounded-2xl bg-card border border-border/50 shadow-sm active:scale-[0.98] transition-all"
                            >
                              <KeyRound className="h-5 w-5 text-foreground" />
                              <span className="font-medium text-foreground">Continue with Password</span>
                            </button>
                          </div>

                          {/* Bottom toggle */}
                          <p className="text-center text-sm text-muted-foreground pt-2">
                            Already have an account?{" "}
                            <button type="button" onClick={() => setActiveTab("login")} className="text-primary font-semibold hover:underline">
                              Login
                            </button>
                          </p>
                        </div>
                      )}

                      {/* Mobile Step 2 back button + method chip */}
                      {isMobile && mobileMethodSelected && (
                        <div className="mb-5 space-y-3">
                          <button
                            type="button"
                            onClick={() => setMobileMethodSelected(false)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 text-sm font-medium text-foreground active:scale-95 transition-all"
                          >
                            <ArrowLeft className="h-4 w-4" /> Back to options
                          </button>
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              signupMethod === "phone" ? "bg-gradient-to-br from-primary to-primary" :
                              signupMethod === "emailOtp" ? "bg-gradient-to-br from-primary to-cyan-500" :
                              "bg-gradient-to-br from-amber-500 to-orange-500"
                            }`}>
                              {signupMethod === "phone" ? <Smartphone className="h-4 w-4 text-white" /> :
                               signupMethod === "emailOtp" ? <Mail className="h-4 w-4 text-white" /> :
                               <KeyRound className="h-4 w-4 text-white" />}
                            </div>
                            <span className="text-sm font-medium text-foreground">
                              {signupMethod === "phone" ? "Phone OTP" : signupMethod === "emailOtp" ? "Email OTP" : "Password"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Desktop: Google + MethodToggle */}
                      <div className="hidden md:block">
                        <MethodToggle method={signupMethod} setMethod={setSignupMethod} />
                      </div>

                      {/* Show form fields: always on desktop, only after method selected on mobile */}
                      {(!isMobile || mobileMethodSelected) && (
                        <>

                      {/* Phone OTP Signup */}
                      {signupMethod === "phone" && (
                        <>
                          {signupStep === "details" ? (
                            <form onSubmit={handleSignupSendPhoneOtp} className="space-y-3">
                              <div>
                                <Label htmlFor="fullName">Full Name *</Label>
                                <div className="relative mt-1">
                                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground md:hidden" />
                                  <Input
                                    id="fullName"
                                    type="text"
                                    placeholder="Enter your full name"
                                    value={signupData.fullName}
                                    onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                                    required
                                    className="pl-10 md:pl-3 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                                  />
                                </div>
                              </div>

                              <div>
                                <Label htmlFor="signup-email">Email *</Label>
                                <div className="relative mt-1">
                                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground md:hidden" />
                                  <Input
                                    id="signup-email"
                                    type="email"
                                    placeholder="your.email@example.com"
                                    value={signupData.email}
                                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                                    required
                                    className="pl-10 md:pl-3 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                                  />
                                </div>
                              </div>

                              <div>
                                <Label htmlFor="signup-phone">Phone Number *</Label>
                                <div className="flex gap-2 mt-1">
                                  <div className="w-16 flex items-center justify-center bg-muted rounded-md border border-0 border-b border-muted-foreground/30 rounded-none md:rounded-md md:border md:bg-muted">
                                    <span className="text-sm font-medium">+91</span>
                                  </div>
                                  <Input
                                    id="signup-phone"
                                    type="tel"
                                    placeholder="9876543210"
                                    maxLength={10}
                                    value={signupData.phone}
                                    onChange={(e) => setSignupData({ ...signupData, phone: e.target.value.replace(/\D/g, '') })}
                                    required
                                    className="flex-1 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                                  />
                                </div>
                              </div>

                              <div className="flex items-start gap-2">
                                <Checkbox
                                  id="terms"
                                  checked={signupData.acceptTerms}
                                  onCheckedChange={(checked) => setSignupData({ ...signupData, acceptTerms: checked as boolean })}
                                />
                                <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                                  I accept the <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                                </Label>
                              </div>


                              <Button type="submit" className="w-full h-11 text-base rounded-full md:rounded-md bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary-dark md:from-primary md:to-primary md:hover:from-primary/90 md:hover:to-primary/90" disabled={!signupData.acceptTerms || loading || signupData.phone.length !== 10}>
                                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Sending OTP...</> : "Send OTP & Sign Up"}
                              </Button>

                            </form>
                          ) : (
                            <OtpVerifyForm
                              onSubmit={handleSignupVerifyPhoneOtp}
                              otp={signupOtp}
                              setOtp={setSignupOtp}
                              onBack={() => { setSignupStep("details"); setSignupOtp(""); clearAuthFlowState(); }}
                              sentTo={`+91 ${signupData.phone}`}
                              onResend={() => handleResendPhone(signupData.phone, "signup", signupPhoneChannel)}
                              buttonText="Verify & Create Account"
                              loading={loading}
                              resendCooldown={resendCooldown}
                            />
                          )}
                        </>
                      )}

                      {/* Email OTP Signup */}
                      {signupMethod === "emailOtp" && (
                        <>
                          {signupStep === "details" ? (
                            <form onSubmit={handleSignupSendEmailOtp} className="space-y-3">
                              <div>
                                <Label htmlFor="fullName-eotp">Full Name *</Label>
                                <div className="relative mt-1">
                                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground md:hidden" />
                                  <Input
                                    id="fullName-eotp"
                                    type="text"
                                    placeholder="Enter your full name"
                                    value={signupData.fullName}
                                    onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                                    required
                                    className="pl-10 md:pl-3 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                                  />
                                </div>
                              </div>

                              <div>
                                <Label htmlFor="signup-email-eotp">Email *</Label>
                                <div className="relative mt-1">
                                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground md:hidden" />
                                  <Input
                                    id="signup-email-eotp"
                                    type="email"
                                    placeholder="your.email@example.com"
                                    value={signupData.email}
                                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                                    required
                                    className="pl-10 md:pl-3 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                                  />
                                </div>
                              </div>

                              <div>
                                <Label htmlFor="signup-phone-eotp">Phone Number *</Label>
                                <div className="flex gap-2 mt-1">
                                  <div className="w-16 flex items-center justify-center bg-muted rounded-md border border-0 border-b border-muted-foreground/30 rounded-none md:rounded-md md:border md:bg-muted">
                                    <span className="text-sm font-medium">+91</span>
                                  </div>
                                  <Input
                                    id="signup-phone-eotp"
                                    type="tel"
                                    placeholder="9876543210"
                                    maxLength={10}
                                    value={signupData.phone}
                                    onChange={(e) => setSignupData({ ...signupData, phone: e.target.value.replace(/\D/g, '') })}
                                    required
                                    className="flex-1 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                                  />
                                </div>
                              </div>

                              <div className="flex items-start gap-2">
                                <Checkbox
                                  id="terms-eotp"
                                  checked={signupData.acceptTerms}
                                  onCheckedChange={(checked) => setSignupData({ ...signupData, acceptTerms: checked as boolean })}
                                />
                                <Label htmlFor="terms-eotp" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                                  I accept the <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                                </Label>
                              </div>

                              <Button type="submit" className="w-full h-11 text-base rounded-full md:rounded-md bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary-dark md:from-primary md:to-primary md:hover:from-primary/90 md:hover:to-primary/90" disabled={!signupData.acceptTerms || loading || !signupData.email}>
                                {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Sending OTP...</> : "Send OTP to Email"}
                              </Button>

                            </form>
                          ) : (
                            <OtpVerifyForm
                              onSubmit={handleSignupVerifyEmailOtp}
                              otp={signupOtp}
                              setOtp={setSignupOtp}
                              onBack={() => { setSignupStep("details"); setSignupOtp(""); clearAuthFlowState(); }}
                              sentTo={signupData.email}
                              onResend={() => handleResendEmail(signupData.email, "signup")}
                              buttonText="Verify & Create Account"
                              loading={loading}
                              resendCooldown={resendCooldown}
                            />
                          )}
                        </>
                      )}

                      {/* Email + Password Signup */}
                      {signupMethod === "email" && (
                        <form onSubmit={handleEmailSignup} className="space-y-3">
                          <div>
                            <Label htmlFor="signup-fullname-email">Full Name *</Label>
                            <div className="relative mt-1">
                              <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground md:hidden" />
                              <Input
                                id="signup-fullname-email"
                                type="text"
                                placeholder="Enter your full name"
                                value={signupData.fullName}
                                onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                                required
                                className="pl-10 md:pl-3 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="signup-email-method">Email *</Label>
                            <div className="relative mt-1">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground md:hidden" />
                              <Input
                                id="signup-email-method"
                                type="email"
                                placeholder="your.email@example.com"
                                value={signupData.email}
                                onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                                required
                                className="pl-10 md:pl-3 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="signup-password">Password *</Label>
                            <div className="relative mt-1">
                              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground md:hidden" />
                              <Input
                                id="signup-password"
                                type="password"
                                placeholder="Create a password (min 6 characters)"
                                value={signupPassword}
                                onChange={(e) => setSignupPassword(e.target.value)}
                                required
                                minLength={6}
                                className="pl-10 md:pl-3 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                              />
                            </div>
                          </div>

                          <div className="flex items-start gap-2">
                            <Checkbox
                              id="terms-email"
                              checked={signupData.acceptTerms}
                              onCheckedChange={(checked) => setSignupData({ ...signupData, acceptTerms: checked as boolean })}
                            />
                            <Label htmlFor="terms-email" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                              I accept the <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                            </Label>
                          </div>

                          <Button type="submit" className="w-full h-11 text-base rounded-full md:rounded-md bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary-dark md:from-primary md:to-primary md:hover:from-primary/90 md:hover:to-primary/90" disabled={!signupData.acceptTerms || loading || !signupData.email || !signupPassword || signupPassword.length < 6}>
                            {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Creating Account...</> : "Create Account"}
                          </Button>

                          
                        </form>
                      )}
                      </>
                      )}
                    </TabsContent>
                  </Tabs>

                  <div className="mt-6">
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Shield className="h-3.5 w-3.5" />
                      <span>Your data is safe and secure with us</span>
                    </div>
                  </div>

                </CardContent>
              </Card>

            </div>
            </div>
          </div>
        </div>
      </div>


      <div className="hidden md:block">
        <Footer />
      </div>

      {/* Error Dialog */}
      <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{errorDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap break-words text-left">
              {errorDialogMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorDialogOpen(false)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BottomNav />
    </>
  );
};

export default Auth;
