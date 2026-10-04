import '@fontsource-variable/nunito'
import '@fontsource-variable/fraunces/full.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './gdzie-boli.css'
// The mode and accent colour picked in Doco, before the first render
import { followDocoTheme } from './lib/accent.ts'
import GdzieBoliApp from './GdzieBoliApp.tsx'
import { AccountProvider } from './lib/auth.tsx'
import { stayOrOpenInDoco } from './shell.ts'

// Entry of the "Gdzie boli?" build (VITE_APP=gdzie-boli, see vite.config.ts); src/main.tsx is the body map's.
// gdzie-boli.css is this app's whole Tailwind entry, so src/index.css (the atlas's) is not imported here.
followDocoTheme()

if (stayOrOpenInDoco('objawy')) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AccountProvider>
        <GdzieBoliApp />
      </AccountProvider>
    </StrictMode>,
  )
}
