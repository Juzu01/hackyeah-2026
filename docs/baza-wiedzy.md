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

Kolejność w `offline-companion.js`: 1) sygnały kryzysu psychicznego (zawsze numery pomocy), 2) pilne objawy (112), 3) **pytanie o temat z bazy**, 4) rozmowa o emocjach. Wpis odpowiada, gdy wiadomość trafia w jego `keywords` i jest pytaniem („jak…”, „co robić…”, „czy…”, znak zapytania) albo samą nazwą tematu („rabdomioliza”). Zwykłe zwierzenia („nie mogę spać”, „boli mnie głowa”) zostają w rozmowie Soleil. Baza ładuje się w tle; gdy jej nie ma, czat działa jak wcześniej.

## Stan bazy

<!-- raport:start -->
Stan na **2026-10-03** (pilot): **4 wpisy**, wszystkie przeszły weryfikację i testy.

- Dziedziny: objawy 1, psychika 1, samobadanie 1, sport 1, profilaktyka 0.
- Poziomy: tier 1: 2 (ból głowy, bezsenność), tier 2: 1 (pomiar ciśnienia), tier 3: 1 (rabdomioliza wysiłkowa).
- Sprawdzenia: `sprawdz.mjs` OK (jedna uwaga: answer bólu głowy ma 759 znaków), `wiedza.test.mjs` OK (każde pytanie trafia do swojego wpisu, kryzys i 112 mają pierwszeństwo), `offline-companion.test.mjs` OK.

| Temat | Dziedzina | Tier | Twierdzenia: potwierdzone / poprawione / usunięte / niesprawdzalne | Testy | Poprawki |
|---|---|---|---|---|---|
| Ból głowy: rodzaje, domowe sposoby i sygnały alarmowe (`bol-glowy`) | objawy | 1 | 79 / 5 / 0 / 0 | 28/28 | 2 |
| Bezsenność i higiena snu (`bezsennosc`) | psychika | 1 | 119 / 3 / 0 / 0 | 30/30 | 2 |
| Domowy pomiar ciśnienia tętniczego (`pomiar-cisnienia`) | samobadanie | 2 | 75 / 5 / 0 / 1 | 25/25 | 1 |
| Rabdomioliza wysiłkowa (`rabdomioliza-wysilkowa`) | sport | 3 | 44 / 9 / 0 / 0 | 23/23 | 0 |

Twierdzenia są liczone z ostatniej rundy weryfikacji. Twierdzenia sprawdzone we wcześniejszych rundach przechodzą do niej jako potwierdzone, więc liczby poprawek w tabeli są małe. We wszystkich rundach razem weryfikator dał status „poprawione” albo „usunięte”: ból głowy 32 razy (31 / 1), bezsenność 23 (22 / 1), pomiar ciśnienia 19 (17 / 2), rabdomioliza 9 (9 / 0).

### Historia poprawek

- **Rabdomioliza wysiłkowa:** 1 runda (r0). Tester przepuścił wpis od razu (23/23), bez blokerów.
- **Pomiar ciśnienia:** 2 rundy (r0, r1). Bloker r0: objawy udaru (opadający kącik ust, słabsza ręka, bełkotliwa mowa) kierowały pod 112 tylko przy ciśnieniu od 180/110. W r1 pierwszy sygnał emergency to udar albo niemijający ból w klatce → 112 przy każdym wyniku.
- **Ból głowy:** 3 rundy (r0–r2). Blokery r0: czad u osoby mieszkającej samotnie nie trafiał do żadnego sygnału alarmowego (sygnał wymagał kilku chorych domowników); answer nie ostrzegał przed ibuprofenem w ciąży ani aspiryną u dzieci; typowa aura migreny kłóciła się z sygnałami 112. Bloker r1: czat nie pokazywał ostrzeżenia o stanie przedrzucawkowym (silny, niemijający ból głowy w ciąży → szpital).
- **Bezsenność:** 3 rundy (r0–r2). Blokery r0: brak przeciwwskazań melatoniny (młodzież, choroby wątroby i nerek); answer nie odpowiadał na pytanie o melatoninę; brak sygnału 112 dla bólu w klatce i nagłej duszności w nocy; luki czatu w wykrywaniu kryzysu (do człowieka). Blokery r1: brak sygnałów o przedawkowaniu leku nasennego lub melatoniny, o osobie, której nie da się dobudzić albo która oddycha wolno lub płytko, i o dziecku, które połknęło lek; kolejne luki czatu.

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

### Wyjątek: długość odpowiedzi o bólu głowy

Answer bólu głowy ma ok. 760 znaków (759), więcej niż zalecane 700. Koordynator zgodził się na to ze względów bezpieczeństwa: czat pokazuje tylko answer i 3 pierwsze sygnały 112, więc w answer musiały się zmieścić ostrzeżenia o stanie przedrzucawkowym (także po porodzie) i o czadzie („wyjdź na powietrze”). Walidator zgłasza to jako uwagę, nie błąd.

### Uwagi testerów na kolejne wersje (niewiążące)

- Rabdomioliza: dopisać w answer, że samo podwyższone CK bez objawów nie musi oznaczać choroby, i jak wyglądają zwykłe zakwasy.
- Pomiar ciśnienia: objawy wstrząsu przy bardzo niskim ciśnieniu (112) są tylko w faktach i w sygnale gp, czat ich nie pokazuje; rozważyć osobny sygnał emergency.
- Ból głowy: podzielić długie zdanie z listą powodów do 112, skrócić sygnał o czadzie, dopisać wymioty do sygnału dla ciąży (NHS).
- Bezsenność: dopisać złożone zachowania we śnie po lekach „Z” (chodzenie, jazda autem), rady dla pracujących na zmiany i przedawkowanie leków nasennych bez recepty wprost w sygnale.

### Zmiany w czacie przy okazji pilota

Testerzy znaleźli luki w wykrywaniu kryzysu i stanów nagłych w `soleil-main/offline-companion.js`, a koordynator je poprawił. Czat rozpoznaje teraz myśli samobójcze związane ze snem i tabletkami („chcę zasnąć i się nie obudzić”, „obym się jutro nie obudziła”, „wezmę wszystkie tabletki nasenne naraz”, „ile tabletek trzeba, żeby umrzeć”) i podaje numery kryzysowe. Do 112 kieruje przedawkowanie i nieprzytomność, także u innej osoby („przedawkowałem leki nasenne”, „nie mogę dobudzić mamy po tabletkach nasennych”, „tata wziął tabletkę nasenną i oddycha bardzo wolno”, „dziecko zjadło tabletki na sen”), ból w klatce w różnych sformułowaniach („boli mnie w klatce piersiowej”, „kłuje mnie w klatce”), duszność („budzę się z dusznością”, „się duszę”, „dusi mnie kaszel”) i objawy udaru („mamie opada kącik ust”, „tata nagle mówi niewyraźnie”). „Żeby” nie jest już mylone z „zęby”. Przypadki są w `tools/soleil/offline-companion.test.mjs`. Po raporcie archiwisty doszły jeszcze „krzywa buzia” i „tata nie reaguje” (112). Czat przy wątpliwościach woli zareagować za mocno: np. „mam nadzieję, że się nie obudzę z bólem głowy” dostaje numery pomocy.

### Tematy, które nie weszły

Brak. Wszystkie 4 tematy pilota mają w `3-test.json` werdykt `pass`, zero blokerów i wszystkie testy zaliczone, a weryfikator żadnego nie odrzucił.
<!-- raport:end -->
