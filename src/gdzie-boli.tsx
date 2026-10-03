import '@fontsource-variable/atkinson-hyperlegible-next'
import '@fontsource-variable/newsreader/opsz.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './gdzie-boli.css'
import GdzieBoliApp from './GdzieBoliApp.tsx'
import { AccountProvider } from './lib/auth.tsx'

// Entry of the "Gdzie boli?" build (VITE_APP=gdzie-boli, see vite.config.ts); src/main.tsx is the body map's.
// gdzie-boli.css is this app's whole Tailwind entry, so src/index.css (the atlas's) is not imported here.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider>
      <GdzieBoliApp />
    </AccountProvider>
  </StrictMode>,
)
