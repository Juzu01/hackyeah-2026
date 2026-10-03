// What the viewer draws over the canvas for the selection: a small accent ring
// and dot on the part (the card with its name and copy is the app's sheet).
// Also the hover name tag (mouse only) and the aria-live announcer.

const SVG = 'http://www.w3.org/2000/svg'

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}

/** The selection's anchor: a dot inside a thin ring, following the part every frame. */
export class Marker {
  private readonly svg: SVGSVGElement
  private readonly group: SVGGElement
  private shown = false
  private last = ''

  constructor(host: HTMLElement) {
    this.svg = document.createElementNS(SVG, 'svg')
    this.svg.setAttribute('class', 'atlas-marker')
    this.svg.setAttribute('aria-hidden', 'true')
    this.group = document.createElementNS(SVG, 'g')
    const ring = document.createElementNS(SVG, 'circle')
    ring.setAttribute('r', '9')
    ring.setAttribute('class', 'atlas-marker-ring')
    const dot = document.createElementNS(SVG, 'circle')
    dot.setAttribute('r', '3')
    dot.setAttribute('class', 'atlas-marker-dot')
    this.group.append(ring, dot)
    this.svg.append(this.group)
    host.append(this.svg)
  }

  /** Null hides it (nothing selected, or the anchor is off screen or under a sheet). */
  update(at: { x: number; y: number } | null) {
    if (!!at !== this.shown) {
      this.shown = !!at
      this.svg.classList.toggle('is-on', this.shown)
    }
    if (!at) return
    const t = `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`
    if (t !== this.last) {
      this.group.setAttribute('transform', t)
      this.last = t
    }
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
