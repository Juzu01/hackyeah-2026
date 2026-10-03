// BodyParts3D 3.0 has no thyroid gland (only the thyroid cartilage of the larynx), so the atlas gets a
// procedural one fitted to the real trachea: a single closed horseshoe that wraps the front of the
// trachea, thin at the isthmus (over the 2nd–4th tracheal rings) and swelling into two pear-shaped
// lobes on the sides that reach up to the thyroid cartilage. Built in BodyParts3D millimetres.
import { cleanTriangles, signedVolume, flipWinding, weld } from './mesh.mjs'

const deg = Math.PI / 180

/**
 * `trachea` is the welded trachea mesh; `cartilage` the thyroid cartilage (its lower edge sets the
 * level: the isthmus sits about one cricoid height below it).
 */
export function thyroidGland(trachea, cartilage, { segments = 72, ring = 24 } = {}) {
  const cartilageBottom = minZ(cartilage.positions)
  const isthmusZ = cartilageBottom - 34
  const lobeZ = cartilageBottom - 24
  const axis = tracheaAxis(trachea.positions)

  const thetaMax = 125 * deg
  const profile = (theta) => {
    const t = Math.abs(theta)
    const lobe = Math.exp(-(((t - 82 * deg) / (26 * deg)) ** 2))
    let a = 2.5 + 6 * lobe // radial half-thickness
    let b = 6 + 18 * lobe // vertical half-height
    const end = 100 * deg
    if (t > end) {
      const k = Math.sqrt(Math.max(0, 1 - ((t - end) / (thetaMax - end)) ** 2))
      a *= k
      b *= k
    }
    return { a, b, z: isthmusZ + (lobeZ - isthmusZ) * lobe }
  }

  const point = (theta, phi) => {
    const { a, b, z } = profile(theta)
    const sin = Math.sin(phi)
    // Pear-shaped lobes: the upper pole is taller and thinner than the lower one.
    const up = Math.max(0, sin)
    const zz = z + b * sin * (1 + 0.25 * up)
    const radial = a * Math.cos(phi) * (1 - 0.35 * up)
    const { cx, cy, r } = axis(zz)
    const R = r + 1.5 + a + radial
    // theta = 0 points anterior (-y); positive theta goes towards the patient's left (+x).
    return [cx + R * Math.sin(theta), cy - R * Math.cos(theta), zz]
  }

  const grid = []
  for (let i = 0; i <= segments; i++) {
    const theta = -thetaMax + (2 * thetaMax * i) / segments
    const row = []
    for (let j = 0; j < ring; j++) row.push(point(theta, (2 * Math.PI * j) / ring))
    grid.push(row)
  }
  // The profile shrinks to zero at both ends, so the end rings collapse to points and welding closes them.
  const soup = []
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < ring; j++) {
      const p00 = grid[i][j]
      const p01 = grid[i][(j + 1) % ring]
      const p10 = grid[i + 1][j]
      const p11 = grid[i + 1][(j + 1) % ring]
      soup.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01)
    }
  }
  const mesh = cleanTriangles(weld(Float32Array.from(soup), 0.01))
  return signedVolume(mesh) < 0 ? flipWinding(mesh) : mesh
}

const minZ = (p) => {
  let m = Infinity
  for (let i = 2; i < p.length; i += 3) m = Math.min(m, p[i])
  return m
}

const maxZ = (p) => {
  let m = -Infinity
  for (let i = 2; i < p.length; i += 3) m = Math.max(m, p[i])
  return m
}

/** Centre and outer radius of the trachea's cross-section at height z (from a 6 mm slab). */
function tracheaAxis(p) {
  const cache = new Map()
  const bottom = minZ(p) + 3
  const top = maxZ(p) - 3
  return (z) => {
    const key = Math.round(Math.min(top, Math.max(bottom, z)))
    if (cache.has(key)) return cache.get(key)
    let n = 0
    let sx = 0
    let sy = 0
    for (let i = 0; i < p.length; i += 3) {
      if (Math.abs(p[i + 2] - key) > 3) continue
      n++
      sx += p[i]
      sy += p[i + 1]
    }
    const cx = sx / n
    const cy = sy / n
    let r = 0
    for (let i = 0; i < p.length; i += 3) if (Math.abs(p[i + 2] - key) <= 3) r = Math.max(r, Math.hypot(p[i] - cx, p[i + 1] - cy))
    const out = { cx, cy, r }
    cache.set(key, out)
    return out
  }
}
