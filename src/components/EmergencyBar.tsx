/**
 * Always-visible emergency line (Ada, NHS 111 and WebMD all keep the number one glance away).
 * One quiet line with a red edge, so it's there without shouting over the body map.
 */
export default function EmergencyBar() {
  return (
    <p className="sos print:hidden">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-alarm" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round">
        <path d="M4.5 3h5L11 8l-2.6 1.8a12 12 0 0 0 5.8 5.8L16 13l5 1.5v5L18.5 21A17.5 17.5 0 0 1 3 5.5z" />
      </svg>
      <span>
        <span className="font-semibold">Zagrożenie życia?</span>{' '}
        <span className="hidden sm:inline">Silny ból w klatce piersiowej, duszność, utrata przytomności, nagłe osłabienie połowy ciała – </span>
        Dzwoń{' '}
        <a href="tel:112">112</a> lub <a href="tel:999">999</a>
      </span>
    </p>
  )
}
