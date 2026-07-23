// CDN-based Doc Coverage:
// Measures how much of the SOURCE DOCUMENT is actually covered by the generated
// lecture, using each content-section's segment narration + visual_beat
// markdown_pointer ranges.
import mammoth from "mammoth";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableCell, TableRow,
  WidthType, BorderStyle, AlignmentType,
} from "docx";
import { saveAs } from "file-saver";
import { getCdnMediaUrl } from "@/components/learning/player/utils/mediaResolver";

export const CDN_BASE = "https://server1.simplelecture.com/video";

export type SegmentStatus = "covered" | "partial" | "missing";
export type BeatStatus = "anchored" | "partial" | "missing";

export interface SegmentCoverage {
  segmentId: string;
  text: string;
  status: SegmentStatus;
  overlap: number; // 0..1
}

export interface BeatCoverage {
  beatId: string;
  segmentId?: string;
  startPhrase?: string;
  endPhrase?: string;
  status: BeatStatus;
  spanStart?: number;
  spanEnd?: number;
  displayText?: string;
}

export interface SectionCoverage {
  sectionId: string | number;
  title: string;
  sectionType: string;
  segments: SegmentCoverage[];
  beats: BeatCoverage[];
  segmentsCovered: number;
  segmentsPartial: number;
  segmentsMissing: number;
  beatsAnchored: number;
  beatsPartial: number;
  beatsMissing: number;
  sectionCoveragePct: number;
  charsCovered: number;
}

export interface TopicCoverage {
  externalJobId: string;
  subjectName: string;
  chapterTitle: string;
  topicTitle: string;
  isPublished: boolean;
  presentationOk: boolean;
  sourceDocOk: boolean;

  totalSectionCount: number;
  contentSectionCount: number;
  zeroContentSections: number;

  segmentsTotal: number;
  segmentsCovered: number;
  segmentsPartial: number;
  segmentsMissing: number;

  beatsTotal: number;
  beatsAnchored: number;
  beatsPartial: number;
  beatsMissing: number;

  sourceCharsTotal: number;
  sourceCharsCovered: number;
  documentCoveragePct: number;
  avgSectionCoveragePct: number;

  sections: SectionCoverage[];
  uncoveredGaps: string[];
  error?: string;
}

// ---------- Fetch helpers ----------
export async function fetchPresentation(externalJobId: string): Promise<any | null> {
  const url = getCdnMediaUrl(externalJobId, "presentation.json", CDN_BASE);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function fetchSourceDocText(externalJobId: string): Promise<{ text: string } | null> {
  const candidates = ["source_document.docx", "source.docx", "input.docx"];
  for (const name of candidates) {
    const url = getCdnMediaUrl(externalJobId, name, CDN_BASE);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const raw = (await mammoth.extractRawText({ arrayBuffer: buf })).value;
      return { text: raw };
    } catch { /* try next */ }
  }
  return null;
}

// ---------- Text utilities ----------
const STOP = new Set([
  "the","a","an","of","to","in","on","and","or","for","is","are","was","were","be","by",
  "with","as","at","from","this","that","these","those","it","its","into","about","which",
  "what","when","where","how","why","we","you","your","our","if","then","so","but","not",
  "will","can","have","has","had","do","does","did","i","he","she","they","them","their",
]);

function contentWords(s: string): string[] {
  return s.toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\u0c80-\u0cff\s]/gi, " ")
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP.has(t));
}

/** Strip markdown syntax (bold/italic/heading/list/code/link markers) so
 *  phrases pulled from a markdown pointer can match the plain source text. */
function stripMd(s: string): string {
  return s
    .replace(/```[\s\S]*?```/g, " ")           // fenced code
    .replace(/`([^`]*)`/g, "$1")                // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")      // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")   // links -> label
    .replace(/^\s{0,3}#{1,6}\s+/gm, " ")        // headings
    .replace(/^\s*[-*+]\s+/gm, " ")             // bullet lists
    .replace(/^\s*\d+\.\s+/gm, " ")             // ordered lists
    .replace(/^\s*>\s?/gm, " ")                  // blockquotes
    .replace(/\*\*([^*]+)\*\*/g, "$1")          // bold
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|\W)\*([^*\n]+)\*/g, "$1$2")   // italic
    .replace(/(^|\W)_([^_\n]+)_/g, "$1$2")
    .replace(/~~([^~]+)~~/g, "$1")              // strikethrough
    .replace(/[*_`~#>]/g, " ");                 // stragglers
}

function normalize(s: string): string {
  return stripMd(s)
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** Find phrase in normalized haystack. Returns char index or -1.
 *  Tries: exact → punctuation-loose → first N content words as an ordered
 *  token sequence with small gaps allowed. */
function findPhrase(normHay: string, phrase: string): number {
  if (!phrase) return -1;
  const p = normalize(phrase);
  if (!p) return -1;
  let idx = normHay.indexOf(p);
  if (idx >= 0) return idx;

  // punctuation-loose: strip all non-alnum from both
  const alnum = (x: string) => x.replace(/[^a-z0-9\u0900-\u097f\u0c80-\u0cff]+/g, "");
  const pAlnum = alnum(p);
  if (pAlnum.length >= 6) {
    const hayAlnum = alnum(normHay);
    const a = hayAlnum.indexOf(pAlnum);
    if (a >= 0) {
      // map alnum-index back to normHay index by scanning
      let count = 0;
      for (let i = 0; i < normHay.length; i++) {
        if (/[a-z0-9\u0900-\u097f\u0c80-\u0cff]/.test(normHay[i])) {
          if (count === a) return i;
          count++;
        }
      }
    }
  }

  // token-sequence fuzzy: first 4-6 content words in order, allow gaps
  const words = contentWords(phrase).slice(0, 6);
  if (words.length >= 2) {
    // find first word, then confirm next words within 80-char window
    const first = words[0];
    let from = 0;
    while (from < normHay.length) {
      const at = normHay.indexOf(first, from);
      if (at < 0) break;
      let cursor = at + first.length;
      let ok = true;
      for (let i = 1; i < words.length; i++) {
        const nxt = normHay.indexOf(words[i], cursor);
        if (nxt < 0 || nxt - cursor > 120) { ok = false; break; }
        cursor = nxt + words[i].length;
      }
      if (ok) return at;
      from = at + first.length;
    }
  }
  return -1;
}

// ---------- Span union ----------
function unionLength(spans: Array<[number, number]>): number {
  if (!spans.length) return 0;
  const sorted = spans
    .map(([a, b]) => [Math.max(0, a), Math.max(a, b)] as [number, number])
    .sort((x, y) => x[0] - y[0]);
  let total = 0;
  let [curA, curB] = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const [a, b] = sorted[i];
    if (a <= curB) curB = Math.max(curB, b);
    else { total += curB - curA; curA = a; curB = b; }
  }
  total += curB - curA;
  return total;
}

function findGaps(totalLen: number, spans: Array<[number, number]>, maxGaps = 5, minLen = 200): Array<[number, number]> {
  if (totalLen === 0) return [];
  const sorted = spans
    .map(([a, b]) => [Math.max(0, a), Math.min(totalLen, Math.max(a, b))] as [number, number])
    .sort((x, y) => x[0] - y[0]);
  const merged: Array<[number, number]> = [];
  for (const s of sorted) {
    if (!merged.length || s[0] > merged[merged.length - 1][1]) merged.push([...s] as [number, number]);
    else merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], s[1]);
  }
  const gaps: Array<[number, number]> = [];
  let cursor = 0;
  for (const [a, b] of merged) {
    if (a - cursor >= minLen) gaps.push([cursor, a]);
    cursor = b;
  }
  if (totalLen - cursor >= minLen) gaps.push([cursor, totalLen]);
  gaps.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]));
  return gaps.slice(0, maxGaps);
}

// ---------- Core comparison ----------
export function comparePresentationVsSource(
  presentation: any,
  source: { text: string } | null,
): Omit<TopicCoverage, "externalJobId" | "subjectName" | "chapterTitle" | "topicTitle" | "isPublished" | "presentationOk" | "sourceDocOk" | "error"> {
  const sections: any[] = Array.isArray(presentation?.sections) ? presentation.sections : [];
  const contentSections = sections.filter(s => (s?.section_type ?? "content") === "content");

  const rawText = source?.text ?? "";
  const normHay = normalize(rawText);
  const sourceCharsTotal = normHay.length;

  const anchoredSpans: Array<[number, number]> = [];

  const sectionResults: SectionCoverage[] = contentSections.map((sec: any) => {
    const segs: any[] = Array.isArray(sec?.narration?.segments) ? sec.narration.segments : [];
    const beats: any[] = Array.isArray(sec?.visual_beats) ? sec.visual_beats
      : Array.isArray(sec?.explanation_plan?.visual_beats) ? sec.explanation_plan.visual_beats
      : [];

    // --- segments: overlap segment.text with source ---
    const segRes: SegmentCoverage[] = segs.map((s, i) => {
      const text = String(s?.text ?? "");
      const words = contentWords(text);
      let hits = 0;
      const seen = new Set<string>();
      for (const w of words) {
        if (seen.has(w)) continue;
        seen.add(w);
        if (normHay.includes(w)) hits++;
      }
      const overlap = seen.size ? hits / seen.size : 0;
      let status: SegmentStatus;
      if (overlap >= 0.6) status = "covered";
      else if (overlap >= 0.3) status = "partial";
      else status = "missing";
      return { segmentId: String(s?.segment_id ?? `seg_${i + 1}`), text, status, overlap };
    });

    // --- beats: markdown_pointer anchoring ---
    const localSpans: Array<[number, number]> = [];
    const beatRes: BeatCoverage[] = beats.map((b, i) => {
      const mp = b?.markdown_pointer ?? null;
      const startPhrase = mp?.start_phrase ?? "";
      const endPhrase = mp?.end_phrase ?? "";
      const displayText = String(b?.display_text ?? "");
      let status: BeatStatus = "missing";
      let spanStart: number | undefined;
      let spanEnd: number | undefined;

      if (startPhrase || endPhrase) {
        const s = startPhrase ? findPhrase(normHay, startPhrase) : -1;
        const e = endPhrase ? findPhrase(normHay, endPhrase) : -1;
        if (s >= 0 && e >= 0 && e > s) {
          const endLen = normalize(endPhrase).length;
          spanStart = s;
          spanEnd = Math.min(sourceCharsTotal, e + endLen);
          localSpans.push([spanStart, spanEnd]);
          status = "anchored";
        } else if (s >= 0 || e >= 0) {
          status = "partial";
        } else {
          status = "missing";
        }
      }
      // fallback: use display_text overlap
      if (status === "missing" && displayText) {
        const words = contentWords(displayText);
        let hits = 0;
        const seen = new Set<string>();
        for (const w of words) { if (!seen.has(w)) { seen.add(w); if (normHay.includes(w)) hits++; } }
        const ov = seen.size ? hits / seen.size : 0;
        if (ov >= 0.5) status = "partial";
      }
      return {
        beatId: String(b?.beat_id ?? `beat_${i + 1}`),
        segmentId: b?.segment_id,
        startPhrase, endPhrase,
        status, spanStart, spanEnd,
        displayText: displayText.slice(0, 240),
      };
    });

    anchoredSpans.push(...localSpans);
    const charsCovered = unionLength(localSpans);

    const segmentsCovered = segRes.filter(s => s.status === "covered").length;
    const segmentsPartial = segRes.filter(s => s.status === "partial").length;
    const segmentsMissing = segRes.filter(s => s.status === "missing").length;
    const beatsAnchored = beatRes.filter(b => b.status === "anchored").length;
    const beatsPartial = beatRes.filter(b => b.status === "partial").length;
    const beatsMissing = beatRes.filter(b => b.status === "missing").length;

    const segScore = segRes.length ? (segmentsCovered + 0.5 * segmentsPartial) / segRes.length : 0;
    const beatScore = beatRes.length ? (beatsAnchored + 0.5 * beatsPartial) / beatRes.length : 0;
    const parts: number[] = [];
    if (segRes.length) parts.push(segScore);
    if (beatRes.length) parts.push(beatScore);
    const sectionCoveragePct = parts.length
      ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
      : 0;

    return {
      sectionId: sec?.section_id ?? "?",
      title: String(sec?.title ?? ""),
      sectionType: String(sec?.section_type ?? "content"),
      segments: segRes,
      beats: beatRes,
      segmentsCovered, segmentsPartial, segmentsMissing,
      beatsAnchored, beatsPartial, beatsMissing,
      sectionCoveragePct,
      charsCovered,
    };
  });

  const segmentsTotal = sectionResults.reduce((s, r) => s + r.segments.length, 0);
  const segmentsCovered = sectionResults.reduce((s, r) => s + r.segmentsCovered, 0);
  const segmentsPartial = sectionResults.reduce((s, r) => s + r.segmentsPartial, 0);
  const segmentsMissing = sectionResults.reduce((s, r) => s + r.segmentsMissing, 0);
  const beatsTotal = sectionResults.reduce((s, r) => s + r.beats.length, 0);
  const beatsAnchored = sectionResults.reduce((s, r) => s + r.beatsAnchored, 0);
  const beatsPartial = sectionResults.reduce((s, r) => s + r.beatsPartial, 0);
  const beatsMissing = sectionResults.reduce((s, r) => s + r.beatsMissing, 0);

  const sourceCharsCovered = unionLength(anchoredSpans);
  const documentCoveragePct = sourceCharsTotal ? Math.round((sourceCharsCovered / sourceCharsTotal) * 100) : 0;

  const avgSectionCoveragePct = sectionResults.length
    ? Math.round(sectionResults.reduce((s, r) => s + r.sectionCoveragePct, 0) / sectionResults.length)
    : 0;

  const zeroContentSections = sectionResults.filter(
    r => r.segments.length === 0 && r.beats.length === 0,
  ).length;

  const gaps = findGaps(sourceCharsTotal, anchoredSpans, 5, 200)
    .map(([a, b]) => normHay.slice(a, b).slice(0, 240) + (b - a > 240 ? "…" : ""));

  return {
    totalSectionCount: sections.length,
    contentSectionCount: contentSections.length,
    zeroContentSections,
    segmentsTotal, segmentsCovered, segmentsPartial, segmentsMissing,
    beatsTotal, beatsAnchored, beatsPartial, beatsMissing,
    sourceCharsTotal, sourceCharsCovered,
    documentCoveragePct, avgSectionCoveragePct,
    sections: sectionResults,
    uncoveredGaps: gaps,
  };
}

// ---------- Orchestrator ----------
export interface TopicInput {
  externalJobId: string;
  subjectName: string;
  chapterTitle: string;
  topicTitle: string;
  isPublished: boolean;
}

export async function auditTopic(t: TopicInput): Promise<TopicCoverage> {
  try {
    const [pres, src] = await Promise.all([
      fetchPresentation(t.externalJobId),
      fetchSourceDocText(t.externalJobId),
    ]);
    const emptyCmp = comparePresentationVsSource(pres ?? { sections: [] }, src);
    return {
      ...t,
      presentationOk: !!pres,
      sourceDocOk: !!src,
      ...emptyCmp,
      error: !pres ? "presentation.json not reachable on CDN"
        : !src ? "source_document.docx not reachable on CDN"
        : undefined,
    };
  } catch (e: any) {
    return {
      ...t, presentationOk: false, sourceDocOk: false,
      totalSectionCount: 0, contentSectionCount: 0, zeroContentSections: 0,
      segmentsTotal: 0, segmentsCovered: 0, segmentsPartial: 0, segmentsMissing: 0,
      beatsTotal: 0, beatsAnchored: 0, beatsPartial: 0, beatsMissing: 0,
      sourceCharsTotal: 0, sourceCharsCovered: 0,
      documentCoveragePct: 0, avgSectionCoveragePct: 0,
      sections: [], uncoveredGaps: [],
      error: e?.message || "audit failed",
    };
  }
}

export async function mapLimited<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------- DOCX Export ----------
export async function exportCoverageDocx(rows: TopicCoverage[], filenameHint = "coverage") {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const widths = [1400, 1900, 2400, 600, 700, 700, 800, 800, 900];
  const tableWidth = widths.reduce((a, b) => a + b, 0);

  const buildCell = (text: string, w: number, bold = false) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    borders,
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    children: [new Paragraph({ children: [new TextRun({ text, bold, size: 18 })] })],
  });

  const headerLabels = ["Subject","Chapter","Topic","Pub?","Content sec","Segs cov/tot","Beats anch/tot","Doc cov %","Avg sec %"];
  const headerRow = new TableRow({
    children: headerLabels.map((t, i) => buildCell(t, widths[i], true)),
  });
  const dataRows = rows.map(r => new TableRow({
    children: [
      buildCell(r.subjectName, widths[0]),
      buildCell(r.chapterTitle, widths[1]),
      buildCell(r.topicTitle, widths[2]),
      buildCell(r.isPublished ? "Yes" : "No", widths[3]),
      buildCell(`${r.contentSectionCount}${r.zeroContentSections ? ` (${r.zeroContentSections} empty)` : ""}`, widths[4]),
      buildCell(`${r.segmentsCovered}/${r.segmentsTotal}`, widths[5]),
      buildCell(`${r.beatsAnchored}/${r.beatsTotal}`, widths[6]),
      buildCell(`${r.documentCoveragePct}%`, widths[7]),
      buildCell(`${r.avgSectionCoveragePct}%`, widths[8]),
    ],
  }));

  const totalTopics = rows.length;
  const publishedCount = rows.filter(r => r.isPublished).length;
  const avgDoc = totalTopics ? Math.round(rows.reduce((s, r) => s + r.documentCoveragePct, 0) / totalTopics) : 0;

  const detailBlocks: Paragraph[] = [];
  rows.forEach(r => {
    detailBlocks.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: `${r.subjectName} › ${r.chapterTitle} › ${r.topicTitle}` })],
    }));
    detailBlocks.push(new Paragraph({ children: [new TextRun({
      text: `Job: ${r.externalJobId} · Published: ${r.isPublished ? "Yes" : "No"} · Doc coverage: ${r.documentCoveragePct}% · Avg section: ${r.avgSectionCoveragePct}% · Content sections: ${r.contentSectionCount} (empty: ${r.zeroContentSections}) · Segments: ${r.segmentsCovered}/${r.segmentsTotal} · Beats: ${r.beatsAnchored}/${r.beatsTotal}`,
      size: 18, color: "555555",
    })]}));
    if (r.error) detailBlocks.push(new Paragraph({ children: [new TextRun({ text: `⚠ ${r.error}`, italics: true, color: "B00020" })] }));

    r.sections.forEach(sec => {
      detailBlocks.push(new Paragraph({ children: [new TextRun({
        text: `§ ${sec.title || sec.sectionId}  —  segs ${sec.segmentsCovered}/${sec.segments.length}, beats ${sec.beatsAnchored}/${sec.beats.length}, ${sec.sectionCoveragePct}%`,
        bold: true, size: 20,
      })]}));
      sec.segments.forEach(s => {
        const color = s.status === "covered" ? "0B6E4F" : s.status === "partial" ? "8A6D00" : "B00020";
        detailBlocks.push(new Paragraph({ children: [new TextRun({
          text: `  · seg ${s.segmentId} (${s.status}, ${(s.overlap * 100).toFixed(0)}%): ${s.text.slice(0, 160)}${s.text.length > 160 ? "…" : ""}`,
          size: 16, color,
        })]}));
      });
      sec.beats.forEach(b => {
        const color = b.status === "anchored" ? "0B6E4F" : b.status === "partial" ? "8A6D00" : "B00020";
        const anchor = b.startPhrase || b.endPhrase
          ? ` [${(b.startPhrase || "").slice(0, 40)} … ${(b.endPhrase || "").slice(0, 40)}]`
          : "";
        detailBlocks.push(new Paragraph({ children: [new TextRun({
          text: `  ▸ beat ${b.beatId} (${b.status})${anchor}`,
          size: 16, color,
        })]}));
      });
    });

    if (r.uncoveredGaps.length) {
      detailBlocks.push(new Paragraph({ children: [new TextRun({
        text: `Top uncovered source ranges (${r.uncoveredGaps.length})`, bold: true, size: 20,
      })]}));
      r.uncoveredGaps.forEach((g, i) => {
        detailBlocks.push(new Paragraph({ children: [new TextRun({
          text: `  ${i + 1}. ${g}`, size: 16, color: "555555",
        })]}));
      });
    }
    detailBlocks.push(new Paragraph({ children: [new TextRun({ text: " " })] }));
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: "Doc Coverage Audit (CDN)" })] }),
        new Paragraph({ children: [new TextRun({
          text: `Generated ${new Date().toLocaleString()} · Source: ${CDN_BASE}`,
          color: "666666", size: 18,
        })]}),
        new Paragraph({ children: [new TextRun({
          text: `Topics: ${totalTopics} · Published: ${publishedCount} · Avg document coverage: ${avgDoc}%`,
          size: 20, bold: true,
        })]}),
        new Paragraph({ children: [new TextRun({ text: " " })] }),
        new Table({
          width: { size: tableWidth, type: WidthType.DXA },
          columnWidths: widths,
          rows: [headerRow, ...dataRows],
        }),
        new Paragraph({ children: [new TextRun({ text: " " })] }),
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: "Per-topic details" })] }),
        ...detailBlocks,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `doc-coverage_${filenameHint}_${new Date().toISOString().slice(0,10)}.docx`);
}
