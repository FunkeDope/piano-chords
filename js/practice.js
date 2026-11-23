// Practice mode: a dock with a big keyboard that steps through the song chord by chord,
// shows which finger moves where, and bounces a "karaoke ball" over the sheet at your tempo.
import { mod12, hueOf, spellPc, chordInfo } from './theory.js';
import { voiceSong, rhFingers, walkNotes } from './voicing.js';
import { prefs, kbr } from './prefs.js';
import { inversionOf } from './inversions.js';
import { PLAY_ICON, PAUSE_ICON } from './icons.js';
import * as AutoScroll from './autoscroll.js';
import { $, store, isMobile, listNames } from './util.js';

// ---- finger moves between two right-hand positions ----
// which keys stay, and which finger slides to which new key (nearest first)
function movePlan(a, b) {
  const keep = b.filter(x => a.includes(x)), F = a.filter(x => !b.includes(x)), T = b.filter(x => !a.includes(x)), pairs = [];
  while (F.length && T.length) {
    let bi = 0, bj = 0, bd = 1e9;
    F.forEach((x, i) => T.forEach((y, j) => { const d = Math.abs(x - y); if (d < bd) { bd = d; bi = i; bj = j; } }));
    pairs.push([F.splice(bi, 1)[0], T.splice(bj, 1)[0]]);
  }
  pairs.sort((p, q) => p[0] - q[0]);
  return { keep, pairs, add: T, drop: F };
}
// a "jump": some finger would travel more than 5 keys, so it's really one whole-hand move
const isJump = (a, b) => !!a && movePlan(a, b).pairs.some(([x, y]) => Math.abs(y - x) > 5);
// plain-English "what do my fingers do"
function moveText(a, b) {
  if (!a) return 'Start here.';
  const keep = b.filter(x => a.includes(x)), from = a.filter(x => !b.includes(x));
  const nm = k => spellPc(mod12(k)), parts = [];
  if (keep.length === b.length && !from.length) return 'Same keys. Just play it again.';
  if (keep.length) parts.push('Keep ' + listNames(keep.map(nm)) + '.');
  const { pairs, add: T, drop: F } = movePlan(a, b);
  if (isJump(a, b)) {
    const list = listNames(b.slice(1).map(nm));
    return `Move your whole hand ${b[0] > a[0] ? 'up' : 'down'} to ${nm(b[0])}: thumb on ${nm(b[0])}${list ? ', then ' + list : ''}.`;
  }
  for (const [x, y] of pairs) { const d = y - x; parts.push(`Slide ${nm(x)} ${d > 0 ? 'up' : 'down'} ${Math.abs(d)} key${Math.abs(d) > 1 ? 's' : ''} to ${nm(y)}.`); }
  T.forEach(y => parts.push(`Add ${nm(y)}.`)); F.forEach(x => parts.push(`Let go of ${nm(x)}.`));
  if (!keep.length && pairs.length && pairs.every(([x, y]) => Math.abs(y - x) > 4)) return 'Move the whole hand: ' + parts.join(' ');
  return parts.join(' ');
}

// ---- state ----
let seq = [], rh = [], lh = [], i = 0, open = false;
let lo = 0, hi = 31;                     // keys drawn on the dock keyboard
let timer = null, beat = 0, lastTop = null;
let fpos = store.getJSON('dockPos', null);  // floating position {x,y,w}, or null when docked

// ---- dock keyboard geometry ----
const KW2 = 22, WI2 = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6], BLK = new Set([1, 3, 6, 8, 10]);
const wxx = k => Math.floor((k - lo) / 12) * 7 + WI2[mod12(k)] - WI2[mod12(lo)] + (mod12(k) < mod12(lo) ? 7 : 0);
const kx = k => BLK.has(mod12(k)) ? (wxx(k) + 1) * KW2 : wxx(k) * KW2 + KW2 / 2;
const row = k => BLK.has(mod12(k)) ? 56 : 104;
const nextIdx = () => (i + 1) % seq.length;
const chordSpan = idx => document.querySelector(`#sheet .ch[data-k="${seq[idx].k}"]`);
const barBottom = () => document.querySelector('.bar').getBoundingClientRect().bottom;

// new song (or new voicings): seq = [{name, k}] in play order, vox = voiceSong() output
export function load(s, vox) {
  if (timer) stop(); seq = s; i = 0;
  vox = vox || voiceSong(seq.map(x => x.name));
  rh = vox.map(x => x ? x.rh : null); lh = vox.map(x => x ? x.lh : null);
  const R = kbr();
  if (!R.auto && R.hi - R.lo <= 36) { lo = R.lo; hi = R.hi; }
  else {
    const all = [...rh.flat().filter(x => x != null), ...lh.filter(x => x != null)]; lo = all.length ? Math.min(...all) : 0; hi = all.length ? Math.max(...all) : 31;
    lo -= mod12(lo); while (BLK.has(mod12(hi)) || BLK.has(mod12(hi + 1))) hi++; if (hi - lo < 24) hi = lo + 24;
    if (!R.auto) { lo = Math.max(lo, R.lo); hi = Math.min(Math.max(hi, lo + 24), R.hi); }
  }
  $('pKeys').innerHTML = '';
  $('pBtn').hidden = !seq.length;
  if (open) draw(false);
}

function drawKeys() {
  const W = (wxx(hi) + 1) * KW2; let w = '', b = '';
  for (let k = lo; k <= hi; k++) {
    if (!BLK.has(mod12(k))) w += `<rect class="pk" data-k="${k}" x="${wxx(k) * KW2}" y="0" width="${KW2}" height="120" rx="2"/>`;
    else b += `<rect class="pk blk" data-k="${k}" x="${(wxx(k) + 1) * KW2 - 7}" y="0" width="14" height="74" rx="1.5"/>`;
  }
  $('pKb').setAttribute('viewBox', `0 -4 ${W} 128`);
  $('pKeys').innerHTML = w + b;
  let dots = ''; for (let d = 0; d < 5; d++) dots += `<g class="fd" id="fd${d}"><circle r="10"/><text text-anchor="middle" dy="4.5"></text></g>`;
  $('pDots').innerHTML = dots;
}

// one arrow per moving finger, from its dot to the exact key it lands on (tip sits on that key)
function arrow(x, y) {
  const fx = kx(x), fy = row(x), tx = kx(y), ty = row(y), dx = tx - fx, dy = ty - fy, dist = Math.hypot(dx, dy);
  let d, ang;
  if (dist >= 30) {                 // straight from the dot edge right onto the target key
    const ux = dx / dist, uy = dy / dist; ang = Math.atan2(uy, ux);
    d = `M${fx + ux * 11} ${fy + uy * 11} L${tx - Math.cos(ang) * 7} ${ty - Math.sin(ang) * 7}`;
  } else {                          // next-door key: small hop up over the dot and down onto the key
    const sx = fx + Math.sign(dx || 1) * 4, sy = fy - 11, cx = (sx + tx) / 2, cy = Math.min(sy, ty) - 16;
    ang = Math.atan2(ty - cy, tx - cx); d = `M${sx} ${sy} Q${cx} ${cy} ${tx - Math.cos(ang) * 7} ${ty - Math.sin(ang) * 7}`;
  }
  const hx = tx - Math.cos(ang) * 9, hy = ty - Math.sin(ang) * 9, W = 5;
  return `<path class="aw-u" d="${d}"/><path class="aw" d="${d}"/>` +
    `<polygon class="awh" points="${tx},${ty} ${hx + Math.sin(ang) * W},${hy - Math.cos(ang) * W} ${hx - Math.sin(ang) * W},${hy + Math.cos(ang) * W}"/>`;
}

function draw(animate, noScroll) {
  if (!seq.length) return;
  const n = nextIdx(), cur = seq[i], nx = seq[n], h = hueOf(cur.name), hn = hueOf(nx.name);
  const v = rh[i] || [], vn = rh[n] || [];
  $('pNow').textContent = cur.name; $('pNow').style.setProperty('--h', h);
  {
    const inv = inversionOf(cur.name, v), b = $('pInv');
    b.hidden = !inv; if (inv) { b.dataset.why = inv.why; b.setAttribute('aria-label', inv.tag + ': ' + inv.why); b.style.setProperty('--h', h); }
  }
  $('pNext').textContent = nx.name; $('pNext').style.setProperty('--h', hn);
  $('pPos').textContent = `${i + 1} / ${seq.length}`;
  {
    const w = prefs.fills ? walkNotes(cur.name, nx.name) : [];
    $('pMove').textContent = moveText(v, vn) + (w.length ? `  Left-hand walk: ${w.map(spellPc).join(', ')} → ${spellPc(chordInfo(nx.name).b)}.` : '');
  }
  if (!$('pKeys').firstChild) drawKeys();
  $('pKb').style.setProperty('--h', h); $('pKb').style.setProperty('--hn', hn);
  document.querySelectorAll('#pKeys .pk').forEach(r => {
    const k = +r.dataset.k;
    r.classList.toggle('on', v.includes(k)); r.classList.toggle('lh', k === lh[i]);
    r.classList.toggle('next', (vn.includes(k) && !v.includes(k)) || (k === lh[n] && k !== lh[i]));
  });
  // finger dots: left-hand bass (5) then the right-hand fingers
  const fing = rhFingers(v), plan = movePlan(v, vn);
  const pts = [...(lh[i] != null ? [[lh[i], '5', 'L']] : []), ...v.map((k, j) => [k, String(fing[j]), 'R'])];
  for (let d = 0; d < 5; d++) {
    const g = $('fd' + d), p = pts[d];
    if (!p) { g.style.opacity = 0; continue; }
    g.style.opacity = 1; g.style.transition = animate ? 'transform .35s ease' : 'none';
    g.style.transform = `translate(${kx(p[0])}px,${row(p[0])}px)`; g.classList.toggle('lhd', p[2] === 'L'); g.querySelector('text').textContent = p[1];
    g.classList.toggle('keep', p[2] === 'L' ? lh[i] === lh[n] : plan.keep.includes(p[0]));
  }
  const moves = isJump(v, vn) && v.length && vn.length ? [[v[0], vn[0]]] : plan.pairs.slice();
  if (lh[i] != null && lh[n] != null && lh[i] !== lh[n]) moves.push([lh[i], lh[n]]);
  $('pArrows').innerHTML = moves.map(([x, y]) => arrow(x, y)).join('');
  $('pKb').setAttribute('viewBox', `0 -2 ${(wxx(hi) + 1) * KW2} 126`);
  // highlight the current chord + its lyrics on the sheet, and keep it in view
  document.querySelectorAll('#sheet .ch.cur,#sheet .ly.sing').forEach(e => e.classList.remove('cur', 'sing'));
  document.querySelectorAll(`#sheet .ly[data-k="${cur.k}"]`).forEach(e => e.classList.add('sing'));
  const span = chordSpan(i);
  if (span) {
    span.classList.add('cur'); const r = span.getBoundingClientRect(), dock = dockBox(), barB = barBottom();
    if (!noScroll && (r.top < barB + 12 || r.bottom > dock.top - 20)) window.scrollTo({ top: scrollY + r.top - (barB + (dock.top - barB) / 2), behavior: 'smooth' });
  }
}

// ---- karaoke ball: steady beats you set; the ball shows where it thinks you are, tap/arrows to resync ----
const BPM = () => Math.max(30, Math.min(240, +$('pBpm').value || 90)), BPC = () => Math.max(1, Math.min(16, +$('pBpc').value || 4));
function ball() { let b = $('ball'); if (!b) { b = document.createElement('div'); b.id = 'ball'; b.className = 'ball'; $('sheet').appendChild(b); } return b; }
function posOf(idx) {
  const sp = chordSpan(idx); if (!sp) return null;
  const r = sp.getBoundingClientRect(), s = $('sheet').getBoundingClientRect();
  return { x: r.left - s.left + $('sheet').scrollLeft + r.width / 2 - 6, y: r.top - s.top - 14, h: hueOf(seq[idx].name) };
}
function hop(from, to, ms, height) {
  const b = ball(); if (!from || !to) return;
  b.style.setProperty('--h', to.h); b.hidden = false;
  b.animate([{ transform: `translate(${from.x}px,${from.y}px)`, easing: 'ease-out' },
    { transform: `translate(${(from.x + to.x) / 2}px,${Math.min(from.y, to.y) - height}px)`, easing: 'ease-in' },
    { transform: `translate(${to.x}px,${to.y}px)` }], { duration: ms, fill: 'forwards' });
}
function keepInView() { // scroll one line at a time so the active line sits a third of the way down
  const sp = chordSpan(i); if (!sp) return;
  const r = sp.getBoundingClientRect(); if (lastTop !== null && Math.abs(r.top - lastTop) < 3) return;
  const barB = barBottom(), dock = dockBox();
  window.scrollTo({ top: scrollY + r.top - (barB + (dock.top - barB) * 0.33), behavior: 'smooth' });
  lastTop = barB + (dock.top - barB) * 0.33;
}
function beatsUI() { $('pBeats').innerHTML = Array.from({ length: BPC() }, (_, b) => `<span class="${timer && b === beat ? 'on' : ''}"></span>`).join(''); }
function tick() {
  const ms = 60000 / BPM(), last = beat === BPC() - 1, nxt = nextIdx(), here = posOf(i);
  if (last && i < seq.length - 1) hop(here, posOf(nxt), ms, 26); else hop(here, here, ms * 0.9, 12);
  beatsUI();
  timer = setTimeout(() => {
    beat++;
    if (beat >= BPC()) { beat = 0; if (i >= seq.length - 1) { stop(); return; } i = nxt; draw(true, true); keepInView(); }
    tick();
  }, ms);
}
function play() { if (!seq.length) return; stop(); beat = 0; lastTop = null; draw(false, true); keepInView(); setBtn(true); tick(); }
export function stop() { clearTimeout(timer); timer = null; setBtn(false); beatsUI(); }
function setBtn(on) { const pb = $('play'); if (pb && open) { pb.innerHTML = on ? PAUSE_ICON : PLAY_ICON; pb.classList.toggle('on', on); } }
export function togglePlay() { timer ? stop() : play(); }
function resync() { if (timer) { clearTimeout(timer); timer = null; beat = 0; lastTop = null; tick(); } else { const p = posOf(i); if (p) hop(p, p, 1, 0); } }
export function step(d) { if (!seq.length) return; i = (i + d + seq.length) % seq.length; draw(true); resync(); }
export function jump(k, noScroll) { const j = seq.findIndex(x => x.k === k); if (j >= 0) { i = j; draw(true, noScroll); resync(); } }

export function toggle(force) {
  open = force ?? !open; $('dock').hidden = !open; $('pBtn').classList.toggle('on', open);
  document.body.classList.toggle('practicing', open);
  if (open) { $('pKeys').innerHTML = ''; draw(false); if (fpos) placeFloat(); sizeDock(); AutoScroll.stop(); const p = posOf(i); if (p) hop(p, p, 1, 0); beatsUI(); }
  else { stop(); const b = $('ball'); if (b) b.hidden = true; document.querySelectorAll('#sheet .ch.cur,#sheet .ly.sing').forEach(e => e.classList.remove('cur', 'sing')); $('play').innerHTML = PLAY_ICON; }
}

// ---- dock placement: docked along the bottom, or floating wherever you dragged it ----
const dockBox = () => { const d = $('dock'); return d.classList.contains('floating') ? { top: innerHeight } : d.getBoundingClientRect(); };
export function sizeDock() {
  const d = $('dock'); if (d.hidden) return;
  if (d.classList.contains('floating')) { placeFloat(); document.body.style.paddingBottom = '24px'; return; }
  const l = document.querySelector('.left').getBoundingClientRect();
  if (!isMobile()) { d.style.left = Math.max(8, l.left) + 'px'; d.style.width = Math.min(Math.max(l.width, 520), innerWidth - 16) + 'px'; }
  document.body.style.paddingBottom = (d.offsetHeight + 24) + 'px';
}
function placeFloat() {
  const d = $('dock'); if (!fpos) return;
  const w = Math.min(fpos.w, innerWidth - 8), h = d.offsetHeight;
  fpos.x = Math.max(4, Math.min(fpos.x, innerWidth - w - 4)); fpos.y = Math.max(4, Math.min(fpos.y, innerHeight - Math.min(h, 60)));
  d.classList.add('floating'); d.style.setProperty('--fx', fpos.x + 'px'); d.style.setProperty('--fy', fpos.y + 'px'); d.style.setProperty('--fw', w + 'px');
}
// drag by the grip bar or the chord row; the position is remembered
function startDrag(e) {
  if (e.target.closest('button,input,label,a')) return;
  const d = $('dock'), r = d.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
  fpos = { x: r.left, y: r.top, w: r.width }; placeFloat(); d.classList.add('dragging'); e.preventDefault();
  const move = ev => { fpos.x = ev.clientX - ox; fpos.y = ev.clientY - oy; placeFloat(); };
  const up = () => {
    d.classList.remove('dragging'); removeEventListener('pointermove', move); removeEventListener('pointerup', up);
    store.setJSON('dockPos', fpos); document.body.style.paddingBottom = '24px';
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up);
}
// double-click the grip to dock it back
function redock() { fpos = null; store.remove('dockPos'); const d = $('dock'); d.classList.remove('floating'); d.style.left = ''; d.style.width = ''; sizeDock(); }

// keep the same chord selected across a re-voice
export const where = () => seq[i] && seq[i].k;
export function goTo(k) { if (k == null) return; const j = seq.findIndex(x => x.k === k); if (j >= 0) { i = j; if (open) { $('pKeys').innerHTML = ''; draw(false, true); } } }
export const isOpen = () => open;

export function initPractice() {
  $('dGrip').addEventListener('pointerdown', startDrag);
  $('dock').querySelector('.phead').addEventListener('pointerdown', startDrag);
  $('dGrip').addEventListener('dblclick', redock);
  $('pBtn').addEventListener('click', () => toggle());
  $('pClose').addEventListener('click', () => toggle(false));
  $('pPrev').addEventListener('click', () => step(-1));
  $('pNextBtn').addEventListener('click', () => step(1));
  // practice open: tapping a chord or lyric on the sheet moves the dock there
  $('sheet').addEventListener('click', e => { const c = e.target.closest('[data-k]'); if (c && open) jump(+c.dataset.k); });
  addEventListener('resize', sizeDock);
  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'p' || e.key === 'P') { toggle(); return; }
    if (!open) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
  }, true);
}
