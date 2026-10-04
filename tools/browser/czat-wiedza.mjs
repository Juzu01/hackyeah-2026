// Asks Doco's chat a few questions in a real (headless) Firefox and saves a screenshot of the answers.
// node tools/browser/czat-wiedza.mjs <url> <out.png> ["pytanie" ...]
import { openPage } from './firefox.mjs'

const [url, out, ...questions] = process.argv.slice(2)
if (!url || !out) {
  console.error('usage: node tools/browser/czat-wiedza.mjs <url> <out.png> ["pytanie" ...]')
  process.exit(2)
}
const page = await openPage(url, { width: 390, height: 844, waitMs: 3000 })
// The knowledge base loads in the background; wait for it before asking
await page.js(`new Promise((ok) => { const t = setInterval(() => { if (window.DocoOffline) { clearInterval(t); ok() } }, 100) })`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (const q of questions.length ? questions : ['jak zmierzyć ciśnienie w domu?']) {
  await page.js(`(() => { const i = document.getElementById('userInput'); i.value = ${JSON.stringify(q)}; window.sendMessage(); })()`)
  await sleep(3500)
}
const replies = await page.json(`[...document.querySelectorAll('.bubble.ai')].slice(-${questions.length || 1}).map((b) => b.textContent.slice(0, 160))`)
replies.forEach((r) => console.log('  ' + r.replace(/\s+/g, ' ')))
await page.js(`(() => { const w = document.getElementById('chatWindow'); if (w) w.scrollTop = w.scrollHeight })()`)
await page.screenshot(out)
const errors = page.logs.filter((l) => l.level === 'error')
if (errors.length) console.error('console errors:\n' + errors.map((e) => '  ' + e.text).join('\n'))
console.log(out)
await page.close()
