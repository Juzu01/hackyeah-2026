// Hairline tethers from each exploded organ back to where it sits in the body,
// with a small dot at the origin. Drawn over the bones and under the organs.

import { BufferAttribute, BufferGeometry, Group, LineSegments, Points, type ShaderMaterial } from 'three'
import { ACCENT, HAIR, ORDER, tetherMaterial } from './materials.ts'
import type { Part } from './model.ts'

export class Tethers {
  readonly group = new Group()
  private readonly organs: Part[]
  private readonly linePos: Float32Array
  private readonly lineColor: Float32Array
  private readonly dotPos: Float32Array
  private readonly dotColor: Float32Array
  private readonly lines: LineSegments<BufferGeometry, ShaderMaterial>
  private readonly dots: Points<BufferGeometry, ShaderMaterial>
  private lastExplode = -1
  private lastSelected: string | null = null

  constructor(parts: readonly Part[]) {
    this.organs = parts.filter((p) => p.offset.lengthSq() > 1e-6)
    const n = this.organs.length
    this.linePos = new Float32Array(n * 6)
    this.lineColor = new Float32Array(n * 8)
    this.dotPos = new Float32Array(n * 3)
    this.dotColor = new Float32Array(n * 4)

    const lineGeo = new BufferGeometry()
    lineGeo.setAttribute('position', new BufferAttribute(this.linePos, 3))
    lineGeo.setAttribute('aColor', new BufferAttribute(this.lineColor, 4))
    this.lines = new LineSegments(lineGeo, tetherMaterial(false))
    const dotGeo = new BufferGeometry()
    dotGeo.setAttribute('position', new BufferAttribute(this.dotPos, 3))
    dotGeo.setAttribute('aColor', new BufferAttribute(this.dotColor, 4))
    this.dots = new Points(dotGeo, tetherMaterial(true))
    for (const o of [this.lines, this.dots]) {
      o.renderOrder = ORDER.tethers
      // Endpoints move every frame; skip culling rather than recomputing bounds.
      o.frustumCulled = false
    }
    this.organs.forEach((o, i) => this.dotPos.set([o.anchor.x, o.anchor.y, o.anchor.z], i * 3))
    this.group.add(this.lines, this.dots)
    this.group.visible = false
  }

  setPixelRatio(ratio: number) {
    this.dots.material.uniforms.uSize.value = 4.5 * ratio
  }

  update(explode: number, selected: string | null) {
    this.group.visible = explode > 0.01
    if (!this.group.visible || (explode === this.lastExplode && selected === this.lastSelected)) return
    this.lastExplode = explode
    this.lastSelected = selected
    const { linePos: lp, lineColor: lc, dotColor: dc } = this
    this.organs.forEach((o, i) => {
      const a = o.anchor
      lp[i * 6] = a.x
      lp[i * 6 + 1] = a.y
      lp[i * 6 + 2] = a.z
      lp[i * 6 + 3] = a.x + o.offset.x * explode
      lp[i * 6 + 4] = a.y + o.offset.y * explode
      lp[i * 6 + 5] = a.z + o.offset.z * explode
      const on = o.id === selected
      const c = on ? ACCENT : HAIR
      const alpha = on ? 0.9 : 0.42
      for (let v = 0; v < 2; v++) {
        lc[i * 8 + v * 4] = c.r
        lc[i * 8 + v * 4 + 1] = c.g
        lc[i * 8 + v * 4 + 2] = c.b
        // Fades towards the origin, so the line reads as coming out of the body.
        lc[i * 8 + v * 4 + 3] = v ? alpha : alpha * 0.55
      }
      dc[i * 4] = c.r
      dc[i * 4 + 1] = c.g
      dc[i * 4 + 2] = c.b
      dc[i * 4 + 3] = on ? 1 : 0.75
    })
    this.lines.geometry.attributes.position.needsUpdate = true
    this.lines.geometry.attributes.aColor.needsUpdate = true
    this.dots.geometry.attributes.aColor.needsUpdate = true
    const opacity = Math.min(1, explode * 1.6)
    this.lines.material.uniforms.uOpacity.value = opacity
    this.dots.material.uniforms.uOpacity.value = opacity
  }

  dispose() {
    this.lines.geometry.dispose()
    this.lines.material.dispose()
    this.dots.geometry.dispose()
    this.dots.material.dispose()
  }
}
