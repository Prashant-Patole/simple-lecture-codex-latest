/**
 * Social-Science-only auto chroma-key sampler + tuner.
 *
 * The Social Science avatar is shot against a BRIGHT, uniform green screen,
 * so the strict thresholds + tight caps used for Maths/Science (which have
 * darker/checkerboard backgrounds) are unnecessary here — and the tight
 * caps are exactly what's leaving the pixelated rim on Social Science edges.
 *
 * This file is self-contained: it does not import from sampleAvatarGreen.ts.
 * Maths and Science continue to use the original sampler unchanged.
 */

import type { SampledKeyColor, AutoTuneSuggestion } from './sampleAvatarGreen';

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

/** Relaxed greenish test — bright clean green only needs obvious dominance. */
function isGreenishBright(r: number, g: number, b: number): boolean {
  return g > r + 15 && g > b + 15 && g > 90;
}

export function sampleAvatarGreenSocial(video: HTMLVideoElement): SampledKeyColor {
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
    // Bright BG → corners should be very clearly green. Higher than the
    // generic 0.6 so any corner contaminated by avatar shoulders is rejected.
    const CORNER_GREEN_THRESHOLD = 0.75;

    for (const [x, y, w, h] of patches) {
      let data: ImageData;
      try {
        data = ctx.getImageData(x, y, w, h);
      } catch {
        return { ...FALLBACK, confidence: -1, rejectReason: 'canvas-tainted' };
      }
      const cornerR: number[] = [];
      const cornerG: number[] = [];
      const cornerB: number[] = [];
      let cornerTotal = 0;
      for (let i = 0; i < data.data.length; i += 4) {
        cornerTotal++;
        const r = data.data[i];
        const g = data.data[i + 1];
        const b = data.data[i + 2];
        if (isGreenishBright(r, g, b)) {
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

    if (cornersUsed < 2) {
      return {
        ...FALLBACK,
        confidence: 0,
        sampledPixels: totalPx,
        greenPixels,
        greenRatio,
        cornersUsed,
        rejectReason: `social: only ${cornersUsed} corner(s) passed`,
      };
    }
    if (greenRatio < 0.65) {
      return {
        ...FALLBACK,
        confidence: 0,
        sampledPixels: totalPx,
        greenPixels,
        greenRatio,
        cornersUsed,
        rejectReason: `social: greenRatio ${greenRatio.toFixed(2)} < 0.65`,
      };
    }

    const spreadG = Math.max(...gs) - Math.min(...gs);
    const spread = {
      r: Math.max(...rs) - Math.min(...rs),
      g: spreadG,
      b: Math.max(...bs) - Math.min(...bs),
    };

    // Pick brightest+dominant green — for Social Science we trust the
    // sample as long as it is clearly bright and dominant.
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
      if (pSat < 0.50) continue;
      if (pg < 150 || pLuma < 110) continue;   // BRIGHT floor — no avatar pixels
      const dom = pg - maxRB;
      if (dom < 25) continue;
      const score = pg * 1.0 + dom * 0.6 + pSat * 50;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }

    if (bestIdx < 0) {
      return {
        ...FALLBACK,
        confidence: 0,
        sampledPixels: totalPx,
        greenPixels,
        greenRatio,
        cornersUsed,
        spread,
        strategy: 'fallback',
        rejectReason: `social: no-bright-green N=${N}`,
      };
    }

    const r = rs[bestIdx], g = gs[bestIdx], b = bs[bestIdx];
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat  = maxC > 0 ? (maxC - minC) / maxC : 0;
    const greenDominance = (g - Math.max(r, b)) / 255;

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
      strategy: 'brightest',
    };
  } catch {
    return { ...FALLBACK, confidence: -1, rejectReason: 'social: exception' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-tune for Social Science — wider matte + feather to kill the pixel rim.
// ─────────────────────────────────────────────────────────────────────────────

/** Social-Science variant adds a feather field consumed by the GL shader. */
export interface AutoTuneSuggestionSocial extends AutoTuneSuggestion {
  feather: number;
}

const MAX_SIMILARITY = 0.42;
const MAX_SMOOTHNESS = 0.34;
const MAX_SPILL      = 0.55;
const MAX_FEATHER    = 0.28;


export function autoTuneFromSocialSample(
  sample: SampledKeyColor,
  preset: { similarity: number; smoothness: number; spill: number; feather?: number },
): AutoTuneSuggestionSocial {
  const r = sample.r;
  const g = sample.g;
  const b = sample.b;
  const maxRB = Math.max(r, b);
  const greenness = Math.max(0, Math.min(1, (g - maxRB) / 255));
  const spreadG = sample.spread?.g ?? 0;
  const sat = sample.sat ?? 0;

  // Similarity — bright clean green tolerates a wider band.
  let simRec: number;
  if (greenness <= 0.15)      simRec = MAX_SIMILARITY;
  else if (greenness >= 0.55) simRec = 0.34;
  else                        simRec = MAX_SIMILARITY - ((greenness - 0.15) / 0.40) * (MAX_SIMILARITY - 0.34);

  // Spill — scale with greenness; bright green has cleaner edges so less
  // aggressive desaturation needed, but keep a healthy floor.
  let spillRec: number;
  if (greenness <= 0.15)      spillRec = MAX_SPILL;
  else if (greenness >= 0.55) spillRec = 0.34;
  else                        spillRec = MAX_SPILL - ((greenness - 0.15) / 0.40) * (MAX_SPILL - 0.34);

  // Smoothness — softer ramp by default to eliminate the stairstep rim.
  let smoothRec = 0.18;
  if (spreadG > 60)      smoothRec = MAX_SMOOTHNESS;
  else if (spreadG > 30) smoothRec = 0.22;

  // Feather — extends the soft cut inward, removing the 1-2px green fringe
  // without producing a hard edge. Scale with saturation: very saturated
  // green sample → safe to feather more; muddy → less.
  let featherRec: number;
  if (sat >= 0.85)      featherRec = 0.26;
  else if (sat >= 0.70) featherRec = 0.20;
  else                  featherRec = 0.14;


  // Respect any higher tuned preset values, but cap at safe maxima.
  const similarity = Math.min(MAX_SIMILARITY, Math.max(preset.similarity, +simRec.toFixed(3)));
  const smoothness = Math.min(MAX_SMOOTHNESS, Math.max(preset.smoothness, +smoothRec.toFixed(3)));
  const spill      = Math.min(MAX_SPILL,      Math.max(preset.spill,      +spillRec.toFixed(3)));
  const feather    = Math.min(MAX_FEATHER,    Math.max(preset.feather ?? 0, +featherRec.toFixed(3)));

  return {
    similarity,
    smoothness,
    spill,
    feather,
    reason: `social greenness=${greenness.toFixed(2)} sat=${sat.toFixed(2)} spreadG=${spreadG} cornersUsed=${sample.cornersUsed ?? 0}`,
  };
}
