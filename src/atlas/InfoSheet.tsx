// "i": how to use the atlas, installing it as an app, the model's attribution
// (required by its licence) and the build.

import { useEffect, useRef, useState } from 'react'
import { CREDIT } from '../anatomy/hud.ts'
import { CloseIcon, DoubleTapIcon, InstallIcon, PinchIcon, RotateIcon, ShareIcon, TapIcon } from './icons.tsx'
import { install, useInstallState } from './install.ts'

interface Props {
  touch: boolean
  build?: string
  onClose(): void
  /** Opens the first-visit welcome again. */
  onWelcome(): void
}

export default function InfoSheet({ touch, build, onClose, onWelcome }: Props) {
  const state = useInstallState()
  const [declined, setDeclined] = useState(false)
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => close.current?.focus(), [])

  const howTo = touch
    ? [
        { icon: <RotateIcon />, text: 'Przeciągnij jednym palcem, aby obrócić ciało.' },
        { icon: <PinchIcon />, text: 'Rozsuń dwa palce, aby przybliżyć i zajrzeć pod mięśnie.' },
        { icon: <TapIcon />, text: 'Dotknij mięśnia, narządu lub kości, aby go wybrać.' },
        { icon: <DoubleTapIcon />, text: 'Dotknij dwa razy, aby przybliżyć wybraną część.' },
      ]
    : [
        { icon: <RotateIcon />, text: 'Przeciągnij myszą, aby obrócić ciało.' },
        { icon: <PinchIcon />, text: 'Przewiń kółkiem, aby przybliżyć i zajrzeć pod mięśnie.' },
        { icon: <TapIcon />, text: 'Kliknij mięsień, narząd lub kość, aby go wybrać.' },
        { icon: <DoubleTapIcon />, text: 'Kliknij dwa razy, aby przybliżyć wybraną część.' },
      ]

  return (
    <div className="info">
      <header className="card-head">
        <div className="card-titles">
          <h2 className="card-name">Atlas ciała</h2>
        </div>
        <button ref={close} type="button" className="icon-btn" aria-label="Zamknij" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>
      <p className="info-lead">
        Trójwymiarowy atlas anatomiczny: mięśnie, narządy i kości. Wybierz część ciała, żeby poznać jej budowę i rolę.
        Jeśli coś Cię boli, sprawdź to w zakładce Objawy.
      </p>

      <h3 className="info-heading">Jak korzystać</h3>
      <ul className="info-howto">
        {howTo.map((h) => (
          <li key={h.text}>
            <span className="info-icon">{h.icon}</span>
            {h.text}
          </li>
        ))}
      </ul>
      <p className="info-note">
        Lista w lewym górnym rogu przełącza warstwy: mięśnie, narządy z kośćmi albo narządy rozsunięte osobno, żeby łatwo
        je wybrać. Lupa na górze znajduje część ciała po nazwie, np. „kolano”. Okrągły przycisk na dole pozwala po
        prostu zapytać, na przykład „gdzie jest wątroba?”.
      </p>
      <button type="button" className="more-toggle" onClick={onWelcome}>
        Pokaż wprowadzenie jeszcze raz
      </button>

      <h3 className="info-heading">Aplikacja na telefonie</h3>
      {state === 'installed' && <p className="info-text">Atlas jest zainstalowany na tym urządzeniu.</p>}
      {state === 'prompt' && (
        <button
          type="button"
          className="btn-primary"
          onClick={() => void install().then((ok) => setDeclined(!ok))}
        >
          <InstallIcon />
          Zainstaluj aplikację
        </button>
      )}
      {state === 'prompt' && declined && <p className="info-note">Możesz to zrobić później z menu przeglądarki.</p>}
      {state === 'ios' && (
        <ol className="info-steps">
          <li>
            Stuknij <ShareIcon /> <strong>Udostępnij</strong> na pasku Safari.
          </li>
          <li>
            Wybierz <strong>Do ekranu początkowego</strong>.
          </li>
        </ol>
      )}
      {state === 'unavailable' && (
        <p className="info-text">
          Otwórz tę stronę w Chrome na Androidzie albo w Safari na iPhonie i dodaj ją do ekranu początkowego, żeby
          korzystać z atlasu jak z aplikacji.
        </p>
      )}

      <h3 className="info-heading">Źródła</h3>
      <p className="info-text">
        Model anatomiczny:{' '}
        <a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/" target="_blank" rel="noreferrer">
          BodyParts3D
        </a>{' '}
        © The Database Center for Life Science, licencja{' '}
        <a href="https://creativecommons.org/licenses/by-sa/2.1/jp/deed.pl" target="_blank" rel="noreferrer">
          CC BY-SA 2.1 JP
        </a>
        .
      </p>
      <p className="info-note">Atlas ma charakter edukacyjny i nie zastępuje porady lekarza.</p>
      <p className="info-build" title={CREDIT}>
        Wersja {build ? build.slice(0, 7) : 'lokalna'}
      </p>
    </div>
  )
}
