import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider, apiKey, model } = await req.json();

    if (!provider || !apiKey || !model) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: provider, apiKey, model' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let apiUrl: string;
    let requestBody: any;
    let headers: Record<string, string>;

    const baseBody = {
      model,
      messages: [{ role: "user", content: "Say 'Connection successful!' in exactly those words." }],
      max_tokens: 20,
    };

    if (provider === 'google') {
      apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
      requestBody = baseBody;
    } else if (provider === 'openai') {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
      requestBody = baseBody;
    } else if (provider === 'openrouter') {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://simplelecture.com',
        'X-Title': 'SimpleLecture',
      };
      requestBody = baseBody;
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid provider. Must be "google", "openai" or "openrouter"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Testing ${provider} connection with model: ${model}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error (${response.status}):`, errorText);
      
      let errorMessage = 'API connection failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        errorMessage = errorText.substring(0, 200);
      }

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          status: response.status 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const responseText = data.choices?.[0]?.message?.content || '';

    console.log(`Connection test successful. Response: ${responseText}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Connection successful!',
        model_response: responseText,
        provider,
        model,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error testing AI connection:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
