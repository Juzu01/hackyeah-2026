import type { Duration, Onset, Trend, Triage } from '../data/types.ts'

// Soleil's diary ("Więcej → Dziennik", soleil-main/diary.js) shows the user's pain entries
// next to their mood. "Gdzie boli?" adds an entry from its result. Both apps run on the same
// origin and the same Clerk instance, so the entry goes straight into the account's list in
// localStorage; keep the key and the entry shape in step with soleil-main/diary.js.

export interface DiaryPainEntry {
  id: string
  type: 'pain'
  /** When it hurt (ISO). */
  at: string
  /** Where, as the checker says it, e.g. "Kolano (lewa strona)". */
  where: string
  regions: string[]
  symptoms: string[]
  /** 1–10, when the interview asked. */
  level?: number
  duration?: Duration
  onset?: Onset
  trend?: Trend
  triage: Triage
  /** The recommendation in words, e.g. "Wizyta u lekarza". */
  advice: string
  source: 'gdzie-boli'
}

const key = (userId: string) => `soleil_pain_diary_v1_${userId}`

export function addToDiary(userId: string, entry: Omit<DiaryPainEntry, 'id' | 'type' | 'source'>): boolean {
  try {
    const list = JSON.parse(localStorage.getItem(key(userId)) || '[]') as DiaryPainEntry[]
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
    list.push({ ...entry, id, type: 'pain', source: 'gdzie-boli' })
    localStorage.setItem(key(userId), JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

/** Soleil around us (the "Objawy" tab shows this app in a frame), if any. */
type SoleilShell = Window & { hyShowView?: (view: string) => void; openAuth?: () => void; Clerk?: { user?: { id: string } | null } }
export function soleilShell(): SoleilShell | null {
  try {
    const parent = window.parent as SoleilShell
    return parent !== window && typeof parent.hyShowView === 'function' ? parent : null
  } catch {
    return null
  }
}

/** Opens Soleil's diary: in the surrounding app when framed, otherwise by going there. */
export function openDiary() {
  const shell = soleilShell()
  if (shell) shell.hyShowView?.('dziennik')
  else window.location.href = '../#dziennik'
}
