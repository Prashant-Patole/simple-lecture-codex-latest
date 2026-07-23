/**
 * Book-style two-page Notes reader is now the default for every topic.
 *
 * Emergency revert (browser devtools):
 *   localStorage.setItem("notes.legacyReader", "1")   // then reload
 */
export const isBookPilot = (topicId?: string | null): boolean => {
  if (!topicId) return false;
  try {
    if (typeof window !== "undefined" &&
        window.localStorage?.getItem("notes.legacyReader") === "1") {
      return false;
    }
  } catch {}
  return true;
};

export const NOTES_BOOK_PILOT_TOPIC_IDS = new Set<string>();
