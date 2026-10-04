import { ClerkProvider, useClerk, useUser } from '@clerk/react'
import { plPL } from '@clerk/localizations'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AccountContext, type Account, type AccountUser } from './account.ts'

// Login is optional (nobody gates a symptom checker behind an account), so the
// app talks to the small Account interface in account.ts. Clerk implements it
// when a publishable key is configured; otherwise a local, device-only
// "account" keeps history working for demos without network access.

// The team's existing Clerk development instance (already public in soleil-main/);
// override with VITE_CLERK_PUBLISHABLE_KEY, or set it to "off" for the local mode.
const DEFAULT_KEY = 'pk_test_YXdhaXRlZC1taW5rLTQ1LmNsZXJrLmFjY291bnRzLmRldiQ'
const KEY: string = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? DEFAULT_KEY

const APPEARANCE = {
  variables: { colorPrimary: '#0f766e', borderRadius: '12px', fontFamily: 'inherit' },
  // Same as the Doco sign-in: no "Secured by Clerk" and no "Development mode" badge
  elements: { footer: { '& > :not(.cl-footerAction)': { display: 'none' }, '&:not(:has(.cl-footerAction))': { display: 'none' } } },
  options: { unsafe_disableDevelopmentModeWarnings: true },
}

function ClerkAccount({ children }: { children: ReactNode }) {
  const clerk = useClerk()
  const { user, isLoaded, isSignedIn } = useUser()
  const [timedOut, setTimedOut] = useState(false)
  useEffect(() => {
    if (isLoaded) return
    const t = window.setTimeout(() => setTimedOut(true), 10_000)
    return () => window.clearTimeout(t)
  }, [isLoaded])

  const value = useMemo<Account>(() => {
    const failed = (clerk as unknown as { status?: string }).status === 'error' || (!isLoaded && timedOut)
    return {
      provider: 'clerk',
      status: failed ? 'unavailable' : !isLoaded ? 'loading' : isSignedIn ? 'signed-in' : 'signed-out',
      user:
        isSignedIn && user
          ? {
              id: user.id,
              name: user.fullName || user.firstName || user.username || user.primaryEmailAddress?.emailAddress || 'Użytkownik',
              email: user.primaryEmailAddress?.emailAddress,
              imageUrl: user.imageUrl,
            }
          : undefined,
      signIn: () => clerk.openSignIn({ appearance: APPEARANCE }),
      signOut: () => clerk.signOut(),
      openProfile: () => clerk.openUserProfile({ appearance: APPEARANCE }),
    }
  }, [clerk, user, isLoaded, isSignedIn, timedOut])

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

const LOCAL_KEY = 'gdzieboli:local-user'

function LocalAccount({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | undefined>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      return raw ? (JSON.parse(raw) as AccountUser) : undefined
    } catch {
      return undefined
    }
  })
  const value = useMemo<Account>(
    () => ({
      provider: 'local',
      status: user ? 'signed-in' : 'signed-out',
      user,
      signIn: () => {
        const name = window.prompt('Tryb lokalny (bez serwera). Podaj imię, pod którym zapiszemy historię na tym urządzeniu:')?.trim()
        if (!name) return
        const u: AccountUser = { id: `local-${name.toLowerCase().replace(/\s+/g, '-')}`, name }
        try {
          localStorage.setItem(LOCAL_KEY, JSON.stringify(u))
        } catch {
          // ignore
        }
        setUser(u)
      },
      signOut: async () => {
        try {
          localStorage.removeItem(LOCAL_KEY)
        } catch {
          // ignore
        }
        setUser(undefined)
      },
      openProfile: () => {},
    }),
    [user],
  )
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

// Demo (HackYeah): the same test account as the Doco shell (soleil-main/index.html), no Clerk sign-in.
// Results and diary entries are saved under it in this browser. Set to false to bring Clerk back.
const TEST_ACCOUNT = true
const TEST_USER: AccountUser = { id: 'test-user', name: 'Konto testowe' }

function TestAccount({ children }: { children: ReactNode }) {
  const value = useMemo<Account>(
    () => ({ provider: 'local', status: 'signed-in', user: TEST_USER, signIn: () => {}, signOut: async () => {}, openProfile: () => {} }),
    [],
  )
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

export function AccountProvider({ children }: { children: ReactNode }) {
  if (TEST_ACCOUNT) return <TestAccount>{children}</TestAccount>
  if (!KEY || KEY === 'off') return <LocalAccount>{children}</LocalAccount>
  return (
    <ClerkProvider publishableKey={KEY} localization={plPL} appearance={APPEARANCE}>
      <ClerkAccount>{children}</ClerkAccount>
    </ClerkProvider>
  )
}
