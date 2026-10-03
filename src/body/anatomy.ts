// The body model: every clickable part (muscles, organs) plus the skin silhouette,
// in a front (anterior) view. World units: the head top is y = 0, the soles are
// y ≈ 806, x = 0 is the midline. Shapes are written for the +x side, which is the
// figure's LEFT side (we face the figure), and mirrored for the figure's right.

import {
  areaCentroid,
  bboxOf,
  convexHull,
  limbFrame,
  mirror,
  mirrorClosed,
  sampleOutline,
  smoothOpenPath,
  smoothPath,
  tube,
  unionBBox,
  type BBox,
  type CtrlPt,
  type Pt,
} from './geometry.ts'

export type BodySystem = 'muscle' | 'organ'
export type Side = 'left' | 'right'

/** One anatomical structure; left/right copies of a muscle share it. */
export interface PartInfo {
  key: string
  name: string
  latin: string
  system: BodySystem
  description: string
}

export interface BodyPart {
  id: string
  info: PartInfo
  /** The figure's own side, not the viewer's. */
  side?: Side
  d: string
  /** Decorative strokes drawn inside the shape (folds, fissures, rings). */
  details?: string
  color: string
  /** Convex pieces used for collision in the explode solver. */
  hulls: Pt[][]
  bbox: BBox
  centroid: Pt
  area: number
}

export interface BodyModel {
  skin: string[]
  muscles: BodyPart[]
  organs: BodyPart[]
  bounds: BBox
}

// ---------------------------------------------------------------------------
// Catalogue

const muscle = (key: string, name: string, latin: string, description: string): PartInfo => ({
  key,
  name,
  latin,
  system: 'muscle',
  description,
})
const organ = (key: string, name: string, latin: string, description: string): PartInfo => ({
  key,
  name,
  latin,
  system: 'organ',
  description,
})

export const INFO = {
  sternocleidomastoid: muscle('sternocleidomastoid', 'Mięsień mostkowo-obojczykowo-sutkowy', 'musculus sternocleidomastoideus', 'Obraca i zgina głowę; dobrze widać go po bokach szyi.'),
  trapezius: muscle('trapezius', 'Mięsień czworoboczny', 'musculus trapezius', 'Unosi i ściąga barki; często napięty przy długiej pracy przy biurku.'),
  deltoid: muscle('deltoid', 'Mięsień naramienny', 'musculus deltoideus', 'Odwodzi ramię i nadaje barkowi zaokrąglony kształt.'),
  pectoralis: muscle('pectoralis', 'Mięsień piersiowy większy', 'musculus pectoralis major', 'Przywodzi ramię i obraca je do wewnątrz — główny mięsień przy pompkach.'),
  serratus: muscle('serratus', 'Mięsień zębaty przedni', 'musculus serratus anterior', 'Dociska łopatkę do klatki piersiowej i pomaga unieść rękę nad głowę.'),
  rectusAbdominis: muscle('rectusAbdominis', 'Mięsień prosty brzucha', 'musculus rectus abdominis', 'Zgina tułów i stabilizuje miednicę — to on tworzy „kaloryfer”.'),
  obliqueExternal: muscle('obliqueExternal', 'Mięsień skośny zewnętrzny brzucha', 'musculus obliquus externus abdominis', 'Skręca i zgina tułów na boki, wspiera tłocznię brzuszną.'),
  biceps: muscle('biceps', 'Mięsień dwugłowy ramienia', 'musculus biceps brachii', 'Zgina łokieć i obraca przedramię na zewnątrz (supinacja).'),
  triceps: muscle('triceps', 'Mięsień trójgłowy ramienia', 'musculus triceps brachii', 'Prostuje łokieć — główny antagonista bicepsa.'),
  brachialis: muscle('brachialis', 'Mięsień ramienny', 'musculus brachialis', 'Najsilniejszy zginacz łokcia, leży pod bicepsem.'),
  brachioradialis: muscle('brachioradialis', 'Mięsień ramienno-promieniowy', 'musculus brachioradialis', 'Zgina łokieć, zwłaszcza przy chwycie młotkowym.'),
  forearmFlexors: muscle('forearmFlexors', 'Zginacze nadgarstka i palców', 'musculi flexores antebrachii', 'Grupa mięśni zginających nadgarstek i palce — odpowiada za siłę chwytu.'),
  tensorFasciaeLatae: muscle('tensorFasciaeLatae', 'Mięsień napinacz powięzi szerokiej', 'musculus tensor fasciae latae', 'Stabilizuje biodro i kolano podczas chodu i biegu.'),
  sartorius: muscle('sartorius', 'Mięsień krawiecki', 'musculus sartorius', 'Najdłuższy mięsień człowieka; zgina biodro i kolano.'),
  rectusFemoris: muscle('rectusFemoris', 'Mięsień prosty uda', 'musculus rectus femoris', 'Część mięśnia czworogłowego; prostuje kolano i zgina biodro.'),
  vastusLateralis: muscle('vastusLateralis', 'Mięsień obszerny boczny', 'musculus vastus lateralis', 'Największa głowa mięśnia czworogłowego uda; prostuje kolano.'),
  vastusMedialis: muscle('vastusMedialis', 'Mięsień obszerny przyśrodkowy', 'musculus vastus medialis', 'Stabilizuje rzepkę i domyka wyprost kolana.'),
  adductors: muscle('adductors', 'Mięśnie przywodziciele uda', 'musculi adductores', 'Przyciągają udo do osi ciała i stabilizują miednicę.'),
  tibialisAnterior: muscle('tibialisAnterior', 'Mięsień piszczelowy przedni', 'musculus tibialis anterior', 'Unosi stopę ku górze — kluczowy przy każdym kroku.'),
  fibularisLongus: muscle('fibularisLongus', 'Mięsień strzałkowy długi', 'musculus fibularis longus', 'Obraca stopę na zewnątrz i podtrzymuje jej łuk.'),
  gastrocnemius: muscle('gastrocnemius', 'Mięsień brzuchaty łydki', 'musculus gastrocnemius', 'Unosi piętę przy chodzie, bieganiu i skokach.'),
  soleus: muscle('soleus', 'Mięsień płaszczkowaty', 'musculus soleus', 'Utrzymuje postawę stojącą i pomaga pompować krew z nóg do serca.'),

  brain: organ('brain', 'Mózg', 'encephalon', 'Centrum sterowania: przetwarza bodźce, steruje ruchem, pamięcią i emocjami.'),
  thyroid: organ('thyroid', 'Tarczyca', 'glandula thyroidea', 'Wydziela hormony regulujące metabolizm i tempo przemiany materii.'),
  trachea: organ('trachea', 'Tchawica', 'trachea', 'Rura z chrzęstnych pierścieni, która prowadzi powietrze do oskrzeli.'),
  esophagus: organ('esophagus', 'Przełyk', 'oesophagus', 'Przesuwa pokarm z gardła do żołądka ruchami perystaltycznymi.'),
  lungRight: organ('lungRight', 'Płuco prawe', 'pulmo dexter', 'Ma trzy płaty; wymienia tlen i dwutlenek węgla między powietrzem a krwią.'),
  lungLeft: organ('lungLeft', 'Płuco lewe', 'pulmo sinister', 'Ma dwa płaty i wcięcie sercowe, bo dzieli miejsce z sercem.'),
  heart: organ('heart', 'Serce', 'cor', 'Mięśniowa pompa — w spoczynku bije zwykle 60–100 razy na minutę.'),
  liver: organ('liver', 'Wątroba', 'hepar', 'Największy gruczoł ciała: oczyszcza krew, magazynuje glikogen i wytwarza żółć.'),
  gallbladder: organ('gallbladder', 'Pęcherzyk żółciowy', 'vesica biliaris', 'Magazynuje i zagęszcza żółć potrzebną do trawienia tłuszczów.'),
  stomach: organ('stomach', 'Żołądek', 'gaster', 'Miesza pokarm z sokiem żołądkowym i wstępnie go trawi.'),
  spleen: organ('spleen', 'Śledziona', 'lien', 'Filtruje krew, usuwa zużyte krwinki i wspiera odporność.'),
  pancreas: organ('pancreas', 'Trzustka', 'pancreas', 'Wydziela enzymy trawienne oraz insulinę i glukagon, które regulują poziom cukru.'),
  kidney: organ('kidney', 'Nerka', 'ren', 'Filtruje krew i wytwarza mocz; reguluje ciśnienie i gospodarkę wodną.'),
  smallIntestine: organ('smallIntestine', 'Jelito cienkie', 'intestinum tenue', 'Ma kilka metrów długości — tu wchłania się większość składników odżywczych.'),
  largeIntestine: organ('largeIntestine', 'Jelito grube', 'intestinum crassum', 'Odzyskuje wodę i elektrolity; mieszka w nim większość mikrobioty.'),
  bladder: organ('bladder', 'Pęcherz moczowy', 'vesica urinaria', 'Gromadzi mocz — mieści zwykle 400–600 ml.'),
} satisfies Record<string, PartInfo>

const ORGAN_COLORS: Record<string, string> = {
  brain: '#e7a3b4',
  thyroid: '#cf4d68',
  trachea: '#a9c7d8',
  esophagus: '#d98a80',
  lungRight: '#ec8f9b',
  lungLeft: '#ec8f9b',
  heart: '#d1293f',
  liver: '#9a3328',
  gallbladder: '#58a35f',
  stomach: '#eaa37f',
  spleen: '#8a3a6e',
  pancreas: '#e9c27a',
  kidney: '#b13a33',
  smallIntestine: '#f0a9a0',
  largeIntestine: '#d58a6e',
  bladder: '#e8c95c',
}

// ---------------------------------------------------------------------------
// Skeleton of the figure: limb frames shared by skin and muscles (+x side).

const upperArm = limbFrame([84, 152], [121, 298], [
  [0, 22, 24],
  [0.12, 22, 28],
  [0.32, 20, 26],
  [0.55, 18, 21],
  [0.8, 15, 17],
  [1, 14, 15],
])
const forearm = limbFrame([121, 298], [151, 410], [
  [0, 14, 15],
  [0.18, 16, 18],
  [0.45, 13, 14],
  [0.8, 10, 10.5],
  [1, 9, 9.5],
])
const hand = limbFrame([151, 408], [164, 482], [
  [0, 9, 9.5],
  [0.25, 12, 12],
  [0.6, 12, 11],
  [0.85, 9, 8],
  [1, 4, 4],
])
const thigh = limbFrame([42, 410], [38, 592], [
  [0, 38, 40],
  [0.12, 36, 38],
  [0.4, 30, 31],
  [0.7, 22, 23],
  [0.9, 17, 18],
  [1, 16, 16],
])
const shin = limbFrame([38, 590], [35, 762], [
  [0, 16, 17],
  [0.15, 20, 18],
  [0.35, 18, 17],
  [0.6, 13, 13],
  [0.85, 10, 10],
  [1, 9.5, 9],
])
const foot = limbFrame([35, 758], [42, 806], [
  [0, 10, 10],
  [0.4, 13, 14],
  [0.75, 16, 16],
  [1, 15, 15],
])

// ---------------------------------------------------------------------------
// Skin silhouette (not clickable)

const HEAD = mirrorClosed([[0, 0], [20, 4], [31, 16], [36, 36], [36, 54], [33, 68], [27, 82], [18, 93], [9, 99], [0, 101]])
const EAR: CtrlPt[] = [[32, 42], [39, 40], [42, 48], [40, 60], [33, 66]]
const NECK = mirrorClosed([[0, 84], [16, 86], [17, 100], [19, 114], [26, 126], [0, 130]])
const TORSO = mirrorClosed([
  [0, 114], [20, 116], [42, 126], [68, 134], [86, 142], [96, 156], [95, 178], [86, 198], [80, 224],
  [74, 256], [67, 290], [65, 316], [71, 348], [79, 378], [82, 402], [72, 424], [48, 436], [22, 442], [0, 444],
])
const THUMB = hand.map([[0.1, 0.6], [0.28, 1.25], [0.48, 1.55], [0.6, 1.4], [0.45, 0.9], [0.32, 0.55]])

const SKIN_RIGHT_HALF: CtrlPt[][] = [
  upperArm.outline(0.06),
  forearm.outline(),
  thigh.outline(0.02),
  shin.outline(),
  hand.outline(0.02, 0.02),
  THUMB,
  foot.outline(0.06, 0.02),
  EAR,
]

// ---------------------------------------------------------------------------
// Muscles (+x side; limb muscles in limb-local [t, s] coordinates)

type MuscleDef = { info: PartInfo; pts: CtrlPt[]; details?: CtrlPt[][] }

const MUSCLES: MuscleDef[] = [
  {
    info: INFO.sternocleidomastoid,
    pts: [[19, 88], [22, 92], [16, 106], [8, 121], [4, 128], [1, 126], [6, 114], [13, 98]],
  },
  {
    info: INFO.trapezius,
    pts: [[18, 108], [26, 118], [46, 128], [72, 136], [84, 142], [72, 145], [48, 139], [28, 132], [20, 124]],
  },
  {
    info: INFO.pectoralis,
    pts: [[3, 146], [24, 140], [50, 141], [72, 148], [86, 158], [90, 170], [84, 182], [70, 196], [50, 206], [28, 208], [10, 202], [3, 184]],
    details: [[[8, 160], [40, 166], [80, 172]], [[8, 184], [40, 186], [76, 182]]],
  },
  {
    info: INFO.serratus,
    pts: [[70, 204], [80, 202], [82, 216], [79, 236], [75, 252], [69, 258], [67, 246], [66, 228], [66, 212]],
    details: [[[67, 220], [80, 216]], [[67, 236], [79, 232]], [[68, 250], [76, 247]]],
  },
  {
    info: INFO.obliqueExternal,
    pts: [[27, 216], [46, 214], [60, 226], [65, 250], [64, 290], [65, 318], [72, 350], [77, 374], [64, 384], [44, 394], [30, 394], [27, 360], [28, 300], [28, 250]],
    details: [[[34, 236], [58, 262]], [[34, 270], [62, 300]], [[34, 306], [66, 340]]],
  },
  {
    info: INFO.deltoid,
    pts: upperArm.map([[-0.06, -0.45], [-0.08, 0.2], [0.0, 0.85], [0.12, 1.02], [0.28, 0.95], [0.42, 0.62], [0.47, 0.35, 1], [0.36, 0.0], [0.22, -0.3], [0.08, -0.52]]),
  },
  {
    info: INFO.biceps,
    pts: upperArm.map([[0.3, -0.45], [0.32, 0.2], [0.45, 0.45], [0.65, 0.5], [0.84, 0.3], [0.95, 0.05, 1], [0.88, -0.3], [0.7, -0.6], [0.5, -0.65]]),
  },
  {
    info: INFO.triceps,
    pts: upperArm.map([[0.28, -0.75], [0.45, -0.97], [0.72, -0.97], [0.9, -0.8], [0.75, -0.72], [0.5, -0.8]]),
  },
  {
    info: INFO.brachialis,
    pts: upperArm.map([[0.52, 0.66], [0.7, 0.96], [0.93, 0.78], [0.97, 0.38], [0.88, 0.42], [0.7, 0.6]]),
  },
  {
    info: INFO.brachioradialis,
    pts: forearm.map([[-0.06, 0.35], [-0.02, 0.95], [0.22, 1.02], [0.55, 0.8], [0.9, 0.45], [0.96, 0.2], [0.75, 0.25], [0.45, 0.3], [0.15, 0.25]]),
  },
  {
    info: INFO.forearmFlexors,
    pts: forearm.map([[0.04, -0.85], [0.06, 0.12], [0.3, 0.14], [0.6, 0.18], [0.92, 0.04], [0.96, -0.55], [0.75, -0.92], [0.35, -1.0]]),
    details: [forearm.map([[0.12, -0.3], [0.5, -0.25], [0.9, -0.2]])],
  },
  {
    info: INFO.tensorFasciaeLatae,
    pts: thigh.map([[-0.02, 0.7], [-0.03, 0.98], [0.18, 1.02], [0.3, 0.98], [0.2, 0.86], [0.06, 0.74]]),
  },
  {
    info: INFO.adductors,
    pts: thigh.map([[0.02, -0.2], [0.0, -0.62], [0.06, -0.96], [0.3, -1.0], [0.52, -0.88], [0.58, -0.72], [0.42, -0.42], [0.24, -0.08], [0.1, 0.1]]),
  },
  {
    info: INFO.vastusLateralis,
    pts: thigh.map([[0.3, 1.0], [0.55, 1.02], [0.8, 0.92], [0.92, 0.65], [0.9, 0.38], [0.82, 0.4], [0.62, 0.62], [0.38, 0.86]]),
  },
  {
    info: INFO.vastusMedialis,
    pts: thigh.map([[0.6, -0.12], [0.72, -0.34], [0.86, -0.48], [0.95, -0.5], [0.99, -0.3], [0.95, -0.08], [0.88, 0.0], [0.76, -0.06]]),
  },
  {
    info: INFO.rectusFemoris,
    pts: thigh.map([[0.1, 0.66], [0.14, 0.84], [0.35, 0.78], [0.6, 0.55], [0.82, 0.28], [0.9, 0.08, 1], [0.84, -0.12], [0.7, -0.22], [0.55, 0.0], [0.38, 0.3], [0.22, 0.52]]),
  },
  {
    info: INFO.sartorius,
    pts: thigh.map([[-0.04, 0.52, 1], [0.08, 0.62], [0.28, 0.3], [0.5, -0.08], [0.72, -0.42], [0.95, -0.62], [1.0, -0.78, 1], [0.9, -0.9], [0.66, -0.68], [0.42, -0.35], [0.2, 0.05], [-0.02, 0.4]]),
  },
  {
    info: INFO.tibialisAnterior,
    pts: shin.map([[0.04, 0.08], [0.06, 0.52], [0.3, 0.55], [0.6, 0.42], [0.86, 0.15], [0.95, -0.05, 1], [0.86, -0.12], [0.55, 0.02], [0.25, -0.05]]),
  },
  {
    info: INFO.fibularisLongus,
    pts: shin.map([[0.06, 0.66], [0.1, 0.98], [0.4, 0.98], [0.68, 0.72], [0.62, 0.58], [0.38, 0.68], [0.2, 0.64]]),
  },
  {
    info: INFO.gastrocnemius,
    pts: shin.map([[0.04, -0.55], [0.1, -0.98], [0.32, -1.02], [0.5, -0.82], [0.52, -0.62], [0.36, -0.45], [0.18, -0.42]]),
  },
  {
    info: INFO.soleus,
    pts: shin.map([[0.5, -0.94], [0.66, -0.98], [0.84, -0.78], [0.82, -0.54], [0.66, -0.46], [0.56, -0.62]]),
  },
]

// Midline muscle, drawn whole.
const RECTUS_ABDOMINIS = mirrorClosed([[0, 210], [16, 211], [23, 226], [25, 262], [24, 310], [21, 360], [14, 398], [6, 418], [0, 422]])
const RECTUS_DETAILS: CtrlPt[][] = [
  [[0, 214], [0, 418]],
  [[-23, 246], [0, 250], [23, 246]],
  [[-24, 282], [0, 286], [24, 282]],
  [[-23, 318], [0, 322], [23, 318]],
]

// ---------------------------------------------------------------------------
// Organs

const shift = (pts: readonly CtrlPt[], dx: number, dy: number): CtrlPt[] =>
  pts.map((p) => (p.length === 3 ? [p[0] + dx, p[1] + dy, 1] : [p[0] + dx, p[1] + dy]))

const LUNG_LEFT: CtrlPt[] = [
  [8, 150], [16, 138], [28, 134], [44, 142], [58, 160], [66, 186], [70, 214], [70, 240], [66, 260],
  [54, 262], [40, 256], [34, 248], [36, 232], [28, 216], [22, 194], [14, 172],
]
// Right lung drawn on +x first, then mirrored; it has no cardiac notch.
const LUNG_RIGHT_PLUS_X: CtrlPt[] = [
  [8, 150], [16, 138], [28, 134], [44, 142], [58, 160], [66, 186], [70, 214], [70, 240], [66, 256],
  [52, 258], [34, 252], [18, 244], [12, 224], [10, 196], [8, 172],
]
const KIDNEY_LEFT: CtrlPt[] = [[36, 280], [46, 277], [55, 287], [58, 304], [54, 322], [45, 329], [37, 323], [39, 309], [35, 298]]

const COLON = tube(
  [[-38, 398], [-42, 380], [-44, 352], [-43, 326], [-34, 312], [-12, 314], [12, 310], [36, 306], [47, 316], [50, 342], [48, 370], [40, 390], [22, 400], [8, 404], [2, 418]],
  13,
)

type OrganDef = { info: PartInfo; side?: Side; pts: CtrlPt[]; pieces?: Pt[][]; details?: CtrlPt[][] }

const ORGANS: OrganDef[] = [
  {
    info: INFO.brain,
    pts: mirrorClosed([[0, 8], [18, 11], [28, 22], [31, 38], [27, 52], [15, 59], [0, 57]]),
    details: [
      [[0, 10], [1, 30], [0, 56]],
      [[8, 18], [16, 24], [12, 34], [22, 40], [18, 50]],
      [[-8, 18], [-16, 24], [-12, 34], [-22, 40], [-18, 50]],
      [[22, 22], [26, 32]],
      [[-22, 22], [-26, 32]],
    ],
  },
  {
    info: INFO.thyroid,
    pts: mirrorClosed([[0, 113], [5, 111], [11, 107], [14, 113], [13, 121], [7, 123], [0, 119]]),
  },
  {
    info: INFO.trachea,
    pts: mirrorClosed([[0, 96], [5, 96], [5, 160], [13, 170], [21, 180], [17, 185], [5, 173], [0, 170]]),
    details: [104, 111, 118, 125, 132, 139, 146, 153].map((y): CtrlPt[] => [[-5, y], [0, y + 1.2], [5, y]]),
  },
  {
    info: INFO.esophagus,
    pts: [[-2, 102], [4, 102], [6, 170], [9, 226], [24, 253], [19, 259], [3, 232], [-1, 170]],
  },
  {
    info: INFO.lungRight,
    side: 'right',
    pts: LUNG_RIGHT_PLUS_X.map(mirror),
    details: [[[-66, 196], [-40, 204], [-14, 214]], [[-50, 150], [-44, 190], [-36, 252]]],
  },
  {
    info: INFO.lungLeft,
    side: 'left',
    pts: LUNG_LEFT,
    details: [[[48, 150], [44, 190], [52, 258]]],
  },
  {
    info: INFO.heart,
    pts: [[-16, 202], [-10, 190], [-2, 186], [4, 180], [10, 184], [16, 192], [30, 198], [40, 212], [42, 232], [36, 250, 1], [22, 254], [4, 246], [-12, 236], [-20, 220]],
    details: [[[8, 196], [14, 218], [32, 248]]],
  },
  {
    info: INFO.liver,
    pts: [[-68, 248], [-52, 238], [-30, 236], [-6, 240], [16, 244], [34, 250], [42, 258, 1], [32, 266], [10, 276], [-12, 286], [-34, 296], [-54, 300], [-66, 292], [-72, 272]],
    details: [[[-6, 242], [-10, 262], [-18, 284]]],
  },
  {
    info: INFO.gallbladder,
    pts: [[-36, 280], [-27, 279], [-22, 290], [-24, 302], [-31, 304], [-37, 294]],
  },
  {
    info: INFO.stomach,
    pts: [[20, 252], [34, 246], [50, 250], [62, 262], [66, 280], [60, 300], [46, 312], [28, 316], [12, 314], [2, 306], [6, 298], [20, 298], [34, 290], [38, 278], [32, 266], [22, 262]],
    details: [[[44, 258], [54, 278], [46, 300]]],
  },
  {
    info: INFO.spleen,
    pts: [[60, 252], [70, 258], [74, 276], [68, 292], [60, 286], [57, 268]],
  },
  {
    info: INFO.pancreas,
    pts: [[-22, 300], [-10, 293], [12, 291], [32, 287], [52, 281], [61, 283], [57, 291], [36, 298], [14, 302], [-6, 308], [-20, 309]],
  },
  {
    info: INFO.kidney,
    side: 'left',
    pts: KIDNEY_LEFT,
  },
  {
    info: INFO.kidney,
    side: 'right',
    pts: shift(KIDNEY_LEFT.map(mirror), 0, 8),
  },
  {
    info: INFO.smallIntestine,
    pts: mirrorClosed([[0, 318], [20, 320], [33, 331], [37, 350], [33, 372], [21, 389], [0, 395]]),
    details: [
      [[-26, 332], [-10, 328], [4, 336], [20, 330], [30, 340]],
      [[-32, 350], [-16, 344], [-2, 354], [14, 346], [32, 354]],
      [[-30, 368], [-14, 362], [2, 372], [18, 364], [30, 372]],
      [[-20, 384], [-4, 380], [10, 386], [22, 382]],
    ],
  },
  {
    info: INFO.largeIntestine,
    pts: COLON.outline,
    pieces: COLON.pieces,
  },
  {
    info: INFO.bladder,
    pts: [[0, 404], [12, 405], [19, 414], [15, 425], [0, 429], [-15, 425], [-19, 414], [-12, 405]],
  },
]

// ---------------------------------------------------------------------------
// Build

function makePart(
  id: string,
  info: PartInfo,
  pts: readonly CtrlPt[],
  color: string,
  side?: Side,
  details?: readonly CtrlPt[][],
  pieces?: Pt[][],
): BodyPart {
  const samples = sampleOutline(pts)
  const { area, centroid } = areaCentroid(samples)
  return {
    id,
    info,
    side,
    d: smoothPath(pts),
    details: details?.map(smoothOpenPath).join(''),
    color,
    hulls: pieces ?? [convexHull(samples)],
    bbox: bboxOf(samples),
    centroid,
    area,
  }
}

const MUSCLE_COLOR = '#c8453f'

export function buildBodyModel(): BodyModel {
  const muscles: BodyPart[] = []
  for (const m of MUSCLES) {
    // +x is the figure's left side.
    muscles.push(makePart(`${m.info.key}-left`, m.info, m.pts, MUSCLE_COLOR, 'left', m.details))
    muscles.push(
      makePart(`${m.info.key}-right`, m.info, m.pts.map(mirror), MUSCLE_COLOR, 'right', m.details?.map((l) => l.map(mirror))),
    )
  }
  muscles.push(makePart('rectusAbdominis', INFO.rectusAbdominis, RECTUS_ABDOMINIS, MUSCLE_COLOR, undefined, RECTUS_DETAILS))

  const organs = ORGANS.map((o) =>
    makePart(o.side && o.info.key === 'kidney' ? `kidney-${o.side}` : o.info.key, o.info, o.pts, ORGAN_COLORS[o.info.key], o.side, o.details, o.pieces),
  )

  const skinOutlines: CtrlPt[][] = [
    TORSO,
    ...SKIN_RIGHT_HALF,
    ...SKIN_RIGHT_HALF.map((s) => s.map(mirror)),
    NECK,
    HEAD,
  ]
  const bounds = unionBBox(skinOutlines.map((s) => bboxOf(sampleOutline(s, 3))))

  return { skin: skinOutlines.map(smoothPath), muscles, organs, bounds }
}

/** Display name including the side for paired structures. */
export function partLabel(part: BodyPart): { title: string; subtitle: string } {
  const side = part.side === 'left' ? 'strona lewa' : part.side === 'right' ? 'strona prawa' : null
  const own = part.info.key === 'lungLeft' || part.info.key === 'lungRight'
  return {
    title: part.info.key === 'kidney' ? `Nerka ${part.side === 'left' ? 'lewa' : 'prawa'}` : part.info.name,
    subtitle: [part.info.latin, own ? null : side].filter(Boolean).join(' · '),
  }
}
