import { describe, expect, it } from 'vitest'
import { localAnalysis } from './analysis.ts'
import { analyze, analyzeBySymptom, type CheckInput } from './engine.ts'

const read = (input: CheckInput) => localAnalysis(input, analyze(input), analyzeBySymptom(input))

describe('localAnalysis', () => {
  it('finds a cause the symptoms share', () => {
    const a = read({ regions: ['head'], symptoms: ['headache-one-sided-pulsing', 'light-sound-sensitivity', 'nausea'], redFlags: [] })
    expect(a.source).toBe('local')
    expect(a.summary).toMatch(/wspólną przyczynę/)
    expect(a.points[0].text).toMatch(/Migrena/)
  })

  it('says when the symptoms stand apart, and which one is most pressing', () => {
    const a = read({
      regions: ['knee', 'chest'],
      symptoms: ['knee-pain', 'cough'],
      redFlags: [],
      courses: [
        { symptomId: 'knee-pain', severity: 9, duration: 'days', trend: 'worse' },
        { symptomId: 'cough', severity: 2, duration: 'days', trend: 'same' },
      ],
    })
    expect(a.summary).toMatch(/każdy oceniliśmy osobno/)
    expect(a.points.map((p) => p.title)).toContain('Najpilniej: ból kolana')
  })

  it('names nothing as most pressing when the symptoms are equally urgent', () => {
    const a = read({ regions: ['head'], symptoms: ['headache', 'cough'], redFlags: [], pregnancy: 'yes' })
    expect(a.points.some((p) => p.title.startsWith('Najpilniej'))).toBe(false)
    expect(a.points.map((p) => p.title)).toContain('Ciąża')
  })
})
