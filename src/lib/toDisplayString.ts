/**
 * Coerce any JSON-ish value into a display-safe string.
 * Prevents "[object Object]" leaking into ReactMarkdown / plain text.
 *
 * Handles:
 *  - null/undefined  → ""
 *  - string/number/boolean → String(v)
 *  - arrays → each element coerced, joined with newlines
 *  - localized objects like { en, hi, kn } → picks first present language
 *  - value objects like { text, value, label, latex } → picks first present field
 *  - anything else → JSON.stringify fallback
 */
export function toDisplayString(v: unknown, lang: "en" | "hi" | "kn" = "en"): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return v.map((x) => toDisplayString(x, lang)).filter(Boolean).join("\n");
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    const langOrder = [lang, "en", "hi", "kn"];
    for (const k of langOrder) {
      if (typeof o[k] === "string" && o[k]) return o[k] as string;
    }
    for (const k of ["text", "value", "label", "content", "answer", "latex", "markdown", "html"]) {
      if (o[k] != null) return toDisplayString(o[k], lang);
    }
    try {
      return JSON.stringify(v);
    } catch {
      return "";
    }
  }
  return String(v);
}

/**
 * Normalize MCQ options into `{ key, label }[]`.
 * Accepts:
 *   - string[]                          → A, B, C…
 *   - { a: "…", b: "…" }               → uppercased keys
 *   - [{ key, text }] / [{ label }]     → picks stringy field
 */
export function normalizeOptions(
  raw: unknown
): Array<{ key: string; label: string }> {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((item, i) => {
        const key = String.fromCharCode(65 + i);
        if (item && typeof item === "object" && !Array.isArray(item)) {
          const o = item as Record<string, unknown>;
          const explicitKey =
            typeof o.key === "string" ? o.key : typeof o.id === "string" ? o.id : key;
          return { key: explicitKey.toUpperCase(), label: toDisplayString(item) };
        }
        return { key, label: toDisplayString(item) };
      })
      .filter((o) => o.label);
  }
  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .map(([k, v]) => ({ key: k.toUpperCase(), label: toDisplayString(v) }))
      .filter((o) => o.label);
  }
  return [];
}
