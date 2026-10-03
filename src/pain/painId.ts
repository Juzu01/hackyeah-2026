// Atlas part id → the id pain reports are stored under. The database checks
// body_part_id against ^[a-zA-Z]+(-(left|right))?$ and its body_parts lookup
// was seeded from the earlier 2D map, so ids are camelCased with the side kept
// ('latissimus-dorsi-left' → 'latissimusDorsi-left'), and parts the 2D map
// already had keep their old ids so existing history still matches.

/** Bases renamed to the 2D map's ids; the side suffix is kept. */
const BASES: Record<string, string> = {
  'pectoralis-major': 'pectoralis',
  'serratus-anterior': 'serratus',
  'external-oblique': 'obliqueExternal',
  'biceps-brachii': 'biceps',
  'triceps-brachii': 'triceps',
  'urinary-bladder': 'bladder',
}

/** Whole ids the 2D map had as one part, or with the side in the name. */
const IDS: Record<string, string> = {
  'rectus-abdominis-left': 'rectusAbdominis',
  'rectus-abdominis-right': 'rectusAbdominis',
  'lung-left': 'lungLeft',
  'lung-right': 'lungRight',
}

export function painId(partId: string): string {
  const whole = IDS[partId]
  if (whole) return whole
  const [, base, side = ''] = /^(.*?)(-(?:left|right))?$/.exec(partId)!
  return (BASES[base] ?? base.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())) + side
}
