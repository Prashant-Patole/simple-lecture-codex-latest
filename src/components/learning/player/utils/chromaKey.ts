/**
 * CPU chroma key with edge erosion for clean green screen removal.
 * Supports multiple green screen shades (bright, medium, dark).
 * Accepts per-subject tuning via ChromaKeyParams.
 */

import { ChromaKeyParams, DEFAULT_CHROMA_PARAMS } from './chromaKeyPresets';

const FEATHER_RANGE_FALLBACK = 8; // kept for back-compat reference

export function processChromaKey(
  data: Uint8ClampedArray,
  params: ChromaKeyParams = DEFAULT_CHROMA_PARAMS
): void {
  const HUE_MIN = params.hueMin;
  const HUE_MAX = params.hueMax;
  const SAT_MIN = params.satMin;
  const LIGHT_MIN = params.lightMin;
  const LIGHT_MAX = params.lightMax;
  const FEATHER_RANGE = params.feather;
  const GRAY_THRESHOLD = params.grayThreshold;
  const GREEN_EXCESS_THRESHOLD = params.greenExcessThreshold;
  const SPILL_THRESHOLD = params.spillThreshold;
  const RAMP_LOW = params.alphaRampLow;
  const RAMP_HIGH = Math.max(params.alphaRampHigh, params.alphaRampLow + 1);
  const RAMP_SPAN = RAMP_HIGH - RAMP_LOW;

  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (data[i + 3] === 0) continue;

    // Ratio-based green detection: green must exceed average of r and b
    const avgRB = (r + b) * 0.5;
    const greenExcess = g - avgRB;

    if (greenExcess < GREEN_EXCESS_THRESHOLD) {
      // Not green enough — only do spill suppression
      const maxRB = r > b ? r : b;
      if (g > maxRB + SPILL_THRESHOLD) {
        const spillStrength = (g - maxRB) / (g + 1);
        const clampedSpill = spillStrength > 0.95 ? 0.95 : spillStrength;
        data[i + 1] = (g - (g - maxRB) * clampedSpill + 0.5) | 0;
      }
      continue;
    }

    // Skin-tone guard — wider ratio to protect skin
    if (r > 80 && r > b && g < r * 1.35) {
      const maxRB = r > b ? r : b;
      if (g > maxRB + SPILL_THRESHOLD) {
        const spillStrength = (g - maxRB) / (g + 1);
        const clampedSpill = spillStrength > 0.95 ? 0.95 : spillStrength;
        data[i + 1] = (g - (g - maxRB) * clampedSpill + 0.5) | 0;
      }
      continue;
    }

    // Gray-tone guard: neutral pixels are never keyed
    const maxRGB = r > g ? (r > b ? r : b) : (g > b ? g : b);
    const minRGB = r < g ? (r < b ? r : b) : (g < b ? g : b);
    if (maxRGB - minRGB < GRAY_THRESHOLD) continue;

    const r1 = r / 255;
    const g1 = g / 255;
    const b1 = b / 255;

    const max = g1 > r1 ? (g1 > b1 ? g1 : b1) : (r1 > b1 ? r1 : b1);
    const min = r1 < b1 ? r1 : b1;
    const l = (max + min) * 0.5;

    if (l <= LIGHT_MIN || l >= LIGHT_MAX) continue;

    const d = max - min;
    if (d < 0.001) continue;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    // Protect the Science avatar's dark green-gray suit. Without this, low-light
    // foreground pixels near shoulders get cut and look like jagged black bites.
    if (l < 0.32 && greenExcess < 33) continue;

    // Dark-tone guard: protect very dark clothing only
    if (l < 0.20 && s < 0.45) continue;

    if (s <= SAT_MIN) continue;

    // Compute hue (green is dominant so use standard formula)
    let h: number;
    if (max === g1) {
      h = ((b1 - r1) / d + 2) * 60;
    } else if (max === r1) {
      h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) * 60;
    } else {
      h = ((r1 - g1) / d + 4) * 60;
    }

    // Soft alpha ramp from green-excess — smoothstep
    let rampAlpha: number;
    if (greenExcess <= RAMP_LOW) rampAlpha = 1;
    else if (greenExcess >= RAMP_HIGH) rampAlpha = 0;
    else {
      const t = (greenExcess - RAMP_LOW) / RAMP_SPAN;
      const s = t * t * (3 - 2 * t);
      rampAlpha = 1 - s;
    }

    if (h >= HUE_MIN && h <= HUE_MAX) {
      const distFromMin = h - HUE_MIN;
      const distFromMax = HUE_MAX - h;
      const hueDistFromEdge = distFromMin < distFromMax ? distFromMin : distFromMax;
      const hueAlpha = hueDistFromEdge > FEATHER_RANGE ? 0 : (1 - hueDistFromEdge / FEATHER_RANGE);
      const finalAlpha = hueAlpha < rampAlpha ? hueAlpha : rampAlpha;
      const a = (finalAlpha * 255 + 0.5) | 0;
      if (a < data[i + 3]) data[i + 3] = a;

      const maxRB = r > b ? r : b;
      if (g > maxRB + SPILL_THRESHOLD) {
        const spillStrength = (g - maxRB) / (g + 1);
        const clampedSpill = spillStrength > 0.95 ? 0.95 : spillStrength;
        data[i + 1] = (g - (g - maxRB) * clampedSpill + 0.5) | 0;
      }
    } else {
      // Apply ramp even outside hue band so background-tinted areas feather out
      if (rampAlpha < 1) {
        const a = (rampAlpha * 255 + 0.5) | 0;
        if (a < data[i + 3]) data[i + 3] = a;
      }
      const maxRB = r > b ? r : b;
      if (g > maxRB + SPILL_THRESHOLD) {
        const spillStrength = (g - maxRB) / (g + 1);
        const clampedSpill = spillStrength > 0.95 ? 0.95 : spillStrength;
        data[i + 1] = (g - (g - maxRB) * clampedSpill + 0.5) | 0;
      }
    }
  }
}

/**
 * Edge erosion: remove isolated green-ish pixels on transparent edges.
 */
export function erodeGreenEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: ChromaKeyParams = DEFAULT_CHROMA_PARAMS
): void {
  const stride = width * 4;
  const SPILL_THRESHOLD = params.spillThreshold;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      if (data[idx + 3] === 0) continue;

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      if (g <= r + SPILL_THRESHOLD + 10 || g <= b) continue;

      let transparentCount = 0;
      if (data[idx - stride + 3] === 0) transparentCount++;
      if (data[idx + stride + 3] === 0) transparentCount++;
      if (data[idx - 4 + 3] === 0) transparentCount++;
      if (data[idx + 4 + 3] === 0) transparentCount++;
      if (data[idx - stride - 4 + 3] === 0) transparentCount++;
      if (data[idx - stride + 4 + 3] === 0) transparentCount++;
      if (data[idx + stride - 4 + 3] === 0) transparentCount++;
      if (data[idx + stride + 4 + 3] === 0) transparentCount++;

      if (transparentCount >= 3) {
        data[idx + 3] = 0;
      }
    }
  }
}

/**
 * Blur only the alpha channel around cutout boundaries so the avatar silhouette
 * stays smooth without softening facial/clothing pixels.
 */
export function smoothAlphaEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: ChromaKeyParams = DEFAULT_CHROMA_PARAMS
): void {
  if (params.edgeSmoothing <= 0 || width < 3 || height < 3) return;

  const alpha = new Uint8ClampedArray(width * height);
  const rgb = new Uint8ClampedArray(width * height * 3);
  for (let i = 0, p = 0; i < alpha.length; i++, p += 4) {
    alpha[i] = data[p + 3];
    const rp = i * 3;
    rgb[rp] = data[p];
    rgb[rp + 1] = data[p + 1];
    rgb[rp + 2] = data[p + 2];
  }

  const amount = Math.min(1, Math.max(0, params.edgeSmoothing));
  const matteAmount = Math.min(1, Math.max(0, params.matteCleanup));
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const ai = y * width + x;
      const center = alpha[ai];
      const minA = Math.min(center, alpha[ai - 1], alpha[ai + 1], alpha[ai - width], alpha[ai + width]);
      const maxA = Math.max(center, alpha[ai - 1], alpha[ai + 1], alpha[ai - width], alpha[ai + width]);
      if (maxA - minA < 12) continue;

      const avg = (
        center * 4 +
        alpha[ai - 1] + alpha[ai + 1] + alpha[ai - width] + alpha[ai + width] +
        alpha[ai - width - 1] + alpha[ai - width + 1] + alpha[ai + width - 1] + alpha[ai + width + 1]
      ) / 12;
      const edgeFactor = Math.min(1, (maxA - minA) / 96);
      const pixel = ai * 4;
      const nextAlpha = center + (avg - center) * amount * edgeFactor;
      data[pixel + 3] = (nextAlpha + 0.5) | 0;

      if (matteAmount <= 0) continue;

      let fr = 0, fg = 0, fb = 0, fw = 0;
      const collect = (index: number, weight: number) => {
        if (alpha[index] < 115) return;
        const rp = index * 3;
        fr += rgb[rp] * weight;
        fg += rgb[rp + 1] * weight;
        fb += rgb[rp + 2] * weight;
        fw += weight;
      };
      collect(ai, 3);
      collect(ai - 1, 1);
      collect(ai + 1, 1);
      collect(ai - width, 1);
      collect(ai + width, 1);
      collect(ai - width - 1, 0.7);
      collect(ai - width + 1, 0.7);
      collect(ai + width - 1, 0.7);
      collect(ai + width + 1, 0.7);

      const cleanup = matteAmount * edgeFactor * (1 - nextAlpha / 420);
      const r = data[pixel];
      const g = data[pixel + 1];
      const b = data[pixel + 2];
      const maxRB = r > b ? r : b;
      if (g > maxRB + params.spillThreshold) {
        data[pixel + 1] = (g - (g - maxRB) * Math.min(1, cleanup + 0.35) + 0.5) | 0;
      }
      if (fw > 0) {
        const mix = cleanup;
        data[pixel] = (r + (fr / fw - r) * mix + 0.5) | 0;
        data[pixel + 1] = (data[pixel + 1] + (fg / fw - data[pixel + 1]) * mix + 0.5) | 0;
        data[pixel + 2] = (b + (fb / fw - b) * mix + 0.5) | 0;
      }
    }
  }
}
