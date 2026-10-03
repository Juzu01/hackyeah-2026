// The selection callout: an anchor dot on the part, a 1px accent leader, and a
// block of type set straight on the canvas (no card). On wide screens the block
// sits in the margin beside the part with an elbow leader; on phones it docks
// bottom-left, or top-left when the part is low. It never covers the part.
// Also the hover name tag (fine pointers) and the aria-live announcer.

import type { PartInfo } from './content.ts'

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface CalloutLayout {
  width: number
  height: number
  phone: boolean
  gutter: number
  /** Free band between the HUD's top and bottom rows. */
  top: number
  bottom: number
  /** HUD areas the block should stay clear of. */
  avoid: readonly Rect[]
  /** On-screen extent of the figure: wide blocks go in the margin beyond it. */
  body: Rect
}

const SVG = 'http://www.w3.org/2000/svg'
/** Horizontal clearance between the part and a block beside it. */
const GAP = 52
/** Length of the horizontal run of the elbow leader. */
const ELBOW = 26

function overlap(a: Rect, b: Rect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

interface Placement {
  key: string
  x: number
  y: number
  /** Where the block sits relative to the part. */
  kind: 'left' | 'right' | 'above' | 'below'
}

/** One quiet action under the callout's text (e.g. reporting pain in the part). */
export interface CalloutAction {
  label: string
  run(info: PartInfo): void
}

export class Callout {
  readonly block: HTMLDivElement
  private readonly button: HTMLButtonElement | null = null
  private readonly tag: HTMLElement
  private readonly name: HTMLElement
  private readonly latin: HTMLElement
  private readonly desc: HTMLElement
  private readonly svg: SVGSVGElement
  private readonly leader: SVGPolylineElement
  private readonly dot: SVGCircleElement
  private readonly ring: SVGCircleElement
  private info: PartInfo | null = null
  private w = 0
  private h = 0
  /** Offset of the tag's hairline from the block's top, where the elbow leader attaches. */
  private hairline = 0
  private placement: Placement | null = null
  private lastPoints = ''

  constructor(host: HTMLElement, action?: CalloutAction) {
    this.svg = document.createElementNS(SVG, 'svg')
    this.svg.setAttribute('class', 'atlas-leader')
    this.svg.setAttribute('aria-hidden', 'true')
    this.leader = document.createElementNS(SVG, 'polyline')
    this.ring = document.createElementNS(SVG, 'circle')
    this.ring.setAttribute('r', '7')
    this.ring.setAttribute('class', 'atlas-leader-ring')
    this.dot = document.createElementNS(SVG, 'circle')
    this.dot.setAttribute('r', '2.75')
    this.dot.setAttribute('class', 'atlas-leader-dot')
    this.svg.append(this.leader, this.ring, this.dot)

    this.block = document.createElement('div')
    this.block.className = 'atlas-callout'
    // The text is announced through the live region; only the action is for assistive tech.
    this.block.innerHTML =
      '<div class="callout-text" aria-hidden="true"><div class="callout-tag"></div><div class="callout-name"></div><div class="callout-latin"></div><p class="callout-desc"></p></div>'
    ;[this.tag, this.name, this.latin, this.desc] = Array.from(this.block.firstElementChild!.children) as HTMLElement[]
    if (action) {
      this.button = document.createElement('button')
      this.button.type = 'button'
      this.button.className = 'callout-action'
      this.button.innerHTML = `<span>${action.label}</span><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 6h7.5M6.5 3l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.1"/></svg>`
      this.button.addEventListener('click', () => this.info && action.run(this.info))
      this.block.append(this.button)
    }
    host.append(this.svg, this.block)
  }

  get shown() {
    return this.info !== null
  }

  show(info: PartInfo | null) {
    this.info = info
    this.placement = null
    this.block.classList.toggle('is-on', !!info)
    this.svg.classList.toggle('is-on', !!info)
    if (!info) return
    this.tag.textContent = info.sideLabel ? `${info.groupLabel} · ${info.sideLabel}` : info.groupLabel
    this.name.textContent = info.name
    this.latin.textContent = info.latin
    this.latin.hidden = !info.latin
    this.desc.textContent = info.description
    this.desc.hidden = !info.description
    this.button?.setAttribute('aria-label', `${this.button.textContent}: ${info.name}`)
    this.measure()
  }

  /**
   * Only the anchor ring on the part: used while a sheet that names the part
   * covers the bottom of the view, so the two don't repeat each other.
   */
  setCompact(compact: boolean) {
    if (this.block.classList.contains('is-compact') === compact) return
    this.block.classList.toggle('is-compact', compact)
    this.svg.classList.toggle('is-compact', compact)
  }

  /** Block size changes with the copy and the fonts; measured, not guessed. */
  measure() {
    if (!this.info) return
    this.w = this.block.offsetWidth
    this.h = this.block.offsetHeight
    this.hairline = this.tag.offsetTop + this.tag.offsetHeight + 1
    this.placement = null
  }

  rect(): DOMRect | null {
    return this.info && !this.block.classList.contains('is-compact') ? this.block.getBoundingClientRect() : null
  }

  /** Re-anchors to the part. `anchor` is null when the part is off screen or behind the camera. */
  update(anchor: { x: number; y: number } | null, part: Rect, layout: CalloutLayout) {
    if (!this.info) return
    const p = this.place(anchor, part, layout)
    this.block.style.transform = `translate3d(${Math.round(p.x)}px, ${Math.round(p.y)}px, 0)`
    let points = ''
    if (anchor) {
      const { x: ax, y: ay } = anchor
      if (p.kind === 'left' || p.kind === 'right') {
        const sx = p.kind === 'left' ? p.x + this.w + 8 : p.x - 8
        const sy = p.y + this.hairline
        const ex = sx + (p.kind === 'left' ? ELBOW : -ELBOW)
        points = `${sx},${sy} ${ex},${sy} ${ax},${ay}`
      } else {
        const tx = clamp(ax, p.x + 6, p.x + Math.min(this.w, 240) - 6)
        const ty = p.kind === 'below' ? p.y - 8 : p.y + this.h + 8
        points = `${tx},${ty} ${ax},${ay}`
      }
      this.dot.setAttribute('cx', ax.toFixed(1))
      this.dot.setAttribute('cy', ay.toFixed(1))
      this.ring.setAttribute('cx', ax.toFixed(1))
      this.ring.setAttribute('cy', ay.toFixed(1))
    }
    this.svg.classList.toggle('no-anchor', !anchor)
    if (points !== this.lastPoints) {
      this.leader.setAttribute('points', points)
      this.lastPoints = points
    }
  }

  private place(anchor: { x: number; y: number } | null, part: Rect, l: CalloutLayout): Placement {
    const { w, h } = this
    const minY = l.top
    const maxY = l.height - l.bottom - h
    const ax = anchor?.x ?? l.width / 2
    const ay = anchor?.y ?? l.height / 2
    const candidates: Placement[] = []
    const dockLeft = l.gutter
    if (l.phone) {
      candidates.push({ key: 'dock-bottom', x: dockLeft, y: maxY, kind: 'below' })
      candidates.push({ key: 'dock-top', x: dockLeft, y: minY, kind: 'above' })
    } else {
      const y = clamp(ay - this.hairline, minY, maxY)
      const nearLeft = ax < l.width / 2
      const left: Placement = { key: 'left', x: Math.max(l.gutter, Math.min(part.left, l.body.left) - GAP - w), y, kind: 'left' }
      const right: Placement = {
        key: 'right',
        x: Math.min(l.width - l.gutter - w, Math.max(part.right, l.body.right) + GAP),
        y,
        kind: 'right',
      }
      candidates.push(...(nearLeft ? [left, right] : [right, left]))
      candidates.push({ key: 'dock-bottom', x: dockLeft, y: maxY, kind: 'below' })
      candidates.push({ key: 'dock-top', x: dockLeft, y: minY, kind: 'above' })
      candidates.push({ key: 'dock-bottom-right', x: l.width - l.gutter - w, y: maxY, kind: 'below' })
    }

    const area = Math.max(1, w * h)
    // Phones dock at the bottom unless that would cover the part.
    const order = l.phone ? 0.6 : 0.05
    const score = (c: Placement, i: number) => {
      const r = { left: c.x, top: c.y, right: c.x + w, bottom: c.y + h }
      // Covering the selected part is the one thing it must not do.
      let s = (overlap(r, part) / area) * 100
      for (const a of l.avoid) s += (overlap(r, a) / area) * 20
      // Blocks beside the part need room for the leader to read as a leader.
      if (c.kind === 'left' && r.right + 16 > ax) s += 50
      if (c.kind === 'right' && r.left - 16 < ax) s += 50
      // Prefer short leaders, then the order candidates were listed in.
      const dx = Math.max(r.left - ax, 0, ax - r.right)
      const dy = Math.max(r.top - ay, 0, ay - r.bottom)
      return s + Math.hypot(dx, dy) / Math.max(l.width, l.height) + i * order
    }
    let best = candidates[0]
    let bestScore = Infinity
    let currentScore = Infinity
    candidates.forEach((c, i) => {
      const s = score(c, i)
      if (s < bestScore) {
        bestScore = s
        best = c
      }
      if (c.key === this.placement?.key) currentScore = s
    })
    // Hysteresis: don't flip sides on every small rotation.
    if (this.placement && currentScore < bestScore + 0.25) {
      best = candidates.find((c) => c.key === this.placement!.key)!
    }
    this.placement = best
    return best
  }
}

/** A tiny name tag next to the mouse cursor. */
export class HoverTag {
  private readonly el: HTMLDivElement
  private text = ''

  constructor(host: HTMLElement) {
    this.el = document.createElement('div')
    this.el.className = 'atlas-hover'
    this.el.setAttribute('aria-hidden', 'true')
    host.append(this.el)
  }

  show(text: string | null, x = 0, y = 0) {
    this.el.classList.toggle('is-on', !!text)
    if (!text) return
    if (text !== this.text) {
      this.el.textContent = text
      this.text = text
    }
    this.el.style.transform = `translate3d(${Math.round(x + 14)}px, ${Math.round(y + 16)}px, 0)`
  }
}

/** Polite screen-reader announcements of the selection. */
export class Announcer {
  private readonly el: HTMLDivElement

  constructor(host: HTMLElement) {
    this.el = document.createElement('div')
    this.el.className = 'atlas-sr'
    this.el.setAttribute('aria-live', 'polite')
    this.el.setAttribute('role', 'status')
    host.append(this.el)
  }

  say(text: string) {
    this.el.textContent = text
  }
}
