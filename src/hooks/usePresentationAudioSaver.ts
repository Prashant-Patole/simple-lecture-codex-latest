import { supabase } from '@/integrations/supabase/client';
import { PresentationSlide } from './useTeachingAssistant';
import { Json } from '@/integrations/supabase/types';

export interface SlideAudioUrl {
  slideIndex: number;
  audioUrl: string;
  duration: number;
}

// Save presentation audio to Supabase storage and update cache record
export async function savePresentationAudio(
  cacheId: string,
  slides: PresentationSlide[],
  languageCode: string,
  getAudioBlobForSlide: (narration: string, lang: string) => { blob?: Blob; base64Contents?: string[] } | null
): Promise<SlideAudioUrl[]> {
  const audioUrls: SlideAudioUrl[] = [];
  
  console.log(`[AudioSaver] Starting audio save for ${slides.length} slides...`);
  
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const narrationText = slide.narration || slide.content;
    
    if (!narrationText?.trim()) {
      console.log(`[AudioSaver] Slide ${i + 1}: No narration, skipping`);
      continue;
    }
    
    const cached = getAudioBlobForSlide(narrationText, languageCode);
    if (!cached) {
      console.log(`[AudioSaver] Slide ${i + 1}: No cached audio found, skipping`);
      continue;
    }
    
    try {
      let audioBlob: Blob | null = null;
      
      // Get blob from cache (either direct blob or from base64)
      if (cached.blob) {
        audioBlob = cached.blob;
        console.log(`[AudioSaver] Slide ${i + 1}: Using direct blob (${audioBlob.size} bytes)`);
      } else if (cached.base64Contents && cached.base64Contents.length > 0) {
        // Convert each base64 chunk to a Blob
        const wavBlobs: Blob[] = [];
        for (const base64 of cached.base64Contents) {
          const binaryString = atob(base64);
          const bytes = new Uint8Array(binaryString.length);
          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }
          wavBlobs.push(new Blob([bytes], { type: 'audio/wav' }));
        }
        
        // Properly concatenate WAV files (strip headers from all but first)
        audioBlob = await concatenateWavBlobs(wavBlobs);
        console.log(`[AudioSaver] Slide ${i + 1}: Combined ${wavBlobs.length} WAV chunks into ${audioBlob.size} bytes`);
      }
      
      if (!audioBlob) {
        console.log(`[AudioSaver] Slide ${i + 1}: Could not create blob, skipping`);
        continue;
      }
      
      // Get duration from blob
      const duration = await getAudioDuration(audioBlob);
      
      // Upload to Supabase storage
      const fileName = `${cacheId}/${languageCode}/slide_${i}.wav`;
      
      const { error: uploadError } = await supabase.storage
        .from('presentation-audio')
        .upload(fileName, audioBlob, {
          contentType: 'audio/wav',
          upsert: true
        });
      
      if (uploadError) {
        console.error(`[AudioSaver] Slide ${i + 1}: Upload error:`, uploadError);
        continue;
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('presentation-audio')
        .getPublicUrl(fileName);
      
      if (urlData?.publicUrl) {
        audioUrls.push({
          slideIndex: i,
          audioUrl: urlData.publicUrl,
          duration
        });
        console.log(`[AudioSaver] Slide ${i + 1}: Saved successfully (${duration.toFixed(1)}s)`);
      }
    } catch (err) {
      console.error(`[AudioSaver] Slide ${i + 1}: Error:`, err);
    }
  }
  
  // Update cache record with audio URLs
  if (audioUrls.length > 0) {
    const totalDuration = audioUrls.reduce((sum, a) => sum + a.duration, 0);
    
    // Cast to Json type for Supabase
    const audioUrlsJson: Json = audioUrls.map(a => ({
      slideIndex: a.slideIndex,
      audioUrl: a.audioUrl,
      duration: a.duration
    }));
    
    const { error: updateError } = await supabase
      .from('teaching_qa_cache')
      .update({
        slide_audio_urls: audioUrlsJson,
        total_duration_seconds: totalDuration
      })
      .eq('id', cacheId);
    
    if (updateError) {
      console.error('[AudioSaver] Failed to update cache record:', updateError);
    } else {
      console.log(`[AudioSaver] Updated cache record with ${audioUrls.length} audio URLs (${totalDuration.toFixed(1)}s total)`);
    }
  }
  
  return audioUrls;
}

// Concatenate multiple WAV blobs into one properly-formatted WAV file
async function concatenateWavBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) return new Blob([], { type: 'audio/wav' });
  if (blobs.length === 1) return blobs[0];

  // Convert all blobs to ArrayBuffers
  const buffers: ArrayBuffer[] = [];
  for (const blob of blobs) {
    buffers.push(await blob.arrayBuffer());
  }

  // Calculate total data size (excluding 44-byte WAV headers from each chunk)
  let totalDataSize = 0;
  for (const buffer of buffers) {
    totalDataSize += buffer.byteLength - 44;
  }

  // Get header info from first file
  const firstView = new DataView(buffers[0]);
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
  resultBytes.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  resultView.setUint32(4, 36 + totalDataSize, true); // File size - 8
  resultBytes.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"
  
  resultBytes.set([0x66, 0x6D, 0x74, 0x20], 12); // "fmt "
  resultView.setUint32(16, 16, true); // fmt chunk size
  resultView.setUint16(20, 1, true); // Audio format (PCM)
  resultView.setUint16(22, numChannels, true);
  resultView.setUint32(24, sampleRate, true);
  resultView.setUint32(28, byteRate, true);
  resultView.setUint16(32, blockAlign, true);
  resultView.setUint16(34, bitsPerSample, true);
  
  resultBytes.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  resultView.setUint32(40, totalDataSize, true);

  // Copy audio data from all buffers (skip 44-byte headers)
  let offset = 44;
  for (const buffer of buffers) {
    const sourceBytes = new Uint8Array(buffer, 44);
    resultBytes.set(sourceBytes, offset);
    offset += sourceBytes.length;
  }

  console.log(`[AudioSaver] Concatenated ${buffers.length} WAV chunks into ${resultBuffer.byteLength} bytes`);
  return new Blob([resultBuffer], { type: 'audio/wav' });
}

// Helper to get audio duration from blob
async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(blob);
    
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration || 0);
    });
    
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      resolve(0);
    });
    
    // Timeout fallback
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(0);
    }, 3000);
    
    audio.src = url;
  });
}
