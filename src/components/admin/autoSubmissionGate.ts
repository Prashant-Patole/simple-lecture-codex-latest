export type SanitySummary = {
  avatar_healthy: number;
  avatar_total: number;
  topic_healthy: number;
  topic_total: number;
  images_healthy: number;
  images_total: number;
};

export function evaluateJobStatus(status: string | undefined | null): { proceed: boolean; reason?: string } {
  if (status === "completed") return { proceed: true };
  const shown = status === undefined ? "undefined" : status === "" ? "(empty)" : String(status);
  return { proceed: false, reason: `Job ended as ${shown}` };
}

export function evaluateSanity(summary: SanitySummary | null | undefined): { passed: boolean; reason?: string } {
  if (!summary) return { passed: false, reason: "No sanity summary returned" };
  const {
    avatar_healthy = 0,
    avatar_total = 0,
    topic_healthy = 0,
    topic_total = 0,
    images_healthy = 0,
    images_total = 0,
  } = summary;

  if (avatar_healthy !== avatar_total) {
    return { passed: false, reason: `Avatar ${avatar_healthy}/${avatar_total}` };
  }
  if (topic_healthy !== topic_total) {
    return { passed: false, reason: `Topic ${topic_healthy}/${topic_total}` };
  }
  if (images_healthy !== images_total) {
    return { passed: false, reason: `Images ${images_healthy}/${images_total}` };
  }
  const denom = avatar_total + topic_total + images_total;
  const overall = denom > 0
    ? Math.round(((avatar_healthy + topic_healthy + images_healthy) / denom) * 100)
    : 0;
  if (overall !== 100) {
    return { passed: false, reason: `Overall ${overall}%` };
  }
  return { passed: true };
}

export function decideContinue(
  status: string | undefined | null,
  summary: SanitySummary | null | undefined,
): { continue: boolean; reason?: string } {
  const s = evaluateJobStatus(status);
  if (!s.proceed) return { continue: false, reason: s.reason };
  const c = evaluateSanity(summary);
  if (!c.passed) return { continue: false, reason: c.reason };
  return { continue: true };
}
