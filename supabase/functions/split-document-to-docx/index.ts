// Commit endpoint: takes confirmed sections, generates a .docx per section
// (with text + embedded images), uploads to Supabase storage, and creates
// child ai_assistant_documents rows linked back to the parent.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ImageRun,
  AlignmentType,
} from 'npm:docx@8.5.0';

interface InSection {
  title: string;
  content_markdown: string;
  include?: boolean;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'section';
}

async function fetchImage(url: string): Promise<{ data: Uint8Array; type: 'png' | 'jpg' | 'gif' | 'bmp' } | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    let type: 'png' | 'jpg' | 'gif' | 'bmp' = 'png';
    if (ct.includes('jpeg') || ct.includes('jpg') || url.match(/\.jpe?g$/i)) type = 'jpg';
    else if (ct.includes('gif') || url.match(/\.gif$/i)) type = 'gif';
    else if (ct.includes('bmp') || url.match(/\.bmp$/i)) type = 'bmp';
    return { data: buf, type };
  } catch {
    return null;
  }
}

async function markdownToDocxChildren(md: string): Promise<any[]> {
  const children: any[] = [];
  const lines = md.split('\n');
  const imgRe = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

  for (let raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      children.push(new Paragraph({ children: [new TextRun('')] }));
      continue;
    }

    // Standalone image line
    const standaloneImg = line.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/);
    if (standaloneImg) {
      const fetched = await fetchImage(standaloneImg[2]);
      if (fetched) {
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                type: fetched.type,
                data: fetched.data,
                transformation: { width: 480, height: 320 },
                altText: { title: standaloneImg[1] || 'image', description: standaloneImg[1] || 'image', name: 'image' },
              } as any),
            ],
          })
        );
      }
      continue;
    }

    // Headings
    let h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const map: any = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      children.push(new Paragraph({ heading: map[level], children: [new TextRun({ text: h[2], bold: true })] }));
      continue;
    }

    // Bullet
    const b = line.match(/^\s*[-*•]\s+(.*)$/);
    if (b) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(b[1])] }));
      continue;
    }

    // Strip inline images from text (we render them separately above when standalone;
    // inline ones get omitted with their alt text inserted instead)
    let text = line.replace(imgRe, (_m, alt) => (alt ? `[${alt}]` : ''));
    // Strip simple markdown emphasis
    text = text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1');

    children.push(new Paragraph({ children: [new TextRun(text)] }));
  }

  return children;
}

async function buildDocx(title: string, md: string): Promise<Uint8Array> {
  const body = await markdownToDocxChildren(md);
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [new TextRun({ text: title, bold: true, size: 36 })],
          }),
          new Paragraph({ children: [new TextRun('')] }),
          ...body,
        ],
      },
    ],
  });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { documentId, sections } = (await req.json()) as {
      documentId: string;
      sections: InSection[];
    };
    if (!documentId || !Array.isArray(sections) || sections.length === 0) {
      return new Response(JSON.stringify({ error: 'documentId and sections required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: parent, error: pErr } = await supabase
      .from('ai_assistant_documents')
      .select('id, subject_id, chapter_id, topic_id, display_name')
      .eq('id', documentId)
      .maybeSingle();
    if (pErr || !parent) {
      return new Response(JSON.stringify({ error: 'Parent document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const included = sections.filter((s) => s.include !== false);
    const created: Array<{ id: string; title: string; source_url: string }> = [];
    const bucket = 'uploaded-question-documents';

    // Determine next topic sequence_order start (if creating new topics)
    let nextSeq = 1;
    if (parent.chapter_id) {
      const { data: tops } = await supabase
        .from('subject_topics')
        .select('sequence_order, topic_number')
        .eq('chapter_id', parent.chapter_id)
        .order('sequence_order', { ascending: false })
        .limit(1);
      if (tops && tops.length > 0) nextSeq = (tops[0].sequence_order || 0) + 1;
    }

    for (const sec of included) {
      const safeTitle = sec.title?.trim() || 'Untitled section';
      const docx = await buildDocx(safeTitle, sec.content_markdown || '');
      const fileBase = `${slugify(safeTitle)}-${crypto.randomUUID().slice(0, 8)}`;
      const path = `reels/${parent.chapter_id || parent.subject_id}/${fileBase}.docx`;

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, docx, {
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          upsert: false,
        });
      if (upErr) {
        console.error('upload failed', upErr);
        continue;
      }

      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      const sourceUrl = signed?.signedUrl || '';

      // Create a topic for this section under the parent chapter (best-effort)
      let topicId: string | null = parent.topic_id || null;
      if (parent.chapter_id && !parent.topic_id) {
        const { data: newTopic } = await supabase
          .from('subject_topics')
          .insert({
            chapter_id: parent.chapter_id,
            title: safeTitle,
            topic_number: String(nextSeq),
            sequence_order: nextSeq,
          })
          .select('id')
          .maybeSingle();
        if (newTopic?.id) topicId = newTopic.id;
        nextSeq += 1;
      }

      const { data: child, error: cErr } = await supabase
        .from('ai_assistant_documents')
        .insert({
          subject_id: parent.subject_id,
          chapter_id: parent.chapter_id,
          topic_id: topicId,
          display_name: safeTitle,
          source_type: 'docx',
          source_url: sourceUrl,
          file_name: `${fileBase}.docx`,
          content_preview: (sec.content_markdown || '').slice(0, 500),
          full_content: { markdown: sec.content_markdown || '' },
          parent_document_id: parent.id,
          split_status: 'child',
          status: 'ready',
        })
        .select('id')
        .maybeSingle();
      if (cErr || !child) {
        console.error('insert child failed', cErr);
        continue;
      }
      created.push({ id: child.id, title: safeTitle, source_url: sourceUrl });
    }

    // Mark parent as split
    await supabase
      .from('ai_assistant_documents')
      .update({ split_status: 'parent_split' })
      .eq('id', parent.id);

    return new Response(JSON.stringify({ created }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
