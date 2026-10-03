// Outer-surface extraction, made for the BodyParts3D skin and reused for organs with hidden insides.
//
// FMA7163 "skin" is the body volume minus everything inside it: one connected surface that holds the
// outer skin plus inner sheets (the subcutaneous boundary and the outlines of muscles, bones and
// organs). Rendered as a fresnel glass shell, every inner sheet would show up as a ghostly rim. So we
// keep only what can be seen from outside: each triangle is tested with orthographic z-buffer renders
// (triangle ids, front faces only) from directions spread evenly over the sphere. Creases that no view
// reaches (between fingers, deep folds) leave small unseen islands surrounded by seen triangles; those
// are filled back in by area, while the inner sheets are huge and stay out.
//
// The heart (chambers, valves, papillary muscles), the brain (ventricles, deep nuclei) and the lungs
// (the fissure walls between lobes) have the same problem on a smaller scale: hidden surfaces would eat
// the triangle budget and show through the ghost (x-ray) material. There, `grow` also keeps hidden
// triangles within a few millimetres (along the surface) of a seen one: the narrow crevices under the
// coronary vessels. Left open, those slits widen into visible cracks once the mesh is simplified;
// the chamber walls connect to the outside only through the vessel openings, so they stay out.
import { filterTriangles, triangleArea, triangleComponents } from './mesh.mjs'

/**
 * The visible outer surface of `mesh`. `keep: 'largest'` keeps only the biggest connected piece (the
 * skin, where seen specks of inner sheets peek through openings); `'seen'` keeps every piece that at
 * least one view saw, dropping fully hidden ones (valves, deep nuclei).
 */
export function outerSurface(mesh, { keep = 'seen', ...options } = {}) {
  const { mask, seen } = outerSurfaceMask(mesh, options)
  const outer = filterTriangles(mesh, (t) => mask[t])
  const outerSeen = Uint8Array.from(seen.filter((_, t) => mask[t]))
  const { labels, count } = triangleComponents(outer)
  const size = new Array(count).fill(0)
  const wasSeen = new Uint8Array(count)
  for (let t = 0; t < labels.length; t++) {
    size[labels[t]]++
    if (outerSeen[t]) wasSeen[labels[t]] = 1
  }
  const largest = size.indexOf(Math.max(...size))
  return filterTriangles(outer, (t) => (keep === 'largest' ? labels[t] === largest : wasSeen[labels[t]] === 1))
}

export function outerSurfaceMask(mesh, { directions = 160, pixelSize = 0.5, maxHoleArea = 400, grow = 0 } = {}) {
  const seen = new Uint8Array(mesh.indices.length / 3)
  for (const d of sphereDirections(directions)) markVisible(mesh, d, pixelSize, seen)
  const neighbours = triangleNeighbours(mesh.indices)
  const grown = grow > 0 ? growAlongSurface(mesh, seen, neighbours, grow) : seen
  return { mask: fillSmallHoles(mesh, grown, neighbours, maxHoleArea), seen }
}

/** Evenly spread unit vectors (Fibonacci sphere). */
function sphereDirections(n) {
  const golden = Math.PI * (3 - Math.sqrt(5))
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    return [Math.cos(golden * i) * r, y, Math.sin(golden * i) * r]
  })
}

/** Orthographic render looking along -d; marks the front-facing triangle that wins each pixel. */
function markVisible({ positions: p, indices }, d, pixelSize, seen) {
  // Right-handed basis (u, v, d): a triangle faces the viewer when its projected area is positive.
  const helper = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  const u = normalize(cross(helper, d))
  const v = cross(d, u)
  const n = p.length / 3
  const px = new Float32Array(n)
  const py = new Float32Array(n)
  const pz = new Float32Array(n)
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < n; i++) {
    const x = p[i * 3]
    const y = p[i * 3 + 1]
    const z = p[i * 3 + 2]
    px[i] = (x * u[0] + y * u[1] + z * u[2]) / pixelSize
    py[i] = (x * v[0] + y * v[1] + z * v[2]) / pixelSize
    pz[i] = x * d[0] + y * d[1] + z * d[2]
    if (px[i] < minX) minX = px[i]
    if (px[i] > maxX) maxX = px[i]
    if (py[i] < minY) minY = py[i]
    if (py[i] > maxY) maxY = py[i]
  }
  const W = Math.ceil(maxX - minX) + 2
  const H = Math.ceil(maxY - minY) + 2
  const depth = new Float32Array(W * H).fill(-Infinity)
  const winner = new Int32Array(W * H).fill(-1)
  for (let i = 0; i < n; i++) {
    px[i] -= minX
    py[i] -= minY
  }

  const triCount = indices.length / 3
  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3]
    const b = indices[t * 3 + 1]
    const c = indices[t * 3 + 2]
    const ax = px[a], ay = py[a], bx = px[b], by = py[b], cx = px[c], cy = py[c]
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    if (area === 0) continue
    const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5))
    const x1 = Math.min(W - 1, Math.floor(Math.max(ax, bx, cx) - 0.5))
    const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5))
    const y1 = Math.min(H - 1, Math.floor(Math.max(ay, by, cy) - 0.5))
    const inv = 1 / area
    // Back faces still occlude; they are recorded as -2 so they never count as seen.
    const id = area > 0 ? t : -2
    for (let y = y0; y <= y1; y++) {
      const sy = y + 0.5
      for (let x = x0; x <= x1; x++) {
        const sx = x + 0.5
        const w0 = ((bx - sx) * (cy - sy) - (by - sy) * (cx - sx)) * inv
        const w1 = ((cx - sx) * (ay - sy) - (cy - sy) * (ax - sx)) * inv
        const w2 = 1 - w0 - w1
        if (w0 < 0 || w1 < 0 || w2 < 0) continue
        const z = w0 * pz[a] + w1 * pz[b] + w2 * pz[c]
        const k = y * W + x
        if (z > depth[k]) {
          depth[k] = z
          winner[k] = id
        }
      }
    }
  }
  for (let k = 0; k < winner.length; k++) if (winner[k] >= 0) seen[winner[k]] = 1
}

/** Triangles sharing an edge with triangle t: neighbours.list[neighbours.start[t] .. start[t + 1]). */
function triangleNeighbours(indices) {
  const triCount = indices.length / 3
  const edgeTris = new Map()
  const edgeKey = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a)
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) {
      const key = edgeKey(indices[t * 3 + k], indices[t * 3 + ((k + 1) % 3)])
      const list = edgeTris.get(key)
      if (list) list.push(t)
      else edgeTris.set(key, [t])
    }
  }
  const lists = Array.from({ length: triCount }, () => [])
  for (const tris of edgeTris.values()) for (const a of tris) for (const b of tris) if (a !== b) lists[a].push(b)
  const start = new Uint32Array(triCount + 1)
  for (let t = 0; t < triCount; t++) start[t + 1] = start[t] + lists[t].length
  const list = new Uint32Array(start[triCount])
  for (let t = 0; t < triCount; t++) list.set(lists[t], start[t])
  return { start, list }
}

/**
 * Marks every triangle within `maxDistance` mm of a seen one, measured centroid to centroid across
 * shared edges (a bucketed Dijkstra; 0.1 mm buckets are plenty at this scale).
 */
function growAlongSurface({ positions: p, indices }, seen, { start, list }, maxDistance) {
  const triCount = indices.length / 3
  const centroid = new Float32Array(triCount * 3)
  for (let t = 0; t < triCount; t++)
    for (let k = 0; k < 3; k++) centroid[t * 3 + k] = (p[indices[t * 3] * 3 + k] + p[indices[t * 3 + 1] * 3 + k] + p[indices[t * 3 + 2] * 3 + k]) / 3
  const step = 0.1
  const dist = new Float32Array(triCount).fill(Infinity)
  const buckets = Array.from({ length: Math.ceil(maxDistance / step) + 1 }, () => [])
  for (let t = 0; t < triCount; t++) {
    if (!seen[t]) continue
    dist[t] = 0
    buckets[0].push(t)
  }
  for (let b = 0; b < buckets.length; b++) {
    for (const t of buckets[b]) {
      if (dist[t] > (b + 1) * step) continue // a stale entry
      for (let i = start[t]; i < start[t + 1]; i++) {
        const o = list[i]
        const d = dist[t] + Math.hypot(centroid[o * 3] - centroid[t * 3], centroid[o * 3 + 1] - centroid[t * 3 + 1], centroid[o * 3 + 2] - centroid[t * 3 + 2])
        if (d >= dist[o] || d > maxDistance) continue
        dist[o] = d
        buckets[Math.floor(d / step)].push(o)
      }
    }
  }
  return Uint8Array.from(dist, (d) => (d <= maxDistance ? 1 : 0))
}

/** Marks unseen edge-connected islands smaller than `maxArea` (mm²) as kept. */
function fillSmallHoles({ positions, indices }, seen, { start, list }, maxArea) {
  const triCount = indices.length / 3
  const kept = seen.slice()
  const visited = new Uint8Array(triCount)
  for (let seed = 0; seed < triCount; seed++) {
    if (seen[seed] || visited[seed]) continue
    const island = [seed]
    visited[seed] = 1
    let area = 0
    for (let i = 0; i < island.length; i++) {
      const t = island[i]
      area += triangleArea(positions, indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2])
      for (let i = start[t]; i < start[t + 1]; i++) {
        const o = list[i]
        if (!seen[o] && !visited[o]) {
          visited[o] = 1
          island.push(o)
        }
      }
    }
    if (area <= maxArea) for (const t of island) kept[t] = 1
  }
  return kept
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const normalize = (a) => {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}
