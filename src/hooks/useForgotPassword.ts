import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type ForgotPasswordStep = 'email' | 'otp' | 'password' | 'success';

interface UseForgotPasswordReturn {
  step: ForgotPasswordStep;
  loading: boolean;
  error: string | null;
  email: string;
  resetToken: string | null;
  userId: string | null;
  setEmail: (email: string) => void;
  sendOTP: () => Promise<boolean>;
  verifyOTP: (otpCode: string) => Promise<boolean>;
  resetPassword: (newPassword: string) => Promise<boolean>;
  goBack: () => void;
  reset: () => void;
}

const FRIENDLY: Record<string, string> = {
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_OTP: "That code doesn't look right. Please re-enter it.",
  EXPIRED_OTP: 'Your code has expired. Please request a new one.',
  TOO_MANY_ATTEMPTS: 'Too many wrong attempts. Please request a new code.',
  RATE_LIMITED: 'Please wait a few minutes before requesting another code.',
  WEAK_PASSWORD: 'Please choose a password with at least 6 characters.',
  EMAIL_SEND_FAILED: "We couldn't send the email right now. Please try again in a minute.",
  SESSION_EXPIRED: 'Your reset session expired. Please start over.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again.',
};

const NETWORK_MSG =
  "We couldn't reach our servers. Please check your internet connection and try again.";

function friendlyError(invokeError: any, data: any): string {
  if (invokeError) {
    const msg = String(invokeError?.message || '').toLowerCase();
    if (
      msg.includes('failed to send') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('load failed') ||
      invokeError?.name === 'FunctionsFetchError'
    ) {
      return NETWORK_MSG;
    }
    return FRIENDLY.INTERNAL_ERROR;
  }
  if (data?.error) {
    if (data.code && FRIENDLY[data.code]) return data.code === 'INVALID_OTP' ? data.error : FRIENDLY[data.code];
    return typeof data.error === 'string' ? data.error : FRIENDLY.INTERNAL_ERROR;
  }
  return FRIENDLY.INTERNAL_ERROR;
}

export const useForgotPassword = (): UseForgotPasswordReturn => {
  const [step, setStep] = useState<ForgotPasswordStep>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const sendOTP = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('send-password-reset-otp', {
        body: { email },
      });

      if (invokeError || data?.error) {
        setError(friendlyError(invokeError, data));
        return false;
      }

      setStep('otp');
      return true;
    } catch (err) {
      setError(NETWORK_MSG);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (otpCode: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('verify-password-reset-otp', {
        body: { email, otp_code: otpCode },
      });

      if (invokeError || data?.error) {
        setError(friendlyError(invokeError, data));
        return false;
      }

      if (data?.reset_token && data?.user_id) {
        setResetToken(data.reset_token);
        setUserId(data.user_id);
        setStep('password');
        return true;
      }

      setError(FRIENDLY.INTERNAL_ERROR);
      return false;
    } catch (err) {
      setError(NETWORK_MSG);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (newPassword: string): Promise<boolean> => {
    if (!resetToken || !userId) {
      setError(FRIENDLY.SESSION_EXPIRED);
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('reset-password-with-token', {
        body: { reset_token: resetToken, new_password: newPassword, user_id: userId },
      });

      if (invokeError || data?.error) {
        setError(friendlyError(invokeError, data));
        return false;
      }

      setStep('success');
      return true;
    } catch (err) {
      setError(NETWORK_MSG);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setError(null);
    if (step === 'otp') setStep('email');
    else if (step === 'password') setStep('otp');
  };

  const reset = () => {
    setStep('email');
    setLoading(false);
    setError(null);
    setEmail('');
    setResetToken(null);
    setUserId(null);
  };

  return {
    step, loading, error, email, resetToken, userId,
    setEmail, sendOTP, verifyOTP, resetPassword, goBack, reset,
  };
};
