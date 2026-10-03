export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Metoda niedozwolona' });

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  try {
    const rawBody = await getRawBody(req);
    const payload = JSON.parse(rawBody.toString());
    const event = payload;

    // Obsłuż zdarzenia Stripe
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      if (userId && supabaseUrl && supabaseKey) {
        await updateUserPremium(supabaseUrl, supabaseKey, userId, customerId, subscriptionId, true);
      }
    }

    if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.paused') {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      if (supabaseUrl && supabaseKey) {
        await updatePremiumByCustomer(supabaseUrl, supabaseKey, customerId, false);
      }
    }

    if (event.type === 'customer.subscription.resumed' || event.type === 'invoice.payment_succeeded') {
      const obj = event.data.object;
      const customerId = obj.customer;

      if (supabaseUrl && supabaseKey) {
        await updatePremiumByCustomer(supabaseUrl, supabaseKey, customerId, true);
      }
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(400).json({ error: 'Webhook error' });
  }
}

async function updateUserPremium(supabaseUrl, supabaseKey, userId, customerId, subscriptionId, isPremium) {
  const checkRes = await fetch(
    `${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${userId}`,
    { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
  );
  const existing = await checkRes.json();

  const data = {
    user_id: userId,
    is_premium: isPremium,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: isPremium ? 'active' : 'inactive',
    updated_at: new Date().toISOString()
  };

  if (existing && existing.length > 0) {
    await fetch(`${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${userId}`, {
      method: 'PATCH',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } else {
    await fetch(`${supabaseUrl}/rest/v1/user_subscriptions`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  }
}

async function updatePremiumByCustomer(supabaseUrl, supabaseKey, customerId, isPremium) {
  await fetch(
    `${supabaseUrl}/rest/v1/user_subscriptions?stripe_customer_id=eq.${customerId}`,
    {
      method: 'PATCH',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_premium: isPremium, subscription_status: isPremium ? 'active' : 'inactive', updated_at: new Date().toISOString() })
    }
  );
}
