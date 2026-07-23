import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Smartphone, Mail, KeyRound, ArrowLeft, Loader2, UserCheck, MessageSquare } from 'lucide-react';
import { safeSessionStorage } from '@/lib/safeStorage';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

import { SUPABASE_URL } from '@/lib/supabaseUrl';
const SUPABASE_BASE_URL = SUPABASE_URL;

type AuthMethod = 'phone' | 'emailOtp' | 'email';
type Step = 'input' | 'otp';

interface EnrollAuthStepProps {
  onAuthenticated: (data: { fullName: string; email: string; phone: string }) => void;
}

const MethodToggle = ({ method, setMethod }: { method: AuthMethod; setMethod: (m: AuthMethod) => void }) => (
  <div className="flex gap-1.5 mb-4">
    <Button type="button" variant={method === 'phone' ? 'default' : 'outline'} className="flex-1 h-9 text-xs px-2" onClick={() => setMethod('phone')}>
      <Smartphone className="h-3.5 w-3.5 mr-1" /> Phone OTP
    </Button>
    <Button type="button" variant={method === 'emailOtp' ? 'default' : 'outline'} className="flex-1 h-9 text-xs px-2" onClick={() => setMethod('emailOtp')}>
      <Mail className="h-3.5 w-3.5 mr-1" /> Email OTP
    </Button>
    <Button type="button" variant={method === 'email' ? 'default' : 'outline'} className="flex-1 h-9 text-xs px-2" onClick={() => setMethod('email')}>
      <KeyRound className="h-3.5 w-3.5 mr-1" /> Password
    </Button>
  </div>
);

const OtpInput = ({ otp, setOtp, onBack, sentTo, onResend, loading, resendCooldown, onSubmit }: {
  otp: string; setOtp: (v: string) => void; onBack: () => void; sentTo: string;
  onResend: () => void; loading: boolean; resendCooldown: number; onSubmit: (e: React.FormEvent) => void;
}) => (
  <form onSubmit={onSubmit} className="space-y-4">
    <button type="button" onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
    <p className="text-sm text-muted-foreground">
      Enter the 6-digit OTP sent to <span className="font-semibold text-foreground">{sentTo}</span>
    </p>
    <div className="flex justify-center">
      <InputOTP
        maxLength={6}
        value={otp}
        onChange={(v) => setOtp(v.replace(/\D/g, ''))}
        autoComplete="one-time-code"
      >
        <InputOTPGroup>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <InputOTPSlot
              key={i}
              index={i}
              className="h-11 w-9 sm:h-12 sm:w-11 text-base sm:text-lg font-semibold"
            />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
    <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : 'Verify & Continue'}
    </Button>
    <div className="text-center">
      <button type="button" onClick={onResend} disabled={resendCooldown > 0 || loading}
        className="text-sm text-primary hover:underline disabled:text-muted-foreground">
        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
      </button>
    </div>
  </form>
);

export const EnrollAuthStep = ({ onAuthenticated }: EnrollAuthStepProps) => {
  const [method, setMethod] = useState<AuthMethod>('phone');
  const [step, setStep] = useState<Step>('input');
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneChannel, setPhoneChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Whether we're doing login or signup - use "signup" always since we collect name
  const [isNewUser, setIsNewUser] = useState(true);

  // --- sessionStorage persistence for OTP flow (mobile tab discard fix) ---
  const clearEnrollAuthFlowState = useCallback(() => {
    safeSessionStorage.removeItem('enroll_auth_flow_state');
  }, []);

  const saveEnrollAuthFlowState = useCallback(() => {
    safeSessionStorage.setItem('enroll_auth_flow_state', JSON.stringify({
      method, step, fullName, phone, email, isNewUser,
    }));
  }, [method, step, fullName, phone, email, isNewUser]);

  // Restore state on mount
  useEffect(() => {
    const saved = safeSessionStorage.getItem('enroll_auth_flow_state');
    if (saved) {
      try {
        const s = JSON.parse(saved);
        if (s.method) setMethod(s.method);
        if (s.step) setStep(s.step);
        if (s.fullName) setFullName(s.fullName);
        if (s.phone) setPhone(s.phone);
        if (s.email) setEmail(s.email);
        if (s.isNewUser !== undefined) setIsNewUser(s.isNewUser);
      } catch {}
    }
  }, []);

  // Auto-save when on OTP step
  useEffect(() => {
    if (step === 'otp') {
      saveEnrollAuthFlowState();
    }
  }, [step, saveEnrollAuthFlowState]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  const showError = (title: string, msg: string) => {
    setErrorTitle(title);
    setErrorMessage(msg);
    setErrorDialogOpen(true);
  };

  const handleAuthSuccess = () => {
    clearEnrollAuthFlowState();
    onAuthenticated({ fullName, email, phone });
  };

  // Listen for auth state change to trigger success
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        handleAuthSuccess();
      }
    });
    return () => subscription.unsubscribe();
  }, [fullName, email, phone]);

  const sendPhoneOtp = useCallback(async (purpose: 'login' | 'signup') => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_BASE_URL}/functions/v1/send-phone-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, purpose, channel: isNewUser ? 'sms' : phoneChannel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      const channelLabel = phoneChannel === 'whatsapp' ? 'WhatsApp' : 'SMS';
      toast.success(`OTP sent via ${channelLabel} to ******${data.phone}`);
      setResendCooldown(30);
      return true;
    } catch (err: any) {
      showError('Failed to send OTP', err.message);
      return false;
    } finally { setLoading(false); }
  }, [phone, phoneChannel]);

  const verifyPhoneOtp = useCallback(async (purpose: 'login' | 'signup') => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${SUPABASE_BASE_URL}/functions/v1/verify-phone-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone, otp_code: otp, purpose,
          signup_data: purpose === 'signup' ? { full_name: fullName, email } : undefined,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
    } catch (err: any) {
      const message = err.name === 'AbortError'
        ? 'Request timed out. Please check your connection and try again.'
        : err.message;
      showError('Verification Failed', message);
    } finally { clearTimeout(timeoutId); setLoading(false); }
  }, [phone, otp, fullName, email]);

  const sendEmailOtp = useCallback(async (purpose: 'login' | 'signup') => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_BASE_URL}/functions/v1/send-email-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      toast.success(`OTP sent to ${data.email}`);
      setResendCooldown(30);
      return true;
    } catch (err: any) {
      showError('Failed to send Email OTP', err.message);
      return false;
    } finally { setLoading(false); }
  }, [email]);

  const verifyEmailOtp = useCallback(async (purpose: 'login' | 'signup') => {
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const res = await fetch(`${SUPABASE_BASE_URL}/functions/v1/verify-email-otp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, otp_code: otp, purpose,
          signup_data: purpose === 'signup' ? { full_name: fullName, phone } : undefined,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
    } catch (err: any) {
      const message = err.name === 'AbortError'
        ? 'Request timed out. Please check your connection and try again.'
        : err.message;
      showError('Verification Failed', message);
    } finally { clearTimeout(timeoutId); setLoading(false); }
  }, [email, otp, fullName, phone]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) { toast.error('Please accept the terms and conditions'); return; }
    if (!fullName.trim()) { toast.error('Please enter your full name'); return; }

    const purpose = isNewUser ? 'signup' : 'login';

    // For signup, require all three fields regardless of method
    if (isNewUser) {
      if (!email.trim()) { toast.error('Please enter your email address'); return; }
      if (!phone.trim()) { toast.error('Please enter your phone number'); return; }
    }

    if (method === 'phone') {
      if (!phone.trim()) { toast.error('Please enter your phone number'); return; }
      const ok = await sendPhoneOtp(purpose);
      if (ok) { setStep('otp'); setOtp(''); }
    } else if (method === 'emailOtp') {
      if (!email.trim()) { toast.error('Please enter your email'); return; }
      const ok = await sendEmailOtp(purpose);
      if (ok) { setStep('otp'); setOtp(''); }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const purpose = isNewUser ? 'signup' : 'login';
    if (method === 'phone') await verifyPhoneOtp(purpose);
    else await verifyEmailOtp(purpose);
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptTerms) { toast.error('Please accept the terms and conditions'); return; }
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      toast.error('Please fill all fields');
      return;
    }
    setLoading(true);
    try {
      if (isNewUser) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        toast.success('Account created! Check your email to verify.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  const handleResend = () => {
    if (resendCooldown > 0) return;
    const purpose = isNewUser ? 'signup' : 'login';
    if (method === 'phone') sendPhoneOtp(purpose);
    else sendEmailOtp(purpose);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2 md:pb-4">
          <CardTitle className="text-xl md:text-2xl flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" />
            Verify Your Identity
          </CardTitle>
          <p className="text-sm text-muted-foreground">Quick verification to secure your enrollment</p>
        </CardHeader>
        <CardContent>
          {step === 'otp' ? (
            <OtpInput
              otp={otp} setOtp={setOtp}
              onBack={() => { setStep('input'); setOtp(''); clearEnrollAuthFlowState(); }}
              sentTo={method === 'phone' ? phone : email}
              onResend={handleResend}
              loading={loading}
              resendCooldown={resendCooldown}
              onSubmit={handleVerifyOtp}
            />
          ) : (
            <div className="space-y-4">
              <MethodToggle method={method} setMethod={(m) => { setMethod(m); setStep('input'); }} />

              {/* Toggle new/existing user */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {isNewUser ? 'Already have an account?' : "Don't have an account?"}
                </span>
                <button type="button" onClick={() => setIsNewUser(!isNewUser)} className="text-primary font-medium hover:underline">
                  {isNewUser ? 'Sign in' : 'Create one'}
                </button>
              </div>

              <form onSubmit={method === 'email' ? handlePasswordAuth : handleSendOtp} className="space-y-4">
                <div>
                  <Label htmlFor="auth-name">Full Name *</Label>
                  <Input id="auth-name" value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder="Enter your full name" required />
                </div>

                {(method === 'phone') && (
                  <div>
                    <Label htmlFor="auth-phone">Phone Number *</Label>
                    <Input id="auth-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="+91 XXXXX XXXXX" required />
                    {!isNewUser && (
                      <div className="mt-2">
                        <Label className="text-xs text-muted-foreground mb-1 block">Send OTP via</Label>
                        <div className="flex gap-2">
                          <Button type="button" variant={phoneChannel === 'sms' ? 'default' : 'outline'} size="sm" className="flex-1 h-8 text-xs" onClick={() => setPhoneChannel('sms')}>
                            <Smartphone className="h-3.5 w-3.5 mr-1" /> SMS
                          </Button>
                          <Button type="button" variant={phoneChannel === 'whatsapp' ? 'default' : 'outline'} size="sm" className="flex-1 h-8 text-xs" onClick={() => setPhoneChannel('whatsapp')}>
                            <MessageSquare className="h-3.5 w-3.5 mr-1" /> WhatsApp
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(method === 'emailOtp' || method === 'email') && (
                  <div>
                    <Label htmlFor="auth-email">Email Address *</Label>
                    <Input id="auth-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com" required />
                  </div>
                )}

                {/* For phone method, optionally collect email too */}
                {method === 'phone' && isNewUser && (
                  <div>
                    <Label htmlFor="auth-email-opt">Email Address (optional)</Label>
                    <Input id="auth-email-opt" type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com" />
                  </div>
                )}

                {/* For email OTP method, optionally collect phone */}
                {method === 'emailOtp' && isNewUser && (
                  <div>
                    <Label htmlFor="auth-phone-opt">Phone Number (optional)</Label>
                    <Input id="auth-phone-opt" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="+91 XXXXX XXXXX" />
                  </div>
                )}

                {method === 'email' && (
                  <div>
                    <Label htmlFor="auth-password">Password *</Label>
                    <Input id="auth-password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="Enter password" required />
                  </div>
                )}

                {method === 'email' && isNewUser && (
                  <div>
                    <Label htmlFor="auth-phone-pw">Phone Number (optional)</Label>
                    <Input id="auth-phone-pw" type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      placeholder="+91 XXXXX XXXXX" />
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <Checkbox id="auth-terms" checked={acceptTerms} onCheckedChange={c => setAcceptTerms(c as boolean)} />
                  <Label htmlFor="auth-terms" className="text-sm cursor-pointer">
                    I agree to the terms and conditions and privacy policy
                  </Label>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> :
                    method === 'email'
                      ? (isNewUser ? 'Create Account & Continue' : 'Sign In & Continue')
                      : 'Send OTP & Continue'
                  }
                </Button>
              </form>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{errorTitle}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap break-words">{errorMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
