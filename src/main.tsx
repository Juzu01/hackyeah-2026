import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// Imported early: the install prompt can fire before the app renders.
import './atlas/install.ts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Offline and installable (public/sw.js). Production only: in dev it would cache Vite's modules.
// The version names the cache, so each deploy starts a fresh one.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const version = import.meta.env.VITE_COMMIT_SHA?.slice(0, 12) ?? 'local'
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${version}`, { scope: './' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // What this page loaded before the worker took over, for it to cache: so far, and the
        // rest (the model, on a slow connection) as it finishes.
        const warm = (entries: PerformanceEntry[]) => reg.active?.postMessage({ warm: entries.map((e) => e.name) })
        warm(performance.getEntriesByType('resource'))
        new PerformanceObserver((list) => warm(list.getEntries())).observe({ type: 'resource' })
      })
      .catch((err: unknown) => console.warn('Atlas: service worker not registered', err))
  })
}
