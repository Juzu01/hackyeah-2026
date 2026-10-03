import { useCallback, useEffect, useState } from 'react'
import Footer from './components/Footer.tsx'
import Header from './components/Header.tsx'
import { useAccount } from './lib/account.ts'
import { emptyDraft, loadDraft, saveDraft, type CheckDraft } from './lib/check.ts'
import type { SavedCheck } from './lib/history.ts'
import { navigate, useHashRoute } from './lib/router.ts'
import HelpScreen from './screens/HelpScreen.tsx'
import HistoryScreen from './screens/HistoryScreen.tsx'
import InterviewScreen from './screens/InterviewScreen.tsx'
import ResultsScreen from './screens/ResultsScreen.tsx'
import StartScreen from './screens/StartScreen.tsx'

function App() {
  const path = useHashRoute()
  const account = useAccount()
  const [draft, setDraft] = useState<CheckDraft>(loadDraft)
  const [openedAt, setOpenedAt] = useState<string | undefined>()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => saveDraft(draft), [draft])
  useEffect(() => {
    if ((path === '/wywiad' || path === '/wynik') && draft.picks.length === 0) navigate('/')
  }, [path, draft.picks.length])
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3500)
    return () => window.clearTimeout(t)
  }, [toast])

  const update = useCallback((patch: Partial<CheckDraft>) => setDraft((d) => ({ ...d, ...patch })), [])
  const togglePick = useCallback((symptomId: string, regionId?: string) => {
    setDraft((d) => {
      const has = d.picks.some((p) => p.symptomId === symptomId)
      return { ...d, picks: has ? d.picks.filter((p) => p.symptomId !== symptomId) : [...d.picks, { symptomId, regionId }] }
    })
  }, [])
  const restart = () => {
    setDraft(emptyDraft())
    setOpenedAt(undefined)
    navigate('/')
  }
  const openSaved = (item: SavedCheck) => {
    setDraft(item.draft)
    setOpenedAt(item.createdAt)
    navigate('/wynik')
  }

  let screen
  switch (path) {
    case '/wywiad':
      screen = <InterviewScreen draft={draft} update={update} onBack={() => navigate('/')} onDone={() => navigate('/wynik')} />
      break
    case '/wynik':
      screen = <ResultsScreen key={openedAt ?? 'current'} draft={draft} savedAt={openedAt} onRestart={restart} onToast={setToast} />
      break
    case '/historia':
      screen = <HistoryScreen key={account.user?.id ?? 'anon'} onOpen={openSaved} />
      break
    case '/pomoc':
      screen = <HelpScreen />
      break
    default:
      screen = (
        <StartScreen
          draft={draft}
          update={update}
          togglePick={togglePick}
          userId={account.user?.id}
          onNext={() => {
            setOpenedAt(undefined)
            update({ answers: {} })
            navigate('/wywiad')
          }}
        />
      )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <Header path={path} />
      <main className="flex-1">{screen}</main>
      <Footer />
      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
