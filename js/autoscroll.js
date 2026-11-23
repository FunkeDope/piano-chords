// Auto-scroll: the page creeps down at a steady speed so you can play hands-free.
import { $, store } from './util.js';
import { PLAY_ICON, PAUSE_ICON } from './icons.js';

const btn = $('play'), sp = $('sp'), out = $('spo');
// slider 0-100 maps exponentially to 4-80 px/s: every step is ~3% faster, fine control at the slow end
const MIN = 4, MAX = 80, speed = () => MIN * Math.pow(MAX / MIN, sp.value / 100);

let on = false, last = 0, pos = 0, raf = 0;

function show() { const v = speed(); out.textContent = (v < 10 ? v.toFixed(1) : Math.round(v)) + ' px/s'; store.set('sp2', sp.value); }
export function nudge(d) { sp.value = Math.max(0, Math.min(100, +sp.value + d)); show(); }

function set(v) {
  on = v; btn.classList.toggle('on', v); btn.innerHTML = v ? PAUSE_ICON : PLAY_ICON; btn.setAttribute('aria-label', v ? 'Stop auto-scroll' : 'Start auto-scroll');
  cancelAnimationFrame(raf); if (v) { last = 0; pos = scrollY; raf = requestAnimationFrame(step); }
}
function step(t) {
  if (Math.abs(scrollY - pos) > 3) pos = scrollY;                      // user scrolled by hand: carry on from there
  if (last) { pos += (t - last) / 1000 * speed(); window.scrollTo(0, pos); } // fractional position = smooth at slow speeds
  last = t;
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 1) { set(false); return; }
  raf = requestAnimationFrame(step);
}

export const toggle = () => set(!on);
export const stop = () => { if (on) set(false); };

export function initAutoScroll() {
  const v = store.get('sp2'); if (v !== null) sp.value = v;
  sp.addEventListener('input', show); show();
  $('spd').addEventListener('click', () => nudge(-2));
  $('spu').addEventListener('click', () => nudge(2));
}
