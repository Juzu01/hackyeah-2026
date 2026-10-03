// The viewer's own overlays besides the selection marker: the pulsing hint on
// the body for first-time visitors, the loading state (with the model's credit)
// and the no-WebGL message. The app's chrome lives in src/atlas/.

export const CREDIT = 'Model: BodyParts3D © DBCLS · CC BY-SA 2.1 JP'

export class Hud {
  private readonly host: HTMLElement
  private readonly loading: HTMLDivElement
  private readonly loadingBar: HTMLElement
  private readonly loadingText: HTMLElement

  constructor(host: HTMLElement) {
    this.host = host
    this.loading = document.createElement('div')
    this.loading.className = 'atlas-loading'
    this.loading.innerHTML = `<div class="loading-track" role="progressbar" aria-label="Wczytywanie modelu"><div class="loading-bar"></div></div><div class="loading-text"></div><div class="loading-credit">${CREDIT}</div>`
    this.loadingBar = this.loading.querySelector('.loading-bar') as HTMLElement
    this.loadingText = this.loading.querySelector('.loading-text') as HTMLElement
    this.setProgress(null)
    host.append(this.loading)
  }

  setProgress(fraction: number | null) {
    const bar = this.loading.firstElementChild as HTMLElement
    this.loading.classList.toggle('is-indeterminate', fraction === null)
    if (fraction === null) {
      this.loadingText.textContent = 'Wczytywanie modelu'
      bar.removeAttribute('aria-valuenow')
      return
    }
    const pct = Math.round(fraction * 100)
    this.loadingBar.style.transform = `scaleX(${fraction})`
    this.loadingText.textContent = `Wczytywanie modelu · ${pct}%`
    bar.setAttribute('aria-valuenow', String(pct))
  }

  /** Cross-fades the loading state out. */
  ready() {
    this.loading.classList.add('is-done')
  }

  /** Replaces the loading state with a calm explanation. */
  noWebGL() {
    this.loading.remove()
    const box = document.createElement('div')
    box.className = 'atlas-fallback'
    box.setAttribute('role', 'alert')
    box.innerHTML =
      '<h1>Atlas ciała</h1><p>Ta przeglądarka nie obsługuje WebGL, więc nie może wyświetlić modelu 3D.</p><p class="atlas-fallback-hint">Włącz akcelerację sprzętową w ustawieniach albo otwórz stronę w innej przeglądarce.</p>'
    this.host.append(box)
  }
}

/**
 * For first-time visitors: a softly pulsing ring on the chest with a short
 * label, until they tap something. Follows the body as it turns and zooms.
 */
export class BodyHint {
  private readonly el: HTMLDivElement
  private readonly label: HTMLElement
  text: string | null = null
  private last = ''

  constructor(host: HTMLElement) {
    this.el = document.createElement('div')
    this.el.className = 'atlas-touch-hint'
    this.el.setAttribute('aria-hidden', 'true')
    this.el.innerHTML = '<span class="touch-hint-ring"></span><span class="touch-hint-dot"></span><span class="touch-hint-label"></span>'
    this.label = this.el.querySelector('.touch-hint-label') as HTMLElement
    host.append(this.el)
  }

  set(text: string | null) {
    this.text = text
    if (text) this.label.textContent = text
    if (!text) this.el.classList.remove('is-on')
  }

  /** Null hides it (off screen, or a part is selected). */
  update(at: { x: number; y: number } | null) {
    const on = !!this.text && !!at
    this.el.classList.toggle('is-on', on)
    if (!on) return
    const t = `translate3d(${Math.round(at!.x)}px, ${Math.round(at!.y)}px, 0)`
    if (t !== this.last) {
      this.el.style.transform = t
      this.last = t
    }
  }
}
