import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType,
} from 'docx';
import { saveAs } from 'file-saver';

export interface LangCheckRow {
  jobId: string;
  serverIp?: string | null;
  chapterNumber?: number | string;
  chapterTitle?: string;
  topicNumber?: number | string;
  topicTitle?: string;
  documentName?: string;
  missing_sections: string[];
  presentation_errors: string[];
}

export interface DuplicateGroup {
  chapterNumber?: number | string;
  chapterTitle?: string;
  topicNumber?: number | string;
  topicTitle?: string;
  jobs: { jobId: string; documentName?: string }[];
}

export interface MissingTopic {
  chapterNumber?: number | string;
  chapterTitle?: string;
  topicNumber?: number | string;
  topicTitle?: string;
}

export interface ReportExtras {
  duplicates: DuplicateGroup[];
  missingTopics: MissingTopic[];
}


const CELL_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const BORDERS = { top: CELL_BORDER, bottom: CELL_BORDER, left: CELL_BORDER, right: CELL_BORDER };

const cell = (text: string, opts: { bold?: boolean; fill?: string; width: number } = { width: 3120 }) =>
  new TableCell({
    borders: BORDERS,
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold })] })],
  });

const countLang = (rows: LangCheckRow[], lang: 'english' | 'kannada') =>
  rows.reduce((n, r) => n + r.missing_sections.filter((s) => s.toLowerCase().includes(`(${lang})`)).length, 0);

const statusOf = (r: LangCheckRow) => {
  if (r.presentation_errors.length) return { label: 'Fatal', fill: 'FADBD8' };
  if (r.missing_sections.length) return { label: `${r.missing_sections.length} missing`, fill: 'FCF3CF' };
  return { label: 'Complete', fill: 'D5F5E3' };
};

export async function buildLanguageCheckDocx(
  subjectName: string,
  rows: LangCheckRow[],
  extras: ReportExtras = { duplicates: [], missingTopics: [] },
): Promise<Blob> {
  const total = rows.length;
  const complete = rows.filter((r) => !r.presentation_errors.length && !r.missing_sections.length).length;
  const partial = rows.filter((r) => !r.presentation_errors.length && r.missing_sections.length).length;
  const fatal = rows.filter((r) => r.presentation_errors.length).length;
  const enPending = countLang(rows, 'english');
  const knPending = countLang(rows, 'kannada');
  const dupCount = extras.duplicates.length;
  const missCount = extras.missingTopics.length;

  // Group by chapter
  const groups = new Map<string, LangCheckRow[]>();
  for (const r of rows) {
    const key = `${r.chapterNumber ?? '?'}||${r.chapterTitle ?? 'Unknown Chapter'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
    const na = Number(a[0].split('||')[0]) || 0;
    const nb = Number(b[0].split('||')[0]) || 0;
    return na - nb;
  });

  const summaryTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    rows: [
      ['Total Published Jobs Checked', String(total)],
      ['Complete (EN + KN)', String(complete)],
      ['Missing Sections', String(partial)],
      ['Fatal Errors', String(fatal)],
      ['English section issues', String(enPending)],
      ['Kannada section issues', String(knPending)],
      ['Duplicate topics (>1 published)', String(dupCount)],
      ['Missing topics (no published video)', String(missCount)],
    ].map(([k, v]) =>
      new TableRow({
        children: [cell(k, { bold: true, fill: 'F2F2F2', width: 4680 }), cell(v, { width: 4680 })],
      })
    ),
  });

  const children: Paragraph[] | any[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Language Check Report`, bold: true, size: 36 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${subjectName} — ${new Date().toLocaleString()}`, italics: true, color: '666666' })],
    }),
    new Paragraph({ children: [new TextRun('')] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Summary')] }),
    summaryTable,
    new Paragraph({ children: [new TextRun('')] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Details by Chapter')] }),
  ];

  for (const [key, list] of sortedGroups) {
    const [num, title] = key.split('||');
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: `Chapter ${num} — ${title}`, bold: true })],
      })
    );

    const header = new TableRow({
      children: [
        cell('Topic', { bold: true, fill: 'E8E8E8', width: 2200 }),
        cell('Job ID', { bold: true, fill: 'E8E8E8', width: 2600 }),
        cell('Server IP', { bold: true, fill: 'E8E8E8', width: 1400 }),
        cell('Status', { bold: true, fill: 'E8E8E8', width: 1400 }),
        cell('Missing / Errors', { bold: true, fill: 'E8E8E8', width: 1760 }),
      ],
    });

    const bodyRows = list
      .sort((a, b) => (Number(a.topicNumber) || 0) - (Number(b.topicNumber) || 0))
      .map((r) => {
        const st = statusOf(r);
        const topic = r.topicNumber || r.topicTitle
          ? `${r.topicNumber ?? ''} ${r.topicTitle ?? ''}`.trim()
          : (r.documentName || '—');
        const detailLines = [
          ...r.presentation_errors.map((e) => `[FATAL] ${e}`),
          ...r.missing_sections,
        ];
        const detailText = detailLines.length ? detailLines.join('\n') : 'OK';
        return new TableRow({
          children: [
            cell(topic, { width: 2200 }),
            cell(r.jobId, { width: 2600 }),
            cell(r.serverIp || '—', { width: 1400 }),
            cell(st.label, { fill: st.fill, bold: true, width: 1400 }),
            new TableCell({
              borders: BORDERS,
              width: { size: 1760, type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: detailLines.length
                ? detailLines.map((l) => new Paragraph({ children: [new TextRun({ text: l, size: 18 })] }))
                : [new Paragraph({ children: [new TextRun({ text: detailText, size: 18, color: '2E7D32' })] })],
            }),
          ],
        });
      });

    children.push(
      new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [2200, 2600, 1400, 1400, 1760],
        rows: [header, ...bodyRows],
      }),
      new Paragraph({ children: [new TextRun('')] }),
    );
  }


  // Duplicates section
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Duplicate Published Videos')] }),
  );
  if (extras.duplicates.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'No duplicates found.', color: '2E7D32' })] }));
  } else {
    const dupHeader = new TableRow({
      children: [
        cell('Chapter › Topic', { bold: true, fill: 'FCE4A6', width: 3200 }),
        cell('Count', { bold: true, fill: 'FCE4A6', width: 800 }),
        cell('Job IDs', { bold: true, fill: 'FCE4A6', width: 3200 }),
        cell('Documents', { bold: true, fill: 'FCE4A6', width: 2160 }),
      ],
    });
    const dupRows = extras.duplicates
      .sort((a, b) => {
        const ca = Number(a.chapterNumber) || 0, cb = Number(b.chapterNumber) || 0;
        if (ca !== cb) return ca - cb;
        return (Number(a.topicNumber) || 0) - (Number(b.topicNumber) || 0);
      })
      .map((d) => {
        const label = `${d.chapterNumber ?? '?'}.${d.topicNumber ?? '?'} ${d.topicTitle ?? ''}`.trim();
        return new TableRow({
          children: [
            cell(label, { width: 3200 }),
            cell(String(d.jobs.length), { bold: true, fill: 'FCF3CF', width: 800 }),
            new TableCell({
              borders: BORDERS,
              width: { size: 3200, type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: d.jobs.map((j) => new Paragraph({ children: [new TextRun({ text: j.jobId, size: 18 })] })),
            }),
            new TableCell({
              borders: BORDERS,
              width: { size: 2160, type: WidthType.DXA },
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: d.jobs.map((j) => new Paragraph({ children: [new TextRun({ text: j.documentName || '—', size: 18 })] })),
            }),
          ],
        });
      });
    children.push(new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [3200, 800, 3200, 2160],
      rows: [dupHeader, ...dupRows],
    }));
  }

  // Missing topics section
  children.push(
    new Paragraph({ children: [new TextRun('')] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Missing Topics (No Published Video)')] }),
  );
  if (extras.missingTopics.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'All topics have at least one published video.', color: '2E7D32' })] }));
  } else {
    // group by chapter
    const missGroups = new Map<string, MissingTopic[]>();
    for (const m of extras.missingTopics) {
      const k = `${m.chapterNumber ?? '?'}||${m.chapterTitle ?? 'Unknown Chapter'}`;
      if (!missGroups.has(k)) missGroups.set(k, []);
      missGroups.get(k)!.push(m);
    }
    const sortedMiss = Array.from(missGroups.entries()).sort(
      (a, b) => (Number(a[0].split('||')[0]) || 0) - (Number(b[0].split('||')[0]) || 0),
    );
    for (const [k, list] of sortedMiss) {
      const [cn, ct] = k.split('||');
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: `Chapter ${cn} — ${ct}`, bold: true })],
      }));
      const header = new TableRow({
        children: [
          cell('Topic #', { bold: true, fill: 'F5B7B1', width: 1600 }),
          cell('Topic Title', { bold: true, fill: 'F5B7B1', width: 7760 }),
        ],
      });
      const body = list
        .sort((a, b) => (Number(a.topicNumber) || 0) - (Number(b.topicNumber) || 0))
        .map((m) => new TableRow({
          children: [
            cell(String(m.topicNumber ?? '—'), { width: 1600 }),
            cell(m.topicTitle ?? '—', { width: 7760 }),
          ],
        }));
      children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [1600, 7760],
        rows: [header, ...body],
      }), new Paragraph({ children: [new TextRun('')] }));
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });

  return await Packer.toBlob(doc);
}

export async function downloadLanguageCheckDocx(
  subjectName: string,
  rows: LangCheckRow[],
  extras?: ReportExtras,
) {
  const blob = await buildLanguageCheckDocx(subjectName, rows, extras);
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = subjectName.replace(/[^\w\-]+/g, '_');
  saveAs(blob, `language-check-${safe}-${stamp}.docx`);
}

