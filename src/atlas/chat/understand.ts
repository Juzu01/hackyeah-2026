// What a spoken or typed sentence asks the atlas to do: report pain somewhere,
// show or explain a part, suggest exercises, change the layer, turn the body
// round. Plain Polish as people actually say it ("boli mnie lewe kolano, tak na
// 6"), not anatomical terms. Pure and framework-free, so it is easy to test.
//
// Paired parts come back with the patient's own side (the catalog's): the side
// said nearest to the part, else the selected part's side if it is the same
// part, else the right one.

import catalogFile from '../../anatomy/data/catalog.json'
import contentFile from '../../anatomy/data/content.pl.json'
import type { LayerName } from '../../anatomy/depth.ts'

export type Intent =
  | { kind: 'pain'; partId: string | null; intensity: number | null; typeIds: string[] }
  | { kind: 'show'; partId: string }
  | { kind: 'exercise'; partId: string }
  | { kind: 'emergency'; reason: string }
  | { kind: 'layer'; layer: LayerName }
  | { kind: 'flip' }
  | { kind: 'help' }
  | { kind: 'thanks' }
  | { kind: 'unknown' }

/** Lowercase ASCII words: no diacritics, punctuation turned into spaces ("6/10" keeps its slash). */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim()
}

// ── Parts ─────────────────────────────────────────────────────────────

/** Part base id ("deltoid") → its catalog ids; paired parts have -left and -right. */
const BASES = new Map<string, { paired: boolean }>()
for (const p of catalogFile.parts) {
  if (p.layer === 'shell') continue // the skin is a glass shell, not something to point at
  const base = p.id.replace(/-(left|right)$/, '')
  BASES.set(base, { paired: base !== p.id })
}

interface Synonym {
  re: RegExp
  base: string
  /** A different part when the sentence is about pain. */
  painBase?: string
  /** "plecy": with nothing else said, turn the body round rather than pick one muscle. */
  back?: true
}

const syn = (re: string, base: string, extra: Omit<Synonym, 're' | 'base'> = {}): Synonym => ({
  re: new RegExp(`\\b(?:${re})\\b`, 'g'),
  base,
  ...extra,
})

// How people say it, on normalized text. Where a word could mean several parts,
// the most likely one for someone who isn't a doctor.
const SYNONYMS: Synonym[] = [
  // Head and neck. Headache shows the head, not the brain: that is where it hurts.
  syn('glow(a|y|e|ie|ami)', 'skull'),
  syn('czaszk\\w*', 'skull'),
  syn('mozg\\w*', 'brain'),
  syn('szczek\\w*|zuchw\\w*', 'mandible'),
  syn('skron\\w*', 'temporalis'),
  syn('zwacz\\w*', 'masseter'),
  syn('szyj(a|i|e|ka)|szyi', 'sternocleidomastoid'),
  syn('kark\\w*', 'trapezius'),
  syn('gardl\\w*|przelyk\\w*', 'esophagus'),
  syn('tchawic\\w*|oskrzel\\w*', 'trachea'),
  syn('tarczyc\\w*', 'thyroid'),
  // Shoulders and arms. "Ramię" is the shoulder in everyday Polish.
  syn('bark\\w*', 'deltoid'),
  syn('ramie|ramienia|ramieniu|ramieniem|ramion(a|ach|ami)?', 'deltoid'),
  syn('obojczyk\\w*', 'clavicle'),
  syn('lopatk\\w*|lopatce|lopatek', 'scapula'),
  syn('biceps\\w*|bicek\\w*', 'biceps-brachii'),
  syn('triceps\\w*', 'triceps-brachii'),
  // The tip of the elbow is the ulna's olecranon.
  syn('lok(iec|cia|ciu|ciem|cie|ci)', 'ulna'),
  syn('przedrami\\w*|przedramion\\w*', 'forearm-flexors'),
  syn('nadgarst\\w*|dlon\\w*|re(ka|ki|ce|ke|kach|kami|koma)|kciuk\\w*|palc\\w*|palec', 'hand-bones'),
  syn('palc\\w* (u )?(nog|nogi|stop|stopy|stopach)', 'foot-bones'),
  // Chest. "Klata" is gym talk for the pecs; "klatka" is the rib cage.
  syn('klat(a|y|e|ie)|klacie|piers|piersi|piersiach', 'pectoralis-major'),
  syn('klat(ka|ki|ce|ke)( piersiow\\w*)?|zebr\\w*|zeber|mostk\\w*|mostek', 'thoracic-cage'),
  syn('serc\\w*', 'heart'),
  syn('pluc\\w*', 'lung'),
  syn('aort\\w*', 'aorta'),
  // Back. Most back pain is muscular, and the lats have exercises; the low back is the spine.
  syn('plec(y|ach|ami|om)|plecow', 'latissimus-dorsi', { back: true }),
  syn('krzyz(u|em)?|ledzw\\w*|kregoslup\\w*|kregi|kregow|odcin\\w* ledzwiow\\w*', 'vertebral-column'),
  // Belly: an ache is nearly always the gut (show the stomach); exercises and pointing mean the abs.
  syn('brzuch(a|u|em|ach)?', 'rectus-abdominis', { painBase: 'stomach' }),
  syn('mies\\w* brzuch\\w*|brzuszk\\w*|kaloryfer\\w*|sze?sciopak\\w*', 'rectus-abdominis'),
  syn('bok(u|i|ach)?|skosn\\w*', 'external-oblique'),
  syn('zolad\\w*', 'stomach'),
  syn('watrob\\w*', 'liver'),
  syn('pecherzyk\\w*( zolciow\\w*)?|woreczk\\w*( zolciow\\w*)?|woreczek( zolciowy)?', 'gallbladder'),
  syn('trzustk\\w*|trzustce', 'pancreas'),
  syn('sledzion\\w*', 'spleen'),
  syn('ner(ka|ki|ce|ke|kach|kami|ek)', 'kidney'),
  syn('pecherz(a|u|em|e|y|ach)?( moczow\\w*)?', 'urinary-bladder'),
  // The appendix hangs off the large intestine; "jelita" alone is mostly the small one.
  syn('jelit\\w*|kiszk\\w*', 'small-intestine'),
  syn('jelit\\w* grub\\w*|okreznic\\w*|wyrost\\w*( robaczkow\\w*)?', 'large-intestine'),
  // Hips and legs.
  syn('biodr\\w*|bioder|miednic\\w*', 'pelvis'),
  syn('poslad\\w*|pup(a|y|ie|e|ce|ka)|tyl(ek|ka|ku|kiem)|dup(a|y|ie|e)', 'gluteus-maximus'),
  syn('ud(o|a|zie|em|ach|ami)|czworoglow\\w*', 'rectus-femoris'),
  syn('tyl\\w* ud(a|zie)', 'biceps-femoris'),
  syn('pachwin\\w*|wewnetrzn\\w* stron\\w* ud(a|zie)', 'adductors'),
  syn('kolan\\w*|rzepk\\w*|rzepce', 'patella'),
  syn('ly(dka|dki|dce|dke|dek|dkach|dkami)|achilles\\w*|achillesa', 'gastrocnemius'),
  syn('golen\\w*|piszczel(i|a|em)?', 'tibia'),
  // "Kostka" is the ankle; the ankle bone (talus) is among the foot bones. Same for the heel.
  syn('kost(ka|ki|ce|ke|kach|ek)|stop(a|y|ie|e|ami|ach|om)?|piet(a|y|e|cie|ami)', 'foot-bones'),
]

/** Words that don't help find a part: the generic first word of an official name. */
const GENERIC = new Set(['miesien', 'miesnie', 'kosc', 'kosci'])
const SIDE_WORDS = new Set(['lewy', 'lewa', 'lewe', 'prawy', 'prawa', 'prawe'])

/** "Mięsień dwugłowy ramienia" → /\b(?:(?:mies\w* )?dwuglow\w* ramieni\w*)\b/: the official names, inflected. */
function officialPattern(name: string): RegExp | null {
  const words = normalize(name)
    .split(' ')
    .filter((w) => !SIDE_WORDS.has(w))
  const optional = GENERIC.has(words[0]) && words.length > 1 ? `(?:${words.shift()!.slice(0, 4)}\\w* )?` : ''
  const stems = words.map((w) => (w.length <= 3 ? w : `${w.slice(0, Math.max(4, w.length - 1))}\\w*`))
  if (!stems.length) return null
  return new RegExp(`\\b(?:${optional}${stems.join(' ')})\\b`, 'g')
}

const OFFICIAL: Synonym[] = []
{
  const seen = new Set<string>()
  const parts = contentFile.parts as Record<string, { name?: string }>
  for (const [id, copy] of Object.entries(parts)) {
    const base = id.replace(/-(left|right)$/, '')
    if (!BASES.has(base) || !copy.name) continue
    const re = officialPattern(copy.name)
    if (!re || seen.has(re.source)) continue
    seen.add(re.source)
    OFFICIAL.push({ re, base })
  }
}

interface Match {
  start: number
  end: number
  synonym: Synonym
}

/** Every part mention, left to right; where two overlap the longer wins, then the colloquial one. */
function findParts(norm: string): Match[] {
  const all: (Match & { rank: number })[] = []
  const scan = (list: Synonym[], rank: number) => {
    for (const synonym of list) {
      for (const m of norm.matchAll(synonym.re)) {
        all.push({ start: m.index, end: m.index + m[0].length, synonym, rank })
      }
    }
  }
  scan(SYNONYMS, 0)
  scan(OFFICIAL, 1)
  all.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.rank - b.rank)
  const kept: Match[] = []
  for (const m of all) {
    if (kept.some((k) => m.start < k.end && k.start < m.end)) {
      // Overlapping: a longer one that starts later still replaces a shorter one ("ramienia" vs "kość ramienna").
      const i = kept.findIndex((k) => m.start < k.end && k.start < m.end)
      if (m.end - m.start > kept[i].end - kept[i].start) kept[i] = m
      continue
    }
    kept.push(m)
  }
  return kept
}

const LEFT = /\b(?:lew(?:y|a|e|ego|ej|ym|ymi|ych|emu|o))\b/g
const RIGHT = /\b(?:praw(?:y|a|e|ego|ej|ym|ymi|ych|emu))\b/g

/** The side said nearest to [start, end), if any. */
function sideNear(norm: string, start: number, end: number): 'left' | 'right' | null {
  let best: { side: 'left' | 'right'; gap: number } | null = null
  for (const [re, side] of [
    [LEFT, 'left'],
    [RIGHT, 'right'],
  ] as const) {
    for (const m of norm.matchAll(re)) {
      const s = m.index
      const e = s + m[0].length
      const gap = e <= start ? start - e : s >= end ? s - end : 0
      if (!best || gap < best.gap) best = { side, gap }
    }
  }
  return best?.side ?? null
}

function resolveId(base: string, side: 'left' | 'right' | null, selectedId?: string | null): string {
  if (!BASES.get(base)?.paired) return base
  if (side) return `${base}-${side}`
  if (selectedId?.replace(/-(left|right)$/, '') === base) return selectedId
  return `${base}-right`
}

function idsOf(norm: string, matches: Match[], selectedId: string | null | undefined, pain: boolean): string[] {
  const out: string[] = []
  for (const m of matches) {
    const base = (pain && m.synonym.painBase) || m.synonym.base
    const id = resolveId(base, sideNear(norm, m.start, m.end), selectedId)
    if (!out.includes(id)) out.push(id)
  }
  return out
}

/** Catalog ids of the parts the text names, in the order said. */
export function partsMentioned(text: string): string[] {
  const norm = normalize(text)
  return idsOf(norm, findParts(norm), null, false)
}

// ── Intensity ─────────────────────────────────────────────────────────

const NUMBER_WORDS: [RegExp, number][] = [
  [/^(jeden|jedna|jedno|jedynk\w*|jedynce)$/, 1],
  [/^(dwa|dwie|dwojk\w*)$/, 2],
  [/^(trzy|trojk\w*)$/, 3],
  [/^(cztery|czwork\w*)$/, 4],
  [/^(piec|piatk\w*)$/, 5],
  [/^(szesc|szostk\w*)$/, 6],
  [/^(siedem|siodemk\w*)$/, 7],
  [/^(osiem|osemk\w*)$/, 8],
  [/^(dziewiec|dziewiatk\w*)$/, 9],
  [/^(dziesiec|dziesiatk\w*)$/, 10],
]

function numberOf(word: string): number | null {
  if (/^\d{1,2}$/.test(word)) {
    const n = Number(word)
    return n >= 1 && n <= 10 ? n : null
  }
  for (const [re, n] of NUMBER_WORDS) if (re.test(word)) return n
  return null
}

/** Words after a number that make it a duration, a count or a measure, not how much it hurts. */
const UNIT = /^(dni|dzien|dnia|dniach|tydzien|tygodni\w*|godzin\w*|godz|h|min\w*|sekund\w*|miesiac\w*|miesiec\w*|lat|lata|roku|rok|razy|raz|x|kg|km|m|cm|rano|wieczor\w*|zl|procent)$/
/** Words before a number that make it a time ("od 3 dni", "co 2 godziny", "o 7"). */
const TIME_BEFORE = /^(od|przez|po|o|za|co|ok|okolo)$/
/** Words before a number that make it a rating ("na 6", "tak 7", "chyba 5"). */
const RATING_BEFORE = /^(na|tak|jakies|jakos|chyba|gdzies|to|jest|ze|jak|ocen\w*|poziom\w*|stopien|stopnia|skal\w*|wiecej|mniej)$/

const FUZZY: [RegExp, number][] = [
  [/\b(nie do (wytrzymania|zniesienia)|strasznie|okropnie|potwornie|koszmarnie|masakr\w*|nieziemsko|niesamowicie|maks\w*)\b/, 9],
  [/\b(srednio|umiarkowan\w*|tak sobie)\b/, 5],
  [/\b(bardzo|mocno|silnie|silny|mocny|duzo)\b/, 7],
  [/\b(lekko|troche|lekki|delikatnie|slabo|ciut|minimalnie|odrobin\w*)\b/, 3],
]

/** How much it hurts, 1–10, from a number ("na 6", "siedem na dziesięć") or words ("strasznie" → 9). */
/** `answering`: the question was "how much does it hurt?", so any 1–10 that isn't a time or amount is the answer ("siedem, piecze"). */
export function parseIntensity(text: string, answering = false): number | null {
  // The scale itself is not a rating: "w skali od 1 do 10 to 7".
  const norm = normalize(text)
    .replace(/\b(w )?skal\w* (od )?(1|jeden|jednego) do (10|dziesieciu)\b/g, ' ')
    .replace(/\bod (1|jeden|jednego) do (10|dziesieciu)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // "6 na 10", "6/10", "siedem na dziesięć".
  const outOf = /(?:^|\s)(\S+?)\s*(?:\s(?:na|z)\s|\/)\s*(10|dziesieciu|dziesiec)\b/.exec(norm)
  const scored = outOf ? numberOf(outOf[1]) : null
  if (scored) return scored

  const words = norm.split(' ').filter(Boolean)
  for (let i = 0; i < words.length; i++) {
    const n = numberOf(words[i])
    if (n === null) continue
    const before = words[i - 1] ?? ''
    const after = words[i + 1] ?? ''
    if (UNIT.test(after) || TIME_BEFORE.test(before)) continue
    const alone = words.length === 1
    const last = i === words.length - 1 && i > 0
    if (answering || alone || last || RATING_BEFORE.test(before) || /^(punkt\w*|pkt)$/.test(after)) return n
  }

  for (const [re, n] of FUZZY) if (re.test(norm)) return n
  return null
}

// ── Pain ──────────────────────────────────────────────────────────────

const PAIN = new RegExp(
  '\\b(' +
    [
      'bol(i|a|e|u|em|ach|ami|ow|al\\w*|esn\\w*|ec|ii)?|zabol\\w*|rozbol\\w*|pobol\\w*',
      'obolal\\w*',
      'kluj\\w*|klucie|klul\\w*',
      'piecz\\w*|pali',
      'rwie|rwacy|rwanie',
      'ciagnie|strzyk\\w*|strzela\\w*',
      'lupie|lupi|lupanie',
      'nawal\\w*|napieprz\\w*|napierdal\\w*|dokucz\\w*',
      'pulsuj\\w*|mrowi\\w*|dretw\\w*|cierpn\\w*',
      's?kurcz\\w*|sciska|gniecie|uciska|promieniuj\\w*|cmi',
      'naciagn\\w*|skrecil\\w*|skrecon\\w*|zwichn\\w*|stluk\\w*|nadwyrez\\w*|kontuzj\\w*|uraz\\w*|zakwas\\w*',
      'spuchn\\w*|opuchl\\w*|opuchniet\\w*',
    ].join('|') +
    ')\\b',
)

/** Pain type ids (the pain_types table), in its sort order, with how people describe them. */
const PAIN_TYPES: [string, RegExp][] = [
  ['throbbing', /\b(pulsuj\w*|pulsowani\w*|tetni\w*|lupie|lupi|lupanie)\b/],
  ['stabbing', /\b(kluj\w*|klucie|klul\w*)\b/],
  ['sharp', /\b(ostr(y|ego|o|a|e|ym)|strzyk\w*|strzela\w*)\b/],
  ['dull', /\btep(y|ego|o|a|e|ym)\b/],
  ['aching', /\bcmi(acy|aca|ace|acego|enie)?\b/],
  ['burning', /\b(piecz\w*|piekac\w*|pali|palac\w*|palenie|parzy)\b/],
  ['pressing', /\b(ucisk\w*|uciska\w*|gniec\w*|gniot\w*|sciska\w*|sciskow\w*|przygniat\w*)\b/],
  ['radiating', /\b(promieni\w*|rozchodz\w* sie|(idzie|schodzi|przechodzi|rozlewa sie) (do|na|w))\b/],
  ['tearing', /\brw(ie|acy|aca|ace|acego|anie|a)\b/],
  ['cramping', /\bs?kurcz\w*\b/],
  ['tingling', /\b(mrowi\w*|dretw\w*|cierpn\w*)\b/],
]

function painTypesOf(norm: string): string[] {
  return PAIN_TYPES.filter(([, re]) => re.test(norm)).map(([id]) => id)
}

// ── Red flags ─────────────────────────────────────────────────────────

/** Checked before anything else. The reason is shown to the person; suicide is 'myśli samobójcze' (116 123 as well as 112). */
const RED_FLAGS: [RegExp, string][] = [
  [
    /\b(zabic sie|zabije sie|zabije siebie|samobojst\w*|samobojcz\w*|nie chce (juz )?zyc|odebrac sobie zycie|skonczyc ze soba|chce umrzec)\b/,
    'myśli samobójcze',
  ],
  [/\bzawal(u|em|e)?\b/, 'podejrzenie zawału'],
  [
    /\b(dusznos\w*|dusz(e|i) sie|nie moge (zlapac )?(oddychac|oddechu|tchu)|brak (mi )?(tchu|powietrza)|brakuje mi (tchu|powietrza)|(ciezko|trudno) (mi )?oddych\w*|dlawi\w*)\b/,
    'duszność',
  ],
  [
    /\b((dretw\w*|opad\w*|krzyw\w*) (mi )?(\w+ )?twarz\w*|twarz\w* (mi )?(\w+ )?(dretw\w*|opad\w*|krzyw\w*)|belkot\w*|nie moge (mowic|wymowic)|mowie niewyraznie|niedowlad\w*|udar\w*|nie czuje polowy \w+)\b/,
    'objawy udaru',
  ],
  [
    /\b((nagl\w*|najgorsz\w*|piorunuj\w*|eksplod\w*) (\w+ ){0,3}(za)?bol\w* (\w+ ){0,2}glow\w*|(za)?bol\w* (\w+ ){0,2}glow\w* (\w+ ){0,3}(nagl\w*|najgorsz\w*))\b/,
    'nagły, bardzo silny ból głowy',
  ],
  [
    /\b(zemdl\w*|omdl\w*|stracil\w* przytomnos\w*|utrat\w* przytomnos\w*|nieprzytomn\w*|traci\w* przytomnos\w*)\b/,
    'utrata przytomności',
  ],
  [
    /\b((silne|silnie|mocne|mocno|duze|obfite|bardzo) krwaw\w*|krwotok\w*|krwaw\w* (\w+ )?(mocno|silnie|bardzo|bez przerwy)|nie (moge )?(zatrzymac|zatamowac) krw\w*|nie przestaje krwawic|leje sie krew)\b/,
    'silne krwawienie',
  ],
]

/** Pain in the chest: "boli mnie w klatce", "ściska mnie w piersi", "boli mnie serce". Not "klata" (the pecs, gym talk). */
const CHEST = /\b(klat(ka|ki|ce|ke)|piersi|piers|mostk\w*|mostek|serc\w*)\b/

function redFlag(norm: string): string | null {
  for (const [re, reason] of RED_FLAGS) if (re.test(norm)) return reason
  if (PAIN.test(norm) && CHEST.test(norm)) return 'ból w klatce piersiowej'
  return null
}

// ── Everything else ───────────────────────────────────────────────────

const EXERCISE =
  /\b(jak (\w+ ){0,2}(wzmocn|rozciag|cwicz|trenow|rozluzn|zbudow|napompow|rozbudow|rozgrz|wyrzezb|rozmasow)\w*|jakie cwiczeni\w*|cwiczeni\w* (na|dla)|cwicz\w* (na|dla)|co cwiczyc|wzmocnic|wzmacniac|wzmacniani\w*|rozciagnac|rozciagac|rozciagani\w*|rozluznic|rozluzniac|stretch\w*|trening\w* (na|dla))\b/
const RATED = /\b(na|\/)\s*\S+|\S+\s*(na|\/)\s*(10|dziesiec)\b/
const EXPLODED = /\b(roz(sun|loz|ciagnij narzad|dziel)\w*|osobno|oddziel\w*)\b/
const ORGANS = /\b(narzad\w*|organ\w*|wnetrz\w*|w srodku|srodek|kosc|kosci|szkielet\w*)\b/
const MUSCLES = /\b(miesni\w*|miesien|miesnie)\b/
const FLIP = /\b(odwroc\w*|obroc\w*|obrot\w*|tyl|tylu|z tylu|od tylu)\b/
const HELP =
  /\b(pomoc|pomocy|pomoz\w*|instrukcj\w*|jak (to )?dziala|jak (tego |z tego )?(korzystac|uzywac|obslugiwac)|co (ty )?(umiesz|potrafisz)|co moge|co mozna|jak zaczac|o co chodzi)\b/
const THANKS = /\b(dzieki|dziekuje|dziekujemy|dzieks|dziekowka|thx|thanks)\b/

export function understand(text: string, ctx: { selectedId?: string | null } = {}): Intent {
  const norm = normalize(text)
  if (!norm) return { kind: 'unknown' }

  const flag = redFlag(norm)
  if (flag) return { kind: 'emergency', reason: flag }

  const matches = findParts(norm)
  const selected = ctx.selectedId ?? null
  const pain = PAIN.test(norm)
  const ids = idsOf(norm, matches, selected, pain)
  const named = ids[0] ?? null
  // No part named ("to", "tutaj", "boli mnie na 6"): the one already selected.
  const here = named ?? selected

  // Before pain: "jakie ćwiczenia na ból pleców" asks for exercises.
  if (EXERCISE.test(norm) && here) return { kind: 'exercise', partId: here }

  const intensity = parseIntensity(text)
  if (pain || (named && intensity !== null && RATED.test(norm))) {
    return { kind: 'pain', partId: here, intensity, typeIds: painTypesOf(norm) }
  }

  if (named) {
    if (matches.every((m) => m.synonym.back)) return { kind: 'flip' }
    return { kind: 'show', partId: named }
  }

  if (EXPLODED.test(norm)) return { kind: 'layer', layer: 'exploded' }
  if (MUSCLES.test(norm)) return { kind: 'layer', layer: 'muscles' }
  if (ORGANS.test(norm)) return { kind: 'layer', layer: 'organs' }
  if (FLIP.test(norm)) return { kind: 'flip' }
  if (HELP.test(norm)) return { kind: 'help' }
  if (THANKS.test(norm)) return { kind: 'thanks' }
  if (selected && /\b(co to|czym jest|do czego|opowiedz|powiedz)\b/.test(norm)) return { kind: 'show', partId: selected }
  return { kind: 'unknown' }
}
