// Preview endpoint: detects subtopic sections inside an ai_assistant_documents
// row (markdown) and returns them so the admin can review before committing.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface Section {
  title: string;
  content_markdown: string;
  image_urls: string[];
}

const HEADING_RE = /^\s{0,3}(?:#{1,6}\s*)?(\*\*)?\s*(\d+(?:\.\d+)+)\s+([^\n*]+?)(\*\*)?\s*$/;

function extractImages(md: string): string[] {
  const urls: string[] = [];
  const re = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = re.exec(md)) !== null) urls.push(m[1]);
  return urls;
}

function regexSplit(markdown: string): Section[] {
  const lines = markdown.split('\n');
  const sections: Section[] = [];
  let current: { title: string; lines: string[] } | null = null;

  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m) {
      if (current) {
        const body = current.lines.join('\n').trim();
        sections.push({ title: current.title, content_markdown: body, image_urls: extractImages(body) });
      }
      current = { title: `${m[2]} ${m[3].trim()}`, lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) {
    const body = current.lines.join('\n').trim();
    sections.push({ title: current.title, content_markdown: body, image_urls: extractImages(body) });
  }
  return sections;
}

async function geminiSplit(markdown: string): Promise<Section[]> {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) return [];
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'You split chapter markdown into per-subtopic sections. Reply ONLY as JSON: {"sections":[{"title":"...","content_markdown":"..."}]}. Keep original markdown verbatim (headings, lists, images).',
          },
          { role: 'user', content: markdown.slice(0, 60000) },
        ],
      }),
    });
    if (!res.ok) return [];
    const json = await res.json();
    const txt: string = json.choices?.[0]?.message?.content || '';
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return (parsed.sections || []).map((s: any) => ({
      title: String(s.title || 'Untitled'),
      content_markdown: String(s.content_markdown || ''),
      image_urls: extractImages(String(s.content_markdown || '')),
    }));
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: 'documentId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: doc, error } = await supabase
      .from('ai_assistant_documents')
      .select('id, full_content, content_preview, source_url, file_name')
      .eq('id', documentId)
      .maybeSingle();
    if (error || !doc) {
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let markdown = '';
    const fc: any = doc.full_content;
    if (typeof fc === 'string') markdown = fc;
    else if (fc?.markdown) markdown = fc.markdown;
    else if (fc?.content) markdown = fc.content;
    else if (fc?.text) markdown = fc.text;
    if (!markdown && doc.content_preview) markdown = doc.content_preview;

    if (!markdown) {
      return new Response(
        JSON.stringify({ error: 'No markdown content available for this document' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sections = regexSplit(markdown);
    if (sections.length < 2) {
      const ai = await geminiSplit(markdown);
      if (ai.length >= 2) sections = ai;
    }

    return new Response(JSON.stringify({ sections, source: sections.length >= 2 ? 'ok' : 'none' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
