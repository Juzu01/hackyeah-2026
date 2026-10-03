# Atlas: spec for the 3D anatomy viewer

The art direction and engineering contract for `src/anatomy/` and its app chrome in `src/atlas/`. The goal: **extraordinary, simple, and genuinely clinical**, and since people install it on their phones, an app that is pleasant to hold: it should feel like a premium medical-imaging workstation crossed with a modern anatomy atlas, not a game or a children's illustration. Every pixel earns its place.

*Revision 2 (phone first):* the first version's workstation HUD (depth ladder, zoom readout, P/L letters, scale bar, view name, floating callout with a leader line) was too busy on a phone. §6 now describes the simpler app chrome that replaced it.

*Revision 4 (its own look, and a voice):* the near-black-and-mint look read like every other dark app. The atlas is now an **operating theatre**: the body lies on surgical green (red's complement, which is why scrubs are green, so tissue reads cleanly) under a warm lamp, the one accent. Names are set like an anatomical plate (Latin in italic). *(Revision 6: the type is now Nunito with Fraunces for names, as in Doco, see §3.)* The layer switch became a depth gauge at the top left, and the bottom belongs to a voice button shaped like a stethoscope's chest piece: say what hurts and the body shows it (§6).

*Revision 5 (one product with Soleil):* the atlas now lives in a tab of Soleil, the app around it, and shares its palette: black, a faint green light around the body, and a light pastel green `#A6E8C4` as the one accent (no gold). Everything else in revision 4 stands.

## 1. Principles

1. **Clinical restraint.** Near-black canvas and cool neutral hairlines. Colour appears only where it means something: tissue colour on the active layer, plus one accent for "selected / active".
2. **Precision language, app manners.** Latin terminology, thin hairlines, one tag style; but touch targets ≥ 44 px, 15–16 px body text on phones, sentence case, and the safe areas respected.
3. **Zoom is depth.** Zooming in goes deeper: skin → muscles → organs and bones → organs pulled apart (exploded view). A three-way layer switch is a shortcut to the same depths and mirrors the zoom live.
4. **Calm motion.** Critically damped easing, 200–600 ms, no bounce, no wobble. Inertia on rotation. Respect `prefers-reduced-motion`.
5. **One hero.** The body is the whole show. The chrome is a title bar and a bottom control; a selected part always stays visible above (or beside) its sheet.

## 2. Data contract

- `public/anatomy/body.glb` holds one mesh node per catalog entry; **node name = catalog `id`**. Units are metres, +Y up, soles at y = 0, midline x = 0, the patient faces +Z (towards the default camera), and the **patient's left is +X**. Node `extras`: `{ system, layer, side, explode, group }`, copied from the catalog. Geometry is meshopt-compressed and quantized; load it with `GLTFLoader` + `MeshoptDecoder`, using the relative URL `./anatomy/body.glb` (the site lives under a sub-path).
- `src/anatomy/data/catalog.json` is the list of structures (system, layer, side, explode, group).
- `src/anatomy/data/content.pl.json` is the Polish copy per id: `{ name, latin, description, … }`, plus a `groups` map for system labels such as `circulatory → "Układ krążenia"`.
- Attribution is required (CC BY-SA 2.1 JP): "BodyParts3D © The Database Center for Life Science, CC BY-SA 2.1 JP". Show it on the loading screen and in the info sheet.

## 3. Visual tokens

| token | value | use |
|---|---|---|
| `--bg-0` | `#000000` | page edge |
| `--bg-1` | `#08140F` | canvas centre, under a faint green glow |
| `--ink-1` | `#EEF6F1` | primary text |
| `--ink-2` | `#9FB3A8` | secondary text |
| `--ink-3` | `#62756B` | tertiary |
| `--hair` | `rgba(196,232,218,0.13)` | hairlines, borders |
| `--accent` | `#A6E8C4` | pastel green: selection, active layer, primary action, voice button |
| `--glass` | `#CFE9DD` | skin shell rim |
| `--surface-solid` | `#08110D` | sheets |
| `--surface` | `rgba(8,17,13,0.86)` | floating buttons (blurred) |

Tissue palette (desaturated atlas colours, linear-workflow friendly; tune by eye under the final lighting):
muscle `#B66F66` · bone `#D3C8B4` (revision 3: the whole palette softened towards a calm anatomical model; see `materials.ts`) · brain `#C9A2A5` · heart `#A9323A` · aorta `#B23B40` · lungs `#C98E8B` · trachea `#B8C3C8` · esophagus `#B97870` · thyroid `#9C3E4E` · liver `#6D2923` · gallbladder `#4D6B46` · stomach `#C28E78` · spleen `#5D2D40` · pancreas `#CDA87A` · kidneys `#7E342F` · small intestine `#C9928A` · large intestine `#A97965` · urinary bladder `#C8AF7A`.

Typography, bundled via `@fontsource` (no network fonts): **Nunito** (revision 6, the same as Doco: round, warm and easy on the eyes, with Polish and Cyrillic) for all UI text (16–17px body on phones, 1.5 line-height; tabular figures for numbers) and **Fraunces** (`--font-serif`, at SOFT 100 and WONK 1: soft and a little wonky) for names: the app's title (25px), a part's name (30px), Latin (italic), and your own words in the conversation (italic, in „quotes”). No uppercase labels: what a part is goes above its name in plain words with a swatch of its tissue colour (`Układ mięśniowy, strona lewa`). Radii by role: sheets 26px, primary buttons fully round (pill), chips and cards 12–18px.

## 4. Rendering

- `WebGLRenderer({ antialias: true })`, `outputColorSpace = SRGBColorSpace`, `ACESFilmicToneMapping` (exposure ≈ 1.0), pixel ratio `min(devicePixelRatio, 2)`. The clear colour is transparent, so the CSS radial background shows through.
- Environment: `RoomEnvironment` through PMREM at low intensity, for soft speculars on wet tissue.
- Lights: a hemisphere fill (sky `#dfe9f3`, ground `#141a21`), a key light from front-top-left, and a **cool rim light from behind** (`#9cc8ff`) that carves the silhouette.
- **Skin = glass shell.** A custom fresnel `ShaderMaterial`: `alpha = 0.025 + pow(1 - |dot(N, V)|, 2.4) * 0.55`, colour `--glass`, `transparent`, `depthWrite: false`, rendered after opaque objects. Not pickable. On load, run a one-time **scan sweep**: a soft horizontal band of brighter rim light travels from the crown to the soles (~1.6 s, ease-in-out). Skip it under reduced motion.
- **Muscles:** `MeshStandardMaterial` in the tissue colour, roughness ≈ 0.6, metalness 0.
- **Organs:** `MeshPhysicalMaterial` in the tissue colour, roughness ≈ 0.45, light clearcoat (≈ 0.25, roughness 0.4) for a wet-tissue sheen.
- **Bones:** ivory `MeshStandardMaterial`, roughness ≈ 0.75.
- **Ghost state.** When a layer is not the active one, its parts cross-fade to a shared ghost look: a fresnel x-ray in the part's own hue at low alpha (≈ 0.10–0.18 at the rim, ~0 face-on), `depthWrite: false`, not pickable. Ghosts keep anatomical context (muscle silhouettes around the organs) without clutter.
- **Selection:** the selected part keeps its solid material, gets a slight lift (emissive ≈ 0.12 of its own colour) and a crisp **accent rim** (fresnel term in `--accent`, via `onBeforeCompile` or a second shell pass with back-face inflation of ~1.2 mm). Every other part on the active layer desaturates about 45% towards neutral grey, so the eye goes to the selection. Nothing blinks.
- **Grounding:** a soft elliptical contact shadow under the feet (a radial-gradient texture on a plane, opacity ≈ 0.35).
- No bloom, no SSAO, no post-processing chain (phones first). Target 60 fps on a mid-range phone, ≤ 450k triangles, ≤ 8 MB GLB.

## 5. Camera, gestures, depth

- `PerspectiveCamera`, **fov 30°** (telephoto, atlas-like, little distortion), orbiting a target. The initial framing fits the whole body (≈ 1.75 m) with comfortable margins in both portrait and landscape.
- **One finger / left mouse:** turntable rotate. Azimuth is unlimited; polar angle is clamped to about ±25° from horizontal. Inertia with exponential decay.
- **Two fingers:** pinch to zoom **towards the point between the fingers** (the 3D point under the midpoint; fall back to a plane through the target), plus pan by the midpoint delta. **Wheel / trackpad pinch:** zoom to the cursor. **Right-drag or shift-drag:** pan. The target stays inside the body's bounds.
- Zoom factor `z = fitDistance / distance` ranges from 0.85 to about 9.
- **Depth mapping** (all values are interpolated and eased):
  - `z < 1.35`: **Muscles** layer active and solid; deep layer ghosted; skin shell visible.
  - `1.35 → 2.0`: muscles cross-fade to ghost while organs and bones cross-fade to solid. Pickability switches at the midpoint.
  - `≥ 2.0`: **Organs and bones** active.
  - `2.2 → 2.9`: **Exploded view.** Organs (catalog `explode: true`) slide along precomputed offsets so that, seen from the front, no two organs overlap. Each one shows a hairline tether back to its anatomical origin, with a tiny dot at the origin. Bones stay in place.
  - The skin shell rim fades slightly as you go deeper (it's context, not content).
- **Explode solver.** Project each organ's vertices onto the frontal (XY) plane, take convex hulls, spread each touching cluster about its area-weighted centre (×1.25 in X, ×1.1 in Y), then relax pairwise with SAT pushes (smaller organs move more) until every pair is ≥ 12 mm apart. Solve once at load (cache per session). The previous 2D solver in git history (`src/body/layout.ts`, `src/body/geometry.ts`: `convexHull`, `satAxes`, `satPush`, `solveExplode`) does exactly this; port it.
- **Tap** selects the top-most pickable part under the finger (raycast against the active layer only). If the centre ray misses, sample a ring of rays (≤ 18 px radius) and take the nearest hit, so fingers don't have to be surgical. Tapping empty space, or the selected part again, deselects.
- **Double tap** on a part focuses it: animate the target and distance so the part is framed, deep enough for its layer to be active (organs: fully exploded). Double tap on empty space resets the view.
- **Keyboard:** `Esc` deselects, `0` resets, `1`/`2`/`3` pick a layer, `f` turns the body round, arrow keys rotate, `+`/`-` zoom.

## 6. App chrome (Polish copy, phone first)

- **Title bar** (top, below the safe area, a soft fade): `Atlas ciała` in the title face, and on the right: search (magnifier), a pill that says which side you'll see (`Tył` / `Przód`, turns the body round) and `i` (info sheet). The bar lets gestures through except on its buttons.
- **Depth gauge** (top left, under the title): `Mięśnie → Narządy → Osobno`, top to bottom, each with its icon, on a thin vertical line like a probe going in; a lamp-lit bead slides to the layer in view. Tapping animates the camera to that depth (muscles = the whole body; organs = the torso with organs and bones in place; apart = the torso fully exploded) and shows a one-line caption above the dock for ~2 s. It mirrors the depth live while pinching. Hidden on phones while a sheet is open.
- **Voice dock** (bottom centre, thumb reach): a 70px lamp-coloured disc with a fine rim, a stethoscope's chest piece, labelled `Powiedz, co boli`. One tap opens the conversation and starts listening (Web Speech API, pl-PL); rings travel out from the rim while it listens. Where the browser can't listen it says `Napisz, co boli` and opens the conversation for typing.
- **Conversation** (the sheet, in place of the part card): a transcript, not bubbles. Your words on the right, quoted, in italic; the atlas's answers on the left on a lamp-coloured margin rule. Answers come from `src/atlas/chat/` offline: `understand.ts` turns everyday Polish ("boli mnie lewe kolano, tak na 6, kłuje") into an intent, `assistant.ts` answers it and moves the body (focus a part, change layer, turn round). A pain report is drafted in place (intensity 1–10, types) to check and save; "where does it hurt?" can be answered by tapping the body. Red flags (chest pain, breathlessness, stroke signs, suicidal thoughts) answer with a call button (112, Centrum Wsparcia 800 70 2222) instead. Answers can be read aloud (speaker toggle, remembered). Questions it can't answer go to `VITE_CHAT_URL` when set (`remote.ts`).
- **Selection sheet.** Tapping a part opens a bottom sheet (phone) or a card on the right (≥ 900px): drag handle, **where** the part is in plain words with a swatch of its tissue colour, the name (30px), **one plain sentence** (`data/plain.pl.json`), `Więcej` for the atlas detail (Latin, the clinical description, action, exercises, fact, sport, the system), and a full-width `Zgłoś ból` pill. The part keeps a lamp-coloured ring and the view shifts so it stays in the free area above the sheet.
- **Pain report** replaces the card inside the same sheet (cross-fade, height animates), with a back button to the card: the scale grouped in words (lekki, umiarkowany, silny, bardzo silny) with faces, pain types, save; then `Zapisano`, the latest entries and `Wróć do ciała`.
- **For people new to anatomy:** a one-time **welcome** sheet ("Poznaj swoje ciało i zapisz, co cię boli", three tips, `Zaczynamy`; skippable, re-openable from `i`), then a **pulsing hint** on the chest (`Dotknij dowolnego miejsca`) until the first tap. **Search** opens a sheet for everyday words ("kolano", "lewa łydka") with suggestion chips and big result rows (name, where, mięsień/narząd/kość); picking one flies there and opens the card. A short vibration confirms a selection; text is rem-based, at least 16px for body copy on phones. `?noonboard` and `?nohint` turn the welcome and the hint off for screenshots.
- **Info sheet** (`i`): how to use it, installing it (`Zainstaluj aplikację` via `beforeinstallprompt`; on iOS: Udostępnij → Do ekranu początkowego), the model's attribution, and the build.
- **Hover** (mouse only): a small name tag by the cursor.
- **Loading:** a 160px progress bar and `Wczytywanie modelu · 42%`, with the model's credit at the bottom; then a cross-fade into the scene and the scan sweep. **No WebGL:** a calm centred message.
- **Installable:** `public/manifest.webmanifest` (standalone, portrait), icons from `tools/icons/`, and `public/sw.js` (network-first pages, cache-first assets and the model, one cache per build).

## 7. Engine API and test hooks

```ts
mountAnatomyViewer(host: HTMLElement, opts?: {
  onSelect?(part: PartInfo | null): void
  onChange?(state: { layer: 'muscles' | 'organs' | 'exploded'; back: boolean }): void  // live, for the chrome
}): {
  select(id: string | null): void
  focus(id: string): void      // animate to the part (deep enough to reveal it) and select it
  setLayer(layer): void        // what the layer switch does
  flip(): void                 // front ↔ back
  reset(): void
  setOccluder(el: HTMLElement | null): void  // the sheet: the view keeps the selection clear of it
  destroy(): void
}
```

`window.__atlas` (always present, used by automated QA):
- `state()` → `{ ready, zoom, depth: 'skin'|'muscles'|'deep'|'exploded', layer, explode: 0..1, azimuthDeg, back, selected, fps, source }`
- `parts()` → `[{ id, system, layer, side, explode, visible, pickable }]`
- `project(id)` → `{ x, y, onScreen }`: the part's current (exploded) anchor in CSS pixels
- `pick(x, y)` → id | null: the same picking a tap uses
- `setView({ zoom?, azimuthDeg?, polarDeg?, target?: [x, y, z] | id })`: jump instantly, no animation
- `labelRect()` → DOMRect of the selection sheet, or null
- `select(id)`, `focus(id)`, `setLayer(layer)`, `flip()`, `reset()`

URL params (for deep links and screenshots): `?zoom=2.5&az=0&layer=organs&sel=heart&focus=heart&nohint&noscan`.

## 8. Code layout

`src/anatomy/` (framework-free): `viewer.ts` (mount, loop, state, API), `scene.ts` (renderer, lights, environment, floor), `materials.ts` (glass shell, ghost, tissue, selection rim), `controls.ts` (gestures, inertia, zoom-to-point), `depth.ts` (zoom → layer weights, layer presets), `explode.ts` (solver), `picking.ts`, `labels.ts` (selection marker, hover tag, announcer), `hud.ts` (hint, loading, no-WebGL), `placeholder.ts` (procedural stand-ins built from the catalog when the GLB is missing), `style.css`, `README.md`.

`src/atlas/` (React chrome): `TopBar`, `LayerSwitch`, `Sheet` (bottom sheet / side card), `PartCard`, `InfoSheet`, `install.ts`, `ui.css`. `src/App.tsx` composes them with the viewer and `src/pain/PainPanel.tsx`.
