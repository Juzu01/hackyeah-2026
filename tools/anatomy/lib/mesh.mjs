// Indexed triangle meshes: { positions: Float32Array (xyz per vertex), indices: Uint32Array }.

/** Merges coincident corners of a triangle soup into shared vertices (within `tolerance`). */
export function weld(soup, tolerance) {
  const corners = soup.length / 3
  const inv = 1 / tolerance
  const tol2 = tolerance * tolerance
  // Cell keys pack three 17-bit grid coordinates into one exact double (±6.5 m at 0.05 mm).
  const OFF = 65536
  const key = (ix, iy, iz) => ((ix + OFF) * 131072 + (iy + OFF)) * 131072 + (iz + OFF)
  const cellHead = new Map()
  const nextInCell = new Int32Array(corners)
  const positions = new Float32Array(soup.length)
  const indices = new Uint32Array(corners)
  let count = 0

  const findIn = (k, x, y, z) => {
    for (let v = cellHead.get(k) ?? -1; v !== -1; v = nextInCell[v]) {
      const dx = positions[v * 3] - x
      const dy = positions[v * 3 + 1] - y
      const dz = positions[v * 3 + 2] - z
      if (dx * dx + dy * dy + dz * dz <= tol2) return v
    }
    return -1
  }

  for (let c = 0; c < corners; c++) {
    const x = soup[c * 3]
    const y = soup[c * 3 + 1]
    const z = soup[c * 3 + 2]
    const ix = Math.floor(x * inv)
    const iy = Math.floor(y * inv)
    const iz = Math.floor(z * inv)
    const own = key(ix, iy, iz)
    let v = findIn(own, x, y, z)
    for (let dx = -1; v === -1 && dx <= 1; dx++)
      for (let dy = -1; v === -1 && dy <= 1; dy++)
        for (let dz = -1; v === -1 && dz <= 1; dz++)
          if (dx || dy || dz) v = findIn(key(ix + dx, iy + dy, iz + dz), x, y, z)
    if (v === -1) {
      v = count++
      positions[v * 3] = x
      positions[v * 3 + 1] = y
      positions[v * 3 + 2] = z
      nextInCell[v] = cellHead.get(own) ?? -1
      cellHead.set(own, v)
    }
    indices[c] = v
  }
  return { positions: positions.slice(0, count * 3), indices }
}

/**
 * Drops collapsed and zero-area triangles and repeated copies of a triangle. A triangle that also
 * appears with the opposite winding is a wall shared by two touching primitives; both copies go, so
 * the union stays a clean closed surface.
 */
export function cleanTriangles({ positions, indices }, minArea = 1e-9) {
  const firstSeen = new Map() // sorted corner key → { t, parity, opposed }
  const keep = []
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]
    const b = indices[t + 1]
    const c = indices[t + 2]
    if (a === b || b === c || a === c) continue
    if (triangleArea(positions, a, b, c) < minArea) continue
    // The cyclic order (a,b,c) is even or odd relative to the sorted corners: that is the winding.
    const sorted = [a, b, c].sort((p, q) => p - q)
    const parity = cyclicIndex(sorted, a, b)
    const key = `${sorted[0]},${sorted[1]},${sorted[2]}`
    const prev = firstSeen.get(key)
    if (!prev) {
      firstSeen.set(key, { slot: keep.length, parity })
      keep.push(t)
    } else if (prev.parity !== parity && prev.slot !== -1) {
      keep[prev.slot] = -1
      prev.slot = -1
    }
  }
  const out = []
  for (const t of keep) if (t !== -1) out.push(indices[t], indices[t + 1], indices[t + 2])
  return { positions, indices: Uint32Array.from(out) }
}

/** 0 when (a, b) follows the sorted cyclic order of the triangle's corners, 1 when it is reversed. */
function cyclicIndex(sorted, a, b) {
  const i = sorted.indexOf(a)
  return sorted[(i + 1) % 3] === b ? 0 : 1
}

export function triangleArea(p, a, b, c) {
  const ux = p[b * 3] - p[a * 3]
  const uy = p[b * 3 + 1] - p[a * 3 + 1]
  const uz = p[b * 3 + 2] - p[a * 3 + 2]
  const vx = p[c * 3] - p[a * 3]
  const vy = p[c * 3 + 1] - p[a * 3 + 1]
  const vz = p[c * 3 + 2] - p[a * 3 + 2]
  const cx = uy * vz - uz * vy
  const cy = uz * vx - ux * vz
  const cz = ux * vy - uy * vx
  return 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz)
}

/** Volume enclosed by the surface; negative when the triangles wind inwards. */
export function signedVolume({ positions: p, indices }) {
  let v = 0
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3
    const b = indices[t + 1] * 3
    const c = indices[t + 2] * 3
    v +=
      p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) -
      p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) +
      p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])
  }
  return v / 6
}

export function flipWinding({ positions, indices }) {
  const out = indices.slice()
  for (let t = 0; t < out.length; t += 3) {
    out[t + 1] = indices[t + 2]
    out[t + 2] = indices[t + 1]
  }
  return { positions, indices: out }
}

/** Concatenates meshes without welding them together. */
export function mergeMeshes(meshes) {
  const vertexCount = meshes.reduce((s, m) => s + m.positions.length / 3, 0)
  const indexCount = meshes.reduce((s, m) => s + m.indices.length, 0)
  const positions = new Float32Array(vertexCount * 3)
  const indices = new Uint32Array(indexCount)
  let v = 0
  let i = 0
  for (const m of meshes) {
    positions.set(m.positions, v * 3)
    for (let k = 0; k < m.indices.length; k++) indices[i + k] = m.indices[k] + v
    v += m.positions.length / 3
    i += m.indices.length
  }
  return { positions, indices }
}

/** Keeps only the triangles for which `keep(t)` is true (t = triangle number), then compacts. */
export function filterTriangles(mesh, keep) {
  const out = []
  for (let t = 0; t < mesh.indices.length / 3; t++) if (keep(t)) out.push(t)
  const indices = new Uint32Array(out.length * 3)
  out.forEach((t, k) => indices.set(mesh.indices.subarray(t * 3, t * 3 + 3), k * 3))
  return compact({ positions: mesh.positions, indices })
}

/** Removes vertices that no triangle references. */
export function compact({ positions, indices }) {
  const remap = new Int32Array(positions.length / 3).fill(-1)
  let n = 0
  const out = new Uint32Array(indices.length)
  for (let k = 0; k < indices.length; k++) {
    const v = indices[k]
    if (remap[v] === -1) remap[v] = n++
    out[k] = remap[v]
  }
  const pos = new Float32Array(n * 3)
  for (let v = 0; v < remap.length; v++) {
    if (remap[v] === -1) continue
    pos.set(positions.subarray(v * 3, v * 3 + 3), remap[v] * 3)
  }
  return { positions: pos, indices: out }
}

/** Connected components over shared vertices: a component label per triangle. */
export function triangleComponents({ positions, indices }) {
  const parent = new Int32Array(positions.length / 3)
  for (let i = 0; i < parent.length; i++) parent[i] = i
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]]
    return x
  }
  for (let t = 0; t < indices.length; t += 3) {
    const a = find(indices[t])
    const b = find(indices[t + 1])
    const c = find(indices[t + 2])
    parent[b] = a
    parent[c] = a
  }
  const labelOfRoot = new Map()
  const labels = new Int32Array(indices.length / 3)
  for (let t = 0; t < labels.length; t++) {
    const r = find(indices[t * 3])
    if (!labelOfRoot.has(r)) labelOfRoot.set(r, labelOfRoot.size)
    labels[t] = labelOfRoot.get(r)
  }
  return { labels, count: labelOfRoot.size }
}

/**
 * Normals with hard edges. An edge whose faces meet at more than `creaseDeg` is a crease; around each
 * vertex, faces joined by non-crease edges form a smoothing group that shares one angle-weighted
 * normal, and each group gets its own copy of the vertex. Smooth surfaces stay smooth (and welded)
 * while cut ends (capped vessels, bronchi) read as clean sections.
 */
export function creasedNormals({ positions: p, indices }, creaseDeg = 60) {
  const triCount = indices.length / 3
  const faceNormal = new Float32Array(triCount * 3)
  const cornerAngle = new Float32Array(indices.length)
  for (let t = 0; t < triCount; t++) {
    const [a, b, c] = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]]
    const n = cross3(sub3(p, b, a), sub3(p, c, a))
    const len = Math.hypot(n[0], n[1], n[2]) || 1
    faceNormal.set([n[0] / len, n[1] / len, n[2] / len], t * 3)
    for (let k = 0; k < 3; k++) {
      const v = indices[t * 3 + k]
      const u1 = sub3(p, indices[t * 3 + ((k + 1) % 3)], v)
      const u2 = sub3(p, indices[t * 3 + ((k + 2) % 3)], v)
      const l = Math.hypot(...u1) * Math.hypot(...u2)
      cornerAngle[t * 3 + k] = l > 0 ? Math.acos(Math.max(-1, Math.min(1, (u1[0] * u2[0] + u1[1] * u2[1] + u1[2] * u2[2]) / l))) : 0
    }
  }
  // Corners grouped by vertex.
  const vertexCount = p.length / 3
  const first = new Uint32Array(vertexCount + 1)
  for (const v of indices) first[v + 1]++
  for (let v = 0; v < vertexCount; v++) first[v + 1] += first[v]
  const fill = first.slice(0, vertexCount)
  const corners = new Uint32Array(indices.length)
  for (let c = 0; c < indices.length; c++) corners[fill[indices[c]]++] = c

  const cosCrease = Math.cos((creaseDeg * Math.PI) / 180)
  const smooth = (f, g) =>
    faceNormal[f * 3] * faceNormal[g * 3] + faceNormal[f * 3 + 1] * faceNormal[g * 3 + 1] + faceNormal[f * 3 + 2] * faceNormal[g * 3 + 2] >= cosCrease
  const outPositions = []
  const outNormals = []
  const outIndices = new Uint32Array(indices.length)
  for (let v = 0; v < vertexCount; v++) {
    const fan = corners.subarray(first[v], first[v + 1])
    if (!fan.length) continue
    // Union faces of the fan that share an edge (v, w) which is not a crease.
    const group = Array.from(fan, (_, i) => i)
    const root = (i) => (group[i] === i ? i : (group[i] = root(group[i])))
    const others = Array.from(fan, (c) => {
      const t = c - (c % 3)
      return [indices[t + ((c + 1) % 3)], indices[t + ((c + 2) % 3)]]
    })
    for (let i = 0; i < fan.length; i++) {
      for (let j = i + 1; j < fan.length; j++) {
        const shared = others[i].some((w) => others[j].includes(w))
        if (shared && smooth(Math.floor(fan[i] / 3), Math.floor(fan[j] / 3))) group[root(i)] = root(j)
      }
    }
    const vertexOf = new Map()
    for (let i = 0; i < fan.length; i++) {
      const r = root(i)
      if (!vertexOf.has(r)) {
        const n = [0, 0, 0]
        for (let j = 0; j < fan.length; j++) {
          if (root(j) !== r) continue
          const t = Math.floor(fan[j] / 3)
          for (let k = 0; k < 3; k++) n[k] += faceNormal[t * 3 + k] * cornerAngle[fan[j]]
        }
        const len = Math.hypot(n[0], n[1], n[2]) || 1
        vertexOf.set(r, outPositions.length / 3)
        outPositions.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2])
        outNormals.push(n[0] / len, n[1] / len, n[2] / len)
      }
      outIndices[fan[i]] = vertexOf.get(r)
    }
  }
  return { positions: Float32Array.from(outPositions), normals: Float32Array.from(outNormals), indices: outIndices }
}

const sub3 = (p, a, b) => [p[a * 3] - p[b * 3], p[a * 3 + 1] - p[b * 3 + 1], p[a * 3 + 2] - p[b * 3 + 2]]
const cross3 = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]

export function bounds(positions) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = positions[i + k]
      if (v < min[k]) min[k] = v
      if (v > max[k]) max[k] = v
    }
  }
  return { min, max }
}

/** Area-weighted centroid of the surface (robust to uneven tessellation). */
export function surfaceCentroid({ positions: p, indices }) {
  const sum = [0, 0, 0]
  let total = 0
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]
    const b = indices[t + 1]
    const c = indices[t + 2]
    const area = triangleArea(p, a, b, c)
    total += area
    for (let k = 0; k < 3; k++) sum[k] += (area * (p[a * 3 + k] + p[b * 3 + k] + p[c * 3 + k])) / 3
  }
  return total > 0 ? sum.map((s) => s / total) : [0, 0, 0]
}

/** Applies `fn(x, y, z) → [x', y', z']` to every vertex; the caller keeps it a proper rotation. */
export function mapPositions({ positions, indices }, fn) {
  const out = new Float32Array(positions.length)
  for (let i = 0; i < positions.length; i += 3) out.set(fn(positions[i], positions[i + 1], positions[i + 2]), i)
  return { positions: out, indices }
}

/** Re-welds a mesh as a soup, e.g. to join primitives that share boundary vertices. */
export function toSoup({ positions, indices }) {
  const soup = new Float32Array(indices.length * 3)
  for (let k = 0; k < indices.length; k++) soup.set(positions.subarray(indices[k] * 3, indices[k] * 3 + 3), k * 3)
  return soup
}

/** Closed loops of boundary half-edges, each as an ordered vertex list following the winding. */
export function boundaryLoops({ indices }) {
  const count = new Map()
  const key = (a, b) => `${a},${b}`
  for (let t = 0; t < indices.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = indices[t + k]
      const b = indices[t + ((k + 1) % 3)]
      count.set(key(a, b), (count.get(key(a, b)) ?? 0) + 1)
    }
  }
  const next = new Map()
  for (const [k] of count) {
    const [a, b] = k.split(',').map(Number)
    if (!count.has(key(b, a))) next.set(a, b)
  }
  const loops = []
  while (next.size) {
    const [start] = next.keys()
    const loop = []
    let v = start
    while (next.has(v)) {
      loop.push(v)
      const n = next.get(v)
      next.delete(v)
      v = n
    }
    if (v === start && loop.length >= 3) loops.push(loop)
  }
  return loops
}

/** Closes each boundary loop with a fan around its centroid, wound to match the surface. */
export function capLoops(mesh, loops) {
  const extra = loops.length
  const positions = new Float32Array(mesh.positions.length + extra * 3)
  positions.set(mesh.positions)
  const capIndices = []
  let v = mesh.positions.length / 3
  for (const loop of loops) {
    const c = [0, 0, 0]
    for (const i of loop) for (let k = 0; k < 3; k++) c[k] += mesh.positions[i * 3 + k] / loop.length
    positions.set(c, v * 3)
    // The loop follows the surface's half-edges, so the cap walks it backwards.
    for (let i = 0; i < loop.length; i++) capIndices.push(loop[(i + 1) % loop.length], loop[i], v)
    v++
  }
  const indices = new Uint32Array(mesh.indices.length + capIndices.length)
  indices.set(mesh.indices)
  indices.set(capIndices, mesh.indices.length)
  return { positions, indices }
}
