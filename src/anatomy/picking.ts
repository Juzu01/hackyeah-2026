// GPU picking. The pickable parts are drawn with flat id colours (and packed
// depth) into a small render target around the pointer, through the main
// camera narrowed by a view offset, so only parts near the pointer are drawn.
// The part under the finger wins; if that pixel is empty, the nearest hit within
// the fat-finger radius does. Exactly what's on screen, exploded or not.

import { Mesh, PerspectiveCamera, Scene, Vector3, WebGLRenderTarget, type ShaderMaterial, type WebGLRenderer } from 'three'
import { pickMaterial } from './materials.ts'
import type { Part } from './model.ts'

/** How far (CSS px) from the finger a part can be and still be picked. */
export const PICK_RADIUS = 18

export interface Hit {
  part: Part
  /** World point that was hit. */
  point: Vector3
  /** Screen distance from the requested point to the hit pixel. */
  distance: number
}

interface Proxy {
  mesh: Mesh
  source: Mesh
  part: Part
}

const SIZE = 2 * PICK_RADIUS + 1
const ray = new Vector3()
const forward = new Vector3()

export class Picker {
  private readonly target = new WebGLRenderTarget(SIZE, SIZE)
  private readonly pixels = new Uint8Array(SIZE * SIZE * 4)
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera()
  private readonly proxies: Proxy[] = []
  private readonly materials: ShaderMaterial[] = []
  private readonly renderer: WebGLRenderer
  private readonly parts: readonly Part[]

  constructor(renderer: WebGLRenderer, parts: readonly Part[]) {
    this.renderer = renderer
    this.parts = parts
    // Proxies copy their source's world matrix before each pass.
    this.scene.matrixWorldAutoUpdate = false
    for (const part of parts) {
      if (!part.tissue) continue
      const material = pickMaterial(part.index)
      this.materials.push(material)
      for (const source of part.meshes) {
        const mesh = new Mesh(source.geometry, material)
        mesh.matrixAutoUpdate = false
        this.scene.add(mesh)
        this.proxies.push({ mesh, source, part })
      }
    }
  }

  /**
   * The pickable part at (x, y) in CSS pixels of a `width` × `height` view, or the
   * nearest one within `radius`. `camera` must have up-to-date matrices.
   */
  pick(
    camera: PerspectiveCamera,
    width: number,
    height: number,
    x: number,
    y: number,
    radius: number,
    pickable: (part: Part) => boolean,
  ): Hit | null {
    let any = false
    for (const p of this.proxies) {
      p.mesh.visible = pickable(p.part)
      if (p.mesh.visible) {
        p.mesh.matrixWorld.copy(p.source.matrixWorld)
        any = true
      }
    }
    if (!any) return null

    const cam = this.camera
    cam.copy(camera, false)
    // The main view may itself be shifted (to keep the selection above a sheet).
    const view = camera.view?.enabled ? camera.view : null
    const ox = (view?.offsetX ?? 0) - PICK_RADIUS
    const oy = (view?.offsetY ?? 0) - PICK_RADIUS
    cam.setViewOffset(width, height, x + ox, y + oy, SIZE, SIZE)
    cam.updateMatrixWorld()
    for (const m of this.materials) {
      m.uniforms.uNear.value = cam.near
      m.uniforms.uFar.value = cam.far
    }

    const r = this.renderer
    const previous = r.getRenderTarget()
    r.setRenderTarget(this.target)
    r.render(this.scene, cam)
    r.setRenderTarget(previous)
    r.readRenderTargetPixels(this.target, 0, 0, SIZE, SIZE, this.pixels)

    const px = this.pixels
    let best = -1
    let bestD = radius * radius + 0.5
    let bestDx = 0
    let bestDy = 0
    for (let j = 0; j < SIZE; j++) {
      // Row 0 of the render target is the bottom of the region.
      const dy = SIZE - 1 - j - PICK_RADIUS
      for (let i = 0; i < SIZE; i++) {
        const o = (j * SIZE + i) * 4
        if (!px[o] && !px[o + 1]) continue
        const dx = i - PICK_RADIUS
        const d = dx * dx + dy * dy
        if (d < bestD) {
          bestD = d
          best = o
          bestDx = dx
          bestDy = dy
        }
      }
    }
    if (best < 0) return null
    const part = this.parts[((px[best] << 8) | px[best + 1]) - 1]
    if (!part) return null

    // Unpack linear view depth and walk the ray through the hit pixel to it.
    const depth = cam.near + ((px[best + 2] + px[best + 3] / 255) / 255) * (cam.far - cam.near)
    ray.set(((x + bestDx) / width) * 2 - 1, -((y + bestDy) / height) * 2 + 1, 0.5).unproject(camera)
    ray.sub(camera.position).normalize()
    camera.getWorldDirection(forward)
    const point = camera.position.clone().addScaledVector(ray, depth / Math.max(1e-6, ray.dot(forward)))
    return { part, point, distance: Math.sqrt(bestD) }
  }

  /** Compiles the id shaders up front, so the first tap doesn't stall. */
  compile(camera: PerspectiveCamera) {
    this.renderer.compile(this.scene, camera)
  }

  dispose() {
    this.target.dispose()
    for (const m of this.materials) m.dispose()
  }
}
