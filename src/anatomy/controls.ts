// Camera and gestures. The camera orbits a target like a turntable: azimuth is
// unlimited, elevation is clamped. One finger or the left mouse button rotates
// (with inertia); two fingers pinch towards the point between them and pan;
// the wheel zooms to the cursor; right- or shift-drag pans. Animations use a
// critically damped curve: no bounce, no wobble.

import { Box3, MathUtils, Vector3, type PerspectiveCamera } from 'three'
import { ZOOM_MAX, ZOOM_MIN } from './depth.ts'

export const POLAR_LIMIT = MathUtils.degToRad(25)
/** Inertia: exponential decay time constant (s) and the fastest spin a flick can start (rad/s). */
const INERTIA_TAU = 0.24
const MAX_SPIN = 6

export interface View {
  target: Vector3
  distance: number
  /** Radians; 0 = front view (camera on +Z), π/2 = the patient's left side. */
  azimuth: number
  /** Radians above the horizontal. */
  polar: number
}

/** Critically damped response, normalised to land exactly on 1 at t = 1. */
function settle(t: number): number {
  const w = 7
  const f = (x: number) => 1 - (1 + w * x) * Math.exp(-w * x)
  return t >= 1 ? 1 : f(t) / f(1)
}

const right = new Vector3()
const up = new Vector3()

export class CameraRig {
  readonly target = new Vector3(0, 0.9, 0)
  distance = 4
  azimuth = 0
  polar = 0
  /** Distance at which the whole body fits the view (zoom 1). */
  fitDistance = 4
  /** Target of the fitted full-body view. */
  readonly home = new Vector3(0, 0.9, 0)
  /** The target never leaves these bounds. */
  readonly bounds = new Box3(new Vector3(-1, 0, -1), new Vector3(1, 2, 1))

  private velAz = 0
  private velPolar = 0
  private lastRotate = 0
  private anim: { from: View; to: View; start: number; duration: number } | null = null

  get zoom() {
    return this.fitDistance / this.distance
  }

  get moving() {
    return this.anim !== null || this.velAz !== 0 || this.velPolar !== 0
  }

  /** True while an `animateTo` is running (not inertia). */
  get animating() {
    return this.anim !== null
  }

  /** Places the camera; call before rendering or projecting. */
  apply(camera: PerspectiveCamera) {
    const c = Math.cos(this.polar)
    camera.position.set(
      this.target.x + this.distance * Math.sin(this.azimuth) * c,
      this.target.y + this.distance * Math.sin(this.polar),
      this.target.z + this.distance * Math.cos(this.azimuth) * c,
    )
    camera.near = Math.max(0.02, this.distance * 0.04)
    camera.far = this.distance + 6
    camera.updateProjectionMatrix()
    camera.lookAt(this.target)
    camera.updateMatrixWorld()
  }

  view(): View {
    return { target: this.target.clone(), distance: this.distance, azimuth: this.azimuth, polar: this.polar }
  }

  set(view: Partial<View>) {
    if (view.target) this.target.copy(view.target)
    if (view.distance !== undefined) this.distance = view.distance
    if (view.azimuth !== undefined) this.azimuth = view.azimuth
    if (view.polar !== undefined) this.polar = view.polar
    this.clamp()
  }

  clamp() {
    this.distance = MathUtils.clamp(this.distance, this.fitDistance / ZOOM_MAX, this.fitDistance / ZOOM_MIN)
    this.polar = MathUtils.clamp(this.polar, -POLAR_LIMIT, POLAR_LIMIT)
    this.target.clamp(this.bounds.min, this.bounds.max)
  }

  stop() {
    this.anim = null
    this.velAz = 0
    this.velPolar = 0
  }

  /** Turntable rotation by an angle delta, tracking velocity for inertia. */
  rotate(dAz: number, dPolar: number, now: number) {
    this.anim = null
    const dt = Math.max(1, now - this.lastRotate) / 1000
    if (now - this.lastRotate < 100) {
      this.velAz = MathUtils.lerp(this.velAz, dAz / dt, 0.6)
      this.velPolar = MathUtils.lerp(this.velPolar, dPolar / dt, 0.6)
    } else {
      this.velAz = 0
      this.velPolar = 0
    }
    this.lastRotate = now
    this.azimuth += dAz
    this.polar = MathUtils.clamp(this.polar + dPolar, -POLAR_LIMIT, POLAR_LIMIT)
  }

  /** Called when the finger lifts: keep spinning only if it was still moving. */
  release(now: number, inertia: boolean) {
    if (!inertia || now - this.lastRotate > 60 || Math.abs(this.velAz) < 0.3) {
      this.velAz = 0
      this.velPolar = 0
    }
    // A hard flick turns the body, it doesn't spin it like a top.
    this.velAz = MathUtils.clamp(this.velAz, -MAX_SPIN, MAX_SPIN)
    // Elevation inertia feels like drift; keep it short.
    this.velPolar *= 0.5
  }

  /** Moves the view so the content follows a drag of (dx, dy) px, measured at `depth` metres. */
  pan(camera: PerspectiveCamera, dx: number, dy: number, depth: number, viewHeight: number) {
    this.anim = null
    const perPx = (2 * depth * Math.tan(MathUtils.degToRad(camera.fov) / 2)) / viewHeight
    right.setFromMatrixColumn(camera.matrixWorld, 0)
    up.setFromMatrixColumn(camera.matrixWorld, 1)
    this.target.addScaledVector(right, -dx * perPx).addScaledVector(up, dy * perPx)
    this.clamp()
  }

  /** Zooms by `factor` (> 1 = closer) keeping `point` fixed on screen. */
  zoomAt(factor: number, point: Vector3) {
    this.anim = null
    const next = MathUtils.clamp(this.distance / factor, this.fitDistance / ZOOM_MAX, this.fitDistance / ZOOM_MIN)
    const k = next / this.distance
    this.target.sub(point).multiplyScalar(k).add(point)
    this.distance = next
    this.clamp()
  }

  animateTo(to: View, duration: number) {
    this.velAz = 0
    this.velPolar = 0
    if (duration <= 0) {
      this.set(to)
      this.anim = null
      return
    }
    // Take the short way round.
    const from = this.view()
    to = { ...to, azimuth: from.azimuth + MathUtils.euclideanModulo(to.azimuth - from.azimuth + Math.PI, Math.PI * 2) - Math.PI }
    this.anim = { from, to, start: performance.now(), duration }
  }

  /** Advances inertia and animation; returns true while still moving. */
  step(now: number, dt: number): boolean {
    if (this.anim) {
      const { from, to, start, duration } = this.anim
      const t = settle((now - start) / duration)
      this.target.lerpVectors(from.target, to.target, t)
      this.distance = Math.exp(MathUtils.lerp(Math.log(from.distance), Math.log(to.distance), t))
      this.azimuth = MathUtils.lerp(from.azimuth, to.azimuth, t)
      this.polar = MathUtils.lerp(from.polar, to.polar, t)
      if (t >= 1) this.anim = null
      this.clamp()
      return true
    }
    if (this.velAz || this.velPolar) {
      const decay = Math.exp(-dt / INERTIA_TAU)
      this.azimuth += this.velAz * dt
      this.polar = MathUtils.clamp(this.polar + this.velPolar * dt, -POLAR_LIMIT, POLAR_LIMIT)
      this.velAz *= decay
      this.velPolar *= decay
      if (Math.abs(this.velAz) < 0.02) this.velAz = 0
      if (Math.abs(this.velPolar) < 0.02) this.velPolar = 0
      return true
    }
    return false
  }
}

export interface GestureHandlers {
  /** A pointer went down: stop animations and inertia. */
  begin(): void
  /** One-finger / left-button drag, in px. */
  rotate(dx: number, dy: number, now: number): void
  /** Right- or shift-drag, in px, at screen point (x, y). */
  pan(dx: number, dy: number, x: number, y: number): void
  /** Two fingers came down with their midpoint at (x, y). */
  pinchStart(x: number, y: number): void
  /** Distance ratio since the last call, midpoint, and midpoint movement. */
  pinch(scale: number, x: number, y: number, dx: number, dy: number): void
  wheel(factor: number, x: number, y: number): void
  /** All pointers are up. */
  end(now: number): void
  tap(x: number, y: number): void
  doubleTap(x: number, y: number): void
  /** A mouse moved over the view with no button pressed. */
  hover(x: number, y: number): void
  /** The mouse left the view. */
  leave(): void
}

const TAP_SLOP = 8
const TAP_MS = 450
const DOUBLE_TAP_MS = 320
const DOUBLE_TAP_DIST = 36

type P = { x: number; y: number }

export function attachGestures(el: HTMLElement, h: GestureHandlers): () => void {
  const pointers = new Map<number, P>()
  let mode: 'rotate' | 'pan' | 'pinch' | 'idle' = 'idle'
  let tap: (P & { id: number; t: number }) | null = null
  let lastTap: (P & { t: number }) | null = null
  let pinch: { dist: number; mx: number; my: number } | null = null

  const local = (e: { clientX: number; clientY: number }): P => {
    const r = el.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const pinchState = () => {
    const [a, b] = [...pointers.values()]
    return { dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }
  }

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // The pointer is already gone; the gesture still works without capture.
    }
    const p = local(e)
    pointers.set(e.pointerId, p)
    h.begin()
    if (pointers.size === 1) {
      mode = e.button === 2 || e.shiftKey ? 'pan' : 'rotate'
      tap = e.button === 0 ? { id: e.pointerId, t: e.timeStamp, ...p } : null
    } else if (pointers.size === 2) {
      tap = null
      mode = 'pinch'
      pinch = pinchState()
      h.pinchStart(pinch.mx, pinch.my)
    }
  }

  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId)
    if (!prev) {
      if (e.pointerType === 'mouse' && e.buttons === 0) {
        const p = local(e)
        h.hover(p.x, p.y)
      }
      return
    }
    const p = local(e)
    pointers.set(e.pointerId, p)
    if (mode === 'pinch' && pinch && pointers.size >= 2) {
      const cur = pinchState()
      h.pinch(cur.dist / pinch.dist, cur.mx, cur.my, cur.mx - pinch.mx, cur.my - pinch.my)
      pinch = cur
      return
    }
    if (pointers.size !== 1 || mode === 'idle') return
    let dx = p.x - prev.x
    let dy = p.y - prev.y
    if (tap) {
      if (Math.hypot(p.x - tap.x, p.y - tap.y) < TAP_SLOP) return
      // Became a drag: catch up on the movement swallowed by the slop.
      dx = p.x - tap.x
      dy = p.y - tap.y
      tap = null
    }
    if (mode === 'rotate') h.rotate(dx, dy, e.timeStamp)
    else h.pan(dx, dy, p.x, p.y)
  }

  const onUp = (e: PointerEvent) => {
    if (!pointers.delete(e.pointerId)) return
    if (e.type === 'pointerup' && tap?.id === e.pointerId && e.timeStamp - tap.t < TAP_MS) {
      const p = local(e)
      if (lastTap && e.timeStamp - lastTap.t < DOUBLE_TAP_MS && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < DOUBLE_TAP_DIST) {
        lastTap = null
        h.doubleTap(p.x, p.y)
      } else {
        lastTap = { ...p, t: e.timeStamp }
        h.tap(p.x, p.y)
      }
    }
    tap = null
    if (pointers.size >= 2) {
      pinch = pinchState()
    } else if (pointers.size === 1) {
      // The finger left over from a pinch shouldn't start spinning the body.
      pinch = null
      mode = 'idle'
    } else {
      pinch = null
      mode = 'idle'
      h.end(e.timeStamp)
    }
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
    // Trackpad pinch arrives as ctrl+wheel with small deltas.
    const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0016))
    const p = local(e)
    h.wheel(factor, p.x, p.y)
  }

  const prevent = (e: Event) => e.preventDefault()
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') h.leave()
  }

  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)
  el.addEventListener('pointerleave', onLeave)
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('contextmenu', prevent)
  // Safari's own pinch-to-zoom of the page.
  el.addEventListener('gesturestart', prevent)
  el.addEventListener('dblclick', prevent)

  return () => {
    el.removeEventListener('pointerdown', onDown)
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onUp)
    el.removeEventListener('pointerleave', onLeave)
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('contextmenu', prevent)
    el.removeEventListener('gesturestart', prevent)
    el.removeEventListener('dblclick', prevent)
  }
}
