// B2 Proxy File - Securely streams files from Backblaze B2 storage (v2)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get auth from header OR query parameter (for iframe requests)
    const reqUrl = new URL(req.url);
    const tokenFromQuery = reqUrl.searchParams.get('token');
    const authHeader = req.headers.get('Authorization');

    // Build authorization string - prefer header, fallback to query param
    let authorization: string | null = null;
    if (authHeader) {
      authorization = authHeader;
    } else if (tokenFromQuery) {
      authorization = `Bearer ${tokenFromQuery}`;
    }

    if (!authorization) {
      return new Response(JSON.stringify({ error: 'No authorization provided' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is authenticated
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get file path from query params
    const url = new URL(req.url);
    const filePath = url.searchParams.get('path');
    
    if (!filePath) {
      return new Response(JSON.stringify({ error: 'Missing file path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Proxying file: ${filePath}`);

    // Get B2 credentials
    const keyId = Deno.env.get('B2_KEY_ID');
    const applicationKey = Deno.env.get('B2_APPLICATION_KEY');
    const bucketName = Deno.env.get('B2_BUCKET_NAME');

    if (!keyId || !applicationKey || !bucketName) {
      console.error('Missing B2 credentials');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Authorize with B2
    const authString = btoa(`${keyId}:${applicationKey}`);
    const b2AuthResponse = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
      headers: { 'Authorization': `Basic ${authString}` },
    });

    if (!b2AuthResponse.ok) {
      console.error('B2 auth failed:', await b2AuthResponse.text());
      return new Response(JSON.stringify({ error: 'Storage authorization failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const b2Auth = await b2AuthResponse.json();
    const { authorizationToken, apiUrl, downloadUrl } = b2Auth;

    console.log('B2 authorized, fetching file...');

    // Fetch the file from B2
    const fileUrl = `${downloadUrl}/file/${bucketName}/${filePath}`;
    const fileResponse = await fetch(fileUrl, {
      headers: { 'Authorization': authorizationToken },
    });

    if (!fileResponse.ok) {
      console.error('Failed to fetch file from B2:', fileResponse.status, await fileResponse.text());
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get content type from response or determine from file extension
    let contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
    if (filePath.toLowerCase().endsWith('.pdf')) {
      contentType = 'application/pdf';
    }

    console.log(`Streaming file with content-type: ${contentType}`);

    // Stream the file back to the client
    return new Response(fileResponse.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error in b2-proxy-file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
