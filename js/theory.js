// Music theory: note names, chord parsing, intervals, transposing, spelling and root-note colours.

export const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, 'E#': 5, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11, 'B#': 0 };
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const mod12 = n => ((n % 12) + 12) % 12;
export const norm = n => { n = mod12(n); return n > 6 ? n - 12 : n; };   // -5..+6

// Chord grammar: root, quality, extension, sus, alterations/adds, slash bass
const NOTE = '[A-G](?:#|b)?';
const CHORD = new RegExp(`^(${NOTE})(maj|Maj|min|M|m|dim|aug|\\+|°|ø|-)?(6\\/9|69|13|11|9|7|6|5|4|2)?(sus2|sus4|sus)?((?:add\\d{1,2}|[b#]\\d{1,2}|\\((?:add|[b#])?\\d{1,2}(?:,\\s*(?:add|[b#])?\\d{1,2})*\\))*)(?:\\/(${NOTE}))?$`);
export const NC = /^N\.?C\.?$/i;
export const parse = c => { const m = c.match(CHORD); return m && { root: m[1], q: m[2] || '', ext: m[3] || '', sus: m[4] || '', alts: m[5] || '', bass: m[6] || '' }; };
export const isChord = t => CHORD.test(t);
export const isMinor = q => /^(m|min|-)$/.test(q);

// ---- spelling: flat keys get flat names (Ab, Db...), sharp keys get sharps (F#, C#...); key guessed from the first chord
let SPELL_FLAT = false;
export function pickSpelling(firstChord, n) {
  const p = parse(firstChord || ''); if (!p) { SPELL_FLAT = false; return; }
  const k = mod12(PC[p.root] + n), minor = isMinor(p.q);
  SPELL_FLAT = minor ? [2, 7, 0, 5, 10, 3].includes(k) : [5, 10, 3, 8, 1].includes(k);
}
export const spellPc = pc => (SPELL_FLAT ? FLATS : NAMES)[pc];
export const noteName = m => spellPc(mod12(m)) + (Math.floor(m / 12) - 1);

// ---- colour: rainbow from C on the white keys (C red, D orange, E yellow, F green, G blue, A indigo, B violet),
// sharps blend their neighbours; B violet wraps back round to C red.
const WHEEL = { C: 25, D: 55, E: 100, F: 145, G: 245, A: 285, B: 320 };
export const ROOT_HUE = [WHEEL.C, 40, WHEEL.D, 78, WHEEL.E, WHEEL.F, 195, WHEEL.G, 265, WHEEL.A, 302, WHEEL.B];
export const hueOf = c => { const p = parse(c); return p ? ROOT_HUE[PC[p.root]] : 0; };
export const isExt = c => { const p = parse(c); return !!p && !!((p.ext && p.ext !== '5') || p.sus || p.alts || /dim|aug|\+|°|ø/.test(p.q)); };

export function intervals(p) {
  const q = p.q, minor = isMinor(q), dim = /^(dim|°)$/.test(q), half = q === 'ø', aug = /^(aug|\+)$/.test(q), maj = /^(maj|Maj|M)$/.test(q);
  if (p.ext === '5') return [0, 7];
  let third = (minor || dim || half) ? 3 : 4, fifth = (dim || half) ? 6 : aug ? 8 : 7;
  if (p.sus === 'sus2' || p.ext === '2') third = 2; else if (p.sus || p.ext === '4') third = 5;
  const set = new Set([0, third, fifth]);
  const seventh = maj ? 11 : dim ? 9 : 10;
  if (half) set.add(10);
  if (p.ext === '6') set.add(9);
  if (p.ext === '6/9' || p.ext === '69') { set.add(9); set.add(14); }
  if (p.ext === '7') set.add(seventh);
  if (p.ext === '9') { set.add(seventh); set.add(14); }
  if (p.ext === '11') { set.add(seventh); set.add(17); }
  if (p.ext === '13') { set.add(seventh); set.add(21); }
  const DEG = { 2: 2, 4: 5, 5: 7, 6: 9, 9: 14, 11: 17, 13: 21 };
  for (const [, acc, d] of p.alts.matchAll(/(add|[b#])?(\d{1,2})/g)) {
    const base = DEG[d]; if (base == null) continue;
    const v = base + (acc === 'b' ? -1 : acc === '#' ? 1 : 0);
    if (+d === 5) { set.delete(fifth); set.add(v); } else set.add(v);
  }
  let iv = [...set].sort((a, b) => a - b);
  if (iv.length > 4 && iv.includes(7)) iv = iv.filter(x => x !== 7);  // drop the 5th to keep it playable
  return iv;
}

export function transpose(c, n) {
  if (!n) return c; const p = parse(c); if (!p) return c;
  const names = SPELL_FLAT ? FLATS : NAMES;                                  // spelled to suit the song's key
  const root = names[mod12(PC[p.root] + n)], bass = p.bass ? names[mod12(PC[p.bass] + n)] : '';
  return root + c.slice(p.root.length, p.bass ? c.length - p.bass.length - 1 : c.length) + (p.bass ? '/' + bass : '');
}

// root, bass and (at most 4) pitch classes of a chord
export function chordInfo(name) {
  const p = parse(name); if (!p) return null; const r = PC[p.root], b = p.bass ? PC[p.bass] : r;
  let pcs = [...new Set(intervals(p).map(i => mod12(r + i)))]; if (pcs.length > 4) pcs = pcs.filter(x => x !== mod12(r + 7)); if (pcs.length > 4) pcs = pcs.slice(0, 4);
  return { r, b, pcs: pcs.sort((x, y) => x - y) };
}
