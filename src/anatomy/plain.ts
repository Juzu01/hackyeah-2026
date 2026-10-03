// Plain-language copy for people who don't know anatomy: where a part is ("Lewe
// udo, z przodu"), one simple sentence, and everyday words people search with.
// From data/plain.pl.json; until that exists, built from the clinical copy.

import { catalog, partInfo, type PartInfo } from './content.ts'

export interface PlainCopy {
  /** "Lewe udo, z przodu". */
  where: string
  /** One plain sentence (≤ 110 characters). */
  simple: string
  /** Everyday words that should find this part: "kolano", "udo". */
  aliases: string[]
}

export interface Suggestion {
  label: string
  query: string
}

interface PlainFile {
  parts?: Record<string, Partial<PlainCopy>>
  suggestions?: Suggestion[]
}

// A glob rather than an import, so the app builds before the file exists.
const file: PlainFile =
  Object.values(import.meta.glob<PlainFile>('./data/plain.pl.json', { eager: true, import: 'default' }))[0] ?? {}

const KIND: Record<string, string> = { muscle: 'Mięsień', organ: 'Narząd', bone: 'Kość', skin: 'Skóra' }

/** The first sentence of the clinical description, cut at a word if it's long. */
function firstSentence(text: string, max = 110): string {
  const sentence = text.split(/(?<=[.;])\s/)[0].replace(/[;.]$/, '')
  if (sentence.length <= max) return `${sentence}.`
  return `${sentence.slice(0, sentence.lastIndexOf(' ', max - 1))}…`
}

export function plainOf(info: PartInfo): PlainCopy {
  const p = file.parts?.[info.id] ?? {}
  return {
    where: p.where || [KIND[info.system], info.sideLabel].filter(Boolean).join(', '),
    simple: p.simple || (info.description ? firstSentence(info.description) : ''),
    aliases: p.aliases ?? [],
  }
}

export const suggestions: Suggestion[] = file.suggestions?.length
  ? file.suggestions
  : ['Kolano', 'Plecy', 'Serce', 'Brzuch', 'Łydka', 'Ramię', 'Biodro', 'Płuca'].map((label) => ({
      label,
      query: label.toLowerCase(),
    }))

/** Whether the plain-language file is present (the search falls back to the clinical copy without it). */
export const hasPlainFile = !!file.parts

/** Every part a visitor can pick (the skin is context only), with both kinds of copy. */
export function pickableParts(): { info: PartInfo; plain: PlainCopy }[] {
  return catalog.filter((e) => e.layer !== 'shell').map((e) => {
    const info = partInfo(e)
    return { info, plain: plainOf(info) }
  })
}
