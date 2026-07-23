import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { filePath } = await req.json();

    if (!filePath) {
      throw new Error('File path is required');
    }

    console.log('Download URL request - Raw filePath:', filePath);

    // Get B2 credentials
    const B2_KEY_ID = Deno.env.get('B2_KEY_ID');
    const B2_APPLICATION_KEY = Deno.env.get('B2_APPLICATION_KEY');
    const B2_BUCKET_ID = Deno.env.get('B2_BUCKET_ID');

    if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET_ID) {
      throw new Error('B2 credentials not configured');
    }

    // Step 1: Authorize with B2
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
    console.log('B2 authorized, API URL:', authData.apiUrl);

    // Encode file path for B2 (same encoding as upload)
    const encodedFilePath = filePath
      .split('/')
      .map((segment: string) => encodeURIComponent(segment))
      .join('/');
    
    console.log('Encoded filePath:', encodedFilePath);

    // Step 2: Get download authorization (valid for 1 hour)
    // Use encoded path to match how files are stored in B2
    const authTokenResponse = await fetch(`${authData.apiUrl}/b2api/v2/b2_get_download_authorization`, {
      method: 'POST',
      headers: {
        'Authorization': authData.authorizationToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bucketId: B2_BUCKET_ID,
        fileNamePrefix: encodedFilePath, // Matches how file was stored
        validDurationInSeconds: 3600 // 1 hour
      })
    });

    if (!authTokenResponse.ok) {
      const errorText = await authTokenResponse.text();
      console.error('Failed to get download authorization:', errorText);
      throw new Error(`Failed to get download authorization: ${errorText}`);
    }

    const authTokenData = await authTokenResponse.json();
    console.log('Download authorization obtained successfully');

    // Step 3: Generate authorized download URL (using same encoded path)
    const downloadUrl = `${authData.downloadUrl}/file/${Deno.env.get('B2_BUCKET_NAME')}/${encodedFilePath}?Authorization=${authTokenData.authorizationToken}`;
    
    console.log('Generated download URL (auth token masked):', downloadUrl.replace(/Authorization=[^&]+/, 'Authorization=***'));

    return new Response(
      JSON.stringify({
        success: true,
        downloadUrl,
        expiresIn: 3600
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in b2-get-download-url:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate download URL';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
