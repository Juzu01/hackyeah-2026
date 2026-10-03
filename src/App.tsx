// Set by the deploy workflow; undefined in local dev.
const commitSha: string | undefined = import.meta.env.VITE_COMMIT_SHA
const repoUrl: string | undefined = import.meta.env.VITE_REPO_URL

const codeClass = 'rounded bg-slate-200 px-1.5 py-0.5 text-base dark:bg-slate-800'

function App() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
        <p className="text-sm font-semibold tracking-wide text-emerald-600 uppercase dark:text-emerald-400">
          HackYeah 2026 · Sport &amp; Healthcare
        </p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Prototyp w budowie
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Ta strona aktualizuje się automatycznie po każdym pushu na{' '}
          <code className={codeClass}>main</code>. Podmień zawartość{' '}
          <code className={codeClass}>src/App.tsx</code> na właściwy prototyp.
        </p>
      </main>

      <footer className="px-4 py-6 text-center text-sm text-slate-500">
        {commitSha ? (
          <>
            wersja{' '}
            <a
              className="font-mono underline hover:text-slate-900 dark:hover:text-slate-100"
              href={`${repoUrl}/commit/${commitSha}`}
            >
              {commitSha.slice(0, 7)}
            </a>
          </>
        ) : (
          'wersja lokalna (dev)'
        )}
      </footer>
    </div>
  )
}

export default App
