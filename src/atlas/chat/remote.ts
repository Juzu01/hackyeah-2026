// The team's own chat, when there is one: set VITE_CHAT_URL at build time and
// questions the atlas can't answer itself go there.
//
//   POST VITE_CHAT_URL
//   { "messages": [{ "role": "user" | "assistant", "content": "…" }], "part": { "id": "…", "name": "…" } | null }
//   → { "reply": "…" }
//
// It must allow the atlas's origin (CORS). Without the variable the atlas
// answers everything itself.

const url: string | undefined = import.meta.env.VITE_CHAT_URL

export const hasRemote = !!url

export interface RemoteMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function askRemote(messages: RemoteMessage[], part: { id: string; name: string } | null): Promise<string> {
  if (!url) throw new Error('no remote chat')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, part }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data: unknown = await res.json()
  const reply = (data as { reply?: unknown }).reply
  if (typeof reply !== 'string' || !reply.trim()) throw new Error('empty reply')
  return reply.trim()
}
