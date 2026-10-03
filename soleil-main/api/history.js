
export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  // POST — cytat dnia (dawniej osobny plik daily.js)
  if (req.method === 'POST') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const { language = 'pl' } = req.body;

    const promptByLanguage = {
      pl: `Wygeneruj na dzień dzisiejszy:
1. Krótki, inspirujący cytat (max 2 zdania) — może być od znanych osób lub własny. Powinien dotyczyć emocji, życia, odwagi lub samopoznania.
2. Jedno głębokie, otwarte pytanie do refleksji które skłoni użytkownika do zastanowienia się nad sobą.

Odpowiedz TYLKO w formacie JSON (bez żadnego dodatkowego tekstu):
{"quote": "treść cytatu", "author": "autor lub Soleil", "question": "pytanie do refleksji"}`,
      en: `Generate for today:
1. A short, inspiring quote (max 2 sentences) — can be from famous people or original. Should be about emotions, life, courage or self-discovery.
2. One deep, open-ended reflection question that will make the user think about themselves.

Reply ONLY in JSON format (no additional text):
{"quote": "quote content", "author": "author or Soleil", "question": "reflection question"}`,
      uk: `Згенеруй на сьогодні:
1. Короткий, надихаючий цитат (макс 2 речення) — може бути від відомих людей або власний. Має стосуватися емоцій, життя, сміливості або самопізнання.
2. Одне глибоке, відкрите питання для рефлексії яке спонукає користувача задуматися про себе.

Відповідай ТІЛЬКИ у форматі JSON (без додаткового тексту):
{"quote": "зміст цитати", "author": "автор або Soleil", "question": "питання для рефлексії"}`,
      de: `Generiere für heute:
1. Ein kurzes, inspirierendes Zitat (max 2 Sätze) — kann von berühmten Personen oder original sein. Sollte über Gefühle, Leben, Mut oder Selbsterkenntnis handeln.
2. Eine tiefe, offene Reflexionsfrage die den Nutzer zum Nachdenken über sich selbst bringt.

Antworte NUR im JSON-Format (kein zusätzlicher Text):
{"quote": "Zitatinhalt", "author": "Autor oder Soleil", "question": "Reflexionsfrage"}`,
      es: `Genera para hoy:
1. Una cita corta e inspiradora (máx 2 frases) — puede ser de personas famosas o propia. Debe tratar sobre emociones, vida, coraje o autoconocimiento.
2. Una pregunta de reflexión profunda y abierta que haga pensar al usuario sobre sí mismo.

Responde SOLO en formato JSON (sin texto adicional):
{"quote": "contenido de la cita", "author": "autor o Soleil", "question": "pregunta de reflexión"}`
    };

    const prompt = promptByLanguage[language] || promptByLanguage.pl;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || '{}';

      let parsed;
      try {
        parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      } catch {
        parsed = {
          quote: language === 'pl' ? 'Każdy dzień to nowa szansa.' : 'Every day is a new opportunity.',
          author: 'Soleil',
          question: language === 'pl' ? 'Co chcesz dziś zmienić?' : 'What do you want to change today?'
        };
      }

      return res.status(200).json(parsed);

    } catch (err) {
      console.error('Daily API error:', err);
      return res.status(500).json({
        quote: 'Każdy dzień to nowa szansa.',
        author: 'Soleil',
        question: 'Co chcesz dziś zmienić?'
      });
    }
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Brak konfiguracji Supabase' });
  }

  // GET — pobierz listę rozmów lub konkretną rozmowę
  if (req.method === 'GET') {
    const { userId, conversationId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Brak userId' });

    // Pobierz konkretną rozmowę
    if (conversationId) {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&user_id=eq.${userId}`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      const data = await response.json();
      if (!data || data.length === 0) return res.status(404).json({ error: 'Nie znaleziono' });
      return res.status(200).json({ messages: data[0].messages || [] });
    }

    // Pobierz listę ostatnich 20 rozmów
    const response = await fetch(
      `${supabaseUrl}/rest/v1/conversations?user_id=eq.${userId}&order=updated_at.desc&limit=20`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const data = await response.json();

    const conversations = (data || []).map(c => ({
      id: c.id,
      title: c.title || 'Rozmowa',
      updatedAt: c.updated_at
    }));

    return res.status(200).json({ conversations });
  }

  // DELETE — usuń rozmowę
  if (req.method === 'DELETE') {
    const { userId, conversationId } = req.body;
    if (!userId || !conversationId) return res.status(400).json({ error: 'Brak danych' });

    await fetch(
      `${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      }
    );

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Metoda niedozwolona' });
}
