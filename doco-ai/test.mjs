// Test of the Doco AI function without the network and without a key: fetch is replaced by a fake that serves
// the local knowledge base and answers instead of the Claude, Grok and Groq APIs.
// Run: node doco-ai/test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const DB = readFileSync(new URL('../doco/data/wiedza.json', import.meta.url), 'utf8')
let sent = null
const tried = []
const down = {} // host -> HTTP status it answers with, to play an outage, a rate limit or no credit
globalThis.fetch = async (url, init) => {
  if (String(url).endsWith('data/wiedza.json')) return new Response(DB, { status: 200 })
  const host = new URL(url).hostname
  if (!['api.anthropic.com', 'api.groq.com', 'api.x.ai'].includes(host)) throw new Error('unexpected fetch ' + url)
  sent = { url, headers: init.headers, body: JSON.parse(init.body) }
  tried.push(host)
  const status = down[host] || 200
  if (host === 'api.anthropic.com') return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Odpowiedź testowa.' }] }), { status })
  return new Response(JSON.stringify({ choices: [{ message: { content: '## Ból głowy\n**Odpowiedź** z Groq.' } }] }), { status })
}
const { default: handler, search, cleanMessages } = await import('./api/chat.js')

function call(body, { origin = 'https://juzu01.github.io', method = 'POST', ip = '1.2.3.4' } = {}) {
  const res = { code: 0, headers: {}, data: null }
  res.setHeader = (k, v) => { res.headers[k] = v }
  res.status = (c) => { res.code = c; return res }
  res.json = (d) => { res.data = d; return res }
  res.end = () => res
  return handler({ method, headers: { origin, 'x-forwarded-for': ip }, body }, res).then(() => res)
}
const ask = (text, opts) => call({ messages: [{ role: 'user', content: text }], language: 'pl' }, opts)

let failures = 0
const check = async (label, fn) => {
  try { await fn(); console.log(`  ✓ ${label}`) } catch (e) { failures++; console.log(`  ✗ ${label}: ${e.message}`) }
}

await check('bez klucza: 503 not-configured', async () => {
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.GROQ_API_KEY
  const r = await ask('hej')
  assert.equal(r.code, 503)
})

// Groq (free plan): shorter context and history, OpenAI-style request, markdown stripped from the reply
process.env.GROQ_API_KEY = 'groq-key'
let groqSystem = ''
await check('Groq: pytanie o ból głowy idzie do Groq z wpisem bol-glowy', async () => {
  const r = await ask('boli mnie głowa od rana, co mogę wziąć?', { ip: '7.7.7.1' })
  assert.equal(r.code, 200)
  assert.match(sent.url, /^https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions$/)
  assert.equal(sent.headers.authorization, 'Bearer groq-key')
  assert.equal(sent.body.messages[0].role, 'system')
  assert.equal(sent.body.messages.at(-1).content, 'boli mnie głowa od rana, co mogę wziąć?')
  groqSystem = sent.body.messages[0].content
  assert.match(groqSystem, /Ból głowy/)
  assert.deepEqual(r.data.entries.slice(0, 1), ['bol-glowy'])
  assert.equal(r.data.reply, 'Ból głowy\nOdpowiedź z Groq.')
})
await check('Groq: wyciąg z bazy ma najwyżej 8 faktów i wszystkie sygnały „emergency”', () => {
  const e = JSON.parse(DB).entries.find((x) => x.id === 'bol-glowy')
  const facts = groqSystem.split('Fakty:\n')[1].split('\nCo można')[0].split('\n')
  assert.ok(facts.length <= 8, `faktów: ${facts.length}`)
  for (const w of e.warningSigns.filter((w) => w.triage === 'emergency')) assert.ok(groqSystem.includes(w.sign), w.sign)
  assert.ok(groqSystem.length < 12000, `prompt: ${groqSystem.length} znaków`)
})
await check('Groq: historia najwyżej 6 wiadomości', async () => {
  const long = Array.from({ length: 11 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'ból głowy ' + i }))
  await call({ messages: long }, { ip: '7.7.7.2' })
  assert.ok(sent.body.messages.length - 1 <= 6 && sent.body.messages[1].role === 'user')
})
await check('Groq: limit darmowego planu (429), a zapasu brak → 502, strona odpowiada offline', async () => {
  down['api.groq.com'] = 429
  const r = await ask('hej', { ip: '7.7.7.3' })
  delete down['api.groq.com']
  assert.equal(r.code, 502)
  assert.deepEqual(r.data.failed, ['groq:429'])
})
await check('Grok (xAI): ma pierwszeństwo przed Groq, dłuższy wyciąg niż Groq', async () => {
  process.env.XAI_API_KEY = 'xai-key'
  const r = await ask('boli mnie głowa od rana, co mogę wziąć?', { ip: '7.7.7.5' })
  assert.equal(r.data.provider, 'xai')
  assert.equal(sent.url, 'https://api.x.ai/v1/chat/completions')
  assert.equal(sent.headers.authorization, 'Bearer xai-key')
  assert.equal(sent.body.model, 'grok-4.3')
  const facts = sent.body.messages[0].content.split('Fakty:\n')[1].split('\nCo można')[0].split('\n')
  assert.ok(facts.length > 8 && facts.length <= 15, `faktów: ${facts.length}`)
})
await check('zapas: Grokowi skończyły się środki (403) → odpowiada Groq z krótszym wyciągiem', async () => {
  down['api.x.ai'] = 403
  tried.length = 0
  const r = await ask('boli mnie głowa od rana, co mogę wziąć?', { ip: '7.7.7.6' })
  delete down['api.x.ai']
  assert.equal(r.code, 200)
  assert.equal(r.data.provider, 'groq')
  assert.deepEqual(tried, ['api.x.ai', 'api.groq.com'])
  assert.ok(r.data.sources.length > 0)
  assert.ok(sent.body.messages[0].content.split('Fakty:\n')[1].split('\nCo można')[0].split('\n').length <= 8)
})
await check('zapas: oba padły → 502 z listą, co zawiodło', async () => {
  down['api.x.ai'] = 500
  down['api.groq.com'] = 429
  const r = await ask('hej', { ip: '7.7.7.7' })
  delete down['api.x.ai']
  delete down['api.groq.com']
  assert.equal(r.code, 502)
  assert.deepEqual(r.data.failed, ['xai:500', 'groq:429'])
})
await check('DOCO_PROVIDERS=groq,xai: najpierw darmowy Groq', async () => {
  process.env.DOCO_PROVIDERS = 'groq,xai'
  tried.length = 0
  const r = await ask('hej', { ip: '7.7.7.8' })
  delete process.env.DOCO_PROVIDERS
  assert.equal(r.data.provider, 'groq')
  assert.deepEqual(tried, ['api.groq.com'])
})
await check('wszystkie klucze: wygrywa Claude', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key'
  const r = await ask('hej', { ip: '7.7.7.4' })
  assert.match(sent.url, /api\.anthropic\.com/)
  assert.equal(r.data.provider, 'anthropic')
})
delete process.env.GROQ_API_KEY
delete process.env.XAI_API_KEY
process.env.ANTHROPIC_API_KEY = 'test-key'
await check('obca strona: 403, bez nagłówków CORS', async () => {
  const r = await ask('hej', { origin: 'https://evil.example' })
  assert.equal(r.code, 403)
  assert.equal(r.headers['Access-Control-Allow-Origin'], undefined)
})
await check('preflight OPTIONS z naszej strony: 204 + CORS', async () => {
  const r = await call(null, { method: 'OPTIONS' })
  assert.equal(r.code, 204)
  assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://juzu01.github.io')
})
await check('localhost (podgląd) też może pytać', async () => {
  assert.equal((await ask('hej', { origin: 'http://localhost:5180' })).code, 200)
})
await check('pytanie o ból głowy: model dostaje wpis bol-glowy, odpowiedź ma źródła', async () => {
  const r = await ask('boli mnie głowa od rana, co mogę wziąć?')
  assert.equal(r.code, 200)
  assert.deepEqual(r.data.entries.slice(0, 1), ['bol-glowy'])
  assert.ok(r.data.sources.length > 0 && r.data.sources.every((s) => s.url.startsWith('https://')))
  assert.match(sent.body.system, /SPRAWDZONA WIEDZA/)
  assert.match(sent.body.system, /Ból głowy/)
  assert.equal(sent.headers['x-api-key'], 'test-key')
})
await check('bez pasującego wpisu: prompt mówi, że go nie ma', async () => {
  const r = await ask('jaka jest stolica Francji?')
  assert.equal(r.code, 200)
  assert.deepEqual(r.data.entries, [])
  assert.match(sent.body.system, /brak wpisu pasującego/)
})
await check('prompt: tylko zdrowie i samopoczucie, prośby spoza (przepis) odrzuca jednym zdaniem', async () => {
  const r = await ask('jak zrobić naleśniki?')
  assert.equal(r.code, 200)
  assert.match(sent.body.system, /Rozmawiasz tylko o zdrowiu i samopoczuciu/)
  assert.match(sent.body.system, /przepis kulinarny/)
  assert.match(sent.body.system, /odrzuć jednym zdaniem/)
})
await check('prompt: przy dolegliwości najpierw dopytaj, potem konkretne kroki', async () => {
  await ask('boli mnie mięsień')
  assert.match(sent.body.system, /najpierw o to dopytaj/)
  assert.match(sent.body.system, /jak rozmasować/)
})
await check('kontekst z aplikacji (dziennik) trafia do promptu, przycięty i bez znaków sterujących', async () => {
  await call({ messages: [{ role: 'user', content: 'boli mnie łydka' }], context: 'Ból zapisany w dzienniku: wczoraj Łydka (prawa strona), 5/10.\u0007' + 'x'.repeat(3000) })
  assert.match(sent.body.system, /CO WIESZ O UŻYTKOWNIKU[\s\S]*wczoraj Łydka \(prawa strona\), 5\/10/)
  assert.ok(!sent.body.system.includes('\u0007'))
  assert.ok(!sent.body.system.includes('x'.repeat(1500)))
  await ask('hej')
  assert.match(sent.body.system, /\(nic nie zapisał\)/)
})
await check('ból mięśnia: odpowiedź na „od czego się zaczęło?” wybiera wpis (po bieganiu → zakwasy)', async () => {
  const r = await call({ messages: [{ role: 'user', content: 'boli mnie mięsień' }, { role: 'assistant', content: 'Gdzie i od kiedy?' }, { role: 'user', content: 'łydka, od wczoraj, po bieganiu' }] })
  assert.ok(r.data.entries.includes('zakwasy'), r.data.entries.join(','))
  const k = await call({ messages: [{ role: 'user', content: 'boli mnie kolano po bieganiu' }] })
  assert.ok(!k.data.entries.includes('zakwasy'), 'kolano to staw')
  const s = await call({ messages: [{ role: 'user', content: 'łydka po bieganiu jest spuchnięta' }] })
  assert.ok(!s.data.entries.includes('zakwasy'), 'obrzęk to nie zakwasy')
})
await check('pytanie uzupełniające bierze temat z poprzedniego pytania', async () => {
  const r = await call({ messages: [{ role: 'user', content: 'co na ból głowy?' }, { role: 'assistant', content: 'Paracetamol…' }, { role: 'user', content: 'a w ciąży?' }] })
  assert.ok(r.data.entries.includes('bol-glowy'))
})
await check('historia: najwyżej 12 wiadomości, zaczyna i kończy się na użytkowniku', () => {
  const long = Array.from({ length: 31 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(5000) }))
  const m = cleanMessages(long)
  assert.ok(m.length <= 12 && m[0].role === 'user' && m.at(-1).role === 'user' && m.every((x) => x.content.length <= 2000))
  assert.equal(cleanMessages([{ role: 'assistant', content: 'hej' }]), null)
})
await check('zła treść: 400', async () => {
  assert.equal((await call({ messages: 'hej' })).code, 400)
  assert.equal((await call('{nie json')).code, 400)
})
await check('limit zapytań z jednego adresu: 429', async () => {
  let last
  for (let i = 0; i < 31; i++) last = await ask('hej', { ip: '9.9.9.9' })
  assert.equal(last.code, 429)
})
await check('wyszukiwanie bez polskich znaków i z odmianą', async () => {
  const r = await ask('bola mnie glowy od tygodnia', { ip: '5.5.5.5' })
  assert.ok(r.data.entries.includes('bol-glowy'), r.data.entries.join(','))
  assert.equal(typeof search, 'function')
})

console.log(failures ? `\n${failures} błędów` : '\nOK: serwer Doco AI')
process.exit(failures ? 1 : 0)
