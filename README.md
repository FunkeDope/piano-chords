# Piano chord sheet

Paste a guitar tab (chords above lyrics) and get a colour-coded piano chord sheet, chord diagrams and a practice mode.
Plain HTML, CSS and JavaScript modules: no build step, no dependencies. GitHub Pages serves the repo as-is.

## Layout

```
index.html            page markup (toolbar, sheet, cards panel, practice dock, popovers)
css/
  base.css            colour tokens, buttons, toolbar
  layout.css          sheet column + cards panel
  sheet.css           chords, lyrics, tab notes, key bar
  cards.css           chord diagrams
  practice.css        practice dock
  popups.css          Songs and Settings popovers
  mobile.css          phone layout (keep last)
js/
  main.js             entry point: wires everything up, loads the last song
  theory.js           note names, chord parsing, transposing, colours
  prefs.js            saved choices: keyboard size, Normal / Real play, Walks
  voicing.js          which keys and fingers play each chord, left-hand walks
  tab.js              reading pasted tabs: capo/tuning, line types, fret-number tab
  inversions.js       the ⇄ "why is this an inversion" text
  render.js           builds the song sheet
  cards.js            chord diagram cards and their sizing
  practice.js         practice dock, finger arrows, karaoke ball
  autoscroll.js       hands-free scrolling
  songs.js            paste box, history, export / import
  settings.js         settings popover, screen wake lock
  ui.js               hover/tap highlighting, tooltips, popover placement, phone controls
  util.js / icons.js  small shared helpers
examples/             the first-visit example song
```

## Run locally

ES modules need a web server (opening `index.html` as a file won't work):

```
npx serve .
```
