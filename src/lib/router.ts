import { useEffect, useState } from 'react'

// Hash-based routes, so the app works on GitHub Pages (no server rewrites) and
// the browser's back button moves between steps.
export type Path = '/' | '/wywiad' | '/wynik' | '/historia' | '/pomoc'

const read = (): Path => {
  const h = window.location.hash.replace(/^#/, '') || '/'
  return (['/', '/wywiad', '/wynik', '/historia', '/pomoc'] as Path[]).includes(h as Path) ? (h as Path) : '/'
}

export function navigate(path: Path) {
  if (read() === path) return
  window.location.hash = path === '/' ? '' : `#${path}`
}

export function useHashRoute(): Path {
  const [path, setPath] = useState<Path>(read)
  useEffect(() => {
    const onChange = () => {
      setPath(read())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return path
}
