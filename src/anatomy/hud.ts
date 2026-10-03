// The viewer's own overlays besides the selection marker: the first-run hint,
// the loading state (with the model's credit) and the no-WebGL message. The
// app's chrome (title bar, layer switch, sheets) lives in src/atlas/.

const HINT_TOUCH = 'Dotknij mięśnia lub narządu, aby go poznać'
const HINT_MOUSE = 'Kliknij mięsień lub narząd, aby go poznać'

// A fingertip with a small burst: tap.
const ICON_TAP = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="11" r="2.4"/><path d="M12 3.8v1.8M19 11h-1.8M5 11h1.8M17 6l-1.2 1.2M7 6l1.2 1.2"/><path d="M12 15v5" opacity="0.6"/></g></svg>`

export const CREDIT = 'Model: BodyParts3D © DBCLS · CC BY-SA 2.1 JP'

export interface HudOptions {
  touch: boolean
  hint: boolean
}

export class Hud {
  private readonly host: HTMLElement
  private readonly hint: HTMLElement | null = null
  private readonly loading: HTMLDivElement
  private readonly loadingBar: HTMLElement
  private readonly loadingText: HTMLElement
  private hintTimer = 0

  constructor(host: HTMLElement, options: HudOptions) {
    this.host = host
    if (options.hint) {
      this.hint = document.createElement('div')
      this.hint.className = 'atlas-hint'
      this.hint.setAttribute('aria-hidden', 'true')
      this.hint.innerHTML = `${ICON_TAP}<span>${options.touch ? HINT_TOUCH : HINT_MOUSE}</span>`
      host.append(this.hint)
    }

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

  /** Cross-fades the loading state out; starts the hint's clock. */
  ready() {
    this.loading.classList.add('is-done')
    if (this.hint) {
      this.hint.classList.add('is-on')
      this.hintTimer = window.setTimeout(() => this.dismissHint(), 7000)
    }
  }

  dismissHint() {
    if (!this.hint) return
    window.clearTimeout(this.hintTimer)
    this.hint.classList.remove('is-on')
  }

  /** Replaces the loading state with a calm explanation. */
  noWebGL() {
    this.loading.remove()
    this.hint?.remove()
    const box = document.createElement('div')
    box.className = 'atlas-fallback'
    box.setAttribute('role', 'alert')
    box.innerHTML =
      '<h1>Atlas ciała</h1><p>Ta przeglądarka nie obsługuje WebGL, więc nie może wyświetlić modelu 3D.</p><p class="atlas-fallback-hint">Włącz akcelerację sprzętową w ustawieniach albo otwórz stronę w innej przeglądarce.</p>'
    this.host.append(box)
  }

  destroy() {
    window.clearTimeout(this.hintTimer)
  }
}
