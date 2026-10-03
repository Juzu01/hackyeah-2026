// Exploded-view layout: how far each organ moves so that, fully zoomed in, no two
// organs overlap and each one can be tapped on its own. Solved once at startup.

import { satAxes, satPush, unionBBox, type BBox, type Pt } from './geometry.ts'
import type { BodyPart } from './anatomy.ts'

/** Pairwise overlap tests between parts, with the SAT projections cached per pair. */
function collider(parts: readonly BodyPart[]) {
  const cache = new Map<number, Float64Array[]>()
  const axesFor = (i: number, j: number) => {
    const key = i * parts.length + j
    let axes = cache.get(key)
    if (!axes) {
      axes = parts[i].hulls.flatMap((ha) => parts[j].hulls.map((hb) => satAxes(ha, hb)))
      cache.set(key, axes)
    }
    return axes
  }

  /** Push that moves part j (offset by bOff) clear of part i (offset by aOff), or null. */
  return (i: number, aOff: Pt, j: number, bOff: Pt, gap: number): Pt | null => {
    const a = parts[i].bbox
    const b = parts[j].bbox
    if (
      a.maxX + aOff[0] + gap < b.minX + bOff[0] ||
      b.maxX + bOff[0] + gap < a.minX + aOff[0] ||
      a.maxY + aOff[1] + gap < b.minY + bOff[1] ||
      b.maxY + bOff[1] + gap < a.minY + aOff[1]
    ) {
      return null
    }
    // Compound shapes (the colon) collide piece by piece; take the deepest piece.
    let best: Pt | null = null
    let bestLen = 0
    for (const axes of axesFor(i, j)) {
      const v = satPush(axes, bOff[0] - aOff[0], bOff[1] - aOff[1], gap)
      if (!v) continue
      const len = Math.hypot(v[0], v[1])
      if (len > bestLen) {
        best = v
        bestLen = len
      }
    }
    return best
  }
}

export interface ExplodeOptions {
  /** Minimum distance between parts once fully exploded (world units). */
  gap?: number
  /** Initial spread of each overlapping cluster around its own center. */
  spreadX?: number
  spreadY?: number
  maxIterations?: number
}

/**
 * Two passes: first every cluster of touching parts spreads out uniformly from
 * its center (so the layout still reads like the body), then overlapping pairs
 * are pushed apart until every pair is at least `gap` apart. Smaller parts move
 * more than big ones, so the gallbladder slides out from under the liver rather
 * than the liver moving.
 */
export function solveExplode(parts: readonly BodyPart[], options: ExplodeOptions = {}): Map<string, Pt> {
  const { gap = 4, spreadX = 1.35, spreadY = 1.12, maxIterations = 400 } = options
  const push = collider(parts)
  const zero: Pt = [0, 0]

  // Union-find over parts that touch at rest.
  const root = parts.map((_, i) => i)
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])))
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (push(i, zero, j, zero, gap)) root[find(i)] = find(j)
    }
  }
  const clusters = new Map<number, number[]>()
  parts.forEach((_, i) => {
    const r = find(i)
    clusters.set(r, [...(clusters.get(r) ?? []), i])
  })

  const off: [number, number][] = parts.map(() => [0, 0])
  for (const members of clusters.values()) {
    if (members.length < 2) continue
    let total = 0
    let cx = 0
    let cy = 0
    for (const i of members) {
      total += parts[i].area
      cx += parts[i].centroid[0] * parts[i].area
      cy += parts[i].centroid[1] * parts[i].area
    }
    cx /= total
    cy /= total
    for (const i of members) {
      off[i][0] = (parts[i].centroid[0] - cx) * (spreadX - 1)
      off[i][1] = (parts[i].centroid[1] - cy) * (spreadY - 1)
    }
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const v = push(i, off[i], j, off[j], gap)
        if (!v) continue
        moved = true
        const wi = parts[j].area / (parts[i].area + parts[j].area)
        const wj = 1 - wi
        // Slightly over-relax so pairs that touch exactly at `gap` still clear it.
        const k = 1.02
        off[i][0] -= v[0] * wi * k
        off[i][1] -= v[1] * wi * k
        off[j][0] += v[0] * wj * k
        off[j][1] += v[1] * wj * k
      }
    }
    if (!moved) break
  }
  return new Map(parts.map((p, i) => [p.id, [off[i][0], off[i][1]] as Pt]))
}

/** Ids of parts in `cover` that sit over any part in `under` (e.g. chest muscles over organs). */
export function coveringParts(cover: readonly BodyPart[], under: readonly BodyPart[]): Set<string> {
  const all = [...under, ...cover]
  const push = collider(all)
  const zero: Pt = [0, 0]
  const ids = new Set<string>()
  cover.forEach((c, ci) => {
    const j = under.length + ci
    if (under.some((_, i) => push(i, zero, j, zero, 0))) ids.add(c.id)
  })
  return ids
}

/** Bounds of the parts at their fully exploded positions. */
export function explodedBounds(parts: readonly BodyPart[], offsets: Map<string, Pt>): BBox {
  return unionBBox(
    parts.map((p) => {
      const [dx, dy] = offsets.get(p.id) ?? [0, 0]
      return { minX: p.bbox.minX + dx, minY: p.bbox.minY + dy, maxX: p.bbox.maxX + dx, maxY: p.bbox.maxY + dy }
    }),
  )
}

/** Pairs that still overlap at full explode; used as a sanity check. */
export function remainingOverlaps(parts: readonly BodyPart[], offsets: Map<string, Pt>, gap = 0): string[] {
  const push = collider(parts)
  const out: string[] = []
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (push(i, offsets.get(parts[i].id)!, j, offsets.get(parts[j].id)!, gap)) {
        out.push(`${parts[i].id}/${parts[j].id}`)
      }
    }
  }
  return out
}
