import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, purpose, channel = 'sms' } = await req.json();

    if (!phone || !purpose) {
      return new Response(JSON.stringify({ error: 'Phone and purpose are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['login', 'signup'].includes(purpose)) {
      return new Response(JSON.stringify({ error: 'Purpose must be login or signup' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['sms', 'whatsapp'].includes(channel)) {
      return new Response(JSON.stringify({ error: 'Channel must be sms or whatsapp' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate phone: 10 digits
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      return new Response(JSON.stringify({ error: 'Invalid phone number. Must be 10 digits.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if phone exists in profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, phone_number, full_name')
      .eq('phone_number', cleanPhone)
      .order('created_at', { ascending: false })
      .limit(1);

    const profile = profiles && profiles.length > 0 ? profiles[0] : null;

    if (purpose === 'login' && !profile) {
      return new Response(JSON.stringify({ error: 'No account found with this phone number. Please sign up first.' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (purpose === 'signup' && profile) {
      return new Response(JSON.stringify({ error: 'An account with this phone number already exists. Please login instead.' }), {
        status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit: max 3 OTPs per phone per 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('phone_otp_verifications')
      .select('*', { count: 'exact', head: true })
      .eq('phone_number', cleanPhone)
      .gte('created_at', tenMinutesAgo);

    if ((count ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: 'Too many OTP requests. Please wait 10 minutes.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otpHash = await sha256(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // Store OTP hash with channel
    const { error: insertError } = await supabase
      .from('phone_otp_verifications')
      .insert({
        phone_number: cleanPhone,
        otp_hash: otpHash,
        purpose,
        expires_at: expiresAt,
        channel,
      });

    if (insertError) {
      console.error('Insert OTP error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to generate OTP' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send OTP via selected channel
    if (channel === 'whatsapp') {
      // Send via Wacto WhatsApp API
      const wactoToken = Deno.env.get('WACTO_API_TOKEN')!;
      const whatsappUrl = `https://api.wacto.app/api/v1.0/messages/send-template/917353021234`;

      console.log('Sending WhatsApp OTP to:', `91${cleanPhone}`, 'purpose:', purpose);

      const whatsappResponse = await fetch(whatsappUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${wactoToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: `91${cleanPhone}`,
          type: 'template',
          template: {
            name: 'otp',
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: [{ type: 'text', text: otp }],
              },
              {
                type: 'button',
                parameters: [{ type: 'text', text: otp }],
                sub_type: 'url',
                index: '0',
              },
            ],
          },
        }),
      });

      const whatsappResult = await whatsappResponse.text();
      console.log('Wacto WhatsApp response:', whatsappResult);

      if (!whatsappResponse.ok) {
        console.error('WhatsApp delivery failed:', whatsappResult);
        return new Response(JSON.stringify({ error: `WhatsApp delivery failed: ${whatsappResult}` }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Send SMS via Nettyfish
      const nfUser = Deno.env.get('NETTYFISH_USER')!;
      const nfPassword = Deno.env.get('NETTYFISH_PASSWORD')!;
      const nfSenderId = Deno.env.get('NETTYFISH_SENDER_ID')!;
      const nfTemplateId = purpose === 'login'
        ? Deno.env.get('NETTYFISH_LOGIN_TEMPLATE_ID')!
        : Deno.env.get('NETTYFISH_SIGNUP_TEMPLATE_ID')!;

      const userName = profile?.full_name || 'User';
      const smsText = purpose === 'login'
        ? `Hello ${userName}, your OTP for logging into Simple Lecture is ${otp}. Please do not share this with anyone. Happy Learning!`
        : `Welcome to Simple Lecture! Use OTP ${otp} to verify your number and create your account. Let's start your learning journey!`;

      const smsUrl = new URL('http://retailsms.nettyfish.com/api/mt/SendSMS');
      smsUrl.searchParams.set('user', nfUser);
      smsUrl.searchParams.set('password', nfPassword);
      smsUrl.searchParams.set('senderid', nfSenderId);
      smsUrl.searchParams.set('channel', 'Trans');
      smsUrl.searchParams.set('DCS', '0');
      smsUrl.searchParams.set('flashsms', '0');
      smsUrl.searchParams.set('number', `91${cleanPhone}`);
      smsUrl.searchParams.set('text', smsText);
      smsUrl.searchParams.set('route', '4');
      smsUrl.searchParams.set('peid', '1701176984341440636');
      smsUrl.searchParams.set('DLT_TE_ID', nfTemplateId);

      console.log('Sending SMS to:', `91${cleanPhone}`, 'purpose:', purpose);

      const smsResponse = await fetch(smsUrl.toString());
      const smsResult = await smsResponse.text();
      console.log('Nettyfish response:', smsResult);

      // Parse Nettyfish response and check for errors
      let smsSuccess = true;
      let smsError = '';
      try {
        const parsed = JSON.parse(smsResult);
        if (parsed.ErrorCode && parsed.ErrorCode !== '0' && parsed.ErrorCode !== '000') {
          smsSuccess = false;
          smsError = `SMS gateway error: ${parsed.ErrorMessage} (code: ${parsed.ErrorCode})`;
        }
      } catch {
        if (!smsResult.toLowerCase().includes('success')) {
          smsSuccess = false;
          smsError = `Unexpected SMS gateway response: ${smsResult}`;
        }
      }

      if (!smsSuccess) {
        console.error('SMS delivery failed:', smsError);
        return new Response(JSON.stringify({ error: smsError }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `OTP sent successfully via ${channel}`,
      phone: cleanPhone.slice(-4),
      channel,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('send-phone-otp error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
