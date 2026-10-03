# HackYeah 2026 · Sport & Healthcare

Soleil, prototyp na HackYeah 2026, kategoria Open Task – Sport & Healthcare.

**Podgląd na żywo:** https://juzu01.github.io/hackyeah-2026/

**Postać (interaktywna mapa ciała):** https://juzu01.github.io/hackyeah-2026/cialo/ — aplikacja Vite z `src/`, opis w [`src/body/README.md`](src/body/README.md). Lokalnie: `npm install && npm run dev`.

**Pomysły zespołu:** https://juzu01.github.io/hackyeah-2026/pomysly/ — każdy pomysł to issue z etykietą `pomysł` (szablon `.github/ISSUE_TEMPLATE/pomysl.yml`), głosujemy reakcją 👍.

**Wysyłanie zmian:** wrzucajcie na własne gałęzie albo prosto na `main`. Co ~5 minut bot scala wszystko w jedną aplikację i publikuje. Zasady w [`INTEGRACJA.md`](INTEGRACJA.md), dziennik w [#1](https://github.com/Juzu01/hackyeah-2026/issues/1).

## „Gdzie boli?” – symptom checker z mapą ciała

Druga aplikacja z tego samego projektu Vite w `src/` (wejście `src/gdzie-boli.tsx`, ekrany w `src/GdzieBoliApp.tsx`). Wchodzisz i od razu masz sylwetkę: klikasz, gdzie boli, zaznaczasz objawy, odpowiadasz na kilka pytań (najpierw alarmowe) i dostajesz wstępną ocenę: zalecenie (samoopieka / wizyta / pilnie / 112), możliwe przyczyny z poziomem dopasowania i wskazówki. Logowanie (Clerk) jest opcjonalne i służy tylko do historii analiz.

**Na żywo:** https://juzu01.github.io/hackyeah-2026/gdzie-boli/

Układ ekranów kopiuje sprawdzone wzorce (WebMD, Symptomate/Infermedica, NHS 111, Healthwise, Buoy) – research i decyzje w [`docs/badanie-rynku.md`](docs/badanie-rynku.md).

```bash
npm ci
VITE_APP=gdzie-boli npm run dev   # http://localhost:5173 (bez VITE_APP: mapa ciała)
npm test                          # testy bazy wiedzy i silnika (vitest)
npm run lint                      # oxlint
VITE_APP=gdzie-boli npm run build # dist/
```

Gdzie co jest:

- `src/body/regions.ts` – klikalne regiony (przód/tył) na sylwetce z `src/body/anatomy.ts`; `src/components/BodyMap.tsx` je rysuje.
- `src/data/` – baza wiedzy po polsku: objawy per region (`symptoms.ts`), możliwe przyczyny z wagami, poziomem pilności i poradami (`conditions.ts`), pytania alarmowe (`redFlags.ts`).
- `src/lib/engine.ts` – ważone dopasowanie i wyliczanie zalecenia; `src/lib/check.ts` – stan jednej analizy; `src/lib/history.ts` – historia w localStorage.
- `src/screens/` – ekrany: start (mapa), wywiad, wynik, historia, pomoc.

Zmienne środowiskowe (opcjonalne): `VITE_CLERK_PUBLISHABLE_KEY` – klucz Clerk (domyślnie ta sama instancja deweloperska co Soleil; `off` włącza tryb lokalny bez logowania przez serwer).

## Uruchomienie lokalnie (Soleil)

Sam frontend:

```bash
cd soleil-main
python3 -m http.server 5173
```

Aplikacja wstanie pod http://localhost:5173. Czat, nastroje, zwierzak i płatności wymagają funkcji z `soleil-main/api/`, które działają na Vercelu (`vercel dev`) z ustawionymi zmiennymi `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `STRIPE_*` i `VAPID_*`.

## Deploy

Każdy push na `main` publikuje zawartość `soleil-main/` na GitHub Pages (`.github/workflows/deploy.yml`), a aplikacje z `src/` buduje do podkatalogów `cialo/` (mapa ciała) i `gdzie-boli/` („Gdzie boli?”); zwykle trwa to około minuty. Hash commita, z którego pochodzi aktualna wersja, jest pod [`/version.txt`](https://juzu01.github.io/hackyeah-2026/version.txt).

GitHub Pages serwuje tylko pliki statyczne, więc na Pages widać interfejs, ale funkcje z `api/` tam nie działają.
