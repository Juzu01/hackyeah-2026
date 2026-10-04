# Doco AI: serwer czatu z Claude

Strona Doco działa na GitHub Pages, które nie mają serwera, więc klucza API nie da się trzymać w stronie (każdy by go zobaczył). Ten katalog to mała funkcja na Vercel, która:

- trzyma klucz Claude API w zmiennej `ANTHROPIC_API_KEY` (tylko na Vercel, nigdy w repo),
- przy każdej wiadomości pobiera aktualną bazę wiedzy z `https://juzu01.github.io/hackyeah-2026/data/wiedza.json` (co 10 minut), wybiera 1–2 pasujące wpisy i podaje je modelowi jako „sprawdzoną wiedzę”, więc fakty medyczne pochodzą z bazy, a nie z pamięci modelu,
- przyjmuje wiadomości tylko ze strony zespołu (`https://juzu01.github.io`) i z localhost, z limitem 30 wiadomości na 10 minut z jednego adresu,
- odpowiada `{ reply, sources, entries }`; strona dokleja źródła pod odpowiedzią.

Strona (`soleil-main/index.html`) pyta serwer, którego adres jest w `soleil-main/ai-config.js`. Wiadomości o kryzysie i objawach nagłych w ogóle nie idą do AI: od razu odpowiada `offline-companion.js` ze sprawdzonym tekstem i numerami. Gdy serwer nie odpowie w 20 sekund, zwróci błąd albo skończą się środki, czat odpowiada offline jak wcześniej.

Model: `claude-haiku-4-5-20251001` (zmiana: zmienna `ANTHROPIC_MODEL` na Vercel). Koszt to zwykle ułamek centa za wiadomość; ustaw limit wydatków w console.anthropic.com → Limits.

## Uruchomienie (raz)

1. Klucz: console.anthropic.com → API Keys → Create Key (subskrypcja Claude Pro/Max nie daje klucza API; płaci się osobno za zużycie). U siebie: `setx ANTHROPIC_API_KEY "sk-ant-..."`.
2. `npx vercel login`, potem w katalogu `doco-ai/`: `npx vercel link` (nowy projekt `doco-ai`).
3. Klucz na Vercel: `npx vercel env add ANTHROPIC_API_KEY production` (wklejasz go tylko w terminalu).
4. `npx vercel deploy --prod` → adres w stylu `https://doco-ai-xxx.vercel.app`.
5. W `soleil-main/ai-config.js`: `window.DOCO_AI_URL = 'https://doco-ai-xxx.vercel.app/api/chat';`, commit i push.

Baza wiedzy aktualizuje się na serwerze sama (pobiera ją z GitHub Pages), więc po dodaniu tematów nie trzeba wdrażać serwera ponownie. Wdrożenie jest potrzebne tylko po zmianie `api/chat.js`.

## Sprawdzanie

```bash
node doco-ai/test.mjs                       # testy bez sieci i bez klucza (CORS, baza, limity, historia)
node doco-ai/dev.mjs --fake                 # lokalny serwer bez modelu: odpowiada, które wpisy dostałby model
node doco-ai/dev.mjs                        # lokalny serwer z prawdziwym modelem (ANTHROPIC_API_KEY z otoczenia)
```

Strona na localhost: w konsoli przeglądarki `window.DOCO_AI_URL = 'http://localhost:8787/api/chat'`.
