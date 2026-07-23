import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { convertMathpixToStandard } from '@/components/learning/player/utils/latexNormalizer';
import 'katex/dist/katex.min.css';

const MathText = ({ text, className }: { text: string; className?: string }) => {
  const normalized = useMemo(() => convertMathpixToStandard(text), [text]);
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex, rehypeRaw]}
      components={{
        p: ({ children }) => <span className={className}>{children}</span>,
        img: () => null,
      }}
    >
      {normalized}
    </ReactMarkdown>
  );
};


interface SuggestionQuestion {
  id: string;
  question_text: string;
}

interface Props {
  inputText: string;
  questions: SuggestionQuestion[] | undefined;
  onSelect: (text: string) => void;
  onQuestionSelected?: () => void;
  isLoading?: boolean;
  hasSearched?: boolean;
  className?: string;
}

const STOP_WORDS = new Set(['a', 'an', 'the', 'is', 'of', 'in', 'to', 'on', 'for', 'and', 'or']);

function splitWords(s: unknown): string[] {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function tokenizeQuery(s: string): string[] {
  const raw = splitWords(s);
  if (raw.length === 0) return [];
  const filtered = raw.filter((t) => !STOP_WORDS.has(t));
  // Keep stop-word-only queries as-is so we still match something.
  return filtered.length > 0 ? filtered : raw;
}

// Bounded Damerau-Levenshtein, early-exit when distance > maxDist.
function editDistanceLE(a: string, b: string, maxDist: number): number {
  const al = a.length, bl = b.length;
  if (Math.abs(al - bl) > maxDist) return maxDist + 1;
  const prev2 = new Array(bl + 1);
  const prev = new Array(bl + 1);
  const curr = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let j = 0; j <= bl; j++) { prev2[j] = prev[j]; prev[j] = curr[j]; }
  }
  return prev[bl];
}

// Returns best score for a single token against a question's word list.
function scoreToken(token: string, words: string[], lower: string): number {
  let best = 0;
  const tlen = token.length;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === token) { return 5; } // exact word — can't beat this
    if (tlen >= 2 && w.startsWith(token)) {
      if (4 > best) best = 4;
      continue;
    }
    if (tlen >= 4 && Math.abs(w.length - tlen) <= 2) {
      const d = editDistanceLE(token, w, 1);
      if (d <= 1 && 3 > best) best = 3;
    }
  }
  if (best > 0) return best;
  // Fall back to substring-inside-longer-word, demoted.
  if (tlen >= 4 && lower.includes(token)) return 1;
  return 0;
}

export function QuestionSuggestionsDropdown({ inputText, questions, onSelect, onQuestionSelected, isLoading = false, hasSearched = false, className }: Props) {
  const [hidden, setHidden] = useState(false);
  const [lastSelected, setLastSelected] = useState<string | null>(null);

  useEffect(() => {
    if (lastSelected !== null && inputText !== lastSelected) {
      setHidden(false);
      setLastSelected(null);
    }
  }, [inputText, lastSelected]);

  const index = useMemo(() => {
    if (!questions) return [];
    return questions
      .map((r) => {
        const raw = typeof r?.question_text === 'string'
          ? r.question_text
          : String(r?.question_text ?? '');
        return { id: r?.id, raw };
      })
      .filter((r) => r.raw.trim().length > 0)
      .map((r) => {
        const lower = r.raw.toLowerCase();
        return { id: r.id, text: r.raw, lower, words: splitWords(r.raw) };
      });
  }, [questions]);

  const matches = useMemo(() => {
    const q = String(inputText ?? '').trim().toLowerCase();
    if (!q || index.length === 0) return [];
    const tokens = tokenizeQuery(q);
    if (tokens.length === 0) return [];

    const scored: { row: SuggestionQuestion; score: number }[] = [];
    for (const row of index) {
      let total = 0;
      let ok = true;
      for (const tk of tokens) {
        const s = scoreToken(tk, row.words, row.lower);
        if (s === 0) { ok = false; break; }
        total += s;
      }
      if (!ok) continue;
      if (row.lower.includes(q)) total += 10;
      scored.push({ row: { id: row.id, question_text: row.text }, score: total });
    }

    scored.sort((a, b) => b.score - a.score || a.row.question_text.length - b.row.question_text.length);
    return scored.slice(0, 5).map((s) => s.row);
  }, [inputText, index]);

  const hasSearchableInput = String(inputText ?? '').trim().length >= 2;

  if (hidden || !hasSearchableInput) return null;

  if (isLoading || matches.length === 0) {
    if (!isLoading && !hasSearched) return null;

    return (
      <div
        className={cn(
          'absolute left-0 right-0 top-full mt-2 z-50',
          'glass-strong rounded-xl border border-primary/20 shadow-xl overflow-hidden',
          'animate-slide-up-fade',
          className,
        )}
      >
        <div className="px-3 py-3 text-sm text-muted-foreground flex items-center gap-2">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
              <span>Searching similar questions...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 text-muted-foreground/70" />
              <span>No similar questions found</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'absolute left-0 right-0 top-full mt-2 z-50',
        'glass-strong rounded-xl border border-primary/20 shadow-xl overflow-hidden',
        'animate-slide-up-fade',
        className,
      )}
    >
      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5 border-b border-border/40">
        <Sparkles className="h-3 w-3 text-primary" />
        Suggested questions
      </div>
      <ul className="max-h-[min(60vh,420px)] overflow-y-auto scrollbar-hide py-1 pb-2">
        {matches.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setLastSelected(m.question_text);
                setHidden(true);
                onSelect(m.question_text);
                onQuestionSelected?.();
              }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors"
            >
              <MathText text={m.question_text} />

            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
