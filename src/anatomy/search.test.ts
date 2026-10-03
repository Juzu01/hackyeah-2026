import { describe, expect, it } from 'vitest'
import { fold, search } from './search.ts'

const ids = (q: string, n = 12) => search(q).slice(0, n).map((h) => h.id)

describe('search', () => {
  it('ignores case and Polish diacritics', () => {
    expect(fold('Łydka Żołądek')).toBe('lydka zoladek')
    expect(ids('ZOLADEK')[0]).toBe('stomach')
  })

  it('kolano: the kneecap in the top 3, at most 12 results', () => {
    expect(ids('kolano', 3).some((id) => id.startsWith('patella'))).toBe(true)
    expect(search('kolano').length).toBeLessThanOrEqual(12)
  })

  it('a side word puts that side first', () => {
    expect(ids('lewe kolano', 3).every((id) => !id.endsWith('-right'))).toBe(true)
    expect(ids('lewa łydka')[0]).toMatch(/^(gastrocnemius|soleus)-left$/)
    expect(ids('prawa łydka')[0]).toMatch(/-right$/)
  })

  it('głowa: skull or brain first, no trachea near the top', () => {
    expect(ids('głowa')[0]).toMatch(/^(skull|brain)$/)
    expect(ids('głowa', 3)).not.toContain('trachea')
  })

  it('brzuch: no calf muscle among the first five', () => {
    expect(ids('brzuch', 5).some((id) => id.startsWith('gastrocnemius'))).toBe(false)
  })

  it('kość ogonowa: the pelvis first, not every bone', () => {
    const r = ids('kość ogonowa')
    expect(r[0]).toBe('pelvis')
    expect(r.length).toBeLessThanOrEqual(10)
  })

  it('serce: the heart first, the soleus nowhere near it', () => {
    const r = ids('serce')
    expect(r[0]).toBe('heart')
    const soleus = r.findIndex((id) => id.startsWith('soleus'))
    expect(soleus === -1 || soleus === r.length - 1).toBe(true)
  })

  it('skips filler words and empty queries', () => {
    expect(ids('boli mnie serce')[0]).toBe('heart')
    expect(search('   ')).toEqual([])
  })
})
