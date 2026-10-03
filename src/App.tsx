import { useEffect, useRef } from 'react'
import { mountBodyMap } from './body/BodyMap.ts'
import './body/body.css'

// Set by the deploy workflow; undefined in local dev.
const commitSha: string | undefined = import.meta.env.VITE_COMMIT_SHA

function App() {
  const stage = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const map = mountBodyMap(stage.current!)
    return () => map.destroy()
  }, [])

  return (
    <div ref={stage} className="body-stage">
      {commitSha && (
        <span className="pointer-events-none absolute right-2 bottom-1 z-10 font-mono text-[10px] text-slate-500/60">
          {commitSha.slice(0, 7)}
        </span>
      )}
    </div>
  )
}

export default App
