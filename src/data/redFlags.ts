import type { RedFlag } from './types.ts'

// Alarm questions asked after the symptoms (the "any of these?" step that
// Symptomate, Ada and NHS 111 all put before the interview). A "yes" overrides
// everything else in the triage, so each question names only signs that really
// are alarming together: no "…or nausea", "…or light sensitivity", "…or numbness"
// that half of all people with a migraine or a flu would answer "yes" to.

const HEAD = ['head', 'neck', 'nape']
const ABDOMEN = ['upper-abdomen', 'lower-abdomen', 'pelvis', 'lower-back']
const LIMBS = ['shoulder', 'upper-arm', 'elbow', 'forearm', 'wrist', 'hand', 'thigh', 'knee', 'shin', 'calf', 'ankle', 'foot', 'heel']

export const RED_FLAGS: RedFlag[] = [
  {
    id: 'rf-breathing',
    question: 'Masz silną duszność – trudno Ci mówić pełnymi zdaniami?',
    regions: ['*'],
    triage: 'emergency',
    reason: 'silna duszność',
  },
  {
    id: 'rf-consciousness',
    question: 'Utrata przytomności, drgawki albo splątanie (nie wiadomo, gdzie się jest, trudno się dobudzić)?',
    regions: ['*'],
    triage: 'emergency',
    reason: 'utrata przytomności, drgawki lub splątanie',
  },
  {
    id: 'rf-stroke',
    question: 'Nagle pojawił się opadnięty kącik ust, osłabienie ręki lub nogi po jednej stronie ciała, bełkotliwa mowa albo nagła utrata widzenia?',
    regions: [...HEAD, 'upper-arm', 'forearm', 'hand', 'thigh', 'shin', 'calf'],
    triage: 'emergency',
    reason: 'objawy mogące wskazywać na udar',
  },
  {
    id: 'rf-thunderclap',
    question: 'Ból głowy pojawił się nagle, w ciągu sekund, i jest najsilniejszy w życiu?',
    regions: ['head', 'nape'],
    triage: 'emergency',
    reason: 'piorunujący ból głowy',
  },
  {
    id: 'rf-meningism',
    question: 'Gorączka i do tego sztywny kark (trudno dotknąć brodą klatki piersiowej) albo wysypka, która nie blednie pod naciskiem szklanki?',
    regions: ['head', 'neck', 'nape'],
    triage: 'emergency',
    reason: 'gorączka ze sztywnością karku (podejrzenie zapalenia opon)',
  },
  {
    id: 'rf-head-injury',
    question: 'Po tym urazie głowy: wymioty, senność, utrata przytomności, drgawki lub narastający ból?',
    regions: ['head'],
    symptoms: ['head-injury'],
    triage: 'emergency',
    reason: 'niepokojące objawy po urazie głowy',
  },
  {
    id: 'rf-airway',
    question: 'Trudność w oddychaniu, ślinienie się lub niemożność przełknięcia śliny?',
    regions: ['neck'],
    triage: 'emergency',
    reason: 'zagrożenie drożności dróg oddechowych',
  },
  {
    id: 'rf-cardiac',
    question: 'Silny ucisk, gniecenie lub pieczenie w klatce piersiowej, które trwa ponad 15 minut (często promieniuje do ręki, szyi lub żuchwy)?',
    regions: ['chest', 'upper-abdomen', 'upper-back', 'shoulder', 'upper-arm'],
    triage: 'emergency',
    reason: 'ból w klatce piersiowej o cechach sercowych',
  },
  {
    id: 'rf-hemoptysis',
    question: 'Odkrztuszasz krew?',
    regions: ['chest', 'neck'],
    triage: 'urgent',
    reason: 'krwioplucie',
  },
  {
    id: 'rf-rigid-abdomen',
    question: 'Brzuch jest twardy, „deskowaty”, a ból nie pozwala się poruszać?',
    regions: ABDOMEN,
    triage: 'emergency',
    reason: 'objawy otrzewnowe',
  },
  {
    id: 'rf-gi-bleeding',
    question: 'Wymioty krwią lub treścią jak fusy od kawy, albo czarne, smoliste stolce?',
    regions: [...ABDOMEN, 'chest'],
    triage: 'emergency',
    reason: 'krwawienie z przewodu pokarmowego',
  },
  {
    id: 'rf-pregnancy',
    question: 'Jesteś w ciąży (lub ciąża jest możliwa) i masz ból brzucha lub krwawienie?',
    regions: ['lower-abdomen', 'pelvis', 'lower-back'],
    triage: 'urgent',
    reason: 'ból lub krwawienie w możliwej ciąży',
    sex: 'f',
  },
  {
    id: 'rf-urinary-retention',
    question: 'Nie możesz oddać moczu mimo silnego parcia?',
    regions: ['lower-abdomen', 'pelvis', 'lower-back', 'buttocks'],
    triage: 'urgent',
    reason: 'zatrzymanie moczu',
  },
  {
    id: 'rf-testicle',
    question: 'Nagły, bardzo silny ból jądra, z nudnościami?',
    regions: ['pelvis', 'lower-abdomen'],
    triage: 'emergency',
    reason: 'podejrzenie skrętu jądra',
    sex: 'm',
  },
  {
    id: 'rf-cauda-equina',
    question: 'Drętwienie okolicy krocza lub wewnętrznych ud, nietrzymanie moczu/stolca albo osłabienie obu nóg?',
    regions: ['lower-back', 'buttocks', 'thigh', 'pelvis'],
    triage: 'emergency',
    reason: 'objawy zespołu ogona końskiego',
  },
  {
    id: 'rf-back-systemic',
    question: 'Ból pleców z gorączką, niewyjaśnioną utratą wagi lub po poważnym urazie (wypadek, upadek z wysokości)?',
    regions: ['upper-back', 'lower-back', 'nape'],
    triage: 'urgent',
    reason: 'ból pleców z objawami ogólnymi lub po urazie',
  },
  {
    id: 'rf-limb-deformity',
    question: 'Widoczne zniekształcenie kończyny, kość przebiła skórę lub w ogóle nie możesz jej obciążyć albo poruszyć?',
    regions: LIMBS,
    triage: 'urgent',
    reason: 'podejrzenie złamania lub zwichnięcia',
  },
  {
    id: 'rf-limb-ischemia',
    question: 'Kończyna nagle zrobiła się blada lub sina, zimna w dotyku i bardzo boli?',
    regions: LIMBS,
    triage: 'emergency',
    reason: 'objawy niedokrwienia kończyny',
  },
  {
    id: 'rf-dvt',
    question: 'Jedna łydka lub noga nagle stała się obrzęknięta, ciepła i bolesna?',
    regions: ['thigh', 'knee', 'shin', 'calf', 'ankle'],
    triage: 'urgent',
    reason: 'podejrzenie zakrzepicy żył głębokich',
  },
  {
    id: 'rf-hot-joint',
    question: 'Staw jest gorący, zaczerwieniony i bardzo bolesny, a do tego masz gorączkę?',
    regions: ['shoulder', 'elbow', 'wrist', 'hand', 'knee', 'ankle', 'foot'],
    triage: 'urgent',
    reason: 'gorący staw z gorączką (możliwe zakażenie stawu)',
  },
]

/** Questions relevant to the chosen regions (always including the general ones) and, where a question needs it, to the picked symptoms. */
export function redFlagsFor(regionDefIds: Iterable<string>, sex?: 'f' | 'm', symptomIds: Iterable<string> = []): RedFlag[] {
  const set = new Set(regionDefIds)
  const picked = new Set(symptomIds)
  return RED_FLAGS.filter(
    (f) =>
      (!f.sex || !sex || f.sex === sex) &&
      (f.regions.includes('*') || f.regions.some((r) => set.has(r))) &&
      (!f.symptoms || f.symptoms.some((id) => picked.has(id))),
  )
}
