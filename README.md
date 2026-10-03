# HackYeah 2026 · Sport & Healthcare

Soleil, prototyp na HackYeah 2026, kategoria Open Task – Sport & Healthcare.

**Podgląd na żywo:** https://juzu01.github.io/hackyeah-2026/

**Postać (interaktywna mapa ciała):** https://juzu01.github.io/hackyeah-2026/cialo/ — aplikacja Vite z `src/`, opis w [`src/body/README.md`](src/body/README.md). Lokalnie: `npm install && npm run dev`.

**Pomysły zespołu:** https://juzu01.github.io/hackyeah-2026/pomysly/ — każdy pomysł to issue z etykietą `pomysł` (szablon `.github/ISSUE_TEMPLATE/pomysl.yml`), głosujemy reakcją 👍.

**Wysyłanie zmian:** wrzucajcie na własne gałęzie albo prosto na `main`. Co ~5 minut bot scala wszystko w jedną aplikację i publikuje. Zasady w [`INTEGRACJA.md`](INTEGRACJA.md), dziennik w [#1](https://github.com/Juzu01/hackyeah-2026/issues/1).

## Uruchomienie lokalnie

Sam frontend:

```bash
cd soleil-main
python3 -m http.server 5173
```

Aplikacja wstanie pod http://localhost:5173. Czat, nastroje, zwierzak i płatności wymagają funkcji z `soleil-main/api/`, które działają na Vercelu (`vercel dev`) z ustawionymi zmiennymi `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STRIPE_*` i `VAPID_*`.

## Deploy

Każdy push na `main` publikuje zawartość `soleil-main/` na GitHub Pages (`.github/workflows/deploy.yml`), zwykle w około minutę. Hash commita, z którego pochodzi aktualna wersja, jest pod [`/version.txt`](https://juzu01.github.io/hackyeah-2026/version.txt).

GitHub Pages serwuje tylko pliki statyczne, więc na Pages widać interfejs, ale funkcje z `api/` tam nie działają.
