import { describe, expect, it } from 'vitest'
import { answer } from './assistant.ts'

describe('answer', () => {
  it('asks how much it hurts, then takes a bare number with a type', () => {
    const first = answer('boli mnie brzuch', { selectedId: null, pending: null })
    expect(first.act.focus).toBe('stomach')
    expect(first.pending?.want).toBe('intensity')
    const second = answer('siedem, piecze', { selectedId: 'stomach', pending: first.pending })
    expect(second.draft).toEqual({ partId: 'stomach', intensity: 7, typeIds: ['burning'] })
  })

  it('asks where, then takes the place', () => {
    const first = answer('strasznie boli', { selectedId: null, pending: null })
    expect(first.pending?.want).toBe('part')
    const second = answer('lewe kolano', { selectedId: null, pending: first.pending })
    expect(second.act.focus).toBe('patella-left')
    expect(second.draft?.intensity).toBe(9)
  })

  it('drafts a full report from one sentence', () => {
    const r = answer('boli mnie lewe kolano, tak na 6, kłuje', { selectedId: null, pending: null })
    expect(r.draft).toEqual({ partId: 'patella-left', intensity: 6, typeIds: ['stabbing'] })
    expect(r.text).toMatch(/strona lewa/)
  })

  it('sends chest pain to 112, not to a form', () => {
    const r = answer('boli mnie w klatce piersiowej', { selectedId: null, pending: null })
    expect(r.emergency?.calls.map((c) => c.tel)).toContain('112')
    expect(r.draft).toBeUndefined()
  })
})
