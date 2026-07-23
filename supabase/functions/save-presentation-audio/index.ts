import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// B2 Auth - done once per request
async function authorizeB2(): Promise<{ apiUrl: string; authorizationToken: string }> {
  const B2_KEY_ID = Deno.env.get('B2_KEY_ID');
  const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY');

  if (!B2_KEY_ID || !B2_APPLICATION_KEY) {
    throw new Error('B2 credentials not configured');
  }

  const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    method: 'GET',
    headers: {
      'Authorization': 'Basic ' + btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`)
    }
  });

  if (!authResponse.ok) {
    const errText = await authResponse.text();
    throw new Error(`B2 authorization failed: ${errText}`);
  }

  return await authResponse.json();
}

// Get upload URL from B2
async function getUploadUrl(apiUrl: string, authToken: string, bucketId: string) {
  const resp = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      'Authorization': authToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ bucketId })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to get upload URL: ${errText}`);
  }

  return await resp.json();
}

// Upload a single file to B2 with retry
async function uploadToB2WithRetry(
  fileBytes: Uint8Array,
  filePath: string,
  contentType: string,
  authData: { apiUrl: string; authorizationToken: string },
  bucketId: string,
  slideIndex: number,
  maxRetries: number = 2
): Promise<string> {
  const B2_BUCKET_NAME = Deno.env.get('B2_BUCKET_NAME');
  if (!B2_BUCKET_NAME) throw new Error('B2_BUCKET_NAME not configured');

  // SHA1 hash (computed once)
  const hashBuffer = await crypto.subtle.digest('SHA-1', fileBytes.slice(0).buffer as ArrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sha1Hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const encodedFilePath = filePath
    .split('/')
    .map((segment: string) => encodeURIComponent(segment))
    .join('/');

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[SAVE-AUDIO] Slide ${slideIndex}: RETRY ${attempt}/${maxRetries} after error: ${lastError?.message}`);
      }
      console.log(`[SAVE-AUDIO] Slide ${slideIndex}: Upload attempt ${attempt + 1}/${maxRetries + 1} (${fileBytes.length} bytes)`);

      // Get a fresh upload URL for each attempt (B2 recommends this after failure)
      const uploadUrlData = await getUploadUrl(authData.apiUrl, authData.authorizationToken, bucketId);

      const bodyBuffer = fileBytes.slice(0).buffer as ArrayBuffer;
      const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': uploadUrlData.authorizationToken,
          'X-Bz-File-Name': encodedFilePath,
          'Content-Type': contentType,
          'Content-Length': fileBytes.length.toString(),
          'X-Bz-Content-Sha1': sha1Hash
        },
        body: bodyBuffer
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text();
        throw new Error(`Upload failed (${uploadResponse.status}): ${errText}`);
      }

      const publicUrl = `https://f005.backblazeb2.com/file/${B2_BUCKET_NAME}/${filePath}`;
      console.log(`[SAVE-AUDIO] Slide ${slideIndex}: ✅ Uploaded on attempt ${attempt + 1}`);
      return publicUrl;
    } catch (err) {
      lastError = err as Error;
      console.error(`[SAVE-AUDIO] Slide ${slideIndex}: ❌ Attempt ${attempt + 1} failed: ${lastError.message}`);
      if (attempt < maxRetries) {
        const delay = 500 * Math.pow(2, attempt);
        console.log(`[SAVE-AUDIO] Slide ${slideIndex}: Waiting ${delay}ms before retry...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error('All upload attempts failed');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    let cache_id: string;
    let slides: Array<{ slideIndex: number; base64Chunks: string[] }>;
    let language: string;

    try {
      const bodyText = await req.text();
      const body = JSON.parse(bodyText);
      cache_id = body.cache_id;
      slides = body.slides;
      language = body.language;
    } catch (parseError) {
      console.error('[SAVE-AUDIO] Failed to parse request body:', parseError);
      return new Response(
        JSON.stringify({ error: "Invalid request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cache_id || !slides || !Array.isArray(slides) || !language) {
      console.error(`[SAVE-AUDIO] Missing required fields: cache_id=${!!cache_id}, slides=${!!slides}, language=${!!language}`);
      return new Response(
        JSON.stringify({ error: "cache_id, slides array, and language are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SAVE-AUDIO] ========== START ==========`);
    console.log(`[SAVE-AUDIO] Received ${slides.length} slides for cache_id=${cache_id}, language=${language}`);

    const B2_BUCKET_ID = Deno.env.get('B2_BUCKET_ID');
    if (!B2_BUCKET_ID) throw new Error('B2_BUCKET_ID not configured');

    // === SINGLE B2 AUTH for all slides ===
    console.log(`[SAVE-AUDIO] B2 auth: single auth for all ${slides.length} slides`);
    const authStart = Date.now();
    const authData = await authorizeB2();
    console.log(`[SAVE-AUDIO] B2 auth SUCCESS in ${Date.now() - authStart}ms`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const audioUrls: Array<{ slideIndex: number; audioUrl: string; duration: number }> = [];
    let totalDuration = 0;
    let successCount = 0;
    let failedCount = 0;

    for (const slide of slides) {
      const { slideIndex, base64Chunks } = slide;

      if (!base64Chunks || base64Chunks.length === 0) {
        console.warn(`[SAVE-AUDIO] Slide ${slideIndex}: No base64 chunks, SKIPPING`);
        continue;
      }

      console.log(`[SAVE-AUDIO] Slide ${slideIndex}: ${base64Chunks.length} base64 chunks`);

      // Decode base64 chunks
      const chunkBytes: Uint8Array[] = [];
      for (let c = 0; c < base64Chunks.length; c++) {
        try {
          const binaryString = atob(base64Chunks[c]);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          chunkBytes.push(bytes);
          console.log(`[SAVE-AUDIO] Slide ${slideIndex}: Chunk ${c} decoded: ${bytes.length} bytes`);
        } catch (decodeErr) {
          console.error(`[SAVE-AUDIO] Slide ${slideIndex}: Chunk ${c} decode FAILED:`, decodeErr);
        }
      }

      if (chunkBytes.length === 0) {
        console.error(`[SAVE-AUDIO] Slide ${slideIndex}: All chunks failed, SKIPPING`);
        failedCount++;
        continue;
      }

      // Concatenate WAV chunks
      let combinedBytes: Uint8Array;
      if (chunkBytes.length === 1) {
        combinedBytes = chunkBytes[0];
      } else {
        let dataSize = 0;
        for (const chunk of chunkBytes) {
          dataSize += chunk.length - 44;
        }
        const totalSize = 44 + dataSize;
        combinedBytes = new Uint8Array(totalSize);
        combinedBytes.set(chunkBytes[0].subarray(0, 44), 0);
        const view = new DataView(combinedBytes.buffer);
        view.setUint32(4, totalSize - 8, true);
        view.setUint32(40, dataSize, true);
        let offset = 44;
        for (const chunk of chunkBytes) {
          const audioData = chunk.subarray(44);
          combinedBytes.set(audioData, offset);
          offset += audioData.length;
        }
        console.log(`[SAVE-AUDIO] Slide ${slideIndex}: Concatenated ${chunkBytes.length} WAV chunks -> ${combinedBytes.length} bytes`);
      }

      // Estimate duration from WAV header
      let estimatedDuration = 0;
      if (combinedBytes.length > 44) {
        const headerView = new DataView(combinedBytes.buffer);
        const sampleRate = headerView.getUint32(24, true);
        const numChannels = headerView.getUint16(22, true);
        const bitsPerSample = headerView.getUint16(34, true);
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const dataBytes = combinedBytes.length - 44;
        estimatedDuration = byteRate > 0 ? dataBytes / byteRate : 0;
        console.log(`[SAVE-AUDIO] Slide ${slideIndex}: WAV ${sampleRate}Hz, ${numChannels}ch, ${bitsPerSample}bit, ~${estimatedDuration.toFixed(1)}s`);
      }

      // Upload with retry (reuses single auth)
      const audioPath = `ai-presentations/${cache_id}/${language}/slide_${slideIndex}.wav`;
      try {
        const uploadStart = Date.now();
        const audioUrl = await uploadToB2WithRetry(combinedBytes, audioPath, 'audio/wav', authData, B2_BUCKET_ID, slideIndex);
        const uploadMs = Date.now() - uploadStart;
        console.log(`[SAVE-AUDIO] Slide ${slideIndex}: ✅ Upload complete (${combinedBytes.length} bytes, ${uploadMs}ms, ~${estimatedDuration.toFixed(1)}s)`);
        audioUrls.push({ slideIndex, audioUrl, duration: estimatedDuration });
        totalDuration += estimatedDuration;
        successCount++;
      } catch (uploadError) {
        console.error(`[SAVE-AUDIO] Slide ${slideIndex}: ❌ All retries FAILED:`, uploadError);
        failedCount++;
      }
    }

    console.log(`[SAVE-AUDIO] Summary: ${successCount}/${slides.length} slides saved, ${failedCount} failed, total duration: ${totalDuration.toFixed(1)}s`);

    // Update DB
    if (audioUrls.length > 0) {
      const audioDataWithLang = { language, urls: audioUrls };
      const { error: updateError } = await supabase
        .from('teaching_qa_cache')
        .update({
          slide_audio_urls: audioDataWithLang,
          total_duration_seconds: totalDuration
        })
        .eq('id', cache_id);

      if (updateError) {
        console.error(`[SAVE-AUDIO] ❌ DB update FAILED:`, updateError);
      } else {
        console.log(`[SAVE-AUDIO] ✅ DB updated: ${audioUrls.length} audio URLs saved`);
      }
    }

    const totalMs = Date.now() - startTime;
    console.log(`[SAVE-AUDIO] ========== DONE in ${totalMs}ms ==========`);

    return new Response(
      JSON.stringify({ success: true, audioUrls, totalDuration, processingTimeMs: totalMs, failedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const totalMs = Date.now() - startTime;
    console.error(`[SAVE-AUDIO] ❌ FATAL ERROR after ${totalMs}ms:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
