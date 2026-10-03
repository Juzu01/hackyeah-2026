import { REGION_DEFS } from '../body/regions.ts'
import { redFlagsFor } from '../data/redFlags.ts'
import { SYMPTOM_BY_ID } from '../data/symptoms.ts'
import type { Duration, Onset, RedFlag, Sex, Trend } from '../data/types.ts'
import type { CheckInput } from './engine.ts'

// One check = the user's answers across the steps. Kept in sessionStorage so a
// reload keeps the place in the interview.

export type ForWhom = 'me' | 'other'
export type Answer = 'yes' | 'no' | 'unknown'

export interface Pick {
  symptomId: string
  /** View-scoped region id the symptom was picked from (e.g. `knee-left`); absent for search picks. */
  regionId?: string
}

export interface CheckDraft {
  forWhom: ForWhom
  sex?: Sex
  age?: number
  picks: Pick[]
  /** Red-flag id -> answer. */
  answers: Record<string, Answer>
  duration?: Duration
  onset?: Onset
  severity?: number
  trend?: Trend
}

export const emptyDraft = (): CheckDraft => ({ forWhom: 'me', picks: [], answers: {} })

const KEY = 'gdzieboli:draft'

export function loadDraft(): CheckDraft {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (raw) return { ...emptyDraft(), ...(JSON.parse(raw) as CheckDraft) }
  } catch {
    // ignore: private mode or blocked storage
  }
  return emptyDraft()
}

export function saveDraft(draft: CheckDraft) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    // ignore
  }
}

/** Region def id of a view-scoped region id (`knee-left` -> `knee`). */
export const defIdOf = (regionId: string) => regionId.replace(/-(left|right)$/, '')

/** Region def ids this check concerns: where the user pointed, plus the home region of searched symptoms. */
export function regionDefIds(draft: CheckDraft): string[] {
  const ids = new Set<string>()
  for (const p of draft.picks) {
    if (p.regionId) {
      ids.add(defIdOf(p.regionId))
    } else {
      const home = SYMPTOM_BY_ID.get(p.symptomId)?.regions.find((r) => r !== '*')
      if (home) ids.add(home)
    }
  }
  return [...ids]
}

/** Red-flag questions for this check, emergencies first, capped so the interview stays short. */
export function interviewRedFlags(draft: CheckDraft, cap = 8): RedFlag[] {
  const flags = redFlagsFor(regionDefIds(draft), draft.sex)
  const rank = (f: RedFlag) => (f.regions.includes('*') ? 0 : f.triage === 'emergency' ? 1 : 2)
  return flags.sort((a, b) => rank(a) - rank(b)).slice(0, cap)
}

export function toInput(draft: CheckDraft): CheckInput {
  return {
    sex: draft.sex,
    age: draft.age,
    regions: regionDefIds(draft),
    symptoms: [...new Set(draft.picks.map((p) => p.symptomId))],
    redFlags: Object.entries(draft.answers)
      .filter(([, a]) => a === 'yes')
      .map(([id]) => id),
    answeredRedFlags: Object.keys(draft.answers).length > 0,
    duration: draft.duration,
    onset: draft.onset,
    severity: draft.severity,
    trend: draft.trend,
  }
}

/** Human summary of where it hurts, e.g. "Kolano (lewa strona), Dolna część pleców". */
export function regionsSummary(draft: CheckDraft): string {
  const names = new Set<string>()
  for (const p of draft.picks) {
    if (!p.regionId) continue
    const def = REGION_DEFS.find((d) => d.id === defIdOf(p.regionId!))
    if (!def) continue
    const side = p.regionId.endsWith('-left') ? ' (lewa strona)' : p.regionId.endsWith('-right') ? ' (prawa strona)' : ''
    names.add(`${def.front ?? def.back}${side}`)
  }
  return [...names].join(', ')
}
