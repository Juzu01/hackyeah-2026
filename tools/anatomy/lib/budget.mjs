// Triangle caps per catalog entry. They are ceilings: a mesh that simplifies further at no visible
// cost (see simplify.mjs) stays smaller. If the caps together overshoot TOTAL, build.mjs scales down
// the muscles and bones (many similar parts, each comfortably detailed at a fraction of its cap); the
// skin and the organs, which the atlas shows up close, keep theirs.
export const TOTAL = 450_000

export const scalable = (part) => part.system === 'muscle' || part.system === 'bone'

const BY_ID = {
  skin: 72_000,
  brain: 12_000,
  'small-intestine': 14_000,
  'large-intestine': 14_000,
  skull: 12_000,
  'thoracic-cage': 12_000,
  'vertebral-column': 12_000,
  pelvis: 12_000,
}

const BY_SYSTEM = { organ: 8_000, muscle: 3_500, bone: 4_000 }

export const budgetFor = (part) => BY_ID[part.id] ?? BY_SYSTEM[part.system]
