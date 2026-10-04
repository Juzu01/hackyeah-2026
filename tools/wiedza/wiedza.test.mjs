// Test of Soleil's offline chat with the knowledge base (soleil-main/data/wiedza.json).
// Run: node tools/wiedza/wiedza.test.mjs                    the whole base
//      node tools/wiedza/wiedza.test.mjs --wpis <file>      one draft entry (tester), as if it were already in the base
//      ... --pytanie "jak zmierzyc cisnienie"              also show where this message goes (repeatable)
// Fails (exit 1) when the base breaks the format, a sample question doesn't reach its entry, the base answers
// instead of the crisis lines or the 112 reply, plain feelings get a knowledge answer, or base text isn't escaped.
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import assert from 'node:assert/strict'
import { DB_PATH, readJson, validateDb, validateEntry, topicIds } from './sprawdz.mjs'

const require = createRequire(import.meta.url)
const { create } = require('../../soleil-main/offline-companion.js')

const args = process.argv.slice(2)
const draftPath = args.includes('--wpis') ? args[args.indexOf('--wpis') + 1] : null
const asked = args.flatMap((a, i) => (args[i - 1] === '--pytanie' ? [a] : []))

let failures = 0
const check = (label, fn) => {
  try { fn() } catch (e) { failures++; console.log(`  ✗ ${label}: ${e.message}`) }
}
const ask = (db, msg) => create({ knowledge: db, random: () => 0 }).reply(msg)

let db = existsSync(DB_PATH) ? readJson(DB_PATH) : { version: 1, updated: '2026-01-01', disclaimer: '112', entries: [] }
if (draftPath) {
  const doc = readJson(resolve(draftPath))
  const entry = doc.entry || doc
  const { errors } = validateEntry(entry, { topics: topicIds() })
  errors.forEach((e) => { failures++; console.log(`  ✗ format: ${e}`) })
  db = { ...db, entries: [...db.entries.filter((e) => e.id !== entry.id), entry] }
  console.log(`Wpis roboczy ${entry.id} sprawdzany razem z ${db.entries.length - 1} wpisami z bazy`)
} else if (existsSync(DB_PATH)) {
  const { errors } = validateDb(db)
  errors.forEach((e) => { failures++; console.log(`  ✗ format: ${e}`) })
}

// 1. Every sample question reaches its own entry. A question with an emergency sign ('ból w klatce piersiowej')
// gets the 112 reply first, and then the entry is offered ("napisz „tak”"); that counts too.
for (const e of db.entries) {
  for (const q of e.questions || []) {
    check(`${e.id}: "${q}"`, () => {
      const r = ask(db, q)
      assert.ok(r.topic === `info:${e.id}` || (r.topic === 'redflag' && r.offer === e.id), `${r.topic}${r.offer ? ' (oferta: ' + r.offer + ')' : ''}`)
    })
  }
}

// 2. Safety first: a crisis or an emergency in the same message beats any knowledge answer
for (const e of db.entries) {
  const q = (e.questions || [])[0]
  if (!q) continue
  check(`${e.id}: kryzys ma pierwszeństwo`, () => assert.equal(ask(db, `Nie chcę żyć. ${q}`).topic, 'crisis'))
  check(`${e.id}: ból w klatce ma pierwszeństwo`, () => assert.equal(ask(db, `Mam ból w klatce piersiowej. ${q}`).topic, 'redflag'))
}

// 3. Plain feelings and small talk stay with the conversation
const FEELINGS = ['jestem dziś bardzo smutny', 'pokłóciłem się z mamą', 'mam dość tej pracy', 'czuję się taka samotna',
  'hej', 'dziękuję', 'tak', 'nie wiem', 'jestem zła na szefa', 'zdałam egzamin!', 'boli mnie łokieć'] // pain with no entry; with one ('boli mnie głowa') the entry answers
// ...and so do the topic tiles (art.js) and the mood faces (chat.js) on the chat screen
const ART = readFileSync(new URL('../../soleil-main/art.js', import.meta.url), 'utf8')
const CHAT = readFileSync(new URL('../../soleil-main/chat.js', import.meta.url), 'utf8')
FEELINGS.push(...[...ART.matchAll(/group: '\w+', pl: '([^']+)'/g)].map((m) => m[1]),
  ...JSON.parse((CHAT.match(/say: (\[[^\]]*\])/) || ['', '[]'])[1].replace(/'/g, '"')))
for (const msg of FEELINGS) {
  check(`rozmowa: "${msg}"`, () => assert.ok(!ask(db, msg).topic.startsWith('info:'), `poszło do bazy: ${ask(db, msg).topic}`))
}

// 3b. The chat answers instead of sending the user elsewhere
const has = (id) => db.entries.some((e) => e.id === id)
if (has('bol-glowy')) check('objaw w ciele: "boli mnie głowa od rana" dostaje wpis', () => assert.equal(ask(db, 'boli mnie głowa od rana').topic, 'info:bol-glowy'))
if (has('obnizony-nastroj-czy-depresja')) check('zwierzenie z nazwą choroby: rozmowa + propozycja wpisu, po „tak” wpis', () => {
  const c = create({ knowledge: db, random: () => 0 })
  const first = c.reply('mam depresję')
  assert.ok(!first.topic.startsWith('info:') && first.offer, `${first.topic} offer=${first.offer}`)
  assert.equal(c.reply('Tak, opowiedz').topic, 'info:obnizony-nastroj-czy-depresja')
})
check('pytanie bez sprawdzonej odpowiedzi: czat mówi to wprost', () => {
  const { topic, text } = ask(db, 'czy mogę jeść grejpfruty?')
  assert.ok(topic === 'open' && /nie mam jeszcze sprawdzonej odpowiedzi/.test(text), `${topic}: ${text}`)
})

// 4. Base text is escaped and links are https only
const evil = {
  id: 'test-html', domain: 'objawy', tier: 1, keywords: ['zzztest*'], answer: '<img src=x onerror=alert(1)> "uwaga"',
  warningSigns: [{ sign: '<b>zly</b> objaw', triage: 'emergency', action: 'Dzwoń pod 112.' }],
  sources: [{ id: 's1', publisher: '<i>X</i>', url: 'https://example.org/"onmouseover="x' }, { id: 's2', publisher: 'Y', url: 'javascript:alert(1)' }],
}
check('tekst z bazy jest escapowany', () => {
  const { html } = ask({ entries: [evil] }, 'co to zzztesty?')
  assert.ok(!/<img|<b>|<i>|javascript:|"onmouseover/.test(html), html)
  assert.ok(html.includes('href="tel:112"'))
})
check('hasło bez pytajnika ("objawy ...") też trafia do bazy', () => assert.equal(ask({ entries: [evil] }, 'objawy zzztestu').topic, 'info:test-html'))
check('bez bazy czat działa jak wcześniej', () => assert.equal(ask(null, 'jak zmierzyć ciśnienie?').topic.startsWith('info:'), false))

// 5. Questions from the command line: just show where they go
for (const q of asked) {
  const r = ask(db, q)
  console.log(`  "${q}" -> ${r.topic}${r.topic.startsWith('info:') ? '' : ' (nie z bazy)'}`)
}

console.log(failures ? `\n${failures} błędów` : `\nOK: ${db.entries.length} wpisów, wszystkie pytania trafiają, bezpieczeństwo bez zmian`)
process.exit(failures ? 1 : 0)
