/**
 * Per-subject chroma key tuning.
 *
 * Each avatar can have a slightly different shade of green screen, so a single
 * global setting can't be clean for all subjects. This module exposes a
 * default preset that matches the historical hardcoded values plus per-course
 * per-subject overrides for the OLD EducationalVideoPlayer ONLY.
 */

export interface ChromaKeyParams {
  /** Debug label so we can verify the exact preset in the browser console */
  presetName: string;
  /** Hue band, in degrees, that counts as "green" */
  hueMin: number;
  hueMax: number;
  satMin: number;
  lightMin: number;
  lightMax: number;
  /** Soft alpha falloff at the edges of the hue band (degrees) */
  feather: number;
  /** 0-255: green must exceed avg(r,b) by this much to be considered green */
  greenExcessThreshold: number;
  /** 0-255: pixels within this max-min range are treated as gray and skipped */
  grayThreshold: number;
  /** 0-255: spill suppression kicks in when g > max(r,b) + this */
  spillThreshold: number;
  /** Number of edge erosion passes (CPU path only) */
  edgeErodePasses: number;
  /** Soft-edge alpha ramp (0-255 green-excess). Below low = opaque, above high = cut. */
  alphaRampLow: number;
  alphaRampHigh: number;
  /** 0-1: spatial alpha smoothing around silhouette edges. 0 keeps legacy hard mask. */
  edgeSmoothing: number;
  /** 0-1: RGB matte cleanup on boundary pixels to remove green/black crunchy halos. */
  matteCleanup: number;
}

export const DEFAULT_CHROMA_PARAMS: ChromaKeyParams = {
  presetName: 'default',
  hueMin: 65,
  hueMax: 170,
  satMin: 0.15,
  lightMin: 0.10,
  lightMax: 0.85,
  feather: 8,
  greenExcessThreshold: 8,
  grayThreshold: 20,
  spillThreshold: 15,
  edgeErodePasses: 2,
  // Default ramp is narrow — preserves existing behavior for non-overridden courses
  alphaRampLow: 8,
  alphaRampHigh: 10,
  edgeSmoothing: 0,
  matteCleanup: 0,
};

// SSLC 10th boards course
const SSLC_COURSE_ID = '4c10bc8e-acbc-4b76-b7f5-54376c030cb0';

const SSLC_SCIENCE_SUBJECT_ID = 'ceaf73fb-528a-4d4a-947c-4a7be304db2b';
const SSLC_MATHS_SUBJECT_ID = 'e41572db-085d-4dfc-ba75-478c8222e2c5';
const SSLC_SOCIAL_SUBJECT_ID = 'b4b83f9b-bc1f-433c-9400-234e50ac1b70';

/**
 * Science avatar — wide soft alpha ramp produces a photographic cutout
 * silhouette (no stairstep), wider hue band, stronger spill suppression.
 */
const SCIENCE_PARAMS: ChromaKeyParams = {
  presetName: 'sslc-science-smooth-matte-v3',
  hueMin: 58,
  hueMax: 178,
  satMin: 0.10,
  lightMin: 0.06,
  lightMax: 0.90,
  feather: 30,
  greenExcessThreshold: 4,
  grayThreshold: 16,
  spillThreshold: 5,
  edgeErodePasses: 0,
  alphaRampLow: 4,
  alphaRampHigh: 44,
  edgeSmoothing: 0.95,
  matteCleanup: 0.9,
};

// Placeholders — will be tuned per subject from screenshots
const MATHS_PARAMS: ChromaKeyParams = { ...DEFAULT_CHROMA_PARAMS };
const SOCIAL_PARAMS: ChromaKeyParams = { ...DEFAULT_CHROMA_PARAMS };

const SSLC_SUBJECT_PRESETS: Record<string, ChromaKeyParams> = {
  [SSLC_SCIENCE_SUBJECT_ID]: SCIENCE_PARAMS,
  [SSLC_MATHS_SUBJECT_ID]: MATHS_PARAMS,
  [SSLC_SOCIAL_SUBJECT_ID]: SOCIAL_PARAMS,
};

export function getChromaParams(
  courseId?: string | null,
  subjectId?: string | null
): ChromaKeyParams {
  if (courseId === SSLC_COURSE_ID && subjectId && SSLC_SUBJECT_PRESETS[subjectId]) {
    return SSLC_SUBJECT_PRESETS[subjectId];
  }
  return DEFAULT_CHROMA_PARAMS;
}

// ─────────────────────────────────────────────────────────────────────────────
// NEW: WebGL YCbCr-based chroma key params (similarity / smoothness / spill /
// feather / choke). Used by the upgraded GL renderer in chromaKeyGL.ts.
// Key color is auto-detected per-video; only the 5 slider values live here.
// ─────────────────────────────────────────────────────────────────────────────

export interface GLChromaParams {
  presetName: string;
  similarity: number; // 0..1
  smoothness: number; // 0..0.5
  spill: number;      // 0..1
  feather: number;    // 0..0.5
  choke: number;      // -0.1..0.1
}

export const GL_DEFAULTS_GREEN: GLChromaParams = {
  presetName: 'gl-default-green',
  similarity: 0.35,
  smoothness: 0.12,
  spill: 0.15,
  feather: 0.08,
  choke: 0.0,
};

const GL_SCIENCE: GLChromaParams = {
  presetName: 'gl-sslc-science-desktop-tuned',
  similarity: 0.210,
  smoothness: 0.120,
  spill: 0.150,
  feather: 0.080,
  choke: 0.000,
};
const GL_MATHS: GLChromaParams = {
  presetName: 'gl-sslc-maths-v5-derim',
  similarity: 0.240,
  smoothness: 0.080,
  spill: 0.400,
  feather: 0.000,
  choke: 0.010,
};
const GL_SOCIAL: GLChromaParams = {
  presetName: 'gl-sslc-social-v5-derim',
  similarity: 0.260,
  smoothness: 0.080,
  spill: 0.400,
  feather: 0.000,
  choke: 0.010,
};

export type Device = 'mobile' | 'desktop';

const SSLC_GL_PRESETS_DESKTOP: Record<string, GLChromaParams> = {
  [SSLC_SCIENCE_SUBJECT_ID]: GL_SCIENCE,
  [SSLC_MATHS_SUBJECT_ID]: GL_MATHS,
  [SSLC_SOCIAL_SUBJECT_ID]: GL_SOCIAL,
};

// Mobile presets v2: bake in Spill + Smoothness + Feather so users never need
// to open Keying Controls. Higher similarity widens the green band for
// wide-gamut AMOLED phones; spill removes the green tint bleeding onto the
// suit/skin that users perceive as a "faded / washed out" avatar.
const GL_SCIENCE_MOBILE: GLChromaParams = {
  presetName: 'gl-sslc-science-mobile-v3-natural',
  similarity: 0.300,
  smoothness: 0.090,
  spill: 0.180,
  feather: 0.050,
  choke: 0.000,
};

const GL_MATHS_MOBILE: GLChromaParams = {
  presetName: 'gl-sslc-maths-mobile-v5-derim',
  similarity: 0.300,
  smoothness: 0.080,
  spill: 0.420,
  feather: 0.050,
  choke: 0.010,
};

const GL_SOCIAL_MOBILE: GLChromaParams = {
  presetName: 'gl-sslc-social-mobile-v6-smooth',
  similarity: 0.300,
  smoothness: 0.150,
  spill: 0.420,
  feather: 0.110,
  choke: 0.000,
};

const SSLC_GL_PRESETS_MOBILE: Record<string, GLChromaParams> = {
  [SSLC_SCIENCE_SUBJECT_ID]: GL_SCIENCE_MOBILE,
  [SSLC_MATHS_SUBJECT_ID]: GL_MATHS_MOBILE,
  [SSLC_SOCIAL_SUBJECT_ID]: GL_SOCIAL_MOBILE,
};

function presetsForDevice(device: Device): Record<string, GLChromaParams> {
  return device === 'mobile' ? SSLC_GL_PRESETS_MOBILE : SSLC_GL_PRESETS_DESKTOP;
}

function glStorageKey(
  courseId: string | null | undefined,
  subjectId: string | null | undefined,
  device: Device,
): string {
  // v3 namespace: ignores old aggressive Maths/Social/mobile saves that made
  // avatars dark or transparent after the runtime sampler accepted dark green.
  return `chromaKey:gl:v3:${device}:${courseId || 'global'}:${subjectId || 'all'}`;
}

export function getGLChromaPreset(
  courseId?: string | null,
  subjectId?: string | null,
  device: Device = 'desktop',
): GLChromaParams {
  if (courseId === SSLC_COURSE_ID && subjectId) {
    const table = presetsForDevice(device);
    if (table[subjectId]) return table[subjectId];
  }
  return GL_DEFAULTS_GREEN;
}

/** Returns v3 localStorage override if present, otherwise the built-in subject preset. */
export function getGLChromaParams(
  courseId?: string | null,
  subjectId?: string | null,
  device: Device = 'desktop',
): GLChromaParams {
  try {
    const raw = localStorage.getItem(glStorageKey(courseId, subjectId, device));
    if (raw) {
      const saved = JSON.parse(raw) as Partial<GLChromaParams>;
      const base = getGLChromaPreset(courseId, subjectId, device);
      return {
        presetName: `${base.presetName}-tuned`,
        similarity: typeof saved.similarity === 'number' ? saved.similarity : base.similarity,
        smoothness: typeof saved.smoothness === 'number' ? saved.smoothness : base.smoothness,
        spill: typeof saved.spill === 'number' ? saved.spill : base.spill,
        feather: typeof saved.feather === 'number' ? saved.feather : base.feather,
        choke: typeof saved.choke === 'number' ? saved.choke : base.choke,
      };
    }
  } catch (e) {
    console.warn('[chromaKeyPresets] failed to load tuned GL params', e);
  }
  return getGLChromaPreset(courseId, subjectId, device);
}

export function saveGLChromaParams(
  courseId: string | null | undefined,
  subjectId: string | null | undefined,
  params: GLChromaParams,
  device: Device = 'desktop',
): void {
  try {
    localStorage.setItem(glStorageKey(courseId, subjectId, device), JSON.stringify({
      similarity: params.similarity,
      smoothness: params.smoothness,
      spill: params.spill,
      feather: params.feather,
      choke: params.choke,
    }));
  } catch (e) {
    console.warn('[chromaKeyPresets] failed to save tuned GL params', e);
  }
}

export function clearGLChromaParams(
  courseId?: string | null,
  subjectId?: string | null,
  device: Device = 'desktop',
): void {
  try {
    localStorage.removeItem(glStorageKey(courseId, subjectId, device));
  } catch {/* ignore */}
}


// ─────────────────────────────────────────────────────────────────────────────
// Bridge: derive legacy HSL CPU params from new GL params + key RGB.
// Used by the CPU fallback path so the Ctrl+D sliders visibly affect the
// rendered avatar even when WebGL is unavailable.
// ─────────────────────────────────────────────────────────────────────────────

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

export function glToCpuParams(
  gl: GLChromaParams,
  keyColor: { r: number; g: number; b: number },
): ChromaKeyParams {
  const hsl = rgbToHsl(keyColor.r, keyColor.g, keyColor.b);
  // Map similarity (0..1) → hue band half-width (degrees). 0 → ~8°, 1 → ~80°.
  const hueHalfWidth = 8 + gl.similarity * 72;
  // Smoothness (0..0.5) → feather degrees (4..40)
  const feather = 4 + gl.smoothness * 72;
  // Spill (0..1) → spill threshold (low value = aggressive). Invert: 1 → 2, 0 → 20.
  const spillThreshold = Math.max(2, 20 - gl.spill * 18);
  // Choke (-0.1..0.1) → edge erode passes 0..4
  const erodePasses = Math.max(0, Math.round((gl.choke + 0.1) * 20));
  // Feather (0..0.5) → alpha ramp width
  const rampHigh = 8 + gl.feather * 80;

  return {
    presetName: `${gl.presetName}-cpu`,
    hueMin: Math.max(0, hsl.h - hueHalfWidth),
    hueMax: Math.min(360, hsl.h + hueHalfWidth),
    satMin: 0.08,
    lightMin: 0.05,
    lightMax: 0.92,
    feather,
    greenExcessThreshold: 4,
    grayThreshold: 16,
    spillThreshold,
    edgeErodePasses: erodePasses,
    alphaRampLow: 4,
    alphaRampHigh: rampHigh,
    edgeSmoothing: 0.6 + gl.smoothness,
    matteCleanup: 0.7 + gl.spill * 0.3,
  };
}

