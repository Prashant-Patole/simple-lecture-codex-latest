import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 50+ topic-categorized Unsplash images for fallback
const UNSPLASH_BY_TOPIC: Record<string, string[]> = {
  physics: [
    "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80",
    "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=800&q=80",
    "https://images.unsplash.com/photo-1628595351029-c2bf17511435?w=800&q=80",
    "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
    "https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800&q=80",
  ],
  chemistry: [
    "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&q=80",
    "https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?w=800&q=80",
    "https://images.unsplash.com/photo-1616711906333-23cf8e024760?w=800&q=80",
    "https://images.unsplash.com/photo-1554475901-4538ddfbccc2?w=800&q=80",
    "https://images.unsplash.com/photo-1606206522398-44f24ebe5015?w=800&q=80",
  ],
  biology: [
    "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=800&q=80",
    "https://images.unsplash.com/photo-1559757175-5700dde675bc?w=800&q=80",
    "https://images.unsplash.com/photo-1576086213369-97a306d36557?w=800&q=80",
    "https://images.unsplash.com/photo-1614935151651-0bea6508db6b?w=800&q=80",
    "https://images.unsplash.com/photo-1518152006812-edab29b069ac?w=800&q=80",
  ],
  math: [
    "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&q=80",
    "https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=800&q=80",
    "https://images.unsplash.com/photo-1635372722656-389f87a941b7?w=800&q=80",
    "https://images.unsplash.com/photo-1518133910546-b6c2fb7d79e3?w=800&q=80",
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=800&q=80",
  ],
  career: [
    "https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=80",
    "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&q=80",
    "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&q=80",
    "https://images.unsplash.com/photo-1573497491208-6b1acb260507?w=800&q=80",
  ],
  exam: [
    "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&q=80",
    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800&q=80",
    "https://images.unsplash.com/photo-1513258496099-48168024aec0?w=800&q=80",
    "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=800&q=80",
    "https://images.unsplash.com/photo-1471107340929-a87cd0f5b5f3?w=800&q=80",
  ],
  study: [
    "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&q=80",
    "https://images.unsplash.com/photo-1523050854058-8df90110c476?w=800&q=80",
    "https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=800&q=80",
    "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?w=800&q=80",
    "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80",
  ],
  technology: [
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
    "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80",
    "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80",
    "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80",
    "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&q=80",
  ],
  medical: [
    "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=800&q=80",
    "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80",
    "https://images.unsplash.com/photo-1551076805-e1869033e561?w=800&q=80",
    "https://images.unsplash.com/photo-1582719471384-894fbb16564e?w=800&q=80",
    "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?w=800&q=80",
  ],
  general: [
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80",
    "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800&q=80",
    "https://images.unsplash.com/photo-1491841550275-ad7854e35ca6?w=800&q=80",
    "https://images.unsplash.com/photo-1546410531-bb4caa6b3dda?w=800&q=80",
    "https://images.unsplash.com/photo-1456406644174-8ddd4cd52a06?w=800&q=80",
  ],
};

const TOPIC_KEYWORDS: Record<string, string[]> = {
  physics: ['physics', 'force', 'motion', 'energy', 'wave', 'quantum', 'mechanics', 'electricity', 'magnet', 'optics', 'thermodynamics'],
  chemistry: ['chemistry', 'chemical', 'reaction', 'organic', 'inorganic', 'molecule', 'atom', 'element', 'compound', 'periodic'],
  biology: ['biology', 'cell', 'organism', 'genetics', 'evolution', 'anatomy', 'ecology', 'botany', 'zoology', 'dna'],
  math: ['math', 'calculus', 'algebra', 'geometry', 'trigonometry', 'equation', 'integral', 'differential', 'probability', 'statistics'],
  career: ['career', 'job', 'opportunity', 'profession', 'employment', 'industry', 'salary', 'placement', 'future', 'scope'],
  exam: ['exam', 'test', 'preparation', 'tips', 'strategy', 'practice', 'revision', 'score', 'marks', 'syllabus', 'paper'],
  study: ['study', 'learn', 'education', 'student', 'lecture', 'course', 'overview', 'platform', 'simplelecture', 'online'],
  technology: ['technology', 'coding', 'programming', 'computer', 'software', 'digital', 'engineering', 'data', 'algorithm', 'ai'],
  medical: ['medical', 'neet', 'doctor', 'health', 'medicine', 'clinical', 'hospital', 'disease', 'patient', 'pharmaceutical'],
};

function detectTopic(heading: string, courseName: string): string {
  const text = `${heading} ${courseName}`.toLowerCase();
  let bestTopic = 'general';
  let bestScore = 0;
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestTopic = topic;
    }
  }
  return bestTopic;
}

// Track used images within a single blog generation to avoid repeats
function getFallbackImage(heading: string, courseName: string, usedUrls: Set<string>): string {
  const topic = detectTopic(heading, courseName);
  const images = UNSPLASH_BY_TOPIC[topic] || UNSPLASH_BY_TOPIC.general;
  // Find unused image from the topic
  for (const img of images) {
    if (!usedUrls.has(img)) {
      usedUrls.add(img);
      return img;
    }
  }
  // If all topic images used, try general
  for (const img of UNSPLASH_BY_TOPIC.general) {
    if (!usedUrls.has(img)) {
      usedUrls.add(img);
      return img;
    }
  }
  // Last resort: pick random from all
  const allImages = Object.values(UNSPLASH_BY_TOPIC).flat();
  const unused = allImages.filter(img => !usedUrls.has(img));
  if (unused.length > 0) {
    const picked = unused[Math.floor(Math.random() * unused.length)];
    usedUrls.add(picked);
    return picked;
  }
  return allImages[Math.floor(Math.random() * allImages.length)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get AI API config from admin settings
    const { data: aiConfig } = await supabaseAdmin
      .from('ai_settings')
      .select('setting_value')
      .eq('setting_key', 'ai_api_config')
      .maybeSingle();

    const config = aiConfig?.setting_value as any;

    if (!config?.enabled) {
      return new Response(
        JSON.stringify({ error: 'AI API not configured. Please set it up in Admin → Settings → AI Functions API Key Settings.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all courses
    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id, name, slug, description, short_description, category, subjects, what_you_learn')
      .eq('is_active', true);

    if (!courses || courses.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active courses found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pick course not recently blogged
    const { data: recentPosts } = await supabaseAdmin
      .from('blog_posts')
      .select('course_id')
      .order('created_at', { ascending: false })
      .limit(Math.max(1, courses.length - 1));

    const recentCourseIds = new Set((recentPosts || []).map(p => p.course_id));
    let selectedCourse = courses.find(c => !recentCourseIds.has(c.id));
    if (!selectedCourse) {
      selectedCourse = courses[Math.floor(Math.random() * courses.length)];
    }

    console.log(`Generating blog for course: ${selectedCourse.name}`);

    // Generate blog content
    const blogPrompt = `You are an expert educational content writer for SimpleLecture, an online learning platform. Write an in-depth, SEO-optimized blog post about this course:

Course: ${selectedCourse.name}
Description: ${selectedCourse.description || selectedCourse.short_description || ''}
Category: ${selectedCourse.category || 'Education'}
Subjects: ${JSON.stringify(selectedCourse.subjects || [])}
What You Learn: ${JSON.stringify(selectedCourse.what_you_learn || [])}

REQUIREMENTS:
1. Write 5-6 detailed sections covering different aspects: course overview, key subjects breakdown, study strategies, career opportunities, exam preparation tips, why SimpleLecture platform
2. Each section should be 150-250 words with proper H2 headings
3. Include relevant SEO keywords naturally
4. Write in an engaging, student-friendly tone
5. Include actionable tips and insights
6. Mention SimpleLecture platform benefits naturally

Return ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "title": "SEO-optimized blog title (50-60 chars)",
  "meta_description": "Compelling meta description (150-160 chars)",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],
  "sections": [
    {"heading": "Section H2 heading", "content": "Full section content with paragraphs..."},
    {"heading": "Section H2 heading", "content": "Full section content with paragraphs..."}
  ]
}`;

    // ===== TEXT GENERATION with multi-model fallback =====
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const googleKey = config.google_api_key || null;
    const openaiKey = config.openai_api_key || null;
    const openrouterKey = config.openrouter_api_key || null;
    const lovableKey = Deno.env.get('LOVABLE_API_KEY') || null;

    async function callGoogleText(model: string): Promise<string> {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleKey}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: blogPrompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
        }),
      });
      if (!r.ok) throw new Error(`Google ${model} ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const data = await r.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    async function callOpenAICompatText(baseUrl: string, key: string, model: string, keyHeader = 'Authorization', keyPrefix = 'Bearer '): Promise<string> {
      const r = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', [keyHeader]: `${keyPrefix}${key}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: blogPrompt }],
          temperature: 0.8,
        }),
      });
      if (!r.ok) throw new Error(`${baseUrl} ${model} ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const data = await r.json();
      return data.choices?.[0]?.message?.content || '';
    }

    const textProviders: Array<{ name: string; run: () => Promise<string> }> = [];
    if (openrouterKey) {
      const orModel = config.default_model || 'google/gemini-2.5-flash';
      textProviders.push({ name: `openrouter:${orModel}`, run: () => callOpenAICompatText('https://openrouter.ai/api/v1/chat/completions', openrouterKey, orModel) });
      textProviders.push({ name: 'openrouter:google/gemini-2.5-flash', run: () => callOpenAICompatText('https://openrouter.ai/api/v1/chat/completions', openrouterKey, 'google/gemini-2.5-flash') });
    }
    if (googleKey) {
      textProviders.push({ name: `google:${config.default_model || 'gemini-2.5-flash'}`, run: () => callGoogleText(config.default_model || 'gemini-2.5-flash') });
      textProviders.push({ name: 'google:gemini-2.0-flash', run: () => callGoogleText('gemini-2.0-flash') });
    }
    if (lovableKey) {
      textProviders.push({ name: 'lovable:google/gemini-2.5-flash', run: () => callOpenAICompatText('https://ai.gateway.lovable.dev/v1/chat/completions', lovableKey, 'google/gemini-2.5-flash') });
      textProviders.push({ name: 'lovable:google/gemini-2.5-flash-lite', run: () => callOpenAICompatText('https://ai.gateway.lovable.dev/v1/chat/completions', lovableKey, 'google/gemini-2.5-flash-lite') });
    }
    if (openaiKey) {
      textProviders.push({ name: 'openai:gpt-4o-mini', run: () => callOpenAICompatText('https://api.openai.com/v1/chat/completions', openaiKey, 'gpt-4o-mini') });
    }

    let blogData: any = null;
    let lastTextErr = '';
    for (const p of textProviders) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const text = await p.run();
          const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          blogData = JSON.parse(cleaned);
          console.log(`[Text Gen] ✓ ${p.name} (attempt ${attempt})`);
          break;
        } catch (e: any) {
          lastTextErr = e?.message || String(e);
          const retryable = /\b(429|500|502|503|504|overload|UNAVAILABLE)\b/i.test(lastTextErr);
          console.warn(`[Text Gen] ✗ ${p.name} attempt ${attempt}: ${lastTextErr.slice(0, 200)}`);
          if (attempt === 1 && retryable) { await sleep(2000); continue; }
          break;
        }
      }
      if (blogData) break;
    }

    if (!blogData) {
      return new Response(
        JSON.stringify({ error: `All text providers failed. Last: ${lastTextErr}` }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ===== IMAGE GENERATION with multi-model fallback chain =====
    let featuredImageUrl: string | null = null;
    const sectionsWithImages: any[] = [];
    const usedFallbackUrls = new Set<string>();

    const STYLE_VARIANTS = [
      'cinematic photograph, natural lighting, shallow depth of field',
      'editorial photography, warm golden-hour lighting, candid moment',
      'documentary photograph, soft daylight, authentic detail',
      'magazine-quality photo, vibrant colors, crisp focus',
      'lifestyle photograph, bright airy lighting, modern aesthetic',
      'professional photograph, dramatic side lighting, rich tones',
    ];
    const seed = Math.floor(Math.random() * 1_000_000);

    async function uploadImageBytes(bytes: Uint8Array, label: string, ext = 'png', contentType = 'image/png'): Promise<string | null> {
      const fileName = `blog_${Date.now()}_${label.replace(/[^a-z0-9]+/gi, '_')}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { data: up, error: upErr } = await supabaseAdmin.storage
        .from('blog-images')
        .upload(fileName, bytes.buffer, { contentType, cacheControl: '86400', upsert: true });
      if (upErr || !up) {
        console.error(`[Image Gen] ${label}: upload failed`, upErr?.message);
        return null;
      }
      const { data: urlData } = supabaseAdmin.storage.from('blog-images').getPublicUrl(up.path);
      return urlData.publicUrl;
    }

    function b64ToBytes(b64: string): Uint8Array {
      const bin = atob(b64);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }

    // Provider 1 & 2: Google Gemini direct (different models)
    async function tryGoogleImage(model: string, prompt: string, label: string): Promise<string | null> {
      if (!googleKey) return null;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${googleKey}`;
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        const err: any = new Error(`google:${model} ${r.status}: ${t.slice(0, 200)}`);
        err.status = r.status;
        throw err;
      }
      const data = await r.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imgPart = parts.find((p: any) => p.inlineData?.data);
      if (!imgPart) throw new Error(`google:${model} returned no image`);
      return await uploadImageBytes(b64ToBytes(imgPart.inlineData.data), label);
    }

    // Provider 3: Lovable AI Gateway
    async function tryLovableImage(model: string, prompt: string, label: string): Promise<string | null> {
      if (!lovableKey) return null;
      const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lovableKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          modalities: ['image', 'text'],
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        const err: any = new Error(`lovable:${model} ${r.status}: ${t.slice(0, 200)}`);
        err.status = r.status;
        throw err;
      }
      const data = await r.json();
      const imgUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imgUrl) throw new Error(`lovable:${model} returned no image`);
      // imgUrl is data:image/png;base64,XXXX
      const m = /^data:(image\/[^;]+);base64,(.+)$/.exec(imgUrl);
      if (!m) throw new Error(`lovable:${model} unexpected image format`);
      return await uploadImageBytes(b64ToBytes(m[2]), label, 'png', m[1]);
    }

    // Provider 4: OpenAI gpt-image-1
    async function tryOpenAIImage(prompt: string, label: string): Promise<string | null> {
      if (!openaiKey) return null;
      const r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
        body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', n: 1 }),
      });
      if (!r.ok) {
        const t = await r.text();
        const err: any = new Error(`openai:gpt-image-1 ${r.status}: ${t.slice(0, 200)}`);
        err.status = r.status;
        throw err;
      }
      const data = await r.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error(`openai:gpt-image-1 returned no image`);
      return await uploadImageBytes(b64ToBytes(b64), label);
    }

    type ImgProvider = { name: string; run: (prompt: string, label: string) => Promise<string | null> };
    const imageProviders: ImgProvider[] = [];
    if (googleKey) {
      imageProviders.push({ name: 'google:gemini-2.5-flash-image', run: (p, l) => tryGoogleImage('gemini-2.5-flash-image', p, l) });
      imageProviders.push({ name: 'google:gemini-2.0-flash-exp-image-generation', run: (p, l) => tryGoogleImage('gemini-2.0-flash-exp-image-generation', p, l) });
    }
    if (lovableKey) {
      imageProviders.push({ name: 'lovable:google/gemini-2.5-flash-image-preview', run: (p, l) => tryLovableImage('google/gemini-2.5-flash-image-preview', p, l) });
    }
    if (openaiKey) {
      imageProviders.push({ name: 'openai:gpt-image-1', run: (p, l) => tryOpenAIImage(p, l) });
    }

    async function generateImageWithFallback(prompt: string, label: string, fallbackHeading: string): Promise<string> {
      for (const p of imageProviders) {
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const url = await p.run(prompt, label);
            if (url) {
              console.log(`[Image Gen] ${label} ✓ ${p.name} (attempt ${attempt})`);
              return url;
            }
          } catch (e: any) {
            const msg = e?.message || String(e);
            const status = e?.status || 0;
            const retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || /overload|UNAVAILABLE/i.test(msg);
            const authErr = status === 401 || status === 403 || status === 402;
            console.warn(`[Image Gen] ${label} ✗ ${p.name} attempt ${attempt}: ${msg.slice(0, 200)}`);
            if (attempt === 1 && retryable && !authErr) { await sleep(1500); continue; }
            break; // move to next provider
          }
        }
      }
      // Final fallback: curated Unsplash
      const fallback = getFallbackImage(fallbackHeading, selectedCourse.name, usedFallbackUrls);
      console.log(`[Image Gen] ${label} ← unsplash-fallback ${fallback}`);
      return fallback;
    }

    function buildPrompt(opts: { heading: string; excerpt: string; index: number; isHero?: boolean }) {
      const style = STYLE_VARIANTS[(opts.index + seed) % STYLE_VARIANTS.length];
      const hero = opts.isHero ? 'wide hero composition with strong focal point, ' : 'square or 16:9 composition, ';
      return [
        `Create a unique, photorealistic ${opts.isHero ? 'featured hero image' : 'editorial image'} for a blog about "${blogData.title}".`,
        `Section: "${opts.heading}".`,
        `Visual concept must reflect: ${opts.excerpt}`,
        `Course context: ${selectedCourse.name} (${selectedCourse.category || 'education'}).`,
        `Style: ${style}, ${hero}India-relevant student/study context where people appear (Indian students, modern Indian classroom or home study setting).`,
        `Strict rules: NO text, NO words, NO letters, NO logos, NO watermarks, NO UI elements, NO charts. The image must be visually distinct from generic stock photos and unique to this specific topic. Variation seed: ${seed}-${opts.index}.`,
      ].join(' ');
    }

    // Hero image
    const heroExcerpt = (blogData.meta_description || '').slice(0, 200) + ' — ' + (blogData.sections[0]?.content || '').slice(0, 200);
    featuredImageUrl = await generateImageWithFallback(
      buildPrompt({ heading: blogData.title, excerpt: heroExcerpt, index: 0, isHero: true }),
      'hero',
      blogData.title
    );

    // Per-section images
    for (let i = 0; i < blogData.sections.length; i++) {
      const section = blogData.sections[i];
      const excerpt = String(section.content || '').replace(/\s+/g, ' ').slice(0, 240);
      const imageUrl = await generateImageWithFallback(
        buildPrompt({ heading: section.heading, excerpt, index: i + 1 }),
        `section_${i}`,
        section.heading
      );
      sectionsWithImages.push({
        heading: section.heading,
        content: section.content,
        image_url: imageUrl,
      });
    }

    // Create slug
    const slug = blogData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);

    // Insert blog post
    const { data: post, error: insertError } = await supabaseAdmin
      .from('blog_posts')
      .insert({
        title: blogData.title,
        slug,
        meta_description: blogData.meta_description,
        keywords: blogData.keywords || [],
        course_id: selectedCourse.id,
        sections: sectionsWithImages,
        featured_image_url: featuredImageUrl,
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to insert blog post: ${insertError.message}`);
    }

    console.log(`Blog post created: ${post.title} (${post.slug})`);

    return new Response(
      JSON.stringify({ success: true, post }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating blog post:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
