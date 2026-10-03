// The voice button at the bottom: one tap and you can say what hurts. It opens
// the conversation and starts listening (or, where the browser can't listen,
// opens it for typing).

import { MicIcon, StopIcon } from './icons.tsx'

interface Props {
  listening: boolean
  canListen: boolean
  hidden?: boolean
  onPress(): void
}

export default function VoiceDock({ listening, canListen, hidden, onPress }: Props) {
  const label = listening ? 'Słucham…' : canListen ? 'Powiedz, co boli' : 'Napisz, co boli'
  return (
    <div className={`dock ${hidden ? 'is-hidden' : ''}`} aria-hidden={hidden || undefined}>
      <button
        type="button"
        className={`voice ${listening ? 'is-listening' : ''}`}
        aria-label={listening ? 'Zakończ mówienie' : canListen ? 'Powiedz, co boli albo zadaj pytanie' : 'Napisz, co boli'}
        tabIndex={hidden ? -1 : undefined}
        onClick={onPress}
      >
        <span className="voice-ring" />
        <span className="voice-ring" />
        <span className="voice-ring" />
        {listening ? <StopIcon /> : <MicIcon />}
      </button>
      <span className="dock-label on-scene" aria-hidden="true">
        {label}
      </span>
    </div>
  )
}
