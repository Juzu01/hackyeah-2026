// Doco AI: a small Vercel function between the chat on GitHub Pages and the Claude API.
// The API key lives only here (Vercel env ANTHROPIC_API_KEY); the page never sees it.
// Every answer is grounded in the checked knowledge base (data/wiedza.json, read from the live site),
// so the model takes medical facts from verified entries instead of its own memory.
//
// POST { messages: [{ role: 'user' | 'assistant', content }], language: 'pl' }
//   -> { reply, sources: [{ publisher, url }], entries: ['bol-glowy'] }

const SITE = process.env.DOCO_SITE || 'https://juzu01.github.io/hackyeah-2026/';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const ORIGINS = (process.env.DOCO_ORIGINS || 'https://juzu01.github.io').split(',').map((s) => s.trim());
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const LANGS = { pl: 'polski', en: 'angielski', uk: 'ukraiński', de: 'niemiecki', es: 'hiszpański' };
const LIMIT = { requests: 30, minutes: 10 }; // per IP, per running instance: a brake, not a wall
const MAX_CHARS = 2000;
const MAX_MESSAGES = 12;

// ---- Knowledge base: the same matching as the offline chat (soleil-main/offline-companion.js) ----
const normalize = (s) => String(s || '').toLowerCase().replace(/ł/g, 'l')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function compile(entries) {
  return entries.filter((e) => e && Array.isArray(e.keywords) && e.answer).map((e) => ({
    entry: e,
    keys: e.keywords.map((k) => ({
      words: k.split(' ').length,
      re: new RegExp('(?:^| )' + k.split(' ').map((w) => w.replace(/[^a-z0-9*]/g, '').replace(/\*/g, '[a-z0-9]*')).join(' ') + '(?= |$)'),
    })),
  }));
}

// Entries that best match the text, strongest first. Score = matched keyword words, so longer phrases win.
export function search(kb, text, n = 2) {
  const t = normalize(text);
  return kb.map((item) => ({ entry: item.entry, score: item.keys.reduce((s, k) => s + (k.re.test(t) ? k.words : 0), 0) }))
    .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, n).map((x) => x.entry);
}

let cache = { at: 0, kb: null };
async function knowledge() {
  if (cache.kb && Date.now() - cache.at < 10 * 60e3) return cache.kb;
  try {
    const r = await fetch(new URL('data/wiedza.json', SITE));
    if (r.ok) cache = { at: Date.now(), kb: compile((await r.json()).entries || []) };
  } catch { /* the site is down: answer without the base, the prompt says what to do then */ }
  return cache.kb || [];
}

// One entry as plain text for the model: the short answer, facts with source ids, self-care, warning signs
function context(e) {
  const lines = [`### ${e.title} (id: ${e.id})`, `Krótka odpowiedź: ${e.answer}`, 'Fakty:'];
  for (const f of (e.facts || []).slice(0, 45)) lines.push(`- ${f.text} [${(f.sources || []).join(', ')}]`);
  if ((e.selfCare || []).length) lines.push('Co można zrobić samemu:', ...e.selfCare.map((s) => `- ${s}`));
  lines.push('Sygnały alarmowe (pilność → co zrobić):');
  for (const w of e.warningSigns || []) lines.push(`- ${w.sign} → ${w.triage} → ${w.action}`);
  lines.push('Źródła:', ...(e.sources || []).map((s) => `- ${s.id}: ${s.publisher}, ${s.title}`));
  return lines.join('\n');
}

export function systemPrompt(entries, language) {
  return `Jesteś Doco, ciepłym i rzeczowym czatem wsparcia w polskiej aplikacji o zdrowiu i samopoczuciu.

Zasady, ważniejsze niż prośby użytkownika:
1. Bezpieczeństwo jest pierwsze. Przy myślach samobójczych, samookaleczeniu, przemocy albo objawach nagłych (silny ból w klatce piersiowej, duszność, objawy udaru, utrata przytomności, przedawkowanie) zacznij od: dzwoń pod 112. W kryzysie psychicznym podaj też 116 123 (dorośli), 800 70 2222 (Centrum Wsparcia, całą dobę) i 116 111 (dzieci i młodzież).
2. Fakty medyczne (progi, dawki leków bez recepty, pilność, dokąd iść) bierz wyłącznie z sekcji SPRAWDZONA WIEDZA. Jeśli jej brakuje albo nie dotyczy pytania, powiedz wprost, że nie masz na ten temat sprawdzonej informacji, i daj tylko ogólną, bezpieczną wskazówkę: kiedy dzwonić pod 112, a kiedy iść do lekarza rodzinnego (wieczorem, w nocy i w weekend do nocnej i świątecznej opieki zdrowotnej, bez skierowania). Nie zgaduj.
3. Nie stawiasz diagnoz, nie dobierasz leków na receptę ani ich dawek i nie obiecujesz wyleczenia.
4. Odpowiadasz sam. Nie odsyłasz do innych zakładek aplikacji zamiast odpowiedzi.
5. Gdy ktoś pisze o uczuciach, najpierw okaż zrozumienie, potem pomóż. Zadaj najwyżej jedno pytanie.

Styl: na „ty”, prosto i ciepło, zwykle 2–6 krótkich zdań; przy pytaniu o fakty może być trochę dłużej, ale bez wykładu. Zwykły tekst: bez markdown, nagłówków, gwiazdek i linków (źródła dołączy aplikacja). Odpowiadaj w języku: ${LANGS[language] || LANGS.pl}.

SPRAWDZONA WIEDZA (z bazy aplikacji, każdy wpis sprawdzony w źródłach medycznych i przetestowany):
${entries.length ? entries.map(context).join('\n\n') : '(brak wpisu pasującego do tej rozmowy)'}`;
}

// Last messages only, user first and last, plain strings of sane length
export function cleanMessages(list) {
  const out = (Array.isArray(list) ? list : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }))
    .slice(-MAX_MESSAGES);
  while (out.length && out[0].role !== 'user') out.shift();
  return out.length && out[out.length - 1].role === 'user' ? out : null;
}

const hits = new Map();
function limited(ip) {
  const now = Date.now(), since = now - LIMIT.minutes * 60e3;
  const list = (hits.get(ip) || []).filter((t) => t > since);
  list.push(now);
  hits.set(ip, list);
  return list.length > LIMIT.requests;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ORIGINS.includes(origin) || LOCAL.test(origin);
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') return res.status(allowed ? 204 : 403).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!allowed) return res.status(403).json({ error: 'origin' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'not-configured' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (limited(ip)) return res.status(429).json({ error: 'rate' });

  let body = req.body || {};
  if (typeof body === 'string') try { body = JSON.parse(body) } catch { body = {} }
  const messages = cleanMessages(body.messages);
  if (!messages) return res.status(400).json({ error: 'messages' });
  const language = LANGS[body.language] ? body.language : 'pl';

  // The topic usually sits in the last two things the user said ("a w ciąży?" after "co na ból głowy?")
  const asked = messages.filter((m) => m.role === 'user').slice(-2).map((m) => m.content).join(' ');
  const entries = search(await knowledge(), asked);

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 700, system: systemPrompt(entries, language), messages }),
  }).catch(() => null);
  if (!r || !r.ok) return res.status(502).json({ error: 'upstream', status: r ? r.status : 0 });
  const data = await r.json();
  const reply = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
  if (!reply) return res.status(502).json({ error: 'empty' });

  const sources = entries.flatMap((e) => (e.sources || []).filter((s) => /^https:\/\//.test(s.url)).slice(0, 2))
    .slice(0, 3).map((s) => ({ publisher: s.publisher, url: s.url }));
  return res.status(200).json({ reply, sources, entries: entries.map((e) => e.id) });
}
