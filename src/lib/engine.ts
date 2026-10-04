// Ranks possible causes and decides how urgent the situation is.
// Deliberately simple and transparent (weighted symptom matching), the way
// first-generation checkers like WebMD's work; the output shape is what an LLM or
// Bayesian backend would also return, so it can be swapped later.

import { CONDITIONS } from '../data/conditions.ts'
import { RED_FLAGS } from '../data/redFlags.ts'
import { SYMPTOM_BY_ID, symptomName } from '../data/symptoms.ts'
import { TRIAGE_LEVELS, type Condition, type Duration, type Onset, type Pregnancy, type RedFlag, type Sex, type SymptomCourse, type Trend, type Triage } from '../data/types.ts'

export interface CheckInput {
  sex?: Sex
  age?: number
  pregnancy?: Pregnancy
  /** Region def ids the user pointed at. */
  regions: string[]
  symptoms: string[]
  /** Red-flag ids answered "yes". */
  redFlags: string[]
  /** Whether the alarm questions were asked at all (affects the wording of the reasons). */
  answeredRedFlags?: boolean
  /** How each symptom behaves. Without it, the four answers below stand for all the symptoms. */
  courses?: (SymptomCourse & { symptomId: string })[]
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
/** One level less urgent, never below a doctor's visit: emergency → urgent → gp. */
const stepDown = (t: Triage): Triage => (t === 'emergency' ? 'urgent' : t === 'urgent' ? 'gp' : t)

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
  const conditions = rankConditions(input).slice(0, 6)
  const flags = RED_FLAGS.filter((f) => input.redFlags.includes(f.id))
  return { ...decide(input, conditions, flags), conditions, redFlags: flags.map((f) => f.id) }
}

export interface SymptomResult {
  symptomId: string
  course: SymptomCourse
  triage: Triage
  reasons: string[]
  /** Its likeliest causes, best first. */
  conditions: RankedCondition[]
}

/**
 * The result for each symptom on its own, so that one symptom's causes don't crowd out
 * another's. Causes come from the ranking of all the symptoms together (a cause that explains
 * several of them ranks higher) and keep those that explain this one; the urgency comes from
 * them, from this symptom's own answers, and from the alarm answers about its part of the body.
 */
export function analyzeBySymptom(input: CheckInput, perSymptom = 3): SymptomResult[] {
  const ranked = rankConditions(input)
  return input.symptoms.flatMap((symptomId) => {
    const symptom = SYMPTOM_BY_ID.get(symptomId)
    if (!symptom) return []
    const course: SymptomCourse = input.courses?.find((c) => c.symptomId === symptomId) ?? {
      severity: input.severity,
      duration: input.duration,
      onset: input.onset,
      trend: input.trend,
    }
    // The urgency looks as far down the list as the overall result does (top 6), so a symptom's
    // badge never reads "Samoopieka" under an overall "today" that comes from its own causes.
    const mine = ranked.filter((r) => r.matched.includes(symptomId))
    const conditions = mine.slice(0, perSymptom)
    const flags = RED_FLAGS.filter(
      (f) => input.redFlags.includes(f.id) && (f.regions.includes('*') || symptom.regions.includes('*') || f.regions.some((r) => symptom.regions.includes(r))),
    )
    const own = { ...input, symptoms: [symptomId], courses: [{ symptomId, ...course }], answeredRedFlags: false }
    const overall = new Set(ranked.slice(0, 6))
    return [{ symptomId, course, conditions, ...decide(own, [...conditions, ...mine.slice(perSymptom).filter((r) => overall.has(r))], flags) }]
  })
}

/** How urgent: the alarm answers, then the causes, then the follow-up answers. */
function decide(input: CheckInput, conditions: RankedCondition[], flags: RedFlag[]): { triage: Triage; reasons: string[] } {
  const reasons: string[] = []
  let triage: Triage = 'self-care'

  // Red flags first: a single "yes" sets the floor, whatever else is going on.
  for (const f of flags) {
    triage = atLeast(triage, f.triage)
    reasons.push(f.reason)
  }

  // Then the causes. A convincing one (strong evidence, or moderate with one of its hallmark
  // symptoms reported) sets the triage to its own level. The best guess on thinner evidence still
  // counts, one level softer (an emergency becomes "see a doctor today"), and only if the person
  // reported at least one of its hallmarks or the match is moderate: loss of appetite alone does
  // not mean appendicitis, nor dizziness a concussion. A moderate match that lacks every hallmark
  // further down the list (e.g. a swollen knee with fever but no hot, red joint) is listed but
  // raises nothing. Real emergencies are what the alarm questions above are for.
  const hasHallmark = (r: RankedCondition) => r.matched.some((id) => r.condition.symptoms[id] === 3)
  conditions.forEach((r, i) => {
    const convincing = r.evidence === 'strong' || (r.evidence === 'moderate' && hasHallmark(r))
    const bestGuess = i === 0 && (r.evidence === 'moderate' || hasHallmark(r))
    if (!convincing && !bestGuess) return
    const level = convincing ? r.condition.triage : stepDown(r.condition.triage)
    if (TRIAGE_LEVELS.indexOf(level) > TRIAGE_LEVELS.indexOf(triage)) {
      triage = level
      reasons.push(`${convincing ? 'możliwa przyczyna' : 'lekarz powinien wykluczyć'}: ${r.condition.name}`)
    }
  })
  if (flags.length === 0 && input.answeredRedFlags) reasons.push('w wywiadzie nie zgłoszono objawów alarmowych')

  // Modifiers from the follow-up questions, symptom by symptom. With several symptoms the
  // reason says which one, e.g. "bardzo silne dolegliwości – ból głowy".
  const courses: (SymptomCourse & { symptomId?: string })[] = input.courses?.length
    ? input.courses
    : [{ severity: input.severity, duration: input.duration, trend: input.trend }]
  const which = (c: { symptomId?: string }) => {
    if (courses.length < 2 || !c.symptomId) return ''
    const name = symptomName(c.symptomId)
    return ` – ${name.charAt(0).toLowerCase()}${name.slice(1)}`
  }
  for (const c of courses) {
    const severity = c.severity ?? 0
    if (severity >= 8 && TRIAGE_LEVELS.indexOf(triage) < TRIAGE_LEVELS.indexOf('urgent')) {
      triage = 'urgent'
      reasons.push(`bardzo silne dolegliwości${which(c)}`)
    } else if (severity >= 6 && triage === 'self-care') {
      triage = 'gp'
      reasons.push(`nasilone dolegliwości${which(c)}`)
    }
  }
  for (const c of courses) {
    if (c.duration && DURATION_ORDER.indexOf(c.duration) >= DURATION_ORDER.indexOf('weeks') && triage === 'self-care') {
      triage = 'gp'
      reasons.push(`objawy utrzymują się od ponad tygodnia${which(c)}`)
    }
  }
  for (const c of courses) {
    if (c.trend === 'worse' && c.duration && c.duration !== 'hours' && triage === 'self-care') {
      triage = 'gp'
      reasons.push(`objawy się nasilają${which(c)}`)
    }
  }
  // Pregnant: anything that brings someone here is worth a word with a doctor or midwife, at least.
  if (input.pregnancy === 'yes' && triage === 'self-care') {
    triage = 'gp'
    reasons.push('ciąża – objawy warto omówić z lekarzem lub położną')
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
  return { triage, reasons: [...new Set(reasons)] }
}
