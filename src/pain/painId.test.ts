import { describe, expect, it } from 'vitest'
import catalog from '../anatomy/data/catalog.json'
import { painId } from './painId.ts'

const FORMAT = /^[a-zA-Z]+(-(left|right))?$/
const pickable = catalog.parts.filter((p) => p.layer !== 'shell').map((p) => p.id)

/** Ids the body_parts lookup was seeded with (the 2D map's). */
function seededIds(): string[] {
  const files = import.meta.glob<string>('../../supabase/migrations/*_align_body_parts_with_body_map.sql', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
  const sql = Object.values(files)[0] ?? ''
  return [...sql.matchAll(/^\s*\('([^']+)', '[^']+', /gm)].map((m) => m[1])
}

describe('painId', () => {
  it('maps every pickable atlas part to an id the database accepts', () => {
    for (const id of pickable) expect(painId(id), id).toMatch(FORMAT)
  })

  it('keeps every id the 2D map stored reachable', () => {
    const ids = seededIds()
    expect(ids).toHaveLength(60)
    const mapped = new Set(pickable.map(painId))
    expect(ids.filter((id) => !mapped.has(id))).toEqual([])
  })

  it('camelCases the base and keeps the side', () => {
    expect(painId('latissimus-dorsi-left')).toBe('latissimusDorsi-left')
    expect(painId('thoracic-cage')).toBe('thoracicCage')
    expect(painId('femur-left')).toBe('femur-left')
    expect(painId('pectoralis-major-right')).toBe('pectoralis-right')
    expect(painId('rectus-abdominis-left')).toBe('rectusAbdominis')
    expect(painId('lung-left')).toBe('lungLeft')
    expect(painId('urinary-bladder')).toBe('bladder')
  })
})
