export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Brak konfiguracji Supabase' });
  }

  // GET — pobierz streak użytkownika
  if (req.method === 'GET') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Brak userId' });

    const response = await fetch(
      `${supabaseUrl}/rest/v1/user_stats?user_id=eq.${userId}`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const data = await response.json();

    if (!data || data.length === 0) {
      return res.status(200).json({ streak: 0, longestStreak: 0 });
    }

    return res.status(200).json({
      streak: data[0].streak || 0,
      longestStreak: data[0].longest_streak || 0
    });
  }

  // POST — zaktualizuj streak po zapisaniu nastroju
  if (req.method === 'POST') {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Brak userId' });

    const nowDate = new Date();
    const polandOffset = nowDate.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' });
    const today = new Date(polandOffset).toISOString().split('T')[0];
    const yesterday = new Date(new Date(polandOffset).getTime() - 86400000).toISOString().split('T')[0];

    // Pobierz obecne statystyki
    const statsRes = await fetch(
      `${supabaseUrl}/rest/v1/user_stats?user_id=eq.${userId}`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const stats = await statsRes.json();

    let newStreak = 1;
    let longestStreak = 1;

    if (stats && stats.length > 0) {
      const current = stats[0];
      longestStreak = current.longest_streak || 1;

      if (current.last_streak_date === today) {
        // Już dziś zapisano — nie zmieniaj
        return res.status(200).json({ streak: current.streak, longestStreak });
      } else if (current.last_streak_date === yesterday) {
        // Kontynuacja serii!
        newStreak = (current.streak || 0) + 1;
        longestStreak = Math.max(newStreak, longestStreak);
      } else {
        // Przerwa — reset
        newStreak = 1;
      }

      // Zaktualizuj
      await fetch(
        `${supabaseUrl}/rest/v1/user_stats?user_id=eq.${userId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            streak: newStreak,
            last_streak_date: today,
            longest_streak: longestStreak,
            updated_at: new Date().toISOString()
          })
        }
      );
    } else {
      // Pierwszy raz — utwórz rekord
      await fetch(
        `${supabaseUrl}/rest/v1/user_stats`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: userId,
            streak: 1,
            last_streak_date: today,
            longest_streak: 1
          })
        }
      );
    }

    return res.status(200).json({ streak: newStreak, longestStreak });
  }

  return res.status(405).json({ error: 'Metoda niedozwolona' });
}
