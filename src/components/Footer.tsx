// Set by the deploy workflow; undefined in local dev.
const commitSha: string | undefined = import.meta.env.VITE_COMMIT_SHA
const repoUrl: string | undefined = import.meta.env.VITE_REPO_URL

export const DISCLAIMER = 'To narzędzie ma charakter wyłącznie informacyjny i nie stanowi porady medycznej, konsultacji ani diagnozy. Nie zastępuje wizyty u lekarza.'

export default function Footer() {
  return (
    <footer className="mt-10 border-t border-line bg-page px-4 py-6 text-[0.9375rem] leading-relaxed text-ink-2 print:hidden">
      <div className="mx-auto max-w-6xl space-y-3">
        <p>{DISCLAIMER}</p>
        <p>
          W nagłym zagrożeniu życia zadzwoń pod <a className="font-semibold text-ink" href="tel:112">112</a> lub <a className="font-semibold text-ink" href="tel:999">999</a>.
          Poza godzinami pracy przychodni: Teleplatforma Pierwszego Kontaktu <a className="font-semibold text-ink" href="tel:800137200">800 137 200</a>.
        </p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a href="#/pomoc" className="text-ink underline decoration-line-2 underline-offset-4 hover:decoration-green">Jak to działa i prywatność</a>
          <span>Prototyp HackYeah 2026 · Sport &amp; Healthcare</span>
          <span>
            {commitSha && repoUrl ? (
              <>
                wersja{' '}
                <a className="font-mono underline decoration-line-2 underline-offset-4 hover:text-ink" href={`${repoUrl}/commit/${commitSha}`}>
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
