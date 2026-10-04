# Atlas: the 3D anatomy viewer

A full-screen human figure built from BodyParts3D, segmented into 105 tappable structures (plus the glass skin). Zooming in goes deeper: muscles → organs and bones → organs pulled apart so each one can be tapped on its own. [DESIGN.md](DESIGN.md) is the spec (art direction, data contract, behaviour); this file is the map of the code.

The engine here is framework-free TypeScript on three.js. The app around it (title bar, layer switch, the selection sheet with the pain report, the info sheet) is React in `src/atlas/`, composed in `src/App.tsx`. It installs as an app: `public/manifest.webmanifest`, `public/sw.js`, icons from `tools/icons/`.

## Files

| file | what |
|---|---|
| `viewer.ts` | `mountAnatomyViewer`: DOM, render-on-demand loop, selection, focus, URL params, `window.__atlas` |
| `scene.ts` | renderer, camera, lights, environment, contact shadow |
| `materials.ts` | glass skin (with the scan sweep), tissue, ghosts, selection rim/outline, x-ray, picking ids |
| `model.ts` | GLB loading with progress (placeholder fallback), parts, anchors, explode offsets |
| `footprint.ts` | frontal occupancy grids: explode silhouettes, label anchors, the skeleton's depth |
| `explode.ts` | the explode solver (convex hulls + SAT, ported from the 2D map) |
| `depth.ts` | zoom → layer weights, explode amount, depth name; the layer switch's presets |
| `controls.ts` | orbit rig (inertia, zoom-to-point, animations) and pointer gestures |
| `picking.ts` | GPU picking with the fat-finger radius |
| `tethers.ts` | hairlines from exploded organs back to where they sit |
| `labels.ts` | selection marker (ring on the part), hover tag, aria-live announcer |
| `hud.ts` | first-run hint, loading (with the model's credit), no-WebGL |
| `content.ts` | catalog + Polish copy → `PartInfo` |
| `placeholder.ts` | procedural stand-ins while `public/anatomy/body-m.glb` / `body-f.glb` is missing |
| `style.css` | tokens (on `:root`, shared with `src/atlas/ui.css`) and the viewer's overlays |

Also here: `plain.ts` (plain-language copy from `data/plain.pl.json`: where a part is, one simple sentence, everyday aliases, search suggestions; falls back to the clinical copy) and `search.ts` (everyday-word search: diacritic-insensitive, endings tolerated on aliases and "where", side words like "lewa" put that side first; tests in `search.test.ts`).

And in `src/atlas/`: `TopBar.tsx` (search, flip, info), `LayerSwitch.tsx` + `layers.tsx` (labels, icons, captions), `Sheet.tsx` (bottom sheet on phones, card on the right from 900px; drag handle, animated height), `PartCard.tsx` (plain words first, the atlas detail under "Więcej"), `SearchSheet.tsx`, `WelcomeSheet.tsx` (first visit, re-openable from info), `InfoSheet.tsx`, `install.ts`, `device.ts` (touch detection, safe localStorage, haptic tick), `presence.ts`, `ui.css`.

Data: `data/catalog.json` (structures; id = GLB node name) and `data/content.pl.json` (copy).

## API

```ts
const viewer = mountAnatomyViewer(host, {
  onSelect(part) {},             // PartInfo | null
  onChange({ layer, back }) {},  // live: which layer the depth is at, front or back
})
viewer.select(id | null); viewer.focus(id); viewer.setLayer('organs'); viewer.flip(); viewer.reset()
viewer.setOccluder(sheetElement | null)  // keeps the selection visible above (or beside) a sheet
viewer.setHint('Dotknij dowolnego miejsca' | null)  // the pulsing first-visit hint on the chest
viewer.destroy()
```

The host element's padding tells the viewer how much the chrome covers at the top and bottom (`--chrome-top`, `--chrome-bottom` in `style.css`), so the body is framed between them.

Pain reports store `painId(part.id)` (`src/pain/painId.ts`), not the atlas id: the database only accepts `^[a-zA-Z]+(-(left|right))?$` and keeps the 2D map's ids for parts it already had. `src/pain/painId.test.ts` checks both.

## Deep links and QA hooks

URL params: `?zoom=2.5&az=0&polar=5&layer=organs&sel=heart&focus=heart&nohint&noscan&noonboard` (`noonboard` skips the welcome, `nohint` the pulsing hint). With `sel` and a zoom above 1, the view centres on that part.

`window.__atlas`: `state()`, `parts()`, `project(id)`, `pick(x, y)`, `setView({ zoom, azimuthDeg, polarDeg, target })`, `labelRect()` (the sheet), plus `select`, `focus`, `setLayer`, `flip`, `reset`; `state().hint` is the hint's text. The app adds `window.__atlasUi`: `search(q)`, `openSearch(q)`, `welcome()`, `openWelcome()`. See DESIGN.md §7.

Real WebGL screenshots and trusted touch input in headless Firefox:

```sh
npx vite --port 5181 --strictPort &
node tools/browser/shot.mjs 'http://localhost:5181/?noscan&nohint&zoom=3.8&sel=heart' heart.png 390 844
```

`tools/browser/firefox.mjs` adds `tap`, `doubleTap`, `drag`, `pinch`, `wheel`, `mouseDrag` and console logs.

## Notes

- Render on demand: a frame is drawn only while input, inertia, an animation, the scan sweep or a sheet transition is running. `state().fps` measures consecutive frames only.
- Service worker: production builds register `sw.js?v=<commit>` with the app's scope. Pages are network-first, hashed assets, icons and the model cache-first, all in one cache per build (older ones are deleted on activate). After registering, the page sends the worker what it already loaded, so the model is cached from the first visit. Cross-origin requests (Supabase) are never touched. Not registered in dev, nor in the gdzie-boli build (its `index.html` also drops the manifest).
- Label anchors sit on the part's visible surface, separately for the front and the back (a muscle's footprint is often partly under its neighbours). A muscle hidden from one side (the brachialis under the biceps from the front) is tapped from the other.
- BodyParts3D's external oblique includes its aponeurosis, which covers the rectus abdominis from the front, so the "six-pack" taps as the external oblique.
- `vite.config.ts` limits dependency scanning to the two app entries; otherwise `tools/anatomy/preview.html` pulls in a second copy of three in dev.
