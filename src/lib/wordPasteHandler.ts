/**
 * Word Document Paste Handler with Formula Detection
 * Detects and converts LaTeX, chemical formulas, and accounting formats from pasted content
 */

export interface PasteResult {
  text: string;
  formulaType: "plain" | "latex" | "accounting";
  hasFormula: boolean;
}

/**
 * Detect LaTeX formulas in text
 */
const detectLatexFormulas = (text: string): boolean => {
  const latexPatterns = [
    /\\\w+\{[^}]*\}/g, // LaTeX commands like \frac{a}{b}
    /\$[^$]+\$/g, // Inline math $...$
    /\\\([^)]+\\\)/g, // Display math \(...\)
    /\\[a-zA-Z]+/g, // LaTeX symbols like \alpha, \beta
    /[_^]\{[^}]+\}/g, // Subscripts and superscripts
    /\\begin\{equation\}|\\end\{equation\}/g, // Equation environments
  ];

  return latexPatterns.some(pattern => pattern.test(text));
};

/**
 * Detect chemical formulas in text
 */
const detectChemicalFormulas = (text: string): boolean => {
  const chemicalPatterns = [
    /[A-Z][a-z]?_\{?\d+\}?/g, // Chemical formulas like H2O, CO2
    /→|⇌|⇄/g, // Reaction arrows
    /\+\d|−\d/g, // Charge notation
    /\([A-Z][a-z]?\)/g, // Element in parentheses
  ];

  return chemicalPatterns.some(pattern => pattern.test(text));
};

/**
 * Detect accounting formats in text
 */
const detectAccountingFormat = (text: string): boolean => {
  const accountingPatterns = [
    /\bDr\.?\s+/gi, // Debit entries
    /\bCr\.?\s+/gi, // Credit entries
    /\|\s*Dr\s*\|\s*Cr\s*\|/gi, // Journal entry table format
    /Particulars|Account|Ledger/gi, // Accounting terms
  ];

  return accountingPatterns.some(pattern => pattern.test(text));
};

/**
 * Clean Word document artifacts from pasted text
 */
const cleanWordArtifacts = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n') // Normalize line breaks
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
    .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .trim();
};

/**
 * Convert Word math equations to LaTeX format
 */
const convertWordMathToLatex = (text: string): string => {
  let converted = text;

  // Common Word equation conversions
  const conversions: Record<string, string> = {
    '½': '\\frac{1}{2}',
    '¼': '\\frac{1}{4}',
    '¾': '\\frac{3}{4}',
    '²': '^{2}',
    '³': '^{3}',
    '√': '\\sqrt{}',
    '∞': '\\infty',
    '≤': '\\leq',
    '≥': '\\geq',
    '≠': '\\neq',
    '±': '\\pm',
    '∑': '\\sum',
    '∫': '\\int',
    'α': '\\alpha',
    'β': '\\beta',
    'γ': '\\gamma',
    'θ': '\\theta',
    'π': '\\pi',
    'Δ': '\\Delta',
  };

  Object.entries(conversions).forEach(([from, to]) => {
    converted = converted.replace(new RegExp(from, 'g'), to);
  });

  return converted;
};

/**
 * Process pasted content from Word documents
 */
export const processPastedContent = async (
  event: ClipboardEvent
): Promise<PasteResult> => {
  const items = event.clipboardData?.items;
  if (!items) {
    return { text: '', formulaType: 'plain', hasFormula: false };
  }

  let text = '';

  // Try to get HTML content first (better for Word documents)
  for (const item of Array.from(items)) {
    if (item.type === 'text/html') {
      text = await new Promise<string>((resolve) => {
        item.getAsString((str) => resolve(str));
      });
      break;
    }
  }

  // Fallback to plain text
  if (!text) {
    text = event.clipboardData?.getData('text/plain') || '';
  }

  // Clean the text
  text = cleanWordArtifacts(text);

  // Convert Word math to LaTeX
  text = convertWordMathToLatex(text);

  // Detect formula type
  let formulaType: "plain" | "latex" | "accounting" = "plain";
  let hasFormula = false;

  if (detectAccountingFormat(text)) {
    formulaType = "accounting";
    hasFormula = true;
  } else if (detectLatexFormulas(text) || detectChemicalFormulas(text)) {
    formulaType = "latex";
    hasFormula = true;
  }

  return { text, formulaType, hasFormula };
};

/**
 * Extract formulas from text and return structured data
 */
export const extractFormulas = (text: string): {
  plainText: string;
  formulas: Array<{ type: string; content: string; position: number }>;
} => {
  const formulas: Array<{ type: string; content: string; position: number }> = [];
  let plainText = text;

  // Extract LaTeX formulas
  const latexMatches = text.matchAll(/\$([^$]+)\$/g);
  for (const match of latexMatches) {
    formulas.push({
      type: 'latex',
      content: match[1],
      position: match.index || 0,
    });
  }

  // Extract chemical formulas
  const chemMatches = text.matchAll(/([A-Z][a-z]?_?\{?\d+\}?)+/g);
  for (const match of chemMatches) {
    if (match[0].includes('_') || /\d/.test(match[0])) {
      formulas.push({
        type: 'chemical',
        content: match[0],
        position: match.index || 0,
      });
    }
  }

  return { plainText, formulas };
};
