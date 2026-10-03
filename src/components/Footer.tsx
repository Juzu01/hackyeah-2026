// Set by the deploy workflow; undefined in local dev.
const commitSha: string | undefined = import.meta.env.VITE_COMMIT_SHA
const repoUrl: string | undefined = import.meta.env.VITE_REPO_URL

export const DISCLAIMER = 'To narzędzie ma charakter wyłącznie informacyjny i nie stanowi porady medycznej, konsultacji ani diagnozy. Nie zastępuje wizyty u lekarza.'

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 print:hidden">
      <div className="mx-auto max-w-6xl space-y-2">
        <p>{DISCLAIMER}</p>
        <p>
          W nagłym zagrożeniu życia zadzwoń pod <a className="font-semibold text-slate-700" href="tel:112">112</a> lub <a className="font-semibold text-slate-700" href="tel:999">999</a>.
          Poza godzinami pracy przychodni: Teleplatforma Pierwszego Kontaktu <a className="font-semibold text-slate-700" href="tel:800137200">800 137 200</a>.
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <a href="#/pomoc" className="hover:text-slate-800">Jak to działa i prywatność</a>
          <span>Prototyp HackYeah 2026 · Sport &amp; Healthcare</span>
          <span>
            {commitSha && repoUrl ? (
              <>
                wersja{' '}
                <a className="font-mono underline hover:text-slate-800" href={`${repoUrl}/commit/${commitSha}`}>
                  {commitSha.slice(0, 7)}
                </a>
              </>
            ) : (
              'wersja lokalna (dev)'
            )}
          </span>
        </p>
      </div>
    </footer>
  )
}
