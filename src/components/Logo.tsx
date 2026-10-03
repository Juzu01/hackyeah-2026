// Doco's logo: the lemur from the logo art, hugging a heart, its ringed tail curled round it.
// The same drawing is the #lemur symbol in soleil-main/index.html; change both together.

/** The heart takes the text colour, so give it the app's accent (e.g. text-green). */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <ellipse cx="32" cy="50" rx="25" ry="8.5" fill="#1f3d24" stroke="#f7f3de" strokeWidth="9" />
      <ellipse cx="32" cy="50" rx="25" ry="8.5" fill="none" stroke="#3f7344" strokeWidth="9" strokeDasharray="5.59 5.59" />
      <path d="M19 49C18 40 24 35 32 35C40 35 46 40 45 49C44.5 53 39 55 32 55C25 55 19.5 53 19 49Z" fill="#6fa45f" />
      <ellipse cx="32" cy="47" rx="9" ry="7" fill="#f7f3de" />
      <path d="M57 50A25 8.5 0 0 1 7 50" fill="none" stroke="#f7f3de" strokeWidth="9" />
      <path d="M57 50A25 8.5 0 0 1 7 50" fill="none" stroke="#3f7344" strokeWidth="9" strokeDasharray="5.59 5.59" />
      <path d="M34 53C27.3 49.4 24.1 45.4 24.4 41.8C24.7 37.9 30.1 36.4 33.6 40.4C36.6 36 42 36.3 43 40C43.8 43.4 41.3 47.8 34 53Z" fill="currentColor" />
      <ellipse cx="41.8" cy="47" rx="2.6" ry="2.3" fill="#2f5233" />
      <g transform="rotate(7 32 32)">
        <path d="M10.9 17.1C7.6 11.2 7.6 2.6 10.2 0.7C14.5 1.2 19.5 7.6 19.8 14.7C17.6 16.9 13.3 18.6 10.9 17.1Z" fill="#6fa45f" />
        <path d="M12.6 14.9C10.2 10.7 10.2 4.8 12.2 3.6C15.2 4.3 18.6 8.8 18.6 13.7C16.9 15.1 14.2 15.9 12.6 14.9Z" fill="#f7f3de" />
        <path d="M14 13.3C12.6 10.6 12.7 7.4 13.6 6.7C15.2 7.5 16.8 10.4 16.4 13.1Z" fill="#2f5233" />
        <path d="M53.1 17.1C56.4 11.2 56.4 2.6 53.8 0.7C49.5 1.2 44.5 7.6 44.2 14.7C46.4 16.9 50.7 18.6 53.1 17.1Z" fill="#6fa45f" />
        <path d="M51.4 14.9C53.8 10.7 53.8 4.8 51.8 3.6C48.8 4.3 45.4 8.8 45.4 13.7C47.1 15.1 49.8 15.9 51.4 14.9Z" fill="#f7f3de" />
        <path d="M50 13.3C51.4 10.6 51.3 7.4 50.4 6.7C48.8 7.5 47.2 10.4 47.6 13.1Z" fill="#2f5233" />
        <ellipse cx="32" cy="25" rx="17.5" ry="14.5" fill="#6fa45f" />
        <path d="M17.6 30.6C16.6 25.2 21.4 21.4 27.2 21.9C29.5 22.1 30.9 20.4 32 18.2C33.1 20.4 34.5 22.1 36.8 21.9C42.6 21.4 47.4 25.2 46.4 30.6C45.4 36.4 39.6 38.9 32 38.9C24.4 38.9 18.6 36.4 17.6 30.6Z" fill="#f7f3de" />
        <path d="M21.8 28.4Q24.8 24.9 27.8 28.4M36.2 28.4Q39.2 24.9 42.2 28.4" fill="none" stroke="#14211b" strokeWidth="2.7" strokeLinecap="round" />
        <path d="M29.5 31.2Q32 30.2 34.5 31.2Q33.7 33.7 32 34.1Q30.3 33.7 29.5 31.2Z" fill="#14211b" />
      </g>
    </svg>
  )
}
