import { rewardReferralIfPending } from './referral.js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Brak konfiguracji Supabase' });
  }

  // POST — zapisz nastrój
  if (req.method === 'POST') {
    const { userId, mood, note } = req.body;
    if (!userId || !mood) return res.status(400).json({ error: 'Brak danych' });

 // Sprawdź ile razy dziś zapisano nastrój (max 2, min 6h odstępu)
    const nowDate = new Date();
    const polandOffset = nowDate.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' });
    const today = new Date(polandOffset).toISOString().split('T')[0];
    const checkToday = await fetch(
      `${supabaseUrl}/rest/v1/mood_logs?user_id=eq.${userId}&created_at=gte.${today}T00:00:00%2B02:00&order=created_at.desc`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const todayLogs = await checkToday.json();
    if (todayLogs && todayLogs.length >= 2) {
      return res.status(200).json({ success: true, skipped: true });
    }
    if (todayLogs && todayLogs.length === 1) {
      const lastEntry = new Date(todayLogs[0].created_at);
      const hoursSince = (Date.now() - lastEntry.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 6) {
        return res.status(200).json({ success: true, skipped: true });
      }
    }

    // Sprawdź, czy to pierwszy nastrój tego użytkownika w ogóle (potrzebne do nagrody za polecenie)
    const firstCheckRes = await fetch(
      `${supabaseUrl}/rest/v1/mood_logs?user_id=eq.${userId}&select=id&limit=1`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const firstCheckData = await firstCheckRes.json();
    const isFirstMood = !firstCheckData || firstCheckData.length === 0;

    // Zapisz nastrój
    const response = await fetch(`${supabaseUrl}/rest/v1/mood_logs`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ user_id: userId, mood, note: note || null })
    });

    if (!response.ok) return res.status(500).json({ error: 'Błąd zapisu' });

    // Jeśli to pierwszy nastrój — nagródź oczekujące polecenie (jeśli użytkownik przyszedł z linku poleconego)
    if (isFirstMood) {
      try { await rewardReferralIfPending(supabaseUrl, supabaseKey, userId); }
      catch (err) { console.error('Reward referral error:', err); }
    }

    return res.status(200).json({ success: true });
  }

// GET — pobierz nastroje
  if (req.method === 'GET') {
    const { userId, today } = req.query;
    if (!userId) return res.status(400).json({ error: 'Brak userId' });

    // Sprawdź czy dziś już zapisano nastrój
    if (today === 'true') {
      const nowDate = new Date();
      const polandOffset = nowDate.toLocaleString('en-US', { timeZone: 'Europe/Warsaw' });
      const polandDate = new Date(polandOffset).toISOString().split('T')[0];
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/mood_logs?user_id=eq.${userId}&created_at=gte.${polandDate}T00:00:00%2B02:00&order=created_at.desc`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      const logs = await checkRes.json();
      const count = (logs && logs.length) || 0;

      let canShow = count < 2;
      if (count === 1 && logs[0]) {
        const lastEntry = new Date(logs[0].created_at);
        const hoursSince = (Date.now() - lastEntry.getTime()) / (1000 * 60 * 60);
        canShow = hoursSince >= 6;
      }
      return res.status(200).json({ hasMoodToday: !canShow });
    }

    // Pobierz nastroje z ostatnich 7 dni
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const response = await fetch(
      `${supabaseUrl}/rest/v1/mood_logs?user_id=eq.${userId}&created_at=gte.${sevenDaysAgo}&order=created_at.desc`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const data = await response.json();
    return res.status(200).json({ moods: data });
  }

  return res.status(405).json({ error: 'Metoda niedozwolona' });
}
