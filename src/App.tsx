import { useCallback, useEffect, useRef, useState } from 'react'
import type { PartInfo } from './anatomy/content.ts'
import type { LayerName } from './anatomy/depth.ts'
import { mountAnatomyViewer, type AnatomyViewer, type ViewerState } from './anatomy/viewer.ts'
import InfoSheet from './atlas/InfoSheet.tsx'
import LayerSwitch from './atlas/LayerSwitch.tsx'
import PartCard from './atlas/PartCard.tsx'
import { usePresence } from './atlas/presence.ts'
import Sheet from './atlas/Sheet.tsx'
import TopBar from './atlas/TopBar.tsx'
import './atlas/ui.css'
import { clearDemoHistory, seedDemoHistory } from './lib/painReports.ts'
import { useMediaQuery } from './lib/useMediaQuery.ts'
import PainPanel from './pain/PainPanel.tsx'

// Set by the deploy workflow; undefined in local dev.
const commitSha: string | undefined = import.meta.env.VITE_COMMIT_SHA

// The ?demo action runs once per page load (StrictMode runs effects twice in dev).
let demoParamHandled = false

function App() {
  const stage = useRef<HTMLDivElement>(null)
  const viewer = useRef<AnatomyViewer | null>(null)
  const [selected, setSelected] = useState<PartInfo | null>(null)
  const [view, setView] = useState<ViewerState>({ layer: 'muscles', back: false })
  // The selection sheet shows the part's card, or the pain form in its place.
  const [mode, setMode] = useState<'card' | 'pain'>('card')
  const [expanded, setExpanded] = useState(false)
  const [info, setInfo] = useState(false)
  // Bumped when the history changes outside the panel, so an open panel reloads it.
  const [dataVersion, setDataVersion] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const wide = useMediaQuery('(min-width: 900px)')
  // Same test as the viewer's hint: a coarse pointer, or no fine one on a touch screen.
  const coarse = useMediaQuery('(pointer: coarse)')
  const fine = useMediaQuery('(pointer: fine)')
  const touch = coarse || (!fine && navigator.maxTouchPoints > 0)

  const [part, closing] = usePresence(selected)
  const [infoShown, infoClosing] = usePresence(info ? true : null)

  useEffect(() => {
    const handle = mountAnatomyViewer(stage.current!, {
      onSelect: (p) => {
        setSelected(p)
        setExpanded(false)
        if (!p) setMode('card')
      },
      onChange: setView,
    })
    viewer.current = handle
    return () => handle.destroy()
  }, [])

  // The viewer keeps the selected part visible above (or beside) the sheet.
  const sheetRef = useCallback((el: HTMLElement | null) => viewer.current?.setOccluder(el), [])

  const deselect = () => viewer.current?.select(null)
  const dismiss = () => {
    if (mode === 'pain') setMode('card')
    else if (expanded) setExpanded(false)
    else deselect()
  }

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
      <TopBar back={view.back} onFlip={() => viewer.current?.flip()} onInfo={() => setInfo(true)} />
      <LayerSwitch
        value={view.layer}
        onChange={(layer: LayerName) => viewer.current?.setLayer(layer)}
        hidden={!!selected && !wide}
      />

      {part && (
        <Sheet
          ref={closing ? undefined : sheetRef}
          label={mode === 'pain' ? `Zgłoś ból: ${part.name}` : part.name}
          closing={closing}
          onDismiss={dismiss}
          onExpand={() => mode === 'card' && setExpanded(true)}
        >
          <div key={mode} className="sheet-swap">
            {mode === 'card' ? (
              <PartCard
                part={part}
                expanded={expanded}
                onToggle={() => setExpanded((e) => !e)}
                onReport={() => setMode('pain')}
                onClose={deselect}
              />
            ) : (
              <PainPanel key={`${part.id}:${dataVersion}`} part={part} onBack={() => setMode('card')} />
            )}
          </div>
        </Sheet>
      )}

      {infoShown && (
        <Sheet label="Informacje" modal closing={infoClosing} onDismiss={() => setInfo(false)} className="sheet-info">
          <InfoSheet touch={touch} build={commitSha} onClose={() => setInfo(false)} />
        </Sheet>
      )}

      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
    </>
  )
}

export default App
