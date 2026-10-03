// 2D helpers for the body model: smoothing control points into SVG paths,
// limb-local coordinates, and convex-hull collision (SAT) for the explode solver.

export type Pt = readonly [number, number]
/** Control point; a third element of 1 marks a sharp corner instead of a smooth one. */
export type CtrlPt = readonly [number, number] | readonly [number, number, 1]
export type BBox = { minX: number; minY: number; maxX: number; maxY: number }

const r2 = (n: number) => Math.round(n * 100) / 100

export const mirror = (p: CtrlPt): CtrlPt => (p.length === 3 ? [-p[0], p[1], 1] : [-p[0], p[1]])

/**
 * Builds a full closed outline from its right half: `half` runs from a point on
 * the midline (x = 0) down the +x side and back to the midline.
 */
export function mirrorClosed(half: CtrlPt[]): CtrlPt[] {
  const inner = half.slice(1, -1).reverse().map(mirror)
  return [...half, ...inner]
}

/** Closed uniform Catmull-Rom spline through `pts`, as cubic Béziers. */
function bezierSegments(pts: readonly CtrlPt[]): [Pt, Pt, Pt, Pt][] {
  const n = pts.length
  const segs: [Pt, Pt, Pt, Pt][] = []
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const k1 = p1.length === 3 ? 0 : 1 / 6
    const k2 = p2.length === 3 ? 0 : 1 / 6
    segs.push([
      [p1[0], p1[1]],
      [p1[0] + (p2[0] - p0[0]) * k1, p1[1] + (p2[1] - p0[1]) * k1],
      [p2[0] - (p3[0] - p1[0]) * k2, p2[1] - (p3[1] - p1[1]) * k2],
      [p2[0], p2[1]],
    ])
  }
  return segs
}

export function smoothPath(pts: readonly CtrlPt[]): string {
  const segs = bezierSegments(pts)
  let d = `M${r2(segs[0][0][0])} ${r2(segs[0][0][1])}`
  for (const [, c1, c2, p] of segs) {
    d += `C${r2(c1[0])} ${r2(c1[1])} ${r2(c2[0])} ${r2(c2[1])} ${r2(p[0])} ${r2(p[1])}`
  }
  return d + 'Z'
}

/** Open Catmull-Rom curve through `pts` (decorative strokes like folds and fissures). */
export function smoothOpenPath(pts: readonly CtrlPt[]): string {
  const n = pts.length
  let d = `M${r2(pts[0][0])} ${r2(pts[0][1])}`
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(n - 1, i + 2)]
    const k1 = p1.length === 3 ? 0 : 1 / 6
    const k2 = p2.length === 3 ? 0 : 1 / 6
    d += `C${r2(p1[0] + (p2[0] - p0[0]) * k1)} ${r2(p1[1] + (p2[1] - p0[1]) * k1)} ${r2(p2[0] - (p3[0] - p1[0]) * k2)} ${r2(p2[1] - (p3[1] - p1[1]) * k2)} ${r2(p2[0])} ${r2(p2[1])}`
  }
  return d
}

/** Points along the smoothed outline, for hit areas, hulls and bounds. */
export function sampleOutline(pts: readonly CtrlPt[], perSegment = 6): Pt[] {
  const out: Pt[] = []
  for (const [a, b, c, d] of bezierSegments(pts)) {
    for (let i = 0; i < perSegment; i++) {
      const t = i / perSegment
      const u = 1 - t
      const w0 = u * u * u
      const w1 = 3 * u * u * t
      const w2 = 3 * u * t * t
      const w3 = t * t * t
      out.push([
        w0 * a[0] + w1 * b[0] + w2 * c[0] + w3 * d[0],
        w0 * a[1] + w1 * b[1] + w2 * c[1] + w3 * d[1],
      ])
    }
  }
  return out
}

/**
 * Local frame along a limb segment from `a` (proximal) to `b` (distal).
 * `t` runs 0..1 along the bone; `s` runs -1 (medial edge) .. +1 (lateral edge),
 * scaled by the profile's half-widths at that `t`. Defined for the +x side.
 */
export function limbFrame(a: Pt, b: Pt, profile: [t: number, medial: number, lateral: number][]) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  // Perpendicular pointing away from the body's midline (lateral) on the +x side.
  const nx = uy
  const ny = -ux

  const widthAt = (t: number, lateral: boolean) => {
    const col = lateral ? 2 : 1
    if (t <= profile[0][0]) return profile[0][col]
    for (let i = 1; i < profile.length; i++) {
      const [t1] = profile[i]
      if (t <= t1) {
        const [t0] = profile[i - 1]
        const k = (t - t0) / (t1 - t0)
        return profile[i - 1][col] + (profile[i][col] - profile[i - 1][col]) * k
      }
    }
    return profile[profile.length - 1][col]
  }

  const at = (t: number, s: number): Pt => {
    const w = widthAt(t, s >= 0)
    return [a[0] + ux * t * len + nx * s * w, a[1] + uy * t * len + ny * s * w]
  }

  return {
    at,
    /** Maps limb-local control points to world space, keeping corner flags. */
    map: (pts: readonly CtrlPt[]): CtrlPt[] =>
      pts.map((p) => {
        const [x, y] = at(p[0], p[1])
        return p.length === 3 ? [x, y, 1] : [x, y]
      }),
    /** Skin outline of the whole segment with rounded caps (in t units). */
    outline(capStart = 0.04, capEnd = 0.05): CtrlPt[] {
      const ts = profile.map(([t]) => t)
      return [
        at(-capStart, 0),
        ...ts.map((t) => at(t, 1)),
        at(1 + capEnd, 0),
        ...[...ts].reverse().map((t) => at(t, -1)),
      ]
    },
  }
}

/** Closed outline of a tube of constant width around a centerline (for the colon). */
export function tube(center: readonly Pt[], width: number): { outline: CtrlPt[]; pieces: Pt[][] } {
  const h = width / 2
  const normals = center.map((_, i) => {
    const prev = center[Math.max(0, i - 1)]
    const next = center[Math.min(center.length - 1, i + 1)]
    const dx = next[0] - prev[0]
    const dy = next[1] - prev[1]
    const len = Math.hypot(dx, dy)
    return [dy / len, -dx / len] as const
  })
  const left = center.map((p, i): Pt => [p[0] + normals[i][0] * h, p[1] + normals[i][1] * h])
  const right = center.map((p, i): Pt => [p[0] - normals[i][0] * h, p[1] - normals[i][1] * h])
  const cap = (i: number, dir: number): Pt => {
    const j = i + dir
    const dx = center[i][0] - center[j][0]
    const dy = center[i][1] - center[j][1]
    const len = Math.hypot(dx, dy)
    return [center[i][0] + (dx / len) * h * 0.9, center[i][1] + (dy / len) * h * 0.9]
  }
  const last = center.length - 1
  const outline: CtrlPt[] = [...left, cap(last, -1), ...[...right].reverse(), cap(0, 1)]
  // One convex quad per centerline segment, so the U-shape doesn't swallow its contents.
  const pieces: Pt[][] = []
  for (let i = 0; i < last; i++) {
    pieces.push(convexHull([left[i], left[i + 1], right[i + 1], right[i]]))
  }
  return { outline, pieces }
}

export function bboxOf(pts: readonly Pt[]): BBox {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

export function unionBBox(boxes: readonly BBox[]): BBox {
  return {
    minX: Math.min(...boxes.map((b) => b.minX)),
    minY: Math.min(...boxes.map((b) => b.minY)),
    maxX: Math.max(...boxes.map((b) => b.maxX)),
    maxY: Math.max(...boxes.map((b) => b.maxY)),
  }
}

/** Area and area-weighted centroid of a simple polygon. */
export function areaCentroid(poly: readonly Pt[]): { area: number; centroid: Pt } {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % poly.length]
    const cross = x0 * y1 - x1 * y0
    a += cross
    cx += (x0 + x1) * cross
    cy += (y0 + y1) * cross
  }
  a /= 2
  return { area: Math.abs(a), centroid: [cx / (6 * a), cy / (6 * a)] }
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
 * Separating-axis test between two convex polygons, `b` shifted by (bx, by).
 * Returns the shortest vector that moves `b` clear of `a` plus `gap`, or null
 * if they are already at least `gap` apart.
 */
export function separation(a: readonly Pt[], b: readonly Pt[], bx: number, by: number, gap: number): Pt | null {
  let best = Infinity
  let bestAxis: Pt = [0, 0]
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x0, y0] = poly[i]
      const [x1, y1] = poly[(i + 1) % poly.length]
      let nx = y1 - y0
      let ny = x0 - x1
      const len = Math.hypot(nx, ny)
      if (len === 0) continue
      nx /= len
      ny /= len
      let aMin = Infinity
      let aMax = -Infinity
      for (const [x, y] of a) {
        const p = x * nx + y * ny
        if (p < aMin) aMin = p
        if (p > aMax) aMax = p
      }
      let bMin = Infinity
      let bMax = -Infinity
      for (const [x, y] of b) {
        const p = (x + bx) * nx + (y + by) * ny
        if (p < bMin) bMin = p
        if (p > bMax) bMax = p
      }
      // Push b whichever way along this axis is shorter.
      const pushPos = aMax - bMin + gap
      const pushNeg = bMax - aMin + gap
      if (pushPos <= 0 || pushNeg <= 0) return null
      if (pushPos < best) {
        best = pushPos
        bestAxis = [nx, ny]
      }
      if (pushNeg < best) {
        best = pushNeg
        bestAxis = [-nx, -ny]
      }
    }
  }
  return [bestAxis[0] * best, bestAxis[1] * best]
}

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
