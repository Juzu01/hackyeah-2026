// Reading and writing pain reports. Body part ids are the body map's part ids ('biceps-left', 'heart').

import type { Tables } from './database.types.ts'
import { ensureUser, hasSession, supabase } from './supabase.ts'

export type PainType = Tables<'pain_types'>

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
