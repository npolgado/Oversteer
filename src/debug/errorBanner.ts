// errorBanner.ts — DOM red error banner pinned to the top of the page.
// Revealed automatically by logError(); user can dismiss per-entry or clear all.
// z-index: 2147483647 ensures it appears above every other overlay in the app,
// including the _domFadeIn div at z-index 99990 in sceneManager.ts.

const MAX_RING = 50;
const MAX_VISIBLE = 5;
const BANNER_ID = 'oversteer-error-banner';

export interface BannerEntry {
  id: number;
  ts: number;
  tag: string;
  msg: string;
  dismissed: boolean;
}

export interface BannerState {
  entries: BannerEntry[];
  visible: boolean;
}

let _el: HTMLDivElement | null = null;
let _visible = false;
let _entries: BannerEntry[] = [];
let _nextId = 0;

export function initErrorBanner(): void {
  if (_el) return;
  _el = document.createElement('div');
  _el.id = BANNER_ID;
  _el.style.cssText = [
    'position:fixed',
    'top:0',
    'left:0',
    'right:0',
    'z-index:2147483647',
    'background:rgba(160,16,16,0.96)',
    'color:#fff',
    'font:12px/1.5 "Courier New",monospace',
    'padding:0',
    'border-bottom:2px solid #ff4040',
    'max-height:40vh',
    'overflow-y:auto',
    'pointer-events:auto',
    'display:none',
    'transform:translateY(-100%)',
    'transition:transform 0.2s ease',
  ].join(';');
  document.body.appendChild(_el);
}

export function pushError(tag: string, msg: string): void {
  if (!_el) return;
  const entry: BannerEntry = {
    id: _nextId++,
    ts: performance.now() / 1000,
    tag,
    msg: msg.split('\n')[0],
    dismissed: false,
  };
  _entries.push(entry);
  if (_entries.length > MAX_RING) _entries.shift();
  _show();
  _render();
}

export function clearErrors(): void {
  for (const e of _entries) e.dismissed = true;
  _hide();
}

export function getBannerState(): BannerState {
  return { entries: [..._entries], visible: _visible };
}

function _show(): void {
  if (_visible || !_el) return;
  _visible = true;
  _el.style.display = 'block';
  requestAnimationFrame(() => {
    if (_el) _el.style.transform = 'translateY(0)';
  });
}

function _hide(): void {
  if (!_visible || !_el) return;
  _visible = false;
  _el.style.transform = 'translateY(-100%)';
  setTimeout(() => {
    if (!_visible && _el) _el.style.display = 'none';
  }, 250);
}

function _render(): void {
  if (!_el) return;
  const active = _entries.filter(e => !e.dismissed);
  const visible = active.slice(-MAX_VISIBLE);
  const overflow = active.length - visible.length;

  const rows = visible.map(e => {
    const ts = e.ts.toFixed(2);
    const summary = `[${ts}] [${e.tag}] ${e.msg}`;
    return (
      `<div style="display:flex;justify-content:space-between;align-items:flex-start;` +
      `padding:4px 12px;border-bottom:1px solid #900" data-entry-id="${e.id}">` +
      `<span style="flex:1;word-break:break-all">${_esc(summary)}</span>` +
      `<button data-dismiss="${e.id}" style="background:none;border:none;color:#ff8080;` +
      `cursor:pointer;padding:0 0 0 8px;font-size:14px;flex-shrink:0">&#x2715;</button>` +
      `</div>`
    );
  }).join('');

  const overflowLine = overflow > 0
    ? `<div style="padding:2px 12px;font-size:11px;color:#ffaaaa">... and ${overflow} more (see logs/game.log)</div>`
    : '';

  _el.innerHTML =
    `<div style="display:flex;justify-content:space-between;align-items:center;` +
    `padding:4px 12px;background:rgba(120,0,0,0.98);font-weight:bold">` +
    `<span>&#x26A0; OVERSTEER ERROR (${active.length})</span>` +
    `<button id="oversteer-error-clear" style="background:none;border:1px solid #ff8080;` +
    `color:#ff8080;cursor:pointer;padding:2px 8px;font-size:11px">clear all</button>` +
    `</div>` +
    rows +
    overflowLine;

  _el.querySelectorAll('[data-dismiss]').forEach(btn => {
    btn.addEventListener('click', (ev) => {
      const id = Number((ev.currentTarget as HTMLElement).getAttribute('data-dismiss'));
      const entry = _entries.find(x => x.id === id);
      if (entry) entry.dismissed = true;
      if (_entries.filter(x => !x.dismissed).length === 0) {
        _hide();
      } else {
        _render();
      }
    });
  });

  const clearBtn = _el.querySelector('#oversteer-error-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => clearErrors());
  }
}

function _esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Resets all module state — for use in tests only.
export function _resetBannerForTest(): void {
  _entries = [];
  _nextId = 0;
  _visible = false;
  if (_el) {
    _el.style.display = 'none';
    _el.style.transform = 'translateY(-100%)';
    _el.innerHTML = '';
  }
}
