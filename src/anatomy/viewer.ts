// The atlas viewer: mounts the canvas and its overlays into a host element,
// loads the model, and renders on demand, only while input, inertia, an
// animation or loading is changing something. Framework-free; React only hosts it.

import '@fontsource-variable/inter'
import '@fontsource-variable/inter/wght-italic.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './style.css'

import { Box3, Group, MathUtils, Mesh, Plane, Ray, SphereGeometry, Vector3, type Material } from 'three'
import type { PartInfo } from './content.ts'
import { attachGestures, CameraRig, type View } from './controls.ts'
import { createDepthState, depthAt, FOCUS_ZOOM, type DepthName } from './depth.ts'
import { Hud } from './hud.ts'
import { Announcer, Callout, HoverTag, type CalloutAction, type CalloutLayout, type Rect } from './labels.ts'
import { AtlasMaterials, ORDER, setGhostWeight, setSolidWeight } from './materials.ts'
import { buildAtlas, loadModel, type Atlas, type Part } from './model.ts'
import { PICK_RADIUS, Picker, type Hit } from './picking.ts'
import { createRenderer, createStage, FOV, type Stage } from './scene.ts'
import { Tethers } from './tethers.ts'

export interface ViewerOptions {
  onSelect?(part: PartInfo | null): void
  /** One quiet action in the selection callout, e.g. "Zgłoś ból". */
  action?: CalloutAction
  /** Deployed commit; its short hash sits discreetly in the credit line. */
  build?: string
}

export interface AnatomyViewer {
  select(id: string | null): void
  /** Animates to the part (deep enough to reveal it) and selects it. */
  focus(id: string): void
  reset(): void
  /** An element covering the bottom of the view (a sheet): the selection stays visible above it. */
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
    explode: number
    azimuthDeg: number
    selected: string | null
    fps: number
    source: 'glb' | 'placeholder' | null
  }
  parts(): { id: string; system: string; layer: string; side: string | null; explode: boolean; visible: boolean; pickable: boolean }[]
  project(id: string): { x: number; y: number; onScreen: boolean } | null
  pick(x: number, y: number): string | null
  setView(view: ViewSpec): void
  labelRect(): DOMRect | null
  select(id: string | null): void
  focus(id: string): void
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
const KEY_STEP = MathUtils.degToRad(15)
/** Placeholder bounds until the model is in: a 1.75 m figure. */
const BODY = new Box3(new Vector3(-0.3, 0, -0.15), new Vector3(0.3, 1.75, 0.15))

const tmp = new Vector3()
const tmp2 = new Vector3()
const forward = new Vector3()
const plane = new Plane()
const ray = new Ray()
const screen = { x: 0, y: 0 }

const NO_HUD = { top: 72, bottom: 56, avoid: [] as Rect[] }

class Viewer implements AnatomyViewer {
  private readonly host: HTMLElement
  private readonly options: ViewerOptions
  private readonly canvas = document.createElement('canvas')
  private readonly hud: Hud
  private readonly callout: Callout
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

  private width = 1
  private height = 1
  private bands = NO_HUD
  private frame = 0
  private lastTick = 0
  private fps = 0
  private lastExplode = -1
  private desat = 0
  private inset = 0
  private insetTarget = 0
  private sheet: HTMLElement | null = null
  private occluder: ResizeObserver | null = null
  private scanStart = -1
  private hoverFrame = 0
  private hoverAt: { x: number; y: number } | null = null
  private pinchPoint = new Vector3()
  private dragging = false

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
    this.callout = new Callout(host, options.action)
    this.hover = new HoverTag(host)
    const touch = matchMedia('(pointer: coarse)').matches || (!matchMedia('(pointer: fine)').matches && navigator.maxTouchPoints > 0)
    this.hud = new Hud(host, { touch, hint: !this.params.has('nohint'), build: options.build })
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
    document.fonts?.ready.then(() => {
      if (this.destroyed) return
      this.callout.measure()
      this.measureHud()
    })

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

  /** ?zoom=2.5&az=0&polar=5&sel=heart&focus=heart (plus ?nohint and ?noscan, read elsewhere). */
  private applyParams() {
    const num = (k: string) => {
      const v = Number.parseFloat(this.params.get(k) ?? '')
      return Number.isFinite(v) ? v : undefined
    }
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
    if (busy) this.requestRender()
  }

  /** Eases the selection's desaturation and the sheet inset; true while still moving. */
  private ease(dt: number): boolean {
    const instant = this.reducedMotion.matches
    const k = instant ? 1 : 1 - Math.exp(-dt / 0.09)
    const desat = this.selected ? DESAT : 0
    this.desat += (desat - this.desat) * k
    if (Math.abs(desat - this.desat) < 0.003) this.desat = desat
    this.materials.desat.value = this.desat
    this.inset += (this.insetTarget - this.inset) * k
    if (Math.abs(this.insetTarget - this.inset) < 0.5) this.inset = this.insetTarget
    return this.desat !== desat || this.inset !== this.insetTarget
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

  /** Places the camera, shifting the projection centre up while a sheet covers the bottom. */
  private applyView() {
    const camera = this.stage!.camera
    if (this.inset > 0.5) camera.setViewOffset(this.width, this.height, 0, this.inset / 2, this.width, this.height)
    else if (camera.view?.enabled) camera.clearViewOffset()
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

  // ── Overlay ────────────────────────────────────────────────────────────

  private resize() {
    const w = Math.max(1, this.host.clientWidth)
    const h = Math.max(1, this.host.clientHeight)
    if (w === this.width && h === this.height) return
    const zoom = this.rig.zoom
    this.width = w
    this.height = h
    this.renderer!.setSize(w, h, false)
    const camera = this.stage!.camera
    camera.aspect = w / h
    this.materials.outline.uniforms.uResolution.value = [w, h]
    this.measureHud()
    this.fit()
    this.rig.distance = this.rig.fitDistance / zoom
    this.rig.clamp()
    this.callout.measure()
    this.measureInset()
    this.requestRender()
  }

  /** Distance at which the whole body fits between the HUD rows, in portrait and landscape. */
  private fit() {
    const box = this.atlas?.bounds ?? BODY
    const size = box.getSize(tmp)
    const t = Math.tan(MathUtils.degToRad(FOV / 2))
    const phone = this.width < 640
    const usable = Math.max(0.5, (this.height - (phone ? 150 : 120)) / this.height)
    const dV = size.y / (2 * t * usable)
    const dH = (size.x * 1.25) / (2 * t * (this.width / this.height))
    this.rig.fitDistance = Math.max(dV, dH) + size.z / 2
    // Centre the body in the free band: the HUD's top row is taller than its bottom row.
    const shift = phone ? ((this.bands.top - this.bands.bottom) / 2 / this.height) * size.y / usable : 0
    box.getCenter(this.rig.home)
    this.rig.home.y += shift
  }

  private measureHud() {
    this.bands = this.hud.bands(this.host.getBoundingClientRect())
  }

  private measureInset() {
    // offsetHeight ignores transforms, so a sheet sliding in reports its final size.
    this.insetTarget = this.sheet ? Math.min(this.height * 0.85, this.sheet.offsetHeight) : 0
    if (this.reducedMotion.matches) this.inset = this.insetTarget
    this.callout.setCompact(this.insetTarget > 0)
    this.host.classList.toggle('has-sheet', this.insetTarget > 0)
    this.requestRender()
  }

  /** World point → CSS px; false when behind the camera. */
  private toScreen(world: Vector3, out: { x: number; y: number }): boolean {
    tmp.copy(world).project(this.stage!.camera)
    out.x = ((tmp.x + 1) / 2) * this.width
    out.y = ((1 - tmp.y) / 2) * this.height
    return tmp.z < 1
  }

  /** Where a part currently is (explode applied): its label anchor on the surface facing the camera. */
  private anchorOf(part: Part, out: Vector3): Vector3 {
    out.copy(Math.cos(this.rig.azimuth) < 0 ? part.anchorBack : part.anchor)
    if (part.entry.explode) out.addScaledVector(part.offset, this.depth.explode)
    return out
  }

  private readonly partRect: Rect = { left: 0, top: 0, right: 0, bottom: 0 }
  private readonly anchorPx = { x: 0, y: 0 }
  private readonly corner = { x: 0, y: 0 }

  private updateOverlay() {
    const sel = this.selected
    if (sel && this.callout.shown) {
      const r = this.screenRect(sel.box, sel.offset, this.partRect, sel.entry.explode ? this.depth.explode : 0)
      const inFront = this.toScreen(this.anchorOf(sel, tmp2), this.anchorPx)
      const { x, y } = this.anchorPx
      const visible = inFront && x >= 0 && y >= 0 && x <= this.width && y <= this.height - this.inset
      this.callout.update(visible ? this.anchorPx : null, r, this.layout())
    }
    const camera = this.stage!.camera
    this.hud.update({
      zoom: this.rig.zoom,
      depth: this.depth.name,
      azimuth: this.rig.azimuth,
      pxPerMetre: this.height / (2 * this.rig.distance * Math.tan(MathUtils.degToRad(camera.fov) / 2)),
    })
  }

  private readonly calloutLayout: CalloutLayout = {
    width: 1,
    height: 1,
    phone: true,
    gutter: 16,
    top: 0,
    bottom: 0,
    avoid: [],
    body: { left: 0, top: 0, right: 0, bottom: 0 },
  }

  private layout(): CalloutLayout {
    const l = this.calloutLayout
    l.width = this.width
    l.height = this.height
    l.phone = this.width < 640
    // Wide screens keep the block clear of the orientation letters at the edges.
    l.gutter = l.phone ? 16 : 56
    l.top = this.bands.top
    l.bottom = this.bands.bottom
    l.avoid = this.bands.avoid
    this.screenRect(this.atlas!.bounds, null, l.body)
    return l
  }

  /** Screen rect (CSS px) of a world box, shifted by `offset` if given. */
  private screenRect(box: Box3, offset: Vector3 | null, r: Rect, shift = 0): Rect {
    r.left = r.top = Infinity
    r.right = r.bottom = -Infinity
    const { min, max } = box
    for (let i = 0; i < 8; i++) {
      tmp2.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z)
      if (offset) tmp2.addScaledVector(offset, shift)
      this.toScreen(tmp2, this.corner)
      r.left = Math.min(r.left, this.corner.x)
      r.right = Math.max(r.right, this.corner.x)
      r.top = Math.min(r.top, this.corner.y)
      r.bottom = Math.max(r.bottom, this.corner.y)
    }
    return r
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
      this.hud.dismissHint()
      this.requestRender()
    }
    return {
      begin: () => {
        this.rig.stop()
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
        const id = hit?.part.id ?? null
        this.select(id === this.selected?.id ? null : id)
      },
      doubleTap: (x: number, y: number) => {
        const hit = this.pickAt(x, y, PICK_RADIUS)
        if (hit) this.focus(hit.part.id)
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
    // Other keys only when focus isn't in some other control (e.g. the pain sheet).
    if (t instanceof Element && t !== document.body && t !== document.documentElement && !this.host.contains(t)) return
    const v = this.rig.view()
    const ms = this.reducedMotion.matches ? 0 : 260
    switch (e.key) {
      case '0':
        this.reset()
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
    this.hud.dismissHint()
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
    }
    const info = next?.info ?? null
    this.callout.show(info)
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
    this.hud.dismissHint()
    this.requestRender()
  }

  reset() {
    this.rig.animateTo(
      { target: this.rig.home.clone(), distance: this.rig.fitDistance, azimuth: 0, polar: 0 },
      this.reducedMotion.matches ? 0 : 600,
    )
    this.requestRender()
  }

  setOccluder(el: HTMLElement | null) {
    if (el === this.sheet) return
    this.occluder?.disconnect()
    this.occluder = null
    this.sheet = el
    if (el) {
      this.occluder = new ResizeObserver(() => this.measureInset())
      this.occluder.observe(el)
    }
    this.measureInset()
    // Keep the selection in view: centre it in the band above the sheet.
    if (el && this.selected) {
      this.sync()
      const v = this.rig.view()
      this.rig.animateTo({ ...v, target: this.centreOf(this.selected, new Vector3()) }, this.reducedMotion.matches ? 0 : 450)
    }
    this.requestRender()
  }

  /** The part's current centre (explode applied). */
  private centreOf(part: Part, out: Vector3): Vector3 {
    part.box.getCenter(out)
    if (part.entry.explode) out.addScaledVector(part.offset, this.depth.explode)
    return out
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
    this.rig.set(view)
    this.sync()
    this.requestRender()
  }

  // ── Test hooks ─────────────────────────────────────────────────────────

  hooks(): AtlasHooks {
    return {
      state: () => ({
        ready: this.ready,
        zoom: round(this.rig.zoom, 3),
        depth: this.depth.name,
        explode: round(this.depth.explode, 3),
        azimuthDeg: round(MathUtils.radToDeg(this.rig.azimuth), 1),
        selected: this.selected?.id ?? null,
        fps: Math.round(this.fps),
        source: this.source,
      }),
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
      labelRect: () => this.callout.rect(),
      select: (id) => this.select(id),
      focus: (id) => this.focus(id),
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
    this.hud.destroy()
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
    reset: () => viewer.reset(),
    setOccluder: (el) => viewer.setOccluder(el),
    destroy: () => {
      viewer.destroy()
      if (window.__atlas === hooks) delete window.__atlas
    },
  }
}
