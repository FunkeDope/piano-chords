// Reading pasted guitar tabs: capo/tuning header, line types, inline [C]chords, and fret-number tab blocks.
import { PC, mod12, norm, isChord, NC, spellPc, noteName, ROOT_HUE } from './theory.js';

// ---- header: capo + tuning ----
const STD = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4
export function readHeader(text) {
  const info = { capo: 0, shift: 0, strings: STD.slice(), notes: [] };
  const cm = text.match(/capo\s*[:\-]?\s*(?:on\s*)?(?:the\s*)?(?:fret\s*)?(\d{1,2})/i);
  if (cm) { info.capo = +cm[1]; info.notes.push(`capo ${info.capo}`); }
  const tl = text.match(/tuning\s*[:\-]?\s*([^\n]*)/i);
  if (tl) {
    const t = tl[1].replace(/\]\([^)]*\)/g, ']').replace(/https?:\S+/g, '').replace(/[\[\]]/g, ' ').split(/capo/i)[0];
    if (/half[\s-]*step\s*down|(e\s*b|d#)\s*standard|-\s*1\/2/i.test(t)) { info.shift = -1; info.strings = STD.map(x => x - 1); info.notes.push('½ step down tuning'); }
    else if (/whole[\s-]*step\s*down|\bd\s*standard/i.test(t)) { info.shift = -2; info.strings = STD.map(x => x - 2); info.notes.push('whole step down tuning'); }
    else {
      const tok = t.match(/[A-G](?:#|b)?/g) || [];
      if (tok.length === 6) {
        const d = tok.map((n, i) => norm(PC[n] - (STD[i] % 12)));
        info.strings = STD.map((x, i) => x + d[i]);
        if (d.every(x => x === d[0])) info.shift = d[0];
        else if (d.slice(1).every(x => x === d[1])) info.shift = d[1];
        const name = d.every(x => !x) ? 'standard tuning' : d.slice(1).every(x => !x) && d[0] === -2 ? 'drop D tuning' : `tuning ${tok.join(' ')}`;
        if (info.shift) info.notes.push(`${name} (${info.shift > 0 ? '+' : ''}${info.shift})`); else info.notes.push(name);
      }
    }
  }
  return info;
}

// ---- line classifiers ----
const FILLER = /^(\|+|:?\|\|?:?|-+|\/+|x\d+|\(x\d+\)|\d+x|\.\.\.?|%|\*+|\(|\))$/i;
export const core = t => t.replace(/^\(+/, '').replace(/\)+$/, '').replace(/[*'^!?,]+$/, '').replace(/\)+$/, '');
const chordTok = t => isChord(core(t)) || NC.test(t);
export const isChordLine = l => { const t = l.trim().split(/\s+/).filter(x => x && !FILLER.test(x)); return t.length > 0 && t.every(chordTok) && t.some(x => isChord(core(x))); };
const SECT = /^\s*(intro|verse|pre[\s-]?chorus|chorus|post[\s-]?chorus|bridge|outro|pre[\s-]?refrain|refrain|interlude|instrumental|solo|riff|hook|tag|ending|coda|song|break(?:down)?|middle\s*8)(\s+(\d+|[a-z]|x\d+|\(x\d+\)))?\s*:?\s*$/i;
export const isSection = l => (/^\s*\[[^\]]*\]\s*$/.test(l) && !isChord(l.trim().slice(1, -1))) || SECT.test(l);
const tabCore = l => { const i = l.lastIndexOf('|'); return i > 0 && /[A-Za-z]{2}/.test(l.slice(i + 1)) ? l.slice(0, i + 1) : l; };   // drop trailing words after the last |
export const isTabLine = l0 => { const l = tabCore(l0); return /^\s*[A-Ga-g]?[#b]?\s*\|.*-.*-/.test(l) && /^[\sA-Ga-g#b|\-\d\/\\~hpbrxX().*=<>^]+$/.test(l) && (l.match(/-/g) || []).length >= 4; };

// inline ChordPro style "[G]Charlemagne [Am]shakes" -> chord line + lyric line
export function expandInline(lines) {
  const out = [];
  for (const l of lines) {
    const tags = [...l.matchAll(/\[([^\]]+)\]/g)];
    if (!tags.length || isSection(l) || !tags.every(m => isChord(m[1].trim()) || NC.test(m[1].trim()))) { out.push(l); continue; }
    let lyric = '', ch = '', last = 0;
    for (const m of tags) {
      lyric += l.slice(last, m.index); last = m.index + m[0].length;
      let col = lyric.length; if (ch.length > col) col = ch.length + (ch.length ? 1 : 0);
      ch = ch.padEnd(col) + m[1].trim();
    }
    lyric += l.slice(last);
    out.push(ch); if (lyric.trim()) out.push(lyric);
  }
  return out;
}

// ---- fret-number tab block -> sounding note names ----
const SHAPES = [['', [0, 4, 7]], ['m', [0, 3, 7]], ['7', [0, 4, 7, 10]], ['maj7', [0, 4, 7, 11]], ['m7', [0, 3, 7, 10]], ['sus4', [0, 5, 7]], ['sus2', [0, 2, 7]],
  ['6', [0, 4, 7, 9]], ['m6', [0, 3, 7, 9]], ['add9', [0, 2, 4, 7]], ['m(add9)', [0, 2, 3, 7]], ['7sus4', [0, 5, 7, 10]], ['9', [0, 2, 4, 7, 10]], ['maj9', [0, 2, 4, 7, 11]], ['m9', [0, 2, 3, 7, 10]],
  ['add4', [0, 4, 5, 7]], ['m(add4)', [0, 3, 5, 7]], ['6/9', [0, 2, 4, 7, 9]], ['dim', [0, 3, 6]], ['dim7', [0, 3, 6, 9]], ['m7b5', [0, 3, 6, 10]], ['aug', [0, 4, 8]]];
function strumName(ns) {
  const pcs = [...new Set(ns.map(mod12))], bass = mod12(ns[0]);
  if (pcs.length === 2) { const d = mod12(pcs[1] - pcs[0]); if (d === 7) return { root: pcs[0], name: spellPc(pcs[0]) + '5' }; if (d === 5) return { root: pcs[1], name: spellPc(pcs[1]) + '5' }; return null; }
  if (pcs.length < 3) return null;
  const roots = [bass, ...pcs.filter(x => x !== bass)];   // prefer the lowest note as the root
  for (const r of roots) for (const [q, iv] of SHAPES) {
    const set = pcs.map(x => mod12(x - r)).sort((a, b) => a - b);
    if (set.length === iv.length && set.every((x, i) => x === iv[i])) return { root: r, name: spellPc(r) + q + (r !== bass ? '/' + spellPc(bass) : '') };
  }
  return null;
}
// returns the HTML for the notes line under a tab block, or null if the block can't be read
export function tabToNotes(block, info, extra) {
  const n = block.length; let base;
  if (n === 6) base = info.strings.slice().reverse();          // top line = high e
  else if (n === 4) base = [43, 38, 33, 28];                    // bass G D A E
  else if (n === 7) base = [64, 59, 55, 50, 45, 40, 35];
  else return null;
  const ev = new Map();   // start column -> {end, notes}
  block.forEach((l0, i) => {
    const l = tabCore(l0), start = l.indexOf('|'); if (start < 0) return;
    for (const m of l.slice(start).matchAll(/\d{1,2}/g)) {
      const col = start + m.index, midi = base[i] + (+m[0]) + info.capo + extra;
      if (!ev.has(col)) ev.set(col, { end: col, notes: [] }); const e = ev.get(col); e.notes.push(midi); e.end = Math.max(e.end, col + m[0].length - 1);
    }
  });
  const merged = [];
  for (const c of [...ev.keys()].sort((a, b) => a - b)) {
    const e = ev.get(c), prev = merged[merged.length - 1];
    if (prev && c <= prev.end) { prev.notes.push(...e.notes); prev.end = Math.max(prev.end, e.end); }   // only when a 2-digit fret overlaps this column
    else merged.push({ col: c, end: e.end, notes: [...e.notes] });
  }
  if (!merged.length) return null;
  const chip = m => { const nm = noteName(m), mm = nm.match(/^(.*?)(-?\d+)$/); return mm ? `${mm[1]}<sub>${mm[2]}</sub>` : nm; };
  // each strike: 3+ different notes -> name the chord (Dm, Cadd9, Dsus2...), root + 5th -> power chord (F5), else the notes themselves
  const items = merged.map(e => {
    const ns = [...new Set(e.notes)].sort((a, b) => a - b), all = ns.map(noteName).join(' ');
    const nm = strumName(ns);
    if (nm) return { key: nm.name, html: `<span class="nt ntc" title="${all}" style="--h:${ROOT_HUE[nm.root]}">${nm.name}</span>` };
    return { key: all, html: `<span class="nt" style="--h:${ROOT_HUE[mod12(ns[0])]}">${ns.map(chip).join('+')}</span>` };
  });
  const out = []; for (const it of items) { const last = out[out.length - 1]; if (last && last.key === it.key) last.n++; else out.push({ ...it, n: 1 }); }   // Dm Dm Dm -> Dm ×3
  return '<span class="riff" title="Played from the tab: notes, or the chord they make">♪</span>' + out.map(o => o.html + (o.n > 1 ? `<span class="ntx">×${o.n}</span>` : '')).join(' ');
}
