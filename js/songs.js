// Songs popover: paste box, recent-songs history (this browser only), rename/remove, Export / Import.
import { isSection, isChordLine, isTabLine } from './tab.js';
import { EDIT_ICON } from './icons.js';
import { $, esc, store } from './util.js';

const BACKUP_APP = 'piano-chord-sheet';
const MAX_SONGS = 50;

// ---- storage ----
export const getHist = () => { const h = store.getJSON('history', []); return Array.isArray(h) ? h : []; };
let onChange = () => {};   // set by initSongs: called whenever the saved songs change
const setHist = h => { store.setJSON('history', h.slice(0, MAX_SONGS)); onChange(); };
// the saved name of the song in the paste box ('' if it isn't saved yet)
export const currentTitle = () => (getHist().find(x => x.text === $('tin').value) || {}).title || '';

// ---- titles: first line that looks like a song name (skips Ultimate Guitar page junk) ----
const UG_JUNK = /^(transpose|listen|pdf|print|from the album|youtube|spotify|https?:|tuning|capo|key|tempo|artist|difficulty|author|strumming|chords?\b)/i;
function autoTitle(text) {
  const ls = text.replace(/\r/g, '').split('\n').map(x => x.trim()).filter(Boolean);
  const junk = x => /^[-–—_=*\s|]+$/.test(x) || /https?:|video|tutorial|\bcapo\b|transpose|tuning/i.test(x) || (/[A-Z]{3}/.test(x) && !/[a-z]/.test(x));
  const l = ls.find(x => !junk(x) && !UG_JUNK.test(x) && !/^(transpose|listen|pdf)(\s+(transpose|listen|pdf))*$/i.test(x) && !isSection(x) && !isChordLine(x) && !isTabLine(x));
  return (l || ls[0] || 'Untitled').slice(0, 60);
}
// one-off clean-up of titles saved by older versions
function fixOldTitles() { const h = getHist(); let ch = false; for (const x of h) { if (!x.title || UG_JUNK.test(x.title)) { x.title = autoTitle(x.text); ch = true; } } if (ch) setHist(h); }

// save the song in the paste box to the top of the history (tr = its transpose setting)
export function saveHist(tr) {
  const text = $('tin').value; if (!text.trim()) return; let h = getHist(); const old = h.find(x => x.text === text);
  const title = $('tTitle').value.trim() || (old && old.title) || autoTitle(text);
  h = h.filter(x => x.text !== text); h.unshift({ id: old ? old.id : Date.now(), title, text, tr, t: Date.now() }); setHist(h);
}
// remember a new transpose setting for the current song
export function rememberTr(tr) { const h = getHist(), e = h.find(x => x.text === $('tin').value); if (e && e.tr !== tr) { e.tr = tr; setHist(h); } }

// ---- Export / Import: move songs between browsers or sites as a JSON backup ----
function histMsg(t) { const m = $('histMsg'); if (m) { m.textContent = t; m.hidden = !t; } }
// Inside the Claude viewer pages can't download directly: files go through its "downloads" capability (the viewer asks you to confirm).
// Anywhere else (GitHub Pages, a local server) a normal browser download is used.
let DL = null; try { if (window.claude && typeof window.claude.use === 'function') window.claude.use('downloads').then(d => { DL = d; }, () => {}); } catch (e) {}
async function exportSongs() {
  const songs = getHist(), n = songs.length, name = 'piano-chord-songs.json';
  const data = JSON.stringify({ app: BACKUP_APP, version: 1, exported: new Date().toISOString(), songs }, null, 1);
  const done = `Exported ${n} song${n === 1 ? '' : 's'} to ${name}. On the other site: Songs → Import that file.`;
  if (DL) {
    try { await DL.save({ filename: name, data }); histMsg(done); return; }
    catch (e) { if (e && e.code === 'declined') { histMsg('Export cancelled.'); return; } }   // other failures fall through to the clipboard
  } else if (!window.claude) {
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); histMsg(done); return; } catch (e) {}
  }
  try { await navigator.clipboard.writeText(data); histMsg(`Copied ${n} songs to your clipboard. On the other site: open Songs, paste into the box and press Render.`); }
  catch (e) { // last resort: put the backup in the paste box to copy by hand
    const t = $('tin'); t.value = data; t.focus(); t.select(); $('tTitle').value = ''; $('tTitle').dataset.auto = '0';
    histMsg(`Copy everything in the box above (${n} songs), then on the other site paste it into the Songs box and press Render.`);
  }
}
// returns true when the text was a backup (and was imported)
function importSongs(text) {
  let d; try { d = JSON.parse(text); } catch (e) { return false; }
  if (!d || d.app !== BACKUP_APP || !Array.isArray(d.songs)) return false;
  const h = getHist(), have = new Set(h.map(x => x.text)); let added = 0;
  for (const x of d.songs) {
    if (!x || typeof x.text !== 'string' || !x.text.trim() || have.has(x.text)) continue;
    h.push({ id: x.id || Date.now() + added, title: String(x.title || autoTitle(x.text)).slice(0, 80), text: x.text, tr: (typeof x.tr === 'number' ? x.tr : null), t: x.t || Date.now() }); have.add(x.text); added++;
  }
  h.sort((a, b) => (b.t || 0) - (a.t || 0)); setHist(h);
  if ($('tin').value === text) $('tin').value = '';
  renderHist(); histMsg(`Imported ${added} song${added === 1 ? '' : 's'}${d.songs.length - added ? ` (${d.songs.length - added} already here)` : ''}. Tap one to open it.`);
  return true;
}

// ---- the list ----
function renderHist() {
  const cur = $('tin').value;
  const row = x => `<div class="hi${x.text === cur ? ' cur' : ''}">`
    + `<button class="hl" data-id="${x.id}" title="${esc(x.title)}"><span>${esc(x.title)}</span></button>`
    + `<span class="mut">${new Date(x.t).toLocaleDateString()}</span>`
    + `<button class="hx sm2" data-e="${x.id}" aria-label="Rename ${esc(x.title)}" title="Rename">${EDIT_ICON}</button>`
    + `<button class="hx sm2" data-x="${x.id}" aria-label="Remove ${esc(x.title)}" title="Remove from history">&times;</button></div>`;
  const n = getHist().length;
  $('hist').innerHTML = `<div class="hh"><span>Your songs${n ? ` · ${n}` : ''}</span><span class="grow"></span>`
    + '<button class="sm2" id="expBtn" title="Save all songs to a file you can import on another browser or site">Export</button>'
    + '<button class="sm2" id="impBtn" title="Load songs from an exported file">Import</button></div>'
    + '<div id="histMsg" class="mut" hidden></div>' + getHist().map(row).join('');
}
// rename in place: Enter or leaving the box saves, Esc cancels
function startRename(b) {
  const id = b.dataset.e, row = b.closest('.hi'), lab = row.querySelector('.hl'), it = getHist().find(x => String(x.id) === id); if (!it) return;
  const inp = document.createElement('input'); inp.className = 'hren'; inp.value = it.title; inp.setAttribute('aria-label', 'Song name');
  lab.replaceWith(inp); inp.focus(); inp.select(); let done = false;
  const finish = save => {
    if (done) return; done = true; const v = inp.value.trim();
    if (save && v) {
      const hh = getHist(), t = hh.find(x => String(x.id) === id);
      if (t) { t.title = v.slice(0, 80); setHist(hh); if (t.text === $('tin').value) { $('tTitle').value = t.title; $('tTitle').dataset.auto = '1'; } }
    }
    renderHist();
  };
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); finish(true); } else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish(false); } });
  inp.addEventListener('blur', () => finish(true));
}

// onOpen(tr): render the song now in the paste box (tr = saved transpose, or null for auto)
export function initSongs({ onOpen, onChange: changed }) {
  if (changed) onChange = changed;
  fixOldTitles();
  const tin = $('tin'), title = $('tTitle');

  $('go').addEventListener('click', () => { if (!importSongs(tin.value)) onOpen(null); });
  $('clearBtn').addEventListener('click', () => { tin.value = ''; title.value = ''; title.dataset.auto = '0'; tin.focus(); });

  $('hist').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'expBtn') { exportSongs(); return; }
    if (b.id === 'impBtn') { $('impFile').click(); return; }
    if (b.dataset.e) { startRename(b); return; }
    if (b.dataset.x) { setHist(getHist().filter(x => String(x.id) !== b.dataset.x)); renderHist(); return; }
    const it = getHist().find(x => String(x.id) === b.dataset.id); if (!it) return;
    tin.value = it.text; title.value = it.title; title.dataset.auto = '1';
    onOpen(it.tr == null ? null : it.tr);
  });
  $('impFile').addEventListener('change', async () => {
    const f = $('impFile').files[0]; if (!f) return; const txt = await f.text(); $('impFile').value = '';
    if (!importSongs(txt)) histMsg("That file isn't a song export from this app.");
  });

  // the name box: typing marks it as yours; changing it renames the saved song
  title.addEventListener('input', () => { title.dataset.auto = '0'; });
  title.addEventListener('change', () => {
    const v = title.value.trim(); if (!v) return; const h = getHist(), it = h.find(x => x.text === tin.value);
    if (it && it.title !== v) { it.title = v.slice(0, 80); setHist(h); renderHist(); }
  });
  tin.addEventListener('input', () => { if (title.dataset.auto === '1') { title.value = ''; title.dataset.auto = '0'; } });

  // opening the paste box selects everything, so one Backspace (or a paste) replaces the old song
  $('pastePop').addEventListener('toggle', e => {
    if (e.newState !== 'open') return;
    const it = getHist().find(x => x.text === tin.value); title.value = it ? it.title : ''; title.dataset.auto = it ? '1' : '0';
    renderHist(); tin.scrollTop = 0;
    if (matchMedia('(pointer:coarse)').matches) tin.blur();   // phones: keyboard stays down; selecting works normally (long-press), Clear empties the box
    else { tin.focus(); tin.select(); }
  });
  // the open-time select-all is only for "Backspace to clear": the moment you press inside the box it lets go, so drag-selecting works normally
  tin.addEventListener('pointerdown', () => { if (tin.value && tin.selectionStart === 0 && tin.selectionEnd === tin.value.length) tin.setSelectionRange(0, 0); });
}
