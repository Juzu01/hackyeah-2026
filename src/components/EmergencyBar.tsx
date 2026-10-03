/** Always-visible red line (Ada, NHS 111 and WebMD all keep the emergency number one glance away). */
export default function EmergencyBar() {
  return (
    <div className="border border-alarm-line bg-alarm-soft px-4 py-2.5 text-base leading-snug text-ink print:hidden">
      <span className="font-semibold">Zagrożenie życia?</span>{' '}
      <span className="hidden sm:inline">Silny ból w klatce piersiowej, duszność, utrata przytomności, nagłe osłabienie połowy ciała – natychmiast zadzwoń pod </span>
      <span className="sm:hidden">Natychmiast zadzwoń pod </span>
      <a href="tel:112" className="font-bold text-alarm underline underline-offset-4">
        112
      </a>{' '}
      lub{' '}
      <a href="tel:999" className="font-bold text-alarm underline underline-offset-4">
        999
      </a>
      .
    </div>
  )
}
