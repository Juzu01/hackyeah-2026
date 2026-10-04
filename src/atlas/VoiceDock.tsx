// The voice button at the bottom: one tap and you can say what hurts. It opens
// the conversation and starts listening (or, where the browser can't listen,
// opens it for typing). No caption under it: the button speaks for itself, and
// the welcome sheet explains it once.

import { MicIcon, StopIcon } from './icons.tsx'

interface Props {
  listening: boolean
  canListen: boolean
  hidden?: boolean
  onPress(): void
}

export default function VoiceDock({ listening, canListen, hidden, onPress }: Props) {
  return (
    <div className={`dock ${hidden ? 'is-hidden' : ''}`} aria-hidden={hidden || undefined}>
      <button
        type="button"
        className={`voice ${listening ? 'is-listening' : ''}`}
        aria-label={listening ? 'Zakończ mówienie' : canListen ? 'Zadaj pytanie o ciało' : 'Napisz pytanie o ciało'}
        tabIndex={hidden ? -1 : undefined}
        onClick={onPress}
      >
        <span className="voice-ring" />
        <span className="voice-ring" />
        <span className="voice-ring" />
        {listening ? <StopIcon /> : <MicIcon />}
      </button>
    </div>
  )
}
