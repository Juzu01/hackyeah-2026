export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Brak konfiguracji' });
  }

  // GET — status subskrypcji
  if (req.method === 'GET') {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'Brak userId' });

    try {
      const response = await fetch(
        `${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${userId}`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      const data = await response.json();

      if (!data || data.length === 0) {
        return res.status(200).json({ isPremium: false, status: 'inactive' });
      }

      const row = data[0];
      const premiumUntil = row.premium_until ? new Date(row.premium_until) : null;
      const hasReferralPremium = premiumUntil && premiumUntil > new Date();
      const isPremium = row.is_premium || hasReferralPremium || false;

      return res.status(200).json({
        isPremium,
        status: row.is_premium ? (row.subscription_status || 'active') : (hasReferralPremium ? 'referral_bonus' : (row.subscription_status || 'inactive')),
        premiumUntil: hasReferralPremium ? row.premium_until : null
      });

    } catch (err) {
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }

  // POST — utwórz sesję Stripe checkout (dawniej osobny plik create-checkout.js)
  if (req.method === 'POST') {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;

    if (!stripeSecretKey || !priceId) {
      return res.status(500).json({ error: 'Brak konfiguracji Stripe' });
    }

    const { userId, userEmail } = req.body;
    if (!userId) return res.status(400).json({ error: 'Brak userId' });

    try {
      const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${stripeSecretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'mode': 'subscription',
          'line_items[0][price]': priceId,
          'line_items[0][quantity]': '1',
          'success_url': `${req.headers.origin}?premium=success`,
          'cancel_url': `${req.headers.origin}?premium=cancel`,
          'customer_email': userEmail || '',
          'metadata[user_id]': userId,
          'allow_promotion_codes': 'true'
        })
      });

      const session = await response.json();

      if (!response.ok) {
        return res.status(500).json({ error: session.error?.message || 'Błąd Stripe' });
      }

      return res.status(200).json({ url: session.url });

    } catch (err) {
      console.error('Stripe checkout error:', err);
      return res.status(500).json({ error: 'Błąd serwera' });
    }
  }

  return res.status(405).json({ error: 'Metoda niedozwolona' });
}
