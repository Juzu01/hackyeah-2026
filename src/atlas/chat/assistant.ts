// What the atlas answers. Pure: takes what was said and the conversation's
// state, returns the reply and what the body should do (focus a part, change
// layer, turn round). Most questions are answered here, offline, from the
// atlas's own copy; anything it doesn't understand can go to a remote chat
// (VITE_CHAT_URL, see remote.ts).

import { catalog, partInfo, type PartInfo } from '../../anatomy/content.ts'
import type { LayerName } from '../../anatomy/depth.ts'
import { understand } from './understand.ts'

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
  emergency?: Emergency
  /** About pain: that's for Doco's Objawy tab, the reply links there. */
  symptoms?: boolean
  /** Bullet points under the text (exercises). */
  list?: string[]
  /** Nothing matched: worth asking the remote chat, if there is one. */
  unknown?: boolean
  act: Act
}

const parts = new Map(catalog.map((e) => [e.id, partInfo(e)]))
export const partById = (id: string | null | undefined): PartInfo | undefined => (id ? parts.get(id) : undefined)

const LAYER_TEXT: Record<LayerName, string> = {
  muscles: 'Pokazuję mięśnie.',
  organs: 'Pokazuję narządy i kości.',
  exploded: 'Rozsuwam narządy, żeby łatwiej je było wybrać.',
}

const HELP =
  'Zapytaj na przykład: „gdzie jest wątroba?”, „pokaż serce” albo „jak rozciągnąć łydkę?”. Jeśli coś Cię boli, przejdź do zakładki Objawy.'

const SYMPTOMS = 'Jeśli coś Cię boli, przejdź do zakładki Objawy: po kilku pytaniach podpowie, co dalej.'

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

/** "Rzepka, strona lewa": the side, when the name doesn't say it. */
function named(part: PartInfo): string {
  const sideInName = /\b(lew|praw)[aey]\b/i.test(part.name)
  return part.sideLabel && !sideInName ? `${part.name}, ${part.sideLabel}` : part.name
}

export function answer(said: string, ctx: { selectedId: string | null }): Reply {
  const intent = understand(said, { selectedId: ctx.selectedId })

  if (intent.kind === 'emergency') {
    const emergency = emergencyOf(intent.reason)
    return { text: emergency.text, emergency, act: {} }
  }

  switch (intent.kind) {
    // The atlas only shows where it is; Objawy asks the questions.
    case 'pain': {
      const part = partById(intent.partId)
      if (!part) return { text: SYMPTOMS, symptoms: true, act: {} }
      return { text: `Pokazuję: ${lower(named(part))}. ${SYMPTOMS}`, part, symptoms: true, act: { focus: part.id } }
    }
    case 'show': {
      const part = partById(intent.partId)!
      return { text: part.description ? brief(part.description) : `To ${lower(part.name)}.`, part, act: { focus: part.id } }
    }
    case 'exercise': {
      const part = partById(intent.partId)!
      if (part.exercises?.length) {
        return { text: `Ćwiczenia: ${lower(part.name)}.`, list: part.exercises, part, act: { focus: part.id } }
      }
      const text = part.sport ?? part.action ?? `Nie mam ćwiczeń dla tej części. Zapytaj fizjoterapeutę.`
      return { text: brief(text, 3), part, act: { focus: part.id } }
    }
    case 'layer':
      return { text: LAYER_TEXT[intent.layer], act: { layer: intent.layer } }
    case 'flip':
      return { text: 'Obracam ciało.', act: { flip: true } }
    case 'help':
      return { text: HELP, act: {} }
    case 'thanks':
      return { text: 'Proszę bardzo.', act: {} }
    default:
      return {
        text: 'Nie rozumiem. Zapytaj na przykład „gdzie jest serce?” albo „jak rozciągnąć łydkę?”.',
        unknown: true,
        act: {},
      }
  }
}
