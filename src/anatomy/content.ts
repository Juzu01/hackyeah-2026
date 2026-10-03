// The catalog of structures and their Polish copy. content.pl.json is optional:
// until it exists, labels fall back to readable ids and built-in group names.

export type System = 'skin' | 'muscle' | 'bone' | 'organ'
export type Layer = 'shell' | 'muscles' | 'deep'
export type Side = 'left' | 'right' | null

export interface CatalogEntry {
  id: string
  system: System
  layer: Layer
  group: string
  side: Side
  explode: boolean
  concepts: string[]
}

export interface PartCopy {
  name: string
  latin: string
  description: string
  action?: string
  exercises?: string[]
  fact?: string
  sport?: string
}

/** Everything the UI knows about one structure; passed to `onSelect`. */
export interface PartInfo extends PartCopy {
  id: string
  system: System
  layer: Layer
  group: string
  side: Side
  /** e.g. "Układ krążenia". */
  groupLabel: string
  /** e.g. "strona lewa"; null for unpaired structures. */
  sideLabel: string | null
}

interface ContentFile {
  groups?: Record<string, string>
  sides?: Record<string, string>
  parts?: Record<string, Partial<PartCopy>>
}

// Globs rather than imports, so a missing content file is not a build error.
const catalogFile = Object.values(
  import.meta.glob<{ parts: CatalogEntry[] }>('./data/catalog.json', { eager: true, import: 'default' }),
)[0]
const contentFile: ContentFile =
  Object.values(import.meta.glob<ContentFile>('./data/content.pl.json', { eager: true, import: 'default' }))[0] ?? {}

export const catalog: readonly CatalogEntry[] = catalogFile?.parts ?? []

const GROUPS: Record<string, string> = {
  integumentary: 'Powłoka wspólna',
  muscular: 'Układ mięśniowy',
  skeletal: 'Układ kostny',
  nervous: 'Układ nerwowy',
  endocrine: 'Układ dokrewny',
  respiratory: 'Układ oddechowy',
  circulatory: 'Układ krążenia',
  digestive: 'Układ pokarmowy',
  lymphatic: 'Układ chłonny',
  urinary: 'Układ moczowy',
}

const SIDES: Record<string, string> = { left: 'strona lewa', right: 'strona prawa' }

/** "biceps-brachii-left" → "Biceps brachii", for parts without copy yet. */
function fallbackName(id: string): string {
  const base = id.replace(/-(left|right)$/, '').replace(/-/g, ' ')
  return base.charAt(0).toUpperCase() + base.slice(1)
}

export function partInfo(entry: CatalogEntry): PartInfo {
  const copy = contentFile.parts?.[entry.id] ?? {}
  return {
    ...copy,
    id: entry.id,
    system: entry.system,
    layer: entry.layer,
    group: entry.group,
    side: entry.side,
    name: copy.name || fallbackName(entry.id),
    latin: copy.latin ?? '',
    description: copy.description ?? '',
    groupLabel: contentFile.groups?.[entry.group] ?? GROUPS[entry.group] ?? entry.group,
    sideLabel: entry.side ? (contentFile.sides?.[entry.side] ?? SIDES[entry.side]) : null,
  }
}
