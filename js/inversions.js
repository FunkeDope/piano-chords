// Plain-English "why is this an inversion" text for the ⇄ badge on cards and in the practice dock.
import { PC, mod12, parse, spellPc } from './theory.js';
import { voicing } from './voicing.js';
import { prefs, kbr } from './prefs.js';
import { listNames } from './util.js';

function defaultNotes(name) { const v = voicing(name); return v ? v.filter(x => x[1] === 'R').map(x => spellPc(mod12(x[0]))) : []; }

// slash chord (D/F#): the bass note isn't the chord's name note
export function slashWhy(name) {
  const p = parse(name); if (!p || !p.bass || PC[p.bass] === PC[p.root]) return null;
  return { tag: 'Inversion', why: `${name} means: play ${p.root + name.slice(p.root.length, name.length - p.bass.length - 1)} but with ${p.bass} as the lowest note. Your left hand plays ${p.bass} instead of ${p.root}${prefs.mode === 'real' ? '.' : `; the right hand keeps the normal shape (${listNames(defaultNotes(name))}).`}` };
}

// right hand not starting on the name note (Real play mode)
export function rhWhy(name, rhKeys) {
  const p = parse(name); if (!p || !rhKeys || !rhKeys.length) return null;
  const r = PC[p.root], low = mod12(rhKeys[0]); if (low === r) return null;
  const deg = mod12(low - r), which = [3, 4].includes(deg) ? '1st inversion' : [6, 7, 8].includes(deg) ? '2nd inversion' : [9, 10, 11].includes(deg) ? '3rd inversion' : 'Inversion';
  return { tag: which, why: `${which}: same notes as the default ${name} (${listNames(defaultNotes(name))}), just rearranged so the lowest right-hand note is ${spellPc(low)} instead of ${p.root}. ${'Real play: picked so your hand barely moves between this chord and the ones around it' + (kbr().auto ? '' : `, on your ${prefs.kb}-key keyboard`) + '.'} Your left hand still plays ${p.bass || p.root}, so it still sounds like ${name}.` };
}

// the badge to show for a chord (or null): slash chords always, rearranged right hands only in Real play
export const inversionOf = (name, rhKeys) => slashWhy(name) || (prefs.mode === 'real' ? rhWhy(name, rhKeys) : null);
