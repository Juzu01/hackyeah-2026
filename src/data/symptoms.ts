import type { Symptom } from './types.ts'

// Everyday symptoms, grouped by body-map region (see src/body/regions.ts).
// Alarming symptoms are asked separately as red-flag questions (redFlags.ts).

const s = (id: string, name: string, regions: string[], extra: Partial<Symptom> = {}): Symptom => ({ id, name, regions, ...extra })

const LIMB_UPPER = ['shoulder', 'upper-arm', 'elbow', 'forearm', 'wrist', 'hand']
const LIMB_LOWER = ['thigh', 'knee', 'shin', 'calf', 'ankle', 'foot', 'heel']
const JOINTS = ['shoulder', 'elbow', 'wrist', 'hand', 'knee', 'ankle']

export const SYMPTOMS: Symptom[] = [
  // --- general (offered in every region) ---
  s('fever', 'Gorączka lub stan podgorączkowy', ['*'], { common: true, search: ['temperatura'] }),
  s('chills', 'Dreszcze', ['*']),
  s('fatigue', 'Zmęczenie, osłabienie', ['*'], { common: true }),
  s('nausea', 'Nudności', ['*'], { search: ['mdłości'] }),
  s('weight-loss', 'Niezamierzona utrata wagi', ['*']),
  s('night-sweats', 'Poty nocne', ['*']),
  s('rash', 'Wysypka na skórze', ['*'], { search: ['pokrzywka', 'swędzenie'] }),
  s('muscle-sore', 'Bóle mięśni', ['*', ...LIMB_UPPER, ...LIMB_LOWER], { search: ['zakwasy', 'przeciążenie'] }),

  // --- head ---
  s('headache', 'Ból głowy', ['head', 'nape'], { common: true }),
  s('headache-one-sided-pulsing', 'Pulsujący ból po jednej stronie głowy', ['head']),
  s('headache-pressure-band', 'Tępy, uciskowy ból jak opaska wokół głowy', ['head']),
  s('occipital-pain', 'Ból w tyle głowy (potylica)', ['head', 'nape']),
  s('light-sound-sensitivity', 'Nadwrażliwość na światło lub dźwięki', ['head']),
  s('dizziness', 'Zawroty głowy', ['head'], { common: true }),
  s('vision-blur', 'Niewyraźne lub podwójne widzenie', ['head']),
  s('runny-nose', 'Katar lub zatkany nos', ['head'], { common: true, search: ['nos'] }),
  s('sinus-pressure', 'Ból lub ucisk w okolicy czoła, policzków, nasady nosa', ['head'], { search: ['zatoki'] }),
  s('eye-pain', 'Ból oka', ['head'], { search: ['oczy'] }),
  s('eye-red', 'Zaczerwienione oko, pieczenie, łzawienie, wydzielina', ['head'], { search: ['oczy', 'spojówki'] }),
  s('ear-pain', 'Ból ucha', ['head'], { search: ['uszy'] }),
  s('ear-hearing', 'Pogorszenie słuchu, uczucie zatkanego ucha', ['head'], { search: ['uszy', 'szum'] }),
  s('tooth-pain', 'Ból zęba', ['head'], { search: ['zęby', 'dziąsło'] }),
  s('jaw-pain', 'Ból żuchwy lub stawu skroniowo-żuchwowego', ['head'], { search: ['szczęka'] }),
  s('face-swelling', 'Obrzęk twarzy', ['head']),
  s('head-injury', 'Uraz głowy (uderzenie, upadek)', ['head']),
  s('neck-stiff', 'Sztywność karku', ['head', 'neck', 'nape'], { search: ['szyja'] }),

  // --- neck (front) & nape (back) ---
  s('sore-throat', 'Ból gardła', ['neck'], { common: true, search: ['gardło'] }),
  s('swallow-pain', 'Ból lub trudność przy przełykaniu', ['neck']),
  s('hoarse', 'Chrypka, utrata głosu', ['neck'], { search: ['krtań'] }),
  s('cough', 'Kaszel', ['neck', 'chest'], { common: true }),
  s('neck-lumps', 'Powiększone węzły chłonne, guzki na szyi', ['neck']),
  s('neck-swelling-front', 'Obrzęk lub zgrubienie z przodu szyi', ['neck'], { search: ['tarczyca', 'wole'] }),
  s('neck-pain', 'Ból szyi lub karku', ['neck', 'nape', 'upper-back'], { common: true }),
  s('neck-pain-radiating-arm', 'Ból szyi promieniujący do ramienia lub ręki', ['nape', 'neck']),
  s('neck-injury', 'Uraz szyi (szarpnięcie, wypadek)', ['nape', 'neck']),

  // --- chest ---
  s('chest-pain', 'Ból w klatce piersiowej', ['chest'], { common: true }),
  s('chest-pain-pressure', 'Ucisk, gniecenie lub pieczenie za mostkiem', ['chest']),
  s('chest-pain-sharp-breath', 'Kłujący ból nasilający się przy oddychaniu lub ruchu', ['chest']),
  s('chest-wall-tender', 'Bolesność przy ucisku na żebra lub mostek', ['chest']),
  s('dyspnea', 'Duszność, brak tchu', ['chest'], { common: true, search: ['oddech'] }),
  s('cough-phlegm', 'Kaszel z odkrztuszaniem wydzieliny', ['chest'], { search: ['flegma', 'plwocina'] }),
  s('wheeze', 'Świszczący oddech', ['chest']),
  s('palpitations', 'Kołatanie serca, nierówne bicie', ['chest'], { search: ['serce', 'tętno'] }),
  s('heartburn', 'Zgaga, pieczenie w przełyku, kwaśne odbijanie', ['chest', 'upper-abdomen'], { search: ['refluks'] }),
  s('breast-pain', 'Ból lub tkliwość piersi', ['chest']),
  s('breast-lump', 'Guzek lub zgrubienie w piersi', ['chest']),
  s('anxiety', 'Silny niepokój, uczucie lęku, mrowienie rąk', ['chest'], { search: ['panika', 'stres'] }),

  // --- abdomen (upper / lower) ---
  s('abd-pain-upper', 'Ból w górnej części brzucha', ['upper-abdomen'], { common: true, search: ['żołądek'] }),
  s('abd-pain-ruq', 'Ból pod prawym żebrem (prawe podżebrze)', ['upper-abdomen'], { search: ['wątroba', 'woreczek'] }),
  s('epigastric-burn', 'Pieczenie lub ból w dołku (nadbrzusze)', ['upper-abdomen'], { search: ['żołądek'] }),
  s('vomiting', 'Wymioty', ['upper-abdomen', 'lower-abdomen', 'head'], { common: true }),
  s('bloating', 'Wzdęcia, uczucie pełności', ['upper-abdomen', 'lower-abdomen'], { common: true, search: ['gazy'] }),
  s('appetite-loss', 'Brak apetytu', ['upper-abdomen', 'lower-abdomen']),
  s('pain-after-fatty', 'Ból pojawia się po tłustym lub obfitym posiłku', ['upper-abdomen']),
  s('jaundice', 'Zażółcenie skóry lub białek oczu', ['upper-abdomen'], { search: ['żółtaczka'] }),
  s('back-radiating', 'Ból opasujący, promieniujący do pleców', ['upper-abdomen']),
  s('diarrhea', 'Biegunka', ['lower-abdomen', 'upper-abdomen'], { common: true, search: ['rozwolnienie'] }),
  s('abd-pain-lower', 'Ból w dolnej części brzucha', ['lower-abdomen'], { common: true, search: ['podbrzusze'] }),
  s('abd-pain-rlq', 'Ból w prawym dole brzucha (prawa dolna część)', ['lower-abdomen'], { search: ['wyrostek'] }),
  s('pain-moves-rlq', 'Ból zaczął się wokół pępka i przeniósł w prawo, na dół', ['lower-abdomen'], { search: ['wyrostek'] }),
  s('abd-cramps', 'Skurczowy, kolkowy ból brzucha', ['lower-abdomen', 'upper-abdomen']),
  s('constipation', 'Zaparcie', ['lower-abdomen']),
  s('blood-stool', 'Krew w stolcu', ['lower-abdomen'], { search: ['odbyt'] }),
  s('urinary-burning', 'Pieczenie lub ból przy oddawaniu moczu', ['lower-abdomen', 'pelvis', 'lower-back'], { search: ['pęcherz', 'mocz'] }),
  s('urinary-frequency', 'Częste oddawanie moczu, nagłe parcie', ['lower-abdomen', 'pelvis'], { search: ['pęcherz', 'mocz'] }),
  s('blood-urine', 'Krew w moczu', ['pelvis', 'lower-abdomen', 'lower-back'], { search: ['mocz'] }),
  s('menstrual-pain', 'Bolesne miesiączki', ['lower-abdomen', 'pelvis'], { sex: 'f', search: ['okres'] }),
  s('pelvic-pain-cycle', 'Ból w podbrzuszu związany z cyklem miesiączkowym', ['pelvis', 'lower-abdomen'], { sex: 'f' }),

  // --- pelvis ---
  s('pelvic-pain', 'Ból w miednicy lub podbrzuszu', ['pelvis'], { common: true }),
  s('groin-pain', 'Ból w pachwinie', ['pelvis', 'thigh'], { common: true }),
  s('groin-lump', 'Wybrzuszenie w pachwinie, większe przy kaszlu lub wysiłku', ['pelvis'], { search: ['przepuklina'] }),
  s('discharge-f', 'Nietypowa wydzielina z pochwy, swędzenie', ['pelvis'], { sex: 'f', search: ['infekcja intymna'] }),
  s('discharge-m', 'Wydzielina z cewki moczowej', ['pelvis'], { sex: 'm' }),
  s('testicle-pain', 'Ból lub obrzęk jądra', ['pelvis'], { sex: 'm', search: ['jądra', 'moszna'] }),
  s('rash-genital', 'Zmiany skórne lub swędzenie w okolicy intymnej', ['pelvis']),
  s('hip-pain', 'Ból biodra', ['pelvis', 'thigh', 'buttocks'], { common: true }),

  // --- back ---
  s('back-pain-upper', 'Ból górnej części pleców, między łopatkami', ['upper-back'], { common: true, search: ['plecy'] }),
  s('back-muscle-tension', 'Napięcie i sztywność mięśni pleców', ['upper-back', 'lower-back']),
  s('back-pain-posture', 'Ból nasila się po długim siedzeniu lub pracy przy biurku', ['upper-back', 'lower-back', 'nape']),
  s('shoulder-blade-pain', 'Ból łopatki', ['upper-back']),
  s('back-pain-lower', 'Ból dolnej części pleców (krzyża)', ['lower-back'], { common: true, search: ['kręgosłup', 'lędźwie'] }),
  s('back-pain-radiating-leg', 'Ból promieniujący z pleców do pośladka lub nogi', ['lower-back', 'buttocks'], { search: ['rwa'] }),
  s('leg-numb', 'Drętwienie lub mrowienie nogi lub stopy', ['lower-back', 'buttocks', 'thigh', 'shin', 'calf']),
  s('back-pain-after-lifting', 'Ból zaczął się po dźwignięciu lub gwałtownym ruchu', ['lower-back']),
  s('back-stiff-morning', 'Sztywność rano, która zmniejsza się po rozruszaniu', ['lower-back', 'buttocks']),
  s('flank-pain', 'Ból w boku pod żebrami, może promieniować do pachwiny', ['lower-back'], { search: ['nerka', 'kolka'] }),
  s('buttock-pain', 'Ból pośladka', ['buttocks'], { common: true }),
  s('tailbone-pain', 'Ból kości ogonowej, nasila się przy siedzeniu', ['buttocks']),
  s('sciatic-pain', 'Piekący lub strzelający ból wzdłuż tylnej części nogi', ['buttocks', 'thigh', 'lower-back'], { search: ['rwa kulszowa'] }),

  // --- upper limb ---
  s('shoulder-pain', 'Ból barku', ['shoulder'], { common: true }),
  s('shoulder-pain-lift', 'Ból przy unoszeniu ręki nad głowę', ['shoulder']),
  s('shoulder-stiff', 'Ograniczony zakres ruchu, sztywność barku', ['shoulder']),
  s('shoulder-weak', 'Osłabienie ramienia, trudność z uniesieniem', ['shoulder']),
  s('shoulder-night-pain', 'Ból w nocy, nie da się leżeć na tym boku', ['shoulder']),
  s('shoulder-injury', 'Uraz barku (upadek, szarpnięcie)', ['shoulder']),
  s('shoulder-deformity', 'Bark „wyskoczył”, widoczne zniekształcenie', ['shoulder']),
  s('joint-swelling', 'Obrzęk stawu', JOINTS, { common: true }),
  s('arm-pain', 'Ból ramienia', ['upper-arm'], { common: true }),
  s('arm-weak', 'Osłabienie ręki', ['upper-arm', 'forearm']),
  s('arm-numb', 'Drętwienie lub mrowienie ręki', ['upper-arm', 'forearm', 'wrist', 'hand'], { common: true }),
  s('arm-swelling', 'Obrzęk ręki', ['upper-arm', 'forearm']),
  s('arm-injury', 'Uraz ręki (uderzenie, upadek)', ['upper-arm', 'forearm']),
  s('elbow-pain', 'Ból łokcia', ['elbow'], { common: true }),
  s('elbow-pain-outer', 'Ból po zewnętrznej stronie łokcia, nasila się przy chwytaniu', ['elbow'], { search: ['tenisisty'] }),
  s('elbow-pain-inner', 'Ból po wewnętrznej stronie łokcia', ['elbow'], { search: ['golfisty'] }),
  s('elbow-locking', 'Blokowanie lub trzaski w łokciu', ['elbow']),
  s('elbow-injury', 'Uraz łokcia', ['elbow']),
  s('forearm-pain', 'Ból przedramienia', ['forearm'], { common: true }),
  s('forearm-pain-use', 'Ból nasila się przy pracy ręką (pisanie, narzędzia, mysz)', ['forearm', 'elbow', 'wrist']),
  s('wrist-pain', 'Ból nadgarstka', ['wrist'], { common: true }),
  s('hand-numb-night', 'Drętwienie palców, zwłaszcza w nocy lub rano', ['wrist', 'hand'], { search: ['cieśń'] }),
  s('wrist-pain-thumb-side', 'Ból po stronie kciuka przy ruchach nadgarstka', ['wrist']),
  s('wrist-injury', 'Uraz nadgarstka (upadek na rękę)', ['wrist']),
  s('weak-grip', 'Osłabiony chwyt, wypadanie przedmiotów z ręki', ['wrist', 'hand', 'elbow']),
  s('hand-pain', 'Ból dłoni lub palców', ['hand'], { common: true }),
  s('finger-stiff', 'Sztywność palców rano', ['hand']),
  s('finger-swollen-joints', 'Obrzęk lub zgrubienie stawów palców', ['hand']),
  s('finger-cold-white', 'Zimne, blednące lub sine palce', ['hand']),
  s('hand-rash', 'Suche, pękające, swędzące dłonie lub pęcherzyki', ['hand']),
  s('finger-locking', 'Palec „zatrzaskuje się” przy prostowaniu', ['hand']),
  s('hand-injury', 'Uraz dłoni lub palca', ['hand']),

  // --- lower limb ---
  s('thigh-pain', 'Ból uda', ['thigh'], { common: true }),
  s('thigh-pain-back', 'Ból z tyłu uda, nasila się przy skłonie lub bieganiu', ['thigh', 'buttocks']),
  s('leg-swelling', 'Obrzęk jednej nogi', ['thigh', 'shin', 'calf', 'ankle'], { common: true }),
  s('leg-pain-walking', 'Ból nogi przy chodzeniu, ustępuje po odpoczynku', ['thigh', 'calf', 'shin']),
  s('thigh-injury', 'Uraz uda (naciągnięcie, uderzenie)', ['thigh']),
  s('knee-pain', 'Ból kolana', ['knee'], { common: true }),
  s('knee-swelling', 'Obrzęk kolana', ['knee'], { common: true }),
  s('knee-instability', 'Uczucie niestabilności, „uciekania” kolana', ['knee']),
  s('knee-locking', 'Blokowanie, przeskakiwanie lub trzaski w kolanie', ['knee']),
  s('knee-pain-stairs', 'Ból nasila się na schodach, przy kucaniu lub po długim siedzeniu', ['knee']),
  s('knee-injury', 'Uraz kolana (skręcenie, upadek, podczas sportu)', ['knee']),
  s('knee-stiff-morning', 'Sztywność kolana rano lub po odpoczynku', ['knee']),
  s('knee-warm-red', 'Kolano ciepłe i zaczerwienione', ['knee']),
  s('knee-pain-back', 'Ból lub uwypuklenie z tyłu kolana', ['knee']),
  s('shin-pain', 'Ból goleni (piszczeli)', ['shin'], { common: true }),
  s('shin-pain-running', 'Ból wzdłuż kości piszczelowej po bieganiu lub skokach', ['shin']),
  s('shin-skin-red', 'Zaczerwienienie i ocieplenie skóry na nodze', ['shin', 'calf', 'ankle']),
  s('shin-injury', 'Uraz goleni', ['shin']),
  s('calf-pain', 'Ból łydki', ['calf'], { common: true }),
  s('calf-cramps', 'Skurcze łydek, zwłaszcza w nocy', ['calf']),
  s('calf-tender-swollen', 'Łydka obrzęknięta, tkliwa i cieplejsza niż druga', ['calf', 'shin'], { search: ['zakrzepica'] }),
  s('calf-injury', 'Nagły ból łydki podczas wysiłku, „jak uderzenie”', ['calf']),
  s('ankle-pain', 'Ból kostki', ['ankle'], { common: true }),
  s('ankle-swelling', 'Obrzęk kostki', ['ankle'], { common: true }),
  s('ankle-sprain', 'Skręcenie (podwinięcie stopy)', ['ankle']),
  s('ankle-instability', 'Niestabilność stawu skokowego', ['ankle']),
  s('both-ankles-swelling', 'Obrzęk obu kostek, nasila się wieczorem', ['ankle']),
  s('achilles-pain', 'Ból i sztywność z tyłu nad piętą (ścięgno Achillesa)', ['ankle', 'heel', 'calf']),
  s('achilles-snap', 'Nagłe „strzelenie” z tyłu kostki i osłabienie odbicia stopy', ['heel', 'calf', 'ankle']),
  s('foot-pain', 'Ból stopy', ['foot'], { common: true }),
  s('heel-pain', 'Ból pięty', ['heel', 'foot'], { common: true }),
  s('heel-pain-morning', 'Ból pięty przy pierwszych krokach rano', ['heel', 'foot'], { search: ['ostroga'] }),
  s('toe-pain-red', 'Nagły, bardzo silny ból i obrzęk stawu dużego palca', ['foot'], { search: ['dna', 'paluch'] }),
  s('foot-numb', 'Drętwienie, pieczenie lub mrowienie stóp', ['foot', 'heel']),
  s('foot-swelling', 'Obrzęk stopy', ['foot', 'heel']),
  s('foot-skin', 'Zmiany skórne stopy (łuszczenie, pęcherze, swędzenie między palcami)', ['foot'], { search: ['grzybica'] }),
  s('toenail', 'Ból przy paznokciu, wrastający paznokieć', ['foot']),
  s('foot-injury', 'Uraz stopy (uderzenie, upadek)', ['foot', 'heel']),
]

export const SYMPTOM_BY_ID: ReadonlyMap<string, Symptom> = new Map(SYMPTOMS.map((x) => [x.id, x]))

export function symptomName(id: string): string {
  return SYMPTOM_BY_ID.get(id)?.name ?? id
}

/** Symptoms offered for a region (plus the general group), common ones first. */
export function symptomsForRegion(defId: string, sex?: 'f' | 'm'): { specific: Symptom[]; general: Symptom[] } {
  const ok = (x: Symptom) => !x.sex || !sex || x.sex === sex
  const byCommon = (a: Symptom, b: Symptom) => Number(!!b.common) - Number(!!a.common)
  return {
    specific: SYMPTOMS.filter((x) => x.regions.includes(defId) && ok(x)).sort(byCommon),
    general: SYMPTOMS.filter((x) => x.regions.includes('*') && !x.regions.includes(defId) && ok(x)),
  }
}

const fold = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace('ł', 'l')

/** Free-text search over names and synonyms (accent-insensitive). */
export function searchSymptoms(query: string, sex?: 'f' | 'm', limit = 8): Symptom[] {
  const q = fold(query.trim())
  if (q.length < 2) return []
  return SYMPTOMS.filter((x) => (!x.sex || !sex || x.sex === sex) && [x.name, ...(x.search ?? [])].some((t) => fold(t).includes(q))).slice(0, limit)
}
