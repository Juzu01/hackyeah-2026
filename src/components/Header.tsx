import { useAccount } from '../lib/account.ts'
import type { Path } from '../lib/router.ts'
import { Logo } from './Logo.tsx'

interface Props {
  path: Path
}

/**
 * Logo left, "Historia" and, once signed in, the account on the right. No sign-in button: the checker
 * works without an account, and login is asked for only when saving a result or adding to the diary.
 */
export default function Header({ path }: Props) {
  const account = useAccount()
  const link = (to: Path, label: string) => (
    <a href={to === '/' ? '#' : `#${to}`} aria-current={path === to ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center border-b-2 px-2.5 text-[0.9375rem] font-medium hover:text-ink ${path === to ? 'border-green text-ink' : 'border-transparent text-ink-2'}`}>
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
    <header className="ambient sticky top-0 z-30 border-b border-line print:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-1.5">
        <a href="#" className="flex min-h-11 items-center gap-2.5">
          <Logo className="h-9 w-9 shrink-0 text-green" />
          <span className="font-serif text-[1.375rem] leading-none font-medium tracking-tight text-ink">Gdzie boli?</span>
          <span className="hidden text-sm text-ink-2 sm:inline">wstępna ocena objawów</span>
        </a>
        <nav className="flex items-center gap-1" aria-label="Główna">
          {link('/historia', 'Historia')}
          <span className="hidden sm:inline">{link('/pomoc', 'Jak to działa')}</span>
          {account.status === 'signed-in' && account.user && (
            <details className="relative ml-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-line-2 py-1 pr-3 pl-1 hover:bg-s2 [&::-webkit-details-marker]:hidden">
                {account.user.imageUrl ? (
                  <img src={account.user.imageUrl} alt="" className="h-7 w-7 rounded-full" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green text-xs font-bold text-green-ink">{initials}</span>
                )}
                <span className="max-w-[9rem] truncate text-[0.9375rem] font-medium text-ink">{account.user.name}</span>
              </summary>
              <div className="absolute right-0 mt-1 w-56 rounded-xl border border-line-2 bg-s1 p-1">
                {account.user.email && <p className="truncate px-3 py-1.5 text-sm text-ink-2">{account.user.email}</p>}
                <a href="#/historia" className="block px-3 py-2.5 text-[0.9375rem] text-ink hover:bg-s2">
                  Historia analiz
                </a>
                {account.provider === 'clerk' && (
                  <button type="button" onClick={account.openProfile} className="block w-full px-3 py-2.5 text-left text-[0.9375rem] text-ink hover:bg-s2">
                    Ustawienia konta
                  </button>
                )}
                <button type="button" onClick={() => void account.signOut()} className="block w-full px-3 py-2.5 text-left text-[0.9375rem] text-alarm hover:bg-alarm-soft">
                  Wyloguj się
                </button>
                {account.provider === 'local' && <p className="px-3 py-1.5 text-sm text-ink-2">tryb lokalny, bez serwera</p>}
              </div>
            </details>
          )}
        </nav>
      </div>
    </header>
  )
}
