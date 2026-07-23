/**
 * Auto-detect the exact chroma-key green of an avatar video by sampling
 * 4 corner patches (background only — never the centered avatar's body).
 *
 * Per-corner quality gating + strict "greenish" test + aggregate rejection
 * means contaminated samples (avatar head/shoulders bleeding into a corner,
 * non-green background, mostly-black first frame) return FALLBACK with
 * `confidence: 0` instead of pushing a bad key color that would eat the
 * avatar at runtime.
 */

export interface SampledKeyColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  hex: string;
  confidence: number; // 0-1, fraction of sampled pixels that were greenish
  sampledPixels?: number;
  greenPixels?: number;
  greenRatio?: number;
  spread?: { r: number; g: number; b: number };
  /** How many of the 4 corners passed the per-corner green-ratio gate. */
  cornersUsed?: number;
  /** Reason the sample was rejected, if any. */
  rejectReason?: string;
  /** Diagnostic: luma 0..255 of chosen sample. */
  luma?: number;
  /** Diagnostic: saturation 0..1 of chosen sample. */
  sat?: number;
  /** Diagnostic: green dominance over max(r,b), normalized 0..1. */
  greenDominance?: number;
  /** Diagnostic: which key-color strategy was used. */
  strategy?: 'brightest' | 'p75' | 'median' | 'fallback';
}

const FALLBACK: SampledKeyColor = {
  r: 0, g: 177, b: 64,
  hex: '#00B140',
  confidence: 0,
  sampledPixels: 0,
  greenPixels: 0,
  greenRatio: 0,
  spread: { r: 0, g: 0, b: 0 },
  cornersUsed: 0,
};

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Strict greenish test — must clearly dominate red and blue and be bright enough. */
function isGreenish(r: number, g: number, b: number): boolean {
  return g > r + 20 && g > b + 20 && g > 60;
}

export function sampleAvatarGreen(video: HTMLVideoElement): SampledKeyColor {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
    return FALLBACK;
  }

  try {
    const W = 160;
    const H = 160;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return FALLBACK;

    ctx.drawImage(video, 0, 0, W, H);

    // 4 corner patches only — the avatar is centered, so corners are
    // overwhelmingly background. Strips were dropped because they often
    // crossed the avatar's head/shoulders on Maths/Social Science videos.
    const PATCH = 28;
    const patches: Array<[number, number, number, number]> = [
      [0,         0,          PATCH, PATCH],
      [W - PATCH, 0,          PATCH, PATCH],
      [0,         H - PATCH,  PATCH, PATCH],
      [W - PATCH, H - PATCH,  PATCH, PATCH],
    ];

    const rs: number[] = [];
    const gs: number[] = [];
    const bs: number[] = [];
    let totalPx = 0;
    let cornersUsed = 0;
    const CORNER_GREEN_THRESHOLD = 0.6;

    for (const [x, y, w, h] of patches) {
      let data: ImageData;
      try {
        data = ctx.getImageData(x, y, w, h);
      } catch {
        return { ...FALLBACK, confidence: -1, rejectReason: 'canvas-tainted' };
      }

      // Tally this corner in isolation first — only merge it into the
      // global pool if it's >=60% green pixels (i.e. not overlapping
      // the avatar's body).
      const cornerR: number[] = [];
      const cornerG: number[] = [];
      const cornerB: number[] = [];
      let cornerTotal = 0;
      for (let i = 0; i < data.data.length; i += 4) {
        cornerTotal++;
        const r = data.data[i];
        const g = data.data[i + 1];
        const b = data.data[i + 2];
        if (isGreenish(r, g, b)) {
          cornerR.push(r);
          cornerG.push(g);
          cornerB.push(b);
        }
      }
      totalPx += cornerTotal;
      const cornerRatio = cornerTotal > 0 ? cornerR.length / cornerTotal : 0;
      if (cornerRatio >= CORNER_GREEN_THRESHOLD) {
        cornersUsed++;
        rs.push(...cornerR);
        gs.push(...cornerG);
        bs.push(...cornerB);
      }
    }

    const greenPixels = rs.length;
    const greenRatio = totalPx > 0 ? greenPixels / totalPx : 0;

    // Quality gates — any failure → reject and keep current key color.
    if (cornersUsed < 2) {
      return {
        ...FALLBACK,
        confidence: 0,
        sampledPixels: totalPx,
        greenPixels,
        greenRatio,
        cornersUsed,
        rejectReason: `only ${cornersUsed} corner(s) passed`,
      };
    }
    if (greenRatio < 0.55) {
      return {
        ...FALLBACK,
        confidence: 0,
        sampledPixels: totalPx,
        greenPixels,
        greenRatio,
        cornersUsed,
        rejectReason: `greenRatio ${greenRatio.toFixed(2)} < 0.55`,
      };
    }
    const spreadG = Math.max(...gs) - Math.min(...gs);
    if (spreadG > 80) {
      return {
        ...FALLBACK,
        confidence: 0,
        sampledPixels: totalPx,
        greenPixels,
        greenRatio,
        cornersUsed,
        spread: {
          r: Math.max(...rs) - Math.min(...rs),
          g: spreadG,
          b: Math.max(...bs) - Math.min(...bs),
        },
        rejectReason: `spreadG ${spreadG} > 80`,
      };
    }

    const spread = {
      r: Math.max(...rs) - Math.min(...rs),
      g: spreadG,
      b: Math.max(...bs) - Math.min(...bs),
    };

    // ── Strategy: pick the BRIGHT + SATURATED + DOMINANT green ──
    // Score weights brightness heavily so we prefer vivid screen-green over
    // muddy darker tiles (e.g. #277542) that are close to avatar hair/shadow
    // and would eat the body.
    const N = rs.length;
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < N; i++) {
      const pr = rs[i], pg = gs[i], pb = bs[i];
      const maxRB = Math.max(pr, pb);
      const maxC = Math.max(pr, pg, pb);
      const minC = Math.min(pr, pg, pb);
      const pSat = maxC > 0 ? (maxC - minC) / maxC : 0;
      const pLuma = 0.299 * pr + 0.587 * pg + 0.114 * pb;
      if (pSat < 0.55) continue;
      if (pg < 130 || pLuma < 95) continue;   // require BRIGHT
      const dom = pg - maxRB;
      if (dom < 30) continue;                  // require clearly DOMINANT
      const score = pg * 1.0 + dom * 0.6 + pSat * 50;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }

    let r: number, g: number, b: number;
    let strategy: SampledKeyColor['strategy'];
    if (bestIdx >= 0) {
      r = rs[bestIdx]; g = gs[bestIdx]; b = bs[bestIdx];
      strategy = 'brightest';
    } else {
      // No bright/safe green present → reject. Pushing a dark muddy green
      // here would erase the avatar's body, so we keep the default safe key.
      return {
        ...FALLBACK,
        confidence: 0,
        sampledPixels: totalPx,
        greenPixels,
        greenRatio,
        cornersUsed,
        spread,
        strategy: 'fallback',
        rejectReason: `no-safe-bright-green N=${N} (all candidates dark/muddy)`,
      };
    }

    // ── Foreground-safety quality gates on the CHOSEN sample ──
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;     // 0..255
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat  = maxC > 0 ? (maxC - minC) / maxC : 0;    // 0..1
    const greenDominance = (g - Math.max(r, b)) / 255;   // ~0..1

    // Stricter low-brightness rejection — borderline-dark greens like
    // #277542 (g=117, luma≈86) are too close to avatar hair/shadow tones.
    if (g < 130 || luma < 95) {
      return {
        ...FALLBACK,
        confidence: 0,
        sampledPixels: totalPx,
        greenPixels,
        greenRatio,
        cornersUsed,
        spread,
        strategy: 'fallback',
        rejectReason: `unsafe-dark g=${g} luma=${luma.toFixed(0)} sat=${sat.toFixed(2)} dom=${greenDominance.toFixed(2)}`,
      };
    }
    if (sat < 0.55) {
      return {
        ...FALLBACK,
        confidence: 0,
        sampledPixels: totalPx,
        greenPixels,
        greenRatio,
        cornersUsed,
        spread,
        strategy: 'fallback',
        rejectReason: `unsafe-muddy sat=${sat.toFixed(2)}`,
      };
    }
    if (greenDominance < 0.20) {
      return {
        ...FALLBACK,
        confidence: 0,
        sampledPixels: totalPx,
        greenPixels,
        greenRatio,
        cornersUsed,
        spread,
        strategy: 'fallback',
        rejectReason: `unsafe-weak dominance=${greenDominance.toFixed(2)}`,
      };
    }

    return {
      r, g, b,
      hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase(),
      confidence: greenRatio,
      sampledPixels: totalPx,
      greenPixels,
      greenRatio,
      spread,
      cornersUsed,
      luma: +luma.toFixed(1),
      sat: +sat.toFixed(3),
      greenDominance: +greenDominance.toFixed(3),
      strategy,
    };
  } catch {
    return { ...FALLBACK, confidence: -1, rejectReason: 'exception' };
  }
}

/** Sample a single pixel at a normalized (x,y) on the video. */
export function pickPixelFromVideo(
  video: HTMLVideoElement,
  uvX: number,
  uvY: number,
): SampledKeyColor | null {
  if (!video || video.readyState < 2) return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    const px = Math.floor(uvX * canvas.width);
    const py = Math.floor(uvY * canvas.height);
    const data = ctx.getImageData(px, py, 1, 1).data;
    return {
      r: data[0], g: data[1], b: data[2],
      hex: `#${toHex(data[0])}${toHex(data[1])}${toHex(data[2])}`.toUpperCase(),
      confidence: 1,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime auto-tune — capped so we never widen the cut into the avatar.
// ─────────────────────────────────────────────────────────────────────────────

export interface AutoTuneSuggestion {
  similarity: number;
  smoothness: number;
  spill: number;
  reason: string;
}

// Hard upper bounds — decoded dark green must not widen the matte into the
// foreground. These caps preserve avatar opacity on Maths/SocSci devices.
const MAX_SIMILARITY = 0.32;
const MAX_SMOOTHNESS = 0.12;
const MAX_SPILL      = 0.35;

export function autoTuneFromSample(
  sample: SampledKeyColor,
  preset: { similarity: number; smoothness: number; spill: number },
): AutoTuneSuggestion {
  const r = sample.r;
  const g = sample.g;
  const b = sample.b;
  const maxRB = Math.max(r, b);
  const greenness = Math.max(0, Math.min(1, (g - maxRB) / 255));
  const spreadG = sample.spread?.g ?? 0;

  // Map greenness → similarity (capped at MAX_SIMILARITY).
  let simRec: number;
  if (greenness <= 0.10)      simRec = MAX_SIMILARITY;
  else if (greenness >= 0.55) simRec = 0.24;
  else                        simRec = MAX_SIMILARITY - ((greenness - 0.10) / 0.45) * (MAX_SIMILARITY - 0.24);

  // Map greenness → spill (capped at MAX_SPILL).
  let spillRec: number;
  if (greenness <= 0.10)      spillRec = MAX_SPILL;
  else if (greenness >= 0.55) spillRec = 0.12;
  else                        spillRec = MAX_SPILL - ((greenness - 0.10) / 0.45) * (MAX_SPILL - 0.12);

  // Smoothness — high g-spread → slightly wider ramp.
  let smoothRec = 0.08;
  if (spreadG > 60)      smoothRec = MAX_SMOOTHNESS;
  else if (spreadG > 30) smoothRec = 0.10;

  // Darkness-aware cap: borderline-dark accepted greens get a tighter cap
  // so we never widen the matte into the avatar's shadow/suit colors.
  const luma = sample.luma ?? (0.299 * r + 0.587 * g + 0.114 * b);
  const isDarkish = luma < 130;
  // High-variance backgrounds (e.g. Maths checkerboard) need a wider band
  // so the similarity covers both vivid AND darker tiles.
  const highVariance = spreadG > 60;
  let simCap   = isDarkish ? 0.24 : MAX_SIMILARITY;
  let smoothCap = isDarkish ? 0.10 : MAX_SMOOTHNESS;
  let spillCap  = isDarkish ? 0.16 : MAX_SPILL;
  if (highVariance) {
    simCap   = Math.max(simCap, 0.32);
    smoothCap = Math.max(smoothCap, 0.12);
  }

  // Respect tuned lower values, but clamp unsafe preset/localStorage values down.
  const similarity = Math.min(simCap,   Math.max(preset.similarity, +simRec.toFixed(3)));
  const smoothness = Math.min(smoothCap, Math.max(preset.smoothness, +smoothRec.toFixed(3)));
  const spill      = Math.min(spillCap,  Math.max(preset.spill,      +spillRec.toFixed(3)));

  return {
    similarity,
    smoothness,
    spill,
    reason: `strat=${sample.strategy ?? '?'} greenness=${greenness.toFixed(2)} luma=${luma.toFixed(0)} dark=${isDarkish} spreadG=${spreadG} highVar=${highVariance} cornersUsed=${sample.cornersUsed ?? 0}`,
  };
}
