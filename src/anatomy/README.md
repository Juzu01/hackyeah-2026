# Atlas: the 3D anatomy viewer

A full-screen human figure built from BodyParts3D, segmented into 105 tappable structures (plus the glass skin). Zooming in goes deeper: muscles → organs and bones → organs pulled apart so each one can be tapped on its own. [DESIGN.md](DESIGN.md) is the spec (art direction, data contract, behaviour); this file is the map of the code.

Framework-free TypeScript on three.js. `src/App.tsx` only mounts it and hosts the pain-report sheet.

## Files

| file | what |
|---|---|
| `viewer.ts` | `mountAnatomyViewer`: DOM, render-on-demand loop, selection, focus, URL params, `window.__atlas` |
| `scene.ts` | renderer, camera, lights, environment, contact shadow |
| `materials.ts` | glass skin (with the scan sweep), tissue, ghosts, selection rim/outline, x-ray, picking ids |
| `model.ts` | GLB loading with progress (placeholder fallback), parts, anchors, explode offsets |
| `footprint.ts` | frontal occupancy grids: explode silhouettes, label anchors, the skeleton's depth |
| `explode.ts` | the explode solver (convex hulls + SAT, ported from the 2D map) |
| `depth.ts` | zoom → layer weights, explode amount, depth name |
| `controls.ts` | orbit rig (inertia, zoom-to-point, animations) and pointer gestures |
| `picking.ts` | GPU picking with the fat-finger radius |
| `tethers.ts` | hairlines from exploded organs back to where they sit |
| `labels.ts` | selection callout (with the "Zgłoś ból" action), hover tag, aria-live announcer |
| `hud.ts` | title and view, depth ladder, P/L letters, scale bar, credit, hint, loading, no-WebGL |
| `content.ts` | catalog + Polish copy → `PartInfo` |
| `placeholder.ts` | procedural stand-ins while `public/anatomy/body.glb` is missing |
| `style.css` | tokens (on `:root`, shared with the pain sheet) and overlay styles |

Data: `data/catalog.json` (structures; id = GLB node name) and `data/content.pl.json` (copy).

## API

```ts
const viewer = mountAnatomyViewer(host, {
  onSelect(part) {},                                  // PartInfo | null
  action: { label: 'Zgłoś ból', run(part) {} },       // one quiet button in the callout
  build: import.meta.env.VITE_COMMIT_SHA,             // short hash in the credit line
})
viewer.select(id | null); viewer.focus(id); viewer.reset()
viewer.setOccluder(sheetElement | null)  // keeps the selection visible above a bottom sheet
viewer.destroy()
```

Pain reports store `painId(part.id)` (`src/pain/painId.ts`), not the atlas id: the database only accepts `^[a-zA-Z]+(-(left|right))?$` and keeps the 2D map's ids for parts it already had. `src/pain/painId.test.ts` checks both.

## Deep links and QA hooks

URL params: `?zoom=2.5&az=0&polar=5&sel=heart&focus=heart&nohint&noscan`. With `sel` and a zoom above 1, the view centres on that part.

`window.__atlas`: `state()`, `parts()`, `project(id)`, `pick(x, y)`, `setView({ zoom, azimuthDeg, polarDeg, target })`, `labelRect()`, plus `select`, `focus`, `reset`. See DESIGN.md §7.

Real WebGL screenshots and trusted touch input in headless Firefox:

```sh
npx vite --port 5181 --strictPort &
node tools/browser/shot.mjs 'http://localhost:5181/?noscan&nohint&zoom=3.8&sel=heart' heart.png 390 844
```

`tools/browser/firefox.mjs` adds `tap`, `doubleTap`, `drag`, `pinch`, `wheel`, `mouseDrag` and console logs.

## Notes

- Render on demand: a frame is drawn only while input, inertia, an animation, the scan sweep or a sheet transition is running. `state().fps` measures consecutive frames only.
- Label anchors sit on the part's visible surface, separately for the front and the back (a muscle's footprint is often partly under its neighbours). A muscle hidden from one side (the brachialis under the biceps from the front) is tapped from the other.
- BodyParts3D's external oblique includes its aponeurosis, which covers the rectus abdominis from the front, so the "six-pack" taps as the external oblique.
- `vite.config.ts` limits dependency scanning to the two app entries; otherwise `tools/anatomy/preview.html` pulls in a second copy of three in dev.
