// Small facts about the device and the visitor, shared by the chrome.

/** A phone or tablet: a coarse pointer, or touch without a fine pointer. Phones always take this branch. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) return true
  return !matchMedia('(pointer: fine)').matches && navigator.maxTouchPoints > 0
}

/** localStorage that never throws (private mode, blocked storage). */
export const memory = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value)
    } catch {
      // Not remembered; fine.
    }
  },
}

/** A short tick when something is selected, where the phone supports it. */
export function tick() {
  try {
    navigator.vibrate?.(8)
  } catch {
    // Some browsers throw without a user gesture.
  }
}
