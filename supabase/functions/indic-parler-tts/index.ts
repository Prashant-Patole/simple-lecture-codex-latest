import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TTS_API_URL = "http://69.197.145.4:8000/tts";
const TTS_BASE_URL = "http://69.197.145.4:8000";


// Text chunking for long content
function splitTextIntoChunks(text: string, maxLength: number = 500): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remainingText = text;

  while (remainingText.length > 0) {
    if (remainingText.length <= maxLength) {
      chunks.push(remainingText);
      break;
    }

    let splitIndex = remainingText.lastIndexOf('. ', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remainingText.lastIndexOf(', ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.5) {
      splitIndex = remainingText.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength * 0.3) {
      splitIndex = maxLength;
    }

    chunks.push(remainingText.substring(0, splitIndex + 1).trim());
    remainingText = remainingText.substring(splitIndex + 1).trim();
  }

  return chunks.filter(chunk => chunk.length > 0);
}


async function makeTTSRequest(
  text: string, 
  description: string, 
  apiKey: string,
  maxRetries: number = 2
): Promise<{ success: boolean; audioBuffer?: ArrayBuffer; error?: string }> {
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`TTS attempt ${attempt + 1} for text: "${text.substring(0, 50)}..."`);
      
      const response = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({ text, description }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`TTS API error (${response.status}):`, errorText);
        
        if (response.status === 401 || response.status === 403) {
          return { success: false, error: 'Invalid API key' };
        }
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        return { success: false, error: `TTS API error: ${response.status}` };
      }

      const result = await response.json();
      
      if (result.status !== 'success' || !result.audio_url) {
        console.error('TTS response missing audio_url:', result);
        return { success: false, error: 'Invalid TTS response' };
      }

      // Download the audio file from the TTS server
      const audioUrl = `${TTS_BASE_URL}${result.audio_url}`;
      console.log(`Downloading audio from: ${audioUrl}`);
      
      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        console.error(`Failed to download audio: ${audioResponse.status}`);
        return { success: false, error: 'Failed to download audio' };
      }
      
      // Return raw ArrayBuffer - no base64 encoding
      const audioBuffer = await audioResponse.arrayBuffer();
      console.log(`Successfully downloaded audio, size: ${audioBuffer.byteLength} bytes`);
      
      return { success: true, audioBuffer };
      
    } catch (error) {
      console.error(`TTS request error (attempt ${attempt + 1}):`, error);
      
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
      
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  return { success: false, error: 'Max retries exceeded' };
}

// Concatenate multiple WAV buffers into one
function concatenateWavBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  if (buffers.length === 0) return new ArrayBuffer(0);
  if (buffers.length === 1) return buffers[0];

  // Calculate total data size (excluding headers)
  let totalDataSize = 0;
  const dataViews: DataView[] = [];
  
  for (const buffer of buffers) {
    const view = new DataView(buffer);
    // WAV header is 44 bytes, data follows
    const dataSize = buffer.byteLength - 44;
    totalDataSize += dataSize;
    dataViews.push(view);
  }

  // Get header info from first file
  const firstView = dataViews[0];
  const numChannels = firstView.getUint16(22, true);
  const sampleRate = firstView.getUint32(24, true);
  const bitsPerSample = firstView.getUint16(34, true);
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  // Create new buffer with combined data
  const resultBuffer = new ArrayBuffer(44 + totalDataSize);
  const resultView = new DataView(resultBuffer);
  const resultBytes = new Uint8Array(resultBuffer);

  // Write WAV header
  // RIFF header
  resultBytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  resultView.setUint32(4, 36 + totalDataSize, true); // File size - 8
  resultBytes.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
  
  // fmt chunk
  resultBytes.set([0x66, 0x6D, 0x74, 0x20], 12); // "fmt "
  resultView.setUint32(16, 16, true); // fmt chunk size
  resultView.setUint16(20, 1, true); // Audio format (PCM)
  resultView.setUint16(22, numChannels, true);
  resultView.setUint32(24, sampleRate, true);
  resultView.setUint32(28, byteRate, true);
  resultView.setUint16(32, blockAlign, true);
  resultView.setUint16(34, bitsPerSample, true);
  
  // data chunk
  resultBytes.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  resultView.setUint32(40, totalDataSize, true);

  // Copy audio data from all buffers
  let offset = 44;
  for (const buffer of buffers) {
    const sourceBytes = new Uint8Array(buffer, 44); // Skip header
    resultBytes.set(sourceBytes, offset);
    offset += sourceBytes.length;
  }

  console.log(`Concatenated ${buffers.length} WAV files, total size: ${resultBuffer.byteLength} bytes`);
  return resultBuffer;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, description, languageCode } = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('INDIC_PARLER_API_KEY');
    if (!apiKey) {
      console.error('INDIC_PARLER_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'TTS service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing TTS request, text length: ${text.length}`);

    // Default voice description based on language
    const voiceDescription = description || 
      (languageCode === 'hi-IN' 
        ? "Divya speaks clearly with very clear audio and moderate speed"
        : "Female voice with clear pronunciation and normal pace");

    const cleanText = text.trim();
    
    // Split into chunks if needed
    const chunks = splitTextIntoChunks(cleanText, 500);
    console.log(`Processing ${chunks.length} chunk(s) for text of length ${cleanText.length}`);
    
    // Collect all audio buffers
    const audioBuffers: ArrayBuffer[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1}/${chunks.length}: "${chunk.substring(0, 30)}..."`);
      
      const result = await makeTTSRequest(chunk, voiceDescription, apiKey);
      
      if (!result.success || !result.audioBuffer) {
        console.error(`Chunk ${i + 1} failed:`, result.error);
        return new Response(
          JSON.stringify({ error: `Failed at chunk ${i + 1}: ${result.error}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      audioBuffers.push(result.audioBuffer);
    }
    
    // Concatenate all audio buffers into one WAV file
    const finalAudioBuffer = concatenateWavBuffers(audioBuffers);
    
    // Return binary audio directly - no base64 encoding
    return new Response(finalAudioBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/wav',
        'Content-Length': finalAudioBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
