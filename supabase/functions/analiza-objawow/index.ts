// Claude's reading of all the symptoms together, for "Gdzie boli?" (src/lib/analysis.ts).
// It runs here, not in the page, so the GitHub token stays secret: the page sends one check
// (who, the symptoms with their answers, the recommendation and the causes our knowledge base
// already ranked), this asks Claude through GitHub Models and returns { summary, points }.
// Claude is told to use only those facts: no causes or medical claims from outside our base.
//
// Secrets (supabase secrets set …): GITHUB_TOKEN – a fine-grained token with "Models: read";
// MODEL – the Claude model's id from the GitHub Models catalogue.
// Deploy: supabase functions deploy analiza-objawow --no-verify-jwt
// Then build "Gdzie boli?" with VITE_ANALYSIS_URL=https://<project>.supabase.co/functions/v1/analiza-objawow

const ENDPOINT = 'https://models.github.ai/inference/chat/completions'
const ORIGINS = ['https://juzu01.github.io', 'http://localhost:5173', 'http://localhost:5174']
const MAX_BODY = 20_000

const SYSTEM = `Jesteś częścią aplikacji „Gdzie boli?”, która pomaga wstępnie ocenić objawy. Dostajesz jedną ocenę w JSON: osobę, objawy z odpowiedziami, zalecenie i możliwe przyczyny, które wybrała już nasza sprawdzona baza.

Twoje zadanie: krótko pokazać, co objawy mówią RAZEM.
- Opierasz się wyłącznie na danych z wiadomości. Nie dodajesz chorób spoza podanych przyczyn ani nowych faktów medycznych.
- Nie stawiasz diagnozy i nie zmieniasz zalecenia. Jeśli zalecenie to stan nagły albo pilna konsultacja, zaczynasz od tego.
- Wskazujesz, które objawy mogą mieć wspólną przyczynę z listy, które wyglądają na osobne i który jest najpilniejszy. Uwzględniasz ciążę i odpowiedzi o miesiączce, jeśli są.
- Piszesz po polsku, prosto, do osoby bez wiedzy medycznej, zwracając się do niej (albo o „tej osobie”, jeśli ocena jest dla kogoś innego).

Odpowiadasz wyłącznie JSON-em bez żadnego innego tekstu:
{"summary": "1–2 krótkie zdania", "points": [{"title": "do 6 słów", "text": "1–3 zdania"}]}
Najwyżej 5 punktów.`

const cors = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && ORIGINS.includes(origin) ? origin : ORIGINS[0],
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  Vary: 'Origin',
})

const json = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json' } })

interface Reading {
  summary: string
  points: { title: string; text: string }[]
}

function readingOf(text: string): Reading | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const r = JSON.parse(text.slice(start, end + 1)) as Reading
    if (typeof r.summary !== 'string' || !Array.isArray(r.points)) return null
    const points = r.points.filter((p) => typeof p?.title === 'string' && typeof p?.text === 'string').slice(0, 5)
    return { summary: r.summary, points }
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origin) })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405, origin)
  // Browsers on other sites get no answer they can read; this is for the app's own pages.
  if (origin && !ORIGINS.includes(origin)) return json({ error: 'origin' }, 403, origin)

  const token = Deno.env.get('GITHUB_TOKEN')
  const model = Deno.env.get('MODEL')
  if (!token || !model) return json({ error: 'not configured' }, 503, origin)

  const body = await req.text()
  if (body.length > MAX_BODY) return json({ error: 'too large' }, 413, origin)
  try {
    JSON.parse(body)
  } catch {
    return json({ error: 'bad json' }, 400, origin)
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: body },
      ],
    }),
  })
  if (!res.ok) return json({ error: `model ${res.status}` }, 502, origin)
  const data = await res.json()
  const reading = readingOf(data?.choices?.[0]?.message?.content ?? '')
  return reading ? json(reading, 200, origin) : json({ error: 'no reading' }, 502, origin)
})
