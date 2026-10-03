import { useCallback, useEffect, useRef, useState } from 'react'
import type { PartInfo } from './anatomy/content.ts'
import { mountAnatomyViewer, type AnatomyViewer } from './anatomy/viewer.ts'
import { clearDemoHistory, seedDemoHistory } from './lib/painReports.ts'
import PainPanel from './pain/PainPanel.tsx'

// Set by the deploy workflow; undefined in local dev.
const commitSha: string | undefined = import.meta.env.VITE_COMMIT_SHA

// The ?demo action runs once per page load (StrictMode runs effects twice in dev).
let demoParamHandled = false

function App() {
  const stage = useRef<HTMLDivElement>(null)
  const viewer = useRef<AnatomyViewer | null>(null)
  const [selected, setSelected] = useState<PartInfo | null>(null)
  // The pain sheet opens from the callout's "Zgłoś ból" and follows the selection while open.
  const [reporting, setReporting] = useState(false)
  // Bumped when the history changes outside the panel, so an open panel reloads it.
  const [dataVersion, setDataVersion] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const handle = mountAnatomyViewer(stage.current!, {
      onSelect: (part) => {
        setSelected(part)
        if (!part) setReporting(false)
      },
      action: { label: 'Zgłoś ból', run: () => setReporting(true) },
      build: commitSha,
    })
    viewer.current = handle
    return () => handle.destroy()
  }, [])

  // The viewer keeps the selected part visible above the sheet.
  const sheetRef = useCallback((el: HTMLElement | null) => viewer.current?.setOccluder(el), [])

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
      <div ref={stage} />
      {notice && (
        <p
          role="status"
          className="fixed inset-x-4 top-16 z-30 mx-auto max-w-sm rounded-[3px] border border-(--hair) bg-(--panel) px-4 py-2.5 text-center text-[13px] text-(--ink-1) backdrop-blur-md"
        >
          {notice}
        </p>
      )}
      {selected && reporting && (
        <PainPanel
          key={`${selected.id}:${dataVersion}`}
          ref={sheetRef}
          part={selected}
          onClose={() => setReporting(false)}
        />
      )}
    </>
  )
}

export default App
