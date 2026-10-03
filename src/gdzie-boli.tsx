import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './gdzie-boli.css'
import GdzieBoliApp from './GdzieBoliApp.tsx'
import { AccountProvider } from './lib/auth.tsx'

// Entry of the "Gdzie boli?" build (VITE_APP=gdzie-boli, see vite.config.ts); src/main.tsx is the body map's.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AccountProvider>
      <GdzieBoliApp />
    </AccountProvider>
  </StrictMode>,
)
