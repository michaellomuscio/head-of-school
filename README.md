# Head of School

A management sim: you run an independent K–12 day school in a procedurally generated city. Plain JavaScript and canvas, no dependencies, one generated HTML file.

Play it: https://michaellomuscio.github.io/head-of-school/

## Build

```
node build.js
```

Writes:

- `docs/index.html` — the public page (GitHub Pages serves `docs/` from `main`). Commit it.
- `dist/head-of-school.html` — the same game as a fragment, for publishing as a Claude artifact.
- `dist/index.html` — a full page for local play, with the test helpers included.
- `dist/sim.cjs` — the simulation as a Node module, for the headless tests.

Edit `src/`, never `docs/` or `dist/`: the next build overwrites them.

## Source

| File | What it holds |
| --- | --- |
| `00-core.js` | seeded randomness, math, number formatting |
| `10-data.js` | every definition and most copy: missions, scenarios, programs, buildings, roles, neighborhoods, time areas, strategic-plan pillars |
| `20-city.js` | the 41×41 city grid and its neighborhoods |
| `30-sim.js` | the model. `tick(S)` advances one week. Tuning constants are in `K` at the top; banners and save migration are here too |
| `35-events.js` | the dilemma deck |
| `40-map.js` | the isometric renderer |
| `50-ui.js` | top bar, panels, dialogs |
| `60-main.js` | loop, input, saving, Hall of Heads, sound |
| `90-devtest.js` | scripted click-through; local builds only |
| `page.html` | markup and CSS |

## Tests

```
node test/events.js                        # every choice of every dilemma, every pillar
node test/sim.js matrix 12                 # 3 scenarios x 4 autopilot policies x 8 seeds
node test/sim.js smart 12 7 turnaround     # one run, year by year
node test/proj.js                          # projected vs. actual operating result
```

Click-through of every panel and dialog: open `dist/index.html?auto=1&seen=1&test=1` and read the `TEST` lines in the console (the page title also ends up as `TEST n passed, m failed`).

Other local hooks on `dist/index.html`: `?auto=1&ff=60&theme=dark&tab=money&show=pending&ev=grade&plan=1&pillars=faculty,green&ban=7&days=4,2,1,3,0&over=retired&sc=brink&mission=stem`.

## Releasing

1. `node build.js`, run the tests.
2. Commit `src/` and `docs/` and push to `main`. Pages redeploys in about a minute.
3. Republish `dist/head-of-school.html` to the artifact if that copy should match.
