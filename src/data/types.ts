// Shared types of the knowledge base and the analysis engine.

export type Sex = 'f' | 'm'

/** Urgency levels, from least to most urgent (the order matters: see engine.ts). */
export const TRIAGE_LEVELS = ['self-care', 'gp', 'urgent', 'emergency'] as const
export type Triage = (typeof TRIAGE_LEVELS)[number]

export interface Symptom {
  id: string
  name: string
  /** Region def ids where this symptom is offered; `*` = the "general" group shown everywhere. */
  regions: string[]
  /** Only offered for this sex. */
  sex?: Sex
  /** Listed first in the region's list. */
  common?: boolean
  /** Extra words for the search box. */
  search?: string[]
}

export interface Condition {
  id: string
  name: string
  description: string
  /** Symptom id -> weight (3 hallmark, 2 typical, 1 possible). */
  symptoms: Record<string, 1 | 2 | 3>
  triage: Triage
  /** Who to see, e.g. "lekarz rodzinny", "ortopeda". */
  specialist?: string
  advice: string[]
  sex?: Sex
  /** Inclusive age range in which the condition is considered at all. */
  ageRange?: [number, number]
  /** How common it is a priori: 1 rare, 2 typical, 3 very common. */
  prevalence?: 1 | 2 | 3
}

export interface RedFlag {
  id: string
  question: string
  /** Region def ids that make the question relevant; `*` = always asked. */
  regions: string[]
  triage: 'urgent' | 'emergency'
  /** Shown in the result as the reason for the triage. */
  reason: string
  sex?: Sex
  /** Asked only when one of these symptoms was picked (e.g. after a head injury). */
  symptoms?: string[]
}

export type Duration = 'hours' | 'days' | 'weeks' | 'months'
export type Onset = 'sudden' | 'gradual'
export type Trend = 'worse' | 'same' | 'better'

export type Pregnancy = 'no' | 'yes' | 'unknown'

/** The period against the usual cycle: late, early, on time, or no regular cycle to compare with. */
export type CycleTiming = 'late' | 'early' | 'usual' | 'irregular'
/** By how much: up to a week, 8–14 days, more than two weeks (early: up to a week or more). */
export type CycleShift = 'week' | 'two-weeks' | 'more'
export type CycleFlow = 'light' | 'usual' | 'heavy' | 'flooding'

/** What the interview asks about the period instead of "since when" and "how it started". */
export interface CycleCourse {
  timing?: CycleTiming
  shift?: CycleShift
  flow?: CycleFlow
  /** Bleeding or spotting between periods. */
  spotting?: boolean
}

/** How one symptom behaves: the interview asks this for each symptom separately. */
export interface SymptomCourse {
  /** 1–10. */
  severity?: number
  duration?: Duration
  onset?: Onset
  trend?: Trend
  /** The period ("menstruation" symptom) only. */
  cycle?: CycleCourse
}
