// Render the pasted song into the coloured sheet, the chord cards and the practice sequence.
import { norm, isChord, NC, hueOf, isExt, transpose, pickSpelling, spellPc } from './theory.js';
import { readHeader, core, isChordLine, isSection, isTabLine, expandInline, tabToNotes } from './tab.js';
import { voiceSong, setSongScale, walkNotes } from './voicing.js';
import { prefs } from './prefs.js';
import { renderCards, fitCards } from './cards.js';
import * as Practice from './practice.js';
import { $, esc, pad, store, isMobile } from './util.js';

// tr = semitones the song is shifted (null = use auto), auto = shift implied by capo + tuning, info = readHeader() result
export const state = { tr: null, auto: 0, info: null };

// the header above the first section/chord/tab line: keep only the useful facts (Tuning / Capo / Key);
// drop page junk, links, divider lines and instructions
function headerFacts(lines) {
  const htxt = lines.join('\n').replace(/\]\([^)]*\)/g, ']').replace(/[\[\]]/g, '');
  return [...htxt.replace(/ ?\n ?/g, '\n').matchAll(/\b(Tuning|Capo|Key)\s*:\s*([^\n]*?)(?=\b(?:Tuning|Capo|Key)\s*:|\n|$)/gi)]
    .map(m => `${m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()}: ${m[2].replace(/[-–—_=*]{3,}.*$/, '').replace(/https?:\S+/g, '').trim()}`)
    .filter(x => !/:\s*$/.test(x)).join(' · ');
}

// Build the sheet HTML. Returns {html, seen: distinct chords in order, seq: [{name,k}] in play order}.
function buildSheet(lines, info, T, extra) {
  let prevChord = null;
  const seen = [], seq = []; let out = '', blank = false, cur = null, marks = null, kIdx = 0;
  const chordSpan = (c, k) => `<span class="ch${isExt(c) ? ' ext' : ''}" data-c="${c}" data-k="${k}" style="--h:${hueOf(c)}">${esc(c)}</span>`;
  const ly = (txt, o) => !txt ? '' : o && o.name ? `<span class="ly${isExt(o.name) ? ' ext' : ''}" data-c="${o.name}" data-k="${o.k}" style="--h:${hueOf(o.name)}">${esc(txt)}</span>` : esc(txt);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) { if (!blank) out += '\n'; blank = true; marks = null; continue; } blank = false;
    if (isSection(l)) { out += `<span class="sec">${esc(l.trim())}</span>\n`; marks = null; continue; }
    if (isTabLine(l)) { // collect the whole tab block, show it muted with note names under it
      const block = []; while (i < lines.length && isTabLine(lines[i])) block.push(lines[i++]); i--;
      out += `<span class="tab">${esc(block.join('\n'))}</span>\n`;
      const notes = tabToNotes(block, info, extra);
      out += notes ? `<span class="notes">${notes}</span>` : '';   // block element: no extra newline after it
      marks = null; continue;
    }
    if (isChordLine(l)) {
      // marks = [column, {name,k}] for each chord, used to colour the lyric line underneath
      const carry = cur; marks = []; marks.carry = carry;
      let html = '', end = 0; const lineSeq = [];
      const rpt = (l.match(/(?:^|\s)\(?x(\d+)\)?(?=\s|$)/i) || [])[1]; // "Em C G D x3" -> play the line 3 times
      for (const m of l.matchAll(/\S+/g)) {
        const t = m[0], c0 = core(t), lead = t.indexOf(c0);
        let col = m.index;
        if (NC.test(t)) { marks.push([col, null]); prevChord = null; }
        else if (isChord(c0)) {
          const name = transpose(c0, T), k = kIdx++; marks.push([col + lead, { name, k }]);
          if (!seen.includes(name)) seen.push(name);
          const disp = t.slice(0, lead) + '\u0000' + t.slice(lead + c0.length);
          if (end && col <= end) col = end + 1;
          { // optional left-hand walk into this chord, squeezed into the gap before it
            const w = prefs.fills && prevChord ? walkNotes(prevChord, name) : [], txt = w.map(spellPc).join(' ') + '›';
            const st = col - txt.length - 1, minSt = end ? end + 1 : 0;   // walk must end one space before the chord and start after the previous text
            if (w.length && st >= minSt) html += pad(st - end) + `<span class="walk" title="Left-hand walk into ${esc(name)}">${esc(txt)}</span> `;
            else html += pad(col - end);
          }
          lineSeq.push({ name, k });
          prevChord = name;
          html += esc(disp).replace('\u0000', chordSpan(name, k)); end = col + t.length - c0.length + name.length; continue;
        }
        if (end && col <= end) col = end + 1; html += pad(col - end) + (NC.test(t) ? `<span class="nc">${esc(t)}</span>` : esc(t)); end = col + t.length;
      }
      if (marks.length) cur = marks[marks.length - 1][1];
      for (let r = 0; r < (+rpt || 1); r++) seq.push(...lineSeq);
      out += html + '\n'; continue;
    }
    // lyric line: colour each stretch by the chord above it
    const m = marks || []; let html = '', pos = 0, c = marks ? marks.carry : cur;
    for (const [col, ch] of m) { if (col > pos) { html += ly(l.slice(pos, col), c); pos = Math.min(col, l.length); } c = ch; if (pos >= l.length) break; }
    html += ly(l.slice(pos), c);
    out += html + '\n'; if (m.length) cur = m[m.length - 1][1]; marks = null;
  }
  return { html: out.replace(/\n+$/, ''), seen, seq };
}

export function render() {
  const raw = $('tin').value;
  const text = raw.replace(/\r/g, '').replace(/\t/g, '    ');
  const all = expandInline(text.split('\n'));
  const info = readHeader(text); state.info = info;
  state.auto = norm(info.capo + info.shift);
  if (state.tr === null) state.tr = state.auto;
  const T = state.tr, extra = T - state.auto;
  { const firstChordLine = all.find(isChordLine); const tok = firstChordLine && firstChordLine.trim().split(/\s+/).map(core).find(isChord); pickSpelling(tok, T); }

  // header: everything above the first section / chord / tab line
  let first = all.findIndex(l => isSection(l) || isChordLine(l) || isTabLine(l)); if (first < 0) first = 0;
  const lines = all.slice(first);
  $('metaText').textContent = headerFacts(all.slice(0, first));
  $('trVal').textContent = (T > 0 ? '+' : '') + T;
  $('trNote').textContent = state.auto ? `auto ${(state.auto > 0 ? '+' : '') + state.auto} from ${info.notes.join(', ')}${T !== state.auto ? ' (changed)' : ''}` : (info.notes.length ? info.notes.join(', ') : '');
  $('trBar').hidden = false;

  setSongScale(lines.filter(isChordLine).flatMap(l => l.trim().split(/\s+/).map(core).filter(isChord).map(c => transpose(c, T))));
  const { html, seen, seq } = buildSheet(lines, info, T, extra);
  $('sheet').innerHTML = html;
  LONGEST = Math.max(20, ...$('sheet').textContent.split('\n').map(x => x.replace(/\s+$/, '').length)); fitText();

  const names = seq.map(x => x.name), vox = voiceSong(names);
  syncVoicingUI();
  renderCards(seen, names, vox);
  Practice.load(seq, vox);
  store.set('tab', raw); store.set('tr', String(state.tr));
  fitCards();
}

// Mobile: shrink the sheet font so the longest line fits the screen (never bigger than the Text size setting)
let LONGEST = 40, CHW = 0;
export function fitText() {
  const sh = $('sheet'); if (!sh) return;
  if (!isMobile()) { sh.style.fontSize = ''; return; }
  if (!CHW) { const m = document.createElement('span'); m.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:100px ' + getComputedStyle(sh).fontFamily; m.textContent = 'M'.repeat(20); document.body.appendChild(m); CHW = m.getBoundingClientRect().width / 2000 || .6; m.remove(); }
  const avail = sh.parentElement.clientWidth - 2, want = +$('ts').value;
  sh.style.fontSize = Math.max(10, Math.min(want, avail / (LONGEST * CHW))) + 'px';
}

// reflect the voicing prefs (mode, keyboard, walks) in both toolbars
export function syncVoicingUI() {
  $('fillBtn').classList.toggle('on', prefs.fills); $('pFill').classList.toggle('on', prefs.fills);
  const n = document.querySelectorAll('#sheet .walk').length; $('walkKey').hidden = !prefs.fills;
  $('walkKey').textContent = n ? `Walks on: the grey notes between chords are an optional left-hand walk into the next chord. Play the bold chords.` : `Walks on, but none fit in this song: the chords sit too close together. Walks show only where there's a gap between two chords.`;
  document.querySelectorAll('#modeSeg button,#pMode button').forEach(b => b.classList.toggle('on', b.dataset.m === prefs.mode));
  $('kbSel').value = prefs.kb;
}
