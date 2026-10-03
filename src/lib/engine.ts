// Ranks possible causes and decides how urgent the situation is.
// Deliberately simple and transparent (weighted symptom matching), the way
// first-generation checkers like WebMD's work; the output shape is what an LLM or
// Bayesian backend would also return, so it can be swapped later.

import { CONDITIONS } from '../data/conditions.ts'
import { RED_FLAGS } from '../data/redFlags.ts'
import { SYMPTOM_BY_ID } from '../data/symptoms.ts'
import { TRIAGE_LEVELS, type Condition, type Duration, type Onset, type Sex, type Trend, type Triage } from '../data/types.ts'

export interface CheckInput {
  sex?: Sex
  age?: number
  /** Region def ids the user pointed at. */
  regions: string[]
  symptoms: string[]
  /** Red-flag ids answered "yes". */
  redFlags: string[]
  /** Whether the alarm questions were asked at all (affects the wording of the reasons). */
  answeredRedFlags?: boolean
  duration?: Duration
  onset?: Onset
  severity?: number
  trend?: Trend
}

export type Evidence = 'strong' | 'moderate' | 'weak'

export interface RankedCondition {
  condition: Condition
  /** 0..1 */
  score: number
  evidence: Evidence
  matched: string[]
  /** Hallmark symptoms of the condition the user did not report. */
  missing: string[]
}

export interface CheckResult {
  triage: Triage
  reasons: string[]
  conditions: RankedCondition[]
  /** Red flags answered "yes". */
  redFlags: string[]
}

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  strong: 'Silne dopasowanie',
  moderate: 'Umiarkowane dopasowanie',
  weak: 'Słabe dopasowanie',
}

export const TRIAGE_INFO: Record<Triage, { title: string; short: string; description: string }> = {
  'self-care': {
    title: 'Samoopieka',
    short: 'Możesz zacząć od samoopieki',
    description: 'Objawy wyglądają na łagodne. Obserwuj je i stosuj poniższe wskazówki. Umów wizytę, jeśli nie ustąpią w ciągu kilku dni lub się nasilą.',
  },
  gp: {
    title: 'Wizyta u lekarza',
    short: 'Umów wizytę u lekarza w ciągu kilku dni',
    description: 'Warto, żeby objawy ocenił lekarz rodzinny lub specjalista. Nie wymaga to pilnej wizyty, ale nie odkładaj jej na później.',
  },
  urgent: {
    title: 'Pilna konsultacja',
    short: 'Skontaktuj się z lekarzem jeszcze dziś',
    description: 'Objawy wymagają oceny lekarskiej w ciągu 24 godzin: lekarz rodzinny, nocna i świąteczna opieka albo SOR.',
  },
  emergency: {
    title: 'Stan nagły',
    short: 'Wezwij pogotowie (112 lub 999)',
    description: 'Takie objawy mogą oznaczać stan zagrożenia życia. Zadzwoń pod 112 lub 999 albo jedź na najbliższy SOR. Nie czekaj.',
  },
}

const PRIOR: Record<1 | 2 | 3, number> = { 1: 0.75, 2: 1, 3: 1.15 }
/** Three hallmark symptoms' worth of weight. */
const CORE_CAP = 9
const DURATION_ORDER: Duration[] = ['hours', 'days', 'weeks', 'months']

const maxTriage = (a: Triage, b: Triage): Triage => (TRIAGE_LEVELS.indexOf(a) >= TRIAGE_LEVELS.indexOf(b) ? a : b)
const atLeast = maxTriage

function applies(c: Condition, input: CheckInput): boolean {
  if (c.sex && input.sex && c.sex !== input.sex) return false
  if (c.ageRange && input.age !== undefined && (input.age < c.ageRange[0] || input.age > c.ageRange[1])) return false
  return true
}

export function rankConditions(input: CheckInput): RankedCondition[] {
  const selected = new Set(input.symptoms.filter((id) => SYMPTOM_BY_ID.has(id)))
  if (selected.size === 0) return []
  const out: RankedCondition[] = []
  for (const c of CONDITIONS) {
    if (!applies(c, input)) continue
    // "Core" is the condition's hallmark and typical symptoms (weight >= 2);
    // coverage asks how much of that picture the user reported. The denominator
    // is capped so a condition with many alternative hallmarks is not penalised.
    let core = 0
    let matchedWeight = 0
    let maxMatched = 0
    const matched: string[] = []
    const missing: string[] = []
    for (const [id, w] of Object.entries(c.symptoms)) {
      if (w >= 2) core += w
      if (selected.has(id)) {
        matchedWeight += w
        maxMatched = Math.max(maxMatched, w)
        matched.push(id)
      } else if (w === 3) {
        missing.push(id)
      }
    }
    // Needs at least one typical symptom, or two possible ones.
    if (matched.length === 0 || (maxMatched < 2 && matched.length < 2)) continue
    const coverage = Math.min(1, matchedWeight / Math.min(core, CORE_CAP))
    // How much of what the user reported this condition accounts for: a tiebreaker.
    const explained = matched.length / selected.size
    const score = Math.min(1, coverage * (0.75 + 0.25 * explained) * PRIOR[c.prevalence ?? 2])
    out.push({
      condition: c,
      score,
      evidence: score >= 0.65 ? 'strong' : score >= 0.35 ? 'moderate' : 'weak',
      matched,
      missing,
    })
  }
  return out.sort((a, b) => b.score - a.score)
}

export function analyze(input: CheckInput): CheckResult {
  const ranked = rankConditions(input)
  const conditions = ranked.slice(0, 6)
  const reasons: string[] = []
  let triage: Triage = 'self-care'

  // Red flags first: a single "yes" sets the floor, whatever else is going on.
  const flags = RED_FLAGS.filter((f) => input.redFlags.includes(f.id))
  for (const f of flags) {
    triage = atLeast(triage, f.triage)
    reasons.push(f.reason)
  }

  // Then the most urgent plausible cause. A condition may raise the triage only
  // when the evidence is strong, or moderate with at least one of its hallmark
  // symptoms reported, or it is the best guess overall. A moderate match that
  // lacks every hallmark (e.g. a swollen knee with fever but no hot, red joint)
  // is listed but does not send anyone to the ER on its own.
  const hasHallmark = (r: RankedCondition) => r.matched.some((id) => r.condition.symptoms[id] === 3)
  const plausible = conditions.filter((r, i) => i === 0 || r.evidence === 'strong' || (r.evidence === 'moderate' && hasHallmark(r)))
  for (const r of plausible) {
    if (TRIAGE_LEVELS.indexOf(r.condition.triage) > TRIAGE_LEVELS.indexOf(triage)) {
      triage = r.condition.triage
      reasons.push(`możliwa przyczyna: ${r.condition.name}`)
    }
  }
  if (flags.length === 0 && input.answeredRedFlags) reasons.push('w wywiadzie nie zgłoszono objawów alarmowych')

  // Modifiers from the follow-up questions.
  const severity = input.severity ?? 0
  if (severity >= 8 && TRIAGE_LEVELS.indexOf(triage) < TRIAGE_LEVELS.indexOf('urgent')) {
    triage = 'urgent'
    reasons.push('bardzo silne dolegliwości')
  } else if (severity >= 6 && triage === 'self-care') {
    triage = 'gp'
    reasons.push('nasilone dolegliwości')
  }
  if (input.duration && DURATION_ORDER.indexOf(input.duration) >= DURATION_ORDER.indexOf('weeks') && triage === 'self-care') {
    triage = 'gp'
    reasons.push('objawy utrzymują się od ponad tygodnia')
  }
  if (input.trend === 'worse' && input.duration && input.duration !== 'hours' && triage === 'self-care') {
    triage = 'gp'
    reasons.push('objawy się nasilają')
  }
  if (input.age !== undefined && input.age >= 65 && triage === 'self-care' && input.symptoms.includes('fever')) {
    triage = 'gp'
    reasons.push('gorączka po 65. roku życia')
  }
  if (input.age !== undefined && input.age < 18 && triage === 'self-care') {
    triage = 'gp'
    reasons.push('u osób niepełnoletnich objawy powinien ocenić lekarz')
  }

  if (reasons.length === 0) reasons.push('objawy wyglądają na łagodne i częste')
  return { triage, reasons: [...new Set(reasons)], conditions, redFlags: flags.map((f) => f.id) }
}
