// Builds public/anatomy/body.glb and public/anatomy/manifest.json from BodyParts3D 3.0.
// Usage (from tools/anatomy): npm install && node build.mjs. See README.md for the pipeline.
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOTAL, budgetFor, scalable } from './lib/budget.mjs'
import { clipToSphere, lowestPoint } from './lib/clip.mjs'
import { encodeGlb } from './lib/glb.mjs'
import { bounds, cleanTriangles, creasedNormals, filterTriangles, mapPositions, mergeMeshes, surfaceCentroid, weld } from './lib/mesh.mjs'
import { EXTRA_CONCEPTS, EXTRA_EXCLUDES, KNOWN_GAPS, createResolver, parseTable } from './lib/resolve.mjs'
import { simplifyToBudget } from './lib/simplify.mjs'
import { trimMedialTo } from './lib/sheath.mjs'
import { outerSurface } from './lib/skin.mjs'
import { createSource, mapPool } from './lib/source.mjs'
import { parseStl } from './lib/stl.mjs'
import { thyroidGland } from './lib/thyroid.mjs'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(HERE, '../..')
const CATALOG = join(ROOT, 'src/anatomy/data/catalog.json')
const OUT_DIR = join(ROOT, 'public/anatomy')
const CACHE = join(HERE, '.cache')

const ATTRIBUTION = 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan'
const CITATION = 'Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. BodyParts3D: 3D structure database for anatomical concepts. Nucleic Acids Res. 2009;37:D782-5.'

const WELD_MM = 0.05
const CREASE_DEG = 60 // sharper edges than this get split normals (cut vessel ends, bronchi)
// The skin and these organs keep only the surface visible from outside (see lib/skin.mjs).
const SKIN_SHELL = { keep: 'largest', directions: 64, pixelSize: 0.5 }
const OUTER_ONLY = {
  heart: { directions: 64, pixelSize: 0.25, maxHoleArea: 600, grow: 3 },
  brain: { directions: 64, pixelSize: 0.3, maxHoleArea: 600, grow: 3 },
  'lung-left': { directions: 64, pixelSize: 0.4, maxHoleArea: 600, grow: 3 },
  'lung-right': { directions: 64, pixelSize: 0.4, maxHoleArea: 600, grow: 3 },
}
// Trees that BodyParts3D models whole are cut down to their first stretch (see lib/clip.mjs). Each lung
// has its own bronchial tree mesh; the right main bronchus is about half as long as the left one.
const MAIN_BRONCHUS_MM = { right: 22, left: 45 } // sphere radius around the carina
const PULMONARY_TRUNK_MM = 55 // around the pulmonary valve; further out it picks up lobar branches
// The external oblique's aponeurosis would hide the rectus abdominis (see lib/sheath.mjs).
const TRIM_MEDIAL_TO = { 'external-oblique-left': 'rectus-abdominis-left', 'external-oblique-right': 'rectus-abdominis-right' }
const NOTES = {
  'external-oblique-left': 'Fleshy belly only: the aponeurosis over the rectus abdominis is trimmed off at the rectus\'s lateral border.',
  'external-oblique-right': 'Fleshy belly only: the aponeurosis over the rectus abdominis is trimmed off at the rectus\'s lateral border.',
  trachea: `The bronchial trees are cut to the main bronchi (spheres around the carina: ${MAIN_BRONCHUS_MM.right} mm right, ${MAIN_BRONCHUS_MM.left} mm left).`,
  heart: `Includes the superior vena cava and the pulmonary trunk (the pulmonary arterial tree cut to a ${PULMONARY_TRUNK_MM} mm sphere around the pulmonary valve); only the outer surface is kept.`,
  skin: 'Outer surface only: inner sheets of the BodyParts3D skin volume are removed (see tools/anatomy/lib/skin.mjs).',
  brain: 'Outer surface only (hidden ventricles and deep nuclei removed).',
  'lung-left': 'Outer surface only (fissure walls between the lobes removed).',
  'lung-right': 'Outer surface only (fissure walls between the lobes removed).',
  pelvis: 'The coccyx is part of the BodyParts3D sacrum mesh.',
}

const source = createSource(CACHE)
const primitiveCache = new Map() // primitive id → Promise<{ soup, centroidX }>
const catalog = JSON.parse(await readFile(CATALOG, 'utf8'))
const [partsList, composites, conventional, available] = await Promise.all([
  source.text('parts_list_e.txt').then(parseTable),
  source.text('composite_parts.txt').then(parseTable),
  source.text('conventional_part_of.txt').then(parseTable),
  source.stlIds(),
])
const resolver = createResolver({ partsList, relations: [composites, conventional], available })

const plans = catalog.parts.map(planPart)
const thyroidRefs = ['trachea', 'thyroid cartilage'].map((c) => resolver.resolveConcept(c, null))
const needed = [...new Set([...plans.flatMap((p) => [...p.candidates]), ...thyroidRefs.flatMap((r) => r.primitives)])]
console.log(`\ndownloading ${needed.length} STL files (cached in tools/anatomy/.cache/stl)`)
let done = 0
await mapPool(needed, 6, async (id) => {
  await source.stl(id)
  if (++done % 50 === 0 || done === needed.length) console.log(`  ${done}/${needed.length}`)
})

console.log('\nassembling parts (millimetres, BodyParts3D frame)')
const raw = new Map() // id → { mesh, primitives }
for (const plan of plans) {
  const t0 = performance.now()
  const built = await assemble(plan)
  raw.set(plan.part.id, built)
  const secs = ((performance.now() - t0) / 1000).toFixed(1)
  console.log(`  ${plan.part.id.padEnd(26)} ${String(built.mesh.indices.length / 3).padStart(8)} tris from ${built.primitives.length} primitive(s)  ${secs}s`)
}

console.log('\nsimplifying')
const simplified = simplifyAll(catalog.parts, raw)

// BodyParts3D: mm, +x = patient's left, -y = anterior, +z = up. Atlas: m, +X = patient's left,
// +Y = up with the soles at 0, +Z = anterior (towards the default camera), skin centred on X/Z.
// (x, y, z) → (x, z, -y) is a proper rotation, so triangle winding survives.
const skinBox = bounds(simplified.get('skin').mesh.positions)
const origin = [(skinBox.min[0] + skinBox.max[0]) / 2, (skinBox.min[1] + skinBox.max[1]) / 2, skinBox.min[2]]
const toAtlas = (x, y, z) => [(x - origin[0]) / 1000, (z - origin[2]) / 1000, -(y - origin[1]) / 1000]

const outputs = catalog.parts.map((part) => {
  const { positions, normals, indices } = creasedNormals(mapPositions(simplified.get(part.id).mesh, toAtlas), CREASE_DEG)
  return { part, mesh: { positions, indices }, normals, errorMm: simplified.get(part.id).errorMm }
})

const glb = await encodeGlb(
  outputs.map(({ part, mesh, normals }) => ({
    id: part.id,
    positions: mesh.positions,
    normals,
    indices: mesh.indices,
    extras: { system: part.system, layer: part.layer, side: part.side, explode: part.explode, group: part.group },
  })),
  { copyright: ATTRIBUTION },
)
await mkdir(OUT_DIR, { recursive: true })
await writeFile(join(OUT_DIR, 'body.glb'), glb)
const manifest = buildManifest(outputs, glb.byteLength)
await writeFile(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

console.log(`\n${outputs.length} parts, ${manifest.totals.triangles} triangles, ${manifest.totals.vertices} vertices`)
console.log(`public/anatomy/body.glb ${(glb.byteLength / 1024 / 1024).toFixed(2)} MB`)

/** Which primitives a catalog entry may use, before the side filter. */
function planPart(part) {
  const concepts = [...part.concepts, ...(EXTRA_CONCEPTS[part.id] ?? [])]
  const resolutions = []
  const byConcept = new Map()
  const fixed = new Set() // sided by name, or the part has no side
  const bySide = new Set() // need the centroid side test
  for (const concept of concepts) {
    const r = resolver.resolveConcept(concept, part.side)
    if (!r) {
      const gap = KNOWN_GAPS[concept.toLowerCase()]
      resolutions.push({ concept, match: null, note: gap ?? 'unresolved' })
      console.log(`  ${part.id}: "${concept}" UNRESOLVED${gap ? ` (${gap})` : ''}`)
      continue
    }
    for (const id of r.primitives) (r.needsSideFilter ? bySide : fixed).add(id)
    byConcept.set(concept, r.primitives)
    resolutions.push({ concept, match: { id: r.id, name: r.name }, via: r.via, primitives: r.primitives.length })
    console.log(`  ${part.id}: "${concept}" → ${r.id} "${r.name}" via ${r.via}, ${r.primitives.length} primitive(s)${r.needsSideFilter ? ', side by centroid' : ''}`)
  }
  const excluded = new Set()
  for (const concept of [...(part.exclude ?? []), ...(EXTRA_EXCLUDES[part.id] ?? [])]) {
    const r = resolver.resolveConcept(concept, null)
    r?.primitives.forEach((id) => excluded.add(id))
    console.log(`  ${part.id}: exclude "${concept}" → ${r ? `${r.primitives.length} primitive(s)` : 'UNRESOLVED'}`)
  }
  for (const id of excluded) {
    fixed.delete(id)
    bySide.delete(id)
  }
  return { part, resolutions, byConcept, fixed, bySide, candidates: new Set([...fixed, ...bySide]) }
}

/** The part's source mesh in BodyParts3D millimetres, plus the primitive ids it was made from. */
async function assemble(plan) {
  const { part } = plan
  if (part.id === 'thyroid') {
    const [trachea, cartilage] = await Promise.all(thyroidRefs.map((r) => meshOf(r.primitives)))
    return { mesh: thyroidGland(trachea, cartilage), primitives: [], procedural: true }
  }
  const primitives = [...plan.fixed]
  for (const id of plan.bySide) {
    const { centroidX } = await primitive(id)
    if ((centroidX > 0 ? 'left' : 'right') === part.side) primitives.push(id)
  }
  let mesh
  if (part.id === 'trachea') {
    const trachea = await meshOf(plan.byConcept.get('trachea'))
    const tree = await meshOf(plan.byConcept.get('right main bronchus'))
    const carina = lowestPoint(trachea)
    const p = tree.positions
    const bronchus = (side) => {
      const half = filterTriangles(tree, (t) => (p[tree.indices[t * 3] * 3] > carina[0] ? 'left' : 'right') === side)
      return clipToSphere(half, carina, MAIN_BRONCHUS_MM[side])
    }
    mesh = mergeMeshes([trachea, bronchus('right'), bronchus('left')])
  } else if (part.id === 'heart') {
    const treeIds = plan.byConcept.get('pulmonary artery')
    const valve = await meshOf(resolver.resolveConcept('pulmonary valve', null).primitives)
    const trunk = clipToSphere(await meshOf(treeIds), surfaceCentroid(valve), PULMONARY_TRUNK_MM)
    mesh = mergeMeshes([await meshOf(primitives.filter((id) => !treeIds.includes(id))), trunk])
  } else {
    mesh = await meshOf(primitives)
  }
  if (TRIM_MEDIAL_TO[part.id]) {
    const muscle = await assemble(plans.find((p) => p.part.id === TRIM_MEDIAL_TO[part.id]))
    mesh = trimMedialTo(mesh, muscle.mesh)
  }
  if (part.id === 'skin') mesh = await memoMesh('skin-shell', [JSON.stringify(SKIN_SHELL), await readFile(join(HERE, 'lib/skin.mjs'))], () => outerSurface(mesh, SKIN_SHELL))
  else if (OUTER_ONLY[part.id]) mesh = outerSurface(mesh, OUTER_ONLY[part.id])
  return { mesh, primitives }
}

/** A parsed STL soup with the mean x of its triangle centres (x > 0 is the patient's left). */
function primitive(id) {
  if (!primitiveCache.has(id)) {
    primitiveCache.set(
      id,
      source.stl(id).then((buf) => {
        const soup = parseStl(buf)
        let sum = 0
        for (let i = 0; i < soup.length; i += 3) sum += soup[i]
        return { soup, centroidX: sum / (soup.length / 3) }
      }),
    )
  }
  return primitiveCache.get(id)
}

/** Primitives merged into one welded mesh with degenerate and doubled triangles removed. */
async function meshOf(ids) {
  const soups = await Promise.all(ids.map(async (id) => (await primitive(id)).soup))
  const soup = new Float32Array(soups.reduce((n, s) => n + s.length, 0))
  let offset = 0
  for (const s of soups) {
    soup.set(s, offset)
    offset += s.length
  }
  return cleanTriangles(weld(soup, WELD_MM))
}

/** Caches an expensive derived mesh in .cache/derived, keyed by everything it depends on. */
async function memoMesh(name, inputs, compute) {
  const hash = createHash('sha1')
  for (const input of inputs) hash.update(input)
  const file = join(CACHE, 'derived', `${name}-${hash.digest('hex').slice(0, 12)}.bin`)
  if (existsSync(file)) {
    const buf = await readFile(file)
    const [vertexCount, indexCount] = [buf.readUInt32LE(0), buf.readUInt32LE(4)]
    const body = buf.buffer.slice(buf.byteOffset + 8, buf.byteOffset + buf.byteLength)
    return { positions: new Float32Array(body, 0, vertexCount * 3), indices: new Uint32Array(body, vertexCount * 12, indexCount) }
  }
  const mesh = compute()
  const header = Buffer.alloc(8)
  header.writeUInt32LE(mesh.positions.length / 3, 0)
  header.writeUInt32LE(mesh.indices.length, 4)
  await mkdir(join(CACHE, 'derived'), { recursive: true })
  await writeFile(file, Buffer.concat([header, Buffer.from(mesh.positions.buffer, mesh.positions.byteOffset, mesh.positions.byteLength), Buffer.from(mesh.indices.buffer, mesh.indices.byteOffset, mesh.indices.byteLength)]))
  return mesh
}

/**
 * Simplifies every part to its cap. If the caps add up to more than TOTAL, the scalable parts that
 * hit their cap are scaled down together until the sum fits.
 */
function simplifyAll(parts, raw) {
  const results = new Map()
  let scale = 1
  for (let pass = 0; pass < 4; pass++) {
    for (const part of parts) {
      const cap = Math.floor(budgetFor(part) * (scalable(part) ? scale : 1))
      if (results.get(part.id)?.cap === cap) continue
      results.set(part.id, { cap, ...simplifyToBudget(raw.get(part.id).mesh, cap) })
    }
    const total = sum([...results.values()].map((r) => r.mesh.indices.length / 3))
    console.log(`  pass ${pass + 1}: scale ${scale.toFixed(3)} → ${total} triangles`)
    if (total <= TOTAL) break
    const capped = parts.filter((p) => scalable(p) && results.get(p.id).mesh.indices.length / 3 >= 0.9 * results.get(p.id).cap)
    const cappedTotal = sum(capped.map((p) => results.get(p.id).mesh.indices.length / 3))
    scale *= ((cappedTotal - (total - TOTAL)) / cappedTotal) * 0.99
  }
  return results
}

function buildManifest(outputs, fileBytes) {
  const round = (v) => Math.round(v * 1e5) / 1e5
  const parts = {}
  for (const { part, mesh, errorMm } of outputs) {
    const box = bounds(mesh.positions)
    const plan = plans.find((p) => p.part.id === part.id)
    const built = raw.get(part.id)
    parts[part.id] = {
      triangles: mesh.indices.length / 3,
      vertices: mesh.positions.length / 3,
      bboxMin: box.min.map(round),
      bboxMax: box.max.map(round),
      centroid: surfaceCentroid(mesh).map(round),
      simplificationErrorMm: Math.round(errorMm * 100) / 100,
      sourcePrimitives: built.primitives.map((id) => ({ id, name: resolver.names.get(id) })),
      concepts: plan.resolutions,
      ...(NOTES[part.id] && { note: NOTES[part.id] }),
      ...(built.procedural && {
        procedural: 'Not in BodyParts3D 3.0: modelled procedurally around the BodyParts3D trachea, below the thyroid cartilage.',
        fittedTo: thyroidRefs.map((r) => ({ id: r.id, name: r.name })),
      }),
    }
  }
  return {
    source: 'BodyParts3D 3.0 (https://dbarchive.biosciencedbc.jp/en/bodyparts3d/), via github.com/Kevin-Mattheus-Moerman/BodyParts3D',
    license: 'CC BY-SA 2.1 JP (https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en)',
    attribution: ATTRIBUTION,
    citation: CITATION,
    frame: 'metres; +Y up with the soles at 0; +X = patient\'s left; +Z = anterior; skin bounding box centred on X and Z',
    totals: { parts: outputs.length, triangles: sum(outputs.map((o) => o.mesh.indices.length / 3)), vertices: sum(outputs.map((o) => o.mesh.positions.length / 3)), fileBytes },
    parts,
  }
}

function sum(values) {
  return values.reduce((s, v) => s + v, 0)
}
