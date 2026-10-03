// BodyParts3D's external oblique includes its aponeurosis: the sheet that runs in front of the rectus
// abdominis to the linea alba. Seen from the front it hides the rectus completely (and catches every
// tap meant for it), so build.mjs trims the oblique back to the rectus's lateral border (the linea
// semilunaris), leaving the fleshy lateral belly. Works in BodyParts3D millimetres (z up).
import { filterTriangles } from './mesh.mjs'

/**
 * Drops the triangles of `sheet` that lie medial to the lateral border of `muscle` at their height.
 * The border is the muscle's widest point per `slabMm` slab, widened over ±`smoothMm` of height and by
 * `marginMm`, and held constant above and below the muscle.
 */
export function trimMedialTo(sheet, muscle, { marginMm = 2, slabMm = 2, smoothMm = 10 } = {}) {
  const m = muscle.positions
  let sideSum = 0
  let zMin = Infinity
  let zMax = -Infinity
  for (let i = 0; i < m.length; i += 3) {
    sideSum += m[i]
    zMin = Math.min(zMin, m[i + 2])
    zMax = Math.max(zMax, m[i + 2])
  }
  const side = Math.sign(sideSum) // lateral is +x for the patient's left, -x for the right
  const slabs = Math.floor((zMax - zMin) / slabMm) + 1
  const slabOf = (z) => Math.min(slabs - 1, Math.max(0, Math.floor((z - zMin) / slabMm)))
  const widest = new Float64Array(slabs).fill(-Infinity)
  for (let i = 0; i < m.length; i += 3) {
    const s = slabOf(m[i + 2])
    widest[s] = Math.max(widest[s], m[i] * side)
  }
  const reach = Math.round(smoothMm / slabMm)
  const border = widest.map((_, s) => {
    let w = -Infinity
    for (let k = Math.max(0, s - reach); k <= Math.min(slabs - 1, s + reach); k++) w = Math.max(w, widest[k])
    return w + marginMm
  })

  const p = sheet.positions
  const I = sheet.indices
  return filterTriangles(sheet, (t) => {
    const [a, b, c] = [I[t * 3] * 3, I[t * 3 + 1] * 3, I[t * 3 + 2] * 3]
    const lateral = ((p[a] + p[b] + p[c]) / 3) * side
    return lateral >= border[slabOf((p[a + 2] + p[b + 2] + p[c + 2]) / 3)]
  })
}
