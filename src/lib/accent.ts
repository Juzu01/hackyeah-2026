// The mode and accent colour picked in Doco (Więcej → Kolor aplikacji, doco/app.js). This page
// shares Doco's localStorage, so it wears the same colour from the first paint and follows a change
// live: the storage event reaches the frame while the colour is being picked in Doco.
// "Gdzie boli?" follows the light mode too (followDocoTheme); the atlas stays dark, its 3D scene is
// lit for black, and takes the colour's dark-mode shade.

const ACCENT_KEY = 'doco_accent'
const THEME_KEY = 'doco_theme'
const HEX = /^#[0-9a-f]{6}$/i

export interface Accent {
  accent: string
  ink: string
}

const listeners = new Set<(a: Accent | null) => void>()
const systemLight = matchMedia('(prefers-color-scheme: light)')
let followTheme = false

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function isLight(): boolean {
  if (!followTheme) return false
  const theme = read(THEME_KEY)
  return theme === 'light' || (theme === 'system' && systemLight.matches)
}

function readAccent(light: boolean): Accent | null {
  try {
    const a = JSON.parse(read(ACCENT_KEY) ?? 'null')
    const v = a && (light ? a.light : a)
    return v && HEX.test(v.accent) && HEX.test(v.ink) ? { accent: v.accent, ink: v.ink } : null
  } catch {
    return null
  }
}

function apply() {
  const light = isLight()
  const root = document.documentElement
  if (light) root.dataset.theme = 'light'
  else delete root.dataset.theme
  const a = readAccent(light)
  // "Gdzie boli?" calls the accent --green, the atlas --accent. Unset, each keeps its stylesheet's default.
  const vars: [string, string | undefined][] = [
    ['--green', a?.accent],
    ['--accent', a?.accent],
    ['--green-ink', a?.ink],
    ['--accent-ink', a?.ink],
  ]
  for (const [name, value] of vars) {
    if (value) root.style.setProperty(name, value)
    else root.style.removeProperty(name)
  }
  for (const cb of listeners) cb(a)
}

/** Calls back now and on every change (null: the default colour). Returns the unsubscribe. */
export function onAccent(cb: (a: Accent | null) => void): () => void {
  listeners.add(cb)
  cb(readAccent(isLight()))
  return () => listeners.delete(cb)
}

/** This page also takes Doco's light mode (data-theme="light" on <html>). */
export function followDocoTheme(): void {
  followTheme = true
  apply()
}

apply()
window.addEventListener('storage', (e) => {
  if (e.key === ACCENT_KEY || e.key === THEME_KEY || e.key === null) apply()
})
systemLight.addEventListener('change', () => {
  if (followTheme) apply()
})
