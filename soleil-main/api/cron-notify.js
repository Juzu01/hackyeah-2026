import webpush from 'web-push';

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidEmail = process.env.VAPID_EMAIL || 'mailto:adrianmalysa49@gmail.com';

  if (!vapidPublic || !vapidPrivate) {
    return res.status(500).json({ error: 'Brak konfiguracji VAPID' });
  }

  webpush.setVapidDetails(vapidEmail, vapidPublic, vapidPrivate);

  // Pobierz wszystkie subskrypcje
  const subsRes = await fetch(
    `${supabaseUrl}/rest/v1/push_subscriptions?order=created_at.asc`,
    { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
  );
  const subscriptions = await subsRes.json();

  if (!subscriptions || subscriptions.length === 0) {
    return res.status(200).json({ sent: 0, message: 'Brak subskrypcji' });
  }

  // Pobierz premium użytkowników
  const premRes = await fetch(
    `${supabaseUrl}/rest/v1/user_subscriptions?is_premium=eq.true`,
    { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
  );
  const premiumUsers = await premRes.json();
  const premiumIds = new Set((premiumUsers || []).map(u => u.user_id));

  const messages = [
    'Hej, jak minął Ci dzień? Jestem tu dla Ciebie. 🌸',
    'Jak się czujesz dziś wieczorem? Chętnie posłucham. 💛',
    'Masz chwilę? Opowiedz mi jak dzisiaj było. ☀️',
    'Pamiętam o Tobie. Jak Twój dzień? 🌻',
    'Wieczór to dobry czas żeby się zatrzymać. Jak się czujesz? 🌙',
  ];
  const premiumMessages = [
    'Hej, zauważyłem/am że jakiś czas minął od naszej ostatniej rozmowy. Jak się miewasz? ✨',
    'Wieczorna chwila dla siebie — co dziś przeżyłeś/aś? Jestem tu. 💜',
    'Czas na chwilę refleksji. Jak minął Ci dzień? Chętnie porozmawiam. 🌟',
  ];

  let sent = 0;
  const failed = [];

  for (const sub of subscriptions) {
    const isPremium = premiumIds.has(sub.user_id);
    const body = isPremium
      ? premiumMessages[Math.floor(Math.random() * premiumMessages.length)]
      : messages[Math.floor(Math.random() * messages.length)];
    const title = isPremium ? 'Soleil Premium ✨' : 'Soleil ☀️';
    const payload = JSON.stringify({ title, body, url: '/' });

    try {
      await webpush.sendNotification(sub.subscription, payload);
      sent++;
    } catch (err) {
      console.error('Push error:', err.statusCode, err.body);
      if (err.statusCode === 410 || err.statusCode === 404) {
        failed.push(sub.user_id);
      }
    }
  }

  // Usuń wygasłe subskrypcje
  for (const uid of failed) {
    await fetch(`${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${uid}`, {
      method: 'DELETE',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
  }

  return res.status(200).json({ sent, failed: failed.length, total: subscriptions.length });
}
