# Baza wiedzy czatu Soleil

Soleil na GitHub Pages nie ma serwera AI, więc rozmawia z użytkownikiem czat offline (`soleil-main/offline-companion.js`). Gdy ktoś pyta o konkretny temat zdrowotny („jak zmierzyć ciśnienie?”, „co na ból głowy?”), czat odpowiada z bazy `soleil-main/data/wiedza.json`: krótko, w tonie Soleil, z sygnałami alarmowymi (112) i linkami do źródeł. Każdy wpis przed trafieniem do bazy przechodzi przez czterech agentów: zebranie wiedzy, sprawdzenie faktów, testy i zapis.

## Zespół

| Agent | Plik | Co robi |
|---|---|---|
| 1. badacz | [`.claude/agents/badacz.md`](../.claude/agents/badacz.md) | zbiera wiedzę od podstaw po szczegóły specjalistyczne z wytycznych, instytucji i publikacji; prowadzi mapę tematów |
| 2. weryfikator | [`.claude/agents/weryfikator.md`](../.claude/agents/weryfikator.md) | sprawdza każde twierdzenie w źródłach, poprawia błędy, może odrzucić wpis |
| 3. tester | [`.claude/agents/tester.md`](../.claude/agents/tester.md) | testuje wpis jak produkt: scenariusze, progi, bezpieczeństwo, język, spójność i to, czy czat go znajduje |
| 4. archiwista | [`.claude/agents/archiwista.md`](../.claude/agents/archiwista.md) | zapisuje zaakceptowane wpisy do bazy, uruchamia walidator i testy, prowadzi raport poniżej |

Wspólne zasady, format wpisu i plików roboczych: [`tools/wiedza/ZASADY.md`](../tools/wiedza/ZASADY.md). Lista tematów od najpopularniejszych (tier 1) po specjalistyczne (tier 3) w pięciu dziedzinach (psychika, objawy, sport, samobadanie, profilaktyka): [`tools/wiedza/tematy.json`](../tools/wiedza/tematy.json).

Jeśli weryfikator odrzuci wpis albo tester zgłosi problem z treścią medyczną, wpis wraca do badacza, najwyżej 2 razy. Wpis, który nie przejdzie, nie trafia do bazy, tylko do raportu.

## Jak uruchomić

W katalogu repo uruchom Claude Code (`claude`) i wpisz:

```
/baza-wiedzy goraczka zakwasy atak-paniki
```

Bez argumentów komenda bierze kilka kolejnych tematów `do-zbadania` z `tematy.json`, od najniższego tieru. Agentów można też wołać pojedynczo, np. „@badacz rozbuduj mapę tematów o dermatologię”. Nic nie trafia na GitHuba samo: agenci nie robią commitów, zmiany zostają lokalnie do przejrzenia.

Sprawdzenie bazy ręcznie:

```bash
node tools/wiedza/sprawdz.mjs                 # format bazy i listy tematów
node tools/wiedza/wiedza.test.mjs             # czat znajduje każdy wpis, kryzys i 112 mają pierwszeństwo
node tools/soleil/offline-companion.test.mjs  # rozmowa Soleil bez zmian
```

## Jak czat korzysta z bazy

Kolejność w `offline-companion.js`: 1) sygnały kryzysu psychicznego (zawsze numery pomocy), 2) pilne objawy (112), 3) napaść seksualna i przemoc w domu (własne odpowiedzi z 112 i numerami pomocy), 4) **pytanie o temat z bazy**, 5) rozmowa o emocjach. Wpis odpowiada, gdy wiadomość trafia w jego `keywords` i jest pytaniem („jak…”, „co robić…”, „czy…”, „czego…”, znak zapytania), hasłem („objawy depresji”, „depresja objawy”, „test na depresję”, „adhd a depresja”) albo samą nazwą tematu („rabdomioliza”). Bez pytania do bazy trafiają też wiadomości, przy których sprawdzone fakty są lepsze niż rozmowa: czyjaś śmierć („smutno mi, bo zmarł dziadek”), strach o bliską osobę („boję się, że brat coś sobie zrobi”), lęk przed skrzywdzeniem dziecka („boję się, że skrzywdzę dziecko”) i nazwa leku uspokajającego („xanax przed egzaminem”). Zwykłe zwierzenia („nie mogę spać”, „boli mnie głowa”), kafelki tematów i buźki nastroju zostają w rozmowie Soleil. Baza ładuje się w tle; gdy jej nie ma, czat działa jak wcześniej.

### Zmiany w czacie przy serii o zdrowiu psychicznym (2026-10-04)

Badacze i testerzy tej serii znaleźli wiadomości, na które czat odpowiadał źle albo wcale. Koordynator poprawił `offline-companion.js`; każdy przypadek jest w `tools/soleil/offline-companion.test.mjs`.

- **Kryzys (numery 112, 116 123, 800 70 2222, 116 111):** „lepiej by było nie żyć”, „lepiej żebym nie żył”, „wolałabym nie istnieć”, „chciałabym zniknąć”, „czasem myślę o śmierci”, „chcę dołączyć do mamy” (po jej śmierci), „chciałabym już być z mężem”. Zamiar skrzywdzenia dziecka („chcę skrzywdzić dziecko”, „uduszę dziecko”, „zabiję dziecko, jak nie przestanie płakać”, „głosy każą mi skrzywdzić dziecko”) dostaje dodatkowo pierwszy krok: połóż dziecko w bezpiecznym miejscu, wyjdź na chwilę z pokoju, zadzwoń do kogoś, a gdy dziecku grozi niebezpieczeństwo, 112. Gdy wiadomość kryzysowa dotyczy bliskiej osoby („mój syn mówi, że chce się zabić”), odpowiedź dostaje zdanie dla tego, kto się martwi: 112, nie zostawiaj jej samej, pod 800 70 2222 i 116 123 możesz zapytać, jak pomóc (potwierdzone przez weryfikatora na stronach operatorów).
- **Pilne objawy (112):** kołatanie serca, które nie mija („serce mi wali od 20 minut i nie przestaje”), „ciężko mi oddychać”, nagłe splątanie („tata nagle jest splątany”, „mama nagle nie wie, gdzie jest”), przedawkowanie konkretnego leku („wzięłam 10 tabletek sertraliny”, „całe opakowanie”), dziecko, które coś połknęło, leki uspokajające lub nasenne wzięte razem z alkoholem („wziąłem 3 tabletki alprazolamu i wypiłem 2 piwa”; pytanie zadane wcześniej, „czy mogę wypić wino, biorąc xanax?”, idzie do wpisu o lęku), potrząśnięte niemowlę (112 albo SOR, nawet jeśli dziecko wygląda dobrze).
- **Przemoc w domu** („mąż mnie bije”, „ojczym się nade mną znęca”, „partner mi grozi, że mnie zabije”): 112, Niebieska Linia 800 120 002 (całą dobę, bezpłatnie), dzieci i młodzież 116 111.
- **Napaść seksualna** („zostałam zgwałcona”, „szef mnie molestuje”, „co robić po gwałcie?”): to nie twoja wina, 112, jak najszybciej SOR (leki chroniące przed HIV w ciągu 72 godzin, antykoncepcja awaryjna w ciągu 3–5 dni), Linia Pomocy Pokrzywdzonym 116 006. Treść pochodzi ze zweryfikowanego wpisu `ptsd`.
- Czat dalej woli zareagować za mocno niż za słabo: np. „myślę o śmierci i boję się jej” dostaje numery pomocy, a „bili mnie w szkole” odpowiedź o przemocy.

## Stan bazy

<!-- raport:start -->
Stan na **2026-10-04**: **16 wpisów** (4 z pilota i 12 z serii o zdrowiu psychicznym). Wszystkie przeszły weryfikację i testy.

- Dziedziny: psychika 13, objawy 1, samobadanie 1, sport 1, profilaktyka 0.
- Poziomy: tier 1: 6 (ból głowy, bezsenność, lęk i niepokój, obniżony nastrój, stres na co dzień, stres przed egzaminem), tier 2: 6 (atak paniki, gdzie szukać pomocy, jak pomóc osobie w kryzysie, wypalenie zawodowe, żałoba, pomiar ciśnienia), tier 3: 4 (depresja poporodowa, PTSD, zaburzenia odżywiania, rabdomioliza wysiłkowa).
- Razem w ostatnich rundach: 1461 kontroli twierdzeń (1272 potwierdzone, 182 poprawione, 4 usunięte, 3 niesprawdzalne) i 396 testów, wszystkie zaliczone.
- Sprawdzenia po scaleniu i redakcji archiwisty: `sprawdz.mjs` OK (7 uwag o długości answer, niżej), `wiedza.test.mjs` OK (296 pytań trafia do swojego wpisu, kryzys i 112 mają pierwszeństwo, kafelki i buźki czatu zostają rozmową), `offline-companion.test.mjs` OK, `tools/wiedza/robocze/pytania-sporne.mjs --wszystkie` OK (wynik niżej).

| Temat | Dziedzina | Tier | Twierdzenia: potwierdzone / poprawione / usunięte / niesprawdzalne | Testy | Poprawki |
|---|---|---|---|---|---|
| Ból głowy: rodzaje, domowe sposoby i sygnały alarmowe (`bol-glowy`) | objawy | 1 | 79 / 5 / 0 / 0 | 28/28 | 2 |
| Bezsenność i higiena snu (`bezsennosc`) | psychika | 1 | 119 / 3 / 0 / 0 | 30/30 | 2 |
| Lęk i niepokój: kiedy to norma, a kiedy zaburzenie (`lek-i-niepokoj`) | psychika | 1 | 91 / 6 / 1 / 0 | 31/31 | 1 |
| Obniżony nastrój czy już depresja (`obnizony-nastroj-czy-depresja`) | psychika | 1 | 88 / 22 / 0 / 0 | 25/25 | 0 |
| Stres na co dzień i jak go obniżyć (`stres-na-co-dzien`) | psychika | 1 | 87 / 2 / 0 / 0 | 23/23 | 1 |
| Stres przed egzaminem i wystąpieniem (`stres-przed-egzaminem`) | psychika | 1 | 58 / 20 / 0 / 1 | 22/22 | 0 |
| Atak paniki: co robić w trakcie i po (`atak-paniki`) | psychika | 2 | 114 / 5 / 0 / 0 | 27/27 | 1 |
| Gdzie szukać pomocy psychologicznej w Polsce (NFZ, CZP, telefony) (`gdzie-szukac-pomocy-psychologicznej`) | psychika | 2 | 50 / 11 / 3 / 0 | 22/22 | 0 |
| Jak pomóc bliskiej osobie w kryzysie psychicznym (`jak-pomoc-osobie-w-kryzysie`) | psychika | 2 | 49 / 19 / 0 / 0 | 21/21 | 0 |
| Wypalenie zawodowe (`wypalenie-zawodowe`) | psychika | 2 | 60 / 19 / 0 / 0 | 21/21 | 0 |
| Żałoba i strata bliskiej osoby (`zaloba`) | psychika | 2 | 84 / 12 / 0 / 0 | 23/23 | 0 |
| Depresja poporodowa (`depresja-poporodowa`) | psychika | 3 | 102 / 15 / 0 / 0 | 26/26 | 0 |
| Zespół stresu pourazowego (PTSD) (`ptsd`) | psychika | 3 | 71 / 15 / 0 / 1 | 25/25 | 0 |
| Zaburzenia odżywiania: sygnały ostrzegawcze (`zaburzenia-odzywiania`) | psychika | 3 | 101 / 14 / 0 / 0 | 24/24 | 0 |
| Domowy pomiar ciśnienia tętniczego (`pomiar-cisnienia`) | samobadanie | 2 | 75 / 5 / 0 / 1 | 25/25 | 1 |
| Rabdomioliza wysiłkowa (`rabdomioliza-wysilkowa`) | sport | 3 | 44 / 9 / 0 / 0 | 23/23 | 0 |

Twierdzenia są liczone z ostatniej rundy weryfikacji. Przy tematach z poprawką ta runda objęła wszystkie twierdzenia, a te, które nie zmieniły się od poprzedniej rundy, dostały w niej status „potwierdzone”. Dlatego liczby poprawek w tabeli są małe. We wszystkich rundach razem weryfikator dał status „poprawione” albo „usunięte” (poprawione / usunięte): ból głowy 32 razy (31 / 1), bezsenność 23 (22 / 1), pomiar ciśnienia 19 (17 / 2), rabdomioliza 9 (9 / 0), stres na co dzień 22 (21 / 1), lęk i niepokój 23 (22 / 1), atak paniki 20 (20 / 0). Pozostałe tematy serii miały jedną rundę.

### Historia poprawek

- **Rabdomioliza wysiłkowa:** 1 runda (r0). Tester przepuścił wpis od razu (23/23), bez blokerów.
- **Pomiar ciśnienia:** 2 rundy (r0, r1). Bloker r0: objawy udaru (opadający kącik ust, słabsza ręka, bełkotliwa mowa) kierowały pod 112 tylko przy ciśnieniu od 180/110. W r1 pierwszy sygnał emergency to udar albo niemijający ból w klatce → 112 przy każdym wyniku.
- **Ból głowy:** 3 rundy (r0–r2). Blokery r0: czad u osoby mieszkającej samotnie nie trafiał do żadnego sygnału alarmowego (sygnał wymagał kilku chorych domowników); answer nie ostrzegał przed ibuprofenem w ciąży ani aspiryną u dzieci; typowa aura migreny kłóciła się z sygnałami 112. Bloker r1: czat nie pokazywał ostrzeżenia o stanie przedrzucawkowym (silny, niemijający ból głowy w ciąży → szpital).
- **Bezsenność:** 3 rundy (r0–r2). Blokery r0: brak przeciwwskazań melatoniny (młodzież, choroby wątroby i nerek); answer nie odpowiadał na pytanie o melatoninę; brak sygnału 112 dla bólu w klatce i nagłej duszności w nocy; luki czatu w wykrywaniu kryzysu (do człowieka). Blokery r1: brak sygnałów o przedawkowaniu leku nasennego lub melatoniny, o osobie, której nie da się dobudzić albo która oddycha wolno lub płytko, i o dziecku, które połknęło lek; kolejne luki czatu.
- **Stres na co dzień:** 2 rundy (r0, r1). W r0 weryfikator: 68 / 19 / 1 / 0, tester: 19/21, jeden bloker. Answer (jedyny tekst wpisu, który czat pokazuje, poza 3 sygnałami 112) nie odpowiadał na pytania trafiające do wpisu: brakowało ostrzeżenia GIS przed ashwagandhą (ciąża, karmienie, leki nasenne i uspokajające) i czegokolwiek o objawach stresu. W r1 weryfikator: 87 / 2 / 0 / 0, tester: 23/23.
- **Lęk i niepokój:** 2 rundy (r0, r1). W r0 weryfikator: 72 / 16 / 0 / 0, tester: 21/25, dwa blokery. Przy kołataniu serca brakowało progu „objawy minęły, więc pilnie do lekarza jeszcze dziś” (NHS), a sygnał gp nie zgadzał się z faktem. Answer nie mówił, że benzodiazepin nie wolno odstawiać nagle. W r1 weryfikator: 91 / 6 / 1 / 0, tester: 31/31.
- **Atak paniki:** 2 rundy (r0, r1). W r0 weryfikator: 92 / 15 / 0 / 0, tester: 20/24, dwa blokery. Astma i niedocukrzenie nie pojawiały się w odpowiedzi czatu. Zator płucny u osoby z zaburzeniem panicznym (nagła duszność, ciąża i połóg, antykoncepcja, długa podróż) nie miał sygnału. W r1 weryfikator: 114 / 5 / 0 / 0, tester: 27/27.
- **Pozostałe 9 tematów serii** (obniżony nastrój, stres przed egzaminem, wypalenie, żałoba, jak pomóc, gdzie szukać pomocy, depresja poporodowa, zaburzenia odżywiania, PTSD): 1 runda (r0), tester bez blokerów.

### Najważniejsze poprawki weryfikatora

- Rabdomioliza: silny ból z obrzękiem lub osłabieniem przy zwykłym moczu podniesiony z urgent do emergency (SOR), ból, który nie słabnie ponad 5–7 dni, z gp do urgent (CDC, CHAMP 2025).
- Rabdomioliza: zdanie ENMC o NLPZ dotyczyło choroby McArdle'a, więc wypadło; zakaz NLPZ dotyczy podejrzenia rabdomiolizy (CHAMP 2025); powrót do treningu tylko po decyzji lekarza.
- Pomiar ciśnienia: dobrzemierze.pl usunięte (serwis wydawnictwa komercyjnego), lista zwalidowanych aparatów opiera się na STRIDE BP; protokół z pełnego tekstu ESC 2024 (2 pomiary co 1–2 minuty, rano i wieczorem, 3–7 dni).
- Pomiar ciśnienia: przy 180/110 wystarczy jedna z liczb; w ciąży od 140/90 lekarz w ciągu doby (NICE NG201), od 160 albo 110 szpital.
- Pomiar ciśnienia: usunięte okno „3–4,5 godziny” przy udarze (ESO 2021: leczenie bywa możliwe później), żeby nikt nie rezygnował z 112; dodane objawy wstrząsu przy bardzo niskim ciśnieniu → 112.
- Ból głowy: dawki paracetamolu i ibuprofenu według polskich ChPL zamiast NHS (maksimum paracetamolu 3 albo 4 g zależnie od preparatu; ibuprofen na ból dłużej niż 3 dni tylko po rozmowie z lekarzem, a nie 10 dni).
- Ból głowy: aspiryna dzieciom i nastolatkom tylko z zalecenia lekarza, poniżej 12 lat przeciwwskazana (ChPL Aspirin); w ciąży ibuprofen tylko z zalecenia lekarza (w III trymestrze przeciwwskazany).
- Bezsenność: 116 123 działa całą dobę (116sos.pl); do psychologa z NFZ bez skierowania od 17.09.2025; usunięty schemat dawkowania leków nasennych na receptę.
- Bezsenność: przeciwwskazania melatoniny przypisane do konkretnych leków (Melabiorytm, LEK-AM, Circadin), bo ich ChPL się różnią; zasada „20 minut” złagodzona (liczba jest tylko w materiale AASM dla pacjentów).
- Bezsenność: w answer wróciło „na receptę” przy granicy 4 tygodni (bez recepty NHS daje 1–2 tygodnie); usunięta brytyjska reguła „dziecko poniżej 5 lat: zadzwoń”, która w Polsce wprowadzała w błąd.
- Stres na co dzień: do answer dopisane ostrzeżenie GIS o ashwagandzie (dzieci, ciąża, karmienie, leki nasenne, uspokajające, przeciwpadaczkowe). Wróciło zdanie „Nie sięgaj po alkohol ani cudze leki uspokajające”. Działanie oddechu, ruchu i uważności opisane jako małe lub umiarkowane.
- Obniżony nastrój: usunięte niepotwierdzone „70% po pierwszym leku”, fototerapia już nie jako „najskuteczniejsza” (NICE: dowody niepewne), zespół serotoninowy opisany jako kilka objawów naraz (112), leki przeciwdepresyjne „nie uzależniają tak jak narkotyki”, ale mogą dawać objawy odstawienne.
- Lęk i niepokój: omdlenie przy kołataniu serca to 112 także po odzyskaniu przytomności (ESC 2018, NHS). Doszło „uczucie omdlewania”. Potwierdzony nowy sygnał urgent na sytuację, w której objawy już minęły (NHS). „Przychodnia zamknięta” obejmuje też dni wolne (soboty).
- Stres przed egzaminem: usunięte „propranolol działa po kilku godzinach” (czytało się jak instrukcja), astma podana jako przeciwwskazanie. Sygnał 112 po leku na tremę: ktoś mdleje lub traci przytomność albo wziął więcej, niż zalecił lekarz; przy podejrzeniu zatrucia 112 bez czekania na objawy i bez wywoływania wymiotów. Psycholog z NFZ bez skierowania także dla dorosłych.
- Atak paniki: nagła duszność w ciąży i po porodzie oznacza pomoc od razu (RCOG). „Masz cukrzycę?” zmienione na „Bierzesz insulinę lub leki na cukrzycę?”. Brak inhalatora przy duszności to 112.
- Wypalenie zawodowe: o L4 decyduje lekarz po badaniu, a psycholog go nie wystawia (art. 54 ustawy zasiłkowej). Usunięte polskie nazwy kodów ICD-11. W sygnale urgent nierealne „psychiatra jeszcze dziś” zastąpione drogą przez lekarza rodzinnego, CZP albo izbę przyjęć.
- Żałoba: progi przedłużonej żałoby potwierdzone (ICD-11: 6 miesięcy, DSM-5-TR: 12 miesięcy u dorosłych). Terapia żałoby już nie jako „najskuteczniejsza”. U większości ból łagodnieje po 6–12 miesiącach, bez stałych etapów. Opieka położnej po poronieniu według standardu z 2026 r.
- Jak pomóc osobie w kryzysie: 800 100 100 nie działa całą dobę, a dyżur pedagoga lub psychologa jest tylko w pn i śr 10–14. Usunięte szczegóły metod samookaleczenia (WHO 2023). CZP tylko dla dorosłych.
- Gdzie szukać pomocy: usunięte dwie strony pacjent.gov.pl, które wciąż piszą o skierowaniu do psychologa (nieaktualne od 17.09.2025), i blog. Z sygnału urgent zniknęło „72 godziny”, bo mogło sugerować czekanie. Usunięta liczba CZP, bo szybko się starzeje.
- Depresja poporodowa: natrętne myśli o skrzywdzeniu dziecka podniesione z gp do urgent. Z sygnału 112 wypadło „boisz się, że możesz to zrobić”, bo to typowe natręctwo. Usunięte „dziecka się nie odbiera” (tylko źródła brytyjskie). Przy zuranolonie dopisane, że rejestracja w UE nie oznacza dostępności w Polsce.
- Zaburzenia odżywiania: wymioty z krwią to zawsze 112. Leczenie bez zgody opisane według ustawy o ochronie zdrowia psychicznego. Przy insulinie „nie pomijaj dawek” zamiast „nie odstawiaj całkowicie”.
- PTSD: dezorientacja i halucynacje po traumie podniesione z urgent do emergency (PFA). Potwierdzony numer 116 006 (od 1.09.2026). Dopisane okno 72 godzin na leki chroniące przed HIV po napaści.

### Redakcja archiwisty po scaleniu (keywords i questions, bez zmian treści medycznej)

- **PTSD:** z `questions` usunięte 3 pytania o świeżą napaść seksualną („Co robić po gwałcie?”, „Zgwałcił mnie znajomy, co mam teraz zrobić?”, „Ktoś dotykał mnie bez zgody, co teraz?”). Czat odpowiada teraz na takie wiadomości własnym komunikatem, który ma pierwszeństwo przed bazą (opis w sekcji koordynatora). Przez to `wiedza.test.mjs` nie przechodził. Frazy o gwałcie zostają w `keywords` dla pytań, których ten komunikat nie łapie („czy gwałt powoduje PTSD?”).
- **Pytania sporne testerów:** remisy i złe trafienia rozstrzygnięte nowymi frazami, a nie kolejnością wpisów.
  - `stres-przed-egzaminem`: 24 frazy „odstresow*/zrelaksow* (sie) przed egzamin*/matur*/sesj*/wystapieni*” i pytanie „Jak się odstresować przed egzaminem?”.
  - `ptsd`: „objaw* stresu pourazow*” i pytanie „Jakie są objawy stresu pourazowego?”.
  - `atak-paniki`: 8 fraz „przy/podczas/w trakcie/w czasie atak*/napad* panik*” i pytanie „Jakie ćwiczenia oddechowe pomagają przy ataku paniki?”.
  - `zaburzenia-odzywiania`: 8 fraz „przestal/przestala/przestalam/przestalem jesc przed/ze” i pytanie „Przestałam jeść przed sesją, co robić?”.
  - `lek-i-niepokoj`: 10 fraz o lekach uspokajających przed egzaminem lub wystąpieniem („uspokajaj* przed”, „xanax* przed”, „relanium* przed” i inne nazwy benzodiazepin, „uspokajaj* na trem*”) i 13 fraz porównujących lęk paniczny z uogólnionym. Do tego 3 pytania.
  - `obnizony-nastroj-czy-depresja`: 6 fraz „depresj*/nerwic* czy/a/od nerwic*/depresj*” i pytanie „Depresja czy nerwica?”.
  - `zaloba`: 10 fraz („wspomnieni* o zmarl*”, „wspomnieni* o smierc*”, depresja poporodowa a poronienie, „po strac* ciaz*”) i 2 pytania.
  - Wpisy pilota bez zmian.
- **Kontrola:** skrypty kolizji 12 testerów (`kolizje.mjs`) uruchomione na kopii, w której szkice zastąpiłem wpisami po scaleniu, nie pokazały żadnego nowego problemu, a remisy z ich list się rozstrzygnęły. Zostały tylko te same zgłoszenia co przed scaleniem, wynikające z kodu czatu (np. odpowiedzi 112, kryzysowa i o napaści mają pierwszeństwo przed bazą). Jedno odstępstwo od oczekiwania testera lęku: „czy mogę wziąć tabletkę uspokajającą przed egzaminem?” trafia do lęku i niepokoju, a nie do stresu przed egzaminem, zgodnie z decyzją koordynatora (ten wpis ma ostrzeżenia o lekach).

### Pytania sporne

Skrypt `tools/wiedza/robocze/pytania-sporne.mjs` przepuszcza pytania przez czat w dwóch kolejnościach wpisów (różny wynik oznacza remis). Wynik:

| Pytanie | Trafia do (punkty) | Uwagi |
|---|---|---|
| jak się odstresować przed egzaminem | stres przed egzaminem (8:3) | wcześniej stres na co dzień (1:3) |
| objawy stresu pourazowego | PTSD (5:2) | wcześniej remis ze stresem na co dzień |
| ćwiczenia oddechowe przy ataku paniki | bez „?”: rozmowa (lęk, ćwiczenie „nazwij pięć rzeczy”); z „?” albo „jakie…”: atak paniki (5:2) | wcześniej remis ze stresem na co dzień |
| przestałam jeść przed sesją | bez „?”: rozmowa (szkoła i praca); z „?”: zaburzenia odżywiania (5:2) | Przestanie jedzenia to sygnał ostrzegawczy z tego wpisu („głodzenie się”, „idź szybko do lekarza”), a wpis o egzaminie o jedzeniu milczy. „Nie mogę nic zjeść przed egzaminem” zostaje przy stresie przed egzaminem. |
| czy lęk paniczny to to samo co lęk uogólniony? | lęk i niepokój (5:2) | Wpis przeglądowy, a fakt wymienia oba jako osobne zaburzenia lękowe. „Co to jest lęk paniczny?” dalej trafia do ataku paniki. |
| xanax przed egzaminem; tabletka uspokajająca przed egzaminem | bez „?”: rozmowa (szkoła i praca); z „?”: lęk i niepokój (3:1) | wcześniej remis ze stresem przed egzaminem |
| depresja czy nerwica? | obniżony nastrój czy depresja (4:1) | Answer podaje kryteria depresji (2 tygodnie) i mówi, gdzie iść. Samo „nerwica” zostaje przy lęku i niepokoju. |
| jak odróżnić żałobę od depresji? | żałoba (4:1) | bez zmian |
| czy depresja poporodowa może być po poronieniu? | żałoba (5:2) | Answer żałoby mówi o poronieniu (psycholog w szpitalu) i nie zakłada, że dziecko żyje. Wpis o depresji poporodowej (baby blues, karmienie, myśli o dziecku) nie opisuje poronienia. |
| czy po śmierci dziecka mogę mieć PTSD? | żałoba (4:1) | Bez zmian. Answer zaczyna od straty i kieruje do psychologa przy przedłużonej żałobie, a fakty mówią o większym ryzyku po śmierci dziecka. Samo „czy mogę mieć PTSD?” trafia do PTSD. |
| natrętne wspomnienia o zmarłym tacie | żałoba (4:2) | wcześniej PTSD (1:2) |
| wypalenie kurzajki | bez „?”: rozmowa (zmęczenie); z „?”: wypalenie zawodowe (1 punkt) | **Wyjątek.** Nie da się tego naprawić bez psucia innych pytań: „ile trwa wypalenie?”, „co pomaga na wypalenie?”, „mam wypalenie, co robić?”, „jak leczyć wypalenie?” i podobne trafiają do wpisu tylko dzięki samemu „wypaleni*”, a te same ramy pasują do kurzajki. Rozwiąże to dopiero wpis o kurzajkach. |

Poza tym 35 innych sformułowań tych pytań trafia jednoznacznie, a wszystkie 296 `questions` trafiają do swoich wpisów w obu kolejnościach bazy (bez remisów). Pięć wiadomości bez znaku zapytania (oznaczonych wyżej „bez »?«”) zawiera słowo z tematów rozmowy (egzamin, sesja, panika, wypalenie), więc czat nie wpuszcza ich do bazy. Tego nie da się zmienić danymi.

### Długość odpowiedzi (answer ponad 700 znaków)

Treści medycznej nie skracałem. Ponad zalecane 700 znaków mają: ból głowy 759, atak paniki 755, gdzie szukać pomocy 749, stres przed egzaminem 747, stres na co dzień 719, lęk i niepokój 713, depresja poporodowa 711 (żałoba i bezsenność mają równo 700). Powód jest wszędzie ten sam: czat pokazuje tylko answer i 3 pierwsze sygnały 112, więc w answer musiały się zmieścić zdania ważne dla bezpieczeństwa. Przy bólu głowy to stan przedrzucawkowy i czad (zgoda koordynatora z pilota), przy ataku paniki astma, insulina i nagła duszność w ciąży, przy lęku zakaz nagłego odstawiania benzodiazepin, przy stresie na co dzień ostrzeżenia o ashwagandzie, przy depresji poporodowej numer 116 111, a przy gdzie szukać pomocy i stresie przed egzaminem odpowiedzi na pytania z `questions`. Walidator zgłasza to jako uwagę, nie błąd.

### Do przeglądu

- Stres przed egzaminem: 3 fakty z datami CKE dla matury 2027. Odświeżyć przed maturą 2028 (dokumenty CKE wychodzą zwykle w sierpniu). Fakt o zakazie sprzedaży energetyków nieletnim nie wszedł, bo zabrakło otwartego źródła (1 niesprawdzalne).
- Gdzie szukać pomocy: pilotaż CZP trwa do 31.12.2026, więc wpis trzeba sprawdzić w styczniu 2027.
- Wypalenie zawodowe: od 1.01.2027 zmieniają się zasady L4 przy kilku tytułach ubezpieczenia. Wpis jest aktualny na 2026 r.
- Żałoba: weryfikator zostawił do decyzji człowieka twierdzenia oparte tylko na poradniku Fundacji Hospicyjnej (s11).
- PTSD: nie udało się potwierdzić polskiej ścieżki po napaści seksualnej (izba przyjęć, leki chroniące przed HIV, antykoncepcja awaryjna), stąd 1 niesprawdzalne. To temat na osobny wpis z polskimi źródłami.

### Uwagi testerów na kolejne wersje (niewiążące)

- Rabdomioliza: dopisać w answer, że samo podwyższone CK bez objawów nie musi oznaczać choroby, i jak wyglądają zwykłe zakwasy.
- Pomiar ciśnienia: objawy wstrząsu przy bardzo niskim ciśnieniu (112) są tylko w faktach i w sygnale gp, czat ich nie pokazuje; rozważyć osobny sygnał emergency.
- Ból głowy: podzielić długie zdanie z listą powodów do 112, skrócić sygnał o czadzie, dopisać wymioty do sygnału dla ciąży (NHS).
- Bezsenność: dopisać złożone zachowania we śnie po lekach „Z” (chodzenie, jazda autem), rady dla pracujących na zmiany i przedawkowanie leków nasennych bez recepty wprost w sygnale.
- Obniżony nastrój: pół zdania o nawrotach w answer; ewentualnie osobny temat „leki przeciwdepresyjne”.
- Lęk i niepokój: zdanie o ciąży i karmieniu (każdy lek i zioło uzgodnić z lekarzem) oraz o upadkach seniorów po benzodiazepinach.
- Stres przed egzaminem: limit kofeiny w ciąży (EFSA: 200 mg) i od jakiego wieku liczyć limit dorosłego; rady dla rodzica w answer.
- Atak paniki: przy pomiarze cukru dopisać w answer „jeśli możesz”, jak w sygnale.
- Wypalenie zawodowe: zasiłek przy działalności gospodarczej (przy przeglądzie w 2027 r.).
- Żałoba: 116 111 także jako zwykła linia rozmowy dla młodzieży, nie tylko przy myślach samobójczych.
- Jak pomóc osobie w kryzysie: w sygnale o psychozie dopisać, że po porodzie to stan nagły; dla nieletnich wskazać ośrodki I poziomu.
- Depresja poporodowa: pół zdania o chorobie afektywnej dwubiegunowej i o tym, że szukanie pomocy to dbanie o dziecko; sytuacja „dziecko już zostało potrząśnięte”.
- Zaburzenia odżywiania: zdanie o pomijaniu insuliny w answer; dysmorfia mięśniowa to osobny temat.
- PTSD: w answer wprost „debriefing nie jest zalecany”; w sygnale o przemocy dopisać „lub wobec twojego dziecka”.
- Uwagi testerów do kodu czatu są w plikach `3-test.json` tej serii i trafiają do koordynatora. Raport ich nie powtarza.

### Zmiany w czacie przy okazji pilota

Testerzy znaleźli luki w wykrywaniu kryzysu i stanów nagłych w `soleil-main/offline-companion.js`, a koordynator je poprawił. Czat rozpoznaje teraz myśli samobójcze związane ze snem i tabletkami („chcę zasnąć i się nie obudzić”, „obym się jutro nie obudziła”, „wezmę wszystkie tabletki nasenne naraz”, „ile tabletek trzeba, żeby umrzeć”) i podaje numery kryzysowe. Do 112 kieruje przedawkowanie i nieprzytomność, także u innej osoby („przedawkowałem leki nasenne”, „nie mogę dobudzić mamy po tabletkach nasennych”, „tata wziął tabletkę nasenną i oddycha bardzo wolno”, „dziecko zjadło tabletki na sen”), ból w klatce w różnych sformułowaniach („boli mnie w klatce piersiowej”, „kłuje mnie w klatce”), duszność („budzę się z dusznością”, „się duszę”, „dusi mnie kaszel”) i objawy udaru („mamie opada kącik ust”, „tata nagle mówi niewyraźnie”). „Żeby” nie jest już mylone z „zęby”. Przypadki są w `tools/soleil/offline-companion.test.mjs`. Po raporcie archiwisty doszły jeszcze „krzywa buzia” i „tata nie reaguje” (112). Czat przy wątpliwościach woli zareagować za mocno: np. „mam nadzieję, że się nie obudzę z bólem głowy” dostaje numery pomocy.

### Tematy, które nie weszły

- **ADHD u dorosłych** (`adhd-u-doroslych`): w toku, trwa druga poprawka (r2). W r0 tester dał `fail` (16/20, 3 blokery), w r1 też `fail` (19/24) z dwoma blokerami: nagłe splątanie (112) i tiki po leku są tylko w sygnałach, których czat nie pokazuje, więc na pytanie „mama nagle nie wie, gdzie jest, czy to ADHD?” czat radzi lekarza rodzinnego zamiast 112, a pytania o tiki po leku zostają bez odpowiedzi. Dopisanie obu zdań wydłużyłoby answer do ok. 790 znaków, więc decyzja wróciła do badacza (`1-badanie.json` ma już `revision: 2`). Status zostaje `w-toku`, koordynator doda temat osobno.

Pozostałe 12 tematów serii ma w `3-test.json` werdykt `pass`, zero blokerów i wszystkie testy zaliczone, a weryfikator żadnego nie odrzucił.
<!-- raport:end -->
