// The conversation's state: what was said, listening to the microphone and reading
// answers aloud. The dock and the chat sheet are views of it; the body follows
// through `act`.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { answer, partById, type Act, type Reply } from './assistant.ts'
import { askRemote, hasRemote } from './remote.ts'
import { canListen, canSpeak, listen, speak, stopSpeaking, type Listening } from './speech.ts'

export type Turn =
  | { id: number; who: 'you'; text: string }
  | { id: number; who: 'atlas'; reply: Reply; waiting?: boolean }

export interface Conversation {
  turns: Turn[]
  send(text: string, voice?: boolean): void
  listening: boolean
  /** What the microphone has heard so far, before it settles. */
  interim: string
  listen(): void
  stopListening(): void
  canListen: boolean
  canSpeak: boolean
  readAloud: boolean
  setReadAloud(on: boolean): void
  /** A short problem with the microphone, in plain words. */
  problem: string | null
}

const READ_KEY = 'atlas-read-aloud'

function spoken(reply: Reply): string {
  return reply.list?.length ? `${reply.text} ${reply.list.join('. ')}.` : reply.text
}

export function useConversation({ selectedId, act }: { selectedId: string | null; act(a: Act): void }): Conversation {
  const [turns, setTurns] = useState<Turn[]>([])
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [readAloud, setReadAloudState] = useState(() => {
    try {
      return localStorage.getItem(READ_KEY) !== 'off'
    } catch {
      return true
    }
  })
  const nextId = useRef(1)
  const mic = useRef<Listening | null>(null)
  // The latest values for callbacks that outlive a render (speech events).
  const live = useRef({ selectedId, act, readAloud, turns })
  useLayoutEffect(() => {
    live.current = { selectedId, act, readAloud, turns }
  })

  useEffect(
    () => () => {
      mic.current?.abort()
      stopSpeaking()
    },
    [],
  )

  const setReadAloud = (on: boolean) => {
    setReadAloudState(on)
    if (!on) stopSpeaking()
    try {
      localStorage.setItem(READ_KEY, on ? 'on' : 'off')
    } catch {
      // Not remembered; fine.
    }
  }

  const update = (id: number, f: (t: Turn & { who: 'atlas' }) => Turn) =>
    setTurns((ts) => ts.map((t) => (t.id === id && t.who === 'atlas' ? f(t) : t)))

  const send = useCallback((raw: string, voice = false) => {
    const text = raw.trim()
    if (!text) return
    setProblem(null)
    const { selectedId, act, readAloud, turns } = live.current
    const reply = answer(text, { selectedId })
    const you: Turn = { id: nextId.current++, who: 'you', text }
    const id = nextId.current++
    act(reply.act)

    if (reply.unknown && hasRemote) {
      setTurns((ts) => [...ts, you, { id, who: 'atlas', reply: { ...reply, text: '' }, waiting: true }])
      const history = [...turns, you].map((t) =>
        t.who === 'you' ? { role: 'user' as const, content: t.text } : { role: 'assistant' as const, content: spoken(t.reply) },
      )
      const part = partById(selectedId)
      askRemote(history, part ? { id: part.id, name: part.name } : null)
        .then((answerText) => {
          update(id, (t) => ({ ...t, waiting: false, reply: { ...reply, text: answerText, unknown: false } }))
          if (voice && live.current.readAloud) speak(answerText)
        })
        .catch(() => {
          update(id, (t) => ({ ...t, waiting: false, reply }))
          if (voice && live.current.readAloud) speak(reply.text)
        })
      return
    }

    setTurns((ts) => [...ts, you, { id, who: 'atlas', reply }])
    if (voice && readAloud) speak(spoken(reply))
  }, [])

  const startListening = useCallback(() => {
    if (mic.current) return
    stopSpeaking()
    setProblem(null)
    setInterim('')
    const session = listen({
      onInterim: setInterim,
      onFinal: (text) => {
        setInterim('')
        send(text, true)
      },
      onEnd: () => {
        mic.current = null
        setListening(false)
        setInterim('')
      },
      onError: (message) => setProblem(message),
    })
    if (!session) {
      setProblem('Ta przeglądarka nie rozpoznaje mowy. Napisz pytanie w polu poniżej.')
      return
    }
    mic.current = session
    setListening(true)
  }, [send])

  const stopListening = useCallback(() => mic.current?.stop(), [])

  return {
    turns,
    send,
    listening,
    interim,
    listen: startListening,
    stopListening,
    canListen,
    canSpeak,
    readAloud,
    setReadAloud,
    problem,
  }
}
