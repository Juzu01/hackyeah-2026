// The conversation, in the sheet: what you said on the right, the atlas's
// answers on the left with the part they're about, pain reports to check and
// save, and the way to type or speak the next thing.

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { CloseIcon, MicIcon, PhoneIcon, SendIcon, SpeakerIcon, StopIcon } from '../icons.tsx'
import { supabase } from '../../lib/supabase.ts'
import type { Conversation, Turn } from './useConversation.ts'

const SUGGESTIONS = ['Boli mnie kolano', 'Gdzie jest wątroba?', 'Jak rozciągnąć łydkę?']

/** Green (1) → red (10), as in the pain form. */
const levelColor = (n: number) => `hsl(${120 - ((n - 1) * 120) / 9} 70% 42%)`
const levelInk = (n: number) => (n >= 9 ? '#fff' : '#0b0f14')

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
            {talk.canListen ? 'Powiedz albo napisz' : 'Napisz'}, co Cię boli albo o co chcesz zapytać. Pokażę to miejsce na
            ciele.
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
          {/* The team's companion app, a level up from /cialo/, has a full voice call (ElevenLabs). */}
          <a className="talk-soleil" href="../">
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
              {t.who === 'you' ? t.text : <AtlasTurn turn={t} talk={talk} onFocus={onFocus} />}
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
          placeholder={talk.listening ? 'Słucham…' : 'Napisz, co boli…'}
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

function AtlasTurn({ turn, talk, onFocus }: { turn: Turn & { who: 'atlas' }; talk: Conversation; onFocus(id: string): void }) {
  const { reply, save } = turn
  if (turn.waiting) {
    return (
      <p className="talk-text talk-waiting" aria-label="Odpowiedź w drodze">
        <span />
        <span />
        <span />
      </p>
    )
  }
  const draft = reply.draft
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
      {reply.part && !draft && (
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
      {draft && reply.part && (
        <div className="talk-report" data-system={reply.part.system}>
          <button type="button" className="talk-report-part" onClick={() => onFocus(reply.part!.id)}>
            <span className="swatch" aria-hidden="true" />
            {reply.part.name}
            {reply.part.sideLabel && <span className="talk-part-side">{reply.part.sideLabel}</span>}
          </button>
          <div className="talk-levels" role="group" aria-label="Natężenie bólu od 1 do 10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={draft.intensity === n}
                aria-label={`${n} na 10`}
                className="talk-level"
                style={{ '--level': levelColor(n), '--level-ink': levelInk(n) } as CSSProperties}
                onClick={() => talk.setIntensity(turn.id, n)}
              >
                {n}
              </button>
            ))}
          </div>
          {talk.painTypes.length > 0 && (
            <div className="pain-types">
              {talk.painTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="chip"
                  aria-pressed={draft.typeIds.includes(t.id)}
                  onClick={() => talk.toggleType(turn.id, t.id)}
                >
                  {t.name_pl}
                </button>
              ))}
            </div>
          )}
          {supabase ? (
            <>
              <button
                type="button"
                className="btn-primary"
                disabled={draft.intensity === null || draft.typeIds.length === 0 || save?.kind === 'saving' || save?.kind === 'saved'}
                onClick={() => talk.save(turn.id)}
              >
                {save?.kind === 'saving' ? 'Zapisuję…' : save?.kind === 'saved' ? 'Zapisano' : 'Zapisz zgłoszenie'}
              </button>
              {save?.kind === 'error' && <p className="talk-problem">{save.message}</p>}
            </>
          ) : (
            <p className="talk-note">Zapisywanie bólu nie jest tu włączone.</p>
          )}
        </div>
      )}
    </>
  )
}
