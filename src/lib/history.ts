import type { Triage } from '../data/types.ts'
import type { CheckDraft } from './check.ts'

// Saved checks live in the browser (localStorage), keyed by account, so the
// prototype needs no backend. Results are recomputed from the draft when opened.

export interface SavedCheck {
  id: string
  createdAt: string
  draft: CheckDraft
  triage: Triage
  topConditions: string[]
  where: string
}

const key = (userId: string | undefined) => `gdzieboli:history:${userId ?? 'anon'}`

export function loadHistory(userId?: string): SavedCheck[] {
  try {
    const raw = localStorage.getItem(key(userId))
    return raw ? (JSON.parse(raw) as SavedCheck[]) : []
  } catch {
    return []
  }
}

function write(userId: string | undefined, items: SavedCheck[]) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(items))
  } catch {
    // ignore: storage blocked
  }
}

export function saveCheck(userId: string | undefined, item: Omit<SavedCheck, 'id' | 'createdAt'>): SavedCheck {
  const saved: SavedCheck = { ...item, id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() }
  write(userId, [saved, ...loadHistory(userId)].slice(0, 50))
  return saved
}

export function removeCheck(userId: string | undefined, id: string) {
  write(
    userId,
    loadHistory(userId).filter((x) => x.id !== id),
  )
}

/** Profile defaults (sex, age) remembered per account for "dla mnie" checks. */
export interface Profile {
  sex?: 'f' | 'm'
  age?: number
}

const profileKey = (userId: string | undefined) => `gdzieboli:profile:${userId ?? 'anon'}`

export function loadProfile(userId?: string): Profile {
  try {
    const raw = localStorage.getItem(profileKey(userId))
    return raw ? (JSON.parse(raw) as Profile) : {}
  } catch {
    return {}
  }
}

export function saveProfile(userId: string | undefined, profile: Profile) {
  try {
    localStorage.setItem(profileKey(userId), JSON.stringify(profile))
  } catch {
    // ignore
  }
}
