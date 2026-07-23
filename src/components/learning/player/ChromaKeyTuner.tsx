import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  GLChromaParams,
  getGLChromaPreset,
  saveGLChromaParams,
  clearGLChromaParams,
  type Device,
} from './utils/chromaKeyPresets';
import { chromaLog } from './utils/chromaLog';

interface ChromaKeyTunerProps {
  open: boolean;
  onClose: () => void;
  courseId?: string | null;
  subjectId?: string | null;
  device?: Device;
  params: GLChromaParams;
  keyColor: { r: number; g: number; b: number };
  /** Auto-detected (or user-set) key color metadata for diagnostics display. */
  detected?: {
    r: number; g: number; b: number; hex: string;
    confidence: number;
    source: 'auto' | 'default' | 'user';
    trigger?: string;
    sampledAt: number;
    status?: 'accepted' | 'rejected';
    rejectReason?: string;
  };
  renderPath?: 'gpu' | 'cpu' | 'pending';
  onParamsChange: (next: GLChromaParams) => void;
  onKeyColorChange: (r: number, g: number, b: number) => void;
  getVideo: () => HTMLVideoElement | null;
  /** Optional portal container — used when the player is in browser fullscreen
   *  so the panel renders inside the fullscreen element (document.body would
   *  otherwise be hidden). */
  container?: HTMLElement | null;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

const stop = (e: React.SyntheticEvent) => {
  e.stopPropagation();
};

const SliderRow = ({ label, value, min, max, step, onChange }: SliderRowProps) => {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return (
    <div
      className="space-y-1.5"
      style={{ userSelect: 'auto', WebkitUserSelect: 'auto' }}
      onPointerDownCapture={stop}
      onMouseDownCapture={stop}
      onTouchStartCapture={stop}
      onClickCapture={stop}
    >
      <div className="flex items-center justify-between text-[12px]">
        <span className="text-slate-200 tracking-wide">{label}</span>
        <span className="text-cyan-400 font-mono tabular-nums">{value.toFixed(3)}</span>
      </div>
      <div className="relative h-6 flex items-center">
        <div className="absolute left-0 right-0 h-2 rounded-full bg-slate-700/70 pointer-events-none" />
        <div
          className="absolute left-0 h-2 rounded-full bg-emerald-400 pointer-events-none"
          style={{ width: `${pct * 100}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onInput={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
          onPointerDown={(e) => {
            stop(e);
            (e.target as HTMLInputElement).setPointerCapture?.(e.pointerId);
          }}
          onMouseDown={stop}
          onTouchStart={stop}
          onClick={stop}
          className="ckt-range relative w-full h-6 bg-transparent appearance-none cursor-pointer"
          style={{
            WebkitAppearance: 'none',
            touchAction: 'none',
            pointerEvents: 'auto',
            zIndex: 2,
          }}
        />
      </div>
    </div>
  );
};

export const ChromaKeyTuner = ({
  open, onClose, courseId, subjectId, device = 'desktop', params, renderPath = 'pending',
  onParamsChange, container, detected,
}: ChromaKeyTunerProps) => {
  // Log open/close transitions (debug, gated)
  useEffect(() => {
    chromaLog.debug(open ? 'tuner.open' : 'tuner.close', {
      detectedRgb: detected ? { r: detected.r, g: detected.g, b: detected.b } : null,
      confidence: detected ? +detected.confidence.toFixed(3) : null,
      source: detected?.source,
    });
  }, [open, detected]);

  const saveTimerRef = useRef<number | null>(null);

  // Debounced save — only persist when user has tuned the preset (name ends with -tuned).
  // Reset restores the pristine preset name, so we skip saving and the localStorage
  // override stays cleared.
  useEffect(() => {
    if (!open) return;
    if (!params.presetName.endsWith('-tuned')) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveGLChromaParams(courseId, subjectId, params, device);
    }, 200);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [params, courseId, subjectId, open, device]);

  // Escape closes the panel (alternative to the × button).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const update = (patch: Partial<GLChromaParams>) => {
    const name = params.presetName.endsWith('-tuned') ? params.presetName : `${params.presetName}-tuned`;
    onParamsChange({ ...params, ...patch, presetName: name });
  };

  const resetToPreset = () => {
    const base = getGLChromaPreset(courseId, subjectId, device);
    clearGLChromaParams(courseId, subjectId, device);
    onParamsChange(base);
  };

  const pathLabel =
    renderPath === 'gpu' ? 'GPU · WebGL'
    : renderPath === 'cpu' ? 'CPU fallback'
    : 'Initializing…';
  const pathDot =
    renderPath === 'gpu' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
    : renderPath === 'cpu' ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
    : 'bg-slate-500';

  const handleClose = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      (e as any).nativeEvent?.stopImmediatePropagation?.();
    }
    onClose();
  };

  const handleReset = (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
      (e as any).nativeEvent?.stopImmediatePropagation?.();
    }
    resetToPreset();
  };

  // Shared activation handler factory — fires on the FIRST event that
  // reaches us (pointerup/mouseup/touchend/click) and prevents the rest
  // from re-triggering. This is bullet-proof against parent handlers that
  // swallow click but let pointer events through.
  const makeActivator = (fn: (e: React.SyntheticEvent) => void) => {
    let fired = false;
    const reset = () => { setTimeout(() => { fired = false; }, 300); };
    return {
      onPointerUpCapture: (e: React.PointerEvent) => {
        if (fired) return;
        fired = true;
        fn(e);
        reset();
      },
      onClickCapture: (e: React.MouseEvent) => {
        if (fired) return;
        fired = true;
        fn(e);
        reset();
      },
      onTouchEndCapture: (e: React.TouchEvent) => {
        if (fired) return;
        fired = true;
        fn(e);
        reset();
      },
    };
  };

  const closeActivator = makeActivator(handleClose);
  const resetActivator = makeActivator(handleReset);

  return createPortal(
    <div
      data-chroma-tuner="true"
      className="fixed z-[9999] rounded-2xl border border-slate-700/60 bg-slate-900/95 backdrop-blur-md shadow-2xl text-slate-100
                 bottom-2 left-2 right-2 w-auto max-h-[75vh] overflow-y-auto
                 sm:bottom-6 sm:left-6 sm:right-auto sm:w-[340px] sm:max-h-none sm:overflow-visible"
      style={{
        fontFamily: 'ui-sans-serif, system-ui, -apple-system',
        userSelect: 'auto',
        WebkitUserSelect: 'auto',
        WebkitTouchCallout: 'default',
        touchAction: 'auto',
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
          <span className="text-[11px] tracking-[0.18em] text-slate-300 font-semibold">KEYING CONTROLS</span>
        </div>
        <button
          type="button"
          {...closeActivator}
          className="flex items-center justify-center min-w-[40px] min-h-[40px] -mr-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/60 active:bg-slate-700 text-lg leading-none cursor-pointer relative"
          style={{ touchAction: 'manipulation', pointerEvents: 'auto', zIndex: 10 }}
          aria-label="Close"
        >×</button>
      </div>


      <div className="px-4 pt-3 pb-2 flex items-center justify-between text-[10px] uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${pathDot}`} />
          <span className="text-slate-300">{pathLabel}</span>
        </div>
        <span
          className="font-mono text-slate-400 lowercase tracking-normal truncate max-w-[180px]"
          title={params.presetName}
        >
          {params.presetName}
        </span>
      </div>

      {detected && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-1.5">
            <span className="text-slate-300">Detected key color</span>
            <span className="text-slate-400 lowercase tracking-normal font-mono">
              {detected.source}{detected.confidence >= 0 ? ` · conf ${detected.confidence.toFixed(2)}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2.5 rounded-md bg-slate-800/60 border border-slate-700/60 px-2.5 py-2">
            <span
              className="inline-block h-6 w-6 rounded border border-slate-600 shrink-0"
              style={{ background: `rgb(${detected.r}, ${detected.g}, ${detected.b})` }}
            />
            <div className="flex-1 min-w-0 font-mono text-[11px] text-slate-200 tabular-nums">
              <div>RGB {detected.r}, {detected.g}, {detected.b}</div>
              <div className="text-slate-400">{detected.hex}{detected.trigger ? ` · ${detected.trigger}` : ''}</div>
              {detected.status && (
                <div className={detected.status === 'accepted' ? 'text-emerald-400' : 'text-amber-400'}>
                  Sample: {detected.status}
                  {detected.status === 'rejected' && detected.rejectReason ? ` (${detected.rejectReason})` : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pb-4 space-y-3 text-[12px]">

        <SliderRow label="Similarity"          value={params.similarity} min={0}    max={1}    step={0.01}  onChange={(v) => update({ similarity: v })} />
        <SliderRow label="Smoothness"          value={params.smoothness} min={0}    max={0.5}  step={0.01}  onChange={(v) => update({ smoothness: v })} />
        <SliderRow label="Spill Suppress"      value={params.spill}      min={0}    max={1}    step={0.01}  onChange={(v) => update({ spill: v })} />
        <SliderRow label="Edge Feather"        value={params.feather}    min={0}    max={0.5}  step={0.01}  onChange={(v) => update({ feather: v })} />
        <SliderRow label="Choke (shrink edge)" value={params.choke}      min={-0.1} max={0.1}  step={0.005} onChange={(v) => update({ choke: v })} />

        <button
          type="button"
          {...resetActivator}
          className="w-full min-h-[40px] mt-2 rounded-md bg-slate-700/60 hover:bg-slate-600/60 active:bg-slate-600 text-slate-100 text-[12px] font-medium cursor-pointer relative"
          style={{ touchAction: 'manipulation', pointerEvents: 'auto', zIndex: 10 }}
        >Reset to default</button>

      </div>
    </div>,
    container ?? document.body,
  );
};
