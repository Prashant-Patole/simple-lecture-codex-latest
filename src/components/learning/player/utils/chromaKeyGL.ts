/**
 * WebGL chroma-key renderer — YCbCr distance + smoothstep + spill suppression
 * + edge feather + choke. Ported from the standard SimpleChromaKey shader.
 *
 * Key color is set per-video (auto-detected from corner pixels of the first
 * frame). Slider params come from GLChromaParams (subject-scoped, tunable
 * via Ctrl+D panel).
 */

import { GLChromaParams, GL_DEFAULTS_GREEN } from './chromaKeyPresets';

const VERTEX_SHADER = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

// YCbCr distance from key color → smoothstep alpha → spill suppression.
// Exactly mirrors the standard "soft chroma key" shader used in OBS / Streamlabs.
const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D u_video;
uniform vec3  u_keyColor;     // RGB 0..1
uniform float u_similarity;   // 0..1
uniform float u_smoothness;   // 0..0.5
uniform float u_spill;        // 0..1
uniform float u_feather;      // 0..0.5  (extends cut inward)
uniform float u_choke;        // -0.1..0.1 (shrink/expand matte)
varying vec2 v_texCoord;

// Convert RGB → CbCr (Rec. 601)
vec2 rgb2cbcr(vec3 c) {
  float y  = dot(c, vec3(0.299, 0.587, 0.114));
  float cb = c.b - y;
  float cr = c.r - y;
  return vec2(cb, cr);
}

void main() {
  vec4 src = texture2D(u_video, v_texCoord);

  vec2 keyCbCr = rgb2cbcr(u_keyColor);
  vec2 pxCbCr  = rgb2cbcr(src.rgb);
  float dist   = distance(pxCbCr, keyCbCr);

  // Soft alpha ramp around similarity threshold (key-color matte)
  float lo = max(0.0, u_similarity - u_feather + u_choke);
  float hi = max(lo + 0.001, u_similarity + u_smoothness);
  float keyAlpha = smoothstep(lo, hi, dist);

  float luma = dot(src.rgb, vec3(0.299, 0.587, 0.114));
  float maxRB = max(src.r, src.b);
  float gDom = src.g - maxRB; // signed RGB green-dominance, -1..1

  // ── Hue-based green matte (independent of sampled key color) ──
  // Cuts ANY pixel that is clearly green-dominant, regardless of luma.
  // Catches dark checkerboard tiles + bright halo edges that the single-key
  // matte misses on high-variance backgrounds (e.g. Maths).
  float hueCut = smoothstep(0.020, 0.10, gDom);
  // Require g to be the clear max (skin highlights have high g but also high r).
  float greenIsMax = step(0.0, src.g - max(src.r, src.b) - 0.02);
  float hueAlpha = hueCut * greenIsMax;

  // Combine mattes — whichever cuts more wins (lower alpha = more transparent).
  float alpha = min(keyAlpha, 1.0 - hueAlpha);

  // ── Body-protection guard ──
  // Only let the matte cut pixels that are CLEARLY green-dominant. Prevents
  // dark shirt/hair/neck/shadow pixels from being erased when the sampled
  // key color is itself dark/muddy and chromatically near them.
  float greenGate = smoothstep(0.02, 0.10, gDom);
  float darkBodyProtect = (1.0 - greenGate) * (1.0 - smoothstep(0.10, 0.35, luma));
  alpha = mix(alpha, 1.0, darkBodyProtect);
  // Never fully cut a pixel that isn't green-dominant at all.
  alpha = mix(1.0, alpha, greenGate);

  // Tiny inward choke — eats the 1-px green fringe without producing a
  // hard stairstep, since the underlying matte is already soft.
  alpha = smoothstep(0.05, 0.95, alpha);

  // Spill suppression on green-dominant pixels (alpha-independent so opaque
  // AND dark halo pixels around the avatar get desaturated). Skin/suit
  // untouched because their greenDominance ≈ 0.
  float greenDominance = clamp((gDom - 0.020) / 0.30, 0.0, 1.0);
  float spillStrength = pow(greenDominance, 0.6);   // no luma gate — kills dark rim
  float spillFactor = clamp(spillStrength * (u_spill * 2.0 + 0.5), 0.0, 1.0);
  vec3 desat = vec3(luma);
  vec3 cleaned = mix(src.rgb, desat, spillFactor);

  // Premultiplied output
  gl_FragColor = vec4(cleaned * alpha, alpha);
}
`;

export interface ChromaKeyGL {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  renderFrame: (video: HTMLVideoElement) => void;
  setParams: (params: GLChromaParams) => void;
  setKeyColor: (r: number, g: number, b: number) => void; // 0-255
  getKeyColor: () => { r: number; g: number; b: number };
  destroy: () => void;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('[ChromaKeyGL] Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function initChromaKeyGL(canvas: HTMLCanvasElement): ChromaKeyGL | null {
  const gl = (canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true })
    || canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true })) as WebGLRenderingContext | null;
  if (!gl) {
    console.warn('[ChromaKeyGL] WebGL unavailable');
    return null;
  }

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[ChromaKeyGL] Program link error:', gl.getProgramInfoLog(program));
    return null;
  }
  gl.useProgram(program);

  // Fullscreen quad
  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]);

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const texBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texBuf);
  gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
  const aTex = gl.getAttribLocation(program, 'a_texCoord');
  gl.enableVertexAttribArray(aTex);
  gl.vertexAttribPointer(aTex, 2, gl.FLOAT, false, 0, 0);

  const texture = gl.createTexture();
  if (!texture) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.enable(gl.BLEND);
  // Premultiplied alpha blend
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const uKeyColor    = gl.getUniformLocation(program, 'u_keyColor');
  const uSimilarity  = gl.getUniformLocation(program, 'u_similarity');
  const uSmoothness  = gl.getUniformLocation(program, 'u_smoothness');
  const uSpill       = gl.getUniformLocation(program, 'u_spill');
  const uFeather     = gl.getUniformLocation(program, 'u_feather');
  const uChoke       = gl.getUniformLocation(program, 'u_choke');

  let keyR = 0, keyG = 177, keyB = 64;

  const applyKeyColor = () => {
    gl.uniform3f(uKeyColor, keyR / 255, keyG / 255, keyB / 255);
  };

  const setParams = (p: GLChromaParams) => {
    gl.useProgram(program);
    gl.uniform1f(uSimilarity, p.similarity);
    gl.uniform1f(uSmoothness, p.smoothness);
    gl.uniform1f(uSpill,      p.spill);
    gl.uniform1f(uFeather,    p.feather);
    gl.uniform1f(uChoke,      p.choke);
  };

  const setKeyColor = (r: number, g: number, b: number) => {
    keyR = r; keyG = g; keyB = b;
    gl.useProgram(program);
    applyKeyColor();
  };

  const getKeyColor = () => ({ r: keyR, g: keyG, b: keyB });

  // Init with defaults
  setParams(GL_DEFAULTS_GREEN);
  applyKeyColor();

  let lastW = 0, lastH = 0;

  const renderFrame = (video: HTMLVideoElement) => {
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (w !== lastW || h !== lastH) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      lastW = w; lastH = h;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    } catch {
      return; // video not ready
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const destroy = () => {
    gl.deleteTexture(texture);
    gl.deleteBuffer(posBuf);
    gl.deleteBuffer(texBuf);
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
  };

  return { gl, program, renderFrame, setParams, setKeyColor, getKeyColor, destroy };
}
