#!/usr/bin/env node
// The two bodies the atlas shows, made from build.mjs's body.glb (BodyParts3D, an adult man):
//
//   body-m.glb  the man, with a neutral crotch: BodyParts3D's skin has the penis and scrotum, and the
//               atlas shows no genitals on either body (lib/neutral.mjs).
//   body-f.glb  the woman. BodyParts3D only segmented a man and no open female dataset lines up with
//               it, so she is the same anatomy reshaped: one smooth deformation of space moves every
//               part at once, so the skin, muscles, bones and organs stay nested exactly as before. A
//               little shorter, narrower shoulders and waist, wider hips and fuller buttocks; the arms
//               move with the shoulders and hang a little further out (the wider carrying angle
//               women have), so the hands stay clear of the hips. Breasts are added to the skin only,
//               smooth and without detail, as in an anatomy textbook.
//
//   node shapes.mjs        (≈ 15 s; reads ../../public/anatomy/body.glb, writes both next to it)
//
// Frame (DESIGN.md §2): metres, +Y up with the soles at 0, +X = the patient's left, face towards +Z,
// the skin centred on X and Z.

import { NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { encodeGlb } from './lib/glb.mjs'
import { creasedNormals, toSoup, weld } from './lib/mesh.mjs'
import { neutralCrotch } from './lib/neutral.mjs'

const DIR = new URL('../../public/anatomy/', import.meta.url)
const CREASE_DEG = 60 // as in build.mjs
const WELD_M = 3e-5 // joins the skin's corners that creasedNormals split; well under any real edge

/** Overall height: an average woman is about 7% shorter than an average man; the model is 1.655 m. */
const HEIGHT = 0.95

/**
 * Width (x) of the trunk and legs by height in the man, relative to him. Monotone cubic between the
 * knots, so the outline changes smoothly. Landmarks: hips (greater trochanters) ≈ 0.86, iliac crest
 * ≈ 0.97, waist ≈ 1.05, shoulders (acromion) ≈ 1.37.
 */
const WIDTH = [
  [0.0, 0.97],
  [0.42, 0.98],
  [0.62, 1.03],
  [0.8, 1.065],
  [0.88, 1.065],
  [0.97, 1.0],
  [1.05, 0.875],
  [1.15, 0.92],
  [1.27, 0.91],
  [1.37, 0.885],
  [1.46, 0.93],
  [1.56, 0.95],
  [1.7, 0.95],
]
/** Depth (z) by height: a slimmer waist from the side. */
const DEPTH = [
  [0.0, 1.0],
  [0.9, 1.0],
  [1.05, 0.93],
  [1.2, 0.98],
  [1.7, 0.98],
]
/** Extra depth behind (z < 0) by height: fuller buttocks. */
const BEHIND = [
  [0.0, 1.0],
  [0.66, 1.0],
  [0.8, 1.09],
  [0.88, 1.07],
  [0.98, 1.0],
  [1.7, 1.0],
]

/** The shoulder joint (centre of the humeral head) the arms hang from, on the patient's left. */
const SHOULDER = [0.17, 1.33, -0.02]
/** How far the arms swing out from it, in degrees. */
const CARRY = 3

/** Breasts on the skin: centre (after reshaping) on the patient's left, size in metres. */
const BREAST = { x: 0.088, y: 1.2, projection: 0.042, wide: 0.058, up: 0.08, down: 0.048 }

const ARM = /^(humerus|radius|ulna|hand-bones|deltoid|biceps-brachii|triceps-brachii|brachialis|brachioradialis|forearm-flexors|forearm-extensors)-(left|right)$/

// ── Read ─────────────────────────────────────────────────────────────────

await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const doc = await io.read(fileURLToPath(new URL('body.glb', DIR)))
const copyright = doc.getRoot().getAsset().copyright ?? ''

/** Every part in file order, positions in world space (metres). */
const parts = doc
  .getRoot()
  .listScenes()[0]
  .listChildren()
  .map((node) => {
    const prim = node.getMesh().listPrimitives()[0]
    const pos = prim.getAttribute('POSITION')
    const m = node.getWorldMatrix()
    const count = pos.getCount()
    const positions = new Float32Array(count * 3)
    const v = [0, 0, 0]
    for (let i = 0; i < count; i++) {
      pos.getElement(i, v)
      positions[i * 3] = m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12]
      positions[i * 3 + 1] = m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13]
      positions[i * 3 + 2] = m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]
    }
    const idx = prim.getIndices()
    const indices = new Uint32Array(idx.getCount())
    for (let i = 0; i < indices.length; i++) indices[i] = idx.getScalar(i)
    const id = node.getName()
    const arm = ARM.exec(id)
    return { id, extras: node.getExtras(), positions, indices, side: arm ? (arm[2] === 'left' ? 1 : -1) : 0 }
  })

const skinPart = parts.find((p) => p.id === 'skin')
let top = 0
for (let i = 1; i < skinPart.positions.length; i += 3) top = Math.max(top, skinPart.positions[i])
if (Math.abs(top - 1.655) > 0.02) throw new Error(`unexpected model height ${top.toFixed(3)} m: the knots assume the 1.655 m man`)

// ── The tissue under the skin ─────────────────────────────────────────────
// A grid of every other vertex of every part but the skin, each tagged with its arm (+1 left,
// -1 right) or 0 for the trunk and legs.

const CELL = 0.02
const grid = new Map()
const cellKey = (i, j, k) => `${i},${j},${k}`
for (const p of parts) {
  if (p === skinPart) continue
  for (let i = 0; i < p.positions.length / 3; i += 2) {
    const [x, y, z] = [p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]]
    const k = cellKey(Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL))
    if (!grid.has(k)) grid.set(k, [])
    grid.get(k).push(x, y, z, p.side)
  }
}
/** Distance to the nearest arm tissue (and which arm) and to the nearest trunk tissue, up to 8 cm. */
function nearest(x, y, z) {
  let arm = Infinity
  let armSide = 0
  let trunk = Infinity
  const [cx, cy, cz] = [Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL)]
  for (let r = 0; r <= 4; r++) {
    // Rings of cells outwards; stop once both are found and a further ring can't hold anything closer.
    if (r >= 2 && arm !== Infinity && trunk !== Infinity && Math.max(arm, trunk) < (r - 1) * CELL) break
    for (let i = cx - r; i <= cx + r; i++)
      for (let j = cy - r; j <= cy + r; j++)
        for (let k = cz - r; k <= cz + r; k++) {
          if (Math.max(Math.abs(i - cx), Math.abs(j - cy), Math.abs(k - cz)) !== r) continue
          const cell = grid.get(cellKey(i, j, k))
          if (!cell) continue
          for (let s = 0; s < cell.length; s += 4) {
            const d = Math.hypot(cell[s] - x, cell[s + 1] - y, cell[s + 2] - z)
            if (cell[s + 3] !== 0) {
              if (d < arm) [arm, armSide] = [d, cell[s + 3]]
            } else if (d < trunk) trunk = d
          }
        }
  }
  return { arm, armSide, trunk }
}

// ── The man, with a neutral crotch ─────────────────────────────────────────

const welded = weld(toSoup(skinPart), WELD_M)
const neutral = neutralCrotch(welded, (x, y, z) => {
  const { arm, trunk } = nearest(x, y, z)
  return Math.min(arm, trunk)
})
console.log(`neutral crotch: ${neutral.removed} skin triangles removed, openings closed (edge vertices): ${neutral.loops.join(', ')}`)
skinPart.positions = neutral.mesh.positions
skinPart.indices = neutral.mesh.indices

async function write(name, list) {
  const glb = await encodeGlb(
    list.map((p) => {
      const { positions, normals, indices } = creasedNormals({ positions: p.positions, indices: p.indices }, CREASE_DEG)
      return { id: p.id, positions, normals, indices, extras: p.extras }
    }),
    { copyright },
  )
  writeFileSync(fileURLToPath(new URL(name, DIR)), glb)
  console.log(`${name}: ${list.length} parts, ${(glb.length / 1e6).toFixed(2)} MB`)
}
await write('body-m.glb', parts)

// ── The woman ──────────────────────────────────────────────────────────────

const smoothstep = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Monotone cubic interpolation (Fritsch–Carlson) through [x, y] knots, flat outside them. */
function curve(knots) {
  const n = knots.length
  const xs = knots.map((k) => k[0])
  const ys = knots.map((k) => k[1])
  const d = xs.slice(1).map((x, i) => (ys[i + 1] - ys[i]) / (x - xs[i]))
  const m = ys.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2))
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0
      continue
    }
    const a = m[i] / d[i]
    const b = m[i + 1] / d[i]
    const s = a * a + b * b
    if (s > 9) {
      const t = 3 / Math.sqrt(s)
      m[i] = t * a * d[i]
      m[i + 1] = t * b * d[i]
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0]
    if (x >= xs[n - 1]) return ys[n - 1]
    let i = 0
    while (x > xs[i + 1]) i++
    const h = xs[i + 1] - xs[i]
    const t = (x - xs[i]) / h
    const t2 = t * t
    const t3 = t2 * t
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1]
  }
}
const width = curve(WIDTH)
const depth = curve(DEPTH)
const behind = curve(BEHIND)

/** The trunk and legs: scaled about the body's vertical axis, by height. */
const trunk = (x, y, z) => [x * width(y), y, z * depth(y) * (z < 0 ? behind(y) : 1)]

/** An arm: carried by its shoulder joint, then swung out a little about it. */
const arms = [1, -1].map((side) => {
  const joint = [SHOULDER[0] * side, SHOULDER[1], SHOULDER[2]]
  const moved = trunk(...joint)
  const a = ((CARRY * Math.PI) / 180) * side
  const [c, s] = [Math.cos(a), Math.sin(a)]
  return (x, y, z) => {
    const dx = x - joint[0]
    const dy = y - joint[1]
    return [moved[0] + dx * c - dy * s, moved[1] + dx * s + dy * c, z + moved[2] - joint[2]]
  }
})
const arm = (side) => arms[side === 1 ? 0 : 1]

function breasts(x, y, z, armWeight) {
  const front = smoothstep(0.02, 0.07, z) * (1 - armWeight)
  if (front === 0) return [0, 0, 0]
  const out = [0, 0, 0]
  for (const side of [1, -1]) {
    const dx = x - BREAST.x * side
    const dy = y - BREAST.y
    const g = Math.exp(-((dx / BREAST.wide) ** 2) - (dy / (dy > 0 ? BREAST.up : BREAST.down)) ** 2)
    const lift = BREAST.projection * g * front
    // Mostly forward, a little down and out, as a breast sits.
    const dir = [0.15 * side, -0.12, 1]
    const len = Math.hypot(...dir)
    for (let k = 0; k < 3; k++) out[k] += (lift * dir[k]) / len
  }
  return out
}

// Each skin vertex follows the tissue nearest under it: an arm's bones and muscles, or the trunk's.
// The weight blends over a centimetre, so the armpit and shoulder stretch instead of tearing.
const female = parts.map((p) => {
  const v = new Float32Array(p.positions)
  for (let i = 0; i < v.length / 3; i++) {
    const [x, y, z] = [v[i * 3], v[i * 3 + 1], v[i * 3 + 2]]
    let q
    if (p === skinPart) {
      const near = nearest(x, y, z)
      const w = near.arm === Infinity ? 0 : smoothstep(-0.006, 0.006, near.trunk - near.arm)
      const t = trunk(x, y, z)
      q = w > 0 ? t.map((c, k) => c + (arm(near.armSide)(x, y, z)[k] - c) * w) : t
      const b = breasts(q[0], q[1], q[2], w)
      q = [q[0] + b[0], q[1] + b[1], q[2] + b[2]]
    } else q = p.side ? arm(p.side)(x, y, z) : trunk(x, y, z)
    v[i * 3] = q[0] * HEIGHT
    v[i * 3 + 1] = q[1] * HEIGHT
    v[i * 3 + 2] = q[2] * HEIGHT
  }
  return { ...p, positions: v }
})
await write('body-f.glb', female)
