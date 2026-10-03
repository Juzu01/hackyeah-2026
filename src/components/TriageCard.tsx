import type { Triage } from '../data/types.ts'
import { TRIAGE_INFO } from '../lib/engine.ts'

interface Props {
  triage: Triage
  reasons: string[]
}

// Each level keeps its meaning (red, amber, blue-grey, green) re-tuned for black: the colour carries the
// border, a faint tint of the header and the title; body text stays ink.
const STYLE: Record<Triage, { head: string; body: string; title: string }> = {
  'self-care': { head: 'bg-care-self/10', body: 'border-care-self/45', title: 'text-care-self' },
  gp: { head: 'bg-care-gp/10', body: 'border-care-gp/45', title: 'text-care-gp' },
  urgent: { head: 'bg-care-urgent/10', body: 'border-care-urgent/45', title: 'text-care-urgent' },
  emergency: { head: 'bg-care-emergency/10', body: 'border-care-emergency/45', title: 'text-care-emergency' },
}

const Tel = ({ number, label, alarm }: { number: string; label: string; alarm?: boolean }) => (
  <a href={`tel:${number.replace(/\s/g, '')}`} className={alarm ? 'btn-primary is-alarm' : 'btn-secondary'}>
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
    <section aria-labelledby="triage-title" className={`cut overflow-hidden border bg-s1 ${style.body}`}>
      <div className={`border-b border-line px-5 py-4 ${style.head}`}>
        <p className="eyebrow">Zalecenie</p>
        <h2 id="triage-title" className={`mt-1 font-serif text-[1.75rem] leading-tight font-medium sm:text-[2rem] ${style.title}`}>
          {info.short}
        </h2>
      </div>
      <div className="space-y-4 px-5 py-4 text-ink">
        <p className="text-base leading-relaxed">{info.description}</p>
        {reasons.length > 0 && (
          <div>
            <p className="text-base font-semibold">Dlaczego:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-base text-ink-2">
              {reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {triage === 'emergency' && (
          <div className="space-y-2">
            <div className="grid gap-2 sm:flex sm:flex-wrap print:hidden">
              <Tel alarm number="112" label="Zadzwoń: 112" />
              <Tel alarm number="999" label="Pogotowie: 999" />
            </div>
            <p className="text-base text-ink-2">Jeśli możesz, poproś kogoś o pomoc i nie jedź samodzielnie. Najbliższy szpitalny oddział ratunkowy (SOR) przyjmuje całą dobę.</p>
          </div>
        )}
        {triage === 'urgent' && (
          <div className="space-y-2">
            <p className="text-base text-ink-2">Lekarz rodzinny jeszcze dziś, a poza godzinami pracy przychodni nocna i świąteczna opieka zdrowotna albo SOR.</p>
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Tel number="800 137 200" label="Teleplatforma NFZ: 800 137 200" />
            </div>
            <p className="text-sm text-ink-2">Bezpłatna Teleplatforma Pierwszego Kontaktu (TPK): pon.–pt. 18:00–8:00, w weekendy i święta całą dobę.</p>
          </div>
        )}
        {triage === 'gp' && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 print:hidden">
            <a href="https://www.znanylekarz.pl/" target="_blank" rel="noreferrer" className="btn-primary">
              Umów wizytę
            </a>
            <span className="self-center text-base text-ink-2">lub teleporada w Twojej przychodni (POZ)</span>
          </div>
        )}
        {triage === 'self-care' && <p className="text-base text-ink-2">Zapisz wynik, żeby porównać objawy za kilka dni. Jeśli pojawi się coś niepokojącego, sprawdź ponownie albo skontaktuj się z lekarzem.</p>}
      </div>
    </section>
  )
}
