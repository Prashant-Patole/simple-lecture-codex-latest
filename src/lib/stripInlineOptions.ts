/**
 * Strip option markers from question_text when structured MCQ options
 * are available separately. Handles both:
 *   - multi-line: options on their own lines ("(a) foo\n(b) bar\n...")
 *   - single-line/inline: options joined with separators
 *     ("Question - (a) foo - (b) bar - (c) baz")
 */
export function stripInlineOptions(text: string, hasOptions: boolean): string {
  if (!text || !hasOptions) return text;

  // --- 1) Multi-line stripping (unchanged behaviour) ---
  const optionLineRe = /^\s*(?:[-*•]\s+)?(?:\(?[a-dA-D1-4]\)|[a-dA-D1-4][.)])\s+\S.*$/;
  const lines = text.split(/\r?\n/);
  const firstIdx = lines.findIndex((l) => optionLineRe.test(l));
  if (firstIdx !== -1) {
    const tail = lines.slice(firstIdx).filter((l) => l.trim().length > 0);
    const optionCount = tail.filter((l) => optionLineRe.test(l)).length;
    if (optionCount >= 2 && optionCount >= tail.length - 1) {
      return lines.slice(0, firstIdx).join("\n").trimEnd();
    }
  }

  // --- 2) Inline stripping on a single line ---
  // Marker: (a) / a) / a. / (A) preceded by whitespace or a separator
  const inlineMarkerRe = /(^|[\s\-–—:;,.])(\(?[a-dA-D1-4]\)|[a-dA-D1-4][.)])\s+\S/g;
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = inlineMarkerRe.exec(text)) !== null) {
    // position of the marker itself, not the leading separator
    positions.push(m.index + m[1].length);
  }
  if (positions.length >= 2) {
    return text.slice(0, positions[0]).replace(/[\s\-–—:;,.]+$/, "").trimEnd();
  }

  return text;
}
