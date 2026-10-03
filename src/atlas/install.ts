// Installing the atlas as an app. Chrome and Android offer a prompt we can show
// from our own button (beforeinstallprompt, which can fire before React mounts,
// so it's captured at import); iOS Safari has no prompt, only "Share → Add to
// Home Screen", so there we explain that instead.

import { useSyncExternalStore } from 'react'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = 'installed' | 'prompt' | 'ios' | 'unavailable'

let deferred: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

// iPadOS reports itself as a Mac; touch points give it away.
const ios = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installed = true
    emit()
  })
}

function current(): InstallState {
  if (installed || standalone()) return 'installed'
  if (deferred) return 'prompt'
  return ios() ? 'ios' : 'unavailable'
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    current,
  )
}

/** Shows the browser's install prompt; false if it isn't available or was dismissed. */
export async function install(): Promise<boolean> {
  const e = deferred
  if (!e) return false
  await e.prompt()
  const { outcome } = await e.userChoice
  // A prompt can only be used once.
  deferred = null
  emit()
  return outcome === 'accepted'
}
