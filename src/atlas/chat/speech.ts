// Talking to the atlas: the browser's own speech recognition (Chrome, Edge,
// Safari; not Firefox) and speech synthesis, in Polish. No React.

interface Alternative {
  readonly transcript: string
}
interface Result {
  readonly isFinal: boolean
  readonly length: number
  readonly [index: number]: Alternative
}
interface ResultEvent extends Event {
  readonly resultIndex: number
  readonly results: { readonly length: number; readonly [index: number]: Result }
}
interface ErrorEvent extends Event {
  readonly error: string
}
interface Recognition extends EventTarget {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  onresult: ((e: ResultEvent) => void) | null
  onerror: ((e: ErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

const Ctor: RecognitionCtor | undefined =
  typeof window === 'undefined'
    ? undefined
    : ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition)

export const canListen: boolean = !!Ctor
export const canSpeak: boolean = typeof window !== 'undefined' && 'speechSynthesis' in window

export interface Listening {
  /** Stops listening and keeps what was heard (it arrives as onFinal). */
  stop(): void
  /** Stops listening and drops it. */
  abort(): void
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Brak zgody na mikrofon. Zezwól w ustawieniach przeglądarki albo napisz.',
  'service-not-allowed': 'Brak zgody na mikrofon. Zezwól w ustawieniach przeglądarki albo napisz.',
  'no-speech': 'Nic nie usłyszałem. Spróbuj jeszcze raz.',
  network: 'Rozpoznawanie mowy potrzebuje internetu.',
  'audio-capture': 'Nie widzę mikrofonu. Sprawdź, czy jest podłączony, albo napisz.',
}
const ERROR_DEFAULT = 'Nie udało się włączyć mikrofonu.'

/** One utterance: interim text while speaking, then the final text once. Null when the browser can't listen. */
export function listen(handlers: {
  onInterim(text: string): void
  onFinal(text: string): void
  onEnd(): void
  onError(message: string): void
}): Listening | null {
  if (!Ctor) return null
  // Otherwise the microphone hears the atlas's own voice.
  stopSpeaking()

  const rec = new Ctor()
  rec.lang = 'pl-PL'
  rec.interimResults = true
  rec.continuous = false
  rec.maxAlternatives = 1

  let heard = ''
  let delivered = false
  let aborted = false
  let ended = false

  const deliver = (text: string) => {
    const t = text.trim()
    if (delivered || aborted || !t) return
    delivered = true
    handlers.onFinal(t)
  }

  rec.onresult = (e) => {
    let interim = ''
    let final = ''
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i]
      if (r.isFinal) final += r[0].transcript
      else interim += r[0].transcript
    }
    heard = final + interim
    if (final) deliver(final)
    else if (!aborted) handlers.onInterim(heard.trim())
  }
  rec.onerror = (e) => {
    // 'aborted' is our own abort(); a 'no-speech' after something was heard is just the end.
    if (e.error === 'aborted' || aborted) return
    if (e.error === 'no-speech' && heard) return
    handlers.onError(ERRORS[e.error] ?? ERROR_DEFAULT)
  }
  rec.onend = () => {
    if (ended) return
    ended = true
    // Some browsers end without marking the last result final.
    deliver(heard)
    handlers.onEnd()
  }

  try {
    rec.start()
  } catch {
    handlers.onError(ERROR_DEFAULT)
    return null
  }

  return {
    stop: () => rec.stop(),
    abort: () => {
      aborted = true
      rec.abort()
    },
  }
}

// ── Speaking ──────────────────────────────────────────────────────────

let voice: SpeechSynthesisVoice | null = null

/** The best Polish voice: the natural-sounding ones first. Voices load late in Chrome. */
function pickVoice() {
  const pl = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('pl'))
  const score = (v: SpeechSynthesisVoice) =>
    (/natural|neural|premium|enhanced|google|zosia|ewa|marek/i.test(v.name) ? 2 : 0) + (v.lang === 'pl-PL' ? 1 : 0)
  voice = pl.sort((a, b) => score(b) - score(a))[0] ?? null
}

if (canSpeak) {
  pickVoice()
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice)
}

/** Says the text in Polish, cutting off anything still being said. */
export function speak(text: string) {
  if (!canSpeak || !text.trim()) return
  speechSynthesis.cancel()
  if (!voice) pickVoice()
  // Chrome stops long utterances after ~15 s, so say it a sentence at a time.
  const sentences = text.match(/[^.!?…]+[.!?…]*/g) ?? [text]
  for (const s of sentences) {
    const line = s.trim()
    if (!line) continue
    const u = new SpeechSynthesisUtterance(line)
    u.lang = 'pl-PL'
    if (voice) u.voice = voice
    u.rate = 1
    speechSynthesis.speak(u)
  }
}

export function stopSpeaking() {
  if (canSpeak) speechSynthesis.cancel()
}
