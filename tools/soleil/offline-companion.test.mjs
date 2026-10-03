// Quick test for Soleil's offline companion (offline-companion.js).
// Run: node tools/soleil/offline-companion.test.mjs
// Prints topic -> reply for sample messages; fails (exit 1) if any crisis message
// comes back without the crisis contacts, or a topic is detected wrongly.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const require = createRequire(import.meta.url)
const { create, detect } = require('../../soleil-main/offline-companion.js')

const CONTACTS = ['tel:112', 'tel:116123', 'tel:800702222', 'tel:116111']
let failures = 0
const check = (label, fn) => {
  try { fn() } catch (e) { failures++; console.log(`  ✗ ${label}: ${e.message}`) }
}
const short = (s) => (s.length > 150 ? s.slice(0, 147) + '…' : s)

// 1. Safety: each phrase alone, in a fresh conversation, must return all crisis contacts
const SAFETY = [
  'Nie chcę żyć',
  'chyba już nie chcę dalej żyć',
  'Chcę się zabić',
  'myślę żeby się zabić',
  'boję się, że mogę się skrzywdzić',
  'mam ochotę skrzywdzić się',
  'Myślę o samobójstwie',
  'mam myśli samobójcze',
  'nie ma sensu żyć',
  'Życie nie ma sensu',
  'chciałabym umrzeć',
  'tnę się od miesiąca',
  'wszystkim byłoby lepiej beze mnie',
  'NIE CHCE ZYC!!!', // no diacritics, shouting
  // Found by the knowledge-base tester (sleep and pills)
  'chcę zasnąć i się nie obudzić',
  'chciałabym zasnąć na zawsze',
  'zasnąć i już nigdy się nie obudzić',
  'wezmę wszystkie tabletki nasenne naraz',
  'ile tabletek trzeba, żeby umrzeć',
  'jaka dawka jest śmiertelna',
  'chcę łyknąć całe opakowanie',
  'najchętniej bym zasnęła i się nie obudziła',
  'chciałbym się nie obudzić',
  'łyknę wszystkie tabletki nasenne',
  'obym się jutro nie obudziła',
  'mam nadzieję, że się nie obudzę',
  'chcę zasnąć i nie budzić się więcej',
  'wezmę wszystkie nasenne naraz',
  'chcę wziąć wszystkie tabletki na ból głowy naraz',
  'obym się nigdy więcej nie obudził',
  'wezmę wszystkie zolpidemy naraz',
]
console.log('— Safety (fresh conversation each) —')
for (const msg of SAFETY) {
  const r = create({ random: () => 0 }).reply(msg)
  console.log(`${r.topic.padEnd(14)} ${msg}\n${' '.repeat(15)}→ ${short(r.text)}`)
  check(msg, () => {
    assert.equal(r.topic, 'crisis')
    for (const c of CONTACTS) assert.ok(r.html.includes(c), `missing ${c}`)
  })
}

// 2. Topics, each in a fresh conversation
const TOPICS = [
  ['😔 Jestem smutny/a', 'sad'],
  ['💼 Problem w pracy/szkole', 'work'],
  ['💔 Kłótnia z kimś bliskim', 'conflict'],
  ['😰 Czuję stres', 'stress'],
  ['Czuję się bardzo samotna', 'lonely'],
  ['ciągle mam lęk i niepokój', 'anxiety'],
  ['wkurza mnie mój brat', 'anger'],
  ['jestem strasznie zmęczony, nie mogę spać', 'tired'],
  ['nie chce mi się nic robić, zero motywacji', 'motivation'],
  ['Zdałam egzamin! Jestem taka szczęśliwa', 'joy'],
  ['boli mnie kolano od tygodnia', 'pain'],
  ['mam ból w klatce piersiowej i duszność', 'redflag'],
  ['boli mnie w klatce piersiowej', 'redflag'],
  ['kłuje mnie w klatce', 'redflag'],
  ['budzę się z dusznością', 'redflag'],
  ['się duszę', 'redflag'],
  ['brakuje mi powietrza', 'redflag'],
  ['boli mnie klatka w nocy', 'redflag'],
  ['przedawkowałem leki nasenne', 'redflag'],
  ['nie mogę dobudzić mamy po tabletkach nasennych', 'redflag'],
  ['dziecko zjadło całe opakowanie melatoniny', 'redflag'],
  ['tata wziął tabletkę nasenną i oddycha bardzo wolno', 'redflag'],
  ['dusi mnie kaszel', 'redflag'],
  ['dziecko zjadło tabletki na sen', 'redflag'],
  ['mama ledwo oddycha po lekach', 'redflag'],
  ['nie mogę go obudzić', 'redflag'],
  ['tata nie reaguje', 'redflag'],
  ['babcia ma nagle krzywą buzię', 'redflag'],
  ['mamie opada kącik ust', 'redflag'],
  ['tata nagle mówi niewyraźnie', 'redflag'],
  ['bolą mnie zęby', 'pain'],
  // Not crisis, not pain: 'żeby' isn't 'zęby', oversleeping isn't a wish to die
  ['chcę, żeby mama mnie zrozumiała', 'open'],
  ['zasnąłem i nie obudziłem się na czas', 'tired'],
  ['boli mnie, że się pokłóciliśmy', 'conflict'],
  ['nie jest dobrze', 'sad'],
  ['Hej!', 'greeting'],
  ['dziękuję ci bardzo', 'thanks'],
  ['zupa była za słona', 'open'],
  // The mood faces on the chat screen send these (chat.js)
  ['Czuję się bardzo źle', 'sad'],
  ['Jest mi dziś źle', 'sad'],
  ['Tak sobie, średnio', 'meh'],
  ['Czuję się dobrze', 'joy'],
  ['Czuję się świetnie!', 'joy'],
  ['Mam w głowie gonitwę myśli', 'anxiety'],
  // Every topic tile in art.js's pool lands on its own topic
  ...[...readFileSync(new URL('../../soleil-main/art.js', import.meta.url), 'utf8').matchAll(/group: '(\w+)', pl: '([^']+)'/g)].map(([, group, pl]) => [pl, group]),
]
console.log('\n— Topics (fresh conversation each) —')
for (const [msg, want] of TOPICS) {
  const r = create({ random: () => 0 }).reply(msg)
  console.log(`${r.topic.padEnd(14)} ${msg}\n${' '.repeat(15)}→ ${short(r.text)}`)
  check(msg, () => assert.equal(detect(msg).topic, want))
  if (want === 'pain') check(`${msg} links`, () => assert.ok(r.html.includes('href="cialo/"') && r.html.includes('href="gdzie-boli/"')))
  if (want === 'redflag') check(`${msg} 112`, () => assert.ok(r.html.includes('tel:112')))
  check(`${msg} never "nie rozumiem"`, () => assert.ok(!/nie rozumiem/i.test(r.text)))
}

// 3. A conversation: multi-turn, no repeats, crisis mid-conversation
console.log('\n— Conversation —')
const c = create({ random: Math.random })
const convo = ['Czuję stres', 'tak', 'nie wiem', 'w pracy jest za dużo wszystkiego', 'Czuję stres', 'Czuję stres', 'Czuję stres',
  'czasem myślę, że nie ma sensu żyć', 'nie', 'dzięki']
const replies = []
for (const msg of convo) {
  const r = c.reply(msg)
  replies.push(r)
  console.log(`${r.topic.padEnd(14)} ${msg}\n${' '.repeat(15)}→ ${short(r.text)}`)
}
check('no links off the site', () => assert.ok(replies.every((r) => !/https?:/.test(r.html))))
check('"tak" after an offered step continues it', () => assert.match(replies[1].topic, /^stress:yes$/))
check('"nie wiem" stays on topic', () => assert.match(replies[2].topic, /^stress:dunno$/))
check('4 × "Czuję stres" gives 4 different replies', () => {
  const texts = [replies[0], replies[4], replies[5], replies[6]].map((r) => r.text)
  assert.equal(new Set(texts).size, 4)
})
check('crisis mid-conversation', () => { for (const k of CONTACTS) assert.ok(replies[7].html.includes(k)) })
check('after a crisis, "nie" keeps the contacts', () => assert.ok(replies[8].html.includes('tel:116123')))
check('after a crisis, every reply keeps a crisis line', () => assert.ok(replies[9].html.includes('tel:116123')))
check('every reply says what it offers (kind)', () => { for (const r of replies) assert.ok(typeof r.kind === 'string' && r.kind, `kind ${r.kind}`) })
check('typing delay 600–1200 ms', () => { for (const r of replies) assert.ok(r.delay >= 600 && r.delay <= 1200, `delay ${r.delay}`) })

console.log(failures ? `\n${failures} FAILED` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
