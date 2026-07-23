import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TTS_API_URL = "http://69.197.145.4:8015/tts";
const HEALTH_URL = "http://69.197.145.4:8015/health";

async function isBharatTTSServerReachable(timeoutMs: number = 1500): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(HEALTH_URL, {
      method: 'GET',
      signal: controller.signal,
    });
    return res.ok;
  } catch (err) {
    console.warn('[BharatTTS] Health check failed:', err);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

// Split text into chunks for better TTS processing
function splitTextIntoChunks(text: string, maxLength: number = 500): string[] {
  if (text.length <= maxLength) return [text];
  
  const chunks: string[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining.trim());
      break;
    }
    
    // Find a good break point (sentence end, comma, or space)
    let breakPoint = maxLength;
    
    // Try to find sentence end
    const sentenceEnd = remaining.lastIndexOf('. ', maxLength);
    if (sentenceEnd > maxLength * 0.5) {
      breakPoint = sentenceEnd + 1;
    } else {
      // Try comma
      const commaEnd = remaining.lastIndexOf(', ', maxLength);
      if (commaEnd > maxLength * 0.5) {
        breakPoint = commaEnd + 1;
      } else {
        // Try space
        const spaceEnd = remaining.lastIndexOf(' ', maxLength);
        if (spaceEnd > maxLength * 0.3) {
          breakPoint = spaceEnd;
        }
      }
    }
    
    chunks.push(remaining.substring(0, breakPoint).trim());
    remaining = remaining.substring(breakPoint).trim();
  }
  
  return chunks;
}

// Make TTS request with retry logic
async function makeTTSRequest(
  prompt: string, 
  description: string,
  maxRetries: number = 3
): Promise<{ success: boolean; audio?: ArrayBuffer; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[BharatTTS] Attempt ${attempt}/${maxRetries} for chunk: "${prompt.substring(0, 50)}..."`);
      
      const response = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          description,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[BharatTTS] API error: ${response.status} - ${errorText}`);
        
        if (attempt === maxRetries) {
          return { success: false, error: `API error: ${response.status}` };
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      const audioBuffer = await response.arrayBuffer();
      console.log(`[BharatTTS] Success - received ${audioBuffer.byteLength} bytes`);
      
      return { success: true, audio: audioBuffer };
    } catch (error: unknown) {
      console.error(`[BharatTTS] Request error on attempt ${attempt}:`, error);
      
      if (attempt === maxRetries) {
        const errorMessage = error instanceof Error ? error.message : 'Network error';
        return { success: false, error: errorMessage };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
}

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, description } = await req.json();

    if (!prompt) {
      return new Response(
        JSON.stringify({ ok: false, error: 'prompt is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fast reachability check (avoids noisy 500s when server is down/firewalled)
    const reachable = await isBharatTTSServerReachable();
    if (!reachable) {
      console.error('[BharatTTS] Server unreachable (connection refused / firewall / down)');
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Bharat TTS server unreachable. Ensure port 8015 is open and the server is running.',
          code: 'BHARAT_TTS_UNREACHABLE'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default voice description for teaching
    const voiceDescription = description ||
      "Warm, clear, close mic, moderate speed, professional teaching voice";

    console.log(`[BharatTTS] Processing text: "${prompt.substring(0, 100)}..."`);
    console.log(`[BharatTTS] Voice description: "${voiceDescription}"`);

    // Split text into manageable chunks
    const chunks = splitTextIntoChunks(prompt, 500);
    console.log(`[BharatTTS] Split into ${chunks.length} chunks`);

    if (chunks.length === 1) {
      // Single chunk - simple response
      const result = await makeTTSRequest(chunks[0], voiceDescription);
      
      if (!result.success) {
        return new Response(
          JSON.stringify({ ok: false, error: result.error || 'TTS generation failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const base64Audio = arrayBufferToBase64(result.audio!);
      
      return new Response(
        JSON.stringify({ 
          ok: true,
          audioContent: base64Audio,
          mimeType: 'audio/wav',
          isChunked: false 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Multiple chunks - return array of audio
      const audioContents: string[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        console.log(`[BharatTTS] Processing chunk ${i + 1}/${chunks.length}`);
        
        const result = await makeTTSRequest(chunks[i], voiceDescription);
        
        if (!result.success) {
          console.error(`[BharatTTS] Chunk ${i + 1} failed: ${result.error}`);
          // Continue with remaining chunks
          continue;
        }
        
        audioContents.push(arrayBufferToBase64(result.audio!));
      }

      if (audioContents.length === 0) {
        return new Response(
          JSON.stringify({ ok: false, error: 'All TTS chunks failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ 
          ok: true,
          audioContent: audioContents,
          mimeType: 'audio/wav',
          isChunked: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: unknown) {
    console.error('[BharatTTS] Server error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
