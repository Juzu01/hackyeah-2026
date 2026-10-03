import { createContext, useContext } from 'react'

export type AccountStatus = 'loading' | 'signed-out' | 'signed-in' | 'unavailable'

export interface AccountUser {
  id: string
  name: string
  email?: string
  imageUrl?: string
}

export interface Account {
  status: AccountStatus
  user?: AccountUser
  /** Clerk ("clerk") or the device-only fallback ("local"). */
  provider: 'clerk' | 'local'
  signIn: () => void
  signOut: () => Promise<void>
  openProfile: () => void
}

export const AccountContext = createContext<Account>({
  status: 'unavailable',
  provider: 'local',
  signIn: () => {},
  signOut: async () => {},
  openProfile: () => {},
})

export const useAccount = () => useContext(AccountContext)
