export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoda niedozwolona' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  const { userId, language = 'pl' } = req.body;
  if (!userId) return res.status(400).json({ error: 'Brak userId' });

 // Pobierz nastroje z ostatnich 7 dni (czas polski)
  const now = new Date();
  const polandNow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' }));
  const sevenDaysAgo = new Date(polandNow.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
  const moodRes = await fetch(
 `${supabaseUrl}/rest/v1/mood_logs?user_id=eq.${userId}&created_at=gte.${sevenDaysAgoStr}T00:00:00%2B02:00&order=created_at.asc`,
    { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
  );
  const moods = await moodRes.json();

  const moodNames = {
    pl: { 1: 'bardzo źle', 2: 'źle', 3: 'średnio', 4: 'dobrze', 5: 'świetnie' },
    en: { 1: 'very bad', 2: 'bad', 3: 'okay', 4: 'good', 5: 'great' },
    uk: { 1: 'дуже погано', 2: 'погано', 3: 'середньо', 4: 'добре', 5: 'чудово' },
    de: { 1: 'sehr schlecht', 2: 'schlecht', 3: 'okay', 4: 'gut', 5: 'großartig' },
    es: { 1: 'muy mal', 2: 'mal', 3: 'regular', 4: 'bien', 5: 'genial' }
  };

  const noDataMessages = {
    pl: 'Nie mam jeszcze wystarczająco danych z tego tygodnia żeby przygotować podsumowanie. Wróć po kilku dniach! 🌸',
    en: 'I don\'t have enough data from this week to prepare a summary. Come back in a few days! 🌸',
    uk: 'У мене ще недостатньо даних за цей тиждень. Повернися через кілька днів! 🌸',
    de: 'Ich habe noch nicht genug Daten aus dieser Woche. Komm in ein paar Tagen wieder! 🌸',
    es: 'Todavía no tengo suficientes datos de esta semana. ¡Vuelve en unos días! 🌸'
  };

  const langMoodNames = moodNames[language] || moodNames.pl;
  const moodEmojis = { 1: '😔', 2: '😕', 3: '😐', 4: '🙂', 5: '😊' };

  if (!moods || moods.length === 0) {
    return res.status(200).json({ summary: noDataMessages[language] || noDataMessages.pl });
  }

  const dayNames = {
    pl: ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    uk: ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пятниця', 'субота'],
    de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
    es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
  };

  const langDays = dayNames[language] || dayNames.pl;

  const moodList = moods.map(m => {
    const date = new Date(m.created_at);
    const dayName = langDays[date.getDay()];
    return `${dayName}: ${moodEmojis[m.mood]} ${langMoodNames[m.mood]}${m.note ? ` (${m.note})` : ''}`;
  }).join('\n');

  const avg = (moods.reduce((sum, m) => sum + m.mood, 0) / moods.length).toFixed(1);

  const promptByLanguage = {
    pl: `Na podstawie poniższych danych o nastroju użytkownika z ostatnich 7 dni, napisz krótkie, ciepłe i szczere podsumowanie tygodnia po POLSKU. Napisz jak bliski przyjaciel — bez terapeutycznego języka. Wspomnij o trendach jeśli je widzisz. Maksymalnie 4-5 zdań.`,
    en: `Based on the following mood data from the last 7 days, write a short, warm and honest weekly summary in ENGLISH. Write like a close friend — no therapeutic language. Mention trends if you see them. Maximum 4-5 sentences.`,
    uk: `На основі наведених даних про настрій користувача за останні 7 днів, напиши коротке, тепле та щире підведення підсумків тижня УКРАЇНСЬКОЮ МОВОЮ. Пиши як близький друг — без терапевтичної мови. Згадай тенденції якщо бачиш. Максимум 4-5 речень.`,
    de: `Schreibe basierend auf den folgenden Stimmungsdaten der letzten 7 Tage eine kurze, warme und ehrliche Wochenzusammenfassung auf DEUTSCH. Schreib wie ein enger Freund — keine therapeutische Sprache. Erwähne Trends wenn du welche siehst. Maximal 4-5 Sätze.`,
    es: `Basándote en los siguientes datos de estado de ánimo de los últimos 7 días, escribe un breve, cálido y honesto resumen semanal en ESPAÑOL. Escribe como un amigo cercano — sin lenguaje terapéutico. Menciona tendencias si las ves. Máximo 4-5 frases.`
  };

  const prompt = `${promptByLanguage[language] || promptByLanguage.pl}

Dane nastrojów:
${moodList}

Średni nastrój: ${avg}/5`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const data = await response.json();
 let summary = data.content?.[0]?.text || noDataMessages[language] || noDataMessages.pl;
// Konwertuj markdown na HTML
summary = summary
  .replace(/^# (.+)$/gm, '<strong style="font-size:1rem;display:block;margin-bottom:8px;">$1</strong>')
  .replace(/^## (.+)$/gm, '<strong style="display:block;margin-bottom:6px;">$1</strong>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\n\n/g, '<br><br>')
  .replace(/\n/g, '<br>');

  return res.status(200).json({ summary, moodCount: moods.length, avgMood: avg });
}
