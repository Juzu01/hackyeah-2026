# Baza danych (Supabase)

Projekt `hackyeah-2026` (`yoxnmbflqrppspjdmrks`, Frankfurt). Adres i klucz publiczny: [`.env.example`](../.env.example).

Użytkownik loguje się **anonimowo** (Supabase Auth) przy pierwszym zapisie. Sesja zostaje w przeglądarce, więc ta sama osoba widzi swoją historię przy kolejnych wizytach. Każdy widzi tylko swoje zgłoszenia (RLS).

## Jak to działa w aplikacji

Tap w część ciała na mapie (`/cialo/`) otwiera panel [`src/pain/PainPanel.tsx`](../src/pain/PainPanel.tsx): natężenie 1–10, typy bólu (kilka naraz), „Zapisz”. Pod spodem jest historia tej części.

Kod do bazy, gotowy do użycia też poza panelem:

| plik | co robi |
|---|---|
| [`src/lib/supabase.ts`](../src/lib/supabase.ts) | klient Supabase i `ensureUser()` (anonimowe logowanie, raz na urządzenie) |
| [`src/lib/painReports.ts`](../src/lib/painReports.ts) | `fetchPainTypes()`, `savePainReport()`, `fetchPainHistory(bodyPartId?)` |
| [`src/lib/database.types.ts`](../src/lib/database.types.ts) | typy TS wygenerowane ze schematu (generujemy na nowo po każdej zmianie schematu) |

Bez `.env.local` mapa działa normalnie, tylko panel pokazuje, że zapisywanie jest wyłączone.

## Tabele

| tabela | co trzyma |
|---|---|
| `pain_reports` | jedno zgłoszenie: `body_part_id`, `intensity` (1–10), `note`, `reported_at`, `user_id` |
| `pain_report_types` | typy bólu zgłoszenia (może być kilka) |
| `pain_types` | słownik 11 typów: `throbbing` (pulsujący), `stabbing`, `sharp`, `dull`, `aching`, `burning`, `pressing`, `radiating`, `tearing`, `cramping`, `tingling` |
| `body_parts` | słownik 60 części z mapy ciała: `id` (np. `biceps-left`, `heart`, `kidney-right`), `info_key`, `name_pl`, `latin`, `system` (`muscle`/`organ`), `side` |

`body_part_id` to **id części z mapy** (`buildBodyModel()` w `src/body/anatomy.ts`). Nie ma klucza obcego do `body_parts`, bo mapa jeszcze rośnie: nowa część na mapie od razu da się zapisać. Do nazw w analizach łączymy `left join body_parts`. Po dodaniu części do mapy warto dopisać ją do słownika nową migracją.

Zapis idzie przez funkcję `create_pain_report`, która w jednej transakcji tworzy zgłoszenie i jego typy.

## Przykład (do wykresów i trendów)

```ts
import { fetchPainHistory, savePainReport } from './lib/painReports.ts'

await savePainReport({ bodyPartId: 'biceps-left', intensity: 7, painTypeIds: ['throbbing', 'radiating'] })
const history = await fetchPainHistory()            // wszystkie zgłoszenia użytkownika, najnowsze pierwsze
const knee = await fetchPainHistory('vastusMedialis-left')
```

## Migracje

Pliki w [`migrations/`](migrations/) są już wgrane do projektu. Zmiany schematu dodajemy jako **nowy** plik migracji, bez edytowania starych.
