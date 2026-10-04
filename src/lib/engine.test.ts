import { describe, expect, it } from 'vitest'
import { analyze, analyzeBySymptom, rankConditions } from './engine.ts'

describe('engine', () => {
  it('ranks migraine first for a classic migraine picture', () => {
    const r = rankConditions({ regions: ['head'], symptoms: ['headache-one-sided-pulsing', 'light-sound-sensitivity', 'nausea'], redFlags: [] })
    expect(r[0].condition.id).toBe('migraine')
    expect(r[0].evidence).toBe('strong')
  })

  it('a red flag answered yes forces an emergency', () => {
    const r = analyze({ regions: ['head'], symptoms: ['headache'], redFlags: ['rf-thunderclap'] })
    expect(r.triage).toBe('emergency')
    expect(r.reasons[0]).toMatch(/piorunujący/)
  })

  it('a weak match with a dangerous cause does not escalate on its own', () => {
    const r = analyze({ regions: ['chest'], symptoms: ['cough', 'runny-nose'], redFlags: [], severity: 3, duration: 'days' })
    expect(r.triage).toBe('self-care')
    expect(r.conditions[0].condition.id).toBe('common-cold')
  })

  it('classic appendicitis is an emergency', () => {
    const r = analyze({ regions: ['lower-abdomen'], symptoms: ['abd-pain-rlq', 'pain-moves-rlq', 'nausea', 'appetite-loss', 'fever'], redFlags: [] })
    expect(r.conditions[0].condition.id).toBe('appendicitis')
    expect(r.triage).toBe('emergency')
  })

  it('long-lasting or severe symptoms bump self-care to a visit', () => {
    const base = { regions: ['lower-back'], symptoms: ['back-pain-lower', 'back-pain-after-lifting'], redFlags: [] }
    expect(analyze({ ...base, duration: 'days', severity: 3 }).triage).toBe('self-care')
    expect(analyze({ ...base, duration: 'months', severity: 3 }).triage).toBe('gp')
    expect(analyze({ ...base, duration: 'days', severity: 9 }).triage).toBe('urgent')
  })

  it('weighs each symptom on its own answers and names it', () => {
    const base = { regions: ['lower-back'], symptoms: ['back-pain-lower', 'back-pain-after-lifting'], redFlags: [] }
    const mild = { symptomId: 'back-pain-after-lifting', severity: 3, duration: 'days' as const, trend: 'same' as const }
    const r = analyze({ ...base, courses: [{ symptomId: 'back-pain-lower', severity: 9, duration: 'hours', trend: 'same' }, mild] })
    expect(r.triage).toBe('urgent')
    expect(r.reasons).toContain('bardzo silne dolegliwości – ból dolnej części pleców (krzyża)')
    const long = analyze({ ...base, courses: [{ symptomId: 'back-pain-lower', severity: 3, duration: 'months', trend: 'same' }, mild] })
    expect(long.triage).toBe('gp')
    expect(long.reasons.some((x) => x.startsWith('objawy utrzymują się od ponad tygodnia – ból dolnej'))).toBe(true)
    // A worsening that started hours ago is not yet a reason; one that lasts days is.
    const worse = { symptomId: 'back-pain-lower', severity: 3, trend: 'worse' as const }
    expect(analyze({ ...base, courses: [{ ...worse, duration: 'hours' }, mild] }).triage).toBe('self-care')
    expect(analyze({ ...base, courses: [{ ...worse, duration: 'days' }, mild] }).triage).toBe('gp')
  })

  it('gives every symptom its own causes and urgency', () => {
    const input = {
      regions: ['knee', 'chest', 'head'],
      symptoms: ['knee-pain', 'cough', 'headache'],
      redFlags: [],
      courses: [
        { symptomId: 'knee-pain', severity: 9, duration: 'days' as const, trend: 'worse' as const },
        { symptomId: 'cough', severity: 3, duration: 'days' as const, trend: 'same' as const },
        { symptomId: 'headache', severity: 2, duration: 'hours' as const, trend: 'better' as const },
      ],
    }
    const each = analyzeBySymptom(input)
    expect(each.map((s) => s.symptomId)).toEqual(['knee-pain', 'cough', 'headache'])
    for (const s of each) {
      expect(s.conditions.length).toBeGreaterThan(0)
      expect(s.conditions.every((c) => c.matched.includes(s.symptomId))).toBe(true)
    }
    // The knee no longer loses its causes to the infections the other two share.
    expect(each[0].conditions).toHaveLength(3)
    expect(each[0].conditions.every((c) => c.matched.length === 1)).toBe(true)
    expect(each[0].triage).toBe('urgent')
    expect(each[0].reasons).toContain('bardzo silne dolegliwości')
    expect(each[1].triage).toBe('self-care')
    expect(analyze(input).triage).toBe('urgent')
  })

  it('respects sex and age filters', () => {
    const f = rankConditions({ sex: 'f', regions: ['pelvis'], symptoms: ['menstrual-pain', 'abd-cramps'], redFlags: [] })
    expect(f[0].condition.id).toBe('dysmenorrhea')
    const m = rankConditions({ sex: 'm', regions: ['pelvis'], symptoms: ['menstrual-pain', 'abd-cramps'], redFlags: [] })
    expect(m.map((x) => x.condition.id)).not.toContain('dysmenorrhea')
    const young = rankConditions({ age: 25, regions: ['knee'], symptoms: ['knee-pain', 'knee-stiff-morning'], redFlags: [] })
    expect(young.map((x) => x.condition.id)).not.toContain('knee-oa')
  })

  it('a moderate match without any hallmark symptom does not escalate', () => {
    // Swollen, unstable knee after an injury plus a fever: septic arthritis is listed,
    // but without a hot red joint it must not override the ligament injury's triage.
    const r = analyze({ regions: ['knee'], symptoms: ['knee-pain', 'knee-swelling', 'knee-instability', 'knee-injury', 'fever'], redFlags: [], severity: 5 })
    expect(r.conditions[0].condition.id).toBe('knee-ligament')
    expect(r.conditions.map((c) => c.condition.id)).toContain('septic-arthritis')
    expect(r.triage).toBe('urgent')
    expect(r.reasons).toContain('możliwa przyczyna: Uszkodzenie więzadła kolana (np. ACL, MCL)')
  })

  it('returns nothing without symptoms', () => {
    expect(rankConditions({ regions: [], symptoms: [], redFlags: [] })).toEqual([])
    expect(analyze({ regions: [], symptoms: [], redFlags: [] }).conditions).toEqual([])
  })
})
