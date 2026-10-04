# Jak wyglądają symptom checkery z mapą ciała: research rynku i wzorce UX

Notatka dla zespołu HackYeah 2026. Cel: zbudować aplikację „Gdzie boli?”, w której pierwszym ekranem jest sylwetka człowieka (a nie czat), **kopiując sprawdzone schematy UX/UI** zamiast wymyślać własne.

## 1. Metoda i zastrzeżenia

- Research zrobiony 3.10.2026 z sandboxa, którego proxy blokowało bezpośrednie wejście na strony produktów (WebMD, Symptomate, Ada, Buoy, NHS 111, Mayo…). Opisy tych produktów pochodzą z **podsumowań wyników wyszukiwania** (artykuły, recenzje, case studies, prace naukowe) i są oznaczone „[wg źródeł]”.
- Bez ograniczeń dało się czytać **GitHub i npm**. Dzięki temu szczegóły Symptomate pochodzą wprost z kodu: otwartoźródłowa biblioteka komponentów Infermedica (Wrocław) zawiera prawdziwe elementy ich interfejsu (karta triage, etykiety dowodów, mapa ciała SVG, kafelki odpowiedzi). Takie fakty oznaczamy „[GitHub]”.
- Warto 15 minut poświęcić na otwarcie w zwykłej przeglądarce: `symptoms.webmd.com`, `symptomate.com/pl`, `111.nhs.uk` i `service-manual.nhs.uk/design-system/patterns/help-users-decide-when-and-where-to-get-care` – potwierdzają 90 % poniższych wniosków.

## 2. Produkty

| Produkt | Pierwszy ekran | Mapa ciała | Wywiad | Wynik | Logowanie |
|---|---|---|---|---|---|
| **WebMD Symptom Checker** (USA, kanoniczna mapa ciała) | Od razu mapa; wybór „Myself / Someone else”, potem płeć i wiek | Sylwetka 2D, przełącznik M/K i przód/tył, hover podświetla, klik otwiera listę objawów regionu; 11 regionów + 41 podregionów; osobne „General Symptoms” i „Skin”; wyszukiwarka objawów | Pytania o historię i leki | Lista schorzeń uszeregowana wg siły dopasowania; CTA „find a doctor” | Niewymagane |
| **Symptomate / Infermedica** (Wrocław; certyfikat MZ, wyrób medyczny klasy IIb) | Regulamin (checkbox) → „dla kogo” → płeć → wiek → czynniki ryzyka | „Body avatar”: klik w część ciała → lista objawów dla tej części, osobne listy dla przodu i tyłu, podpowiedzi sąsiednich objawów; alternatywnie wyszukiwarka | Jedno pytanie na ekran, kafelki **Tak / Nie / Nie wiem**, skala bólu „Mild → Unbearable”, stepper | Najpierw **karta triage** (5 poziomów), potem „Possible conditions” z 10-stopniowym paskiem i etykietą „Strong / Moderate evidence” | Brak, anonimowo |
| **Ada** (aplikacja) | Konto wymagane, profile rodzinne | Brak (wyszukiwarka z listą zamkniętą) | Czat, jedno pytanie na raz | „Possible causes”: „X na 10 osób z takimi objawami”, 8 poziomów pilności, lista red flags | Wymagane |
| **Buoy Health** (web, czat) | Dane demograficzne, potem objawy | Brak | Pytania z przyciskiem **„Why am I being asked this?”** | Do 3 przyczyn + poziom opieki, nawigacja do placówek | Niewymagane |
| **Healthily** (czat „Dot”) | Wiek i płeć | Brak, objawy własnymi słowami | Doprecyzowanie, czas trwania | Raport: triage, prawdopodobne przyczyny, co wykluczyć, samoopieka | – |
| **Mayo Clinic** | Dorosły / dziecko, lista objawów | Brak | „Zaznacz czynniki” (co wywołuje, co łagodzi, objawy towarzyszące) | Przyczyny wg liczby pasujących czynników | Niewymagane |
| **NHS 111 online** (Anglia, wyrób medyczny) | Wiek, płeć, kod pocztowy, **jeden** najbardziej dokuczliwy objaw | Brak (lista ~120 tematów) | Jedno pytanie tak/nie na ekran, **najpierw pytania o zagrożenie życia** | „Disposition”, nie diagnoza: 999 / A&E / pilna wizyta / GP / apteka / samoopieka; karty kolorowe (niebieska / czerwona / czerwono-ciemnoszara) | Niewymagane, bez podawania tożsamości |
| **Isabel** | Wiek, płeć, ciąża, region | Brak, autouzupełnianie 25 tys. fraz | 7 standardowych pytań (początek, czas, zmiana, poziom bólu…) | Lista częstych i rzadkich rozpoznań, poważne z red flag; pasek „gdzie szukać pomocy” | – |
| **Healthwise „Check Your Symptoms”** (licencja: Kaiser Permanente, UW Health…) | Dorosły M / dorosła K / dziecko | Sylwetka z regionami (głowa, klatka, plecy, brzuch, ręce, nogi), klik przełącza przód/tył; przyciski „Skin” i „Other symptoms” | Objaw z listy regionu | Leczenie domowe vs. szukaj pomocy | Niewymagane |
| **K Health** | Konto wymagane | Brak | ~25 pytań | „X % osób takich jak Ty miało…” | Wymagane (aplikacja konsumencka zamknięta 31.12.2025) |
| **Symptom checker Ministerstwa Zdrowia na TPK** (silnik Infermedica, PL/EN/UK) | Wiek, choroby przewlekłe, objawy z wyszukiwarki | Brak | Pytania doprecyzowujące | Raport z wywiadu i sugestia dalszych kroków; dostępny w godzinach TPK | Niewymagane |

Polskie realia: Symptomate (dawniej Doktor-Medi.pl) to pierwsza aplikacja w Portfelu Aplikacji Zdrowotnych MZ; mojeIKP nie ma symptom checkera; ZnanyLekarz to nie konkurent, tylko naturalny cel przycisku „Umów wizytę”.

### Co zweryfikowano w kodzie Infermedica [GitHub]

- Taksonomia mapy ciała dorosłego, przód: `head, eyes, ears, nose, oral_cavity, neck_or_throat, chest, upper_abdomen, mid_abdomen, lower_abdomen, sexual_organs, upper_arm, forearm, hand, thigh, knee, lower_leg, foot`; tył: `head, nape_of_neck, back, lower_back, buttocks, anus, elbow, upper_arm, forearm, hand, thigh, knee, lower_leg, foot`; brzuch dzieli się po kliknięciu na 7 stref. Osobne modele dla niemowlęcia, małego dziecka, dziecka i dorosłego.
- Kolory triage: samoopieka zielony, konsultacja i konsultacja w 24 h niebieski, stan nagły żółty, karetka czerwony.
- Karta triage: nagłówek „Recommendation”, tytuł np. „Call an ambulance”, treść „Your symptoms are very serious… Call an ambulance right now.”
- Lista przyczyn: nazwa + jedno zdanie + pasek 0–10 z etykietą („Strong evidence” przy 8, „Moderate evidence” przy 4–6) + „Show details”.
- Kafelki odpowiedzi: Yes / No / Don't know; skala bólu Mild → Unbearable; stepper; panel boczny na wyjaśnienia; checkbox „I read and accept Terms of Service and Privacy Policy.”
- Checklist Infermedica przed wdrożeniem: **nie używać słowa „diagnoza”**, pisać „wstępna ocena”; linki do regulaminu i instrukcji zawsze dostępne.

### Badania UX, które warto znać [wg źródeł]

- Redesign WebMD (2018): testy pokazały, że „20-letnia ikoniczna mapa ciała była trudna w użyciu”, a objawy ogólne (gorączka, dreszcze) nie mają miejsca na ciele – stąd wyeksponowana wyszukiwarka i kategoria „General Symptoms”.
- Case study symptom checkera (Schrynemakers): **połowa użytkowników przełączała się z mapy na listę**, na telefonie większość porzucała mapę na rzecz wyszukiwarki, wielu miało kłopot z dodaniem drugiego objawu; mimo to użytkownicy lubią zaczynać od „gdzie boli”. Rekomendacje: mapa jako punkt wejścia + wyszukiwarka z autouzupełnianiem + listy kategorii.
- Przegląd systematyczny (31 prac, arXiv 2208.09100) i badanie PSU/CHI: użytkownicy chcą **przejrzystości** (które odpowiedzi doprowadziły do wyniku), nie lubią zamkniętych list i pytań „skaczących” między tematami; „Why am I being asked this?” z Buoy jest wzorem.
- Infermedica: w testach Symptomate „wskazywanie na ciele oceniono bardzo pozytywnie jako łatwy i intuicyjny sposób dodawania objawów”.

## 3. Wspólny schemat (to kopiujemy)

1. **Strona główna = checker.** Bez splash screenu, bez logowania: nagłówek, jedno zdanie „to nie diagnoza”, czerwona linia 112/999, jedna główna akcja.
2. **Zgoda**: jeden checkbox (Symptomate) albo dopisek przy „Dalej”.
3. **Dla kogo**: „Dla mnie / Dla kogoś innego” (WebMD, Symptomate, Ada).
4. **Płeć** (wpływa na sylwetkę i listy) → 5. **Wiek**.
6. (Opcjonalnie) czynniki ryzyka: choroby przewlekłe, ciąża, palenie.
7. **Wprowadzanie objawów**: mapa ciała + wyszukiwarka obok siebie, wybrane objawy jako chipsy, podpowiedzi sąsiednich objawów.
8. **Wywiad**: jedno pytanie na ekran, Tak / Nie / Nie wiem, pasek postępu, „dlaczego o to pytamy”, **pytania alarmowe najpierw** z natychmiastowym przerwaniem (NHS 111, Ada, Symptomate).
9. **Wynik**: najpierw karta zalecenia, potem możliwe przyczyny z poziomem dopasowania, potem „co dalej”, na końcu zastrzeżenia.
10. **Konto dopiero po wyniku** („Zapisz wynik”); tylko Ada wymusza logowanie na starcie.

## 4. Dziesięć zasad UX i kto robi to najlepiej

1. Nigdy nie blokuj checkera logowaniem (NHS 111, Symptomate).
2. Mapa + zawsze widoczna wyszukiwarka; mapa jest wejściem, nie jedyną drogą (Infermedica, WebMD).
3. Klik w region → krótka, wyselekcjonowana lista objawów, nie cały katalog (WebMD, Healthwise).
4. Przełącznik przód/tył i sylwetka zależna od płci, natychmiastowe (WebMD).
5. Zoom tylko tam, gdzie ma sens: głowa, brzuch (WebMD, Infermedica).
6. Jedno pytanie na ekran, trzy odpowiedzi, widoczny postęp (Symptomate, Ada, NHS 111).
7. Pytania alarmowe najpierw i karta „stan nagły” przerywająca wywiad (NHS 111, Ada).
8. Wynik zaczyna się od zalecenia, kolorowego i z nagłówkiem (karty NHS, karta triage Infermedica).
9. Prawdopodobieństwo jako etykieta, nie goły procent („Silne / Umiarkowane dopasowanie”, „X na 10 osób”) (Symptomate, Ada).
10. Tłumacz się: „dlaczego o to pytamy”, „dlaczego to pasuje” (Buoy, Ada); nigdy nie pisz „diagnoza”.

## 5. Jak to przełożyliśmy w „Gdzie boli?”

| Wzorzec | Nasza implementacja |
|---|---|
| Strona główna = mapa | `#/` od razu pokazuje sylwetkę (ok. 60 % wysokości ekranu na telefonie), nad nią kompaktowy wiersz „Dla kogo / Płeć / Wiek” (WebMD), obok wyszukiwarka objawów (na telefonie nad mapą). |
| Regiony | Taksonomia zbliżona do Infermedica/WebMD: przód: głowa (z podobszarami oczy / uszy / nos i zatoki / jama ustna), szyja i gardło, klatka piersiowa, brzuch górny i dolny, miednica i pachwiny, bark, ramię, łokieć, przedramię, nadgarstek, dłoń, udo, kolano, goleń, kostka, stopa; tył: tył głowy, kark, górna i dolna część pleców, pośladki, łydka, pięta/Achilles. Plus przyciski „Objawy ogólne” i „Skóra” (WebMD, Healthwise) oraz lista rozwijana dla klawiatury i czytników ekranu. |
| Klik → lista objawów | Panel boczny na desktopie, dolny arkusz na telefonie; 5–15 objawów na region, najczęstsze pierwsze, filtr, sekcja „Objawy ogólne”. Wybrane objawy jako chipsy, licznik na regionie. |
| Wywiad | Jedno pytanie na ekran, kafelki Tak / Nie / Nie wiem, „Dlaczego o to pytamy?”, pasek postępu; najpierw do 8 pytań alarmowych dobranych do wskazanych okolic, „Tak” na pytanie o stanie nagłym przerywa wywiad czerwoną kartą z 112/999; potem czas trwania, początek, nasilenie 1–10 (Łagodne → Nie do zniesienia), przebieg. |
| Wynik | Karta zalecenia w 4 poziomach (zielony samoopieka, niebieski wizyta, bursztynowy pilnie dziś z numerem TPK 800 137 200, czerwony 112/999), lista „Dlaczego”, potem „Możliwe przyczyny” z 10-segmentowym paskiem i etykietą dopasowania, rozwijane „dlaczego to pasuje i co możesz zrobić”, „Kiedy pilnie szukać pomocy”, przyciski Zapisz / Pobierz raport (PDF) / Udostępnij lekarzowi / Sprawdź inne objawy. |
| Logowanie | Mały przycisk w prawym górnym rogu (Clerk, ta sama instancja co Doco), nigdy nie blokuje; prośba o logowanie dopiero przy „Zapisz wynik”; historia analiz i zapamiętane płeć/wiek per konto. |
| Słownictwo | „Wstępna ocena”, „możliwe przyczyny”, „zalecenie”; nigdy „diagnoza” jako nazwa wyniku. |

Czego jeszcze nie ma (backlog): sylwetka zależna od płci i wieku (dziecko), 7 stref brzucha jako zoom, czynniki ryzyka (choroby przewlekłe, ciąża), profile rodzinne, raport PDF jako osobny plik zamiast wydruku, silnik probabilistyczny lub LLM zamiast ważonego dopasowania, dane o rzeczywistej częstości („X na 10 osób”).

## 6. Gotowe sformułowania po polsku

- Pod mapą i w stopce: „To narzędzie ma charakter wyłącznie informacyjny i nie stanowi porady medycznej, konsultacji ani diagnozy. Nie zastępuje wizyty u lekarza.”
- Pasek alarmowy: „Zagrożenie życia? Silny ból w klatce piersiowej, duszność, utrata przytomności, nagłe osłabienie połowy ciała – natychmiast zadzwoń pod 112 lub 999.”
- Nagłówek wyniku: „Wynik to wstępna ocena na podstawie Twoich odpowiedzi, a nie diagnoza. O dalszym postępowaniu decyduje lekarz.”
- Zgoda: „Rozumiem, że wynik to wstępna ocena na podstawie moich odpowiedzi, a nie diagnoza.”

## 7. Źródła

Czytane bezpośrednio: github.com/infermedica/component-library (UiCard, UiList/Condition, UiTile, UiScale, UiStepper, UiInteractiveSvg, `src/types/interactiveSvg.ts`, `src/styles/variables/colors.scss`), github.com/infermedica/js-symptom-checker-example, github.com/infermedica/symptom-checker-chatbot-example, rejestr npm (`react-body-highlighter`, `@plexapro/react-body-highlighter`), wyniki wyszukiwania dot. TPK (nfz.gov.pl, dentonet.pl, rp.pl).

Z podsumowań wyszukiwania (strony zablokowane przez proxy): symptoms.webmd.com i historia mapy WebMD (nicowesterdale.com, prnewswire 2018, case study Tamory Petitt), symptomate.com, blog i checklista Infermedica, ada.com/help, buoyhealth.com, livehealthily.com, mayoclinic.org, 111.nhs.uk i NHS service manual (care cards), isabelhealthcare.com, healthwise.net, khealth.com, ubiehealth.com, arXiv 2208.09100, PMC8075525, gov.pl (symptom checker na TPK), pacjent.gov.pl.
