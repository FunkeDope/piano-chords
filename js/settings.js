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
// on: true / false; msg: plain-language status; detail: the browser's own reason (shown on hover)
function wlShow(on, msg, detail = '') {
  const box = $('wlStat'); if (!box) return;
  $('wlText').textContent = on ? 'On. Your screen won\'t dim while this page is open.' : msg;
  box.title = detail; box.classList.toggle('on', on); box.classList.toggle('bad', !on);
}
async function keepAwake() {
  if (!('wakeLock' in navigator)) { wlShow(false, 'Not available in this browser, so the screen may dim while you play.', `secure context: ${window.isSecureContext}`); return; }
  if (document.visibilityState !== 'visible' || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen'); wlShow(true);
    wakeLock.addEventListener('release', () => { wakeLock = null; wlShow(false, 'Paused while the page was hidden. Tap anywhere to turn it back on.'); });
  } catch (e) { wakeLock = null; wlShow(false, 'Off for now. Tap anywhere on the page to turn it on.', `${e.name}: ${e.message}`); }
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
