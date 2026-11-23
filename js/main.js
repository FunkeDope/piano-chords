// Entry point: wires the toolbar, settings, songs and practice dock together, then shows the last song.
import { norm } from './theory.js';
import { KBS, setKb, setMode, toggleFills } from './prefs.js';
import { state, render, fitText, syncVoicingUI } from './render.js';
import { fitCards, autoSizeCards } from './cards.js';
import * as Practice from './practice.js';
import * as AutoScroll from './autoscroll.js';
import { initSongs, getHist, saveHist, rememberTr } from './songs.js';
import { initSettings } from './settings.js';
import { initUI } from './ui.js';
import { $, store } from './util.js';

const EXAMPLE_URL = 'examples/moonlight-sonata.txt';
const EXAMPLE_TITLE = 'Moonlight Sonata (Beethoven) - example';

// re-render the current song and remember its transpose setting
function refresh() { render(); rememberTr(state.tr); }

// show the song now in the paste box (tr = transpose, null = auto from capo/tuning) and save it to the history
function openSong(tr) {
  state.tr = tr; refresh(); saveHist(state.tr);
  try { $('pastePop').hidePopover(); } catch (e) {}
  requestAnimationFrame(autoSizeCards);
}

// a voicing pref changed: redraw, staying on the same chord in the practice dock
function revoice() { const k = Practice.where(); refresh(); Practice.goTo(k); syncVoicingUI(); requestAnimationFrame(autoSizeCards); }

function initToolbar() {
  // play button and Space: practice ball when the dock is open, otherwise auto-scroll
  const playOrScroll = () => Practice.isOpen() ? Practice.togglePlay() : AutoScroll.toggle();
  $('play').addEventListener('click', playOrScroll);
  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range') return;
    if (e.code === 'Space' && e.target.tagName !== 'BUTTON') { e.preventDefault(); playOrScroll(); }
    else if (e.key === '[') AutoScroll.nudge(-2);
    else if (e.key === ']') AutoScroll.nudge(2);
  });

  // transpose
  $('trDn').addEventListener('click', () => { state.tr = norm(state.tr - 1); refresh(); });
  $('trUp').addEventListener('click', () => { state.tr = norm(state.tr + 1); refresh(); });
  $('trReset').addEventListener('click', () => { state.tr = state.auto; refresh(); });

  // voicing: keyboard size, Normal / Real play, Walks (in the key bar and in the practice dock)
  $('kbSel').innerHTML = Object.entries(KBS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
  $('kbSel').addEventListener('change', () => { setKb($('kbSel').value); $('kbSel').blur(); revoice(); });
  document.querySelectorAll('#modeSeg button,#pMode button').forEach(b => b.addEventListener('click', () => { setMode(b.dataset.m); revoice(); }));
  ['fillBtn', 'pFill'].forEach(id => $(id).addEventListener('click', () => { toggleFills(); revoice(); }));
  syncVoicingUI();

  // layout follows the window and the size sliders
  addEventListener('resize', fitText); $('ts').addEventListener('input', fitText);
  new ResizeObserver(fitCards).observe($('cards')); $('cs').addEventListener('input', fitCards);
}

// first visit: open with a free, public-domain example so there's something to look at
async function showExample() {
  try { $('tin').value = await (await fetch(EXAMPLE_URL)).text(); } catch (e) { return; }
  $('tTitle').value = EXAMPLE_TITLE; refresh(); saveHist(state.tr); $('tTitle').value = '';
  requestAnimationFrame(autoSizeCards);
}

function start() {
  initSettings();
  AutoScroll.initAutoScroll();
  initUI();
  Practice.initPractice();
  initSongs({ onOpen: openSong });
  initToolbar();

  const saved = store.get('tab');
  if (saved) {
    $('tin').value = saved;
    const t = store.get('tr'); if (t !== null && t !== 'null') state.tr = +t;
    refresh(); if (!getHist().length) saveHist(state.tr);
  } else showExample();
}

start();
