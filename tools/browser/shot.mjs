// One-off screenshot of a page with real WebGL, at a phone or desktop size.
// node tools/browser/shot.mjs <url> <out.png> [width=390] [height=844] [waitMs=2500] [dpr=2]
import { openPage } from './firefox.mjs'

const [url, out, w = '390', h = '844', wait = '2500', dpr = '2'] = process.argv.slice(2)
if (!url || !out) {
  console.error('usage: node tools/browser/shot.mjs <url> <out.png> [width] [height] [waitMs] [dpr]')
  process.exit(2)
}
const page = await openPage(url, { width: +w, height: +h, dpr: +dpr, waitMs: +wait })
await page.screenshot(out)
const errors = page.logs.filter((l) => l.level === 'error')
if (errors.length) console.error('console errors:\n' + errors.map((e) => '  ' + e.text).join('\n'))
console.log(out)
await page.close()
