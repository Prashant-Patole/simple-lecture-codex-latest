import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { SEOHead } from '@/components/SEO';
import { useToast } from '@/hooks/use-toast';
import { useForgotPassword } from '@/hooks/useForgotPassword';
import { ArrowLeft, Mail, KeyRound, CheckCircle, Loader2 } from 'lucide-react';
import logoImage from '@/assets/website-logo.png';
import { BottomNav } from '@/components/mobile/BottomNav';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    step,
    loading,
    error,
    email,
    setEmail,
    sendOTP,
    verifyOTP,
    resetPassword,
    goBack,
    reset,
  } = useForgotPassword();

  const [otpValue, setOtpValue] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (step === 'otp') {
      setCountdown(300); // 5 minutes
      setCanResend(false);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Enable resend after 30 seconds
      const resendTimer = setTimeout(() => setCanResend(true), 30000);

      return () => {
        clearInterval(timer);
        clearTimeout(resendTimer);
      };
    }
  }, [step]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await sendOTP();
    if (success) {
      toast({
        title: 'OTP Sent',
        description: 'Check your email for the verification code.',
      });
    }
  };

  const handleVerifyOTP = async () => {
    if (otpValue.length !== 6) return;
    const success = await verifyOTP(otpValue);
    if (success) {
      setOtpValue('');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }

    const success = await resetPassword(newPassword);
    if (success) {
      toast({
        title: 'Password Reset Successful',
        description: 'You can now login with your new password.',
      });
    }
  };

  const handleResendOTP = async () => {
    if (!canResend) return;
    setOtpValue('');
    const success = await sendOTP();
    if (success) {
      toast({
        title: 'OTP Resent',
        description: 'A new verification code has been sent to your email.',
      });
    }
  };

  return (
    <>
      <SEOHead
        title="Reset Password | SimpleLecture"
        description="Reset your SimpleLecture account password"
      />
      <div className="min-h-screen bg-background md:bg-gradient-to-b md:from-primary/10 md:to-background flex items-start pt-10 md:items-center md:pt-0 justify-center p-4 pb-20 md:pb-0">
        <Card className="w-full max-w-md p-6 shadow-none border-0 bg-transparent md:shadow-sm md:border md:bg-card">
          <div className="text-center mb-6">
            <img
              src={logoImage}
              alt="SimpleLecture"
              className="h-12 mx-auto mb-4 hidden md:block"
            />
            <h1 className="text-2xl font-bold">
              <span className="md:hidden">Password Recovery</span>
              <span className="hidden md:inline">Reset Password</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 'email' && (
                <>
                  <span className="md:hidden">Enter your email to recover your password</span>
                  <span className="hidden md:inline">Enter your email to receive a verification code</span>
                </>
              )}
              {step === 'otp' && 'Enter the 6-digit code sent to your email'}
              {step === 'password' && 'Create a new password for your account'}
              {step === 'success' && 'Your password has been reset successfully'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              {error}
            </div>
          )}

          {/* Step 1: Enter Email */}
          {step === 'email' && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm">Email Address</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full rounded-full md:rounded-md bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary-dark md:from-primary md:to-primary md:hover:from-primary/90 md:hover:to-primary/90" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Verification Code'
                )}
              </Button>

              <Link
                to="/auth"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Link>
            </form>
          )}

          {/* Step 2: Enter OTP */}
          {step === 'otp' && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Code sent to <span className="font-medium text-foreground">{email}</span>
                </p>
                {countdown > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Expires in <span className="font-mono font-medium text-foreground">{formatTime(countdown)}</span>
                  </p>
                )}
              </div>

              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={otpValue}
                  onChange={setOtpValue}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                onClick={handleVerifyOTP}
                className="w-full rounded-full md:rounded-md bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary-dark md:from-primary md:to-primary md:hover:from-primary/90 md:hover:to-primary/90"
                disabled={loading || otpValue.length !== 6}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Code'
                )}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Change email
                </button>
                <button
                  type="button"
                  onClick={handleResendOTP}
                  disabled={!canResend || loading}
                  className={`transition-colors ${
                    canResend ? 'text-primary hover:text-primary/80' : 'text-muted-foreground cursor-not-allowed'
                  }`}
                >
                  {canResend ? 'Resend code' : 'Wait 30s to resend'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Set New Password */}
          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label htmlFor="new-password" className="text-sm">New Password</Label>
                <div className="relative mt-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                    minLength={6}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum 6 characters
                </p>
              </div>

              <div>
                <Label htmlFor="confirm-password" className="text-sm">Confirm Password</Label>
                <div className="relative mt-1">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 border-0 border-b border-muted-foreground/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-b-2 focus-visible:border-primary md:border md:rounded-md md:bg-background md:focus-visible:ring-2 md:focus-visible:ring-ring md:focus-visible:ring-offset-2"
                    minLength={6}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full rounded-full md:rounded-md bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary-dark md:from-primary md:to-primary md:hover:from-primary/90 md:hover:to-primary/90" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>

              <button
                type="button"
                onClick={goBack}
                className="flex items-center justify-center gap-1 w-full text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Go back
              </button>
            </form>
          )}

          {/* Step 4: Success */}
          {step === 'success' && (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-primary/20 p-3">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Password Reset Complete!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  You can now login with your new password.
                </p>
              </div>
              <Button onClick={() => navigate('/auth')} className="w-full rounded-full md:rounded-md bg-gradient-to-r from-primary to-primary hover:from-primary hover:to-primary-dark md:from-primary md:to-primary md:hover:from-primary/90 md:hover:to-primary/90">
                Go to Login
              </Button>
            </div>
          )}
        </Card>
      </div>
      <BottomNav />
    </>
  );
};

export default ForgotPassword;
