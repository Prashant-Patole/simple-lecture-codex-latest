import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Gemini TTS voices - clear and natural
const getVoiceForGender = (gender: string): string => {
  if (gender === 'male') {
    return 'Charon'; // Clear male voice
  }
  return 'Kore'; // Clear, friendly female voice
};

// Get language code for Gemini TTS
const getLanguageCode = (langCode: string): string => {
  if (langCode.startsWith('hi')) return 'hi-IN';
  if (langCode.startsWith('en')) return 'en-US';
  return langCode;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, languageCode = 'en-IN', gender = 'female' } = await req.json();

    if (!text || text.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const googleApiKey = Deno.env.get('GOOGLE_TTS_API_KEY');
    if (!googleApiKey) {
      console.error('GOOGLE_TTS_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'TTS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const voice = getVoiceForGender(gender);
    const lang = getLanguageCode(languageCode);
    
    console.log(`Synthesizing speech with Gemini TTS: lang=${lang}, voice=${voice}, text length=${text.length}`);

    // Call Google Cloud Text-to-Speech API
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: { text: text },
          voice: {
            languageCode: lang,
            name: `${lang}-Wavenet-A`,
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.9,
            pitch: 0
          }
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google TTS API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: 'TTS synthesis failed', details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    
    console.log(`Speech synthesized successfully with Google TTS`);

    return new Response(
      JSON.stringify({ 
        audioContent: data.audioContent,
        languageCode: lang,
        voice 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('TTS function error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
