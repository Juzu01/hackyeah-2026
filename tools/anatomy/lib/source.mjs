// BodyParts3D 3.0 from its GitHub mirror: tab-separated part lists plus one binary STL
// (millimetres) per primitive. Everything is cached under .cache/ so rebuilds are offline.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const REPO = 'Kevin-Mattheus-Moerman/BodyParts3D'
const DATA_URL = `https://raw.githubusercontent.com/${REPO}/main/assets/BodyParts3D_data/`
const TREE_URL = `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

class NotFound extends Error {}

async function download(url, file, { retries = 4, headers = {}, isComplete = () => true } = {}) {
  if (existsSync(file)) {
    const cached = await readFile(file)
    if (isComplete(cached)) return cached
  }
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers })
      if (res.status === 404) throw new NotFound(`404 ${url}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (!isComplete(buf)) throw new Error('truncated download')
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file + '.part', buf)
      await rename(file + '.part', file)
      return buf
    } catch (err) {
      if (err instanceof NotFound || attempt >= retries) throw new Error(`fetch ${url}: ${err.message}`)
      await sleep(400 * 2 ** attempt)
    }
  }
}

/** A binary STL is complete when its length matches the triangle count in its header. */
const isCompleteStl = (buf) => buf.length >= 84 && buf.length >= 84 + buf.readUInt32LE(80) * 50

export function createSource(cacheDir) {
  return {
    async text(name) {
      return (await download(DATA_URL + name, join(cacheDir, name))).toString('utf8')
    },

    /** Ids of every primitive that has an STL file in the mirror. */
    async stlIds() {
      const headers = { Accept: 'application/vnd.github+json' }
      const token = githubToken()
      if (token) headers.Authorization = `Bearer ${token}`
      const tree = JSON.parse((await download(TREE_URL, join(cacheDir, 'tree.json'), { headers })).toString('utf8'))
      const ids = new Set()
      for (const { path } of tree.tree) {
        const m = /^assets\/BodyParts3D_data\/stl\/(.+)\.stl$/.exec(path)
        if (m) ids.add(m[1])
      }
      return ids
    },

    stl(id) {
      return download(`${DATA_URL}stl/${id}.stl`, join(cacheDir, 'stl', `${id}.stl`), { isComplete: isCompleteStl })
    },
  }
}

/** The unauthenticated API allows 60 requests an hour per IP, which a shared network burns fast. */
function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/** Runs `fn` over `items` with at most `limit` calls in flight; results keep the input order. */
export async function mapPool(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
