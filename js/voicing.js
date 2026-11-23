// Voicing: which keys each hand plays for every chord in the song, fingering, and left-hand walks.
import { PC, mod12, parse, intervals, chordInfo } from './theory.js';
import { prefs, kbr } from './prefs.js';

// Default shapes = ROOT POSITION: start on the chord's name note and stack every other note
// (triads fingers 1-3-5, 7ths 1-2-3-5); left hand plays the name note low. These are the piano "open chords".
const HAND = { // [note, octave, hand, finger]
  Em: [['E', 3, 'L', 3], ['E', 4, 'R', 1], ['G', 4, 'R', 3], ['B', 4, 'R', 5]],
  C: [['C', 3, 'L', 5], ['C', 4, 'R', 1], ['E', 4, 'R', 3], ['G', 4, 'R', 5]],
  G: [['G', 3, 'L', 1], ['G', 4, 'R', 1], ['B', 4, 'R', 3], ['D', 5, 'R', 5]],
  D: [['D', 3, 'L', 4], ['D', 4, 'R', 1], ['F#', 4, 'R', 3], ['A', 4, 'R', 5]],
  Am: [['A', 3, 'L', 1], ['A', 4, 'R', 1], ['C', 5, 'R', 3], ['E', 5, 'R', 5]],
  F: [['F', 3, 'L', 2], ['F', 4, 'R', 1], ['A', 4, 'R', 3], ['C', 5, 'R', 5]],
  Em7: [['E', 3, 'L', 3], ['E', 4, 'R', 1], ['G', 4, 'R', 2], ['B', 4, 'R', 3], ['D', 5, 'R', 5]],
};
const KEYS = 36; // C3..B5

// the plain root-position voicing of one chord -> [[semitone above C3, hand, finger]]
export function voicing(c) {
  if (HAND[c]) return HAND[c].map(([n, o, h, f]) => [(o - 3) * 12 + PC[n], h, f]);
  const p = parse(c); if (!p) return null;
  const r = PC[p.root], bass = p.bass ? PC[p.bass] : r;
  let iv = intervals(p).map(i => 12 + r + i).map(k => k >= KEYS ? k - 12 : k);
  iv = [...new Set(iv)].sort((a, b) => a - b);
  const fing = { 1: [1], 2: [1, 5], 3: [1, 3, 5], 4: [1, 2, 3, 5], 5: [1, 2, 3, 4, 5] }[iv.length] || [1, 2, 3, 4, 5];
  return [[bass, 'L', 5], ...iv.map((k, i) => [k, 'R', fing[i]])];
}

const stackUp = (order, start) => { const v = [start]; for (const pc of order.slice(1)) { let n = v[v.length - 1] + 1; while (mod12(n) !== pc) n++; v.push(n); } return v; };
// every right-hand shape that fits on the keyboard (normalOnly: the shape that starts on the chord's name note)
function rhShapes(ci, lo, hi, normalOnly) {
  const out = [];
  for (let j = 0; j < ci.pcs.length; j++) {
    const order = ci.pcs.slice(j).concat(ci.pcs.slice(0, j)); if (normalOnly && order[0] !== ci.r) continue;
    for (let st = lo + mod12(order[0] - lo); st <= hi; st += 12) { const v = stackUp(order, st); if (v[v.length - 1] <= hi) out.push(v); }
  }
  return out;
}
// left hand: the bass note below the right hand, ideally in the octave below middle C
function lhFor(ci, v, lo) { let best = null, bc = 1e9; for (let k = v[0] - 1; k >= Math.max(lo, v[0] - 20); k--) { if (mod12(k) !== ci.b) continue; const c = Math.abs(k - 5) + (v[0] - k < 3 ? 4 : 0); if (c < bc) { bc = c; best = k; } } return best; }
const center = v => v.reduce((a, b) => a + b, 0) / v.length;
function shapeCost(ci, v, lh, normalPref) { return 0.25 * Math.abs(center(v) - 17) + (mod12(v[0]) === ci.r ? 0 : normalPref) + (lh == null ? (ci.b === ci.r ? 3 : 9) : 0); }
const near = (a, b) => a.reduce((s, x) => s + Math.min(...b.map(y => Math.abs(x - y))), 0);

// one voicing per chord in the song: {rh:[keys], lh:key|null}
export function voiceSong(names) {
  const R = kbr(), cache = {}, normal = prefs.mode === 'normal';
  const states = n => {
    if (cache[n]) return cache[n]; const ci = chordInfo(n); if (!ci) return cache[n] = [];
    const shapes = rhShapes(ci, R.lo, R.hi, normal);
    return cache[n] = shapes.map(v => { const lh = lhFor(ci, v, R.lo); return { rh: v, lh, u: shapeCost(ci, v, lh, normal ? 0 : 1.2) }; });
  };
  if (normal) return names.map(n => { const S = states(n); return S.length ? S.reduce((a, b) => b.u < a.u ? b : a) : null; });
  // Real play: pick the whole path of hand positions with the least total movement (Viterbi over the song)
  const L = names.map(states), cost = [], back = [];
  L.forEach((S, i) => {
    cost[i] = []; back[i] = [];
    S.forEach((st, j) => {
      if (i === 0 || !L[i - 1].length) { cost[i][j] = st.u * (i === 0 ? 2 : 1); back[i][j] = -1; return; }
      let bc = 1e9, bk = 0; L[i - 1].forEach((pv, q) => { const t = cost[i - 1][q] + near(st.rh, pv.rh) + near(pv.rh, st.rh) + (st.lh != null && pv.lh != null ? 0.3 * Math.abs(st.lh - pv.lh) : 0); if (t < bc) { bc = t; bk = q; } });
      cost[i][j] = bc + st.u; back[i][j] = bk;
    });
  });
  const out = new Array(names.length).fill(null); let j = -1;
  for (let i = names.length - 1; i >= 0; i--) {
    const S = L[i]; if (!S.length) { j = -1; continue; }
    if (j < 0 || i === names.length - 1 || !L[i + 1].length) j = cost[i].indexOf(Math.min(...cost[i]));
    out[i] = S[j]; j = back[i][j];
  }
  return out;
}

// fingers: middle finger next to the small gap; a big gap (4+ keys) on top means 1-2-5
export function rhFingers(v) { if (v.length === 3) return (v[2] - v[1]) >= 5 ? [1, 2, 5] : [1, 3, 5]; return { 1: [1], 2: [1, 5], 4: [1, 2, 3, 5] }[v.length] || [1, 2, 3, 4, 5]; }
// {rh, lh} -> [[key, hand, finger]]
export const toNotes = x => x ? [...(x.lh != null ? [[x.lh, 'L', 5]] : []), ...x.rh.map((k, i) => [k, 'R', rhFingers(x.rh)[i]])] : null;

// ---- Walks: left-hand passing notes between chords ----
let SCALE = new Set([0, 2, 4, 5, 7, 9, 11]);
// the song's 7 notes: the major scale that contains the most of the song's chord notes
export function setSongScale(names) {
  let best = 0, bs = -1; const cis = names.map(chordInfo).filter(Boolean);
  for (let k = 0; k < 12; k++) {
    const sc = new Set([0, 2, 4, 5, 7, 9, 11].map(x => mod12(x + k))); let score = 0;
    for (const ci of cis) { score += ci.pcs.filter(x => sc.has(x)).length; if (ci.r === k) score += 0.5; } if (score > bs) { bs = score; best = k; }
  }
  SCALE = new Set([0, 2, 4, 5, 7, 9, 11].map(x => mod12(x + best)));
}
// notes the left hand steps through from one chord's bass note to the next (shorter way, song notes only; a black-key slide when there's no song note between)
export function walkNotes(fromName, toName) {
  const a = chordInfo(fromName), b = chordInfo(toName); if (!a || !b || a.b === b.b) return [];
  const d = mod12(b.b - a.b), dir = d <= 6 ? 1 : -1, dist = dir > 0 ? d : 12 - d, out = [];
  for (let i = 1; i < dist; i++) { const pc = mod12(a.b + dir * i); if (SCALE.has(pc)) out.push(pc); }
  if (!out.length && dist === 2) out.push(mod12(a.b + dir));
  return out.length > 3 ? out.slice(-2) : out;
}
