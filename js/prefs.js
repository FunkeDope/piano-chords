// User choices that change how chords are voiced. Saved in this browser.
import { store } from './util.js';

// keyboard sizes (key numbers: 0 = the C below middle C)
export const KBS = {
  auto: { name: 'Keyboard: fit the song', lo: -24, hi: 60, auto: 1 },
  '25': { name: '25 keys (C–C, MPK mini)', lo: 0, hi: 24 }, '32': { name: '32 keys (F–C)', lo: -7, hi: 24 }, '37': { name: '37 keys (C–C)', lo: 0, hi: 36 },
  '49': { name: '49 keys (C–C)', lo: -12, hi: 36 }, '61': { name: '61 keys (C–C)', lo: -12, hi: 48 }, '76': { name: '76 keys (E–G)', lo: -20, hi: 55 }, '88': { name: '88 keys (full piano)', lo: -27, hi: 60 },
};

function loadKb() { const k = store.get('kb') || (store.get('mini') === '1' ? '25' : 'auto'); return KBS[k] ? k : 'auto'; }
function loadMode() { const m = store.get('pMode'); return (m === 'real' || m === 'smooth') ? 'real' : 'normal'; }

export const prefs = {
  kb: loadKb(),                       // keyboard size key in KBS
  mode: loadMode(),                   // 'normal' = every chord in its normal shape; 'real' = the shapes you'd really play
  fills: store.get('fills') === '1',  // Walks: left-hand passing notes between chords
};

export const kbr = () => KBS[prefs.kb] || KBS.auto;

export function setKb(k) { prefs.kb = k; store.set('kb', k); }
export function setMode(m) { prefs.mode = m; store.set('pMode', m); }
export function toggleFills() { prefs.fills = !prefs.fills; store.set('fills', prefs.fills ? '1' : '0'); }
