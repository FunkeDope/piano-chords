// Settings popover: text size, lyric colouring, chord card size, colour key, and the screen wake lock.
import { PC, ROOT_HUE } from './theory.js';
import { $, store } from './util.js';

// a range slider that sets a CSS variable and shows its value; remembered per slider id
function bindSlider(id, out, prop, unit) {
  const el = $(id), o = $(out);
  const set = () => { document.documentElement.style.setProperty(prop, el.value + unit); o.textContent = el.value + unit; store.set(id, el.value); };
  const v = store.get(id); if (v) el.value = v;
  el.addEventListener('input', set); set();
}

// keep the screen awake while the sheet is open (re-acquired whenever the tab comes back into view)
let wakeLock = null;
function wlShow(on, msg) { const e = $('wlStat'); if (!e) return; e.textContent = on ? 'Screen stays awake: on' : 'Screen stays awake: off. ' + msg; e.classList.toggle('bad', !on); }
async function keepAwake() {
  if (!('wakeLock' in navigator)) { wlShow(false, `Chrome doesn't offer it on this page (secure context: ${window.isSecureContext}).`); return; }
  if (document.visibilityState !== 'visible' || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen'); wlShow(true);
    wakeLock.addEventListener('release', () => { wakeLock = null; wlShow(false, 'Released when the page was hidden; tap the page to turn it back on.'); });
  } catch (e) { wakeLock = null; wlShow(false, `Chrome said: ${e.name}: ${e.message}`); }
}

export function initSettings() {
  bindSlider('ts', 'tso', '--text', 'px');
  bindSlider('cs', 'cso', '--cw', 'px');
  $('hueKey').innerHTML = ['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(n => `<span style="background:oklch(.8 .15 ${ROOT_HUE[PC[n]]})">${n}</span>`).join('');

  const lc = $('lc'), v = store.get('lc'); if (v !== null) lc.checked = v === '1';
  const setLc = () => { document.body.classList.toggle('plain', !lc.checked); store.set('lc', lc.checked ? '1' : '0'); };
  lc.addEventListener('change', setLc); setLc();

  document.addEventListener('visibilitychange', keepAwake);
  ['pointerdown', 'keydown'].forEach(t => addEventListener(t, keepAwake, { passive: true }));
  keepAwake();
}
