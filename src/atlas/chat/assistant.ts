// What the atlas answers. Pure: takes what was said and the conversation's
// state, returns the reply and what the body should do (focus a part, change
// layer, turn round). Most questions are answered here, offline, from the
// atlas's own copy; anything it doesn't understand can go to a remote chat
// (VITE_CHAT_URL, see remote.ts).

import { catalog, partInfo, type PartInfo } from '../../anatomy/content.ts'
import type { LayerName } from '../../anatomy/depth.ts'
import { parseIntensity, partsMentioned, understand } from './understand.ts'

export interface Draft {
  partId: string
  intensity: number | null
  typeIds: string[]
}

export interface Emergency {
  text: string
  calls: { label: string; tel: string }[]
}

/** What the body should do along with a reply. */
export interface Act {
  focus?: string
  layer?: LayerName
  flip?: boolean
}

export interface Reply {
  text: string
  part?: PartInfo
  /** A pain report ready to check and save. */
  draft?: Draft
  emergency?: Emergency
  /** Bullet points under the text (exercises). */
  list?: string[]
  /** Nothing matched: worth asking the remote chat, if there is one. */
  unknown?: boolean
  act: Act
  /** What the next answer will fill in. */
  pending: Pending
}

export type Pending = null | { want: 'part'; intensity: number | null; typeIds: string[] } | { want: 'intensity'; draft: Draft }

const parts = new Map(catalog.map((e) => [e.id, partInfo(e)]))
export const partById = (id: string | null | undefined): PartInfo | undefined => (id ? parts.get(id) : undefined)

const LAYER_TEXT: Record<LayerName, string> = {
  muscles: 'Pokazuję mięśnie.',
  organs: 'Pokazuję narządy i kości.',
  exploded: 'Rozsuwam narządy, żeby łatwiej je było wybrać.',
}

const HELP =
  'Powiedz, co i gdzie boli, na przykład: „boli mnie lewe kolano, tak na 6”. Możesz też zapytać: „gdzie jest wątroba?” albo „jak rozciągnąć łydkę?”.'

const ASK_WHERE = 'Gdzie boli? Powiedz na przykład „kolano” albo „brzuch”, albo dotknij tego miejsca na ciele.'
const ASK_HOW_MUCH = 'Jak mocno boli? Powiedz liczbę od 1 do 10: 1 to ledwo czuć, 10 to nie do wytrzymania.'

/** The first sentence or two: enough to read aloud. */
function brief(text: string, sentences = 2): string {
  const parts = text.match(/[^.!?]+[.!?]+/g)
  return parts ? parts.slice(0, sentences).join('').trim() : text
}

/** "lewa rzepka" inside a sentence. */
const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1)

function emergencyOf(reason: string): Emergency {
  if (/samob|zabi|zyc|życ/i.test(reason)) {
    return {
      text: 'Nie musisz przechodzić przez to w pojedynkę. Porozmawiaj z kimś teraz: zadzwoń do Centrum Wsparcia albo, jeśli jesteś w niebezpieczeństwie, pod 112.',
      calls: [
        { label: 'Centrum Wsparcia 800 70 2222', tel: '800702222' },
        { label: 'Zadzwoń pod 112', tel: '112' },
      ],
    }
  }
  return {
    text: 'To może być stan nagły. Jeśli objaw jest silny albo pojawił się nagle, nie czekaj: zadzwoń pod 112.',
    calls: [{ label: 'Zadzwoń pod 112', tel: '112' }],
  }
}

/** "Rzepka, strona lewa": the side matters when it's saved. */
function named(part: PartInfo): string {
  const sideInName = /\b(lew|praw)[aey]\b/i.test(part.name)
  return part.sideLabel && !sideInName ? `${part.name}, ${part.sideLabel}` : part.name
}

function report(draft: Draft): Reply {
  const part = partById(draft.partId)!
  if (draft.intensity === null) {
    return { text: `Zaznaczam: ${lower(named(part))}. ${ASK_HOW_MUCH}`, part, act: { focus: part.id }, pending: { want: 'intensity', draft } }
  }
  const text = draft.typeIds.length
    ? `${named(part)}. Ból ${draft.intensity} na 10. Sprawdź i zapisz.`
    : `${named(part)}. Ból ${draft.intensity} na 10. Jaki to ból? Zaznacz poniżej albo powiedz, na przykład „kłujący”.`
  return { text, part, draft, act: { focus: part.id }, pending: null }
}

export function answer(said: string, ctx: { selectedId: string | null; pending: Pending }): Reply {
  const intent = understand(said, { selectedId: ctx.selectedId })
  const { pending } = ctx

  if (intent.kind === 'emergency') {
    const emergency = emergencyOf(intent.reason)
    return { text: emergency.text, emergency, act: {}, pending: null }
  }

  // Filling in what was asked for, unless they moved on to something else.
  if (pending?.want === 'intensity') {
    const n = parseIntensity(said, true)
    if (n !== null && (intent.kind === 'pain' || intent.kind === 'unknown')) {
      const typeIds = [...new Set([...pending.draft.typeIds, ...(intent.kind === 'pain' ? intent.typeIds : [])])]
      return report({ ...pending.draft, intensity: n, typeIds })
    }
  }
  if (pending?.want === 'part' && intent.kind !== 'pain') {
    const id = partsMentioned(said)[0]
    if (id) return report({ partId: id, intensity: parseIntensity(said) ?? pending.intensity, typeIds: pending.typeIds })
  }

  switch (intent.kind) {
    case 'pain': {
      const intensity = intent.intensity ?? (pending?.want === 'part' ? pending.intensity : null)
      const typeIds = [...new Set([...intent.typeIds, ...(pending?.want === 'part' ? pending.typeIds : [])])]
      if (!intent.partId) return { text: ASK_WHERE, act: {}, pending: { want: 'part', intensity, typeIds } }
      return report({ partId: intent.partId, intensity, typeIds })
    }
    case 'show': {
      const part = partById(intent.partId)!
      return { text: part.description ? brief(part.description) : `To ${lower(part.name)}.`, part, act: { focus: part.id }, pending: null }
    }
    case 'exercise': {
      const part = partById(intent.partId)!
      if (part.exercises?.length) {
        return { text: `Ćwiczenia: ${lower(part.name)}.`, list: part.exercises, part, act: { focus: part.id }, pending: null }
      }
      const text = part.sport ?? part.action ?? `Nie mam ćwiczeń dla tej części. Zapytaj fizjoterapeutę.`
      return { text: brief(text, 3), part, act: { focus: part.id }, pending: null }
    }
    case 'layer':
      return { text: LAYER_TEXT[intent.layer], act: { layer: intent.layer }, pending: null }
    case 'flip':
      return { text: 'Obracam ciało.', act: { flip: true }, pending: null }
    case 'help':
      return { text: HELP, act: {}, pending: null }
    case 'thanks':
      return { text: 'Proszę bardzo. Jeśli ból się nasila albo nie mija, idź do lekarza.', act: {}, pending: null }
    default:
      return {
        text: 'Nie rozumiem. Powiedz, co i gdzie boli, na przykład „boli mnie brzuch”, albo zapytaj „gdzie jest serce?”.',
        unknown: true,
        act: {},
        pending,
      }
  }
}
