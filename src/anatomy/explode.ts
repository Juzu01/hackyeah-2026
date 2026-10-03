// Exploded view: how far each organ moves so that, seen from the front, no two
// organs overlap and each one can be tapped on its own. Solved once per session
// on the organs' frontal (XY) silhouettes. Ported from the 2D atlas
// (src/body/layout.ts and geometry.ts in git history).

export type Pt = readonly [number, number]
export type BBox = { minX: number; minY: number; maxX: number; maxY: number }

export interface ExplodeBody {
  id: string
  /** Convex pieces of the frontal silhouette; concave organs (the colon) have several. */
  hulls: Pt[][]
  bbox: BBox
  area: number
  centroid: Pt
}

/** Signed area (counter-clockwise positive) of a simple polygon. */
export function polygonArea(poly: readonly Pt[]): number {
  let a = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % poly.length]
    a += x0 * y1 - x1 * y0
  }
  return a / 2
}

/** Andrew's monotone chain; returns the hull counter-clockwise without repeats. */
export function convexHull(points: readonly Pt[]): Pt[] {
  const pts = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1])
  if (pts.length < 3) return pts
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: Pt[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Pt[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

/**
 * Separating-axis data for two convex polygons: every edge normal of both, with
 * each polygon's projected range on it, packed as [nx, ny, aMin, aMax, bMin, bMax].
 * Translating `b` only shifts its range by a dot product, so this is computed
 * once per pair and reused by `satPush` for any offset.
 */
export function satAxes(a: readonly Pt[], b: readonly Pt[]): Float64Array {
  const out = new Float64Array((a.length + b.length) * 6)
  let n = 0
  const range = (poly: readonly Pt[], nx: number, ny: number) => {
    let min = Infinity
    let max = -Infinity
    for (const [x, y] of poly) {
      const p = x * nx + y * ny
      if (p < min) min = p
      if (p > max) max = p
    }
    return [min, max] as const
  }
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i]
      const [x1, y1] = poly[(i + 1) % poly.length]
      const len = Math.hypot(y1 - y0, x0 - x1)
      if (len === 0) continue
      const nx = (y1 - y0) / len
      const ny = (x0 - x1) / len
      const [aMin, aMax] = range(a, nx, ny)
      const [bMin, bMax] = range(b, nx, ny)
      out.set([nx, ny, aMin, aMax, bMin, bMax], n)
      n += 6
    }
  }
  return out.subarray(0, n)
}

/**
 * Shortest vector that moves `b`, offset by (dx, dy) relative to `a`, at least
 * `gap` clear of it; null if they are already that far apart.
 */
export function satPush(axes: Float64Array, dx: number, dy: number, gap: number): Pt | null {
  let best = Infinity
  let bx = 0
  let by = 0
  for (let i = 0; i < axes.length; i += 6) {
    const nx = axes[i]
    const ny = axes[i + 1]
    const shift = dx * nx + dy * ny
    const pushPos = axes[i + 3] - (axes[i + 4] + shift) + gap
    const pushNeg = axes[i + 5] + shift - axes[i + 2] + gap
    if (pushPos <= 0 || pushNeg <= 0) return null
    if (pushPos < best) {
      best = pushPos
      bx = nx
      by = ny
    }
    if (pushNeg < best) {
      best = pushNeg
      bx = -nx
      by = -ny
    }
  }
  return [bx * best, by * best]
}

/**
 * Pairwise overlap tests between bodies, with the SAT projections cached per pair.
 * Pairs in `whole` collide as their overall convex hulls rather than piece by
 * piece: a kidney caught inside the colon's U can't escape pushes that alternate
 * between the two arms, but it can always leave the hull of the whole U.
 */
function collider(bodies: readonly ExplodeBody[], whole: ReadonlySet<number> = new Set()) {
  const cache = new Map<number, Float64Array[]>()
  const hullOf = (b: ExplodeBody) => (b.hulls.length > 1 ? [convexHull(b.hulls.flat())] : b.hulls)
  const axesFor = (i: number, j: number) => {
    const key = i * bodies.length + j
    let axes = cache.get(key)
    if (!axes) {
      const [a, b] = whole.has(key) ? [hullOf(bodies[i]), hullOf(bodies[j])] : [bodies[i].hulls, bodies[j].hulls]
      axes = a.flatMap((ha) => b.map((hb) => satAxes(ha, hb)))
      cache.set(key, axes)
    }
    return axes
  }

  /** Push that moves body j (offset by bOff) clear of body i (offset by aOff), or null. */
  return (i: number, aOff: Pt, j: number, bOff: Pt, gap: number): Pt | null => {
    const a = bodies[i].bbox
    const b = bodies[j].bbox
    if (
      a.maxX + aOff[0] + gap < b.minX + bOff[0] ||
      b.maxX + bOff[0] + gap < a.minX + aOff[0] ||
      a.maxY + aOff[1] + gap < b.minY + bOff[1] ||
      b.maxY + bOff[1] + gap < a.minY + aOff[1]
    ) {
      return null
    }
    // Compound shapes collide piece by piece; take the deepest piece.
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
  /** Minimum distance between bodies once fully exploded (metres). */
  gap?: number
  /** Initial spread of each overlapping cluster around its own centre. */
  spreadX?: number
  spreadY?: number
  maxIterations?: number
}

/**
 * Two passes: first every cluster of touching bodies spreads out uniformly from
 * its area-weighted centre (so the layout still reads like the body), then
 * overlapping pairs are pushed apart until every pair is at least `gap` apart.
 * Smaller bodies move more than big ones, so the gallbladder slides out from
 * under the liver rather than the liver moving.
 */
export function solveExplode(bodies: readonly ExplodeBody[], options: ExplodeOptions = {}): Map<string, Pt> {
  const { gap = 0.012, spreadX = 1.25, spreadY = 1.1, maxIterations = 600 } = options
  const push = collider(bodies)
  const zero: Pt = [0, 0]

  // Union-find over bodies that touch at rest.
  const root = bodies.map((_, i) => i)
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])))
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      if (push(i, zero, j, zero, gap)) root[find(i)] = find(j)
    }
  }
  const clusters = new Map<number, number[]>()
  bodies.forEach((_, i) => {
    const r = find(i)
    clusters.set(r, [...(clusters.get(r) ?? []), i])
  })

  const off: [number, number][] = bodies.map(() => [0, 0])
  for (const members of clusters.values()) {
    if (members.length < 2) continue
    let total = 0
    let cx = 0
    let cy = 0
    for (const i of members) {
      total += bodies[i].area
      cx += bodies[i].centroid[0] * bodies[i].area
      cy += bodies[i].centroid[1] * bodies[i].area
    }
    cx /= total
    cy /= total
    for (const i of members) {
      off[i][0] = (bodies[i].centroid[0] - cx) * (spreadX - 1)
      off[i][1] = (bodies[i].centroid[1] - cy) * (spreadY - 1)
    }
  }

  const relax = (collide: typeof push, iterations: number) => {
    for (let iter = 0; iter < iterations; iter++) {
      let moved = false
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const v = collide(i, off[i], j, off[j], gap)
          if (!v) continue
          moved = true
          const wi = bodies[j].area / (bodies[i].area + bodies[j].area)
          const wj = 1 - wi
          // Slightly over-relax so pairs that touch exactly at `gap` still clear it.
          const k = 1.02
          off[i][0] -= v[0] * wi * k
          off[i][1] -= v[1] * wi * k
          off[j][0] += v[0] * wj * k
          off[j][1] += v[1] * wj * k
        }
      }
      if (!moved) return true
    }
    return false
  }

  if (!relax(push, maxIterations)) {
    const stuck = new Set<number>()
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) if (push(i, off[i], j, off[j], 0)) stuck.add(i * bodies.length + j)
    }
    relax(collider(bodies, stuck), maxIterations)
  }
  return new Map(bodies.map((b, i) => [b.id, [off[i][0], off[i][1]] as Pt]))
}

/** Pairs that still overlap at full explode; a sanity check for development. */
export function remainingOverlaps(bodies: readonly ExplodeBody[], offsets: Map<string, Pt>, gap = 0): string[] {
  const push = collider(bodies)
  const out: string[] = []
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      if (push(i, offsets.get(bodies[i].id)!, j, offsets.get(bodies[j].id)!, gap)) {
        out.push(`${bodies[i].id}/${bodies[j].id}`)
      }
    }
  }
  return out
}
