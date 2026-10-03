// Headless Firefox driven over WebDriver BiDi: real WebGL, phone-sized viewports,
// screenshots of the composited page, trusted touch/mouse input and console logs.
//
//   import { openPage } from './tools/browser/firefox.mjs'
//   const page = await openPage('http://localhost:5181/', { width: 390, height: 844, dpr: 2 })
//   await page.pinch(195, 420, 60, 300)        // two-finger pinch out around a point
//   await page.screenshot('out.png')
//   console.log(await page.json('window.__atlas.state()'))
//   await page.close()

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export async function openPage(url, { width = 390, height = 844, dpr = 2, waitMs = 1500 } = {}) {
  const port = 9400 + Math.floor(Math.random() * 2000)
  const profile = mkdtempSync(join(tmpdir(), 'ff-bidi-'))
  const ff = spawn('firefox', ['--headless', '--no-remote', '--profile', profile, `--remote-debugging-port=${port}`], {
    stdio: 'ignore',
  })

  let ws
  for (let i = 0; i < 80; i++) {
    try {
      ws = new WebSocket(`ws://127.0.0.1:${port}/session`)
      await new Promise((res, rej) => {
        ws.onopen = res
        ws.onerror = rej
      })
      break
    } catch {
      ws = null
      await sleep(250)
    }
  }
  if (!ws) throw new Error('Could not connect to Firefox over BiDi')

  let nextId = 0
  const pending = new Map()
  const logs = []
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) {
      pending.get(d.id)(d)
      pending.delete(d.id)
    } else if (d.method === 'log.entryAdded') {
      const p = d.params
      logs.push({ level: p.level, text: p.text ?? p.args?.map((a) => a.value).join(' ') })
    }
  }
  const send = (method, params) =>
    new Promise((resolve, reject) => {
      const id = ++nextId
      pending.set(id, (d) => (d.type === 'error' ? reject(new Error(`${method}: ${d.error}: ${d.message}`)) : resolve(d.result)))
      ws.send(JSON.stringify({ id, method, params }))
    })

  await send('session.new', { capabilities: {} })
  await send('session.subscribe', { events: ['log.entryAdded'] })
  // The initial tab is privileged in headless mode; viewport emulation needs a fresh one.
  const { context } = await send('browsingContext.create', { type: 'tab' })
  await send('browsingContext.setViewport', { context, viewport: { width, height }, devicePixelRatio: dpr })
  await send('browsingContext.navigate', { context, url, wait: 'complete' })
  await sleep(waitMs)

  const js = async (expression) => {
    const r = await send('script.evaluate', { expression, target: { context }, awaitPromise: true })
    if (r.type === 'exception') throw new Error(`page threw: ${r.exceptionDetails?.text}`)
    return r.result?.value
  }

  // Trusted input via input.performActions. Coordinates are CSS pixels in the viewport.
  const act = (sources) => send('input.performActions', { context, actions: sources })
  const finger = (id, path, { holdMs = 0 } = {}) => ({
    type: 'pointer',
    id,
    parameters: { pointerType: 'touch' },
    actions: [
      { type: 'pointerMove', x: Math.round(path[0][0]), y: Math.round(path[0][1]) },
      { type: 'pointerDown', button: 0 },
      ...path.slice(1).map(([x, y]) => ({ type: 'pointerMove', x: Math.round(x), y: Math.round(y), duration: 16 })),
      ...(holdMs ? [{ type: 'pause', duration: holdMs }] : []),
      { type: 'pointerUp', button: 0 },
    ],
  })
  const lerpPath = (x0, y0, x1, y1, steps) =>
    Array.from({ length: steps + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps])

  return {
    context,
    logs,
    js,
    /** Evaluates an expression and returns it parsed from JSON (use for objects/arrays). */
    json: async (expression) => JSON.parse(await js(`JSON.stringify(${expression})`)),
    async screenshot(path) {
      const { data } = await send('browsingContext.captureScreenshot', { context })
      writeFileSync(path, Buffer.from(data, 'base64'))
      return path
    },
    async tap(x, y) {
      await act([finger('f1', [[x, y]])])
      await send('input.releaseActions', { context })
    },
    async doubleTap(x, y) {
      await this.tap(x, y)
      await sleep(80)
      await this.tap(x, y)
    },
    async drag(x0, y0, x1, y1, steps = 12) {
      await act([finger('f1', lerpPath(x0, y0, x1, y1, steps))])
      await send('input.releaseActions', { context })
    },
    /** Two fingers on a horizontal line through (cx, cy), spreading from `from` to `to` px apart. */
    async pinch(cx, cy, from, to, steps = 16) {
      const a = lerpPath(cx - from / 2, cy, cx - to / 2, cy, steps)
      const b = lerpPath(cx + from / 2, cy, cx + to / 2, cy, steps)
      await act([finger('f1', a), finger('f2', b)])
      await send('input.releaseActions', { context })
    },
    async wheel(x, y, deltaY, times = 1) {
      for (let i = 0; i < times; i++) {
        await act([{ type: 'wheel', id: 'w', actions: [{ type: 'scroll', x: Math.round(x), y: Math.round(y), deltaX: 0, deltaY }] }])
      }
    },
    async mouseDrag(x0, y0, x1, y1, steps = 12) {
      await act([
        {
          type: 'pointer',
          id: 'm',
          parameters: { pointerType: 'mouse' },
          actions: [
            { type: 'pointerMove', x: Math.round(x0), y: Math.round(y0) },
            { type: 'pointerDown', button: 0 },
            ...lerpPath(x0, y0, x1, y1, steps).slice(1).map(([x, y]) => ({ type: 'pointerMove', x: Math.round(x), y: Math.round(y), duration: 16 })),
            { type: 'pointerUp', button: 0 },
          ],
        },
      ])
    },
    sleep,
    async close() {
      try {
        ws.close()
      } catch {}
      ff.kill()
      await sleep(300)
      rmSync(profile, { recursive: true, force: true })
    },
  }
}
