// Materials: the glass skin shell, solid tissue (with the selection lift, accent
// rim and the desaturation of everything else), fresnel ghosts for inactive
// layers, the selection outline, tethers, and the flat id material used for GPU
// picking. One set per tissue, shared by every part made of it.

import {
  BackSide,
  Color,
  CustomBlending,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SrcAlphaFactor,
  type Material,
} from 'three'
import type { CatalogEntry } from './content.ts'

export const ACCENT = new Color('#5BE3CF')
export const GLASS = new Color('#BFDDF5')
export const HAIR = new Color('#BED7EB')

/**
 * A calm anatomical model rather than raw tissue: warm, desaturated rose and
 * terracotta for muscle, ivory bone, and organs in the same soft family.
 */
const TISSUE_COLORS: Record<string, string> = {
  muscle: '#B66F66',
  bone: '#D3C8B4',
  brain: '#D8B4B2',
  heart: '#B9575B',
  aorta: '#BE6064',
  lungs: '#DDA9A4',
  trachea: '#C9D3D6',
  esophagus: '#C9918A',
  thyroid: '#B5676F',
  liver: '#9C5A50',
  gallbladder: '#86A07A',
  stomach: '#D8AA93',
  spleen: '#8F6274',
  pancreas: '#DDC198',
  kidneys: '#A9625C',
  'small-intestine': '#DDAAA1',
  'large-intestine': '#C49783',
  'urinary-bladder': '#D9C291',
}

/**
 * Render order. Bones draw first and the tethers over them, so organs then cover
 * the tethers; muscles after organs, so a fading muscle layer blends over the
 * organs; then ghosts, the selection outline, the glass skin and the x-ray.
 */
export const ORDER = {
  bones: -2,
  tethers: -1,
  organs: 0,
  muscles: 0.5,
  shadow: 2,
  ghosts: 3,
  outline: 4,
  glass: 5,
  xray: 6,
} as const

export function tissueKey(entry: CatalogEntry): string {
  if (entry.system === 'muscle' || entry.system === 'bone') return entry.system
  const base = entry.id.replace(/-(left|right)$/, '')
  return base === 'lung' ? 'lungs' : base === 'kidney' ? 'kidneys' : base
}

const FRESNEL_VERT = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewV;
varying float vWorldY;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * world;
  vWorldY = world.y;
  vViewV = -mv.xyz;
  vNormalV = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`

/** Fresnel x-ray: almost clear face-on, glowing at the silhouette. */
const GHOST_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uRim;
uniform float uFace;
uniform float uOpacity;
varying vec3 vNormalV;
varying vec3 vViewV;
void main() {
  float f = 1.0 - abs(dot(normalize(vNormalV), normalize(vViewV)));
  gl_FragColor = vec4(uColor, (uFace + pow(f, 2.2) * uRim) * uOpacity);
  #include <colorspace_fragment>
}`

/** The skin: a glass shell with a travelling band of brighter rim light (the scan sweep). */
const GLASS_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uRim;
uniform float uOpacity;
uniform float uScanY;
uniform float uScan;
varying vec3 vNormalV;
varying vec3 vViewV;
varying float vWorldY;
void main() {
  float f = 1.0 - abs(dot(normalize(vNormalV), normalize(vViewV)));
  float rim = pow(f, 2.4);
  float alpha = 0.025 + rim * 0.55 * uRim;
  float d = (vWorldY - uScanY) / 0.075;
  float band = exp(-d * d) * uScan;
  alpha += band * (0.09 + rim * 0.7);
  gl_FragColor = vec4(mix(uColor, vec3(1.0), band * 0.5), alpha * uOpacity);
  #include <colorspace_fragment>
}`

/** Back faces pushed out along the normal by a constant number of screen pixels. */
const OUTLINE_VERT = /* glsl */ `
uniform float uWidth;
uniform vec2 uResolution;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec2 dir = (projectionMatrix * vec4(normalMatrix * normal, 0.0)).xy;
  float len = length(dir);
  if (len > 1e-6) clip.xy += dir / len * uWidth * 2.0 / uResolution * clip.w;
  gl_Position = clip;
}`

const FLAT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(uColor, uOpacity);
  #include <colorspace_fragment>
}`

/** Part index and linear depth packed into RGBA8 for the picking pass. */
const PICK_VERT = /* glsl */ `
varying float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`

const PICK_FRAG = /* glsl */ `
uniform vec2 uId;
uniform float uNear;
uniform float uFar;
varying float vDepth;
void main() {
  float d = clamp((vDepth - uNear) / (uFar - uNear), 0.0, 1.0) * 255.0;
  gl_FragColor = vec4(uId, floor(d) / 255.0, fract(d));
}`

const TETHER_VERT = /* glsl */ `
attribute vec4 aColor;
uniform float uSize;
varying vec4 vColor;
void main() {
  vColor = aColor;
  gl_PointSize = uSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const TETHER_FRAG = /* glsl */ `
uniform float uOpacity;
uniform float uRound;
varying vec4 vColor;
void main() {
  float a = vColor.a * uOpacity;
  if (uRound > 0.5) {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    a *= 1.0 - smoothstep(0.55, 1.0, r);
  }
  gl_FragColor = vec4(vColor.rgb, a);
  #include <colorspace_fragment>
}`

/** Alpha blending that still renders in the opaque pass, so render order places it between bones and organs. */
function blendInOpaquePass(m: Material) {
  m.transparent = false
  m.blending = CustomBlending
  m.blendSrc = SrcAlphaFactor
  m.blendDst = OneMinusSrcAlphaFactor
  m.blendSrcAlpha = OneFactor
  m.blendDstAlpha = OneMinusSrcAlphaFactor
}

export function ghostMaterial(color: Color, rim: number, face: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uRim: { value: rim },
      uFace: { value: face },
      uOpacity: { value: 1 },
    },
    vertexShader: FRESNEL_VERT,
    fragmentShader: GHOST_FRAG,
    transparent: true,
    depthWrite: false,
  })
}

export function glassMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: GLASS.clone() },
      uRim: { value: 1 },
      uOpacity: { value: 1 },
      uScanY: { value: 10 },
      uScan: { value: 0 },
    },
    vertexShader: FRESNEL_VERT,
    fragmentShader: GLASS_FRAG,
    transparent: true,
    depthWrite: false,
  })
}

export function outlineMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: ACCENT },
      uOpacity: { value: 1 },
      uWidth: { value: 2 },
      uResolution: { value: [1, 1] },
    },
    vertexShader: OUTLINE_VERT,
    fragmentShader: FLAT_FRAG,
    side: BackSide,
    transparent: true,
    depthWrite: false,
  })
}

export function pickMaterial(index: number): ShaderMaterial {
  const id = index + 1
  return new ShaderMaterial({
    uniforms: { uId: { value: [(id >> 8) / 255, (id & 255) / 255] }, uNear: { value: 0.01 }, uFar: { value: 50 } },
    vertexShader: PICK_VERT,
    fragmentShader: PICK_FRAG,
  })
}

export function tetherMaterial(points: boolean): ShaderMaterial {
  const m = new ShaderMaterial({
    uniforms: { uOpacity: { value: 1 }, uSize: { value: 4 }, uRound: { value: points ? 1 : 0 } },
    vertexShader: TETHER_VERT,
    fragmentShader: TETHER_FRAG,
    depthTest: false,
    depthWrite: false,
  })
  blendInOpaquePass(m)
  return m
}

type Tissue3D = MeshStandardMaterial | MeshPhysicalMaterial

/**
 * Adds the accent rim, the selection lift and the desaturation to a lit material.
 * Every tissue uses the same patch, so normal and selected instances share one program.
 */
function patchTissue(m: Tissue3D, desat: { value: number }, rim: { value: number }) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uDesat = desat
    shader.uniforms.uRim = rim
    shader.uniforms.uRimColor = { value: ACCENT }
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uDesat;\nuniform float uRim;\nuniform vec3 uRimColor;\nvoid main() {')
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        float nv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
        outgoingLight += uRimColor * pow(1.0 - nv, 3.4) * uRim;
        outgoingLight = mix(outgoingLight, vec3(dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722))), uDesat);
        #include <opaque_fragment>`,
      )
  }
  m.customProgramCacheKey = () => 'atlas-tissue'
}

export interface Tissue {
  key: string
  layer: 'muscles' | 'deep'
  color: Color
  solid: Tissue3D
  /** The same tissue, lifted and rimmed, for the selected part only. */
  selected: Tissue3D
  ghost: ShaderMaterial
}

function lit(key: string, color: Color): Tissue3D {
  if (key === 'muscle') return new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 })
  if (key === 'bone') return new MeshStandardMaterial({ color, roughness: 0.75, metalness: 0 })
  return new MeshPhysicalMaterial({ color, roughness: 0.45, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.4 })
}

/** Shared material set for the whole atlas. */
export class AtlasMaterials {
  readonly glass = glassMaterial()
  readonly outline = outlineMaterial()
  /** The selected part, when its layer is ghosted: an accent x-ray drawn through everything. */
  readonly xray = ghostMaterial(ACCENT, 0.7, 0.07)
  readonly tissues = new Map<string, Tissue>()
  /** How far unselected tissue desaturates towards grey (0..1). */
  readonly desat = { value: 0 }
  private readonly noRim = { value: 0 }
  private readonly selRim = { value: 0.6 }
  private readonly noDesat = { value: 0 }

  constructor() {
    this.xray.depthTest = false
  }

  tissueFor(entry: CatalogEntry): Tissue {
    const key = tissueKey(entry)
    let t = this.tissues.get(key)
    if (!t) {
      const color = new Color(TISSUE_COLORS[key] ?? '#A07870')
      const solid = lit(key, color)
      patchTissue(solid, this.desat, this.noRim)
      const selected = lit(key, color)
      selected.emissive.copy(color).multiplyScalar(0.12)
      patchTissue(selected, this.noDesat, this.selRim)
      // Ghosts read a little lighter than the tissue so they show on the dark canvas.
      const ghostColor = color.clone().lerp(new Color('#ffffff'), key === 'bone' ? 0.1 : 0.32)
      const ghost = key === 'muscle' ? ghostMaterial(ghostColor, 0.13, 0.004) : ghostMaterial(ghostColor, 0.18, 0.006)
      t = { key, layer: entry.layer === 'muscles' ? 'muscles' : 'deep', color, solid, selected, ghost }
      this.tissues.set(key, t)
    }
    return t
  }

  /** Every material whose shader variants should be compiled before the first frame. */
  all(): Material[] {
    const out: Material[] = [this.glass, this.outline, this.xray]
    for (const t of this.tissues.values()) out.push(t.solid, t.selected, t.ghost)
    return out
  }
}

/** Cross-fades a solid material: opaque at 1, blended below, hidden at 0. */
export function setSolidWeight(m: Material, w: number) {
  const transparent = w < 0.999
  if (m.transparent !== transparent) {
    m.transparent = transparent
    m.needsUpdate = true
  }
  m.opacity = w
  m.visible = w > 0.002
}

export function setGhostWeight(m: ShaderMaterial, w: number) {
  m.uniforms.uOpacity.value = w
  m.visible = w > 0.002
}
