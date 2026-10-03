// Symptom-checker body map: coarse clickable regions (the WebMD-style "where does
// it hurt?" map) laid over the same figure as anatomy.ts, so the regions and the
// silhouette line up exactly. Front and back views share one skeleton: the back
// view is the figure flipped horizontally, so the figure's left stays its left.

import { FIGURE, type Side } from './anatomy.ts'
import {
  areaCentroid,
  bboxOf,
  mirror,
  mirrorClosed,
  sampleOutline,
  smoothPath,
  unionBBox,
  type BBox,
  type CtrlPt,
  type Pt,
} from './geometry.ts'

export type View = 'front' | 'back'

export interface RegionDef {
  /** Stable id used by the knowledge base; never includes the side. */
  id: string
  /** Label per view. A def without a label for a view is not shown in that view. */
  front?: string
  back?: string
  /** Mirrored into a left and a right copy. */
  paired?: boolean
  /** Closed outlines on the +x side (the figure's left). */
  outlines: CtrlPt[][]
}

export interface Region {
  /** Unique within a view, e.g. `knee-left`. */
  id: string
  defId: string
  name: string
  side?: Side
  /** "lewa strona" / "prawa strona", for paired regions. */
  sideName?: string
  view: View
  paths: string[]
  bbox: BBox
  labelAt: Pt
}

const { upperArm, forearm, hand, thigh, shin, foot, HEAD, EAR, NECK, THUMB } = FIGURE
type Frame = typeof upperArm

const sharp = (p: Pt): CtrlPt => [p[0], p[1], 1]

/**
 * Outline of the part of a limb between `t0` and `t1`. Cuts without a cap are
 * straight (sharp corners), so neighbouring regions meet along one line.
 */
function segment(frame: Frame, t0: number, t1: number, capStart = 0, capEnd = 0, steps = 6): CtrlPt[] {
  const ts = Array.from({ length: steps + 1 }, (_, i) => t0 + ((t1 - t0) * i) / steps)
  const edge = (s: 1 | -1): CtrlPt[] =>
    ts.map((t, i) => {
      const p = frame.at(t, s)
      const cut = (i === 0 && !capStart) || (i === ts.length - 1 && !capEnd)
      return cut ? sharp(p) : p
    })
  const lateral = edge(1)
  const medial = edge(-1).reverse()
  return [
    ...(capStart ? [frame.at(t0 - capStart, 0)] : []),
    ...lateral,
    ...(capEnd ? [frame.at(t1 + capEnd, 0)] : []),
    ...medial,
  ]
}

/** Torso band between two heights, following the torso outline on the +x side. */
const band = (half: CtrlPt[]): CtrlPt[] => mirrorClosed(half)

// Torso bands (y values follow the TORSO outline in anatomy.ts).
const CHEST = band([[0, 116, 1], [20, 118], [42, 128], [68, 136], [86, 144], [96, 158], [95, 178], [86, 198], [80, 224], [78, 236, 1], [0, 236, 1]])
const UPPER_ABDOMEN = band([[0, 236, 1], [78, 236, 1], [74, 256], [67, 290], [65, 318, 1], [0, 318, 1]])
const LOWER_ABDOMEN = band([[0, 318, 1], [65, 318, 1], [71, 348], [79, 378], [82, 402, 1], [0, 402, 1]])
const PELVIS = band([[0, 402, 1], [82, 402, 1], [72, 424], [48, 436], [22, 442], [0, 444]])
const UPPER_BACK = band([[0, 116, 1], [20, 118], [42, 128], [68, 136], [86, 144], [96, 158], [95, 178], [86, 198], [80, 224], [75, 262, 1], [0, 262, 1]])
const LOWER_BACK = band([[0, 262, 1], [75, 262, 1], [67, 290], [65, 316], [71, 348], [79, 378], [82, 402, 1], [0, 402, 1]])

export const REGION_DEFS: RegionDef[] = [
  { id: 'head', front: 'Głowa', back: 'Tył głowy', outlines: [HEAD, EAR, EAR.map(mirror)] },
  { id: 'neck', front: 'Szyja i gardło', outlines: [NECK] },
  { id: 'nape', back: 'Kark', outlines: [NECK] },
  { id: 'chest', front: 'Klatka piersiowa', outlines: [CHEST] },
  { id: 'upper-abdomen', front: 'Brzuch – górna część', outlines: [UPPER_ABDOMEN] },
  { id: 'lower-abdomen', front: 'Brzuch – dolna część', outlines: [LOWER_ABDOMEN] },
  { id: 'pelvis', front: 'Miednica i pachwiny', outlines: [PELVIS] },
  { id: 'upper-back', back: 'Górna część pleców', outlines: [UPPER_BACK] },
  { id: 'lower-back', back: 'Dolna część pleców', outlines: [LOWER_BACK] },
  { id: 'buttocks', back: 'Pośladki i kość ogonowa', outlines: [PELVIS] },
  { id: 'shoulder', front: 'Bark', back: 'Bark', paired: true, outlines: [segment(upperArm, 0, 0.3, 0.07)] },
  { id: 'upper-arm', front: 'Ramię', back: 'Ramię', paired: true, outlines: [segment(upperArm, 0.3, 0.84)] },
  { id: 'elbow', front: 'Łokieć', back: 'Łokieć', paired: true, outlines: [segment(upperArm, 0.84, 1), segment(forearm, 0, 0.17)] },
  { id: 'forearm', front: 'Przedramię', back: 'Przedramię', paired: true, outlines: [segment(forearm, 0.17, 0.84)] },
  { id: 'wrist', front: 'Nadgarstek', back: 'Nadgarstek', paired: true, outlines: [segment(forearm, 0.84, 1), segment(hand, 0, 0.22)] },
  { id: 'hand', front: 'Dłoń i palce', back: 'Grzbiet dłoni', paired: true, outlines: [segment(hand, 0.22, 1, 0, 0.03), THUMB] },
  { id: 'thigh', front: 'Udo', back: 'Tył uda', paired: true, outlines: [segment(thigh, 0, 0.82, 0.03)] },
  { id: 'knee', front: 'Kolano', back: 'Dół podkolanowy', paired: true, outlines: [segment(thigh, 0.82, 1), segment(shin, 0, 0.17)] },
  { id: 'shin', front: 'Goleń', paired: true, outlines: [segment(shin, 0.17, 0.86)] },
  { id: 'calf', back: 'Łydka', paired: true, outlines: [segment(shin, 0.17, 0.86)] },
  { id: 'ankle', front: 'Kostka', back: 'Kostka', paired: true, outlines: [segment(shin, 0.86, 1), segment(foot, 0, 0.35)] },
  { id: 'foot', front: 'Stopa i palce', paired: true, outlines: [segment(foot, 0.35, 1, 0, 0.06)] },
  { id: 'heel', back: 'Pięta i ścięgno Achillesa', paired: true, outlines: [segment(foot, 0.35, 1, 0, 0.06)] },
]

/** Every def id, for validating the knowledge base. */
export const REGION_IDS = REGION_DEFS.map((d) => d.id)

/** Label of a region def, preferring the front view. */
export function regionDefName(defId: string): string {
  const def = REGION_DEFS.find((d) => d.id === defId)
  return def?.front ?? def?.back ?? defId
}

function makeRegion(def: RegionDef, view: View, name: string, side?: Side): Region {
  const outlines = side === 'right' ? def.outlines.map((o) => o.map(mirror)) : def.outlines
  const samples = outlines.map((o) => sampleOutline(o))
  const main = samples.reduce((a, b) => (areaCentroid(a).area >= areaCentroid(b).area ? a : b))
  return {
    id: side ? `${def.id}-${side}` : def.id,
    defId: def.id,
    name,
    side,
    sideName: side === 'left' ? 'lewa strona' : side === 'right' ? 'prawa strona' : undefined,
    view,
    paths: outlines.map(smoothPath),
    bbox: unionBBox(samples.map(bboxOf)),
    labelAt: areaCentroid(main).centroid,
  }
}

/**
 * Regions of one view, in drawing order: torso bands first, limbs over them (the
 * shoulder cap sits on the chest corner), the pelvis over the thigh tops, then
 * neck and head on top.
 */
export function buildRegions(view: View): Region[] {
  const out: Region[] = []
  const order = (id: string) => {
    if (id === 'head') return 4
    if (id === 'neck' || id === 'nape') return 3
    if (id === 'pelvis' || id === 'buttocks') return 2
    return REGION_DEFS.find((d) => d.id === id)?.paired ? 1 : 0
  }
  const defs = [...REGION_DEFS].sort((a, b) => order(a.id) - order(b.id))
  for (const def of defs) {
    const name = def[view]
    if (!name) continue
    if (def.paired) {
      // +x is the figure's left side.
      out.push(makeRegion(def, view, name, 'left'))
      out.push(makeRegion(def, view, name, 'right'))
    } else {
      out.push(makeRegion(def, view, name))
    }
  }
  return out
}

/** Full label, e.g. "Kolano, lewa strona". */
export function regionLabel(region: Pick<Region, 'name' | 'sideName'>): string {
  return region.sideName ? `${region.name}, ${region.sideName}` : region.name
}
