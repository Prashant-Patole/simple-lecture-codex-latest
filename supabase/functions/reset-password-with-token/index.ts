import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Hash token using SHA-256
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { reset_token, new_password, user_id } = await req.json();
    const json = (body: unknown) => new Response(
      JSON.stringify(body),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

    if (!reset_token || !new_password || !user_id) {
      return json({ error: 'Your reset session expired. Please start over.', code: 'SESSION_EXPIRED' });
    }

    if (new_password.length < 6) {
      return json({ error: 'Please choose a password with at least 6 characters.', code: 'WEAK_PASSWORD' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const tokenHash = await hashToken(reset_token);

    const { data: otpRecord, error: fetchError } = await supabase
      .from('password_reset_otps')
      .select('*')
      .eq('user_id', user_id)
      .eq('otp_hash', tokenHash)
      .eq('verified', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !otpRecord) {
      return json({ error: 'Your reset session expired. Please start over.', code: 'SESSION_EXPIRED' });
    }

    const tokenAge = Date.now() - new Date(otpRecord.created_at).getTime();
    if (tokenAge > 10 * 60 * 1000) {
      await supabase.from('password_reset_otps').delete().eq('id', otpRecord.id);
      return json({ error: 'Your reset session expired. Please start over.', code: 'SESSION_EXPIRED' });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user_id,
      { password: new_password }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      return json({ error: "We couldn't update your password. Please try again.", code: 'INTERNAL_ERROR' });
    }

    await supabase.from('password_reset_otps').delete().eq('user_id', user_id);

    return json({ message: 'Password reset successfully' });

  } catch (error) {
    console.error('Error in reset-password-with-token:', error);
    return new Response(
      JSON.stringify({ error: "Something went wrong on our end. Please try again.", code: 'INTERNAL_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
