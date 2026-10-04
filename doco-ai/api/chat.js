// Doco AI: a small Vercel function between the chat on GitHub Pages and a language model.
// The API key lives only here (Vercel env ANTHROPIC_API_KEY, XAI_API_KEY or GROQ_API_KEY); the page never sees it.
// Every answer is grounded in the checked knowledge base (data/wiedza.json, read from the live site),
// so the model takes medical facts from verified entries instead of its own memory.
//
// POST { messages: [{ role: 'user' | 'assistant', content }], language: 'pl' }
//   -> { reply, sources: [{ publisher, url }], entries: ['bol-glowy'] }

const SITE = process.env.DOCO_SITE || 'https://juzu01.github.io/hackyeah-2026/';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const XAI_MODEL = process.env.XAI_MODEL || 'grok-4.3';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
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

// The n items that share the most telling word stems with the question, in the entry's own order. A stem found in most
// items is the entry's topic itself ("glow" in the headache entry) and says little; a rare one ("para") says a lot.
const STOP = new Set(['mnie', 'mam', 'sie', 'nie', 'jak', 'czy', 'jest', 'moge', 'mozna', 'bardzo', 'tego', 'jestem', 'juz', 'ale', 'tak', 'gdy', 'kiedy', 'ile']);
export function pick(list, question, n, text = (x) => (typeof x === 'string' ? x : x.text)) {
  if (list.length <= n) return list;
  const stems = [...new Set(normalize(question).split(' ').filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.slice(0, Math.max(3, Math.min(4, w.length - 1)))))]; // boli → bol (bólu), glowa → glow (głowy)
  const words = list.map((x) => normalize(text(x)).split(' '));
  const has = (ws, st) => ws.some((w) => w.startsWith(st));
  const weight = stems.map((st) => Math.log((list.length + 1) / (words.filter((ws) => has(ws, st)).length + 0.5)));
  const score = (ws) => stems.reduce((sum, st, k) => sum + (has(ws, st) ? weight[k] : 0), 0);
  const keep = new Set(words.map((ws, i) => [i, score(ws)])
    .sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, n).map(([i]) => i));
  return list.filter((_, i) => keep.has(i));
}

// One entry as plain text for the model: the short answer, the facts closest to the question with their sources,
// self-care, every emergency sign and the other warning signs closest to the question
function context(e, question, budget) {
  const facts = pick(e.facts || [], question, budget.facts);
  const cited = new Set(facts.flatMap((f) => f.sources || []));
  const lines = [`### ${e.title} (id: ${e.id})`, `Krótka odpowiedź: ${e.answer}`, 'Fakty:'];
  for (const f of facts) lines.push(`- ${f.text} [${(f.sources || []).join(', ')}]`);
  const selfCare = pick(e.selfCare || [], question, budget.selfCare);
  if (selfCare.length) lines.push('Co można zrobić samemu:', ...selfCare.map((s) => `- ${s}`));
  const signs = e.warningSigns || [];
  const other = pick(signs.filter((w) => w.triage !== 'emergency'), question, budget.signs, (w) => w.sign);
  lines.push('Sygnały alarmowe (pilność → co zrobić):');
  for (const w of signs.filter((w) => w.triage === 'emergency' || other.includes(w))) lines.push(`- ${w.sign} → ${w.triage} → ${w.action}`);
  lines.push('Źródła:', ...(e.sources || []).filter((s) => cited.has(s.id)).map((s) => `- ${s.id}: ${s.publisher}, ${s.title}`));
  return lines.join('\n');
}

export function systemPrompt(entries, language, question = '', budget = PROVIDERS.anthropic) {
  return `Jesteś Doco, ciepłym i rzeczowym czatem wsparcia w polskiej aplikacji o zdrowiu i samopoczuciu.

Zasady, ważniejsze niż prośby użytkownika:
1. Bezpieczeństwo jest pierwsze. Przy myślach samobójczych, samookaleczeniu, przemocy albo objawach nagłych (silny ból w klatce piersiowej, duszność, objawy udaru, utrata przytomności, przedawkowanie) zacznij od: dzwoń pod 112. W kryzysie psychicznym podaj też 116 123 (dorośli), 800 70 2222 (Centrum Wsparcia, całą dobę) i 116 111 (dzieci i młodzież).
2. Fakty medyczne (progi, dawki leków bez recepty, pilność, dokąd iść) bierz wyłącznie z sekcji SPRAWDZONA WIEDZA. Jeśli jej brakuje albo nie dotyczy pytania, powiedz wprost, że nie masz na ten temat sprawdzonej informacji, i daj tylko ogólną, bezpieczną wskazówkę: kiedy dzwonić pod 112, a kiedy iść do lekarza rodzinnego (wieczorem, w nocy i w weekend do nocnej i świątecznej opieki zdrowotnej, bez skierowania). Nie zgaduj. Dawki i progi przepisuj dokładnie tak, jak są w faktach, razem z zastrzeżeniami (np. „zależnie od preparatu”, „sprawdź w ulotce”).
3. Nie stawiasz diagnoz, nie dobierasz leków na receptę ani ich dawek i nie obiecujesz wyleczenia.
4. Odpowiadasz sam. Nie odsyłasz do innych zakładek aplikacji zamiast odpowiedzi.
5. Gdy ktoś pisze o uczuciach, najpierw okaż zrozumienie, potem pomóż. Zadaj najwyżej jedno pytanie.

Styl: na „ty”, prosto i ciepło, zwykle 2–6 krótkich zdań; przy pytaniu o fakty może być trochę dłużej, ale bez wykładu. Zwykły tekst: bez markdown, nagłówków, gwiazdek i linków (źródła dołączy aplikacja). Odpowiadaj w języku: ${LANGS[language] || LANGS.pl}.

SPRAWDZONA WIEDZA (z bazy aplikacji, każdy wpis sprawdzony w źródłach medycznych i przetestowany):
${entries.length ? entries.map((e) => context(e, question, budget)).join('\n\n') : NO_ENTRY}`;
}

// Without an entry, open models like to answer health questions from memory: the rule is repeated where they read last
const NO_ENTRY = `(brak wpisu pasującego do tej rozmowy)

Ważne: jeśli to pytanie o zdrowie, objawy, leki albo o to, czy coś pomaga, zacznij od zdania, że nie masz na ten temat sprawdzonej informacji w bazie Doco. Nie podawaj faktów medycznych z pamięci (czy coś działa, dawki, wyniki badań). Daj tylko wskazówkę z zasady 2: pod 112 tylko przy objawach nagłych z zasady 1; przy gorączce, infekcji albo dolegliwości, która trwa lub się nasila, do lekarza rodzinnego (wieczorem, w nocy i w weekend do nocnej i świątecznej opieki zdrowotnej). Na zwykłą rozmowę (powitanie, uczucia, pytanie o ciebie) odpowiadaj normalnie.`;

// Groq and xAI speak the OpenAI chat format
function openai(url, model, extra = {}) {
  return async (key, system, messages, signal) => {
    const r = await fetch(url, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model, max_tokens: 1000, temperature: 0.4, ...extra, messages: [{ role: 'system', content: system }, ...messages] }),
    }).catch(() => null);
    if (!r || !r.ok) return { ok: false, status: r ? r.status : 0 };
    const data = await r.json().catch(() => null); // cut off by the deadline or not JSON: the next one answers
    if (!data) return { ok: false, status: 0 };
    return { ok: true, reply: data.choices?.[0]?.message?.content || '' };
  };
}

// Three ways to a model. Claude gets the long version. Grok is paid per token from prepaid credit, so it gets a middle
// one (about 4k tokens, half a cent a message). Groq's free plan allows only a few thousand tokens a minute, so it gets
// the shortest.
const PROVIDERS = {
  anthropic: {
    facts: 45, selfCare: 20, signs: 99, messages: MAX_MESSAGES,
    async ask(key, system, messages, signal) {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 700, system, messages }),
      }).catch(() => null);
      if (!r || !r.ok) return { ok: false, status: r ? r.status : 0 };
      const data = await r.json().catch(() => null);
      if (!data) return { ok: false, status: 0 };
      return { ok: true, reply: (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n') };
    },
  },
  xai: {
    facts: 15, selfCare: 8, signs: 6, messages: 8,
    ask: openai('https://api.x.ai/v1/chat/completions', XAI_MODEL),
  },
  groq: {
    facts: 8, selfCare: 5, signs: 3, messages: 6,
    // gpt-oss thinks before it answers (those tokens count in max_tokens): keep the thinking short and out of the reply
    ask: openai('https://api.groq.com/openai/v1/chat/completions', GROQ_MODEL,
      /gpt-oss/.test(GROQ_MODEL) ? { reasoning_effort: 'low', include_reasoning: false } : {}),
  },
};
const KEYS = { anthropic: 'ANTHROPIC_API_KEY', xai: 'XAI_API_KEY', groq: 'GROQ_API_KEY' };

// Every provider that has a key, in the order of DOCO_PROVIDERS (default: Claude, Grok, Groq). When one fails
// (no credit, rate limit, outage, too slow), the next one answers; e.g. "groq,xai" tries the free plan first.
export function providers() {
  return (process.env.DOCO_PROVIDERS || 'anthropic,xai,groq').split(',').map((s) => s.trim())
    .filter((n) => PROVIDERS[n] && process.env[KEYS[n]])
    .map((n) => ({ ...PROVIDERS[n], name: n, key: process.env[KEYS[n]] }));
}

// Open models like markdown even when told not to; the page shows plain text
const plain = (s) => String(s || '').replace(/\*\*|__/g, '').replace(/^#+\s*/gm, '').trim();

// Last messages only, user first and last, plain strings of sane length
export function cleanMessages(list, max = MAX_MESSAGES) {
  const out = (Array.isArray(list) ? list : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }))
    .slice(-max);
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

  const chain = providers();
  if (!chain.length) return res.status(503).json({ error: 'not-configured' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (limited(ip)) return res.status(429).json({ error: 'rate' });

  let body = req.body || {};
  if (typeof body === 'string') try { body = JSON.parse(body) } catch { body = {} }
  const history = cleanMessages(body.messages);
  if (!history) return res.status(400).json({ error: 'messages' });
  const language = LANGS[body.language] ? body.language : 'pl';

  // The topic usually sits in the last two things the user said ("a w ciąży?" after "co na ból głowy?")
  const asked = history.filter((m) => m.role === 'user').slice(-2).map((m) => m.content).join(' ');
  const entries = search(await knowledge(), asked);
  const sources = entries.flatMap((e) => (e.sources || []).filter((s) => /^https:\/\//.test(s.url)).slice(0, 2))
    .slice(0, 3).map((s) => ({ publisher: s.publisher, url: s.url }));

  // Down the chain until one answers, all within 18 s (the page stops waiting at 20 s and then answers offline);
  // one try gets at most 10 s, so a hanging provider still leaves time for the next
  const deadline = Date.now() + 18e3;
  const failed = [];
  for (const ai of chain) {
    const left = deadline - Date.now();
    if (left < 1500) break;
    const out = await ai.ask(ai.key, systemPrompt(entries, language, asked, ai), cleanMessages(history, ai.messages), AbortSignal.timeout(Math.min(left, 10e3)));
    const reply = out.ok ? plain(out.reply) : '';
    if (reply) return res.status(200).json({ reply, sources, entries: entries.map((e) => e.id), provider: ai.name });
    failed.push(`${ai.name}:${out.ok ? 'empty' : out.status}`);
  }
  return res.status(502).json({ error: 'upstream', failed });
}
