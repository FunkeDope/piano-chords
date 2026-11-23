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
  box.innerHTML = '<div class="grip" aria-hidden="true"><span></span></div>' + card.outerHTML; box.querySelector('.card').classList.remove('on'); box.hidden = false;
  placePeek();
}

// ---- the peek card can be dragged anywhere; its spot is remembered ----
let peekPos = store.getJSON('peekPos', null);   // {x, y} of the top-left corner, or null = default spot
function placePeek() {
  const box = $('peek'); if (!peekPos || box.hidden) return;
  const w = box.offsetWidth, h = box.offsetHeight;
  peekPos.x = Math.max(4, Math.min(peekPos.x, innerWidth - w - 4)); peekPos.y = Math.max(4, Math.min(peekPos.y, innerHeight - h - 4));
  box.classList.add('moved'); box.style.left = peekPos.x + 'px'; box.style.top = peekPos.y + 'px';
}
function initPeekDrag() {
  const box = $('peek'); let dragged = false;
  box.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    const r = box.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top, sx = e.clientX, sy = e.clientY;
    dragged = false; box.setPointerCapture(e.pointerId);
    const move = ev => {
      if (!dragged && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;   // small wobble = still a tap (tap closes it)
      dragged = true; box.classList.add('dragging');
      peekPos = { x: ev.clientX - ox, y: ev.clientY - oy }; placePeek();
    };
    const up = () => {
      box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', up); box.removeEventListener('pointercancel', up);
      box.classList.remove('dragging'); if (dragged) store.setJSON('peekPos', peekPos);
    };
    box.addEventListener('pointermove', move); box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  });
  // a drag ends with a click: swallow it so the card stays open
  box.addEventListener('click', e => { if (dragged) { e.stopPropagation(); dragged = false; } });
  // double-tap the grip to put it back in its default spot
  box.addEventListener('dblclick', e => { if (!e.target.closest('.grip')) return; peekPos = null; store.remove('peekPos'); box.classList.remove('moved'); box.style.left = box.style.top = ''; });
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
  initPeekDrag();
  initPopovers();
  initTooltip();
  initMobileControls();
}
