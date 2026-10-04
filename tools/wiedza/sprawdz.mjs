// Checks Doco's knowledge base (doco/data/wiedza.json) or one working file of the agent team.
// Run: node tools/wiedza/sprawdz.mjs [file]
//   no file:        the whole base and tools/wiedza/tematy.json
//   1-badanie.json, 2-weryfikacja.json, 3-test.json or a bare entry: that file only
// Rules are in tools/wiedza/ZASADY.md. Exit 1 on any error; warnings don't fail.
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
export const DB_PATH = join(ROOT, 'doco/data/wiedza.json')
export const TOPICS_PATH = join(ROOT, 'tools/wiedza/tematy.json')

export const DOMAINS = ['psychika', 'objawy', 'sport', 'samobadanie', 'profilaktyka']
export const TRIAGE_LEVELS = ['self-care', 'gp', 'urgent', 'emergency'] // same as src/data/types.ts
const TOPIC_STATUSES = ['do-zbadania', 'w-toku', 'w-bazie', 'do-poprawy']
const CHECK_STATUSES = ['confirmed', 'corrected', 'removed', 'unverifiable']
const TEST_KINDS = ['scenariusz', 'wykonanie', 'zrozumialosc', 'bezpieczenstwo', 'spojnosc', 'kompletnosc', 'czat']
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
const KEYWORD = /^[a-z0-9]+\*?( [a-z0-9]+\*?)*$/ // as after normalize() in offline-companion.js, '*' = any word ending
const DATE = /^\d{4}-\d{2}-\d{2}$/

const isStr = (v) => typeof v === 'string' && v.trim().length > 0
const isList = (v) => Array.isArray(v) && v.every(isStr)
const isCount = (v) => Number.isInteger(v) && v >= 0

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
export const topicIds = () => (existsSync(TOPICS_PATH) ? new Set(readJson(TOPICS_PATH).map((t) => t.id)) : null)

// One entry. review: true for entries in the base (the archivist fills it), false for drafts.
export function validateEntry(e, { review = false, topics = null } = {}) {
  const errors = []
  const warnings = []
  const err = (m) => errors.push(`${e?.id || '?'}: ${m}`)
  const warn = (m) => warnings.push(`${e?.id || '?'}: ${m}`)
  if (!e || typeof e !== 'object' || Array.isArray(e)) return { errors: ['wpis nie jest obiektem'], warnings }

  if (!isStr(e.id) || !ID.test(e.id)) err('id musi być w kebab-case, bez polskich znaków')
  for (const k of ['title', 'audience', 'summary', 'answer']) if (!isStr(e[k])) err(`brak pola ${k}`)
  if (!DOMAINS.includes(e.domain)) err(`domain musi być jednym z: ${DOMAINS.join(', ')}`)
  if (![1, 2, 3].includes(e.tier)) err('tier musi być 1, 2 albo 3')
  if (!isList(e.keywords) || e.keywords.length < 4) err('keywords: co najmniej 4 frazy')
  else for (const k of e.keywords) {
    if (!KEYWORD.test(k)) err(`keyword "${k}": tylko a-z, cyfry, pojedyncze spacje i * na końcu słowa (zapis jak po normalize())`)
    else if (k.replace(/\*/g, '').length < 3) err(`keyword "${k}" jest za krótki`)
  }
  if (!isList(e.questions) || e.questions.length < 3) err('questions: co najmniej 3 pytania')
  if (isStr(e.answer) && e.answer.length > 700) warn(`answer ma ${e.answer.length} znaków (zalecane do 700)`)

  const sourceIds = new Set()
  if (!Array.isArray(e.sources) || e.sources.length < 2) err('sources: co najmniej 2 źródła')
  for (const s of Array.isArray(e.sources) ? e.sources : []) {
    if (!isStr(s?.id) || sourceIds.has(s.id)) err(`źródło bez id albo z powtórzonym id (${s?.id})`)
    else sourceIds.add(s.id)
    if (!isStr(s?.title) || !isStr(s?.publisher)) err(`źródło ${s?.id}: brak title albo publisher`)
    if (!isStr(s?.url) || !/^https:\/\/[^\s"'<>]+$/.test(s.url)) err(`źródło ${s?.id}: url musi zaczynać się od https:// i nie mieć spacji ani cudzysłowów`)
    if (s?.year != null && !(Number.isInteger(s.year) && s.year > 1900 && s.year <= 2100)) err(`źródło ${s?.id}: year musi być rokiem`)
  }

  if (!Array.isArray(e.facts) || e.facts.length < 3) err('facts: co najmniej 3 twierdzenia')
  const cited = new Set()
  for (const f of Array.isArray(e.facts) ? e.facts : []) {
    if (!isStr(f?.text)) err('fakt bez text')
    if (!isList(f?.sources) || !f.sources.length) err(`fakt bez źródła: "${String(f?.text).slice(0, 60)}"`)
    else for (const id of f.sources) {
      if (!sourceIds.has(id)) err(`fakt odwołuje się do nieistniejącego źródła ${id}`)
      cited.add(id)
    }
  }
  for (const id of sourceIds) if (!cited.has(id)) warn(`źródło ${id} nie popiera żadnego faktu`)

  if (!Array.isArray(e.selfCare) || !e.selfCare.every(isStr)) err('selfCare musi być listą tekstów (może być pusta)')
  if (!Array.isArray(e.warningSigns) || !e.warningSigns.length) err('warningSigns: co najmniej 1 sygnał')
  for (const w of Array.isArray(e.warningSigns) ? e.warningSigns : []) {
    if (!isStr(w?.sign) || !isStr(w?.action)) err('sygnał bez sign albo action')
    if (!TRIAGE_LEVELS.includes(w?.triage)) err(`triage "${w?.triage}" spoza listy: ${TRIAGE_LEVELS.join(', ')}`)
    if (w?.triage === 'emergency' && !/\b112\b|\bSOR\b/.test(w.action || '')) err(`sygnał emergency musi kierować do 112 albo SOR: "${String(w.sign).slice(0, 60)}"`)
  }
  if (!Array.isArray(e.related) || !e.related.every((r) => isStr(r) && ID.test(r))) err('related musi być listą id (może być pusta)')
  else if (topics) for (const r of e.related) if (!topics.has(r)) warn(`related "${r}" nie ma w tematy.json`)

  // The chat escapes text anyway, but tags would show up as raw text
  const texts = [e.title, e.summary, e.answer, e.audience, ...(e.selfCare || []), ...(e.facts || []).map((f) => f?.text),
    ...(e.warningSigns || []).flatMap((w) => [w?.sign, w?.action])]
  if (texts.some((t) => typeof t === 'string' && /<[a-z/!]/i.test(t))) err('tekst nie może zawierać znaczników HTML')

  if (review) {
    const r = e.review
    if (!r || typeof r !== 'object') err('brak review (wypełnia archiwista)')
    else {
      for (const k of ['researched', 'verified', 'tested']) if (!DATE.test(r[k] || '')) err(`review.${k} musi być datą RRRR-MM-DD`)
      if (!r.claims || !CHECK_STATUSES.every((k) => isCount(r.claims[k]))) err('review.claims musi mieć liczby confirmed, corrected, removed, unverifiable')
      if (!r.tests || !isCount(r.tests.passed) || !isCount(r.tests.total) || r.tests.total === 0) err('review.tests musi mieć passed i total > 0')
      else if (r.tests.passed !== r.tests.total) err(`do bazy trafiają tylko wpisy z zaliczonymi wszystkimi testami (${r.tests.passed}/${r.tests.total})`)
      if (!isCount(r.revisions)) err('review.revisions musi być liczbą')
    }
  } else if (e.review !== undefined) warn('review wypełnia dopiero archiwista')
  return { errors, warnings }
}

export function validateDb(db, { topics = topicIds() } = {}) {
  const errors = []
  const warnings = []
  if (!db || typeof db !== 'object') return { errors: ['baza nie jest obiektem'], warnings }
  if (!Number.isInteger(db.version)) errors.push('baza: brak version')
  if (!DATE.test(db.updated || '')) errors.push('baza: updated musi być datą RRRR-MM-DD')
  if (!isStr(db.disclaimer) || !/112/.test(db.disclaimer)) errors.push('baza: disclaimer musi wspominać 112')
  if (!Array.isArray(db.entries)) return { errors: [...errors, 'baza: brak listy entries'], warnings }
  const seen = new Set()
  const owner = new Map()
  for (const e of db.entries) {
    if (seen.has(e?.id)) errors.push(`${e?.id}: powtórzone id`)
    seen.add(e?.id)
    const r = validateEntry(e, { review: true, topics })
    errors.push(...r.errors)
    warnings.push(...r.warnings)
    for (const k of e?.keywords || []) {
      if (owner.has(k) && owner.get(k) !== e.id) warnings.push(`keyword "${k}" jest w ${owner.get(k)} i ${e.id}`)
      owner.set(k, e.id)
    }
  }
  return { errors, warnings }
}

export function validateTopics(list) {
  const errors = []
  if (!Array.isArray(list)) return { errors: ['tematy.json musi być listą'], warnings: [] }
  const seen = new Set()
  for (const t of list) {
    const p = `temat ${t?.id || '?'}`
    if (!isStr(t?.id) || !ID.test(t.id)) errors.push(`${p}: id w kebab-case`)
    if (seen.has(t?.id)) errors.push(`${p}: powtórzone id`)
    seen.add(t?.id)
    if (!isStr(t?.name)) errors.push(`${p}: brak name`)
    if (!DOMAINS.includes(t?.domain)) errors.push(`${p}: domain spoza listy`)
    if (![1, 2, 3].includes(t?.tier)) errors.push(`${p}: tier 1, 2 albo 3`)
    if (!TOPIC_STATUSES.includes(t?.status)) errors.push(`${p}: status jeden z ${TOPIC_STATUSES.join(', ')}`)
  }
  return { errors, warnings: [] }
}

// A working file of one agent: 1-badanie.json, 2-weryfikacja.json or 3-test.json (recognised by its fields)
export function validateWorkFile(doc, { topics = topicIds() } = {}) {
  if (doc && Array.isArray(doc.entries)) return validateDb(doc, { topics })
  if (!doc || !doc.entry) return validateEntry(doc, { topics })
  const { errors, warnings } = validateEntry(doc.entry, { topics })
  const err = (m) => errors.push(`${doc.entry.id || '?'}: ${m}`)
  if ('claims' in doc || 'researchedAt' in doc) {
    if (!DATE.test(doc.researchedAt || '')) err('researchedAt musi być datą RRRR-MM-DD')
    if (!Number.isInteger(doc.revision)) err('brak revision (0 przy pierwszym badaniu)')
    if (!isStr(doc.notes)) err('brak notes dla weryfikatora')
    if (!Array.isArray(doc.claims) || !doc.claims.length) err('brak claims')
    else if (doc.claims.length < (doc.entry.facts || []).length) warnings.push(`${doc.entry.id}: mniej claims (${doc.claims.length}) niż facts (${doc.entry.facts.length})`)
  } else if ('checks' in doc || 'verifiedAt' in doc) {
    if (!DATE.test(doc.verifiedAt || '')) err('verifiedAt musi być datą RRRR-MM-DD')
    if (!['approved', 'corrected', 'rejected'].includes(doc.verdict)) err('verdict: approved, corrected albo rejected')
    if (!isStr(doc.summary)) err('brak summary')
    if (!Array.isArray(doc.checks) || !doc.checks.length) err('brak checks')
    for (const c of doc.checks || []) if (!CHECK_STATUSES.includes(c?.status) || !isStr(c?.claim)) err(`check bez claim albo ze złym statusem: ${c?.status}`)
  } else if ('tests' in doc || 'testedAt' in doc) {
    if (!DATE.test(doc.testedAt || '')) err('testedAt musi być datą RRRR-MM-DD')
    if (!['pass', 'fail'].includes(doc.verdict)) err('verdict: pass albo fail')
    if (!Array.isArray(doc.tests) || !doc.tests.length) err('brak tests')
    for (const t of doc.tests || []) if (!TEST_KINDS.includes(t?.kind) || typeof t?.passed !== 'boolean') err(`test "${t?.name}": zły kind albo passed`)
    if (!Array.isArray(doc.fixesApplied) || !Array.isArray(doc.blockingIssues)) err('brak fixesApplied albo blockingIssues')
    else if (doc.verdict === 'pass' && (doc.blockingIssues.length || (doc.tests || []).some((t) => !t.passed))) err('verdict pass, a są blokery albo niezaliczone testy')
  }
  return { errors, warnings }
}

function report(label, { errors, warnings }) {
  for (const w of warnings) console.log(`  uwaga: ${w}`)
  for (const e of errors) console.log(`  BŁĄD: ${e}`)
  console.log(errors.length ? `${label}: ${errors.length} błędów` : `${label}: OK`)
  return errors.length
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let failed = 0
  const file = process.argv[2]
  if (file) {
    failed += report(file, validateWorkFile(readJson(resolve(file))))
  } else {
    failed += report(relative(ROOT, TOPICS_PATH), validateTopics(readJson(TOPICS_PATH)))
    if (existsSync(DB_PATH)) failed += report(relative(ROOT, DB_PATH), validateDb(readJson(DB_PATH)))
    else console.log(`${relative(ROOT, DB_PATH)}: jeszcze nie ma bazy`)
  }
  process.exit(failed ? 1 : 0)
}
