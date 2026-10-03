import { useEffect, useRef, useState } from 'react'
import type { BodyPart } from './body/anatomy.ts'
import { mountBodyMap, type BodyMapHandle } from './body/BodyMap.ts'
import './body/body.css'
import { clearDemoHistory, seedDemoHistory } from './lib/painReports.ts'
import PainPanel from './pain/PainPanel.tsx'

// Set by the deploy workflow; undefined in local dev.
const commitSha: string | undefined = import.meta.env.VITE_COMMIT_SHA

// The ?demo action runs once per page load (StrictMode runs effects twice in dev).
let demoParamHandled = false

function App() {
  const stage = useRef<HTMLDivElement>(null)
  const map = useRef<BodyMapHandle | null>(null)
  const [selected, setSelected] = useState<BodyPart | null>(null)
  // Bumped when the history changes outside the panel, so an open panel reloads it.
  const [dataVersion, setDataVersion] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const handle = mountBodyMap(stage.current!, { onSelect: setSelected })
    map.current = handle
    return () => handle.destroy()
  }, [])

  // Presentations: ?demo fills this browser's history with ~30 days of example reports, ?demo=clear removes them.
  useEffect(() => {
    const demo = new URLSearchParams(location.search).get('demo')
    if (demo === null || demoParamHandled) return
    demoParamHandled = true
    const run = demo === 'clear'
      ? clearDemoHistory().then((n) => `Usunięto dane demo (${n} zgłoszeń).`)
      : seedDemoHistory().then((n) => `Wczytano dane demo: ${n} zgłoszeń z ostatnich 30 dni.`)
    run
      .then((text) => {
        setNotice(text)
        setDataVersion((v) => v + 1)
      })
      .catch((err: unknown) => setNotice(`Dane demo: ${err instanceof Error ? err.message : 'błąd'}`))
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  return (
    <>
      <div ref={stage} className="body-stage">
        {commitSha && (
          <span className="pointer-events-none absolute right-2 bottom-1 z-10 font-mono text-[10px] text-slate-500/60">
            {commitSha.slice(0, 7)}
          </span>
        )}
      </div>
      {notice && (
        <p
          role="status"
          className="fixed inset-x-4 top-4 z-30 mx-auto max-w-sm rounded-xl border border-cyan-200/30 bg-[#0a1020]/90 px-4 py-2 text-center text-sm text-slate-100 backdrop-blur-md"
        >
          {notice}
        </p>
      )}
      {selected && (
        <PainPanel key={`${selected.id}:${dataVersion}`} part={selected} onClose={() => map.current?.select(null)} />
      )}
    </>
  )
}

export default App
