# Baza wiedzy Doco: zasady dla zespołu agentów

Ten plik czyta każdy z czterech agentów (`.claude/agents/`) przed rozpoczęciem pracy. Opisuje, jak przepływa praca, jak ma wyglądać wpis i czego nie wolno.

## Po co ta baza

Doco na GitHub Pages nie ma serwera AI. Na wiadomości odpowiada czat offline z `doco/offline-companion.js`. Gdy użytkownik pyta o coś konkretnego („jak zmierzyć ciśnienie?”, „co robić przy skręconej kostce?”), czat szuka odpowiedzi w bazie `doco/data/wiedza.json`. Każdy wpis w tej bazie musi być zebrany, sprawdzony w źródłach i przetestowany, zanim trafi do aplikacji, bo czytają go ludzie, którzy mogą być chorzy albo w kryzysie.

## Zespół i przepływ

```
badacz ──► weryfikator ──► tester ──► archiwista ──► doco/data/wiedza.json
   ▲             │             │
   └─────────────┴─────────────┘  odrzucenie albo problem blokujący: wraca do badacza (najwyżej 2 poprawki)
```

| Rola | Wejście | Wyjście |
|---|---|---|
| **badacz** | temat z `tools/wiedza/tematy.json` albo nowy | `tools/wiedza/robocze/<id>/1-badanie.json` |
| **weryfikator** | `1-badanie.json` | `tools/wiedza/robocze/<id>/2-weryfikacja.json` |
| **tester** | `2-weryfikacja.json` | `tools/wiedza/robocze/<id>/3-test.json` |
| **archiwista** | wszystkie `3-test.json` z werdyktem `pass` | `doco/data/wiedza.json`, status w `tematy.json`, raport w `docs/baza-wiedzy.md` |

Pliki w `tools/wiedza/robocze/` są robocze i nie trafiają do repo (`.gitignore`). Ślad weryfikacji zostaje w bazie w polu `review` i w raporcie.

## Zasady wspólne

- **Język:** treść po polsku, do użytkownika na „ty” (małą literą), prosto, jak do laika. Termin medyczny wyjaśnij w nawiasie. Klucze JSON po angielsku.
- **To informacja, nie diagnoza.** Nie stawiaj rozpoznań, nie dawkuj leków na receptę, nie obiecuj wyleczenia. W razie wątpliwości wybieraj wyższą pilność.
- **Pilność (`triage`)** tylko z tej listy (taka sama jak w „Gdzie boli?”, `src/data/types.ts`):
  - `self-care`: samoopieka i obserwacja,
  - `gp`: wizyta u lekarza w ciągu kilku dni,
  - `urgent`: lekarz w ciągu 24 h (POZ, nocna i świąteczna opieka zdrowotna, SOR),
  - `emergency`: natychmiast 112 albo SOR; `action` musi wtedy wprost mówić „112” albo „SOR”.
- **Kryzys psychiczny:** jeśli temat dotyka myśli samobójczych, samookaleczeń albo przemocy, wpis zawsze podaje: 112, 116 123 (dorośli), 800 70 2222 (Centrum Wsparcia, całą dobę), 116 111 (dzieci i młodzież). Weryfikator sprawdza, czy numery działają.
- **Polskie realia:** NFZ (programy profilaktyczne, czy trzeba skierowania), nocna i świąteczna opieka, 112, Centra Zdrowia Psychicznego, pacjent.gov.pl.
- **Źródła:** tylko wiarygodne i możliwie najnowsze:
  1. wytyczne towarzystw naukowych (np. ESC, ESH, PTK, PTNT, PTD, PTP, GINA, NICE, AHA, ACSM, IOC, AASM, ICSD, IHS, APA, PTPsych),
  2. instytucje zdrowia publicznego (WHO, NHS, CDC, ECDC, NFZ, pacjent.gov.pl, gov.pl, NIZP PZH, NIK, Rzecznik Praw Pacjenta),
  3. recenzowane publikacje (PubMed, Cochrane),
  4. podręczniki i serwisy medyczne pisane przez lekarzy z recenzją (np. MSD Manuals, Medycyna Praktyczna mp.pl).
  Bez blogów, sklepów, forów i stron producentów suplementów. Wikipedia najwyżej jako punkt startu, nigdy jako źródło we wpisie.
- **Nigdy nie wymyślaj adresów URL.** Każdy URL w `sources` to strona, którą faktycznie otworzyłeś (WebFetch) albo zobaczyłeś w wynikach wyszukiwania. Jeśli WebSearch i WebFetch są odroczone, załaduj je przez ToolSearch: `select:WebSearch,WebFetch`.
- **Git:** żaden agent nie robi commita, pusha, pulla, merge ani `git add`. Zmiany zostają lokalnie do akceptacji człowieka.
- Nie ruszaj plików spoza swojej roli. Badacz, weryfikator i tester piszą tylko w `tools/wiedza/robocze/<id>/`.

## Wpis bazy (`entry`)

```json
{
  "id": "pomiar-cisnienia",
  "title": "Domowy pomiar ciśnienia tętniczego",
  "domain": "samobadanie",
  "tier": 2,
  "audience": "dorośli, zwłaszcza osoby z nadciśnieniem albo po 40. roku życia",
  "keywords": ["cisnieni*", "pomiar* cisnieni*", "cisnieniomierz*", "nadcisnieni*", "mankiet*"],
  "questions": [
    "Jak prawidłowo zmierzyć ciśnienie w domu?",
    "Jakie ciśnienie jest za wysokie?",
    "Czy ciśnieniomierz na nadgarstek jest dobry?"
  ],
  "summary": "1–2 zdania: co to jest i po co.",
  "answer": "Odpowiedź czatu: 3–6 krótkich zdań w tonie Doco (ciepło, konkretnie, na „ty”). Najważniejsze liczby i kiedy iść do lekarza.",
  "facts": [
    { "text": "Jedno sprawdzalne twierdzenie, najlepiej z liczbą.", "sources": ["s1"] }
  ],
  "selfCare": ["Co możesz zrobić sam, jeden punkt = jedna czynność."],
  "warningSigns": [
    { "sign": "Ciśnienie 180/120 lub wyższe z bólem w klatce piersiowej, dusznością albo zaburzeniami mowy", "triage": "emergency", "action": "Dzwoń pod 112." }
  ],
  "related": ["bol-glowy"],
  "sources": [
    { "id": "s1", "title": "2023 ESH Guidelines for the management of arterial hypertension", "publisher": "European Society of Hypertension", "url": "https://...", "year": 2023 }
  ],
  "review": {
    "researched": "2026-10-03", "verified": "2026-10-03", "tested": "2026-10-03",
    "claims": { "confirmed": 0, "corrected": 0, "removed": 0, "unverifiable": 0 },
    "tests": { "passed": 0, "total": 0 },
    "revisions": 0
  }
}
```

Pola:

- `id`: kebab-case, bez polskich znaków, taki sam jak w `tematy.json`.
- `domain`: `psychika` | `objawy` | `sport` | `samobadanie` | `profilaktyka`.
- `tier`: 1 = popularne (pyta prawie każdy), 2 = średnio zaawansowane, 3 = specjalistyczne.
- `keywords`: co najmniej 4 frazy, po których czat rozpozna temat. Zapis jak po `normalize()` z `offline-companion.js`: małe litery, bez polskich znaków (ł → l), tylko `a-z`, cyfry, spacje i `*`. Gwiazdka na końcu słowa łapie końcówki odmiany: `cisnieni*` pasuje do „ciśnienie”, „ciśnienia”, „ciśnieniu”. Frazy mają być specyficzne dla tematu. Nie dawaj samych słów z codziennych emocji („zmeczony”, „stres”, „smutno”), bo z nimi radzi sobie rozmowa Doco; przy temacie emocjonalnym dawaj frazy pytające o wiedzę („atak* paniki”, „objawy depresji”).
- `questions`: co najmniej 3 realne pytania użytkownika w naturalnym polskim, z polskimi znakami. Test sprawdza, że każde trafia do tego wpisu.
- `answer`: bez HTML, bez linków, bez emotek. Najwyżej ok. 700 znaków.
- `facts`: co najmniej 3 atomowe twierdzenia, każde z co najmniej jednym `sources` (id ze `sources` wpisu). Liczby, progi i zalecenia muszą być w `facts`.
- `warningSigns`: co najmniej 1. Pilność rośnie z wagą sygnału.
- `related`: id innych tematów z `tematy.json` (może być pusto).
- `sources`: co najmniej 2, `url` tylko `https://`, unikalne `id` (`s1`, `s2`...).
- `review`: wypełnia archiwista na podstawie plików roboczych. Do bazy trafiają tylko wpisy z `tests.passed === tests.total`.

Sprawdzenie formatu: `node tools/wiedza/sprawdz.mjs <plik>` (wpis roboczy albo cała baza). Test czatu z bazą: `node tools/wiedza/wiedza.test.mjs`.

## Pliki robocze

`1-badanie.json` (badacz):

```json
{ "topic": { "id": "...", "name": "...", "domain": "...", "tier": 2 },
  "researchedAt": "RRRR-MM-DD", "revision": 0,
  "entry": { "...": "wpis bez pola review" },
  "notes": "tło dla weryfikatora: kontrowersje, różnice między wytycznymi, polskie realia, czego nie udało się ustalić",
  "claims": [ { "claim": "twierdzenie", "sourceIds": ["s1"], "quote": "krótki cytat albo parafraza ze źródła" } ] }
```

`2-weryfikacja.json` (weryfikator):

```json
{ "verifiedAt": "RRRR-MM-DD", "verdict": "approved | corrected | rejected", "summary": "...",
  "checks": [ { "claim": "...", "status": "confirmed | corrected | removed | unverifiable", "source": "https://...", "note": "co było → co jest" } ],
  "entry": { "...": "wpis po poprawkach weryfikatora" } }
```

`3-test.json` (tester):

```json
{ "testedAt": "RRRR-MM-DD", "verdict": "pass | fail",
  "tests": [ { "name": "...", "kind": "scenariusz | wykonanie | zrozumialosc | bezpieczenstwo | spojnosc | kompletnosc | czat", "passed": true, "detail": "..." } ],
  "fixesApplied": ["poprawki redakcyjne testera"],
  "blockingIssues": ["zmiany treści medycznej, które muszą wrócić do badacza"],
  "entry": { "...": "wpis po poprawkach redakcyjnych" } }
```

Przy poprawce badacz nadpisuje `1-badanie.json` (z `revision` + 1), a poprzednie wersje plików przenosi do `tools/wiedza/robocze/<id>/archiwum/` z numerem poprawki w nazwie.
