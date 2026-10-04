# Doco AI: serwer czatu z modelem językowym

Strona Doco działa na GitHub Pages, które nie mają serwera, więc klucza API nie da się trzymać w stronie (każdy by go zobaczył). Ten katalog to mała funkcja na Vercel, która:

- trzyma klucze API w zmiennych na Vercel (nigdy w repo): `ANTHROPIC_API_KEY` (Claude), `XAI_API_KEY` (Grok od xAI), `GROQ_API_KEY` (darmowy plan Groq); można ustawić jeden albo kilka,
- przy kilku kluczach pyta modele po kolei: gdy pierwszy zawiedzie (koniec środków, limit, awaria, brak odpowiedzi w 10 s), odpowiada następny, wszystko w 18 s; kolejność domyślnie Claude → Grok → Groq, zmiana zmienną `DOCO_PROVIDERS`, np. `groq,xai` (najpierw darmowy Groq, płatny Grok tylko jako zapas),
- przy każdej wiadomości pobiera aktualną bazę wiedzy z `https://juzu01.github.io/hackyeah-2026/data/wiedza.json` (co 10 minut), wybiera 1–2 pasujące wpisy i podaje je modelowi jako „sprawdzoną wiedzę”, więc fakty medyczne pochodzą z bazy, a nie z pamięci modelu,
- przyjmuje wiadomości tylko ze strony zespołu (`https://juzu01.github.io`) i z localhost, z limitem 30 wiadomości na 10 minut z jednego adresu,
- rozmawia tylko o zdrowiu i samopoczuciu: prośby spoza (przepis, zadanie domowe, kod, pogoda, wyniki) odrzuca jednym zdaniem; przy dolegliwości najpierw dopytuje (gdzie, od kiedy, od czego się zaczęło), potem daje konkretne kroki z bazy,
- dostaje od strony `context`: krótkie podsumowanie tego, co użytkownik zapisał w aplikacji (nastrój, ból w dzienniku, sprawdzenia w „Gdzie boli?”, z `soleil-main/kontekst.js`), żeby nawiązać do wcześniejszych wpisów,
- odpowiada `{ reply, sources, entries, provider }` (`provider`: który model odpowiedział); strona dokleja źródła pod odpowiedzią. Gdy żaden nie odpowie: 502 `{ error: 'upstream', failed: ['xai:403', 'groq:429'] }`.

Strona (`soleil-main/index.html`) pyta serwer, którego adres jest w `soleil-main/ai-config.js`. Wiadomości o kryzysie i objawach nagłych w ogóle nie idą do AI: od razu odpowiada `offline-companion.js` ze sprawdzonym tekstem i numerami. Gdy serwer nie odpowie w 20 sekund, zwróci błąd albo skończy się limit, czat odpowiada offline jak wcześniej.

## Modele

- **Groq (darmowy):** `openai/gpt-oss-120b` z krótkim namysłem (zmiana: zmienna `GROQ_MODEL`; Llamy nie ma już na liście modeli konta). Bez karty, ale z limitem dla całego konta: 8 tys. tokenów na minutę i 1000 zapytań na dzień, czyli około 2 pytań na minutę. Dlatego model dostaje krótszy wyciąg z wpisu: 8 faktów i 5 porad najbliższych pytaniu, wszystkie sygnały „dzwoń pod 112” i 3 pozostałe sygnały alarmowe, oraz 6 ostatnich wiadomości. To około 3,5 tys. tokenów na pytanie plus odpowiedź. Gdy limit się skończy, Groq odpowiada 429 i pytany jest następny model, a gdy go nie ma, czat odpowiada offline. Groq nie trenuje modeli na danych z API.
- **Grok od xAI (płatny z przedpłaty):** `grok-4.3` (zmiana: `XAI_MODEL`). Wyciąg średni: 15 faktów, 8 porad, sygnały „dzwoń pod 112” i 6 pozostałych, 8 wiadomości, około 4 tys. tokenów, czyli mniej więcej pół centa za wiadomość (10 $ starcza na ponad tysiąc wiadomości). Klucz z console.x.ai → API Keys. xAI nie trenuje modeli na danych z API i usuwa je po 30 dniach.
- **Claude (płatny):** `claude-haiku-4-5-20251001` (zmiana: `ANTHROPIC_MODEL`). Dostaje dłuższy wyciąg (45 faktów, wszystkie sygnały, 12 wiadomości). Klucz z console.anthropic.com (subskrypcja Claude Pro/Max go nie daje); ustaw limit wydatków w Limits.

## Uruchomienie

Projekt `doco-ai` na Vercel już jest (konto mat10005, katalog główny projektu: `doco-ai`), adres: `https://doco-ai-xi.vercel.app/api/chat`.

1. Klucz: console.x.ai (Grok) albo console.groq.com (Groq) → API Keys → Create API Key.
2. Klucz na Vercel: Settings → Environment Variables → `XAI_API_KEY` albo `GROQ_API_KEY`, środowisko Production (wklejasz go tylko tam, nigdy do repo ani czatu).
3. Ponowne wdrożenie, żeby funkcja widziała klucz: Deployments → ostatnie → Redeploy (albo `npx vercel redeploy <adres wdrożenia>`).
4. W `soleil-main/ai-config.js`: `window.DOCO_AI_URL = 'https://doco-ai-xi.vercel.app/api/chat';`, commit i push.

Baza wiedzy aktualizuje się na serwerze sama (pobiera ją z GitHub Pages), więc po dodaniu tematów nie trzeba wdrażać serwera ponownie. Wdrożenie jest potrzebne tylko po zmianie `api/chat.js`.

## Sprawdzanie

```bash
node doco-ai/test.mjs                       # testy bez sieci i bez klucza (CORS, baza, Groq i Claude, limity, historia)
node doco-ai/dev.mjs --fake                 # lokalny serwer bez modelu: odpowiada, które wpisy dostałby model
node doco-ai/dev.mjs                        # lokalny serwer z prawdziwym modelem (GROQ_API_KEY albo ANTHROPIC_API_KEY z otoczenia)
```

Strona na localhost: w konsoli przeglądarki `window.DOCO_AI_URL = 'http://localhost:8787/api/chat'`.
