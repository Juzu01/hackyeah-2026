// A neutral crotch for the skin: BodyParts3D's skin is a man's, with the penis and scrotum. The atlas
// shows no genitals on either body, so they are cut out and the opening is closed with a smooth
// membrane spanning the pubic area, the groin creases and the perineum, like a textbook figure.
//
// Atlas frame: metres, +Y up with the soles at 0, +X = the patient's left, +Z = anterior.

import { boundaryLoops, filterTriangles, triangleComponents } from './mesh.mjs'

/**
 * The genitals' region: in the midline (|x| < half width), between the bottom of the crotch and the
 * pubic skin, in front of the line from the pubic skin down to the front of the crotch. Skin closer
 * than `minTissue` to a catalog part (the thighs' adductors, the pubic fat over the symphysis) stays.
 */
const REGION = { halfWidth: 0.042, bottom: 0.688, top: 0.826, pubis: [0.826, 0.072], crotch: [0.688, -0.01], minTissue: 0.011 }
const RINGS = 8
const SMOOTH_STEPS = 300
const BLEND_BAND = 0.026 // metres of the surrounding skin that eases into the membrane

/**
 * skin: { positions (m), indices }; distanceToTissue(x, y, z) → metres to the nearest non-skin part.
 * Returns the skin without the genitals, closed, plus what was done.
 */
export function neutralCrotch(skin, distanceToTissue) {
  const p = skin.positions
  const n = p.length / 3
  const { halfWidth, bottom, top, pubis, crotch, minTissue } = REGION
  const behind = (y) => crotch[1] + ((y - crotch[0]) / (pubis[0] - crotch[0])) * (pubis[1] - crotch[1])
  const candidate = new Uint8Array(n)
  for (let v = 0; v < n; v++) {
    const [x, y, z] = [p[v * 3], p[v * 3 + 1], p[v * 3 + 2]]
    if (Math.abs(x) < halfWidth && y > bottom && y < top && z > behind(y) && distanceToTissue(x, y, z) > minTissue) candidate[v] = 1
  }

  // Keep the one connected piece that holds the furthest-forward candidate (the tip of the penis).
  const neighbours = vertexNeighbours(skin.indices, n)
  let seed = -1
  for (let v = 0; v < n; v++) if (candidate[v] && (seed < 0 || p[v * 3 + 2] > p[seed * 3 + 2])) seed = v
  if (seed < 0) return { mesh: skin, removed: 0, loops: 0 }
  const cut = new Uint8Array(n)
  const queue = [seed]
  cut[seed] = 1
  while (queue.length) {
    const v = queue.pop()
    for (const w of neighbours[v]) {
      if (candidate[w] && !cut[w]) {
        cut[w] = 1
        queue.push(w)
      }
    }
  }

  // Close the selection (grow two rings, shrink two) so its edge runs smoothly instead of zigzagging.
  const near = (v) => Math.abs(p[v * 3]) < 0.07 && p[v * 3 + 1] > bottom - 0.02 && p[v * 3 + 1] < top + 0.01
  for (let r = 0; r < 2; r++) grow(cut, neighbours, near)
  for (let r = 0; r < 2; r++) shrink(cut, neighbours)

  // Cut, then keep cutting where the opening's edge touches itself (a vertex with two ways out), so
  // every opening is one simple loop; then keep the one big piece of skin.
  const before = skin.indices.length / 3
  let kept
  for (let pass = 0; ; pass++) {
    kept = filterTriangles(skin, (t) => !cut[skin.indices[t * 3]] && !cut[skin.indices[t * 3 + 1]] && !cut[skin.indices[t * 3 + 2]])
    const pinched = pinchedVertices(skin, cut)
    if (!pinched.length || pass > 20) break
    for (const v of pinched) cut[v] = 1
  }
  const { labels } = triangleComponents(kept)
  const sizes = new Map()
  for (const l of labels) sizes.set(l, (sizes.get(l) ?? 0) + 1)
  const biggest = [...sizes].sort((a, b) => b[1] - a[1])[0][0]
  kept = filterTriangles(kept, (tri) => labels[tri] === biggest)
  const removed = before - kept.indices.length / 3

  // Close every opening left around the crotch (the cut, and BodyParts3D's own small ones there).
  const loops = boundaryLoops(kept).filter((loop) => {
    const c = centroid(kept.positions, loop)
    return Math.abs(c[0]) < 0.08 && c[1] > 0.64 && c[1] < 0.88
  })
  const closed = capWithMembrane(kept, loops)
  return { mesh: closed, removed, loops: loops.map((l) => l.length) }
}

function grow(set, neighbours, allowed) {
  const add = []
  set.forEach((on, v) => {
    if (!on) return
    for (const w of neighbours[v]) if (!set[w] && allowed(w)) add.push(w)
  })
  for (const v of add) set[v] = 1
}

function shrink(set, neighbours) {
  const drop = []
  set.forEach((on, v) => {
    if (on && neighbours[v].some((w) => !set[w])) drop.push(v)
  })
  for (const v of drop) set[v] = 0
}

/** Kept vertices on the cut's edge with more than one outgoing boundary edge (the edge touches itself there). */
function pinchedVertices(mesh, cut) {
  const { indices } = mesh
  const alive = (t) => !cut[indices[t * 3]] && !cut[indices[t * 3 + 1]] && !cut[indices[t * 3 + 2]]
  const half = new Map()
  for (let t = 0; t < indices.length / 3; t++) {
    if (!alive(t)) continue
    for (let k = 0; k < 3; k++) {
      const a = indices[t * 3 + k]
      const b = indices[t * 3 + ((k + 1) % 3)]
      half.set(`${a},${b}`, a)
    }
  }
  const out = new Map()
  for (const [key, a] of half) {
    const b = key.slice(key.indexOf(',') + 1)
    if (!half.has(`${b},${a}`)) out.set(a, (out.get(a) ?? 0) + 1)
  }
  return [...out].filter(([, n]) => n > 1).map(([v]) => v)
}

/** Each loop gets RINGS concentric rings towards its centre, then relaxes into a smooth membrane. */
function capWithMembrane(mesh, loops) {
  const positions = Array.from(mesh.positions)
  const indices = Array.from(mesh.indices)
  const membrane = new Set()
  const rims = new Set()
  for (const loop of loops) {
    const c = centroid(mesh.positions, loop)
    let outer = loop
    for (let k = 1; k <= RINGS; k++) {
      const t = k / RINGS
      let inner
      if (k === RINGS) {
        const v = positions.length / 3
        positions.push(...c)
        membrane.add(v)
        inner = loop.map(() => v)
      } else {
        inner = loop.map((b) => {
          const v = positions.length / 3
          for (let a = 0; a < 3; a++) positions.push(mesh.positions[b * 3 + a] * (1 - t) + c[a] * t)
          membrane.add(v)
          return v
        })
      }
      // The loop follows the surface's half-edges, so the membrane walks it backwards.
      for (let i = 0; i < loop.length; i++) {
        const j = (i + 1) % loop.length
        indices.push(outer[j], outer[i], inner[i])
        if (inner[i] !== inner[j]) indices.push(outer[j], inner[i], inner[j])
      }
      outer = inner
    }
    for (const b of loop) rims.add(b)
  }
  const out = { positions: Float32Array.from(positions), indices: Uint32Array.from(indices) }
  const count = out.positions.length / 3
  const neighbours = vertexNeighbours(out.indices, count)

  // Relax the membrane with its rim held, then let a narrow band of the skin around it ease in.
  relax(out.positions, neighbours, [...membrane], SMOOTH_STEPS)
  const rimPoints = [...rims].map((v) => [out.positions[v * 3], out.positions[v * 3 + 1], out.positions[v * 3 + 2]])
  const band = []
  for (let v = 0; v < mesh.positions.length / 3; v++) {
    const [x, y, z] = [out.positions[v * 3], out.positions[v * 3 + 1], out.positions[v * 3 + 2]]
    if (Math.abs(x) > 0.12 || y < 0.6 || y > 0.92) continue
    if (rimPoints.some((r) => Math.hypot(r[0] - x, r[1] - y, r[2] - z) < BLEND_BAND)) band.push(v)
  }
  relax(out.positions, neighbours, [...band, ...membrane], 30)
  return out
}

function relax(positions, neighbours, moving, steps) {
  const next = new Float32Array(moving.length * 3)
  for (let s = 0; s < steps; s++) {
    moving.forEach((v, i) => {
      const ns = neighbours[v]
      let [x, y, z] = [0, 0, 0]
      for (const w of ns) {
        x += positions[w * 3]
        y += positions[w * 3 + 1]
        z += positions[w * 3 + 2]
      }
      next.set([x / ns.length, y / ns.length, z / ns.length], i * 3)
    })
    moving.forEach((v, i) => positions.set(next.subarray(i * 3, i * 3 + 3), v * 3))
  }
}

function vertexNeighbours(indices, count) {
  const sets = Array.from({ length: count }, () => new Set())
  for (let t = 0; t < indices.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = indices[t + k]
      const b = indices[t + ((k + 1) % 3)]
      sets[a].add(b)
      sets[b].add(a)
    }
  }
  return sets.map((s) => [...s])
}

function centroid(positions, loop) {
  const c = [0, 0, 0]
  for (const v of loop) for (let a = 0; a < 3; a++) c[a] += positions[v * 3 + a] / loop.length
  return c
}
