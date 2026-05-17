// domOverlayProbe.ts — scans the DOM for elements that may be covering the game canvas.
// Called every 3s from debugOverlay._dumpState() so that a stuck fade overlay is logged
// immediately rather than requiring DevTools inspection.
//
// A node is "covering suspect" if it: is positioned (fixed/absolute/sticky), is visible,
// has z-index >= 1000, has an opaque background, and its bounding rect covers >= 80% of
// the canvas (or viewport when no canvas reference is available).

export interface SuspectOverlay {
  selector: string;
  zIndex: number;
  opacity: number;
  bgColor: string;
  rect: { x: number; y: number; w: number; h: number };
  ageMs: number;    // from data-mounted-at attribute set by sceneManager; NaN if absent
  styleSummary: string;
}

const CANDIDATE_TAGS = 'div,section,main,aside,article,header,footer';
const WHITELIST_IDS = new Set(['oversteer-debug', 'oversteer-error-banner']);
const MAX_WALK = 500;
const MAX_RESULTS = 10;
const MIN_COVERAGE = 0.8;
const MIN_ZINDEX = 1000;

export function probeCoveringOverlays(canvas: HTMLCanvasElement | null): SuspectOverlay[] {
  if (!document.body) return [];

  const canvasRect = canvas ? canvas.getBoundingClientRect() : null;
  const refW = canvasRect?.width  || window.innerWidth;
  const refH = canvasRect?.height || window.innerHeight;
  const refX = canvasRect?.x      || 0;
  const refY = canvasRect?.y      || 0;
  const refArea = refW * refH;

  if (refArea === 0) return [];

  const candidates = Array.from(
    document.body.querySelectorAll<HTMLElement>(CANDIDATE_TAGS)
  ).slice(0, MAX_WALK);

  const suspects: SuspectOverlay[] = [];

  for (const el of candidates) {
    if (_isWhitelisted(el)) continue;

    const cs = getComputedStyle(el);

    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (!['fixed', 'absolute', 'sticky'].includes(cs.position)) continue;

    const opacity = parseFloat(cs.opacity);
    if (isNaN(opacity) || opacity <= 0.5) continue;

    const zIndex = parseInt(cs.zIndex, 10);
    if (isNaN(zIndex) || zIndex < MIN_ZINDEX) continue;

    if (!_isOpaqueBackground(cs)) continue;

    const rect = el.getBoundingClientRect();
    const intersection = _intersection(rect, { x: refX, y: refY, w: refW, h: refH });
    if (intersection < MIN_COVERAGE * refArea) continue;

    const mountedAt = el.dataset.mountedAt;
    const ageMs = mountedAt ? performance.now() - parseFloat(mountedAt) : NaN;

    suspects.push({
      selector: _selector(el),
      zIndex,
      opacity,
      bgColor: cs.backgroundColor,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      ageMs,
      styleSummary: _styleSummary(cs),
    });

    if (suspects.length >= MAX_RESULTS) break;
  }

  // Oldest (largest ageMs) first; NaN floats to end.
  suspects.sort((a, b) => {
    if (isNaN(a.ageMs) && isNaN(b.ageMs)) return 0;
    if (isNaN(a.ageMs)) return 1;
    if (isNaN(b.ageMs)) return -1;
    return b.ageMs - a.ageMs;
  });

  return suspects;
}

function _isWhitelisted(el: HTMLElement): boolean {
  if (WHITELIST_IDS.has(el.id)) return true;
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    if (WHITELIST_IDS.has(node.id)) return true;
    node = node.parentElement;
  }
  return false;
}

function _isOpaqueBackground(cs: CSSStyleDeclaration): boolean {
  const color = cs.backgroundColor;
  if (!color || color === 'transparent') return false;

  // Parse rgba?(r,g,b[,a]) — browsers always normalize to this form.
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map(Number);
    const alpha = parts.length >= 4 ? parts[3] : 1;
    if (alpha >= 0.5) return true;
  }

  // If background-image is set (gradient, url), count it as opaque.
  if (cs.backgroundImage && cs.backgroundImage !== 'none') return true;

  return false;
}

function _intersection(
  a: DOMRect,
  b: { x: number; y: number; w: number; h: number },
): number {
  const ix = Math.max(0, Math.min(a.right,  b.x + b.w) - Math.max(a.left, b.x));
  const iy = Math.max(0, Math.min(a.bottom, b.y + b.h) - Math.max(a.top,  b.y));
  return ix * iy;
}

function _selector(el: HTMLElement): string {
  let s = el.tagName.toLowerCase();
  if (el.id) s += `#${el.id}`;
  if (el.className && typeof el.className === 'string') {
    s += '.' + el.className.trim().split(/\s+/).join('.');
  }
  return s.slice(0, 80);
}

function _styleSummary(cs: CSSStyleDeclaration): string {
  const parts = [
    `position:${cs.position}`,
    cs.inset && cs.inset !== 'auto' ? `inset:${cs.inset}` : `top:${cs.top};left:${cs.left};right:${cs.right};bottom:${cs.bottom}`,
    `background-color:${cs.backgroundColor}`,
    `opacity:${cs.opacity}`,
    `z-index:${cs.zIndex}`,
  ];
  return parts.join(';').slice(0, 120);
}
