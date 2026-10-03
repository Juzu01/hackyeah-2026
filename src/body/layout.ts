// Exploded-view layout: how far each organ moves so that, fully zoomed in, no two
// organs overlap and each one can be tapped on its own. Solved once at startup.

import { separation, unionBBox, type BBox, type Pt } from './geometry.ts'
import type { BodyPart } from './anatomy.ts'

/** Minimum push between two parts' convex pieces, moving `b` (offset by bOff) away from `a`. */
function overlapPush(a: BodyPart, aOff: Pt, b: BodyPart, bOff: Pt, gap: number): Pt | null {
  const bb = a.bbox
  const cb = b.bbox
  if (
    bb.maxX + aOff[0] + gap < cb.minX + bOff[0] ||
    cb.maxX + bOff[0] + gap < bb.minX + aOff[0] ||
    bb.maxY + aOff[1] + gap < cb.minY + bOff[1] ||
    cb.maxY + bOff[1] + gap < bb.minY + aOff[1]
  ) {
    return null
  }
  let best: Pt | null = null
  let bestLen = 0
  const dx = bOff[0] - aOff[0]
  const dy = bOff[1] - aOff[1]
  for (const ha of a.hulls) {
    for (const hb of b.hulls) {
      const v = separation(ha, hb, dx, dy, gap)
      if (!v) continue
      const len = Math.hypot(v[0], v[1])
      if (len > bestLen) {
        best = v
        bestLen = len
      }
    }
  }
  return best
}

/**
 * Pushes overlapping parts apart until every pair is at least `gap` apart.
 * Smaller parts move more than big ones, so e.g. the gallbladder slides out
 * from under the liver rather than the liver moving.
 */
export function solveExplode(parts: readonly BodyPart[], gap = 5, maxIterations = 600): Map<string, Pt> {
  const off: [number, number][] = parts.map(() => [0, 0])
  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const push = overlapPush(parts[i], off[i], parts[j], off[j], gap)
        if (!push) continue
        moved = true
        const wi = parts[j].area / (parts[i].area + parts[j].area)
        const wj = 1 - wi
        // Slightly over-relax so pairs that touch exactly at `gap` still clear it.
        const k = 1.02
        off[i][0] -= push[0] * wi * k
        off[i][1] -= push[1] * wi * k
        off[j][0] += push[0] * wj * k
        off[j][1] += push[1] * wj * k
      }
    }
    if (!moved) break
  }
  return new Map(parts.map((p, i) => [p.id, [off[i][0], off[i][1]] as Pt]))
}

/** Ids of parts in `cover` that sit over any part in `under` (e.g. chest muscles over organs). */
export function coveringParts(cover: readonly BodyPart[], under: readonly BodyPart[]): Set<string> {
  const zero: Pt = [0, 0]
  const ids = new Set<string>()
  for (const c of cover) {
    if (under.some((u) => overlapPush(u, zero, c, zero, 0))) ids.add(c.id)
  }
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

/** Counts pairs that still overlap at full explode; used as a sanity check in dev. */
export function remainingOverlaps(parts: readonly BodyPart[], offsets: Map<string, Pt>, gap = 0): string[] {
  const out: string[] = []
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i]
      const b = parts[j]
      if (overlapPush(a, offsets.get(a.id)!, b, offsets.get(b.id)!, gap)) out.push(`${a.id}/${b.id}`)
    }
  }
  return out
}
