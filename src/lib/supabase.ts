import { createClient, type User } from '@supabase/supabase-js'
import type { Database } from './database.types.ts'

// Public project settings (see .env.example). Without them the body map still works; only saving is off.
const url: string | undefined = import.meta.env.VITE_SUPABASE_URL
const key: string | undefined = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = url && key ? createClient<Database>(url, key) : null

let signingIn: Promise<User> | null = null

/**
 * The current user. On the first call ever, signs in anonymously; the session then lives in
 * localStorage, so the same person keeps their history across visits on this device.
 */
export function ensureUser(): Promise<User> {
  const client = supabase
  if (!client) return Promise.reject(new Error('Supabase nie jest skonfigurowany (brak .env.local).'))

  // Shared promise: parallel callers (e.g. StrictMode double effects) must not create two users.
  signingIn ??= (async () => {
    const { data: { session } } = await client.auth.getSession()
    if (session) return session.user
    const { data, error } = await client.auth.signInAnonymously()
    if (error || !data.user) throw error ?? new Error('Anonimowe logowanie nie zwróciło użytkownika.')
    return data.user
  })().catch((err: unknown) => {
    signingIn = null // let the next call retry
    throw err
  })
  return signingIn
}

/** True when this browser already has a session; reading history shouldn't create users. */
export async function hasSession(): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  return !!data.session
}
