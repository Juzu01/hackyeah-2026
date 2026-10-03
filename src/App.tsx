import { useEffect, useRef, useState } from 'react'
import type { BodyPart } from './body/anatomy.ts'
import { mountBodyMap, type BodyMapHandle } from './body/BodyMap.ts'
import './body/body.css'
import PainPanel from './pain/PainPanel.tsx'

// Set by the deploy workflow; undefined in local dev.
const commitSha: string | undefined = import.meta.env.VITE_COMMIT_SHA

function App() {
  const stage = useRef<HTMLDivElement>(null)
  const map = useRef<BodyMapHandle | null>(null)
  const [selected, setSelected] = useState<BodyPart | null>(null)

  useEffect(() => {
    const handle = mountBodyMap(stage.current!, { onSelect: setSelected })
    map.current = handle
    return () => handle.destroy()
  }, [])

  return (
    <>
      <div ref={stage} className="body-stage">
        {commitSha && (
          <span className="pointer-events-none absolute right-2 bottom-1 z-10 font-mono text-[10px] text-slate-500/60">
            {commitSha.slice(0, 7)}
          </span>
        )}
      </div>
      {selected && <PainPanel key={selected.id} part={selected} onClose={() => map.current?.select(null)} />}
    </>
  )
}

export default App
