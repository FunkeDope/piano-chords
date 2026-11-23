// Chord cards: a small keyboard diagram per chord in the song, sized to fit the side panel.
import { PC, mod12, parse, hueOf, isExt, isMinor, spellPc } from './theory.js';
import { voiceSong, toNotes } from './voicing.js';
import { kbr } from './prefs.js';
import { inversionOf } from './inversions.js';
import { INV_ICON } from './icons.js';
import { $, esc, isMobile } from './util.js';

const WHITE_IDX = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6], BLACK = new Set([1, 3, 6, 8, 10]), KW = 14;
const wx = k => (Math.floor(k / 12) * 7 + WHITE_IDX[mod12(k)]);   // white-key index of key k
const VBW = 17 * KW, VBH = 108;   // every card, every song, every mode: same frame (second label row always reserved)

// keyboard window shared by every card in the song: only as wide as the song's chords need
let RANGE = { lo: 0, hi: 28 };
function setRange(voicings) {
  const R = kbr(); if (!R.auto && R.hi - R.lo <= 36) { RANGE = { lo: R.lo, hi: R.hi }; return; }   // small boards: draw the whole board
  const all = voicings.flat().map(n => n[0]); if (!all.length) return;
  let lo = Math.min(...all), hi = Math.max(...all);
  lo = lo - mod12(lo);                                              // start on a C
  while (BLACK.has(mod12(hi + 1)) || BLACK.has(mod12(hi))) hi++;    // finish on a white key
  if (hi - lo < 16) hi = lo + 16;                                   // at least ~1.5 octaves so it reads as a keyboard
  while (BLACK.has(mod12(hi))) hi++;
  RANGE = { lo, hi };
}

function card(name, notes, h) {
  const on = {}; notes.forEach(([s, hand, f]) => { on[s] = { hand, f }; });
  const fill = (hand, black) => hand === 'L' ? `oklch(${black ? .42 : .48} .14 ${h})` : `oklch(${black ? .62 : .86} .15 ${h})`;
  const ink = hand => hand === 'L' ? '#fff' : `oklch(.28 .08 ${h})`;
  const kw = VBW / (wx(RANGE.hi) - wx(RANGE.lo) + 1), bw = kw * 5 / 7;   // keys share the fixed width
  const x = k => (wx(k) - wx(RANGE.lo)) * kw;
  let w = '', b = '', lab = '', lastX = -99, lastW = 0, lastRow = 0;
  for (let k = RANGE.lo; k <= RANGE.hi; k++) {
    const p = on[k], isB = BLACK.has(mod12(k));
    if (!isB) {
      w += `<rect x="${x(k)}" y="22" width="${kw}" height="54" fill="${p ? fill(p.hand) : '#F1EFE8'}" stroke="#888780" stroke-width=".5"/>`;
      if (p) w += `<text x="${x(k) + kw / 2}" y="69" text-anchor="middle" font-size="13" font-weight="700" fill="${ink(p.hand)}">${p.f}</text>`;
    } else {
      const bx = x(k) + kw - bw / 2;
      b += `<rect x="${bx}" y="22" width="${bw}" height="34" fill="${p ? fill(p.hand, true) : '#2C2C2A'}"/>`;
      if (p) b += `<text x="${bx + bw / 2}" y="46" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${p.f}</text>`;
    }
    if (p) {
      // note names under the keys; drop to a second line only if the names would overlap
      const lx = isB ? x(k) + kw : x(k) + kw / 2, nm = spellPc(mod12(k)), lw = nm.length * 8.5, row = (lx - lastX < (lw + lastW) / 2 + 3) ? 1 - lastRow : 0; lastX = lx; lastW = lw; lastRow = row;
      lab += `<text class="n" x="${lx}" y="${92 + row * 12}" text-anchor="middle" font-size="13" font-weight="600">${nm}</text>`;
    }
  }
  const inv = inversionOf(name, notes.filter(n => n[1] === 'R').map(n => n[0]));
  const badge = inv ? `<button class="inv-ic" data-why="${esc(inv.why)}" aria-label="${inv.tag}: ${esc(inv.why)}">${INV_ICON}</button>` : '';
  return `<div class="card${isExt(name) ? ' ext' : ''}" data-c="${name}" style="--h:${h}">${badge}<svg viewBox="0 0 ${VBW} ${VBH}" font-family="system-ui,sans-serif" role="img" aria-label="${name} piano chord"><title>${name}</title><text class="ttl" x="0" y="16" font-size="18" font-weight="800">${name}</text>${w}${b}${lab}</svg></div>`;
}

// Draw a card for every distinct chord. `names`/`vox` are the song's chord sequence and its voicings:
// each card shows the shape that chord is played with most often in the song.
export function renderCards(seen, names, vox) {
  const cardVox = c => {
    const cnt = {}; let best = null, bn = 0;
    names.forEach((n, i) => { if (n !== c || !vox[i]) return; const key = vox[i].rh.join() + '|' + vox[i].lh; cnt[key] = (cnt[key] || 0) + 1; if (cnt[key] > bn) { bn = cnt[key]; best = vox[i]; } });
    return toNotes(best || voiceSong([c])[0]);
  };
  // cards in note order C D E F G A B (the colour wheel), so colours sit next to their neighbours;
  // same root: plain chord first, then minor, then 7ths / extended
  const rank = c => { const p = parse(c); return p ? PC[p.root] * 100 + (isExt(c) ? 20 : 0) + (isMinor(p.q) ? 10 : 0) + (p.bass ? 5 : 0) : 9999; };
  const vs = seen.slice().sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)).map(c => [c, cardVox(c)]).filter(x => x[1]);
  setRange(vs.map(x => x[1]));
  $('cards').innerHTML = vs.map(([c, v]) => card(c, v, hueOf(c))).join('');
  $('panel').hidden = !seen.length;
}

// shrink cards (never grow past the Chord size slider) so every chord fits on screen
export function fitCards() {
  const cards = $('cards'), n = cards.children.length; if (!n) return;
  const W = cards.clientWidth, H = cards.clientHeight, gap = 8, max = +$('cs').value;
  if (isMobile()) { // stacked layout: cards in a row, up to 3 across
    const cols = W >= 560 ? 3 : 2;
    document.documentElement.style.setProperty('--fit', Math.floor((W - gap * (cols - 1)) / cols) + 'px'); return;
  }
  const cardH = cw => (cw - 18) * VBH / VBW + 16;
  let cw = max;
  for (; cw > 120; cw -= 2) {
    const rows = Math.max(1, Math.floor((H + gap) / (cardH(cw) + gap))), cols = Math.ceil(n / rows);
    if (cols * cw + (cols - 1) * gap <= W) break;
  }
  document.documentElement.style.setProperty('--fit', cw + 'px');
}

// new song: make the cards as big as possible while all of them still fit on screen.
// Fill the HEIGHT with one column; only if that would make cards smaller than MIN, use the fewest extra columns needed.
// Never wider than the space. Sets the Chord size slider to match.
export function autoSizeCards() {
  const cards = $('cards'), n = cards.children.length; if (!n || isMobile()) return;
  const W = cards.clientWidth, H = cards.clientHeight, gap = 8, MIN = 220;
  const fromH = rows => (((H - (rows - 1) * gap) / rows) - 16) * VBW / VBH + 18;   // card width whose height fits `rows` per column
  let best = MIN;
  for (let c = 1; c <= n; c++) {
    const rows = Math.ceil(n / c), cw = Math.min(fromH(rows), (W - (c - 1) * gap) / c);
    best = cw; if (cw >= MIN) break;
  }
  const cs = $('cs'); cs.value = Math.max(160, Math.floor(best / 2) * 2); cs.dispatchEvent(new Event('input'));
}
