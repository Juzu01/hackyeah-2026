// Full-screen interactive body: renders the model as SVG, drives the camera from
// gestures, and turns zoom into depth. Zooming in first dissolves the chest and
// belly muscles to reveal the organs, then pulls overlapping organs apart
// (exploded view) so each one can be tapped on its own.

import { buildBodyModel, partLabel, type BodyPart } from './anatomy.ts'
import { attachGestures } from './gestures.ts'
import { smoothstep, unionBBox, type Pt } from './geometry.ts'
import { coveringParts, explodedBounds, remainingOverlaps, solveExplode } from './layout.ts'

/** Zoom, relative to "whole body fits the screen", at which each effect starts and ends. */
export const DEPTH = {
  reveal: [1.35, 2.0],
  explode: [1.8, 3.2],
  max: 12,
} as const

export interface BodyMapOptions {
  onSelect?: (part: BodyPart | null) => void
}

export interface BodyMapHandle {
  parts: readonly BodyPart[]
  select(id: string | null): void
  /** Animates the camera to a part (deep enough to reveal it) and selects it. */
  focus(id: string): void
  reset(): void
  destroy(): void
}

// The model and its exploded layout never change, so solve them once per page.
let scene: ReturnType<typeof buildScene> | null = null

function buildScene() {
  const model = buildBodyModel()
  const offsets = solveExplode(model.organs)
  if (import.meta.env.DEV) {
    const stuck = remainingOverlaps(model.organs, offsets)
    if (stuck.length) console.warn('Organs still overlap when fully exploded:', stuck)
  }
  const torsoMuscles = model.muscles.filter((m) => m.centroid[1] < 410 && Math.abs(m.centroid[0]) < 90)
  const covering = coveringParts(torsoMuscles, model.organs)
  const bounds = unionBBox([model.bounds, explodedBounds(model.organs, offsets)])
  return { model, offsets, covering, bounds }
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v))
  parent?.appendChild(el)
  return el
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

type View = { s: number; tx: number; ty: number }

export function mountBodyMap(host: HTMLElement, options: BodyMapOptions = {}): BodyMapHandle {
  scene ??= buildScene()
  const { model, offsets, covering, bounds } = scene
  const allParts = [...model.muscles, ...model.organs]
  const byId = new Map(allParts.map((p) => [p.id, p]))

  // --- DOM -----------------------------------------------------------------

  const root = svg('svg', { class: 'body-svg', role: 'img', 'aria-label': 'Interaktywna mapa ciała człowieka' }, host)
  const defs = svg('defs', {}, root)
  const gradients = new Map<string, string>()
  const gradientFor = (color: string) => {
    let id = gradients.get(color)
    if (!id) {
      id = `g${gradients.size}`
      gradients.set(color, id)
      const g = svg('radialGradient', { id, cx: 0.38, cy: 0.32, r: 0.85 }, defs)
      svg('stop', { offset: 0, 'stop-color': shade(color, 0.28) }, g)
      svg('stop', { offset: 0.55, 'stop-color': color }, g)
      svg('stop', { offset: 1, 'stop-color': shade(color, -0.38) }, g)
    }
    return `url(#${id})`
  }
  // One gradient across the whole figure, so overlapping skin pieces don't show seams.
  const skinGradient = svg('linearGradient', {
    id: 'skin',
    gradientUnits: 'userSpaceOnUse',
    x1: 0,
    y1: model.bounds.minY,
    x2: 0,
    y2: model.bounds.maxY,
  }, defs)
  svg('stop', { offset: 0, 'stop-color': '#2c3a5e' }, skinGradient)
  svg('stop', { offset: 1, 'stop-color': '#1c2642' }, skinGradient)

  const world = svg('g', {}, root)
  const skinOutline = svg('g', { class: 'skin-outline' }, world)
  const skinFill = svg('g', { class: 'skin-fill' }, world)
  for (const d of model.skin) {
    svg('path', { d, 'vector-effect': 'non-scaling-stroke' }, skinOutline)
    svg('path', { d, fill: 'url(#skin)' }, skinFill)
  }
  svg('path', { class: 'skin-details', d: model.skinDetails, 'vector-effect': 'non-scaling-stroke' }, skinFill)

  const nodes = new Map<string, SVGGElement>()
  const drawPart = (part: BodyPart, layer: SVGGElement) => {
    const g = svg('g', { class: `part ${part.info.system}`, 'data-id': part.id }, layer)
    svg('title', {}, g).textContent = partLabel(part).title
    svg('path', {
      class: 'fill',
      d: part.d,
      fill: gradientFor(part.color),
      stroke: shade(part.color, -0.55),
      'vector-effect': 'non-scaling-stroke',
    }, g)
    if (part.details) {
      svg('path', { class: 'details', d: part.details, stroke: shade(part.color, -0.5), 'vector-effect': 'non-scaling-stroke' }, g)
    }
    nodes.set(part.id, g)
  }

  const muscleLayer = svg('g', { class: 'muscles' }, world)
  for (const m of model.muscles) drawPart(m, muscleLayer)
  // Thin lines from where each organ sits in the body to where it floats when exploded.
  const tetherLayer = svg('g', { class: 'tethers' }, world)
  const tethers = model.organs
    .filter((o) => Math.hypot(...offsets.get(o.id)!) > 3)
    .map((o) => ({
      organ: o,
      line: svg('line', { 'vector-effect': 'non-scaling-stroke' }, tetherLayer),
      dot: svg('circle', {}, tetherLayer),
    }))
  const organLayer = svg('g', { class: 'organs' }, world)
  for (const o of model.organs) drawPart(o, organLayer)

  const highlight = svg('g', { class: 'highlight' }, world)
  const glow = [10, 5, 2].map((w) => svg('path', { 'stroke-width': w, 'vector-effect': 'non-scaling-stroke' }, highlight))

  const label = document.createElement('div')
  label.className = 'part-label'
  label.innerHTML = '<strong></strong><span></span>'
  host.appendChild(label)

  // --- Camera ------------------------------------------------------------------

  let width = 0
  let height = 0
  let fitScale = 1
  let view: View = { s: 1, tx: 0, ty: 0 }
  let selected: BodyPart | null = null
  let selectedBeforeTap: BodyPart | null = null

  const fitView = (): View => {
    const b = model.bounds
    const pad = Math.min(40, Math.max(12, Math.min(width, height) * 0.05))
    const s = Math.min((width - 2 * pad) / (b.maxX - b.minX), (height - 2 * pad) / (b.maxY - b.minY))
    return { s, tx: width / 2 - ((b.minX + b.maxX) / 2) * s, ty: height / 2 - ((b.minY + b.maxY) / 2) * s }
  }

  /** Keeps the screen center over the body (including where organs explode to). */
  const clampView = (v: View): View => {
    const s = Math.min(fitScale * DEPTH.max, Math.max(fitScale * 0.8, v.s))
    const k = s / v.s
    const tx = width / 2 - (width / 2 - v.tx) * k
    const ty = height / 2 - (height / 2 - v.ty) * k
    const clamp = (t: number, center: number, min: number, max: number) =>
      Math.min(center - min * s, Math.max(center - max * s, t))
    return {
      s,
      tx: clamp(tx, width / 2, bounds.minX, bounds.maxX),
      ty: clamp(ty, height / 2, bounds.minY, bounds.maxY),
    }
  }

  const zoomLevel = (s = view.s) => s / fitScale
  const revealAt = (k: number) => smoothstep(DEPTH.reveal[0], DEPTH.reveal[1], k)
  const explodeAt = (k: number) => smoothstep(DEPTH.explode[0], DEPTH.explode[1], k)

  /** Current translation of a part (organs drift when exploded, chest muscles peel off). */
  const partShift = (part: BodyPart, k: number): Pt => {
    if (part.info.system === 'organ') {
      const [dx, dy] = offsets.get(part.id)!
      const e = explodeAt(k)
      return [dx * e, dy * e]
    }
    if (covering.has(part.id)) {
      const r = revealAt(k)
      const dx = part.centroid[0]
      const dy = (part.centroid[1] - 300) * 0.3
      const len = Math.hypot(dx, dy) || 1
      return [(dx / len) * 10 * r, (dy / len) * 10 * r]
    }
    return [0, 0]
  }

  let lastDepth = ''

  const render = () => {
    frame = 0
    const { s, tx, ty } = view
    world.setAttribute('transform', `matrix(${s} 0 0 ${s} ${tx} ${ty})`)
    const k = zoomLevel()
    const reveal = revealAt(k)
    const explode = explodeAt(k)

    const depthKey = `${reveal.toFixed(4)}|${explode.toFixed(4)}`
    if (depthKey !== lastDepth) {
      lastDepth = depthKey
      for (const o of model.organs) {
        const g = nodes.get(o.id)!
        const [dx, dy] = partShift(o, k)
        g.setAttribute('transform', `translate(${dx} ${dy})`)
        g.style.opacity = String(reveal)
        g.classList.toggle('inert', reveal < 0.5)
      }
      for (const id of covering) {
        const g = nodes.get(id)!
        const [dx, dy] = partShift(byId.get(id)!, k)
        g.setAttribute('transform', `translate(${dx} ${dy})`)
        g.style.opacity = String(1 - 0.88 * reveal)
        g.classList.toggle('inert', reveal >= 0.5)
      }
      tetherLayer.style.opacity = String(explode * 0.7)
    }

    // Tether ends and dots are sized in screen pixels, so update them every frame.
    for (const { organ, line, dot } of tethers) {
      const [cx, cy] = organ.centroid
      const [dx, dy] = partShift(organ, k)
      line.setAttribute('x1', String(cx))
      line.setAttribute('y1', String(cy))
      line.setAttribute('x2', String(cx + dx))
      line.setAttribute('y2', String(cy + dy))
      dot.setAttribute('cx', String(cx))
      dot.setAttribute('cy', String(cy))
      dot.setAttribute('r', String(2.2 / s))
    }

    if (selected) {
      const [dx, dy] = partShift(selected, k)
      highlight.setAttribute('transform', `translate(${dx} ${dy})`)
      const b = selected.bbox
      const top = (b.minY + dy) * s + ty
      const bottom = (b.maxY + dy) * s + ty
      const x = Math.min(width - 12, Math.max(12, ((b.minX + b.maxX) / 2 + dx) * s + tx))
      const below = top < 72
      label.style.transform = `translate(${x}px, ${below ? bottom + 12 : top - 12}px) translate(-50%, ${below ? '0' : '-100%'})`
      label.style.setProperty('--max', `${Math.max(120, Math.min(width - 24, 2 * Math.min(x, width - x) - 8))}px`)
    }
  }

  let frame = 0
  const requestRender = () => {
    frame ||= requestAnimationFrame(render)
  }

  const setView = (v: View) => {
    view = clampView(v)
    requestRender()
  }

  // --- Animation -----------------------------------------------------------------

  let anim = 0
  const stopAnimation = () => {
    cancelAnimationFrame(anim)
    anim = 0
  }
  const animateTo = (target: View, ms = 420) => {
    stopAnimation()
    const from = view
    const to = clampView(target)
    const start = performance.now()
    // Interpolate the world point at the screen center and the log of the scale,
    // so the zoom feels uniform and the path doesn't swing sideways.
    const center = (v: View): Pt => [(width / 2 - v.tx) / v.s, (height / 2 - v.ty) / v.s]
    const [ax, ay] = center(from)
    const [bx, by] = center(to)
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const e = 1 - Math.pow(1 - t, 3)
      const s = Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * e)
      const cx = ax + (bx - ax) * e
      const cy = ay + (by - ay) * e
      view = { s, tx: width / 2 - cx * s, ty: height / 2 - cy * s }
      render()
      anim = t < 1 ? requestAnimationFrame(step) : 0
    }
    anim = requestAnimationFrame(step)
  }

  const zoomAround = (factor: number, x: number, y: number, v = view): View => {
    // Clamp here rather than in clampView so the point under the fingers stays put at the limits.
    const s = Math.min(fitScale * DEPTH.max, Math.max(fitScale * 0.8, v.s * factor))
    const f = s / v.s
    return { s, tx: x - (x - v.tx) * f, ty: y - (y - v.ty) * f }
  }

  /** After a gesture, zooming out past "fits the screen" springs back. */
  const settle = () => {
    if (zoomLevel() < 1) animateTo(fitView(), 300)
  }
  let settleTimer = 0

  // --- Selection ---------------------------------------------------------------

  const select = (id: string | null) => {
    const part = id ? (byId.get(id) ?? null) : null
    if (part === selected) return
    if (selected) nodes.get(selected.id)!.classList.remove('selected')
    selected = part
    host.classList.toggle('has-selection', !!part)
    if (part) {
      nodes.get(part.id)!.classList.add('selected')
      for (const p of glow) p.setAttribute('d', part.d)
      const { title, subtitle } = partLabel(part)
      label.querySelector('strong')!.textContent = title
      label.querySelector('span')!.textContent = subtitle
    }
    label.classList.toggle('visible', !!part)
    highlight.style.display = part ? '' : 'none'
    if (width) render()
    options.onSelect?.(part)
  }

  const partAt = (x: number, y: number): BodyPart | null => {
    const r = host.getBoundingClientRect()
    const hit = document.elementFromPoint(r.left + x, r.top + y)?.closest<SVGGElement>('.part')
    return hit ? (byId.get(hit.dataset.id!) ?? null) : null
  }

  const focusView = (part: BodyPart): View => {
    const k = part.info.system === 'organ' ? DEPTH.explode[1] : 2.4
    const s = fitScale * k
    const [dx, dy] = partShift(part, k)
    const cx = (part.bbox.minX + part.bbox.maxX) / 2 + dx
    const cy = (part.bbox.minY + part.bbox.maxY) / 2 + dy
    return { s, tx: width / 2 - cx * s, ty: height / 2 - cy * s }
  }

  // --- Wiring --------------------------------------------------------------------

  const detachGestures = attachGestures(host, {
    start() {
      stopAnimation()
      host.classList.add('dragging')
    },
    end() {
      host.classList.remove('dragging')
      settle()
    },
    pan(dx, dy) {
      setView({ ...view, tx: view.tx + dx, ty: view.ty + dy })
    },
    zoom(factor, x, y) {
      stopAnimation()
      setView(zoomAround(factor, x, y))
      clearTimeout(settleTimer)
      settleTimer = window.setTimeout(settle, 250)
    },
    tap(x, y) {
      selectedBeforeTap = selected
      const part = partAt(x, y)
      select(part && part !== selected ? part.id : null)
    },
    doubleTap(x, y) {
      // The first tap of a double tap already changed the selection; undo that.
      select(selectedBeforeTap?.id ?? null)
      const k = zoomLevel()
      if (k < DEPTH.explode[1] * 0.95) {
        const target = Math.min(DEPTH.max, k < DEPTH.reveal[1] ? DEPTH.reveal[1] * 1.1 : DEPTH.explode[1])
        animateTo(zoomAround(target / k, x, y))
      } else {
        animateTo(fitView())
      }
    },
  })

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') select(null)
    if (e.key === '0') animateTo(fitView())
  }
  window.addEventListener('keydown', onKey)

  const resize = () => {
    const r = host.getBoundingClientRect()
    if (!r.width || !r.height) return
    const first = width === 0
    // Keep the same zoom level and the same world point at the center.
    const k = first ? 1 : zoomLevel()
    const cx = first ? 0 : (width / 2 - view.tx) / view.s
    const cy = first ? 0 : (height / 2 - view.ty) / view.s
    width = r.width
    height = r.height
    root.setAttribute('viewBox', `0 0 ${width} ${height}`)
    const fit = fitView()
    fitScale = fit.s
    if (first) {
      view = fit
    } else {
      const s = fitScale * k
      view = clampView({ s, tx: width / 2 - cx * s, ty: height / 2 - cy * s })
    }
    render()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  resize()

  // Deep links / debugging: ?k=3&x=0&y=280&sel=heart
  const params = new URLSearchParams(location.search)
  if (params.has('k') || params.has('x') || params.has('y')) {
    const k = Number(params.get('k') ?? 1)
    const s = fitScale * k
    const fit = fitView()
    const cx = params.has('x') ? Number(params.get('x')) : (width / 2 - fit.tx) / fit.s
    const cy = params.has('y') ? Number(params.get('y')) : (height / 2 - fit.ty) / fit.s
    view = clampView({ s, tx: width / 2 - cx * s, ty: height / 2 - cy * s })
    render()
  }
  if (params.get('sel')) select(params.get('sel'))
  highlight.style.display = selected ? '' : 'none'

  return {
    parts: allParts,
    select,
    focus(id) {
      const part = byId.get(id)
      if (!part) return
      select(id)
      animateTo(focusView(part), 600)
    },
    reset() {
      select(null)
      animateTo(fitView())
    },
    destroy() {
      stopAnimation()
      cancelAnimationFrame(frame)
      clearTimeout(settleTimer)
      observer.disconnect()
      detachGestures()
      window.removeEventListener('keydown', onKey)
      root.remove()
      label.remove()
      host.classList.remove('has-selection', 'dragging')
    },
  }
}
