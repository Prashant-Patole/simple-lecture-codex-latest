import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('503') || errorMessage.includes('service_unavailable') || errorMessage.includes('no tomes available')) {
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`Attempt ${attempt + 1} failed with 503, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      } else {
        throw error;
      }
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

interface UploadRequest {
  storagePath: string;
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  metadata: {
    entityType: string;
    categoryId?: string;
    subjectId?: string;
    chapterId?: string;
    topicId?: string;
    subtopicId?: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const requestData: UploadRequest = await req.json();
    const { storagePath, filePath, fileName, fileType, fileSize, metadata } = requestData;

    console.log('Upload request - storagePath:', storagePath);
    console.log('Upload request - target filePath:', filePath);
    console.log('Upload metadata:', metadata);

    // Step 1: Download file from Supabase temp storage
    console.log('Downloading from temp storage...');
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('temp-uploads')
      .download(storagePath);

    if (downloadError) {
      console.error('Failed to download from temp storage:', downloadError);
      throw new Error(`Failed to download temp file: ${downloadError.message}`);
    }

    // Convert blob to Uint8Array
    const fileBytes = new Uint8Array(await fileData.arrayBuffer());
    console.log('Downloaded file size:', fileBytes.length, 'bytes');

    // Get B2 credentials
    const B2_KEY_ID = Deno.env.get('B2_KEY_ID');
    const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY');
    const B2_BUCKET_ID = Deno.env.get('B2_BUCKET_ID');

    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_ID) {
      throw new Error('B2 credentials not configured');
    }

    // Step 2: Authorize with B2
    const authResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`)
      }
    });

    if (!authResponse.ok) {
      throw new Error(`B2 authorization failed: ${await authResponse.text()}`);
    }

    const authData = await authResponse.json();
    console.log('B2 authorized successfully');

    // Step 3: Get upload URL with retry logic
    const uploadUrlData = await retryWithBackoff(async () => {
      const uploadUrlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: {
          'Authorization': authData.authorizationToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bucketId: B2_BUCKET_ID })
      });

      if (!uploadUrlResponse.ok) {
        const errorText = await uploadUrlResponse.text();
        throw new Error(`Failed to get upload URL (${uploadUrlResponse.status}): ${errorText}`);
      }

      return await uploadUrlResponse.json();
    });

    console.log('Got upload URL');

    // Step 4: Calculate SHA1 hash
    const hashBuffer = await crypto.subtle.digest('SHA-1', fileBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha1Hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Percent-encode file path for B2 (required by B2 API)
    const encodedFilePath = filePath
      .split('/')
      .map((segment: string) => encodeURIComponent(segment))
      .join('/');
    
    console.log('Encoded filePath for B2:', encodedFilePath);

    // Step 5: Upload file to B2 with retry logic
    const uploadResult = await retryWithBackoff(async () => {
      const uploadResponse = await fetch(uploadUrlData.uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': uploadUrlData.authorizationToken,
          'X-Bz-File-Name': encodedFilePath,
          'Content-Type': fileType,
          'Content-Length': fileBytes.length.toString(),
          'X-Bz-Content-Sha1': sha1Hash
        },
        body: fileBytes
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Upload failed (${uploadResponse.status}): ${errorText}`);
      }

      return await uploadResponse.json();
    });
    console.log('File uploaded successfully to B2:', uploadResult.fileId);

    // Step 6: Delete temp file from Supabase Storage
    console.log('Cleaning up temp file...');
    const { error: deleteError } = await supabase
      .storage
      .from('temp-uploads')
      .remove([storagePath]);

    if (deleteError) {
      console.warn('Failed to delete temp file (non-fatal):', deleteError);
    } else {
      console.log('Temp file cleaned up successfully');
    }

    // Step 7: Save metadata to database
    const { data: storageFile, error: dbError } = await supabase
      .from('storage_files')
      .insert({
        file_name: fileName,
        file_path: encodedFilePath,
        file_size: fileBytes.length,
        file_type: fileType,
        b2_file_id: uploadResult.fileId,
        entity_type: metadata.entityType,
        category_id: metadata.categoryId || null,
        subject_id: metadata.subjectId || null,
        chapter_id: metadata.chapterId || null,
        topic_id: metadata.topicId || null,
        subtopic_id: metadata.subtopicId || null,
        uploaded_by: user.id
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error(`Failed to save file metadata: ${dbError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileId: uploadResult.fileId,
        filePath: encodedFilePath,
        storageFile
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in b2-upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
