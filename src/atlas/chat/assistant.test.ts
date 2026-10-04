import { describe, expect, it } from 'vitest'
import { answer } from './assistant.ts'

describe('answer', () => {
  it('shows where it hurts and sends the pain to Objawy', () => {
    const r = answer('boli mnie lewe kolano, tak na 6, kłuje', { selectedId: null })
    expect(r.act.focus).toBe('patella-left')
    expect(r.symptoms).toBe(true)
    expect(r.text).toMatch(/strona lewa/)
    expect(r.text).toMatch(/Objawy/)
  })

  it('sends pain without a place to Objawy too', () => {
    const r = answer('strasznie boli', { selectedId: null })
    expect(r.symptoms).toBe(true)
    expect(r.act.focus).toBeUndefined()
  })

  it('sends chest pain to 112, not to Objawy', () => {
    const r = answer('boli mnie w klatce piersiowej', { selectedId: null })
    expect(r.emergency?.calls.map((c) => c.tel)).toContain('112')
    expect(r.symptoms).toBeUndefined()
  })

  it('shows a part it is asked about', () => {
    const r = answer('gdzie jest wątroba', { selectedId: null })
    expect(r.act.focus).toBe('liver')
    expect(r.symptoms).toBeUndefined()
  })
})
