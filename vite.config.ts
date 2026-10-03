import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// src/ holds two apps and deploy.yml builds it twice: the body map (src/main.tsx) for /cialo/ and,
// with VITE_APP=gdzie-boli, the "Gdzie boli?" symptom checker (src/gdzie-boli.tsx) for /gdzie-boli/.
// index.html is the body map's; for the second build this swaps in its entry, title, colour and description,
// and drops the atlas's install metadata (manifest, icons; its service worker is registered from src/main.tsx).
const gdzieBoliPage: Plugin = {
  name: 'gdzie-boli-page',
  transformIndexHtml: {
    order: 'pre',
    handler: (html) =>
      process.env.VITE_APP !== 'gdzie-boli'
        ? html
        : html
            .replace(/\s*<!-- atlas-pwa[\s\S]*?<!-- \/atlas-pwa -->/, '')
            .replace('/src/main.tsx', '/src/gdzie-boli.tsx')
            .replace(/(name="theme-color" content=")[^"]*/, '$1#0f766e')
            .replace(
              /<title>.*<\/title>/,
              '<meta name="description" content="Gdzie boli? Wskaż miejsce na sylwetce, odpowiedz na kilka pytań i dostań wstępną ocenę objawów: możliwe przyczyny i gdzie szukać pomocy. To nie jest diagnoza." />\n' +
                '    <title>Gdzie boli? · wstępna ocena objawów</title>',
            ),
  },
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app under /<repo-name>/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss(), gdzieBoliPage],
  // Only the two apps' entries: by default the dev server also crawls every other .html in the repo
  // (tools/anatomy/preview.html has its own copy of three), which loads two copies of three.
  optimizeDeps: { entries: ['index.html', 'src/gdzie-boli.tsx'] },
})
