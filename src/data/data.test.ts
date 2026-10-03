import { describe, expect, it } from 'vitest'
import { REGION_DEFS, REGION_IDS, buildRegions } from '../body/regions.ts'
import { CONDITIONS } from './conditions.ts'
import { RED_FLAGS } from './redFlags.ts'
import { SYMPTOMS, SYMPTOM_BY_ID, searchSymptoms, symptomsForRegion } from './symptoms.ts'

describe('knowledge base integrity', () => {
  it('symptom ids are unique', () => {
    expect(new Set(SYMPTOMS.map((s) => s.id)).size).toBe(SYMPTOMS.length)
  })

  it('symptoms point at existing regions', () => {
    for (const s of SYMPTOMS) {
      for (const r of s.regions) {
        if (r !== '*') expect(REGION_IDS, `${s.id} -> ${r}`).toContain(r)
      }
    }
  })

  it('every region has symptoms to offer', () => {
    for (const def of REGION_DEFS) {
      expect(symptomsForRegion(def.id).specific.length, def.id).toBeGreaterThanOrEqual(3)
    }
  })

  it('conditions reference existing symptoms and have advice', () => {
    expect(new Set(CONDITIONS.map((c) => c.id)).size).toBe(CONDITIONS.length)
    for (const c of CONDITIONS) {
      expect(Object.keys(c.symptoms).length, c.id).toBeGreaterThan(0)
      for (const id of Object.keys(c.symptoms)) expect(SYMPTOM_BY_ID.has(id), `${c.id} -> ${id}`).toBe(true)
      expect(Object.values(c.symptoms).some((w) => w >= 2), `${c.id} has a typical symptom`).toBe(true)
      expect(c.advice.length, c.id).toBeGreaterThan(0)
    }
  })

  it('every symptom is used by at least one condition', () => {
    const used = new Set(CONDITIONS.flatMap((c) => Object.keys(c.symptoms)))
    const unused = SYMPTOMS.filter((s) => !used.has(s.id)).map((s) => s.id)
    expect(unused).toEqual([])
  })

  it('red flags point at existing regions', () => {
    for (const f of RED_FLAGS) {
      for (const r of f.regions) if (r !== '*') expect(REGION_IDS, `${f.id} -> ${r}`).toContain(r)
    }
  })

  it('both views build and have unique region ids', () => {
    for (const view of ['front', 'back'] as const) {
      const regions = buildRegions(view)
      expect(regions.length).toBeGreaterThan(10)
      expect(new Set(regions.map((r) => r.id)).size).toBe(regions.length)
      for (const r of regions) expect(r.paths.every((d) => d.startsWith('M') && d.endsWith('Z'))).toBe(true)
    }
  })

  it('search is accent-insensitive', () => {
    expect(searchSymptoms('bol glowy').map((s) => s.id)).toContain('headache')
    expect(searchSymptoms('ZGAGA').map((s) => s.id)).toContain('heartburn')
  })
})
