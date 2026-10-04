// Test of the Doco AI function without the network and without a key: fetch is replaced by a fake that serves
// the local knowledge base and answers instead of the Claude API.
// Run: node doco-ai/test.mjs
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const DB = readFileSync(new URL('../soleil-main/data/wiedza.json', import.meta.url), 'utf8')
let sent = null
globalThis.fetch = async (url, init) => {
  if (String(url).endsWith('data/wiedza.json')) return new Response(DB, { status: 200 })
  if (String(url).startsWith('https://api.anthropic.com/')) {
    sent = { headers: init.headers, body: JSON.parse(init.body) }
    return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Odpowiedź testowa.' }] }), { status: 200 })
  }
  throw new Error('unexpected fetch ' + url)
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
  const r = await ask('hej')
  assert.equal(r.code, 503)
})
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
