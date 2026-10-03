// Reading and writing pain reports. Body part ids are the body map's part ids ('biceps-left', 'heart').

import type { Tables } from './database.types.ts'
import { ensureUser, hasSession, supabase } from './supabase.ts'

export type PainType = Tables<'pain_types'>

/** One point of a "pain over time" chart: a day (Polish time) and a body part. */
export interface PainDay {
  /** YYYY-MM-DD */
  day: string
  bodyPartId: string
  reports: number
  avgIntensity: number
  maxIntensity: number
}

/** up/down: the average moved by at least 1 point; new: only recently; gone: only before. */
export type TrendKind = 'up' | 'down' | 'flat' | 'new' | 'gone'

export interface PainTrend {
  bodyPartId: string
  /** null for map parts not yet in the body_parts dictionary */
  namePl: string | null
  recentAvg: number | null
  previousAvg: number | null
  recentReports: number
  previousReports: number
  trend: TrendKind
}

export interface PainEntry {
  id: string
  bodyPartId: string
  intensity: number
  note: string | null
  reportedAt: Date
  types: PainType[]
}

export interface NewPainReport {
  bodyPartId: string
  /** 1–10 */
  intensity: number
  painTypeIds: string[]
  note?: string
  /** Defaults to now; set it to back-fill an earlier entry. */
  reportedAt?: Date
}

function client() {
  if (!supabase) throw new Error('Supabase nie jest skonfigurowany (brak .env.local).')
  return supabase
}

export async function fetchPainTypes(): Promise<PainType[]> {
  const { data, error } = await client().from('pain_types').select('*').order('sort_order')
  if (error) throw error
  return data
}

/** Saves the report with its pain types in one transaction; returns the new report id. */
export async function savePainReport(report: NewPainReport): Promise<string> {
  await ensureUser()
  const { data, error } = await client().rpc('create_pain_report', {
    p_body_part_id: report.bodyPartId,
    p_intensity: report.intensity,
    p_pain_type_ids: report.painTypeIds,
    p_note: report.note,
    p_reported_at: report.reportedAt?.toISOString(),
  })
  if (error) throw error
  return data
}

/** The signed-in user's reports, newest first; optionally for one body part. */
export async function fetchPainHistory(bodyPartId?: string, limit = 50): Promise<PainEntry[]> {
  if (!(await hasSession())) return []
  let query = client()
    .from('pain_reports')
    .select('id, body_part_id, intensity, note, reported_at, pain_report_types(pain_types(id, name_pl, sort_order))')
    .order('reported_at', { ascending: false })
    .limit(limit)
  if (bodyPartId) query = query.eq('body_part_id', bodyPartId)

  const { data, error } = await query
  if (error) throw error
  return data.map((r) => ({
    id: r.id,
    bodyPartId: r.body_part_id,
    intensity: r.intensity,
    note: r.note,
    reportedAt: new Date(r.reported_at),
    types: r.pain_report_types.map((t) => t.pain_types).sort((a, b) => a.sort_order - b.sort_order),
  }))
}

const warsawDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw' }) // formats as YYYY-MM-DD

/** Daily averages for the last `days` days, oldest first; optionally for one body part. */
export async function fetchPainDaily({ bodyPartId, days = 30 }: { bodyPartId?: string; days?: number } = {}): Promise<PainDay[]> {
  if (!(await hasSession())) return []
  const since = warsawDate.format(new Date(Date.now() - (days - 1) * 86_400_000))
  let query = client()
    .from('pain_daily')
    .select('day, body_part_id, reports, avg_intensity, max_intensity')
    .gte('day', since)
    .order('day')
  if (bodyPartId) query = query.eq('body_part_id', bodyPartId)

  const { data, error } = await query
  if (error) throw error
  // View columns come back typed as nullable, but the grouped ones never are.
  return data.map((d) => ({
    day: d.day!,
    bodyPartId: d.body_part_id!,
    reports: d.reports!,
    avgIntensity: d.avg_intensity!,
    maxIntensity: d.max_intensity!,
  }))
}

/** Last `days` days vs the `days` before, per body part, most painful first. */
export async function fetchPainTrend(days = 7): Promise<PainTrend[]> {
  if (!(await hasSession())) return []
  const { data, error } = await client().rpc('pain_trend', { p_days: days })
  if (error) throw error
  return data.map((t) => ({
    bodyPartId: t.body_part_id,
    namePl: t.name_pl ?? null,
    recentAvg: t.recent_avg ?? null,
    previousAvg: t.previous_avg ?? null,
    recentReports: t.recent_reports,
    previousReports: t.previous_reports,
    trend: t.trend as TrendKind,
  }))
}

let seeding: Promise<number> | null = null

/**
 * For presentations: replaces this user's demo reports with ~30 days of example history
 * (marked is_demo, real reports stay). Returns how many reports were added.
 */
export function seedDemoHistory(): Promise<number> {
  // Shared promise: two parallel calls would each insert a full set.
  seeding ??= (async () => {
    await ensureUser()
    const { data, error } = await client().rpc('seed_demo_history')
    if (error) throw error
    return data
  })().finally(() => {
    seeding = null
  })
  return seeding
}

/** Removes this user's demo reports; returns how many were removed. */
export async function clearDemoHistory(): Promise<number> {
  if (!(await hasSession())) return 0
  const { data, error } = await client().rpc('clear_demo_history')
  if (error) throw error
  return data
}
