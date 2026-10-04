// The conversation, in the sheet: what you said on the right, the atlas's
// answers on the left with the part they're about, and the way to type or speak
// the next thing. Pain is for Doco's Objawy tab: those answers link there.

import { useEffect, useRef, useState } from 'react'
import { CloseIcon, MicIcon, PhoneIcon, SendIcon, SpeakerIcon, StopIcon } from '../icons.tsx'
import { callDoco } from '../../shell.ts'
import type { Conversation, Turn } from './useConversation.ts'

const SUGGESTIONS = ['Gdzie jest wątroba?', 'Pokaż serce', 'Jak rozciągnąć łydkę?']

interface Props {
  talk: Conversation
  onFocus(partId: string): void
  onClose(): void
}

export default function Chat({ talk, onFocus, onClose }: Props) {
  const [draft, setDraft] = useState('')
  const end = useRef<HTMLFormElement>(null)

  // Keep the newest line in view: now, and again once the sheet has grown to fit it.
  useEffect(() => {
    // The compose row is sticky, so scrolling it into view would do nothing: scroll the sheet itself.
    const show = () => {
      const body = end.current?.closest('.sheet-body')
      body?.scrollTo({ top: body.scrollHeight, behavior: 'smooth' })
    }
    show()
    const timer = setTimeout(show, 300)
    return () => clearTimeout(timer)
  }, [talk.turns.length, talk.interim, talk.problem])

  const submit = () => {
    talk.send(draft)
    setDraft('')
  }

  return (
    <div className="talk">
      <header className="talk-head">
        <h2 className="talk-title">Rozmowa</h2>
        <div className="talk-tools">
          {talk.canSpeak && (
            <button
              type="button"
              className="icon-btn"
              aria-pressed={talk.readAloud}
              aria-label={talk.readAloud ? 'Nie czytaj odpowiedzi na głos' : 'Czytaj odpowiedzi na głos'}
              title={talk.readAloud ? 'Odpowiedzi czytane na głos' : 'Odpowiedzi bez głosu'}
              onClick={() => talk.setReadAloud(!talk.readAloud)}
            >
              <SpeakerIcon off={!talk.readAloud} />
            </button>
          )}
          <button type="button" className="icon-btn" aria-label="Zamknij rozmowę" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </header>

      {talk.turns.length === 0 && !talk.interim ? (
        <div className="talk-empty">
          <p className="talk-lead">
            {talk.canListen ? 'Powiedz albo napisz' : 'Napisz'}, o co chcesz zapytać. Pokażę to miejsce na ciele.
          </p>
          <ul className="talk-suggest">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button type="button" onClick={() => talk.send(s)}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
          {/* Doco's voice call (ElevenLabs), opened over this tab; on its own the atlas goes to Doco's Rozmowa. */}
          <a
            className="talk-doco"
            href="../#rozmowa"
            target="_top"
            onClick={(e) => {
              if (callDoco()) e.preventDefault()
            }}
          >
            <PhoneIcon />
            <span>
              Chcesz po prostu porozmawiać? <strong>Zadzwoń do Doco</strong>
            </span>
          </a>
          <p className="talk-note">To nie jest porada lekarska. W nagłej sytuacji dzwoń pod 112.</p>
        </div>
      ) : (
        <ol className="talk-log" aria-live="polite">
          {talk.turns.map((t) => (
            <li key={t.id} className={t.who === 'you' ? 'talk-you' : 'talk-atlas'}>
              {t.who === 'you' ? t.text : <AtlasTurn turn={t} onFocus={onFocus} />}
            </li>
          ))}
          {talk.interim && <li className="talk-you is-interim">{talk.interim}</li>}
        </ol>
      )}

      {talk.problem && (
        <p role="status" className="talk-problem">
          {talk.problem}
        </p>
      )}
      <form
        ref={end}
        className="talk-compose"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          className="talk-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={talk.listening ? 'Słucham…' : 'Zadaj pytanie…'}
          aria-label="Twoja wiadomość"
          enterKeyHint="send"
          autoComplete="off"
        />
        {draft.trim() || !talk.canListen ? (
          <button type="submit" className="send-btn" aria-label="Wyślij" disabled={!draft.trim()}>
            <SendIcon />
          </button>
        ) : (
          <button
            type="button"
            className={`voice is-small ${talk.listening ? 'is-listening' : ''}`}
            aria-label={talk.listening ? 'Zakończ mówienie' : 'Powiedz'}
            onClick={talk.listening ? talk.stopListening : talk.listen}
          >
            <span className="voice-ring" />
            <span className="voice-ring" />
            <span className="voice-ring" />
            {talk.listening ? <StopIcon size={18} /> : <MicIcon size={22} />}
          </button>
        )}
      </form>
    </div>
  )
}

function AtlasTurn({ turn, onFocus }: { turn: Turn & { who: 'atlas' }; onFocus(id: string): void }) {
  const { reply } = turn
  if (turn.waiting) {
    return (
      <p className="talk-text talk-waiting" aria-label="Odpowiedź w drodze">
        <span />
        <span />
        <span />
      </p>
    )
  }
  return (
    <>
      {reply.emergency ? (
        <div className="talk-alert" role="alert">
          <p className="talk-text">{reply.emergency.text}</p>
          {reply.emergency.calls.map((c) => (
            <a key={c.tel} className="btn-urgent" href={`tel:${c.tel}`}>
              <PhoneIcon />
              {c.label}
            </a>
          ))}
        </div>
      ) : (
        <p className="talk-text">{reply.text}</p>
      )}
      {reply.list && (
        <ul className="talk-list">
          {reply.list.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
      {reply.part && (
        <button type="button" className="talk-part" data-system={reply.part.system} onClick={() => onFocus(reply.part!.id)}>
          <span className="swatch" aria-hidden="true" />
          <span className="talk-part-name">{reply.part.name}</span>
          {reply.part.latin && (
            <span className="talk-part-latin" lang="la">
              {reply.part.latin}
            </span>
          )}
        </button>
      )}
      {reply.symptoms && (
        <a className="btn-primary talk-symptoms" href="../#objawy" target="_top">
          Przejdź do Objawów
        </a>
      )}
    </>
  )
}
