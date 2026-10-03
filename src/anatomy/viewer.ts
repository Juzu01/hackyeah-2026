// The atlas viewer: mounts the canvas and its overlays into a host element,
// loads the model, and renders on demand, only while input, inertia, an
// animation or loading is changing something. Framework-free: the app's chrome
// (title bar, layer switch, sheets) talks to it through the returned handle.

import '@fontsource-variable/nunito'
import '@fontsource-variable/nunito/wght-italic.css'
import './style.css'

import { Box3, Group, MathUtils, Mesh, Plane, Ray, SphereGeometry, Vector3, type Material } from 'three'
import type { PartInfo } from './content.ts'
import { attachGestures, CameraRig, type View } from './controls.ts'
import { createDepthState, depthAt, FOCUS_ZOOM, LAYER_ZOOM, layerOf, type DepthName, type LayerName } from './depth.ts'
import { BodyHint, Hud } from './hud.ts'
import { Announcer, HoverTag, Marker } from './labels.ts'
import { AtlasMaterials, ORDER, setGhostWeight, setSolidWeight } from './materials.ts'
import { buildAtlas, loadModel, type Atlas, type Part } from './model.ts'
import { PICK_RADIUS, Picker, type Hit } from './picking.ts'
import { createRenderer, createStage, FOV, type Stage } from './scene.ts'
import { Tethers } from './tethers.ts'

/** What the chrome mirrors: the layer the depth is at, and whether we're looking at the back. */
export interface ViewerState {
  layer: LayerName
  back: boolean
}

export interface ViewerOptions {
  onSelect?(part: PartInfo | null): void
  /** Called when the layer or the front/back side changes (live, while zooming and rotating). */
  onChange?(state: ViewerState): void
}

export interface AnatomyViewer {
  select(id: string | null): void
  /** Animates to the part (deep enough to reveal it) and selects it. */
  focus(id: string): void
  /** Animates to a layer's depth: the whole body for muscles, the torso for organs and the exploded view. */
  setLayer(layer: LayerName): void
  /** Turns the body round: front ↔ back. */
  flip(): void
  reset(): void
  /** A pulsing "touch here" hint on the body, or null to hide it. */
  setHint(text: string | null): void
  /**
   * A sheet covering the bottom of the view (or a card on its right edge): the
   * picture shifts to the free area and the selection stays visible in it.
   */
  setOccluder(el: HTMLElement | null): void
  destroy(): void
}

interface ViewSpec {
  zoom?: number
  azimuthDeg?: number
  polarDeg?: number
  target?: [number, number, number] | string
}

/** Test hooks for automated QA (DESIGN.md §7). */
export interface AtlasHooks {
  state(): {
    ready: boolean
    zoom: number
    depth: DepthName
    layer: LayerName
    explode: number
    azimuthDeg: number
    back: boolean
    selected: string | null
    hint: string | null
    fps: number
    source: 'glb' | 'placeholder' | null
  }
  parts(): { id: string; system: string; layer: string; side: string | null; explode: boolean; visible: boolean; pickable: boolean }[]
  project(id: string): { x: number; y: number; onScreen: boolean } | null
  pick(x: number, y: number): string | null
  setView(view: ViewSpec): void
  /** The selection card (the occluding sheet), or null. */
  labelRect(): DOMRect | null
  select(id: string | null): void
  focus(id: string): void
  setLayer(layer: LayerName): void
  flip(): void
  reset(): void
}

declare global {
  interface Window {
    __atlas?: AtlasHooks
  }
}

/** Unselected tissue on the active layer fades this far towards grey. */
const DESAT = 0.45
/** How much darker the skeleton gets at full explode. */
const BONE_DIM = 0.38
const SCAN_MS = 1600
const SCAN_DELAY = 280
const FOCUS_MS = 700
const LAYER_MS = 650
const FLIP_MS = 700
const KEY_STEP = MathUtils.degToRad(15)
/** Placeholder bounds until the model is in: a 1.75 m figure. */
const BODY = new Box3(new Vector3(-0.3, 0, -0.15), new Vector3(0.3, 1.75, 0.15))
/** Organs left out of the torso framing of the organ layers (the head is its own region). */
const NOT_TORSO = new Set(['brain'])

const tmp = new Vector3()
const tmp2 = new Vector3()
const forward = new Vector3()
const plane = new Plane()
const ray = new Ray()
const screen = { x: 0, y: 0 }

class Viewer implements AnatomyViewer {
  private readonly host: HTMLElement
  private readonly options: ViewerOptions
  private readonly canvas = document.createElement('canvas')
  private readonly hud: Hud
  private readonly hint: BodyHint
  private readonly marker: Marker
  private readonly hover: HoverTag
  private readonly announcer: Announcer
  private readonly renderer
  private readonly stage: Stage | null = null
  private readonly materials = new AtlasMaterials()
  private readonly rig = new CameraRig()
  private readonly depth = createDepthState()
  private readonly focusDepth = createDepthState()
  private readonly abort = new AbortController()
  private readonly cleanup: (() => void)[] = []
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  private readonly params = new URLSearchParams(location.search)

  private atlas: Atlas | null = null
  private source: 'glb' | 'placeholder' | null = null
  private picker: Picker | null = null
  private tethers: Tethers | null = null
  private selected: Part | null = null
  private outlines: Mesh[] = []
  private ready = false
  private destroyed = false
  /** Where the organ layers look: the torso at rest, and the torso's organs fully exploded. */
  private readonly torso = new Vector3(0, 1.1, 0)
  private readonly torsoExploded = new Vector3(0, 1.1, 0)

  private width = 1
  private height = 1
  /** Bands the app's chrome covers at the top and bottom (the host's padding). */
  private chrome = { top: 0, bottom: 0 }
  private frame = 0
  private lastTick = 0
  private fps = 0
  private lastExplode = -1
  private desat = 0
  /** Sheet insets (bottom and right), eased towards their targets. */
  private insetB = 0
  private insetR = 0
  private targetB = 0
  private targetR = 0
  private sheet: HTMLElement | null = null
  private occluder: ResizeObserver | null = null
  private scanStart = -1
  private hoverFrame = 0
  private hoverAt: { x: number; y: number } | null = null
  private pinchPoint = new Vector3()
  private lastTap: { part: Part | null; time: number } | null = null
  private dragging = false
  /** The layer a layer button is animating to; reported instead of the in-between depths. */
  private layerGoal: LayerName | null = null
  private reported = ''

  constructor(host: HTMLElement, options: ViewerOptions) {
    this.host = host
    this.options = options
    host.classList.add('atlas')
    this.canvas.className = 'atlas-canvas'
    this.canvas.setAttribute('role', 'img')
    this.canvas.setAttribute(
      'aria-label',
      'Model 3D ciała człowieka. Przybliżanie odsłania głębsze warstwy: mięśnie, narządy i kości.',
    )
    host.append(this.canvas)
    this.hint = new BodyHint(host)
    this.marker = new Marker(host)
    this.hover = new HoverTag(host)
    this.hud = new Hud(host)
    this.announcer = new Announcer(host)

    this.renderer = createRenderer(this.canvas)
    if (!this.renderer) {
      this.hud.noWebGL()
      return
    }
    this.stage = createStage(this.renderer)

    const resize = new ResizeObserver(() => this.resize())
    resize.observe(host)
    this.cleanup.push(() => resize.disconnect())
    this.resize()

    this.cleanup.push(attachGestures(this.canvas, this.gestures()))
    const onKey = (e: KeyboardEvent) => this.onKey(e)
    window.addEventListener('keydown', onKey)
    this.cleanup.push(() => window.removeEventListener('keydown', onKey))
    const onLost = (e: Event) => e.preventDefault()
    const onRestored = () => this.requestRender()
    this.canvas.addEventListener('webglcontextlost', onLost)
    this.canvas.addEventListener('webglcontextrestored', onRestored)

    void this.load()
  }

  // ── Loading ────────────────────────────────────────────────────────────

  private async load() {
    try {
      const model = await loadModel((f) => this.hud.setProgress(f), this.abort.signal)
      if (this.destroyed) return
      this.source = model.source
      this.atlas = buildAtlas(model, this.materials)
    } catch (err) {
      if (!this.destroyed) console.error('Atlas: the model failed to load', err)
      return
    }
    const atlas = this.atlas
    const { scene, shadow } = this.stage!
    const body = new Group()
    body.name = 'atlas'
    for (const p of atlas.parts) body.add(p.pivot)
    scene.add(body)
    this.tethers = new Tethers(atlas.parts)
    this.tethers.setPixelRatio(this.renderer!.getPixelRatio())
    scene.add(this.tethers.group)
    this.picker = new Picker(this.renderer!, atlas.parts)

    const centre = atlas.bounds.getCenter(tmp)
    const size = atlas.bounds.getSize(tmp2)
    shadow.position.set(centre.x, atlas.bounds.min.y + 0.001, centre.z)
    shadow.scale.set(size.x * 1.25, size.z * 2.4, 1)
    this.rig.bounds.copy(atlas.reach).expandByScalar(0.04)
    this.frameTorso(atlas)
    this.fit()
    this.rig.target.copy(this.rig.home)
    this.rig.distance = this.rig.fitDistance

    this.applyView()
    this.applyDepth()
    this.precompile()
    this.applyParams()
    this.ready = true
    this.host.classList.add('is-ready')
    this.hud.ready()
    // The sweep starts once the canvas has mostly faded in.
    if (!this.reducedMotion.matches && !this.params.has('noscan')) this.scanStart = performance.now() + SCAN_DELAY
    this.requestRender()
  }

  /** Centres of the torso's organs, at rest and exploded: where the organ layers look. */
  private frameTorso(atlas: Atlas) {
    const rest = new Box3()
    const exploded = new Box3()
    const box = new Box3()
    for (const p of atlas.parts) {
      if (p.entry.system !== 'organ' || NOT_TORSO.has(p.id)) continue
      rest.union(p.box)
      exploded.union(box.copy(p.box).translate(p.offset))
    }
    if (rest.isEmpty()) return
    rest.getCenter(this.torso)
    exploded.getCenter(this.torsoExploded)
  }

  /** Compiles every material variant now (solid and cross-fading), so zooming never stalls on a shader. */
  private precompile() {
    const { scene, camera } = this.stage!
    const renderer = this.renderer!
    const dummies = new Group()
    const geometry = new SphereGeometry(0.001, 4, 2)
    for (const m of this.materials.all()) dummies.add(new Mesh(geometry, m))
    scene.add(dummies)
    const lit: Material[] = []
    for (const t of this.materials.tissues.values()) lit.push(t.solid, t.selected)
    const saved = this.materials.all().map((m) => [m.visible, m.transparent] as const)
    for (const transparent of [true, false]) {
      for (const m of lit) {
        m.transparent = transparent
        m.needsUpdate = true
      }
      for (const m of this.materials.all()) m.visible = true
      renderer.compile(scene, camera)
    }
    this.materials.all().forEach((m, i) => {
      m.visible = saved[i][0]
      if (m.transparent !== saved[i][1]) {
        m.transparent = saved[i][1]
        m.needsUpdate = true
      }
    })
    scene.remove(dummies)
    geometry.dispose()
    this.picker?.compile(camera)
  }

  /** ?zoom=2.5&az=0&polar=5&layer=organs&sel=heart&focus=heart (plus ?noscan, read elsewhere). */
  private applyParams() {
    const num = (k: string) => {
      const v = Number.parseFloat(this.params.get(k) ?? '')
      return Number.isFinite(v) ? v : undefined
    }
    const layer = this.params.get('layer') as LayerName | null
    if (layer && layer in LAYER_ZOOM) this.setView({ zoom: LAYER_ZOOM[layer], target: this.layerTarget(layer).toArray() })
    const sel = this.params.get('sel')
    const zoom = num('zoom')
    const view: ViewSpec = { zoom, azimuthDeg: num('az'), polarDeg: num('polar') }
    // A deep link to a part at some zoom should show that part.
    if (sel && zoom !== undefined && zoom > 1.05 && this.atlas?.byId.has(sel)) view.target = sel
    this.setView(view)
    if (sel) this.select(sel)
    const focus = this.params.get('focus')
    if (focus) this.focus(focus)
  }

  // ── Frame loop ─────────────────────────────────────────────────────────

  private requestRender = () => {
    if (!this.frame && !this.destroyed && this.stage) this.frame = requestAnimationFrame(this.tick)
  }

  private tick = (now: number) => {
    this.frame = 0
    const gap = now - this.lastTick
    const dt = Math.min(0.05, Math.max(0.001, gap / 1000))
    // Only consecutive frames count towards the frame rate.
    if (gap < 100) this.fps = this.fps ? MathUtils.lerp(this.fps, 1000 / Math.max(1, gap), 0.08) : 1000 / Math.max(1, gap)
    this.lastTick = now

    let busy = this.rig.step(now, dt)
    busy = this.ease(dt) || busy
    busy = this.scan(now) || busy
    this.applyView()
    this.applyDepth()
    this.renderer!.render(this.stage!.scene, this.stage!.camera)
    this.updateOverlay()
    if (!this.rig.animating) this.layerGoal = null
    this.report()
    if (busy) this.requestRender()
  }

  /** Eases the selection's desaturation and the sheet insets; true while still moving. */
  private ease(dt: number): boolean {
    const k = this.reducedMotion.matches ? 1 : 1 - Math.exp(-dt / 0.09)
    const desat = this.selected ? DESAT : 0
    this.desat += (desat - this.desat) * k
    if (Math.abs(desat - this.desat) < 0.003) this.desat = desat
    this.materials.desat.value = this.desat
    this.insetB += (this.targetB - this.insetB) * k
    this.insetR += (this.targetR - this.insetR) * k
    if (Math.abs(this.targetB - this.insetB) < 0.5) this.insetB = this.targetB
    if (Math.abs(this.targetR - this.insetR) < 0.5) this.insetR = this.targetR
    return this.desat !== desat || this.insetB !== this.targetB || this.insetR !== this.targetR
  }

  /** The one-time scan sweep: a band of brighter rim light travelling from crown to soles. */
  private scan(now: number): boolean {
    if (this.scanStart < 0 || !this.atlas) return false
    const glass = this.materials.glass.uniforms
    const t = (now - this.scanStart) / SCAN_MS
    if (t < 0) return true
    if (t >= 1) {
      glass.uScan.value = 0
      this.scanStart = -1
      return true
    }
    const e = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
    const { min, max } = this.atlas.bounds
    glass.uScanY.value = MathUtils.lerp(max.y + 0.06, min.y - 0.06, e)
    glass.uScan.value = Math.min(1, t * 8, (1 - t) * 6)
    return true
  }

  /** Places the camera, shifting the projection centre into the area a sheet leaves free. */
  private applyView() {
    const camera = this.stage!.camera
    if (this.insetB > 0.5 || this.insetR > 0.5) {
      // Centre on the area between the title bar and the sheet (blending in the bar as the sheet rises).
      const y = (this.insetB - Math.min(this.insetB, this.chrome.top)) / 2
      camera.setViewOffset(this.width, this.height, this.insetR / 2, y, this.width, this.height)
    } else if (camera.view?.enabled) {
      camera.clearViewOffset()
    }
    this.rig.apply(camera)
  }

  /** Zoom → layer weights, explode offsets, tethers and the skin's rim. */
  private applyDepth() {
    const d = depthAt(this.rig.zoom, this.depth)
    const sel = this.selected
    let selWeight = 0
    for (const t of this.materials.tissues.values()) {
      const w = t.layer === 'muscles' ? d.muscles : d.deep
      // Bones step back as the organs float out in front of them.
      if (t.key === 'bone') t.solid.color.copy(t.color).multiplyScalar(1 - BONE_DIM * d.explode)
      setSolidWeight(t.solid, w)
      setSolidWeight(t.selected, w)
      setGhostWeight(t.ghost, 1 - w)
      if (sel?.tissue === t) selWeight = w
    }
    // The selected part shows through as an accent x-ray while its layer is ghosted.
    setGhostWeight(this.materials.xray, sel ? (1 - selWeight) * 0.9 : 0)
    this.materials.outline.uniforms.uOpacity.value = selWeight * 0.95
    this.materials.outline.visible = selWeight > 0.02
    this.materials.glass.uniforms.uRim.value = d.shell

    if (d.explode !== this.lastExplode && this.atlas) {
      for (const p of this.atlas.parts) if (p.entry.explode) p.pivot.position.copy(p.offset).multiplyScalar(d.explode)
      this.lastExplode = d.explode
    }
    this.tethers?.update(d.explode, sel?.id ?? null)
  }

  /** Brings camera, layers and matrices up to date without drawing (for picking and projecting). */
  private sync() {
    if (!this.stage) return
    this.applyView()
    this.applyDepth()
    this.stage.scene.updateMatrixWorld()
  }

  private currentState(): ViewerState {
    return { layer: this.layerGoal ?? layerOf(this.depth.name), back: Math.cos(this.rig.azimuth) < 0 }
  }

  /** Tells the chrome when the layer or side changed. */
  private report() {
    if (!this.ready) return
    const s = this.currentState()
    const key = `${s.layer}:${s.back}`
    if (key === this.reported) return
    this.reported = key
    this.options.onChange?.(s)
  }

  // ── Layout and overlay ─────────────────────────────────────────────────

  private resize() {
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    if (w === this.width && h === this.height) return
    const zoom = this.rig.zoom
    this.width = w
    this.height = h
    this.renderer!.setSize(w, h, false)
    this.stage!.camera.aspect = w / h
    this.materials.outline.uniforms.uResolution.value = [w, h]
    const cs = getComputedStyle(this.host)
    this.chrome = { top: Number.parseFloat(cs.paddingTop) || 0, bottom: Number.parseFloat(cs.paddingBottom) || 0 }
    this.fit()
    this.rig.distance = this.rig.fitDistance / zoom
    this.rig.clamp()
    this.measureInset()
    this.requestRender()
  }

  /** Distance at which the whole body fits between the chrome bands, in portrait and landscape. */
  private fit() {
    const box = this.atlas?.bounds ?? BODY
    const size = box.getSize(tmp)
    const t = Math.tan(MathUtils.degToRad(FOV / 2))
    const free = Math.max(this.height * 0.5, this.height - this.chrome.top - this.chrome.bottom - 24)
    const dV = size.y / (2 * t * (free / this.height))
    const dH = (size.x * 1.2) / (2 * t * (this.width / this.height))
    this.rig.fitDistance = Math.max(dV, dH) + size.z / 2
    // Centre the body in the free band, not the screen: the bands differ in height.
    const metresPerPx = (2 * this.rig.fitDistance * t) / this.height
    box.getCenter(this.rig.home)
    this.rig.home.y += ((this.chrome.top - this.chrome.bottom) / 2) * metresPerPx
  }

  /** The sheet's size: a full-width sheet covers the bottom, a narrower card the right edge. */
  private measureInset() {
    const el = this.sheet
    let bottom = 0
    let right = 0
    if (el) {
      const cs = getComputedStyle(el)
      // offsetWidth/Height ignore transforms, so a sheet sliding in reports its final size.
      if (el.offsetWidth >= this.width * 0.7) bottom = el.offsetHeight + (Number.parseFloat(cs.bottom) || 0)
      else right = el.offsetWidth + (Number.parseFloat(cs.right) || 0) + 8
    }
    const grew = bottom > this.targetB + 24 || right > this.targetR + 24
    this.targetB = Math.min(this.height * 0.85, bottom)
    this.targetR = Math.min(this.width * 0.6, right)
    if (this.reducedMotion.matches) {
      this.insetB = this.targetB
      this.insetR = this.targetR
    }
    if (grew && this.selected) this.keepInView(this.selected)
    this.requestRender()
  }

  /** If the part would end up hidden (under a sheet or off screen), glides it into the free area. */
  private keepInView(part: Part) {
    // A focus or layer move already frames the part; don't fight it.
    if (!this.stage || this.rig.animating) return
    const [b, r] = [this.insetB, this.insetR]
    this.insetB = this.targetB
    this.insetR = this.targetR
    this.sync()
    const inFront = this.toScreen(this.anchorOf(part, tmp2), screen)
    this.insetB = b
    this.insetR = r
    this.sync()
    const m = 40
    const inside =
      inFront &&
      screen.x > m &&
      screen.x < this.width - this.targetR - m &&
      screen.y > this.chrome.top + m / 2 &&
      screen.y < this.height - this.targetB - m
    if (inside) return
    const v = this.rig.view()
    this.rig.animateTo({ ...v, target: this.centreOf(part, new Vector3()) }, this.reducedMotion.matches ? 0 : 450)
    this.requestRender()
  }

  /** World point → CSS px; false when behind the camera. */
  private toScreen(world: Vector3, out: { x: number; y: number }): boolean {
    tmp.copy(world).project(this.stage!.camera)
    out.x = ((tmp.x + 1) / 2) * this.width
    out.y = ((1 - tmp.y) / 2) * this.height
    return tmp.z < 1
  }

  /** Where a part currently is (explode applied): its anchor on the surface facing the camera. */
  private anchorOf(part: Part, out: Vector3): Vector3 {
    out.copy(Math.cos(this.rig.azimuth) < 0 ? part.anchorBack : part.anchor)
    if (part.entry.explode) out.addScaledVector(part.offset, this.depth.explode)
    return out
  }

  /** The part's current centre (explode applied). */
  private centreOf(part: Part, out: Vector3): Vector3 {
    part.box.getCenter(out)
    if (part.entry.explode) out.addScaledVector(part.offset, this.depth.explode)
    return out
  }

  private readonly anchorPx = { x: 0, y: 0 }

  private updateOverlay() {
    const sel = this.selected
    let at: { x: number; y: number } | null = null
    if (sel) {
      const inFront = this.toScreen(this.anchorOf(sel, tmp2), this.anchorPx)
      const { x, y } = this.anchorPx
      if (inFront && x >= 0 && y >= this.chrome.top * 0.6 && x <= this.width - this.insetR && y <= this.height - this.insetB - 6) {
        at = this.anchorPx
      }
    }
    this.marker.update(at)
    this.updateHint()
  }

  private readonly hintPx = { x: 0, y: 0 }

  /** The first-visit hint sits on the chest, on whichever side faces the camera. */
  private updateHint() {
    if (!this.hint.text) return
    const part = this.atlas?.byId.get('pectoralis-major-left') ?? this.atlas?.byId.get('heart')
    let at: { x: number; y: number } | null = null
    if (part && !this.selected) {
      const inFront = this.toScreen(this.anchorOf(part, tmp2), this.hintPx)
      const { x, y } = this.hintPx
      if (inFront && x > 0 && x < this.width && y > this.chrome.top && y < this.height - this.chrome.bottom - 40) at = this.hintPx
    }
    this.hint.update(at)
  }

  // ── Picking ────────────────────────────────────────────────────────────

  private pickable = (p: Part) => p.tissue !== null && p.tissue.layer === this.depth.pickLayer

  private pickAt(x: number, y: number, radius: number): Hit | null {
    if (!this.picker || !this.stage) return null
    this.sync()
    return this.picker.pick(this.stage.camera, this.width, this.height, x, y, radius, this.pickable)
  }

  /** The 3D point under (x, y): the surface there, else a plane through the target facing the camera. */
  private pointAt(x: number, y: number, out: Vector3): Vector3 {
    const hit = this.pickAt(x, y, 0)
    if (hit) return out.copy(hit.point)
    const camera = this.stage!.camera
    camera.getWorldDirection(forward)
    plane.setFromNormalAndCoplanarPoint(forward, this.rig.target)
    tmp.set((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1, 0.5).unproject(camera)
    ray.set(camera.position, tmp.sub(camera.position).normalize())
    return ray.intersectPlane(plane, out) ?? out.copy(this.rig.target)
  }

  private hoverPick = () => {
    this.hoverFrame = 0
    const at = this.hoverAt
    if (!at || this.dragging) return
    const hit = this.pickAt(at.x, at.y, 6)
    this.hover.show(hit && hit.part !== this.selected ? hit.part.info.name : null, at.x, at.y)
    this.canvas.style.cursor = hit ? 'pointer' : ''
  }

  // ── Input ──────────────────────────────────────────────────────────────

  private gestures() {
    const rotateSpeed = () => Math.PI / Math.max(320, Math.min(this.width, this.height) * 0.9)
    const interacted = () => {
        this.requestRender()
    }
    return {
      begin: () => {
        this.rig.stop()
        this.layerGoal = null
        this.dragging = true
        this.hover.show(null)
        this.canvas.classList.add('is-dragging')
      },
      rotate: (dx: number, dy: number, now: number) => {
        const k = rotateSpeed()
        this.rig.rotate(-dx * k, dy * k, now)
        interacted()
      },
      pan: (dx: number, dy: number) => {
        this.rig.pan(this.stage!.camera, dx, dy, this.rig.distance, this.height)
        interacted()
      },
      pinchStart: (x: number, y: number) => {
        this.pointAt(x, y, this.pinchPoint)
      },
      pinch: (scale: number, _x: number, _y: number, dx: number, dy: number) => {
        const camera = this.stage!.camera
        this.rig.zoomAt(scale, this.pinchPoint)
        this.applyView()
        camera.getWorldDirection(forward)
        const depth = Math.max(0.05, tmp.subVectors(this.pinchPoint, camera.position).dot(forward))
        this.rig.pan(camera, dx, dy, depth, this.height)
        interacted()
      },
      wheel: (factor: number, x: number, y: number) => {
        this.layerGoal = null
        this.rig.zoomAt(factor, this.pointAt(x, y, tmp2))
        interacted()
      },
      end: (now: number) => {
        this.dragging = false
        this.canvas.classList.remove('is-dragging')
        this.rig.release(now, !this.reducedMotion.matches)
        this.requestRender()
      },
      tap: (x: number, y: number) => {
        const hit = this.pickAt(x, y, PICK_RADIUS)
        this.lastTap = { part: hit?.part ?? null, time: performance.now() }
        const id = hit?.part.id ?? null
        this.select(id === this.selected?.id ? null : id)
      },
      doubleTap: (x: number, y: number) => {
        // The first tap opened the card, which shifts the picture: the second tap
        // means whatever the first one hit, not what is under the finger now.
        const first = this.lastTap && performance.now() - this.lastTap.time < 600 ? this.lastTap : null
        const part = first ? first.part : (this.pickAt(x, y, PICK_RADIUS)?.part ?? null)
        this.lastTap = null
        if (part) this.focus(part.id)
        else this.reset()
      },
      // Only mouse pointers hover (see attachGestures), so touch screens never show the tag.
      hover: (x: number, y: number) => {
        this.hoverAt = { x, y }
        if (!this.hoverFrame) this.hoverFrame = requestAnimationFrame(this.hoverPick)
      },
      leave: () => {
        this.hoverAt = null
        this.hover.show(null)
      },
    }
  }

  private onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || !this.ready) return
    const t = e.target
    if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
    if (e.key === 'Escape') {
      if (this.selected) this.select(null)
      return
    }
    // Other keys only when focus isn't in some other control (e.g. a sheet).
    if (t instanceof Element && t !== document.body && t !== document.documentElement && !this.host.contains(t)) return
    const v = this.rig.view()
    const ms = this.reducedMotion.matches ? 0 : 260
    switch (e.key) {
      case '0':
        this.reset()
        break
      case '1':
      case '2':
      case '3':
        this.setLayer((['muscles', 'organs', 'exploded'] as const)[Number(e.key) - 1])
        break
      case 'f':
        this.flip()
        break
      case 'ArrowLeft':
        this.rig.animateTo({ ...v, azimuth: v.azimuth + KEY_STEP }, ms)
        break
      case 'ArrowRight':
        this.rig.animateTo({ ...v, azimuth: v.azimuth - KEY_STEP }, ms)
        break
      case 'ArrowUp':
        this.rig.animateTo({ ...v, polar: v.polar - KEY_STEP / 2 }, ms)
        break
      case 'ArrowDown':
        this.rig.animateTo({ ...v, polar: v.polar + KEY_STEP / 2 }, ms)
        break
      case '+':
      case '=':
        this.rig.animateTo({ ...v, distance: v.distance / 1.25 }, ms)
        break
      case '-':
      case '_':
        this.rig.animateTo({ ...v, distance: v.distance * 1.25 }, ms)
        break
      default:
        return
    }
    e.preventDefault()
    this.requestRender()
  }

  // ── Selection and camera moves ─────────────────────────────────────────

  select(id: string | null) {
    const part = id ? this.atlas?.byId.get(id) : null
    const next = part?.tissue ? part : null
    if (next === this.selected) return
    const prev = this.selected
    if (prev?.tissue) {
      for (const m of prev.meshes) m.material = prev.tissue.solid
      for (const g of prev.ghosts) {
        g.material = prev.tissue.ghost
        g.renderOrder = ORDER.ghosts
      }
      for (const o of this.outlines) o.removeFromParent()
      this.outlines = []
    }
    this.selected = next
    if (next?.tissue) {
      for (const m of next.meshes) m.material = next.tissue.selected
      for (const g of next.ghosts) {
        g.material = this.materials.xray
        g.renderOrder = ORDER.xray
      }
      this.outlines = next.meshes.map((m) => {
        const o = new Mesh(m.geometry, this.materials.outline)
        o.position.copy(m.position)
        o.quaternion.copy(m.quaternion)
        o.scale.copy(m.scale)
        o.renderOrder = ORDER.outline
        next.pivot.add(o)
        return o
      })
      // The sheet may already be open (another part was selected): keep this one in view too.
      if (this.sheet) this.keepInView(next)
    }
    const info = next?.info ?? null
    if (info) {
      const where = [info.groupLabel, info.sideLabel].filter(Boolean).join(', ')
      this.announcer.say(`${info.name}. ${where}. ${info.description}`)
    } else {
      this.announcer.say('')
    }
    this.options.onSelect?.(info)
    this.requestRender()
  }

  focus(id: string) {
    const part = this.atlas?.byId.get(id)
    if (!part?.tissue) return
    const camera = this.stage!.camera
    const kind = part.entry.system === 'organ' ? 'organs' : part.entry.system === 'bone' ? 'bones' : 'muscles'
    const size = part.box.getSize(tmp)
    const t = Math.tan(MathUtils.degToRad(FOV / 2))
    // Frame the part to fill about 40% of the shorter side of the view.
    const extent = Math.max(size.y, size.x / Math.min(1, camera.aspect))
    const distance = extent / (0.4 * 2 * t)
    const [lo, hi] = FOCUS_ZOOM[kind]
    const zoom = MathUtils.clamp(this.rig.fitDistance / distance, lo, hi)
    const explode = part.entry.explode ? depthAt(zoom, this.focusDepth).explode : 0
    const target = part.box.getCenter(new Vector3()).addScaledVector(part.offset, explode)

    // Exploded organs are laid out for the front view; other parts face whichever side shows them.
    const bodyZ = this.atlas!.bounds.getCenter(tmp2).z
    const facing = kind === 'organs' || target.z >= bodyZ - 0.02 ? 0 : Math.PI
    const az = this.rig.azimuth
    const keep = kind !== 'organs' && Math.cos(az - facing) > 0.5
    this.layerGoal = null
    this.rig.animateTo(
      {
        target,
        distance: this.rig.fitDistance / zoom,
        azimuth: keep ? az : facing,
        polar: kind === 'organs' ? 0 : this.rig.polar,
      },
      this.reducedMotion.matches ? 0 : FOCUS_MS,
    )
    this.select(id)
    this.requestRender()
  }

  /** Where each layer button points the camera. */
  private layerTarget(layer: LayerName): Vector3 {
    if (layer === 'muscles') return this.rig.home.clone()
    return (layer === 'organs' ? this.torso : this.torsoExploded).clone()
  }

  setLayer(layer: LayerName) {
    if (!this.ready) return
    const v = this.rig.view()
    // The exploded layout is solved for the front view.
    const front = layer === 'exploded'
    this.layerGoal = layer
    this.rig.animateTo(
      {
        target: this.layerTarget(layer),
        distance: this.rig.fitDistance / LAYER_ZOOM[layer],
        azimuth: front ? 0 : v.azimuth,
        polar: front ? 0 : v.polar,
      },
      this.reducedMotion.matches ? 0 : LAYER_MS,
    )
    this.report()
    this.requestRender()
  }

  flip() {
    if (!this.ready) return
    const v = this.rig.view()
    // Snap to the nearest pure front or back view, then turn half way round.
    const back = Math.cos(v.azimuth) < 0
    this.rig.animateTo({ ...v, azimuth: back ? 0 : Math.PI, polar: 0 }, this.reducedMotion.matches ? 0 : FLIP_MS)
    this.requestRender()
  }

  reset() {
    this.layerGoal = null
    this.rig.animateTo(
      { target: this.rig.home.clone(), distance: this.rig.fitDistance, azimuth: 0, polar: 0 },
      this.reducedMotion.matches ? 0 : 600,
    )
    this.requestRender()
  }

  setHint(text: string | null) {
    this.hint.set(text)
    this.requestRender()
  }

  setOccluder(el: HTMLElement | null) {
    if (el === this.sheet) return
    this.occluder?.disconnect()
    this.occluder = null
    this.sheet = el
    this.targetB = this.targetR = 0
    if (el) {
      this.occluder = new ResizeObserver(() => this.measureInset())
      this.occluder.observe(el)
    }
    this.measureInset()
    this.requestRender()
  }

  /** Jumps without animation (tests and deep links). */
  setView(spec: ViewSpec) {
    const view: Partial<View> = {}
    if (spec.zoom !== undefined) view.distance = this.rig.fitDistance / spec.zoom
    if (spec.azimuthDeg !== undefined) view.azimuth = MathUtils.degToRad(spec.azimuthDeg)
    if (spec.polarDeg !== undefined) view.polar = MathUtils.degToRad(spec.polarDeg)
    if (Array.isArray(spec.target)) view.target = new Vector3(...spec.target)
    else if (typeof spec.target === 'string') {
      const part = this.atlas?.byId.get(spec.target)
      if (part) {
        const zoom = spec.zoom ?? this.rig.zoom
        const explode = part.entry.explode ? depthAt(zoom, this.focusDepth).explode : 0
        view.target = part.box.getCenter(new Vector3()).addScaledVector(part.offset, explode)
      }
    }
    this.rig.stop()
    this.layerGoal = null
    this.rig.set(view)
    this.sync()
    this.requestRender()
  }

  // ── Test hooks ─────────────────────────────────────────────────────────

  hooks(): AtlasHooks {
    return {
      state: () => {
        const { layer, back } = this.currentState()
        return {
          ready: this.ready,
          zoom: round(this.rig.zoom, 3),
          depth: this.depth.name,
          layer,
          explode: round(this.depth.explode, 3),
          azimuthDeg: round(MathUtils.radToDeg(this.rig.azimuth), 1),
          back,
          selected: this.selected?.id ?? null,
          hint: this.hint.text,
          fps: Math.round(this.fps),
          source: this.source,
        }
      },
      parts: () => {
        this.sync()
        return (this.atlas?.parts ?? []).map((p) => {
          const visible = (p.meshes[0].material as Material).visible
          return {
            id: p.id,
            system: p.entry.system,
            layer: p.entry.layer,
            side: p.entry.side,
            explode: p.entry.explode,
            visible,
            pickable: visible && this.pickable(p),
          }
        })
      },
      project: (id) => {
        const part = this.atlas?.byId.get(id)
        if (!part) return null
        this.sync()
        const inFront = this.toScreen(this.anchorOf(part, tmp2), screen)
        const onScreen = inFront && screen.x >= 0 && screen.y >= 0 && screen.x <= this.width && screen.y <= this.height
        return { x: round(screen.x, 1), y: round(screen.y, 1), onScreen }
      },
      pick: (x, y) => this.pickAt(x, y, PICK_RADIUS)?.part.id ?? null,
      setView: (view) => this.setView(view),
      labelRect: () => this.sheet?.getBoundingClientRect() ?? null,
      select: (id) => this.select(id),
      focus: (id) => this.focus(id),
      setLayer: (layer) => this.setLayer(layer),
      flip: () => this.flip(),
      reset: () => this.reset(),
    }
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.abort.abort()
    cancelAnimationFrame(this.frame)
    cancelAnimationFrame(this.hoverFrame)
    this.occluder?.disconnect()
    for (const off of this.cleanup) off()
    if (this.stage) {
      this.stage.scene.traverse((o) => (o as Mesh).geometry?.dispose())
      this.stage.dispose()
    }
    for (const m of this.materials.all()) m.dispose()
    this.picker?.dispose()
    this.tethers?.dispose()
    this.renderer?.dispose()
    this.host.classList.remove('atlas', 'is-ready')
    this.host.replaceChildren()
  }
}

const round = (v: number, digits: number) => Math.round(v * 10 ** digits) / 10 ** digits

export function mountAnatomyViewer(host: HTMLElement, options: ViewerOptions = {}): AnatomyViewer {
  const viewer = new Viewer(host, options)
  const hooks = viewer.hooks()
  window.__atlas = hooks
  return {
    select: (id) => viewer.select(id),
    focus: (id) => viewer.focus(id),
    setLayer: (layer) => viewer.setLayer(layer),
    flip: () => viewer.flip(),
    reset: () => viewer.reset(),
    setHint: (text) => viewer.setHint(text),
    setOccluder: (el) => viewer.setOccluder(el),
    destroy: () => {
      viewer.destroy()
      if (window.__atlas === hooks) delete window.__atlas
    },
  }
}
