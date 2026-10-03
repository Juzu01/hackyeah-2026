// Zoom is depth. Everything here is a pure function of the zoom factor
// z = fitDistance / distance: the muscles dissolve into ghosts while the organs
// and bones solidify, then the organs pull apart (exploded view).

export const ZOOM_MIN = 0.85
export const ZOOM_MAX = 9

/** Zoom at which each transition starts and ends. */
export const DEPTH = {
  /** Muscles cross-fade to ghost, organs and bones to solid. */
  reveal: [1.35, 2.0],
  /** Organs slide out along their precomputed offsets. */
  explode: [2.3, 3.6],
  /** Below this zoom the ladder reads "skin" (zoomed out past the full figure). */
  skin: 0.92,
} as const

/** Zoom ranges `focus()` uses so the part's layer is fully active. */
export const FOCUS_ZOOM = {
  muscles: [1.0, 1.3],
  bones: [2.05, 2.25],
  organs: [3.75, ZOOM_MAX],
} as const

export type DepthName = 'skin' | 'muscles' | 'deep' | 'exploded'
export const DEPTH_NAMES: readonly DepthName[] = ['skin', 'muscles', 'deep', 'exploded']

export interface DepthState {
  zoom: number
  /** 1 = solid tissue, 0 = ghost. */
  muscles: number
  deep: number
  /** 0..1 along the explode offsets. */
  explode: number
  /** Strength of the skin shell's rim; fades a little as you go deeper. */
  shell: number
  pickLayer: 'muscles' | 'deep'
  name: DepthName
}

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

export function createDepthState(): DepthState {
  return { zoom: 1, muscles: 1, deep: 0, explode: 0, shell: 1, pickLayer: 'muscles', name: 'muscles' }
}

export function depthAt(z: number, out: DepthState): DepthState {
  const [r0, r1] = DEPTH.reveal
  const reveal = smoothstep(r0, r1, z)
  out.zoom = z
  out.muscles = 1 - reveal
  out.deep = reveal
  out.explode = smoothstep(DEPTH.explode[0], DEPTH.explode[1], z)
  out.shell = 1 - 0.55 * smoothstep(1.1, DEPTH.explode[1], z)
  out.pickLayer = z < (r0 + r1) / 2 ? 'muscles' : 'deep'
  out.name =
    z < DEPTH.skin ? 'skin' : out.pickLayer === 'muscles' ? 'muscles' : out.explode < 0.5 ? 'deep' : 'exploded'
  return out
}
