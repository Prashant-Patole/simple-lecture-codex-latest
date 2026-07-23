import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map language codes to Sarvam speaker names
function getSpeakerForLanguageAndGender(languageCode: string, gender: string): string {
  if (gender === 'female') {
    return 'meera';
  }
  return 'abhilash';
}

// Map our language codes to Sarvam's supported codes
function mapLanguageCode(langCode: string): string {
  const mapping: Record<string, string> = {
    'en-IN': 'en-IN',
    'hi-IN': 'hi-IN',
    'kn-IN': 'kn-IN',
    'ta-IN': 'ta-IN',
    'te-IN': 'te-IN',
    'ml-IN': 'ml-IN',
    'mr-IN': 'mr-IN',
    'bn-IN': 'bn-IN',
    'gu-IN': 'gu-IN',
    'pa-IN': 'pa-IN',
    'od-IN': 'od-IN',
  };
  return mapping[langCode] || 'en-IN';
}

// Split text into chunks of max 400 characters to be safer with API limits
function splitTextIntoChunks(text: string, maxLength: number = 400): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    let breakPoint = -1;
    const searchRange = remaining.substring(0, maxLength);
    
    const sentenceEnd = Math.max(
      searchRange.lastIndexOf('. '),
      searchRange.lastIndexOf('! '),
      searchRange.lastIndexOf('? ')
    );
    if (sentenceEnd > maxLength * 0.5) {
      breakPoint = sentenceEnd + 1;
    }
    
    if (breakPoint === -1) {
      const commaPoint = searchRange.lastIndexOf(', ');
      if (commaPoint > maxLength * 0.5) {
        breakPoint = commaPoint + 1;
      }
    }
    
    if (breakPoint === -1) {
      const spacePoint = searchRange.lastIndexOf(' ');
      if (spacePoint > 0) {
        breakPoint = spacePoint;
      } else {
        breakPoint = maxLength;
      }
    }

    chunks.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }

  return chunks.filter(c => c.length > 0);
}

// Helper to make a single TTS request with retry logic
async function makeTTSRequest(
  chunk: string, 
  sarvamLangCode: string, 
  speaker: string, 
  apiKey: string,
  maxRetries: number = 3
): Promise<{ success: boolean; audio?: string; error?: string }> {
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Short backoff: 1s, 2s, 4s for rate limit recovery
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 4000);
      console.log(`  Retry ${attempt}/${maxRetries}, waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'API-Subscription-Key': apiKey,
        },
        body: JSON.stringify({
          inputs: [chunk],
          target_language_code: sarvamLangCode,
          speaker: speaker,
          speech_sample_rate: 22050,
          model: 'bulbul:v2',
          pace: 0.85,
        }),
      });

      if (response.status === 429) {
        console.log(`  Rate limited on attempt ${attempt + 1}, will retry...`);
        continue; // Retry on rate limit
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Sarvam API error:`, response.status, errorText);
        return { success: false, error: errorText };
      }

      const result = await response.json();
      
      if (result.audios && result.audios.length > 0) {
        return { success: true, audio: result.audios[0] };
      } else {
        return { success: false, error: 'No audio in response' };
      }
    } catch (err) {
      console.error(`Request error on attempt ${attempt + 1}:`, err);
      if (attempt === maxRetries - 1) {
        return { success: false, error: err instanceof Error ? err.message : 'Request failed' };
      }
    }
  }

  return { success: false, error: 'Max retries exceeded due to rate limiting' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, languageCode = 'en-IN', gender = 'male' } = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'No text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('SARVAM_API_KEY');
    if (!apiKey) {
      console.error('SARVAM_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'SARVAM_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const speaker = getSpeakerForLanguageAndGender(languageCode, gender);
    const sarvamLangCode = mapLanguageCode(languageCode);

    const chunks = splitTextIntoChunks(text);
    console.log(`🔊 Sarvam TTS: ${chunks.length} chunks, lang=${sarvamLangCode}, speaker=${speaker}`);

    const audioChunks: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`  Processing chunk ${i + 1}/${chunks.length}: "${chunk.substring(0, 30)}..."`);

      const result = await makeTTSRequest(chunk, sarvamLangCode, speaker, apiKey);
      
      if (!result.success) {
        return new Response(
          JSON.stringify({ error: 'Sarvam TTS failed', details: result.error, fallback: true }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      audioChunks.push(result.audio!);
    }

    console.log(`✅ Sarvam TTS success: ${audioChunks.length} audio chunks`);

    return new Response(
      JSON.stringify({
        audioContent: audioChunks.length === 1 ? audioChunks[0] : audioChunks,
        isChunked: audioChunks.length > 1,
        chunkCount: audioChunks.length,
        languageCode: sarvamLangCode,
        voice: speaker,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Sarvam TTS error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', fallback: true }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});