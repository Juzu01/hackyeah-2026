// BodyParts3D models some branching structures whole (the bronchial tree, the pulmonary arterial
// tree), while the atlas wants only their first stretch. These helpers cut a tree with a sphere around
// the point where it starts and cap the cut ends.
import { boundaryLoops, capLoops, compact, filterTriangles, triangleComponents } from './mesh.mjs'

/**
 * Cuts `mesh` exactly at the sphere (centre, radius), keeps only the pieces that reach within
 * `seedRadius` of the centre (side branches that curve back into the sphere come out as loose
 * islands), and closes every cut with a fan. Cutting through triangles (rather than dropping the ones
 * that cross) leaves each tube a smooth, nearly planar end that caps cleanly.
 */
export function clipToSphere(mesh, centre, radius, { seedRadius = 20 } = {}) {
  const inside = cutBySphere(mesh, centre, radius)
  const dist2 = (p, v) => (p[v * 3] - centre[0]) ** 2 + (p[v * 3 + 1] - centre[1]) ** 2 + (p[v * 3 + 2] - centre[2]) ** 2
  const { labels, count } = triangleComponents(inside)
  const seeded = new Uint8Array(count)
  const s2 = seedRadius * seedRadius
  for (let t = 0; t < labels.length; t++) if (dist2(inside.positions, inside.indices[t * 3]) <= s2) seeded[labels[t]] = 1
  const kept = filterTriangles(inside, (t) => seeded[labels[t]] === 1)
  return capLoops(kept, boundaryLoops(kept))
}

/** The part of the surface inside the sphere; triangles crossing it are split along the sphere. */
function cutBySphere({ positions: p, indices }, centre, radius) {
  const positions = Array.from(p)
  const level = (v) => Math.hypot(positions[v * 3] - centre[0], positions[v * 3 + 1] - centre[1], positions[v * 3 + 2] - centre[2]) - radius
  const cuts = new Map() // edge → the vertex where it crosses the sphere, shared by both triangles
  const cutPoint = (a, b) => {
    const key = a < b ? `${a},${b}` : `${b},${a}`
    if (!cuts.has(key)) {
      const la = level(a)
      const t = la / (la - level(b))
      cuts.set(key, positions.length / 3)
      for (let k = 0; k < 3; k++) positions.push(positions[a * 3 + k] + t * (positions[b * 3 + k] - positions[a * 3 + k]))
    }
    return cuts.get(key)
  }
  const out = []
  for (let t = 0; t < indices.length; t += 3) {
    const tri = [indices[t], indices[t + 1], indices[t + 2]]
    const isIn = tri.map((v) => level(v) <= 0)
    const n = isIn.filter(Boolean).length
    if (n === 3) out.push(...tri)
    if (n === 0 || n === 3) continue
    // Rotate (keeping the winding) so the odd one out comes first.
    const odd = isIn.findIndex((x) => (n === 1 ? x : !x))
    const [a, b, c] = [tri[odd], tri[(odd + 1) % 3], tri[(odd + 2) % 3]]
    const ab = cutPoint(a, b)
    const ca = cutPoint(c, a)
    if (n === 1) out.push(a, ab, ca)
    else out.push(ab, b, c, ab, c, ca)
  }
  return compact({ positions: Float32Array.from(positions), indices: Uint32Array.from(out) })
}

/** Centre of the lowest `band` mm of a mesh (BodyParts3D z is up): the carina, for the trachea. */
export function lowestPoint({ positions: p }, band = 3) {
  let minZ = Infinity
  for (let i = 2; i < p.length; i += 3) minZ = Math.min(minZ, p[i])
  const sum = [0, 0, 0]
  let n = 0
  for (let i = 0; i < p.length; i += 3) {
    if (p[i + 2] > minZ + band) continue
    sum[0] += p[i]
    sum[1] += p[i + 1]
    sum[2] += p[i + 2]
    n++
  }
  return sum.map((s) => s / n)
}
