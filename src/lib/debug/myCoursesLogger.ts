/**
 * Strict, tagged logger for My Courses refresh/refetch debugging.
 * Grep your console for: [MC]
 */
const TAG = "[MC]";

const ts = () => {
  const d = new Date();
  const pad = (n: number, l = 2) => n.toString().padStart(l, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};

export const mcLog = (scope: string, event: string, data?: unknown) => {
  // eslint-disable-next-line no-console
  console.log(`${TAG}[${ts()}][${scope}] ${event}`, data ?? "");
};

export const mcWarn = (scope: string, event: string, data?: unknown) => {
  // eslint-disable-next-line no-console
  console.warn(`${TAG}[${ts()}][${scope}] ${event}`, data ?? "");
};

/** Returns a short string describing how this page was reached. */
export const getNavType = (): string => {
  try {
    const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    if (entries.length) return entries[0].type;
  } catch {
    /* ignore */
  }
  return "unknown";
};

let installed = false;
/** Install global pageshow/pagehide BFCache probes once. */
export const installBFCacheProbes = () => {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("pageshow", (e) => {
    mcLog("BFCache", "pageshow", {
      persisted: (e as PageTransitionEvent).persisted,
      navType: getNavType(),
      url: location.pathname,
    });
  });
  window.addEventListener("pagehide", (e) => {
    mcLog("BFCache", "pagehide", {
      persisted: (e as PageTransitionEvent).persisted,
      url: location.pathname,
    });
  });
  // @ts-expect-error non-standard but supported in Chromium
  if (typeof document.wasDiscarded === "boolean") {
    // @ts-expect-error non-standard
    mcLog("BFCache", "wasDiscarded", { value: document.wasDiscarded });
  }
};
