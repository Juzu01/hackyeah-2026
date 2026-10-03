// Pointer gestures on one element: one-finger/mouse drag pans, two-finger pinch
// zooms around the fingers' midpoint, wheel / trackpad pinch zooms around the
// cursor, and short presses are reported as taps (or double taps).

export interface GestureHandlers {
  /** A pointer went down (cancel running animations). */
  start(): void
  /** All pointers are up again. */
  end(): void
  pan(dx: number, dy: number): void
  zoom(factor: number, x: number, y: number): void
  tap(x: number, y: number): void
  doubleTap(x: number, y: number): void
}

const TAP_SLOP = 8
const TAP_MS = 500
const DOUBLE_TAP_MS = 320
const DOUBLE_TAP_DIST = 32

type P = { x: number; y: number }

export function attachGestures(el: HTMLElement, h: GestureHandlers): () => void {
  const pointers = new Map<number, P>()
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
    if (e.pointerType === 'mouse' && e.button !== 0) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // The pointer is already gone (or synthetic); the gesture still works without capture.
    }
    pointers.set(e.pointerId, local(e))
    h.start()
    if (pointers.size === 1) {
      tap = { id: e.pointerId, t: e.timeStamp, ...local(e) }
    } else {
      tap = null
      pinch = pinchState()
    }
  }

  const onMove = (e: PointerEvent) => {
    const prev = pointers.get(e.pointerId)
    if (!prev) return
    const p = local(e)
    pointers.set(e.pointerId, p)
    if (pointers.size === 1) {
      if (tap) {
        if (Math.hypot(p.x - tap.x, p.y - tap.y) < TAP_SLOP) return
        // Became a drag: catch up on the movement swallowed by the slop.
        h.pan(p.x - tap.x, p.y - tap.y)
        tap = null
        return
      }
      h.pan(p.x - prev.x, p.y - prev.y)
    } else if (pinch) {
      const cur = pinchState()
      h.pan(cur.mx - pinch.mx, cur.my - pinch.my)
      h.zoom(cur.dist / pinch.dist, cur.mx, cur.my)
      pinch = cur
    }
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
    pinch = pointers.size >= 2 ? pinchState() : null
    if (pointers.size === 0) h.end()
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
    // Trackpad pinch arrives as ctrl+wheel with small deltas.
    const factor = Math.exp(-e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0022))
    const p = local(e)
    h.zoom(factor, p.x, p.y)
  }

  // Safari's own pinch-to-zoom of the page.
  const stop = (e: Event) => e.preventDefault()

  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('gesturestart', stop)
  el.addEventListener('dblclick', stop)

  return () => {
    el.removeEventListener('pointerdown', onDown)
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onUp)
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('gesturestart', stop)
    el.removeEventListener('dblclick', stop)
  }
}
