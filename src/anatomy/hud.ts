// The quiet, peripheral HUD: title and view name, the depth ladder with the zoom
// readout, patient-orientation letters, a live metric scale bar, the credit
// line, the first-run hint, plus the loading and no-WebGL states.

import { DEPTH_NAMES, smoothstep, type DepthName } from './depth.ts'
import type { Rect } from './labels.ts'

const VIEWS = ['Widok przedni', 'Widok boczny lewy', 'Widok tylny', 'Widok boczny prawy']
const LADDER: Record<DepthName, string> = {
  skin: 'Skóra',
  muscles: 'Mięśnie',
  deep: 'Narządy i kości',
  exploded: 'Rozwarstwienie',
}
/** Scale bar lengths in metres; the largest that fits wins. */
const SCALES = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5]
const SCALE_MAX_PX = 120
const SIDE_FADE = [Math.sin((25 * Math.PI) / 180), Math.sin((40 * Math.PI) / 180)]

const HINT_TOUCH = 'Rozsuń palce, aby zajrzeć głębiej'
const HINT_MOUSE = 'Przewiń, aby zajrzeć głębiej · przeciągnij, aby obrócić'

// Two fingertips spreading apart (touch), or a mouse with its wheel (mouse).
const ICON_TOUCH = `<svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="17" r="2.2"/><circle cx="17" cy="11" r="2.2"/><path d="M8.6 19.4 4.5 23.5M4.5 20v3.5H8M19.4 8.6l4.1-4.1M20 4.5h3.5V8"/></g></svg>`
const ICON_MOUSE = `<svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"><rect x="9" y="5" width="10" height="17" rx="5"/><path d="M14 8.5v3"/></g></svg>`

export interface HudState {
  zoom: number
  depth: DepthName
  azimuth: number
  /** Screen pixels per metre at the orbit target. */
  pxPerMetre: number
}

export interface HudOptions {
  touch: boolean
  hint: boolean
  /** Commit shown discreetly under the credit (deploys set it). */
  build?: string
}

export class Hud {
  readonly root: HTMLDivElement
  private readonly view: HTMLElement
  private readonly rows: HTMLElement[]
  private readonly marker: HTMLElement
  private readonly zoomText: HTMLElement
  private readonly orientL: HTMLElement
  private readonly orientR: HTMLElement
  private readonly scaleBar: HTMLElement
  private readonly scaleText: HTMLElement
  private readonly hint: HTMLElement | null
  private readonly loading: HTMLDivElement
  private readonly loadingBar: HTMLElement
  private readonly loadingText: HTMLElement
  private last = { view: -1, depth: '', zoom: '', letters: '', orient: -1, scale: -1, scalePx: -1 }
  private hintTimer = 0

  constructor(host: HTMLElement, options: HudOptions) {
    this.root = document.createElement('div')
    this.root.className = 'atlas-hud'
    this.root.setAttribute('aria-hidden', 'true')
    this.root.innerHTML = `
      <div class="hud-title"><div class="hud-brand">Atlas anatomiczny</div><div class="hud-view"></div></div>
      <div class="hud-depth">
        <ol class="hud-ladder">${DEPTH_NAMES.map((d) => `<li data-depth="${d}">${LADDER[d]}</li>`).join('')}<i class="hud-marker"></i></ol>
        <div class="hud-zoom"></div>
      </div>
      <div class="hud-orient hud-orient-l"></div>
      <div class="hud-orient hud-orient-r"></div>
      <div class="hud-scale"><div class="hud-scale-text"></div><div class="hud-scale-bar"></div></div>
      <div class="hud-credit">${
        options.build ? `<span class="hud-build" title="Wersja">${options.build.slice(0, 7)}</span>` : ''
      }<span>BodyParts3D © DBCLS</span><span class="hud-sep"> · </span><span>CC BY-SA 2.1 JP</span></div>`
    const q = (s: string) => this.root.querySelector(s) as HTMLElement
    this.view = q('.hud-view')
    this.rows = Array.from(this.root.querySelectorAll('.hud-ladder li'))
    this.marker = q('.hud-marker')
    this.zoomText = q('.hud-zoom')
    this.orientL = q('.hud-orient-l')
    this.orientR = q('.hud-orient-r')
    this.scaleBar = q('.hud-scale-bar')
    this.scaleText = q('.hud-scale-text')

    this.hint = null
    if (options.hint) {
      this.hint = document.createElement('div')
      this.hint.className = 'hud-hint'
      this.hint.innerHTML = `${options.touch ? ICON_TOUCH : ICON_MOUSE}<span>${options.touch ? HINT_TOUCH : HINT_MOUSE}</span>`
      this.root.append(this.hint)
    }

    this.loading = document.createElement('div')
    this.loading.className = 'atlas-loading'
    this.loading.setAttribute('role', 'progressbar')
    this.loading.setAttribute('aria-label', 'Wczytywanie modelu')
    this.loading.innerHTML = '<div class="loading-track"><div class="loading-bar"></div></div><div class="loading-text"></div>'
    this.loadingBar = this.loading.querySelector('.loading-bar') as HTMLElement
    this.loadingText = this.loading.querySelector('.loading-text') as HTMLElement
    this.setProgress(null)

    host.append(this.root, this.loading)
  }

  setProgress(fraction: number | null) {
    this.loading.classList.toggle('is-indeterminate', fraction === null)
    if (fraction === null) {
      this.loadingText.textContent = 'Wczytywanie modelu'
      this.loading.removeAttribute('aria-valuenow')
      return
    }
    const pct = Math.round(fraction * 100)
    this.loadingBar.style.transform = `scaleX(${fraction})`
    this.loadingText.textContent = `Wczytywanie modelu · ${pct}%`
    this.loading.setAttribute('aria-valuenow', String(pct))
  }

  /** Cross-fades the loading state out and the HUD in; starts the hint's clock. */
  ready() {
    this.loading.classList.add('is-done')
    this.root.classList.add('is-ready')
    if (this.hint) {
      this.hint.classList.add('is-on')
      this.hintTimer = window.setTimeout(() => this.dismissHint(), 7000)
    }
  }

  /**
   * The free band between the HUD's top and bottom rows, and the HUD blocks the
   * callout should stay clear of, in px relative to `host`.
   */
  bands(host: DOMRect): { top: number; bottom: number; avoid: Rect[] } {
    const rel = (el: Element): Rect => {
      const r = el.getBoundingClientRect()
      return { left: r.left - host.left, top: r.top - host.top, right: r.right - host.left, bottom: r.bottom - host.top }
    }
    const top = this.root.querySelectorAll('.hud-title, .hud-depth')
    const bottom = this.root.querySelectorAll('.hud-scale, .hud-credit')
    const avoid = [...top, ...bottom, ...this.root.querySelectorAll('.hud-orient')].map(rel)
    return {
      top: Math.max(0, ...[...top].map((el) => rel(el).bottom)) + 14,
      bottom: host.height - Math.min(host.height, ...[...bottom].map((el) => rel(el).top)) + 14,
      avoid,
    }
  }

  dismissHint() {
    if (!this.hint) return
    window.clearTimeout(this.hintTimer)
    this.hint.classList.remove('is-on')
  }

  /** Replaces the loading state with a calm explanation. */
  noWebGL() {
    const host = this.loading.parentElement
    this.loading.remove()
    this.root.remove()
    const box = document.createElement('div')
    box.className = 'atlas-fallback'
    box.setAttribute('role', 'alert')
    box.innerHTML =
      '<div class="hud-brand">Atlas anatomiczny</div><p>Ta przeglądarka nie obsługuje WebGL, więc nie może wyświetlić modelu 3D.</p><p class="atlas-fallback-hint">Włącz akcelerację sprzętową w ustawieniach albo otwórz stronę w innej przeglądarce.</p>'
    host?.append(box)
    return box
  }

  update(s: HudState) {
    const turn = ((s.azimuth % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    const view = Math.round(turn / (Math.PI / 2)) % 4
    if (view !== this.last.view) {
      this.view.textContent = VIEWS[view]
      this.last.view = view
    }

    if (s.depth !== this.last.depth) {
      const i = DEPTH_NAMES.indexOf(s.depth)
      this.rows.forEach((row, j) => row.classList.toggle('is-on', i === j))
      this.marker.style.transform = `translateY(${this.rows[i]?.offsetTop ?? 0}px)`
      this.last.depth = s.depth
    }

    const zoom = `${s.zoom.toFixed(1).replace('.', ',')}×`
    if (zoom !== this.last.zoom) {
      this.zoomText.textContent = zoom
      this.last.zoom = zoom
    }

    // The patient's right (P) is on screen left in the front view, as in radiology.
    const cos = Math.cos(s.azimuth)
    const letters = cos >= 0 ? 'PL' : 'LP'
    if (letters !== this.last.letters) {
      this.orientL.textContent = letters[0]
      this.orientR.textContent = letters[1]
      this.last.letters = letters
    }
    const orient = Math.round(smoothstep(SIDE_FADE[0], SIDE_FADE[1], Math.abs(cos)) * 100) / 100
    if (orient !== this.last.orient) {
      this.orientL.style.opacity = this.orientR.style.opacity = String(orient)
      this.last.orient = orient
    }

    let scale = SCALES[0]
    for (const m of SCALES) if (m * s.pxPerMetre <= SCALE_MAX_PX) scale = m
    const px = Math.round(scale * s.pxPerMetre)
    if (scale !== this.last.scale || px !== this.last.scalePx) {
      this.scaleBar.style.width = `${px}px`
      this.scaleText.textContent = `${Math.round(scale * 100)} cm`
      this.last.scale = scale
      this.last.scalePx = px
    }
  }

  destroy() {
    window.clearTimeout(this.hintTimer)
  }
}
