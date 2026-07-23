// Local-only thread store for the Doubts tab. Persists an array of
// per-subject conversation threads in localStorage. No DB / edge fn changes.

export interface DoubtStoredMessage {
  role: "user" | "assistant";
  content: string;
  suggestions?: any[];
  importantQuestions?: any[];
  sources?: any[];
  keyPoints?: string[];
  slidePreview?: any;
  isDocGrounded?: boolean;
  noContent?: boolean;
}

export interface DoubtThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: DoubtStoredMessage[];
}

const PLACEHOLDER_TITLE = "New doubt";

export const threadsKey = (subjectId: string) => `doubts-threads:${subjectId}`;
export const legacyKey = (subjectId: string) => `doubts-chat:${subjectId}`;

const genId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `t_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
};

const trimTitle = (s: string) => {
  const t = (s || "").trim().replace(/\s+/g, " ");
  return t.length > 60 ? t.slice(0, 57) + "..." : t || PLACEHOLDER_TITLE;
};

const sanitizeMessages = (raw: any): DoubtStoredMessage[] => {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m: any) =>
      (m?.role === "user" || m?.role === "assistant") && typeof m?.content === "string"
  );
};

export const loadThreads = (subjectId: string | null): DoubtThread[] => {
  if (typeof window === "undefined" || !subjectId) return [];
  try {
    const raw = localStorage.getItem(threadsKey(subjectId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((t) => t && typeof t.id === "string")
          .map((t: any) => ({
            id: t.id,
            title: typeof t.title === "string" && t.title ? t.title : PLACEHOLDER_TITLE,
            createdAt: Number(t.createdAt) || Date.now(),
            updatedAt: Number(t.updatedAt) || Date.now(),
            messages: sanitizeMessages(t.messages),
          }));
      }
    }
    // Legacy migration: wrap single flat message array (session or local storage)
    const legacyRawSession =
      typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(legacyKey(subjectId))
        : null;
    const legacyRawLocal = localStorage.getItem(legacyKey(subjectId));
    const legacyRaw = legacyRawSession || legacyRawLocal;
    if (legacyRaw) {
      const legacyMsgs = sanitizeMessages(JSON.parse(legacyRaw));
      if (legacyMsgs.length > 0) {
        const firstUser = legacyMsgs.find((m) => m.role === "user");
        const now = Date.now();
        const thread: DoubtThread = {
          id: genId(),
          title: trimTitle(firstUser?.content || "Previous doubts"),
          createdAt: now,
          updatedAt: now,
          messages: legacyMsgs,
        };
        saveThreads(subjectId, [thread]);
        try {
          sessionStorage.removeItem(legacyKey(subjectId));
          localStorage.removeItem(legacyKey(subjectId));
        } catch {}
        return [thread];
      }
    }
  } catch (err) {
    console.error("[doubtThreadsStore] load failed", err);
  }
  return [];
};

export const saveThreads = (subjectId: string | null, threads: DoubtThread[]) => {
  if (typeof window === "undefined" || !subjectId) return;
  try {
    // Keep last 30 messages per thread to bound size, like the old behavior
    const trimmed = threads.map((t) => ({ ...t, messages: t.messages.slice(-30) }));
    localStorage.setItem(threadsKey(subjectId), JSON.stringify(trimmed));
  } catch (err) {
    console.error("[doubtThreadsStore] save failed", err);
  }
};

export const createEmptyThread = (): DoubtThread => {
  const now = Date.now();
  return {
    id: genId(),
    title: PLACEHOLDER_TITLE,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
};

export const isPlaceholderTitle = (t: string) => !t || t === PLACEHOLDER_TITLE;
