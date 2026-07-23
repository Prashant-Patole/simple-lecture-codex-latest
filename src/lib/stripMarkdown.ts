/**
 * Strip common markdown/formatting symbols from a string for plain-text rendering.
 */
export function stripMarkdown(input?: string | null): string {
  if (!input) return "";
  let s = String(input);

  // Code fences and inline code
  s = s.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""));
  s = s.replace(/`([^`]*)`/g, "$1");

  // Images ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  // Links [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // Bold/italic/strike
  s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "$1");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/___([^_]+)___/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/(^|\W)_([^_\n]+)_(?=\W|$)/g, "$1$2");
  s = s.replace(/~~([^~]+)~~/g, "$1");

  // Headings, blockquotes, list markers at line start
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  s = s.replace(/^\s*>+\s?/gm, "");
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  s = s.replace(/^\s*\d+\.\s+/gm, "");

  // Horizontal rules
  s = s.replace(/^\s*([-*_])\1{2,}\s*$/gm, "");

  // Stray leftover symbols
  s = s.replace(/[*_~`#]+/g, "");

  // Collapse excess blank lines
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}
