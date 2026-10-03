# Atlas: spec for the 3D anatomy viewer

The art direction and engineering contract for `src/anatomy/`. The goal: **extraordinary, simple, and genuinely clinical**. It should feel like a premium medical-imaging workstation crossed with a modern anatomy atlas, not a game or a children's illustration. Every pixel earns its place.

## 1. Principles

1. **Clinical restraint.** Near-black canvas and cool neutral hairlines. Colour appears only where it means something: tissue colour on the active layer, plus one accent for "selected / active".
2. **Precision language.** Thin 1px lines, small-caps tracked labels, a real metric scale bar (the model is in real millimetres), patient-orientation markers, Latin terminology. This is how medical software speaks.
3. **Zoom is depth.** No buttons. Zooming in goes deeper: skin → muscles → organs and bones → organs pulled apart (exploded view). The UI only *tells* you where you are (depth ladder).
4. **Calm motion.** Critically damped easing, 200–600 ms, no bounce, no wobble. Inertia on rotation. Respect `prefers-reduced-motion`.
5. **One hero.** The body is the whole show. The HUD is quiet, peripheral, ≤ 11px, and never covers the figure on a phone.

## 2. Data contract

- `public/anatomy/body.glb` holds one mesh node per catalog entry; **node name = catalog `id`**. Units are metres, +Y up, soles at y = 0, midline x = 0, the patient faces +Z (towards the default camera), and the **patient's left is +X**. Node `extras`: `{ system, layer, side, explode, group }`, copied from the catalog. Geometry is meshopt-compressed and quantized; load it with `GLTFLoader` + `MeshoptDecoder`, using the relative URL `./anatomy/body.glb` (the site lives under a sub-path).
- `src/anatomy/data/catalog.json` is the list of structures (system, layer, side, explode, group).
- `src/anatomy/data/content.pl.json` is the Polish copy per id: `{ name, latin, description, … }`, plus a `groups` map for system labels such as `circulatory → "Układ krążenia"`.
- Attribution is required (CC BY-SA 2.1 JP): "BodyParts3D © The Database Center for Life Science, CC BY-SA 2.1 JP". Show it in the HUD credit line.

## 3. Visual tokens

| token | value | use |
|---|---|---|
| `--bg-0` | `#04060A` | page edge |
| `--bg-1` | `#0A1017` | canvas centre (radial, slightly above body centre) |
| `--ink-1` | `#E9EEF3` | primary text |
| `--ink-2` | `#9DA9B5` | secondary text |
| `--ink-3` | `#5F6B77` | tertiary, HUD |
| `--hair` | `rgba(190,215,235,0.16)` | hairlines, ticks |
| `--accent` | `#5BE3CF` | selection, active depth, leader lines (clinical mint-teal) |
| `--glass` | `#BFDDF5` | skin shell rim |

Tissue palette (desaturated atlas colours, linear-workflow friendly; tune by eye under the final lighting):
muscle `#9C4A44` · bone `#D8D0C0` · brain `#C9A2A5` · heart `#A9323A` · aorta `#B23B40` · lungs `#C98E8B` · trachea `#B8C3C8` · esophagus `#B97870` · thyroid `#9C3E4E` · liver `#6D2923` · gallbladder `#4D6B46` · stomach `#C28E78` · spleen `#5D2D40` · pancreas `#CDA87A` · kidneys `#7E342F` · small intestine `#C9928A` · large intestine `#A97965` · urinary bladder `#C8AF7A`.

Typography: **Inter** (variable) for text and **IBM Plex Mono** for numbers and measurements, bundled via `@fontsource` (no network fonts). HUD labels are uppercase, 10–11px, letter-spacing 0.14–0.18em. Body copy is 13px with 1.45 line-height.

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
  - `2.3 → 3.6`: **Exploded view.** Organs (catalog `explode: true`) slide along precomputed offsets so that, seen from the front, no two organs overlap. Each one shows a hairline tether back to its anatomical origin, with a tiny dot at the origin. Bones stay in place.
  - The skin shell rim fades slightly as you go deeper (it's context, not content).
- **Explode solver.** Project each organ's vertices onto the frontal (XY) plane, take convex hulls, spread each touching cluster about its area-weighted centre (×1.25 in X, ×1.1 in Y), then relax pairwise with SAT pushes (smaller organs move more) until every pair is ≥ 12 mm apart. Solve once at load (cache per session). The previous 2D solver in git history (`src/body/layout.ts`, `src/body/geometry.ts`: `convexHull`, `satAxes`, `satPush`, `solveExplode`) does exactly this; port it.
- **Tap** selects the top-most pickable part under the finger (raycast against the active layer only). If the centre ray misses, sample a ring of rays (≤ 18 px radius) and take the nearest hit, so fingers don't have to be surgical. Tapping empty space, or the selected part again, deselects.
- **Double tap** on a part focuses it: animate the target and distance so the part is framed, deep enough for its layer to be active (organs: fully exploded). Double tap on empty space resets the view.
- **Keyboard:** `Esc` deselects, `0` resets, arrow keys rotate, `+`/`-` zoom.

## 6. Labels and HUD (Polish copy)

**Selection callout.** An anchor dot on the part, a 1px accent leader line, then a text block with no card or box (just type on the dark canvas, with a hairline under the tag):

```
UKŁAD KRĄŻENIA · STRONA LEWA      ← 10.5px, tracking .16em, accent
Serce                             ← 22px, 600, ink-1
cor                               ← 13px italic, ink-2
Mięśniowa pompa, która…           ← 13px, ink-2, max 2–3 lines, max-width 260px
```

- **Desktop / wide:** the text block sits in the side margin nearer to the part, with an elbow leader (horizontal then diagonal), like an atlas callout.
- **Phone (< 640px):** the text block docks bottom-left above the HUD, with the leader running from the part to the block's top edge. It must never cover the selected part. If the part is low on screen, dock the block top-left instead.
- The block re-anchors every frame (it follows rotation and explode), fades in over 180 ms, and is announced via an `aria-live="polite"` region.
- **Hover** (fine pointers only): a tiny name-only tag next to the cursor.

**HUD** (quiet, peripheral, pointer-events none):
- **Top-left:** `ATLAS ANATOMICZNY` (11px, 600, tracking .18em, ink-1); below it `Widok przedni` / `Widok boczny lewy` / `Widok tylny` / `Widok boczny prawy`, chosen from the azimuth (ink-3).
- **Top-right:** the **depth ladder**, four rows with tick marks: `SKÓRA`, `MIĘŚNIE`, `NARZĄDY I KOŚCI`, `ROZWARSTWIENIE`. The current depth row is accent and the others ink-3. Under it, the zoom readout in mono (`2.4×`).
- **Left and right edge, mid-height:** patient-orientation letters `P` (patient's right) and `L` (patient's left), in mono and ink-3. They follow rotation: in the front view P is on the screen's left (radiological convention), and they swap for the back view. Within ±25° of a pure side view, fade both out, because left and right are ambiguous there.
- **Bottom-left:** a metric **scale bar**, a hairline with end ticks whose length on screen equals 5 / 10 / 20 / 50 cm (pick the largest that fits ≤ 120px), labelled in mono (`10 cm`). It updates live with zoom.
- **Bottom-right:** the credit `BodyParts3D © DBCLS · CC BY-SA 2.1 JP` (9.5px, ink-3).
- **First-run hint** (bottom-centre): a thin line icon of two fingers spreading, plus `Rozsuń palce, aby zajrzeć głębiej` (touch) or `Przewiń, aby zajrzeć głębiej · przeciągnij, aby obrócić` (mouse). It fades out after the first zoom/rotate or after 7 s. A `?nohint` param disables it.
- **Loading:** a centred 140px hairline progress bar plus `WCZYTYWANIE MODELU · 42%` (mono), then a cross-fade into the scene and the scan sweep.
- **No WebGL:** a calm centred message in the same type style.

## 7. Engine API and test hooks

```ts
mountAnatomyViewer(host: HTMLElement, opts?: { onSelect?(part: PartInfo | null): void }): {
  select(id: string | null): void
  focus(id: string): void      // animate to the part (deep enough to reveal it) and select it
  reset(): void
  destroy(): void
}
```

`window.__atlas` (always present, used by automated QA):
- `state()` → `{ ready, zoom, depth: 'skin'|'muscles'|'deep'|'exploded', explode: 0..1, azimuthDeg, selected, fps }`
- `parts()` → `[{ id, system, layer, side, explode, visible, pickable }]`
- `project(id)` → `{ x, y, onScreen }`: the part's current (exploded) centre in CSS pixels
- `pick(x, y)` → id | null: the same picking a tap uses
- `setView({ zoom?, azimuthDeg?, polarDeg?, target?: [x, y, z] | id })`: jump instantly, no animation
- `labelRect()` → DOMRect of the callout block, or null

URL params (for deep links and screenshots): `?zoom=2.5&az=0&sel=heart&focus=heart&nohint&noscan`.

## 8. Code layout

`src/anatomy/`: `viewer.ts` (mount, loop, state), `scene.ts` (renderer, lights, environment, floor), `materials.ts` (glass shell, ghost, tissue, selection rim), `controls.ts` (gestures, inertia, zoom-to-point), `depth.ts` (zoom → layer weights), `explode.ts` (solver), `picking.ts`, `labels.ts`, `hud.ts`, `placeholder.ts` (procedural stand-ins built from the catalog when the GLB is missing), `style.css`, `README.md`. `src/App.tsx` only mounts it. Framework-free TypeScript inside; React is just the host.
