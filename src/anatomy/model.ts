// Loading the atlas and turning it into parts. The GLB is fetched with real
// download progress; when it's missing, the procedural placeholder stands in.
// Each catalog entry becomes a Part: its meshes regrouped under a pivot (the
// explode offset moves the pivot), a ghost twin per mesh, and an anchor point
// on its surface. The explode layout is solved once per session.

import { Box3, Group, Mesh, Vector3, type Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { catalog, partInfo, type CatalogEntry, type PartInfo } from './content.ts'
import { remainingOverlaps, solveExplode, type ExplodeBody, type Pt } from './explode.ts'
import { convexPieces, footprintOf, footprintStats, gridAround, poleOf, rasterize, worldBBox, type Footprint } from './footprint.ts'
import { ORDER, type AtlasMaterials, type Tissue } from './materials.ts'
import { buildPlaceholder } from './placeholder.ts'

export const MODEL_URL = './anatomy/body.glb'

export interface LoadedModel {
  root: Object3D
  source: 'glb' | 'placeholder'
}

/** Fetches and parses the GLB, reporting progress (null while the size is unknown). */
export async function loadModel(onProgress: (fraction: number | null) => void, signal: AbortSignal): Promise<LoadedModel> {
  let bytes: Uint8Array | null = null
  try {
    const res = await fetch(MODEL_URL, { signal })
    if (res.ok && res.body) {
      const total = Number(res.headers.get('content-length')) || 0
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let loaded = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        loaded += value.length
        onProgress(total ? Math.min(1, loaded / total) : null)
      }
      bytes = new Uint8Array(loaded)
      let at = 0
      for (const c of chunks) {
        bytes.set(c, at)
        at += c.length
      }
    }
  } catch (err) {
    if (signal.aborted) throw err
  }
  // Dev servers answer a missing file with index.html; a real GLB starts with "glTF".
  const isGlb = bytes && bytes.length > 12 && String.fromCharCode(...bytes.subarray(0, 4)) === 'glTF'
  if (!bytes || !isGlb) {
    console.info('Atlas: no anatomy/body.glb yet, showing placeholder shapes')
    return { root: buildPlaceholder(catalog), source: 'placeholder' }
  }
  onProgress(1)
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.parseAsync(bytes.buffer as ArrayBuffer, './anatomy/')
  return { root: gltf.scene, source: 'glb' }
}

export interface Part {
  id: string
  /** Position in `parts`, also the id written by the picking pass. */
  index: number
  entry: CatalogEntry
  info: PartInfo
  /** Null for the skin, which is the glass shell rather than tissue. */
  tissue: Tissue | null
  pivot: Group
  meshes: Mesh[]
  ghosts: Mesh[]
  /** World bounds at rest. */
  box: Box3
  /**
   * Where labels point and tests aim (at rest): a point on the part's front
   * surface, inside the area of it that is visible from the front.
   */
  anchor: Vector3
  /** The same, on the back surface, for views from behind. */
  anchorBack: Vector3
  /** World translation at full explode; zero for parts that stay put. */
  offset: Vector3
}

export interface Atlas {
  parts: Part[]
  byId: Map<string, Part>
  skin: Part | null
  /** Rest-pose bounds of the whole body. */
  bounds: Box3
  /** Bounds including where the organs float when exploded. */
  reach: Box3
}

/** Minimum clearance between organs at full explode, and between organs and the bones behind them. */
const EXPLODE_GAP = 0.012
const LIFT_MARGIN = 0.015

export function buildAtlas(model: LoadedModel, materials: AtlasMaterials): Atlas {
  model.root.updateMatrixWorld(true)
  const parts: Part[] = []
  const footprints = new Map<string, Footprint>()
  const missing: string[] = []

  for (const entry of catalog) {
    const node = model.root.getObjectByName(entry.id)
    const meshes: Mesh[] = []
    node?.traverse((o) => {
      if ((o as Mesh).isMesh) meshes.push(o as Mesh)
    })
    if (!meshes.length) {
      missing.push(entry.id)
      continue
    }
    const pivot = new Group()
    pivot.name = `${entry.id}:pivot`
    for (const m of meshes) pivot.attach(m)

    const isSkin = entry.layer === 'shell'
    const tissue = isSkin ? null : materials.tissueFor(entry)
    const ghosts: Mesh[] = []
    for (const m of meshes) {
      m.geometry.computeBoundingSphere()
      if (!m.geometry.getAttribute('normal')) m.geometry.computeVertexNormals()
      if (!tissue) {
        m.material = materials.glass
        m.renderOrder = ORDER.glass
        continue
      }
      m.material = tissue.solid
      m.renderOrder = entry.system === 'bone' ? ORDER.bones : entry.system === 'muscle' ? ORDER.muscles : ORDER.organs
      const ghost = new Mesh(m.geometry, tissue.ghost)
      ghost.position.copy(m.position)
      ghost.quaternion.copy(m.quaternion)
      ghost.scale.copy(m.scale)
      ghost.renderOrder = ORDER.ghosts
      ghost.userData.ghost = true
      pivot.add(ghost)
      ghosts.push(ghost)
    }

    const box = new Box3()
    for (const m of meshes) box.expandByObject(m)
    const anchor = box.getCenter(new Vector3())
    if (!isSkin) footprints.set(entry.id, footprintOf(meshes))
    parts.push({
      id: entry.id,
      index: parts.length,
      entry,
      info: partInfo(entry),
      tissue,
      pivot,
      meshes,
      ghosts,
      box,
      anchor,
      anchorBack: anchor.clone(),
      offset: new Vector3(),
    })
  }
  if (missing.length) console.warn(`Atlas: ${missing.length} catalog parts missing from the model:`, missing.join(', '))

  placeAnchors(parts, footprints)

  solveOffsets(parts, footprints, model)

  const bounds = new Box3()
  const reach = new Box3()
  for (const p of parts) {
    bounds.union(p.box)
    reach.union(p.box)
    if (p.offset.lengthSq() > 0) reach.union(p.box.clone().translate(p.offset))
  }
  return {
    parts,
    byId: new Map(parts.map((p) => [p.id, p])),
    skin: parts.find((p) => p.entry.layer === 'shell') ?? null,
    bounds,
    reach,
  }
}

/** Depth tolerance for "this part is the frontmost surface here". */
const VISIBLE_EPS = 0.006

/**
 * Anchors on the visible surface. A muscle's footprint often lies partly under
 * its neighbours (the brachialis under the biceps), so the anchor is the pole of
 * the area where the part is frontmost among its own system, separately for the
 * front and the back. Organs are seen exploded, on their own: the plain pole.
 */
function placeAnchors(parts: Part[], footprints: Map<string, Footprint>) {
  const layered = new Map<string, Footprint>()
  for (const system of ['muscle', 'bone']) {
    const meshes = parts.filter((p) => p.entry.system === system).flatMap((p) => p.meshes)
    if (meshes.length) layered.set(system, rasterize(meshes, gridAround(worldBBox(meshes), 0.005)))
  }
  for (const p of parts) {
    const fp = footprints.get(p.id)
    if (!fp) continue
    const layer = layered.get(p.entry.system)
    const front = poleOf(layer ? visiblePart(fp, layer, true) : fp)
    const back = poleOf(layer ? visiblePart(fp, layer, false) : fp)
    p.anchor.set(front.x, front.y, front.zFront - 0.002)
    p.anchorBack.set(back.x, back.y, back.zBack + 0.002)
  }
}

/** The cells of `fp` where it is the outermost surface of `layer`, or all of it if that's a sliver. */
function visiblePart(fp: Footprint, layer: Footprint, front: boolean): Footprint {
  const mask = new Uint8Array(fp.mask.length)
  let count = 0
  for (let j = 0; j < fp.ny; j++) {
    for (let i = 0; i < fp.nx; i++) {
      const k = j * fp.nx + i
      if (!fp.mask[k]) continue
      const li = Math.floor((fp.x0 + (i + 0.5) * fp.cell - layer.x0) / layer.cell)
      const lj = Math.floor((fp.y0 + (j + 0.5) * fp.cell - layer.y0) / layer.cell)
      const lk = lj * layer.nx + li
      const outer = front ? fp.zFront[k] >= layer.zFront[lk] - VISIBLE_EPS : fp.zBack[k] <= layer.zBack[lk] + VISIBLE_EPS
      if (outer) {
        mask[k] = 1
        count++
      }
    }
  }
  return count >= Math.max(6, fp.count * 0.06) ? { ...fp, mask, count } : fp
}

/**
 * Explode offsets: XY from the frontal solver, then a forward (Z) lift so each
 * organ floats just in front of the bones behind its exploded position. That
 * keeps every organ visible and tappable from the front at full explode.
 */
function solveOffsets(parts: Part[], footprints: Map<string, Footprint>, model: LoadedModel) {
  const organs = parts.filter((p) => p.entry.explode && footprints.has(p.id))
  if (!organs.length) return
  const cacheKey = `atlas-explode:v3:${model.source}:${organs.map((o) => `${o.id}:${footprints.get(o.id)!.count}`).join(',')}`
  let cached: Record<string, [number, number, number]> | null = null
  try {
    cached = JSON.parse(sessionStorage.getItem(cacheKey) ?? 'null')
  } catch {
    // Storage can be unavailable (private mode); solving again is fine.
  }
  if (cached && organs.every((o) => cached[o.id])) {
    for (const o of organs) o.offset.fromArray(cached[o.id])
    return
  }

  const bodies: ExplodeBody[] = organs.map((o) => {
    const fp = footprints.get(o.id)!
    const { area, centroid, bbox } = footprintStats(fp)
    return { id: o.id, hulls: convexPieces(fp), bbox, area, centroid }
  })
  const xy = solveExplode(bodies, { gap: EXPLODE_GAP })
  if (import.meta.env.DEV) {
    const stuck = remainingOverlaps(bodies, xy)
    if (stuck.length) console.warn('Atlas: organs still overlap when fully exploded:', stuck.join(', '))
  }

  // Front surface of the skeleton, seen from the front, on a 1 cm grid.
  const boneMeshes = parts.filter((p) => p.entry.system === 'bone').flatMap((p) => p.meshes)
  const bones = boneMeshes.length ? rasterize(boneMeshes, gridAround(worldBBox(boneMeshes), 0.01)) : null
  const boneFrontAt = (x: number, y: number) => {
    if (!bones) return -Infinity
    const i = Math.floor((x - bones.x0) / bones.cell)
    const j = Math.floor((y - bones.y0) / bones.cell)
    let z = -Infinity
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        const ii = i + di
        const jj = j + dj
        if (ii >= 0 && jj >= 0 && ii < bones.nx && jj < bones.ny) z = Math.max(z, bones.zFront[jj * bones.nx + ii])
      }
    }
    return z
  }

  const out: Record<string, [number, number, number]> = {}
  for (const o of organs) {
    const fp = footprints.get(o.id)!
    const [dx, dy] = xy.get(o.id) ?? ([0, 0] as Pt)
    let lift = 0
    for (let j = 0; j < fp.ny; j++) {
      for (let i = 0; i < fp.nx; i++) {
        const k = j * fp.nx + i
        if (!fp.mask[k]) continue
        const front = boneFrontAt(fp.x0 + (i + 0.5) * fp.cell + dx, fp.y0 + (j + 0.5) * fp.cell + dy)
        if (front > -Infinity) lift = Math.max(lift, front + LIFT_MARGIN - fp.zBack[k])
      }
    }
    o.offset.set(dx, dy, lift)
    out[o.id] = [dx, dy, lift]
  }
  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(out))
  } catch {
    // Not cached; fine.
  }
}
