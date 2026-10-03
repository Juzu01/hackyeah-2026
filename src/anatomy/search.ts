// Finding a part by everyday words: "kolano", "plecy", "lewa łydka". Matching
// ignores case and Polish diacritics, tolerates endings ("kolana" finds
// "kolano"), and a side word ("lewe", "prawa") puts that side first.

import type { Side } from './content.ts'
import { pickableParts } from './plain.ts'

export interface SearchHit {
  id: string
  name: string
  where: string
  /** For the small label: mięsień, narząd or kość. */
  kind: 'mięsień' | 'narząd' | 'kość'
}

const KIND = { muscle: 'mięsień', organ: 'narząd', bone: 'kość' } as const

/** Lower case, no diacritics ("Łydka" → "lydka"). */
export function fold(text: string): string {
  return text.toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/\p{M}/gu, '')
}

const words = (text: string) => fold(text).split(/[^a-z0-9]+/).filter(Boolean)

/** Words that say nothing about where: "boli mnie kolano" searches for "kolano". */
const STOP = new Set(['bol', 'boli', 'bola', 'mnie', 'mi', 'mam', 'w', 'we', 'na', 'z', 'ze', 'i', 'sie', 'pod', 'nad', 'przy', 'do', 'od', 'po', 'moj', 'moja', 'moje', 'jest', 'co', 'gdzie', 'strona', 'stronie'])

/** Words that fit whole classes of parts: they count, but only a little ("kość ogonowa" is about "ogonowa"). */
const GENERIC = /^(kosc|kosci|miesien|miesnie|miesnia|narzad|narzady|narzadu|czesc|cialo|ciala)$/

function sideOf(word: string): Side {
  if (word.startsWith('lew')) return 'left'
  if (word.startsWith('praw')) return 'right'
  return null
}

interface Field {
  words: string[]
  weight: number
  /** Everyday wording (aliases, "where") also matches other endings: "kolana", "kolanem". */
  inflect: boolean
}

interface Entry {
  hit: SearchHit
  side: Side
  fields: Field[]
  /** Aliases and "where" as whole phrases, for multi-word queries ("klatka piersiowa"). */
  phrases: string[]
  /** "where" without its side words: "Lewa łydka" → "lydka", which is exactly what someone types. */
  place: string
}

let index: Entry[] | null = null

function build(): Entry[] {
  return pickableParts().map(({ info, plain }) => ({
    hit: { id: info.id, name: info.name, where: plain.where, kind: KIND[info.system as keyof typeof KIND] ?? 'narząd' },
    side: info.side,
    // The clinical description isn't searched: it names neighbours ("ku sercu") and would drown the real hits.
    fields: [
      { words: plain.aliases.flatMap(words), weight: 3, inflect: true },
      { words: words(info.name), weight: 3, inflect: false },
      { words: words(plain.where), weight: 2.5, inflect: true },
      { words: words(info.latin), weight: 1.5, inflect: false },
      { words: words(info.groupLabel), weight: 0.5, inflect: false },
      { words: words(plain.simple), weight: 0.3, inflect: false },
    ],
    phrases: [...plain.aliases, plain.where, info.name].map((t) => words(t).join(' ')),
    place: words(plain.where).filter((w) => !sideOf(w)).join(' '),
  }))
}

/** "kolano" → "kolan", "plecy" → "plec": the word without its ending vowels. */
const stemOf = (token: string) => token.replace(/[aeiouy]+$/, '').padEnd(3, token)

/**
 * How well a query word matches a field word. Exact always counts; for everyday
 * wording also a different ending (at most two letters: "kolanem", "pleców"),
 * but not a longer word that merely starts the same ("brzuch" ≠ "brzuchaty").
 */
function match(token: string, word: string, inflect: boolean): number {
  if (word === token) return 1
  if (!inflect || token.length < 4) return 0
  if (word.startsWith(token) && word.length - token.length <= 2) return 0.9
  const stem = stemOf(token)
  if (stem.length >= 3 && word.startsWith(stem) && word.length - stem.length <= 2) return 0.8
  return 0
}

export function search(query: string, limit = 12): SearchHit[] {
  index ??= build()
  let side: Side = null
  const tokens: string[] = []
  for (const w of words(query)) {
    const s = sideOf(w)
    if (s) side = s
    else if (!STOP.has(w) && w.length > 1) tokens.push(w)
  }
  if (!tokens.length) return []
  const phrase = tokens.join(' ')
  const strongTokens = tokens.filter((t) => !GENERIC.test(t))

  const scored: { hit: SearchHit; strong: number; matched: number; score: number }[] = []
  for (const e of index) {
    let matched = 0
    let strong = 0
    let score = 0
    for (const t of tokens) {
      // Each field adds its best match, so a part named for the word outranks one that only lists it.
      let sum = 0
      for (const f of e.fields) {
        let best = 0
        for (const w of f.words) best = Math.max(best, match(t, w, f.inflect))
        sum += best * f.weight
      }
      if (sum <= 0) continue
      matched++
      if (GENERIC.test(t)) score += sum * 0.25
      else {
        strong++
        score += sum
      }
    }
    if (!matched) continue
    if (tokens.length > 1 && e.phrases.some((p) => p.includes(phrase))) score += 4
    if (e.place === phrase) score += 2
    else if (e.place.startsWith(phrase)) score += 1
    if (side && e.side === side) score += 2
    else if (side && e.side && e.side !== side) score -= 3
    scored.push({ hit: e.hit, strong, matched, score })
  }
  // When the specific words match somewhere, parts that only match a generic one ("kość") drop out.
  const best = Math.max(0, ...scored.map((s) => s.strong))
  const kept = strongTokens.length && best > 0 ? scored.filter((s) => s.strong === best) : scored
  kept.sort((a, b) => b.matched - a.matched || b.score - a.score || a.hit.name.localeCompare(b.hit.name, 'pl'))
  return kept.slice(0, limit).map((s) => s.hit)
}
