import webpush from 'web-push';

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL;

  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'Brak konfiguracji VAPID' });
  }

  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

  // GET — zwróć public key
  if (req.method === 'GET') {
    return res.status(200).json({ publicKey: vapidPublic });
  }

  // POST — zapisz subskrypcję
  if (req.method === 'POST') {
    const { userId, subscription } = req.body;
    if (!userId || !subscription) return res.status(400).json({ error: 'Brak danych' });

    const existing = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    const data = await existing.json();

    if (data && data.length > 0) {
      await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}`, {
        method: 'PATCH',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription })
      });
    } else {
      await fetch(`${supabaseUrl}/rest/v1/push_subscriptions`, {
        method: 'POST',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, subscription })
      });
    }

    return res.status(200).json({ success: true });
  }

  // DELETE — usuń subskrypcję
  if (req.method === 'DELETE') {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Brak userId' });

    await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${userId}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Metoda niedozwolona' });
}
