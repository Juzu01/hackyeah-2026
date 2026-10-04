// Local run of the Doco AI function, for trying the chat before (or without) deploying it.
// node doco-ai/dev.mjs [--fake] [--port 8787] [--site http://localhost:5180/]
//   uses ANTHROPIC_API_KEY from the environment; --fake answers without the API and says which entries it got.
// Then in the page (served on localhost) run: window.DOCO_AI_URL = 'http://localhost:8787/api/chat'
import { createServer } from 'node:http'

const args = process.argv.slice(2)
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def)
const PORT = Number(opt('--port', 8787))
process.env.DOCO_SITE = opt('--site', process.env.DOCO_SITE || 'https://juzu01.github.io/hackyeah-2026/')

if (args.includes('--fake')) {
  const real = globalThis.fetch
  process.env.ANTHROPIC_API_KEY ||= 'fake'
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://api.anthropic.com/')) return real(url, init)
    const ids = JSON.parse(init.body).system.match(/\(id: [a-z0-9-]+\)/g) || []
    const text = `(test, bez modelu) Odpowiedziałbym na podstawie: ${ids.join(' ') || 'brak wpisu w bazie'}.`
    return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 })
  }
}
const { default: handler } = await import('./api/chat.js')

createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => { raw += c })
  req.on('end', async () => {
    try { req.body = raw ? JSON.parse(raw) : {} } catch { req.body = raw }
    res.status = (code) => { res.statusCode = code; return res }
    res.json = (data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); return res }
    if (!new URL(req.url, 'http://x').pathname.startsWith('/api/chat')) return res.status(404).json({ error: 'not found' })
    await handler(req, res).catch((e) => res.status(500).json({ error: String(e) }))
  })
}).listen(PORT, () => console.log(`Doco AI: http://localhost:${PORT}/api/chat (baza: ${process.env.DOCO_SITE})`))
