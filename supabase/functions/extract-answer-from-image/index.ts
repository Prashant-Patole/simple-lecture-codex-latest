import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, [...chunk]);
  }
  return btoa(binary);
}

async function callVisionAPI(apiUrl: string, apiKey: string, model: string, systemPrompt: string, userPrompt: string, imageDataUrl: string): Promise<Response> {
  return await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0.1,
    }),
  });
}

const GOOGLE_FALLBACK_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_url, question_context } = await req.json();

    if (!image_url) {
      return new Response(
        JSON.stringify({ error: 'image_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: aiConfig } = await supabase
      .from('ai_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_api_config')
      .maybeSingle();

    const config = aiConfig?.setting_value as any;

    let apiUrl: string, apiKey: string, model: string, provider: string;
    if (config?.enabled && config?.provider === 'openrouter' && config?.openrouter_api_key) {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions";
      apiKey = config.openrouter_api_key;
      model = config.default_model || "google/gemini-2.5-flash";
    } else if (config?.enabled && config?.provider === 'google' && config?.google_api_key) {
      apiUrl = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      apiKey = config.google_api_key;
      model = config.default_model || "gemini-2.5-flash";
      provider = 'google';
    } else if (config?.enabled && config?.provider === 'openai' && config?.openai_api_key) {
      apiUrl = "https://api.openai.com/v1/chat/completions";
      apiKey = config.openai_api_key;
      model = config.default_model || "gpt-4o-mini";
      provider = 'openai';
    } else {
      console.error('No valid AI API configuration found');
      return new Response(
        JSON.stringify({ error: 'AI API not configured. Please configure your API key in Admin Settings.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch image
    let imageDataUrl: string;
    if (image_url.startsWith('data:')) {
      imageDataUrl = image_url;
    } else {
      const imageResponse = await fetch(image_url);
      if (!imageResponse.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch image: ${imageResponse.status}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = arrayBufferToBase64(imageBuffer);
      const mimeType = contentType.split(';')[0].trim();
      imageDataUrl = `data:${mimeType};base64,${imageBase64}`;
    }

    const systemPrompt = `You are an expert at reading handwritten and typed mathematical answers from images.
Your job is to extract the EXACT answer written in the image.

Rules:
1. Extract ONLY the answer, not the question or any other text
2. Preserve mathematical notation - use LaTeX format for equations (e.g., \\frac{1}{2}, x^2, \\sqrt{3})
3. If multiple answers are visible, extract the final/main answer (usually the last one or the one that's underlined/boxed)
4. For multiple choice questions, extract just the option letter (A, B, C, D) or the full answer text
5. For numerical answers, extract the exact number including units if visible
6. If the answer is unclear or partially visible, provide your best interpretation
7. Return "UNREADABLE" only if the image is completely unreadable (too blurry, too dark, or no text visible)

Important: Return ONLY the extracted answer as plain text or LaTeX. Do not include any explanations or additional text.`;

    const userPrompt = question_context 
      ? `Extract the answer from this image. The question context is: "${question_context}"\n\nProvide only the answer, nothing else.`
      : `Extract the answer from this image. Provide only the answer, nothing else.`;

    console.log('Calling AI Vision API with model:', model);

    // Try primary model
    let response = await callVisionAPI(apiUrl, apiKey, model, systemPrompt, userPrompt, imageDataUrl);

    // Retry logic for transient errors (503, 429)
    if (response.status === 503 || response.status === 429) {
      console.log(`Got ${response.status}, retrying after 2s with same model...`);
      await response.text(); // consume body
      await new Promise(r => setTimeout(r, 2000));
      response = await callVisionAPI(apiUrl, apiKey, model, systemPrompt, userPrompt, imageDataUrl);
    }

    // If still failing and Google, try fallback models
    if ((response.status === 503 || response.status === 429) && provider === 'google') {
      for (const fallbackModel of GOOGLE_FALLBACK_MODELS) {
        if (fallbackModel === model) continue;
        console.log(`Retrying with fallback model: ${fallbackModel}`);
        await response.text();
        await new Promise(r => setTimeout(r, 1000));
        response = await callVisionAPI(apiUrl, apiKey, fallbackModel, systemPrompt, userPrompt, imageDataUrl);
        if (response.ok) break;
      }
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ error: 'Invalid or unauthorized API key.' }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to process image' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content?.trim() || '';

    console.log('Extracted text:', extractedText);

    let confidence: 'high' | 'medium' | 'low' = 'medium';
    if (extractedText === 'UNREADABLE' || extractedText === '') {
      confidence = 'low';
    } else if (extractedText.length > 0 && extractedText.length < 100) {
      confidence = 'high';
    }

    return new Response(
      JSON.stringify({ extracted_text: extractedText, confidence }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-answer-from-image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
