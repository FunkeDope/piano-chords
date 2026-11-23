// Page interactions that aren't about the music: linking sheet <-> cards on hover/tap, the peek card,
// popover placement, the inversion tooltip, and moving the toolbar into a panel on phones.
import * as Practice from './practice.js';
import { $, store, MOBILE, isMobile } from './util.js';

// ---- hover/tap link between sheet and cards ----
// lights up every place a chord is played (and its card), dims the rest
function lightUp(t) {
  const c = t ? t.dataset.c : null;
  document.body.classList.toggle('from-card', !!t && t.classList.contains('card'));
  document.querySelectorAll('[data-c]').forEach(el => el.classList.toggle('on', !!c && el.dataset.c === c));
}
// the tapped chord's diagram pops up when its card is scrolled off screen (or hidden)
function peek(c) {
  const box = $('peek');
  if (!c) { box.hidden = true; box.innerHTML = ''; return; }
  const card = document.querySelector(`#cards .card[data-c="${CSS.escape(c)}"]`); if (!card) { box.hidden = true; return; }
  const r = card.getBoundingClientRect(), seen = card.offsetParent && r.top >= 0 && r.bottom <= innerHeight;
  if (seen) { box.hidden = true; return; }
  box.innerHTML = '<div class="grip" aria-hidden="true"><span></span></div>' + card.outerHTML + '<div class="rsz" title="Drag to resize" aria-hidden="true"></div>'; box.querySelector('.card').classList.remove('on'); box.hidden = false;
  placePeek();
}

// ---- the peek card: drag to move it, pinch (or drag its corner) to resize it; both are remembered ----
let peekPos = store.getJSON('peekPos', null);   // {x, y} of the top-left corner, or null = default spot
let peekW = store.getJSON('peekW', null);       // width in px, or null = default width
const PEEK_MIN = 180;
// apply the saved width (kept on screen) and return it
function applyPeekW() {
  const box = $('peek'); if (!peekW) return box.offsetWidth;
  peekW = Math.max(PEEK_MIN, Math.min(peekW, innerWidth - 8)); box.style.width = peekW + 'px'; return peekW;
}
function placePeek() {
  const box = $('peek'); if (box.hidden) return;
  applyPeekW(); if (!peekPos) return;
  const w = box.offsetWidth, h = box.offsetHeight;
  peekPos.x = Math.max(4, Math.min(peekPos.x, innerWidth - w - 4)); peekPos.y = Math.max(4, Math.min(peekPos.y, innerHeight - h - 4));
  box.classList.add('moved'); box.style.left = peekPos.x + 'px'; box.style.top = peekPos.y + 'px';
}
function initPeekGestures() {
  const box = $('peek'), pts = new Map();   // pointerId -> {x, y} for every finger on the card
  let mode = null, moved = false, start = null;
  const rect = () => { const r = box.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  const pair = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; };
  // (re)start a gesture from the fingers that are down now
  const begin = onHandle => {
    start = { box: rect(), p: { ...[...pts.values()][0] } };
    if (pts.size >= 2) { mode = 'pinch'; start.pair = pair(); } else mode = onHandle ? 'resize' : 'drag';
  };
  box.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    box.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) moved = false;
    begin(!!e.target.closest('.rsz'));
  });
  box.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const s = start.box;
    if (mode === 'pinch') {
      const t = pair(), s2 = start.pair;
      if (!moved && Math.abs(t.d - s2.d) < 6 && Math.hypot(t.cx - s2.cx, t.cy - s2.cy) < 6) return;
      peekW = s.w * t.d / s2.d; const w = applyPeekW(), h = box.offsetHeight;
      // keep the spot between your fingers under your fingers
      peekPos = { x: t.cx - (s2.cx - s.x) / s.w * w, y: t.cy - (s2.cy - s.y) / s.h * h };
    } else {
      const p = pts.get(e.pointerId), dx = p.x - start.p.x, dy = p.y - start.p.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;   // small wobble = still a tap (tap closes it)
      if (mode === 'resize') { peekW = s.w + dx; peekPos = { x: s.x, y: s.y }; }
      else peekPos = { x: s.x + dx, y: s.y + dy };
    }
    moved = true; box.classList.add('dragging'); placePeek();
  });
  const end = e => {
    if (!pts.delete(e.pointerId)) return;
    if (pts.size) { begin(false); return; }   // one finger still down after a pinch: keep dragging with it
    box.classList.remove('dragging');
    if (moved) { store.setJSON('peekPos', peekPos); if (peekW) store.setJSON('peekW', Math.round(peekW)); }
  };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end);
  // a drag or pinch ends with a click: swallow it so the card stays open
  box.addEventListener('click', e => { if (moved) { e.stopPropagation(); moved = false; } });
  // double-tap the grip to put it back: default spot and size
  box.addEventListener('dblclick', e => {
    if (!e.target.closest('.grip')) return;
    peekPos = peekW = null; store.remove('peekPos'); store.remove('peekW');
    box.classList.remove('moved'); box.style.left = box.style.top = box.style.width = '';
  });
  addEventListener('resize', placePeek);
}
function initChordLinks() {
  document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse') lightUp(e.target.closest('.ch,.ly,.card')); });
  // touch: tap a chord, a lyric or a card to light it up everywhere; tap it again (or anywhere else) to clear.
  // In practice mode a tap on the sheet moves the dock instead (see practice.js).
  let tapped = null;
  document.addEventListener('click', e => {
    if (e.pointerType === 'mouse' || e.target.closest('button,input,label,[popover],#dock')) return;
    const t = e.target.closest('.ch,.ly,.card');
    if (t && Practice.isOpen() && t.closest('#sheet')) return;
    if (e.target.closest('#peek')) { peek(null); tapped = null; lightUp(null); return; }
    const c = t ? t.dataset.c : null;
    if (!c || c === tapped) { tapped = null; lightUp(null); peek(null); }
    else { tapped = c; lightUp(t); peek(t.classList.contains('card') ? null : c); }
  });
}

// ---- popovers open just under the button that opened it, fully on screen ----
function initPopovers() {
  document.querySelectorAll('[popover]').forEach(pop => pop.addEventListener('toggle', e => {
    if (e.newState !== 'open') return;
    if (isMobile()) { pop.style.cssText = ''; return; }   // phones: CSS shows it as a bottom sheet
    const btn = document.querySelector(`[popovertarget=${pop.id}]`).getBoundingClientRect();
    pop.style.maxHeight = (innerHeight - 24) + 'px'; pop.style.overflow = 'auto';
    const w = pop.offsetWidth, h = pop.offsetHeight, left = Math.min(Math.max(12, btn.right - w), innerWidth - w - 12);
    const top = Math.max(12, Math.min(btn.bottom + 6, innerHeight - h - 12));   // keep the whole box (and its Render button) on screen
    Object.assign(pop.style, { position: 'fixed', inset: 'auto', top: top + 'px', left: left + 'px' });
  }));
  // buttons drop focus after a click so Space / arrows keep working as shortcuts
  document.addEventListener('click', e => { const b = e.target.closest('button'); if (b && !b.hasAttribute('popovertarget')) b.blur(); });
}

// ---- ⇄ inversion tooltip: hover on desktop, tap to pin on touch ----
function initTooltip() {
  const tip = $('tip'); let pinned = null;
  const show = b => {
    tip.textContent = b.dataset.why; tip.hidden = false; const r = b.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(r.right - w, innerWidth - w - 8)) + 'px'; tip.style.top = (r.bottom + 8 + h > innerHeight ? r.top - h - 8 : r.bottom + 8) + 'px';
  };
  const hide = () => { tip.hidden = true; pinned = null; };
  document.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse') return; const b = e.target.closest('.inv-ic'); if (b) show(b); else if (!pinned) tip.hidden = true; });
  document.addEventListener('click', e => { const b = e.target.closest('.inv-ic'); if (b) { e.stopPropagation(); if (pinned === b) hide(); else { show(b); pinned = b; } } else if (pinned) hide(); }, true);
  addEventListener('scroll', () => { if (pinned) hide(); }, { passive: true });
}

// ---- phones: the playback controls, song facts and key bar move into the Controls sheet ----
function initMobileControls() {
  const pop = $('ctlPop');
  // remember where each part lives on desktop so it can go back there
  const parts = [document.querySelector('.bar'), document.querySelector('.meta'), $('trBar')].map(el => ({ el, parent: el.parentNode, next: el.nextElementSibling }));
  const mq = matchMedia(MOBILE);
  const place = () => {
    if (mq.matches) pop.append(...parts.map(p => p.el));
    else { [...parts].reverse().forEach(p => p.parent.insertBefore(p.el, p.next)); try { pop.hidePopover(); } catch (e) {} }
  };
  mq.addEventListener('change', place); place();
  // anything that starts something (play, practice, songs, settings) closes the panel first
  pop.addEventListener('click', e => { const b = e.target.closest('#play,#pBtn,#pasteBtn,[popovertarget=setPop]'); if (b) try { pop.hidePopover(); } catch (_) {} }, true);
}

export function initUI() {
  initChordLinks();
  initPeekGestures();
  initPopovers();
  initTooltip();
  initMobileControls();
}
