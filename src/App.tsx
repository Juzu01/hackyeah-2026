import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PartInfo } from './anatomy/content.ts'
import type { LayerName } from './anatomy/depth.ts'
import type { Body } from './anatomy/model.ts'
import { search } from './anatomy/search.ts'
import { mountAnatomyViewer, type AnatomyViewer, type ViewerState } from './anatomy/viewer.ts'
import BodySwitch from './atlas/BodySwitch.tsx'
import { isTouchDevice, memory, tick } from './atlas/device.ts'
import type { Act } from './atlas/chat/assistant.ts'
import Chat from './atlas/chat/Chat.tsx'
import { useConversation } from './atlas/chat/useConversation.ts'
import InfoSheet from './atlas/InfoSheet.tsx'
import { LAYERS } from './atlas/layers.tsx'
import LayerSwitch from './atlas/LayerSwitch.tsx'
import PartCard from './atlas/PartCard.tsx'
import { usePresence } from './atlas/presence.ts'
import SearchSheet from './atlas/SearchSheet.tsx'
import Sheet from './atlas/Sheet.tsx'
import TopBar from './atlas/TopBar.tsx'
import VoiceDock from './atlas/VoiceDock.tsx'
import './atlas/ui.css'
import WelcomeSheet from './atlas/WelcomeSheet.tsx'
import { clearDemoHistory, seedDemoHistory } from './lib/painReports.ts'
import { useMediaQuery } from './lib/useMediaQuery.ts'
import PainPanel from './pain/PainPanel.tsx'

// Set by the deploy workflow; undefined in local dev.
const commitSha: string | undefined = import.meta.env.VITE_COMMIT_SHA

// The ?demo action runs once per page load (StrictMode runs effects twice in dev).
let demoParamHandled = false

const params = new URLSearchParams(location.search)
/** Remembered on this device: the welcome was seen, a part was tapped once. */
const WELCOMED = 'atlas-welcomed'
const TAPPED = 'atlas-tapped'
/** The body last chosen here. */
const BODY = 'atlas-body'

/** ?body=f|m, then the last choice, then the sex given in "Gdzie boli?" on this device, then the man. */
function firstBody(): Body {
  const isBody = (v: unknown): v is Body => v === 'f' || v === 'm'
  const asked = params.get('body')
  if (isBody(asked)) return asked
  const saved = memory.get(BODY)
  if (isBody(saved)) return saved
  try {
    const sex: unknown = JSON.parse(memory.get('gdzieboli:profile:anon') ?? '{}').sex
    if (isBody(sex)) return sex
  } catch {
    // no profile
  }
  return 'm'
}

/** Test hooks for the app's own pieces (the viewer's are window.__atlas). */
interface AtlasUiHooks {
  search(query: string): { id: string; name: string; where: string; kind: string }[]
  openSearch(query?: string): void
  welcome(): boolean
  openWelcome(): void
}

declare global {
  interface Window {
    __atlasUi?: AtlasUiHooks
  }
}

function App() {
  const stage = useRef<HTMLDivElement>(null)
  const viewer = useRef<AnatomyViewer | null>(null)
  const [selected, setSelected] = useState<PartInfo | null>(null)
  const [view, setView] = useState<ViewerState>({ layer: 'muscles', back: false })
  const [body, setBody] = useState<Body>(firstBody)
  // The selection sheet shows the part's card, or the pain form in its place.
  const [mode, setMode] = useState<'card' | 'pain'>('card')
  const [expanded, setExpanded] = useState(false)
  const [info, setInfo] = useState(false)
  const [searching, setSearching] = useState<string | null>(null)
  const [welcome, setWelcome] = useState(() => memory.get(WELCOMED) !== '1' && !params.has('noonboard'))
  const [tapped, setTapped] = useState(() => memory.get(TAPPED) === '1' || params.has('nohint'))
  const [caption, setCaption] = useState<string | null>(null)
  // The conversation takes the sheet's place while it's open; the selection stays underneath.
  const [chat, setChat] = useState(false)
  // The part the conversation just asked the viewer to show, so its selection isn't taken for a tap.
  const chatFocus = useRef<string | null>(null)
  // Bumped when the history changes outside the panel, so an open panel reloads it.
  const [dataVersion, setDataVersion] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const wide = useMediaQuery('(min-width: 900px)')
  const [touch] = useState(isTouchDevice)

  const act = useCallback((a: Act) => {
    const v = viewer.current
    if (!v) return
    if (a.layer) v.setLayer(a.layer)
    if (a.flip) v.flip()
    if (a.focus) {
      chatFocus.current = a.focus
      v.focus(a.focus)
    }
  }, [])
  const talk = useConversation({ selectedId: selected?.id ?? null, act })
  // For the viewer's callbacks, which outlive a render.
  const chatOpen = useRef(chat)
  const talkRef = useRef(talk)
  useLayoutEffect(() => {
    chatOpen.current = chat
    talkRef.current = talk
  })

  const [part, closing] = usePresence(selected)
  const [chatShown, chatClosing] = usePresence(chat ? true : null)
  const [infoShown, infoClosing] = usePresence(info ? true : null)
  const [searchShown, searchClosing] = usePresence(searching)
  const [welcomeShown, welcomeClosing] = usePresence(welcome ? true : null)

  useEffect(() => {
    const handle = mountAnatomyViewer(stage.current!, {
      body,
      onSelect: (p) => {
        setSelected(p)
        setExpanded(false)
        if (!p) {
          setMode('card')
          return
        }
        tick()
        setTapped(true)
        memory.set(TAPPED, '1')
        if (p.id === chatFocus.current) {
          chatFocus.current = null
          return
        }
        // "Where does it hurt?" answered with a finger.
        if (chatOpen.current && talkRef.current.awaitingPart()) talkRef.current.send(p.name)
      },
      onChange: setView,
    })
    viewer.current = handle
    return () => handle.destroy()
    // A new body is a new model: the viewer mounts again.
  }, [body])

  // Until the first tap, a soft pulse on the body says where to start (not while the welcome is up).
  useEffect(() => {
    viewer.current?.setHint(!tapped && !welcome ? (touch ? 'Dotknij dowolnego miejsca' : 'Kliknij dowolne miejsce') : null)
  }, [tapped, welcome, touch, body])

  // The viewer keeps the selected part visible above (or beside) the sheet.
  const sheetRef = useCallback((el: HTMLElement | null) => viewer.current?.setOccluder(el), [])

  const deselect = () => viewer.current?.select(null)
  const closeChat = () => {
    talk.stopListening()
    setChat(false)
  }
  const pressVoice = () => {
    if (talk.listening) return talk.stopListening()
    setChat(true)
    if (talk.canListen) talk.listen()
  }
  const dismiss = () => {
    if (mode === 'pain') setMode('card')
    else if (expanded) setExpanded(false)
    else deselect()
  }
  const finishWelcome = () => {
    setWelcome(false)
    memory.set(WELCOMED, '1')
  }
  const pickBody = (next: Body) => {
    setSelected(null)
    setMode('card')
    setBody(next)
    memory.set(BODY, next)
  }
  const pickLayer = (layer: LayerName) => {
    viewer.current?.setLayer(layer)
    setCaption(LAYERS[layer].caption)
  }
  const pickResult = (id: string) => {
    setSearching(null)
    viewer.current?.focus(id)
  }

  useEffect(() => {
    if (!caption) return
    const timer = setTimeout(() => setCaption(null), 2200)
    return () => clearTimeout(timer)
  }, [caption])

  useEffect(() => {
    window.__atlasUi = {
      search: (q) => search(q),
      openSearch: (q = '') => setSearching(q),
      welcome: () => !!document.querySelector('.onboard'),
      openWelcome: () => setWelcome(true),
    }
    return () => {
      delete window.__atlasUi
    }
  }, [])

  // Presentations: ?demo fills this browser's history with ~30 days of example reports, ?demo=clear removes them.
  useEffect(() => {
    const demo = params.get('demo')
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
      <TopBar
        back={view.back}
        onSearch={() => setSearching('')}
        onFlip={() => viewer.current?.flip()}
        onInfo={() => setInfo(true)}
      />
      <VoiceDock
        listening={talk.listening}
        canListen={talk.canListen}
        hidden={chat || (!!selected && !wide)}
        onPress={pressVoice}
      />
      <LayerSwitch value={view.layer} onChange={pickLayer} hidden={(!!selected || chat) && !wide} />
      <BodySwitch value={body} onChange={pickBody} hidden={!!selected || chat} />
      {caption && !selected && !chat && (
        <p className="layer-caption" role="status">
          {caption}
        </p>
      )}

      {chatShown && (
        <Sheet
          ref={chatClosing ? undefined : sheetRef}
          label="Rozmowa"
          closing={chatClosing}
          onDismiss={closeChat}
          className="sheet-chat"
        >
          <Chat talk={talk} onFocus={(id) => act({ focus: id })} onClose={closeChat} />
        </Sheet>
      )}

      {part && !chatShown && (
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
              <PainPanel
                key={`${part.id}:${dataVersion}`}
                part={part}
                onBack={() => setMode('card')}
                onDone={deselect}
              />
            )}
          </div>
        </Sheet>
      )}

      {searchShown !== null && (
        <Sheet
          label="Szukaj części ciała"
          modal
          closing={searchClosing}
          onDismiss={() => setSearching(null)}
          className="sheet-search"
        >
          <SearchSheet initial={searchShown} onPick={pickResult} onClose={() => setSearching(null)} />
        </Sheet>
      )}

      {infoShown && (
        <Sheet label="Informacje" modal closing={infoClosing} onDismiss={() => setInfo(false)} className="sheet-info">
          <InfoSheet
            touch={touch}
            build={commitSha}
            onClose={() => setInfo(false)}
            onWelcome={() => {
              setInfo(false)
              setWelcome(true)
            }}
          />
        </Sheet>
      )}

      {welcomeShown && (
        <Sheet label="Witaj" modal closing={welcomeClosing} onDismiss={finishWelcome} className="sheet-onboard">
          <WelcomeSheet touch={touch} onDone={finishWelcome} />
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
