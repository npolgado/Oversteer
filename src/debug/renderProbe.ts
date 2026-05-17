// renderProbe.ts — samples pixels from the Pixi canvas to detect blank/black-screen states.
//
// Previous debug dumps reported `overlay α=1.0 ch=5` even when the user saw a
// completely black title screen. The gap: the engine *thinks* it drew content,
// but the GPU output is empty. Reading back a handful of pixels from the canvas
// is the only way to verify "did real pixels reach the screen".
//
// We sample 5 points: center + 4 quadrant centers. If every sample matches the
// canvas clear color, the renderer drew nothing visible. We do not do a full
// histogram — that's too expensive for a periodic dump.
//
// Cost: one getImageData(1×1) per sample. ~5 × ~0.05 ms on desktop GPUs. We
// only call this from the 3s state dump and once after first paint, so the
// overhead is negligible.

export interface PixelSample {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface RenderProbeReport {
  ok: boolean;            // false if canvas missing or all samples match clear color
  reason: string;         // 'ok', 'no-canvas', 'zero-size', 'all-clear', 'read-failed'
  canvasW: number;
  canvasH: number;
  samples: PixelSample[];
  clearColorHex: string;  // expected canvas background — what "blank" looks like
  uniqueColors: number;   // distinct hex colors among 5 samples; 1 = single-color screen
}

// PixiApp uses backgroundColor: 0x07080b — what "no drawing happened" looks like
// at the GPU level. We tolerate ±2 per channel for compression artifacts.
const CLEAR_R = 0x07;
const CLEAR_G = 0x08;
const CLEAR_B = 0x0b;
const TOLERANCE = 2;

function _isClear(p: PixelSample): boolean {
  return Math.abs(p.r - CLEAR_R) <= TOLERANCE
      && Math.abs(p.g - CLEAR_G) <= TOLERANCE
      && Math.abs(p.b - CLEAR_B) <= TOLERANCE;
}

export function probeRenderOutput(canvas: HTMLCanvasElement | null): RenderProbeReport {
  const clearHex = `#${CLEAR_R.toString(16).padStart(2, '0')}${CLEAR_G.toString(16).padStart(2, '0')}${CLEAR_B.toString(16).padStart(2, '0')}`;
  const empty = (reason: string, w = 0, h = 0): RenderProbeReport => ({
    ok: false, reason, canvasW: w, canvasH: h, samples: [], clearColorHex: clearHex, uniqueColors: 0,
  });

  if (!canvas) return empty('no-canvas');
  const w = canvas.width, h = canvas.height;
  if (w === 0 || h === 0) return empty('zero-size', w, h);

  // Try to read via a 2D context. Pixi uses WebGL, so we have to draw the
  // canvas into a 2D scratch and read from there.
  let img: ImageData;
  try {
    const scratch = document.createElement('canvas');
    scratch.width = w; scratch.height = h;
    const ctx = scratch.getContext('2d');
    if (!ctx) return empty('read-failed', w, h);
    ctx.drawImage(canvas, 0, 0);
    img = ctx.getImageData(0, 0, w, h);
  } catch (_) {
    return empty('read-failed', w, h);
  }

  // Center-column samples cover vertically-centered UI (title at ~35%, prompt at ~62%).
  // Quadrant samples cover gameplay content that spans the full canvas.
  const cx = Math.floor(w / 2);
  const points: Array<{ x: number; y: number }> = [
    { x: cx,                   y: Math.floor(h * 0.35) }, // title row
    { x: cx,                   y: Math.floor(h / 2)    }, // center
    { x: cx,                   y: Math.floor(h * 0.62) }, // sub-title / prompt row
    { x: Math.floor(w / 4),    y: Math.floor(h / 4)    }, // quadrant TL
    { x: Math.floor(3 * w / 4), y: Math.floor(h / 4)   }, // quadrant TR
    { x: Math.floor(w / 4),    y: Math.floor(3 * h / 4) }, // quadrant BL
    { x: Math.floor(3 * w / 4), y: Math.floor(3 * h / 4) }, // quadrant BR
  ];
  const samples: PixelSample[] = points.map(({ x, y }) => {
    const i = (y * w + x) * 4;
    return { x, y, r: img.data[i], g: img.data[i + 1], b: img.data[i + 2], a: img.data[i + 3] };
  });

  const allClear = samples.every(_isClear);
  const seenColors = new Set<string>();
  for (const p of samples) seenColors.add(`#${p.r.toString(16).padStart(2, '0')}${p.g.toString(16).padStart(2, '0')}${p.b.toString(16).padStart(2, '0')}`);
  return {
    ok: !allClear,
    reason: allClear ? 'all-clear' : 'ok',
    canvasW: w, canvasH: h, samples, clearColorHex: clearHex,
    uniqueColors: seenColors.size,
  };
}

export function formatRenderProbe(r: RenderProbeReport): string {
  if (r.reason === 'no-canvas') return 'render: NO CANVAS';
  if (r.reason === 'zero-size') return `render: ZERO SIZE  canvas=${r.canvasW}x${r.canvasH}`;
  if (r.reason === 'read-failed') return `render: READ FAILED  canvas=${r.canvasW}x${r.canvasH}`;
  if (r.reason === 'all-clear') {
    const s = r.samples.map(p => `(${p.x},${p.y})=#${p.r.toString(16).padStart(2, '0')}${p.g.toString(16).padStart(2, '0')}${p.b.toString(16).padStart(2, '0')}`).join(' ');
    return `render: BLANK — all 5 samples match clear ${r.clearColorHex}  ${s}`;
  }
  // OK case: include unique colors so the user can verify content moved
  const colorStrs = r.samples.map(p => `#${p.r.toString(16).padStart(2, '0')}${p.g.toString(16).padStart(2, '0')}${p.b.toString(16).padStart(2, '0')}`);
  const uniqueSet = Array.from(new Set(colorStrs));
  const uc = r.uniqueColors ?? uniqueSet.length; // fallback for reports constructed without the field
  return `render: OK  canvas=${r.canvasW}x${r.canvasH}  uniqueColors=${uc}  [${uniqueSet.join(' ')}]`;
}
