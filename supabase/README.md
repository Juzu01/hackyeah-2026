# Baza danych (Supabase)

> **Październik 2026:** Atlas ciała (`/cialo/`) nie zgłasza już bólu, od tego jest zakładka Objawy („Gdzie boli?”). Panel bólu, czat zapisujący zgłoszenia, `src/lib/painReports.ts` i dane demo (`?demo`) zostały usunięte z kodu; są w historii gita. Tabele poniżej zostają w bazie, ale aplikacja ich teraz nie używa.

Projekt `hackyeah-2026` (`yoxnmbflqrppspjdmrks`, Frankfurt). Adres i klucz publiczny: [`.env.example`](../.env.example).

Użytkownik loguje się **anonimowo** (Supabase Auth) przy pierwszym zapisie. Sesja zostaje w przeglądarce, więc ta sama osoba widzi swoją historię przy kolejnych wizytach. Każdy widzi tylko swoje zgłoszenia (RLS).

## Jak to działa w aplikacji

Tap w część ciała na mapie (`/cialo/`) otwiera panel [`src/pain/PainPanel.tsx`](../src/pain/PainPanel.tsx): natężenie 1–10, typy bólu (kilka naraz), „Zapisz”. Pod spodem jest historia tej części.

Kod do bazy, gotowy do użycia też poza panelem:

| plik | co robi |
|---|---|
| [`src/lib/supabase.ts`](../src/lib/supabase.ts) | klient Supabase i `ensureUser()` (anonimowe logowanie, raz na urządzenie) |
| [`src/lib/painReports.ts`](../src/lib/painReports.ts) | `fetchPainTypes()`, `savePainReport()`, `fetchPainHistory(bodyPartId?)`, do wykresów `fetchPainDaily()` i `fetchPainTrend()`, dane demo `seedDemoHistory()` / `clearDemoHistory()` |
| [`src/lib/database.types.ts`](../src/lib/database.types.ts) | typy TS wygenerowane ze schematu (generujemy na nowo po każdej zmianie schematu) |

Bez `.env.local` mapa działa normalnie, tylko panel pokazuje, że zapisywanie jest wyłączone.

## Tabele

| tabela | co trzyma |
|---|---|
| `pain_reports` | jedno zgłoszenie: `body_part_id`, `intensity` (1–10), `note`, `reported_at`, `user_id`, `is_demo` |
| `pain_report_types` | typy bólu zgłoszenia (może być kilka) |
| `pain_types` | słownik 11 typów: `throbbing` (pulsujący), `stabbing`, `sharp`, `dull`, `aching`, `burning`, `pressing`, `radiating`, `tearing`, `cramping`, `tingling` |
| `body_parts` | słownik 60 części z mapy ciała: `id` (np. `biceps-left`, `heart`, `kidney-right`), `info_key`, `name_pl`, `latin`, `system` (`muscle`/`organ`), `side` |

`body_part_id` to **id części z mapy** (`buildBodyModel()` w `src/body/anatomy.ts`). Nie ma klucza obcego do `body_parts`, bo mapa jeszcze rośnie: nowa część na mapie od razu da się zapisać. Do nazw w analizach łączymy `left join body_parts`. Po dodaniu części do mapy warto dopisać ją do słownika nową migracją.

Zapis idzie przez funkcję `create_pain_report`, która w jednej transakcji tworzy zgłoszenie i jego typy.

## Wykresy i trendy

Baza liczy to sama, tylko dla zalogowanego użytkownika:

- **widok `pain_daily`**: jeden wiersz na dzień (czas polski) i część ciała: `reports`, `avg_intensity`, `max_intensity`. Seria do wykresu „ból w czasie”.
- **funkcja `pain_trend(p_days = 7)`**: ostatnie `p_days` dni kontra `p_days` dni wcześniej, dla każdej części ciała. `trend` to `up` / `down` (średnia zmieniła się o co najmniej 1 punkt), `flat`, `new` (boli dopiero ostatnio) albo `gone` (przestało boleć).

```ts
import { fetchPainDaily, fetchPainHistory, fetchPainTrend, savePainReport } from './lib/painReports.ts'

await savePainReport({ bodyPartId: 'biceps-left', intensity: 7, painTypeIds: ['throbbing', 'radiating'] })
const history = await fetchPainHistory()                        // pojedyncze zgłoszenia, najnowsze pierwsze
const series = await fetchPainDaily({ bodyPartId: 'vastusMedialis-left', days: 30 })
// [{ day: '2026-09-04', avgIntensity: 8, maxIntensity: 8, reports: 1, bodyPartId: 'vastusMedialis-left' }, ...]
const trends = await fetchPainTrend(7)
// [{ namePl: 'Mięsień czworoboczny', trend: 'up', recentAvg: 6, previousAvg: 3.5, ... }, ...]
```

## Dane demo na pokaz

Nowy (anonimowy) użytkownik ma pustą historię, więc wykresy na prezentacji byłyby puste.

- **https://juzu01.github.io/hackyeah-2026/cialo/?demo** wypełnia historię tej przeglądarki 26 zgłoszeniami z ostatnich 30 dni: kolano po bieganiu słabnie (`down`), kark od biurka narasta (`up`), skurcze łydki minęły (`gone`), goleń boli od niedawna (`new`). Ponowne wejście odświeża daty, nie dubluje danych.
- **`/cialo/?demo=clear`** usuwa dane demo. Prawdziwe zgłoszenia zostają.

Wiersze demo mają `is_demo = true`, więc w analizach na prawdziwych danych filtrujemy `is_demo = false`.

## Migracje

Pliki w [`migrations/`](migrations/) są już wgrane do projektu, a ich numery zgadzają się z historią migracji w Supabase (Supabase CLI nie będzie ich wgrywać drugi raz). Zmiany schematu dodajemy jako **nowy** plik migracji, bez edytowania starych.

## Funkcja `analiza-objawow` (AI w „Gdzie boli?”)

Karta „Twoje objawy razem” w wyniku może pochodzić od Claude’a. Strona nie może trzymać tokenu (na GitHub Pages wszystko jest publiczne), więc pyta funkcję [`functions/analiza-objawow`](functions/analiza-objawow/index.ts), a dopiero ona pyta Claude’a przez GitHub Models. Claude dostaje tylko objawy z odpowiedziami, zalecenie i przyczyny wybrane już przez naszą bazę, i ma się trzymać wyłącznie ich.

Wdrożenie (raz):

```sh
npx supabase login
npx supabase link --project-ref yoxnmbflqrppspjdmrks
npx supabase secrets set GITHUB_TOKEN=<token z uprawnieniem Models: read> MODEL=<id modelu Claude z katalogu GitHub Models>
npx supabase functions deploy analiza-objawow --no-verify-jwt
```

Potem w `.github/workflows/deploy.yml` przy budowaniu „Gdzie boli?” dodać `VITE_ANALYSIS_URL: https://yoxnmbflqrppspjdmrks.supabase.co/functions/v1/analiza-objawow`. Bez tej zmiennej (albo gdy AI nie odpowie w 15 s) karta liczy się w aplikacji z naszej bazy i nie jest podpisana jako AI.
