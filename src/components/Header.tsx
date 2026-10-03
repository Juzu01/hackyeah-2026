import { useAccount } from '../lib/account.ts'
import type { Path } from '../lib/router.ts'

interface Props {
  path: Path
}

export function Logo({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-teal-700" />
      <path d="M16 6.5c-3.6 0-6.5 2.9-6.5 6.5 0 4.9 6.5 12.5 6.5 12.5s6.5-7.6 6.5-12.5c0-3.6-2.9-6.5-6.5-6.5z" className="fill-white" />
      <circle cx="16" cy="13" r="2.6" className="fill-teal-700" />
    </svg>
  )
}

/** Logo left, "Historia" and the optional account on the right: login never gates the checker. */
export default function Header({ path }: Props) {
  const account = useAccount()
  const link = (to: Path, label: string) => (
    <a href={to === '/' ? '#' : `#${to}`} className={`rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-slate-100 ${path === to ? 'text-teal-800' : 'text-slate-600'}`}>
      {label}
    </a>
  )
  const initials = account.user?.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
        <a href="#" className="flex items-center gap-2">
          <Logo />
          <span className="text-lg font-bold tracking-tight text-slate-900">Gdzie boli?</span>
          <span className="hidden text-xs text-slate-500 sm:inline">wstępna ocena objawów</span>
        </a>
        <nav className="flex items-center gap-1" aria-label="Główna">
          {link('/historia', 'Historia')}
          <span className="hidden sm:inline">{link('/pomoc', 'Jak to działa')}</span>
          {account.status === 'signed-out' && (
            <button
              type="button"
              onClick={account.signIn}
              className="ml-1 rounded-full border border-teal-700 px-3.5 py-1.5 text-sm font-semibold text-teal-800 hover:bg-teal-50"
            >
              Zaloguj się
            </button>
          )}
          {account.status === 'loading' && <span className="ml-1 w-20 animate-pulse rounded-full bg-slate-100 py-1.5 text-center text-xs text-slate-400">…</span>}
          {account.status === 'signed-in' && account.user && (
            <details className="relative ml-1">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-slate-200 py-1 pr-3 pl-1 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                {account.user.imageUrl ? (
                  <img src={account.user.imageUrl} alt="" className="h-7 w-7 rounded-full" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">{initials}</span>
                )}
                <span className="max-w-[9rem] truncate text-sm font-medium text-slate-800">{account.user.name}</span>
              </summary>
              <div className="absolute right-0 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                {account.user.email && <p className="truncate px-3 py-1.5 text-xs text-slate-500">{account.user.email}</p>}
                <a href="#/historia" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50">
                  Historia analiz
                </a>
                {account.provider === 'clerk' && (
                  <button type="button" onClick={account.openProfile} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50">
                    Ustawienia konta
                  </button>
                )}
                <button type="button" onClick={() => void account.signOut()} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">
                  Wyloguj się
                </button>
                {account.provider === 'local' && <p className="px-3 py-1.5 text-xs text-slate-400">tryb lokalny, bez serwera</p>}
              </div>
            </details>
          )}
        </nav>
      </div>
    </header>
  )
}
