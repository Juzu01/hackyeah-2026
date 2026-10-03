# HackYeah 2026 · Sport & Healthcare

Prototyp na HackYeah 2026, kategoria Open Task – Sport & Healthcare.

**Podgląd na żywo:** https://juzu01.github.io/hackyeah-2026/

## Uruchomienie lokalnie

Wymagany Node.js 20.19+ lub 22.12+.

```bash
npm install
npm run dev
```

Aplikacja wstanie pod http://localhost:5173.

## Deploy

Każdy push na `main` buduje aplikację i publikuje ją na GitHub Pages (`.github/workflows/deploy.yml`), zwykle w około minutę. W stopce strony widać skrót commita, z którego zbudowana jest aktualna wersja.

Stack: Vite, React, TypeScript, Tailwind CSS.
