import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// B2 Large File Upload - handles multipart uploads for files > 100MB
// Supports: start, get-upload-url, upload-part, finish, cancel

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

    const { action, ...params } = await req.json();

    // Get B2 credentials
    const B2_KEY_ID = Deno.env.get('B2_KEY_ID');
    const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY');
    const B2_BUCKET_ID = Deno.env.get('B2_BUCKET_ID');

    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_ID) {
      throw new Error('B2 credentials not configured');
    }

    // Authorize with B2
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

    switch (action) {
      case 'start': {
        // Start a large file upload
        const { fileName, contentType } = params;
        
        const encodedFileName = fileName
          .split('/')
          .map((segment: string) => encodeURIComponent(segment))
          .join('/');

        const response = await fetch(`${authData.apiUrl}/b2api/v2/b2_start_large_file`, {
          method: 'POST',
          headers: {
            'Authorization': authData.authorizationToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            bucketId: B2_BUCKET_ID,
            fileName: encodedFileName,
            contentType: contentType || 'video/mp4'
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to start large file: ${await response.text()}`);
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ success: true, fileId: data.fileId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'upload-part': {
        // Upload a part through the edge function (bypasses CORS)
        const { fileId, partNumber, partData } = params;

        // Get upload URL for this part
        const urlResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_upload_part_url`, {
          method: 'POST',
          headers: {
            'Authorization': authData.authorizationToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fileId })
        });

        if (!urlResponse.ok) {
          throw new Error(`Failed to get upload URL: ${await urlResponse.text()}`);
        }

        const urlData = await urlResponse.json();

        // Decode base64 to bytes
        const binaryString = atob(partData);
        const partBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          partBytes[i] = binaryString.charCodeAt(i);
        }

        // Calculate SHA1
        const hashBuffer = await crypto.subtle.digest('SHA-1', partBytes);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const partSha1 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // Upload to B2
        const uploadResponse = await fetch(urlData.uploadUrl, {
          method: 'POST',
          headers: {
            'Authorization': urlData.authorizationToken,
            'Content-Length': partBytes.length.toString(),
            'X-Bz-Part-Number': partNumber.toString(),
            'X-Bz-Content-Sha1': partSha1
          },
          body: partBytes
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload part: ${await uploadResponse.text()}`);
        }

        return new Response(
          JSON.stringify({ success: true, partSha1 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'finish': {
        // Finish the large file upload
        const { fileId, partSha1Array } = params;

        const response = await fetch(`${authData.apiUrl}/b2api/v2/b2_finish_large_file`, {
          method: 'POST',
          headers: {
            'Authorization': authData.authorizationToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileId,
            partSha1Array
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to finish large file: ${await response.text()}`);
        }

        const data = await response.json();
        return new Response(
          JSON.stringify({ success: true, file: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cancel': {
        // Cancel the large file upload
        const { fileId } = params;

        const response = await fetch(`${authData.apiUrl}/b2api/v2/b2_cancel_large_file`, {
          method: 'POST',
          headers: {
            'Authorization': authData.authorizationToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ fileId })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('Failed to cancel large file:', errorText);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in b2-large-upload:', error);
    const errorMessage = error instanceof Error ? error.message : 'Operation failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
