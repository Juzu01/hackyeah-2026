import type { Triage } from '../data/types.ts'
import { TRIAGE_INFO } from '../lib/engine.ts'

interface Props {
  triage: Triage
  reasons: string[]
}

const STYLE: Record<Triage, { head: string; body: string }> = {
  'self-care': { head: 'bg-green-700', body: 'border-green-700 bg-green-50' },
  gp: { head: 'bg-blue-700', body: 'border-blue-700 bg-blue-50' },
  urgent: { head: 'bg-amber-600', body: 'border-amber-600 bg-amber-50' },
  emergency: { head: 'bg-red-700', body: 'border-red-700 bg-red-50' },
}

const Tel = ({ number, label }: { number: string; label: string }) => (
  <a
    href={`tel:${number.replace(/\s/g, '')}`}
    className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-base font-semibold text-white shadow hover:bg-slate-800"
  >
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1L6.6 10.8z" />
    </svg>
    {label}
  </a>
)

/**
 * The recommendation comes first on the results page (Symptomate's triage card,
 * NHS 111's care cards): a coloured, heading-led card with the one action to take.
 */
export default function TriageCard({ triage, reasons }: Props) {
  const info = TRIAGE_INFO[triage]
  const style = STYLE[triage]
  return (
    <section aria-labelledby="triage-title" className={`overflow-hidden rounded-2xl border-2 shadow-sm ${style.body}`}>
      <div className={`px-5 py-3 text-white ${style.head}`}>
        <p className="text-xs font-semibold tracking-wide uppercase opacity-90">Zalecenie</p>
        <h2 id="triage-title" className="text-xl font-bold sm:text-2xl">
          {info.short}
        </h2>
      </div>
      <div className="space-y-4 px-5 py-4 text-slate-800">
        <p className="text-[15px] leading-relaxed">{info.description}</p>
        {reasons.length > 0 && (
          <div>
            <p className="text-sm font-semibold">Dlaczego:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {triage === 'emergency' && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 print:hidden">
              <Tel number="112" label="Zadzwoń: 112" />
              <Tel number="999" label="Pogotowie: 999" />
            </div>
            <p className="text-sm">Jeśli możesz, poproś kogoś o pomoc i nie jedź samodzielnie. Najbliższy szpitalny oddział ratunkowy (SOR) przyjmuje całą dobę.</p>
          </div>
        )}
        {triage === 'urgent' && (
          <div className="space-y-2">
            <p className="text-sm">Lekarz rodzinny jeszcze dziś, a poza godzinami pracy przychodni nocna i świąteczna opieka zdrowotna albo SOR.</p>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Tel number="800 137 200" label="Teleplatforma NFZ: 800 137 200" />
            </div>
            <p className="text-xs text-slate-600">Bezpłatna Teleplatforma Pierwszego Kontaktu (TPK): pon.–pt. 18:00–8:00, w weekendy i święta całą dobę.</p>
          </div>
        )}
        {triage === 'gp' && (
          <div className="flex flex-wrap gap-2 print:hidden">
            <a
              href="https://www.znanylekarz.pl/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-xl bg-blue-700 px-4 py-2.5 text-base font-semibold text-white shadow hover:bg-blue-800"
            >
              Umów wizytę
            </a>
            <span className="self-center text-sm text-slate-600">lub teleporada w Twojej przychodni (POZ)</span>
          </div>
        )}
        {triage === 'self-care' && <p className="text-sm">Zapisz wynik, żeby porównać objawy za kilka dni. Jeśli pojawi się coś niepokojącego, sprawdź ponownie albo skontaktuj się z lekarzem.</p>}
      </div>
    </section>
  )
}
