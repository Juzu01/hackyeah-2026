---
description: Uruchamia zespół 4 agentów (badacz → weryfikator → tester → archiwista) i rozbudowuje bazę wiedzy czatu Soleil
argument-hint: "[id tematów z tools/wiedza/tematy.json albo opis nowego tematu]"
---

Rozbuduj bazę wiedzy czatu Soleil zespołem czterech agentów. Zasady: `tools/wiedza/ZASADY.md`, raport: `docs/baza-wiedzy.md`.

Tematy: $ARGUMENTS
Jeśli nie podano tematów, weź 3 pierwsze tematy ze statusem `do-zbadania` z `tools/wiedza/tematy.json`, zaczynając od najniższego `tier`. Jeśli podano opis nowego tematu, najpierw poproś agenta `badacz` (tryb 3) o dopisanie go do `tematy.json`.

Dla każdego tematu, równolegle między tematami:
1. ustaw mu w `tematy.json` status `w-toku`,
2. agent `badacz` (tryb 1) → `tools/wiedza/robocze/<id>/1-badanie.json`,
3. agent `weryfikator` → `2-weryfikacja.json`; przy `rejected` wróć do badacza (tryb 2, poprawka),
4. agent `tester` → `3-test.json`; przy `fail` z `blockingIssues` wróć do badacza (tryb 2), potem znowu weryfikator i tester,
5. najwyżej 2 poprawki na temat; potem temat zostaje bez akceptacji.

Na koniec jeden agent `archiwista` dla wszystkich tematów naraz.

Zasady dla ciebie jako koordynatora:
- Każdemu agentowi podaj id tematu i dzisiejszą datę. Nie wklejaj mu całych plików, agenci czytają je sami.
- Nie poprawiaj treści wpisów sam. Twoja rola to kolejność i przekazywanie uwag.
- Nie rób commita ani pusha. Na koniec pokaż użytkownikowi: które tematy weszły do bazy, ile twierdzeń poprawił weryfikator, wyniki testów i co nie przeszło. Zmiany zostają lokalnie do jego akceptacji.
