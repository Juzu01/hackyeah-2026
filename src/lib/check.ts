import { REGION_DEFS } from '../body/regions.ts'
import { redFlagsFor } from '../data/redFlags.ts'
import { SYMPTOM_BY_ID } from '../data/symptoms.ts'
import type { CycleCourse, Duration, Onset, Pregnancy, RedFlag, Sex, SymptomCourse, Trend } from '../data/types.ts'
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
  /** Asked of women of childbearing age only; kept off the check otherwise. */
  pregnancy?: Pregnancy
  picks: Pick[]
  /** Red-flag id -> answer. Asked once for the whole check. */
  answers: Record<string, Answer>
  /** Symptom id -> how that symptom behaves. */
  courses: Record<string, SymptomCourse>
  /** One answer for all symptoms: checks saved before the questions were asked per symptom. */
  duration?: Duration
  onset?: Onset
  severity?: number
  trend?: Trend
}

export const emptyDraft = (): CheckDraft => ({ forWhom: 'me', picks: [], answers: {}, courses: {} })

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
  const flags = redFlagsFor(regionDefIds(draft), draft.sex, pickedSymptoms(draft))
  const rank = (f: RedFlag) => (f.regions.includes('*') ? 0 : f.triage === 'emergency' ? 1 : 2)
  return flags.sort((a, b) => rank(a) - rank(b)).slice(0, cap)
}

/** The picked symptoms, each once, in the order they were picked. */
export const pickedSymptoms = (draft: CheckDraft): string[] => [...new Set(draft.picks.map((p) => p.symptomId))]

/** The answers about one symptom; a check saved before they were asked per symptom has one set for all. */
export function courseOf(draft: CheckDraft, symptomId: string): SymptomCourse {
  if (Object.keys(draft.courses ?? {}).length === 0) return { severity: draft.severity, duration: draft.duration, onset: draft.onset, trend: draft.trend }
  return draft.courses[symptomId] ?? {}
}

const DURATIONS: Duration[] = ['hours', 'days', 'weeks', 'months']
const TRENDS: Trend[] = ['worse', 'same', 'better']

/** All symptoms in one: the strongest, the longest, sudden if any was, worse if any is (the diary keeps one entry). */
export function overallCourse(draft: CheckDraft): SymptomCourse {
  const courses = pickedSymptoms(draft).map((id) => courseOf(draft, id))
  const severities = courses.flatMap((c) => (c.severity === undefined ? [] : [c.severity]))
  const durations = courses.flatMap((c) => (c.duration ? [DURATIONS.indexOf(c.duration)] : []))
  const trends = courses.flatMap((c) => (c.trend ? [TRENDS.indexOf(c.trend)] : []))
  const onsets = courses.flatMap((c) => (c.onset ? [c.onset] : []))
  return {
    severity: severities.length ? Math.max(...severities) : undefined,
    duration: durations.length ? DURATIONS[Math.max(...durations)] : undefined,
    onset: onsets.length ? (onsets.includes('sudden') ? 'sudden' : 'gradual') : undefined,
    trend: trends.length ? TRENDS[Math.min(...trends)] : undefined,
  }
}

export function toInput(draft: CheckDraft): CheckInput {
  const symptoms = pickedSymptoms(draft)
  return {
    sex: draft.sex,
    age: draft.age,
    pregnancy: draft.sex === 'f' ? draft.pregnancy : undefined,
    regions: regionDefIds(draft),
    symptoms,
    redFlags: Object.entries(draft.answers)
      .filter(([, a]) => a === 'yes')
      .map(([id]) => id),
    answeredRedFlags: Object.keys(draft.answers).length > 0,
    courses: symptoms.map((symptomId) => ({ symptomId, ...courseOf(draft, symptomId) })),
  }
}

/** Human summary of where it hurts, e.g. "Kolano (lewa strona), Dolna część pleców"; a searched symptom counts where it belongs. */
export function regionsSummary(draft: CheckDraft): string {
  const names = new Set<string>()
  for (const p of draft.picks) {
    const id = p.regionId ? defIdOf(p.regionId) : SYMPTOM_BY_ID.get(p.symptomId)?.regions.find((r) => r !== '*')
    const def = id && REGION_DEFS.find((d) => d.id === id)
    if (!def) continue
    const side = p.regionId?.endsWith('-left') ? ' (lewa strona)' : p.regionId?.endsWith('-right') ? ' (prawa strona)' : ''
    names.add(`${def.front ?? def.back}${side}`)
  }
  return [...names].join(', ')
}

/** The symptom whose interview asks about the cycle instead of "since when" (CycleStep). */
export const PERIOD = 'menstruation'

/** Women of childbearing age: the age range in which the pregnancy question is shown. */
export const canBePregnant = (draft: { sex?: Sex; age?: number }) => draft.sex === 'f' && (draft.age === undefined || (draft.age >= 12 && draft.age <= 55))

const COURSE_WORDS = {
  duration: { hours: 'krócej niż dzień', days: 'od kilku dni', weeks: 'od 1 do 4 tygodni', months: 'ponad miesiąc' },
  onset: { sudden: 'zaczęło się nagle', gradual: 'narastało stopniowo' },
  trend: { worse: 'nasila się', same: 'bez zmian', better: 'słabnie' },
  timing: { late: 'spóźnia się', early: 'przyszła wcześniej', usual: 'w zwykłym terminie', irregular: 'cykl nieregularny' },
  shift: { week: 'do 7 dni', 'two-weeks': '8–14 dni', more: 'ponad 2 tygodnie' },
  flow: { light: 'skąpa', usual: 'obfita jak zwykle', heavy: 'obfitsza niż zwykle', flooding: 'bardzo obfita' },
} as const

/** "spóźnia się 8–14 dni · obfitsza niż zwykle · plamienie między miesiączkami" */
function cycleSummary(c: CycleCourse): string[] {
  const shift = c.shift && (c.timing === 'late' || c.timing === 'early') ? ` ${c.timing === 'early' && c.shift === 'more' ? 'ponad tydzień' : COURSE_WORDS.shift[c.shift]}` : ''
  return [
    c.timing ? `${COURSE_WORDS.timing[c.timing]}${shift}` : '',
    c.flow ? COURSE_WORDS.flow[c.flow] : '',
    c.spotting === undefined ? '' : c.spotting ? 'plamienie między miesiączkami' : 'bez plamień między miesiączkami',
  ]
}

/** One symptom's answers in a line, e.g. "7/10 · od kilku dni · zaczęło się nagle · nasila się". */
export function courseSummary(c: SymptomCourse): string {
  return [
    ...(c.cycle ? cycleSummary(c.cycle) : []),
    c.severity !== undefined ? `${c.cycle ? 'ból ' : ''}${c.severity}/10` : '',
    c.duration ? COURSE_WORDS.duration[c.duration] : '',
    c.onset ? COURSE_WORDS.onset[c.onset] : '',
    c.trend ? COURSE_WORDS.trend[c.trend] : '',
  ]
    .filter(Boolean)
    .join(' · ')
}
