/** Always-visible red line (Ada, NHS 111 and WebMD all keep the emergency number one glance away). */
export default function EmergencyBar() {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900 print:hidden">
      <span className="font-semibold">Zagrożenie życia?</span>{' '}
      <span className="hidden sm:inline">Silny ból w klatce piersiowej, duszność, utrata przytomności, nagłe osłabienie połowy ciała – natychmiast zadzwoń pod </span>
      <span className="sm:hidden">Natychmiast zadzwoń pod </span>
      <a href="tel:112" className="font-bold underline">
        112
      </a>{' '}
      lub{' '}
      <a href="tel:999" className="font-bold underline">
        999
      </a>
      .
    </div>
  )
}
