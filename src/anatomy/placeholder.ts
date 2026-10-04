// Stand-in anatomy for when public/anatomy/body-m.glb (or body-f.glb) is missing: each catalog
// entry becomes a rough, anatomically placed shape (capsules and ellipsoids
// blended as signed distance fields, then meshed), named and tagged exactly like
// the GLB's nodes. Metres, soles at y = 0, patient's left = +X, facing +Z.

import { BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import { surfaceNet } from 'three/examples/jsm/libs/surfaceNet.js'
import type { CatalogEntry } from './content.ts'

type V3 = readonly [number, number, number]

interface Shape {
  /** Signed distance (negative inside). */
  f: (x: number, y: number, z: number) => number
  min: V3
  max: V3
}

function cap(a: V3, b: V3, r1: number, r2 = r1): Shape {
  const bx = b[0] - a[0]
  const by = b[1] - a[1]
  const bz = b[2] - a[2]
  const l2 = bx * bx + by * by + bz * bz
  const r = Math.max(r1, r2)
  return {
    f(x, y, z) {
      const px = x - a[0]
      const py = y - a[1]
      const pz = z - a[2]
      const t = Math.min(1, Math.max(0, (px * bx + py * by + pz * bz) / l2))
      return Math.hypot(px - bx * t, py - by * t, pz - bz * t) - (r1 + (r2 - r1) * t)
    },
    min: [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r],
    max: [Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r],
  }
}

function ell(c: V3, r: V3): Shape {
  return {
    f(x, y, z) {
      const k0 = Math.hypot((x - c[0]) / r[0], (y - c[1]) / r[1], (z - c[2]) / r[2])
      const k1 = Math.hypot((x - c[0]) / (r[0] * r[0]), (y - c[1]) / (r[1] * r[1]), (z - c[2]) / (r[2] * r[2]))
      return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1
    },
    min: [c[0] - r[0], c[1] - r[1], c[2] - r[2]],
    max: [c[0] + r[0], c[1] + r[1], c[2] + r[2]],
  }
}

/** Smooth union with blend radius `k`. */
function union(k: number, ...shapes: Shape[]): Shape {
  return {
    f(x, y, z) {
      let d = shapes[0].f(x, y, z)
      for (let i = 1; i < shapes.length; i++) {
        const e = shapes[i].f(x, y, z)
        const h = Math.max(k - Math.abs(d - e), 0) / k
        d = Math.min(d, e) - h * h * k * 0.25
      }
      return d
    },
    min: [0, 1, 2].map((i) => Math.min(...shapes.map((s) => s.min[i]))) as unknown as V3,
    max: [0, 1, 2].map((i) => Math.max(...shapes.map((s) => s.max[i]))) as unknown as V3,
  }
}

const chain = (pts: V3[], r: number) => union(r * 0.6, ...pts.slice(1).map((p, i) => cap(pts[i], p, r)))

const mirror = (s: Shape): Shape => ({
  f: (x, y, z) => s.f(-x, y, z),
  min: [-s.max[0], s.min[1], s.min[2]],
  max: [-s.min[0], s.max[1], s.max[2]],
})

/** A shell around the chest, cut into horizontal bands so there are gaps between "ribs". */
function ribCage(): Shape {
  const body = ell([0, 1.27, 0.005], [0.145, 0.17, 0.105])
  const ribs: Shape = {
    f(x, y, z) {
      const shell = Math.abs(body.f(x, y, z)) - 0.006
      const s = ((((y - 1.1) % 0.034) + 0.034) % 0.034) - 0.017
      const band = Math.abs(s) - 0.0085
      const cut = Math.max(1.12 - y, y - 1.43)
      return Math.max(shell, band, cut)
    },
    min: body.min,
    max: body.max,
  }
  return union(0.01, ribs, cap([0, 1.425, 0.1], [0, 1.2, 0.108], 0.012))
}

// Landmarks of the left limbs, mirrored for the right.
const SHOULDER: V3 = [0.19, 1.42, -0.01]
const ELBOW: V3 = [0.24, 1.1, -0.02]
const WRIST: V3 = [0.275, 0.86, 0.015]
const HIP: V3 = [0.09, 0.9, 0]
const KNEE: V3 = [0.1, 0.49, 0.015]
const ANKLE: V3 = [0.11, 0.08, -0.01]

function skin(): Shape {
  const limbs = (s: number): Shape[] => {
    const m = (p: V3): V3 => [p[0] * s, p[1], p[2]]
    return [
      cap(m(SHOULDER), m(ELBOW), 0.05, 0.042),
      cap(m(ELBOW), m(WRIST), 0.042, 0.03),
      ell(m([0.282, 0.77, 0.025]), [0.022, 0.085, 0.045]),
      cap(m(HIP), m(KNEE), 0.088, 0.056),
      cap(m(KNEE), m(ANKLE), 0.056, 0.036),
      cap(m([0.11, 0.04, -0.045]), m([0.13, 0.03, 0.165]), 0.04, 0.03),
    ]
  }
  return union(
    0.035,
    ell([0, 1.64, 0.0], [0.08, 0.11, 0.1]),
    cap([0, 1.44, -0.01], [0, 1.56, 0.0], 0.055),
    ell([0, 1.28, 0.0], [0.172, 0.19, 0.118]),
    ell([0, 1.05, 0.005], [0.148, 0.16, 0.108]),
    ell([0, 0.9, -0.005], [0.172, 0.11, 0.112]),
    cap([-0.17, 1.42, -0.01], [0.17, 1.42, -0.01], 0.06),
    ...limbs(1),
    ...limbs(-1),
  )
}

/** Paired structures, described on the patient's left (+X). */
const PAIRED: Record<string, Shape> = {
  'sternocleidomastoid': cap([0.055, 1.585, -0.005], [0.022, 1.45, 0.06], 0.012),
  'trapezius': union(0.02, cap([0.015, 1.53, -0.055], [0.15, 1.44, -0.05], 0.018), ell([0.06, 1.33, -0.098], [0.065, 0.13, 0.022])),
  'deltoid': ell([0.205, 1.385, -0.005], [0.042, 0.075, 0.055]),
  'pectoralis-major': ell([0.075, 1.33, 0.09], [0.075, 0.065, 0.024]),
  'serratus-anterior': ell([0.142, 1.23, 0.035], [0.025, 0.07, 0.05]),
  'latissimus-dorsi': ell([0.11, 1.18, -0.075], [0.065, 0.12, 0.035]),
  'rectus-abdominis': ell([0.034, 1.05, 0.1], [0.03, 0.16, 0.016]),
  'external-oblique': ell([0.115, 1.04, 0.04], [0.035, 0.11, 0.07]),
  'biceps-brachii': cap([0.205, 1.32, 0.022], [0.235, 1.13, 0.02], 0.02),
  'triceps-brachii': cap([0.2, 1.36, -0.04], [0.235, 1.14, -0.045], 0.024),
  'brachialis': cap([0.222, 1.23, 0.003], [0.24, 1.1, 0.012], 0.018),
  'brachioradialis': cap([0.257, 1.14, 0.0], [0.27, 0.92, 0.022], 0.016),
  'forearm-flexors': cap([0.238, 1.08, 0.018], [0.262, 0.89, 0.03], 0.02),
  'forearm-extensors': cap([0.266, 1.08, -0.022], [0.282, 0.89, -0.004], 0.018),
  'gluteus-maximus': ell([0.075, 0.87, -0.085], [0.07, 0.09, 0.045]),
  'gluteus-medius': ell([0.125, 0.95, -0.04], [0.045, 0.05, 0.05]),
  'tensor-fasciae-latae': cap([0.14, 0.92, 0.03], [0.15, 0.8, 0.02], 0.017),
  'sartorius': chain([[0.12, 0.93, 0.06], [0.075, 0.7, 0.055], [0.06, 0.5, -0.01]], 0.011),
  'rectus-femoris': cap([0.1, 0.85, 0.06], [0.1, 0.55, 0.06], 0.028),
  'vastus-lateralis': cap([0.14, 0.82, 0.0], [0.135, 0.55, 0.02], 0.034),
  'vastus-medialis': cap([0.068, 0.68, 0.03], [0.075, 0.53, 0.035], 0.028),
  'adductors': cap([0.04, 0.83, 0.0], [0.07, 0.6, -0.005], 0.038),
  'biceps-femoris': cap([0.112, 0.8, -0.06], [0.125, 0.53, -0.04], 0.028),
  'medial-hamstrings': cap([0.068, 0.8, -0.06], [0.075, 0.53, -0.04], 0.028),
  'gastrocnemius': ell([0.1, 0.38, -0.045], [0.045, 0.09, 0.033]),
  'soleus': ell([0.105, 0.25, -0.038], [0.04, 0.1, 0.028]),
  'tibialis-anterior': cap([0.115, 0.44, 0.035], [0.11, 0.12, 0.03], 0.016),
  'fibularis-longus': cap([0.14, 0.44, 0.0], [0.135, 0.13, -0.015], 0.013),
  'temporalis': ell([0.068, 1.665, 0.0], [0.012, 0.04, 0.045]),
  'masseter': ell([0.056, 1.565, 0.035], [0.012, 0.03, 0.02]),
  'clavicle': cap([0.02, 1.445, 0.06], [0.17, 1.455, 0.0], 0.008),
  'scapula': ell([0.1, 1.34, -0.09], [0.05, 0.075, 0.012]),
  'humerus': union(0.01, ell(SHOULDER, [0.025, 0.025, 0.025]), cap(SHOULDER, ELBOW, 0.014)),
  'radius': cap([0.25, 1.09, 0.0], [0.28, 0.86, 0.02], 0.009),
  'ulna': cap([0.235, 1.1, -0.02], [0.262, 0.86, 0.0], 0.009),
  'hand-bones': ell([0.28, 0.77, 0.025], [0.02, 0.08, 0.035]),
  'femur': union(0.01, ell([0.085, 0.9, 0.0], [0.024, 0.024, 0.024]), cap([0.085, 0.89, 0.0], [0.1, 0.48, 0.01], 0.016)),
  'patella': ell([0.1, 0.49, 0.055], [0.02, 0.025, 0.01]),
  'tibia': cap([0.1, 0.47, 0.01], [0.105, 0.08, 0.0], 0.016),
  'fibula': cap([0.135, 0.45, -0.01], [0.13, 0.07, -0.01], 0.007),
  'foot-bones': cap([0.11, 0.035, -0.04], [0.13, 0.025, 0.15], 0.022),
  'lung': ell([0.08, 1.27, -0.005], [0.058, 0.12, 0.08]),
  'kidney': ell([0.06, 1.05, -0.06], [0.03, 0.055, 0.025]),
}

const SINGLE: Record<string, () => Shape> = {
  skin,
  'skull': () => ell([0, 1.64, -0.005], [0.07, 0.1, 0.09]),
  'mandible': () => chain([[-0.05, 1.56, 0.0], [-0.035, 1.53, 0.06], [0, 1.525, 0.075], [0.035, 1.53, 0.06], [0.05, 1.56, 0.0]], 0.01),
  'vertebral-column': () => chain([[0, 1.56, -0.02], [0, 1.42, -0.05], [0, 1.2, -0.08], [0, 1.0, -0.05], [0, 0.93, -0.06]], 0.018),
  'thoracic-cage': ribCage,
  'pelvis': () =>
    union(
      0.015,
      ell([0.1, 0.96, -0.02], [0.045, 0.06, 0.035]),
      ell([-0.1, 0.96, -0.02], [0.045, 0.06, 0.035]),
      cap([0, 0.97, -0.08], [0, 0.87, -0.07], 0.022),
      cap([-0.06, 0.865, 0.05], [0.06, 0.865, 0.05], 0.012),
    ),
  'brain': () => ell([0, 1.665, -0.01], [0.062, 0.058, 0.078]),
  'thyroid': () =>
    union(0.006, ell([0.018, 1.465, 0.035], [0.01, 0.022, 0.01]), ell([-0.018, 1.465, 0.035], [0.01, 0.022, 0.01]), cap([-0.015, 1.458, 0.042], [0.015, 1.458, 0.042], 0.005)),
  'trachea': () =>
    union(0.008, cap([0, 1.5, 0.02], [0, 1.32, 0.0], 0.01), cap([0, 1.32, 0], [0.045, 1.28, -0.01], 0.007), cap([0, 1.32, 0], [-0.045, 1.28, -0.01], 0.007)),
  'esophagus': () => chain([[0, 1.5, 0.0], [0.0, 1.3, -0.035], [0.025, 1.14, 0.0]], 0.009),
  'heart': () => ell([0.02, 1.225, 0.04], [0.05, 0.06, 0.045]),
  'aorta': () => chain([[0.005, 1.25, 0.03], [0.0, 1.33, 0.02], [0.025, 1.34, -0.02], [0.03, 1.25, -0.05], [0.015, 1.0, -0.04], [0.0, 0.93, -0.02]], 0.011),
  'liver': () => ell([-0.05, 1.11, 0.02], [0.11, 0.06, 0.08]),
  'gallbladder': () => ell([-0.04, 1.07, 0.08], [0.012, 0.03, 0.015]),
  'stomach': () => chain([[0.06, 1.16, 0.0], [0.085, 1.1, 0.03], [0.04, 1.06, 0.06], [0.0, 1.08, 0.05]], 0.03),
  'spleen': () => ell([0.115, 1.13, -0.05], [0.025, 0.05, 0.04]),
  'pancreas': () => cap([-0.02, 1.07, 0.0], [0.09, 1.1, -0.03], 0.015),
  'small-intestine': () =>
    union(0.02, ell([0, 0.97, 0.04], [0.075, 0.065, 0.05]), ell([0.035, 0.94, 0.05], [0.04, 0.035, 0.04]), ell([-0.03, 1.0, 0.05], [0.04, 0.035, 0.04])),
  'large-intestine': () =>
    chain(
      [[-0.09, 0.92, 0.03], [-0.095, 1.04, 0.03], [-0.08, 1.07, 0.04], [0, 1.04, 0.07], [0.09, 1.09, 0.02], [0.1, 0.96, 0.0], [0.06, 0.88, 0.02], [0, 0.86, -0.05]],
      0.022,
    ),
  'urinary-bladder': () => ell([0, 0.865, 0.035], [0.035, 0.03, 0.03]),
}

function shapeFor(entry: CatalogEntry): Shape | null {
  const base = entry.id.replace(/-(left|right)$/, '')
  const paired = PAIRED[base]
  if (paired) return entry.side === 'right' ? mirror(paired) : paired
  return SINGLE[entry.id]?.() ?? null
}

/** Meshes the zero level set on a grid of `cell` metres. */
function meshShape(shape: Shape, cell: number): BufferGeometry {
  const min = shape.min.map((v) => v - 2 * cell)
  const dims = [0, 1, 2].map((i) => Math.ceil((shape.max[i] + 2 * cell - min[i]) / cell) + 1)
  const [nx, ny, nz] = dims
  const field = new Float32Array(nx * ny * nz)
  for (let k = 0, n = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) field[n++] = shape.f(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell)
    }
  }
  const at = (x: number, y: number, z: number) => {
    const i = Math.round((x - min[0]) / cell)
    const j = Math.round((y - min[1]) / cell)
    const k = Math.round((z - min[2]) / cell)
    return field[i + nx * (j + ny * k)]
  }
  const max = min.map((m, i) => m + dims[i] * cell)
  const { positions, cells } = surfaceNet(dims, at, [min, max])
  const pos = new Float32Array(positions.length * 3)
  positions.forEach((p: number[], i: number) => pos.set(p, i * 3))
  const index = new Uint32Array(cells.length * 3)
  let volume = 0
  cells.forEach((c: number[], i: number) => {
    index.set(c, i * 3)
    const [a, b, d] = c.map((v) => positions[v])
    volume += a[0] * (b[1] * d[2] - b[2] * d[1]) - a[1] * (b[0] * d[2] - b[2] * d[0]) + a[2] * (b[0] * d[1] - b[1] * d[0])
  })
  // Wind triangles counter-clockwise from outside, whatever the mesher produced.
  if (volume < 0) {
    for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]]
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(pos, 3))
  geometry.setIndex(new BufferAttribute(index, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** A scene graph shaped like the GLB's: one named mesh per catalog entry, extras in userData. */
export function buildPlaceholder(entries: readonly CatalogEntry[]): Group {
  const root = new Group()
  root.name = 'placeholder'
  const material = new MeshBasicMaterial()
  for (const entry of entries) {
    const shape = shapeFor(entry)
    if (!shape) continue
    const extent = Math.max(...[0, 1, 2].map((i) => shape.max[i] - shape.min[i]))
    const cell = entry.id === 'skin' ? 0.012 : Math.min(0.012, Math.max(0.003, extent / 26))
    const mesh = new Mesh(meshShape(shape, cell), material)
    mesh.name = entry.id
    mesh.userData = { system: entry.system, layer: entry.layer, side: entry.side, explode: entry.explode, group: entry.group }
    root.add(mesh)
  }
  return root
}
