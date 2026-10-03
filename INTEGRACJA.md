# Integracja: jak wysyłać zmiany

Co około 5 minut bot (Claude) zbiera wszystko, co wysłaliście, scala w jedną aplikację na `main` i publikuje na https://juzu01.github.io/hackyeah-2026/. Nie trzeba nikomu przydzielać zadań ani pilnować konfliktów. Co weszło i co wymaga decyzji, bot zapisuje w [dzienniku integracji (#1)](https://github.com/Juzu01/hackyeah-2026/issues/1).

## Dla zespołu

- **Najlepiej wysyłaj na własną gałąź**, np. `adrian` albo `mateusz-czat`. Przy wrzucaniu plików przez stronę GitHuba zaznacz na dole **„Create a new branch for this commit and start a pull request”**. Wtedy nic nie nadpisze cudzej pracy, a bot scali wszystko sam.
- **Prosto na `main` też można**, bot to ogarnie. Uwaga: upload przez stronę na `main` nadpisuje pliki bez ostrzeżenia, więc jeśli dwie osoby zmieniają ten sam plik, wygrywa ostatnia.
- **W opisie commita lub PR napisz jednym zdaniem, co to robi i gdzie ma się pojawić w aplikacji**, np. „ekran z planem treningu, link w menu”. Bot podpina nowe rzeczy według tego opisu.
- Nie wrzucaj kluczy API ani plików `.env`, bo repo jest publiczne. Klucze idą do zmiennych środowiskowych na Vercelu.

## Dla bota: jedna runda integracji

Pracujesz wyłącznie w `~/hackyeah-integrator`. Nigdy nie ruszaj `~/hackyeah-2026`, tam pracuje człowiek.

1. **Synchronizacja.** `git fetch --all --prune`. Jeśli lokalny `main` ma niewypchnięte commity z poprzedniej rundy, najpierw je dokończ i wypchnij. Potem `git checkout main && git merge --ff-only origin/main`.
2. **Co nowego:**
   - gałęzie zdalne z commitami, których nie ma w `main`: `git branch -r --no-merged origin/main`;
   - otwarte PR-y, także z forków: `gh pr list --state open`;
   - commity wrzucone prosto na `main` od ostatniej rundy: `git log refs/integrator/last..origin/main`, bez własnych commitów bota (zaczynają się od „Integracja:”).
3. **Nic nowego?** Zakończ jedną linijką „nic nowego” i nie twórz żadnego commita.
4. **Scalanie.** Każdą gałąź lub PR scal do `main` przez `git merge --no-ff`, od najstarszej. Konflikty rozwiązuj, rozumiejąc intencję obu stron:
   - zachowaj obie funkcje i nigdy nie wyrzucaj czyjejś pracy;
   - jeśli ktoś usunął coś, co ktoś inny w tym czasie zmienił, zostaw wersję zmienioną;
   - jeśli dwie wersje tej samej funkcji są naprawdę sprzeczne, nie zgaduj. Zostaw tę z `main`, drugą zachowaj w pliku obok, opisz to w dzienniku i scal resztę.
5. **Składanie w całość.** Produkt to to, co publikuje `.github/workflows/deploy.yml` (dziś `soleil-main/` w głównym katalogu strony i `pomysly/`).
   - Nowe pliki i funkcje podepnij tak, żeby były osiągalne z aplikacji (link, zakładka, sekcja), zgodnie z opisem autora.
   - Ścieżki tylko względne, bo strona żyje pod `/hackyeah-2026/`.
   - Duplikaty z uploadu (`nazwa (1).ext`): jeśli to nowsza wersja tego samego pliku, zastąp nią oryginał i usuń duplikat.
   - Jeśli ktoś rozwija aplikację Vite z głównego katalogu repo (`src/`), dodaj jej build do `deploy.yml` (z `base` ustawionym na podkatalog strony) i podlinkuj ją z Soleil.
   - Zmieniaj tylko tyle, ile trzeba do scalenia. Nie przepisuj działającego kodu.
6. **Sprawdzenie.** `python3 tools/sprawdz.py` musi zwrócić OK. Jeśli zmieniło się `src/` albo `package.json`, uruchom też `npm ci && npm run build`. Napraw błędy, które wprowadziło scalanie. Jeśli ktoś wrzucił klucz albo `.env`, nie publikuj tego, tylko zgłoś w dzienniku i w terminalu.
7. **Publikacja.** Commit `Integracja: <co weszło>` z listą gałęzi i autorów. Potem `git push origin main`, nigdy z `--force`. Jeśli push zostanie odrzucony, pobierz zmiany, scal ponownie i spróbuj jeszcze raz, maksymalnie 3 razy.
8. **Nie usuwaj gałęzi ani PR-ów.** GitHub sam oznaczy PR jako scalony, gdy jego commity trafią na `main`.
9. **Dziennik.** Dodaj komentarz w #1: co weszło, jakie były konflikty i jak je rozwiązałeś, co wymaga decyzji człowieka. Na koniec `git update-ref refs/integrator/last origin/main`.
