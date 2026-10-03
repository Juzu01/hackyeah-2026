// Frontal footprints: what a part covers seen from the front (+Z), as a coarse
// occupancy grid in the XY plane with the front and back surface depth of each
// cell. Feeds the explode solver (convex pieces), the label anchor (a point that
// is guaranteed to lie on the part) and the skeleton's depth map.

import { Vector3, type Mesh } from 'three'
import { convexHull, polygonArea, type BBox, type Pt } from './explode.ts'

export interface Grid {
  /** World position of the lower-left corner of cell (0, 0). */
  x0: number
  y0: number
  cell: number
  nx: number
  ny: number
}

export interface Footprint extends Grid {
  mask: Uint8Array
  /** Largest z per cell (the surface facing the viewer); -Infinity where empty. */
  zFront: Float32Array
  /** Smallest z per cell; +Infinity where empty. */
  zBack: Float32Array
  count: number
}

const v = new Vector3()

/**
 * A grid over `box` with an empty margin, so every covered cell has neighbours.
 * Two cells, not one: rounding can drop a vertex on the box edge into the first.
 */
export function gridAround(box: BBox, cell: number): Grid {
  return {
    x0: box.minX - 2 * cell,
    y0: box.minY - 2 * cell,
    cell,
    nx: Math.ceil((box.maxX - box.minX) / cell) + 5,
    ny: Math.ceil((box.maxY - box.minY) / cell) + 5,
  }
}

export function worldBBox(meshes: readonly Mesh[]): BBox {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute('position')
    mesh.updateWorldMatrix(true, false)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
      if (v.x < box.minX) box.minX = v.x
      if (v.y < box.minY) box.minY = v.y
      if (v.x > box.maxX) box.maxX = v.x
      if (v.y > box.maxY) box.maxY = v.y
    }
  }
  return box
}

/** Rasterizes the meshes' triangles, projected along Z, into `grid`. */
export function rasterize(meshes: readonly Mesh[], grid: Grid): Footprint {
  const { x0, y0, cell, nx, ny } = grid
  const mask = new Uint8Array(nx * ny)
  const zFront = new Float32Array(nx * ny).fill(-Infinity)
  const zBack = new Float32Array(nx * ny).fill(Infinity)
  const mark = (i: number, j: number, z: number) => {
    if (i < 0 || j < 0 || i >= nx || j >= ny) return
    const k = j * nx + i
    mask[k] = 1
    if (z > zFront[k]) zFront[k] = z
    if (z < zBack[k]) zBack[k] = z
  }

  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute('position')
    const w = new Float32Array(pos.count * 3)
    mesh.updateWorldMatrix(true, false)
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
      w[3 * i] = v.x
      w[3 * i + 1] = v.y
      w[3 * i + 2] = v.z
      // Vertices mark their own cell too, so slivers thinner than a cell still count.
      mark(Math.floor((v.x - x0) / cell), Math.floor((v.y - y0) / cell), v.z)
    }
    const index = mesh.geometry.getIndex()?.array
    const tris = (index ? index.length : pos.count) / 3
    for (let t = 0; t < tris; t++) {
      const a = 3 * (index ? index[3 * t] : 3 * t)
      const b = 3 * (index ? index[3 * t + 1] : 3 * t + 1)
      const c = 3 * (index ? index[3 * t + 2] : 3 * t + 2)
      const ax = w[a], ay = w[a + 1], az = w[a + 2]
      const bx = w[b], by = w[b + 1], bz = w[b + 2]
      const cx = w[c], cy = w[c + 1], cz = w[c + 2]
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
      if (Math.abs(area) < 1e-12) continue
      // Cells whose centres fall inside the triangle's bounding box.
      const i0 = Math.ceil((Math.min(ax, bx, cx) - x0) / cell - 0.5)
      const i1 = Math.floor((Math.max(ax, bx, cx) - x0) / cell - 0.5)
      const j0 = Math.ceil((Math.min(ay, by, cy) - y0) / cell - 0.5)
      const j1 = Math.floor((Math.max(ay, by, cy) - y0) / cell - 0.5)
      const inv = 1 / area
      for (let j = j0; j <= j1; j++) {
        const py = y0 + (j + 0.5) * cell
        for (let i = i0; i <= i1; i++) {
          const px = x0 + (i + 0.5) * cell
          const wa = ((bx - px) * (cy - py) - (by - py) * (cx - px)) * inv
          const wb = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) * inv
          const wc = 1 - wa - wb
          if (wa < -1e-9 || wb < -1e-9 || wc < -1e-9) continue
          mark(i, j, wa * az + wb * bz + wc * cz)
        }
      }
    }
  }
  let count = 0
  for (let k = 0; k < mask.length; k++) count += mask[k]
  return { ...grid, mask, zFront, zBack, count }
}

/** Footprint on a grid fitted to the meshes, fine enough for small parts. */
export function footprintOf(meshes: readonly Mesh[]): Footprint {
  const box = worldBBox(meshes)
  const extent = Math.max(box.maxX - box.minX, box.maxY - box.minY)
  const cell = Math.min(0.008, Math.max(0.002, extent / 72))
  return rasterize(meshes, gridAround(box, cell))
}

export function footprintStats(fp: Footprint): { area: number; centroid: Pt; bbox: BBox } {
  let sx = 0
  let sy = 0
  const bbox = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  for (let j = 0; j < fp.ny; j++) {
    for (let i = 0; i < fp.nx; i++) {
      if (!fp.mask[j * fp.nx + i]) continue
      const x = fp.x0 + (i + 0.5) * fp.cell
      const y = fp.y0 + (j + 0.5) * fp.cell
      sx += x
      sy += y
      bbox.minX = Math.min(bbox.minX, x - fp.cell / 2)
      bbox.maxX = Math.max(bbox.maxX, x + fp.cell / 2)
      bbox.minY = Math.min(bbox.minY, y - fp.cell / 2)
      bbox.maxY = Math.max(bbox.maxY, y + fp.cell / 2)
    }
  }
  const n = Math.max(1, fp.count)
  return { area: fp.count * fp.cell * fp.cell, centroid: [sx / n, sy / n], bbox }
}

/**
 * The covered cell farthest from the silhouette's edge (pole of inaccessibility),
 * ties broken towards the centroid. Unlike the bbox centre, it always lies on
 * the part, even for a U-shaped colon, so labels and tests can aim at it.
 */
export function poleOf(fp: Footprint): { x: number; y: number; zFront: number; zBack: number } {
  const { nx, ny, mask } = fp
  const d = new Float32Array(nx * ny)
  for (let k = 0; k < d.length; k++) d[k] = mask[k] ? 1e9 : 0
  const D = Math.SQRT2
  for (let j = 1; j < ny - 1; j++) {
    for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i
      if (!mask[k]) continue
      d[k] = Math.min(d[k], d[k - 1] + 1, d[k - nx] + 1, d[k - nx - 1] + D, d[k - nx + 1] + D)
    }
  }
  for (let j = ny - 2; j >= 1; j--) {
    for (let i = nx - 2; i >= 1; i--) {
      const k = j * nx + i
      if (!mask[k]) continue
      d[k] = Math.min(d[k], d[k + 1] + 1, d[k + nx] + 1, d[k + nx + 1] + D, d[k + nx - 1] + D)
    }
  }
  const { centroid } = footprintStats(fp)
  let max = 0
  for (let k = 0; k < d.length; k++) if (mask[k] && d[k] > max) max = d[k]
  let best = -1
  let bestDist = Infinity
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      if (!mask[k] || d[k] < max - 0.75) continue
      const dist = Math.hypot(fp.x0 + (i + 0.5) * fp.cell - centroid[0], fp.y0 + (j + 0.5) * fp.cell - centroid[1])
      if (dist < bestDist) {
        bestDist = dist
        best = k
      }
    }
  }
  const i = best % nx
  const j = Math.floor(best / nx)
  return { x: fp.x0 + (i + 0.5) * fp.cell, y: fp.y0 + (j + 0.5) * fp.cell, zFront: fp.zFront[best], zBack: fp.zBack[best] }
}

/** k-means over cell centres, seeded by farthest-point sampling so it is deterministic. */
function kmeans(xs: Float64Array, ys: Float64Array, k: number): Int32Array {
  const n = xs.length
  const labels = new Int32Array(n)
  const cx = new Float64Array(k)
  const cy = new Float64Array(k)
  let mx = 0
  let my = 0
  for (let p = 0; p < n; p++) {
    mx += xs[p] / n
    my += ys[p] / n
  }
  const nearest = new Float64Array(n).fill(Infinity)
  let seedX = mx
  let seedY = my
  for (let c = 0; c < k; c++) {
    let far = 0
    let farD = -1
    for (let p = 0; p < n; p++) {
      nearest[p] = Math.min(nearest[p], (xs[p] - seedX) ** 2 + (ys[p] - seedY) ** 2)
      if (nearest[p] > farD) {
        farD = nearest[p]
        far = p
      }
    }
    cx[c] = seedX = xs[far]
    cy[c] = seedY = ys[far]
  }
  const sx = new Float64Array(k)
  const sy = new Float64Array(k)
  const sn = new Float64Array(k)
  for (let iter = 0; iter < 16; iter++) {
    sx.fill(0)
    sy.fill(0)
    sn.fill(0)
    for (let p = 0; p < n; p++) {
      let best = 0
      let bestD = Infinity
      for (let c = 0; c < k; c++) {
        const dd = (xs[p] - cx[c]) ** 2 + (ys[p] - cy[c]) ** 2
        if (dd < bestD) {
          bestD = dd
          best = c
        }
      }
      labels[p] = best
      sx[best] += xs[p]
      sy[best] += ys[p]
      sn[best]++
    }
    for (let c = 0; c < k; c++) {
      if (sn[c]) {
        cx[c] = sx[c] / sn[c]
        cy[c] = sy[c] / sn[c]
      }
    }
  }
  return labels
}

/**
 * Splits the silhouette into convex pieces until each piece fills at least
 * `minFill` of its own hull, so a U-shaped colon doesn't swallow the small
 * intestine it frames. Compact organs stay one piece.
 */
export function convexPieces(fp: Footprint, maxPieces = 8, minFill = 0.66): Pt[][] {
  const xs = new Float64Array(fp.count)
  const ys = new Float64Array(fp.count)
  let n = 0
  for (let j = 0; j < fp.ny; j++) {
    for (let i = 0; i < fp.nx; i++) {
      if (!fp.mask[j * fp.nx + i]) continue
      xs[n] = fp.x0 + (i + 0.5) * fp.cell
      ys[n] = fp.y0 + (j + 0.5) * fp.cell
      n++
    }
  }
  const h = fp.cell / 2
  let pieces: Pt[][] = []
  for (let k = 1; k <= maxPieces; k++) {
    const labels = k === 1 ? new Int32Array(n) : kmeans(xs, ys, k)
    pieces = []
    let worst = 1
    for (let c = 0; c < k; c++) {
      const corners: Pt[] = []
      let cells = 0
      for (let p = 0; p < n; p++) {
        if (labels[p] !== c) continue
        cells++
        corners.push([xs[p] - h, ys[p] - h], [xs[p] + h, ys[p] - h], [xs[p] + h, ys[p] + h], [xs[p] - h, ys[p] + h])
      }
      if (!cells) continue
      const hull = convexHull(corners)
      worst = Math.min(worst, (cells * fp.cell * fp.cell) / Math.max(1e-12, polygonArea(hull)))
      pieces.push(hull)
    }
    if (worst >= minFill) break
  }
  return pieces
}
