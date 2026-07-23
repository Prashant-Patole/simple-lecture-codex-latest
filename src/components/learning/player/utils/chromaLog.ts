/**
 * Strict, one-shot, structured logger for the chroma-key subsystem.
 *
 * Rules:
 * - Single namespace: [ChromaKey]
 * - One greppable line per event (payload JSON-stringified)
 * - 2s de-dupe per (event + payload-hash) — kills accidental loops
 * - `debug` level only fires when localStorage.LOVABLE_CHROMA_DEBUG === '1'
 * - Errors always log (no de-dupe)
 *
 * Intended usage sites only — never inside per-frame paths.
 */

type Level = 'info' | 'warn' | 'error' | 'debug';

const TAG = '[ChromaKey]';
const DEDUPE_WINDOW_MS = 2000;
const recent = new Map<string, number>();

function isDebugEnabled(): boolean {
  try {
    return typeof window !== 'undefined'
      && window.localStorage?.getItem('LOVABLE_CHROMA_DEBUG') === '1';
  } catch {
    return false;
  }
}

function hash(s: string): string {
  // Tiny non-cryptographic hash for de-dupe key
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

function safeStringify(payload: unknown): string {
  try {
    return JSON.stringify(payload, (_k, v) => {
      if (v instanceof Error) return { name: v.name, message: v.message };
      return v;
    });
  } catch {
    return String(payload);
  }
}

function emit(level: Level, event: string, payload: Record<string, unknown> = {}) {
  if (level === 'debug' && !isDebugEnabled()) return;

  const json = safeStringify(payload);

  if (level !== 'error') {
    const key = `${level}:${event}:${hash(json)}`;
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUPE_WINDOW_MS) return;
    recent.set(key, now);
    // Best-effort cleanup
    if (recent.size > 200) {
      for (const [k, t] of recent) if (now - t > DEDUPE_WINDOW_MS) recent.delete(k);
    }
  }

  const line = `${TAG} ${event} ${json}`;
  switch (level) {
    case 'warn':  console.warn(line); break;
    case 'error': console.error(line); break;
    case 'debug': console.log(line); break;
    default:      console.info(line); break;
  }
}

export const chromaLog = {
  info:  (event: string, payload?: Record<string, unknown>) => emit('info',  event, payload),
  warn:  (event: string, payload?: Record<string, unknown>) => emit('warn',  event, payload),
  error: (event: string, payload?: Record<string, unknown>) => emit('error', event, payload),
  debug: (event: string, payload?: Record<string, unknown>) => emit('debug', event, payload),
};

/** Probe the WebGL context for diagnostic metadata. Returns a small flat record. */
export function describeGL(gl: WebGLRenderingContext | null | undefined): Record<string, unknown> {
  if (!gl) return { glVersion: null };
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  let vendor: string | null = null;
  let renderer: string | null = null;
  try {
    vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) as string : gl.getParameter(gl.VENDOR) as string;
    renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) as string : gl.getParameter(gl.RENDERER) as string;
  } catch {/* ignore */}
  let precision: string = 'unknown';
  try {
    const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    if (hp) precision = `highp:${hp.precision}`;
  } catch {/* ignore */}
  return {
    glVersion: gl.getParameter(gl.VERSION),
    vendor,
    renderer,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    precision,
  };
}
