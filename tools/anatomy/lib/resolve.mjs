// Catalog concepts → BodyParts3D primitive ids (the ones that have an STL file).
//
// BodyParts3D describes composites twice: composite_parts.txt and conventional_part_of.txt. Neither
// is complete on its own (the composite table lists only T1–T8 under "set of thoracic vertebrae" and
// nothing under the cervical and lumbar sets), so concepts expand through the union of both.

// FMA naming varies and some concepts are missing from BodyParts3D 3.0, so a concept that is not in
// the part lists is retried under these names (each one also with a "left"/"right" prefix).
export const ALIASES = {
  'external oblique': ['external abdominal oblique'],
  'external abdominal oblique': ['external oblique'],
  'fibularis longus': ['peroneus longus'],
  'peroneus longus': ['fibularis longus'],
  'set of ribs': ['rib'],
  'set of phalanges of hand': ['set of fingers'],
  'set of phalanges of foot': ['set of toes'],
  // BodyParts3D has no separate main bronchi, only the whole bronchial tree; build.mjs cuts it.
  'right main bronchus': ['bronchus'],
  'left main bronchus': ['bronchus'],
}

// Concepts BodyParts3D 3.0 does not model at all, with what the build does instead.
export const KNOWN_GAPS = {
  coccyx: 'not a separate part; the sacrum mesh already includes it',
  'thyroid gland': 'not in BodyParts3D; build.mjs models it procedurally around the trachea',
}

// Per-part additions to the catalog: BodyParts3D's "large intestine" stops at the colon and its
// "heart" has no great vessels (build.mjs keeps only the first stretch of the pulmonary arterial tree);
// the conventional hierarchy files the eyeballs under "skull" because they sit in the orbits; the
// pancreatic duct is hidden inside the pancreas (it would only cost triangles).
export const EXTRA_CONCEPTS = {
  'large-intestine': ['rectum', 'appendix'],
  heart: ['superior vena cava', 'pulmonary artery'],
}
export const EXTRA_EXCLUDES = { skull: ['eyeball'], pancreas: ['pancreatic duct'] }

/** Reads a part list (id, name) or a relation table (parent id, parent name, child id, child name). */
export function parseTable(text) {
  return text
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split('\t').map((s) => s.trim()))
    .filter((cols) => cols[0] && cols[1])
}

export function createResolver({ partsList, relations, available }) {
  const names = new Map()
  const byName = new Map()
  const children = new Map()
  const addName = (id, name) => {
    if (!id || !name || names.has(id)) return
    names.set(id, name)
    if (!byName.has(name.toLowerCase())) byName.set(name.toLowerCase(), id)
  }
  for (const [id, name] of partsList) addName(id, name)
  for (const table of relations) {
    for (const [parent, parentName, child, childName] of table) {
      if (!child) continue
      addName(parent, parentName)
      addName(child, childName)
      if (!children.has(parent)) children.set(parent, new Set())
      children.get(parent).add(child)
    }
  }

  /** All primitives with an STL under `id`, expanding nested composites. */
  const expand = (id, seen = new Set()) => {
    if (seen.has(id)) return []
    seen.add(id)
    const out = available.has(id) ? [id] : []
    for (const child of children.get(id) ?? []) out.push(...expand(child, seen))
    return out
  }

  const lookup = (name) => {
    const id = byName.get(name.toLowerCase())
    if (!id) return null
    const primitives = [...new Set(expand(id))]
    return primitives.length ? { id, name: names.get(id), primitives } : null
  }

  /**
   * Resolves one concept for a part. With a side, "left X"/"right X" wins; otherwise the unsided
   * concept comes back with `needsSideFilter` so the caller keeps only the primitives on that side.
   */
  const resolveConcept = (concept, side) => {
    const alreadySided = /^(left|right) /i.test(concept)
    for (const name of [concept, ...(ALIASES[concept.toLowerCase()] ?? [])]) {
      const via = name === concept ? null : `alias "${name}"`
      const sided = side && !alreadySided && lookup(`${side} ${name}`)
      if (sided) return { ...sided, via: via ?? 'side prefix', needsSideFilter: false }
      const plain = lookup(name)
      if (plain) return { ...plain, via: via ?? 'exact', needsSideFilter: Boolean(side) && !alreadySided }
    }
    return null
  }

  return { names, resolveConcept }
}
