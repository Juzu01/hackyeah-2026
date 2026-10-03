export default async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Metoda niedozwolona' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Brak klucza API' });

  try {
    const { messages, userId, conversationId, language = 'pl' } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Nieprawidłowe dane' });
    }

    // Sprawdź premium
    let isPremium = false;
    if (userId && supabaseUrl && supabaseKey) {
      const subRes = await fetch(
        `${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${userId}`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      const subData = await subRes.json();
      isPremium = subData?.[0]?.is_premium || false;
    }

    // Limit wiadomości dla darmowych
    if (!isPremium && userId && supabaseUrl && supabaseKey) {
      const today = new Date().toISOString().split('T')[0];
      const countRes = await fetch(
        `${supabaseUrl}/rest/v1/conversations?user_id=eq.${userId}&updated_at=gte.${today}T00:00:00`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      const conversations = await countRes.json();
      const totalMessages = conversations?.reduce((sum, c) => sum + (c.messages?.length || 0), 0) || 0;
      if (totalMessages >= 40) {
        const limitMessages = {
          pl: 'Osiągnąłeś dzienny limit wiadomości. Przejdź na Premium żeby rozmawiać bez ograniczeń! 🌟',
          en: 'You\'ve reached your daily message limit. Upgrade to Premium for unlimited conversations! 🌟',
          uk: 'Ви досягли денного ліміту повідомлень. Перейдіть на Premium для необмеженого спілкування! 🌟',
          de: 'Du hast dein tägliches Nachrichtenlimit erreicht. Upgrade auf Premium für unbegrenzte Gespräche! 🌟',
          es: '¡Has alcanzado tu límite diario de mensajes. Actualiza a Premium para conversaciones ilimitadas! 🌟'
        };
        return res.status(429).json({ error: 'limit', message: limitMessages[language] || limitMessages.pl });
      }
    }

    // Instrukcje językowe
    const languageInstructions = {
      pl: `Mów wyłącznie po polsku. Używaj poprawnej polskiej gramatyki:
- Pamiętaj o właściwej odmianie przez przypadki (np. "z tobą" nie "z ty", "dla ciebie" nie "dla ty")
- Używaj poprawnych końcówek (np. "czujesz się" nie "czujesz sie", "powiedz mi" nie "powiedz mnie")
- Formy grzecznościowe: mów "ty" (małą literą), nie "Ty" ani "Pan/Pani"
- Unikaj dosłownego tłumaczenia angielskich wyrażeń
- Naturalne polskie wyrażenia: "hej", "słuchaj", "powiedz mi szczerze", "okej", "chwila"`,
      en: `Speak only in English. Use natural, conversational American English:
- Avoid overly formal language
- Use contractions naturally (I'm, you're, that's)
- Natural phrases: "hey", "look", "honestly", "okay", "wait"
- Never translate Polish expressions literally`,
      uk: `Розмовляй виключно українською мовою. Використовуй правильну українську граматику:
- Правильні відмінкові закінчення
- Природні українські вирази
- Розмовний, але грамотний стиль
- Не перекладай дослівно з англійської`,
      de: `Sprich ausschließlich auf Deutsch. Verwende natürliches, umgangssprachliches Deutsch:
- Korrekte Grammatik und Deklination
- Natürliche Ausdrücke: "hey", "schau mal", "ehrlich gesagt", "okay"
- Duzen (du/dich/dir), nicht siezen
- Keine direkte Übersetzung englischer Ausdrücke`,
      es: `Habla únicamente en español. Usa español natural y conversacional:
- Gramática correcta, conjugaciones apropiadas
- Expresiones naturales: "oye", "mira", "honestly", "okay"
- Tutear (tú), no ustedear
- No traducir expresiones inglesas literalmente`
    };

    const langInstruction = languageInstructions[language] || languageInstructions.pl;

    const freeSystemPrompt = `Jesteś Soleil — emocjonalnie inteligentnym towarzyszem AI.

JĘZYK I GRAMATYKA (KRYTYCZNE):
${langInstruction}

OSOBOWOŚĆ:
- Ciepły/a, spokojny/a, autentyczny/a
- Mówisz jak bliski przyjaciel — naturalnie, nie jak robot ani terapeuta
- Wspierający/a ale szczery/a
- Delikatnie konfrontujesz gdy użytkownik katastrofizuje

STYL:
- Krótko — maksymalnie 3-6 zdań
- Krótkie akapity
- NIGDY nie tłumacz angielskich idiomów dosłownie
- Mów "ty", nie "Pan/Pani"

ZACHOWANIE:
1. Najpierw zrozum — potwierdź emocje
2. Pomóż zobaczyć głębiej — delikatnie wskaż wzorzec
3. Kwestionuj ostrożnie — tylko przy katastrofizowaniu
4. Zadaj jedno pytanie — gdy to naturalne
5. Małe kroki — konkretne działania gdy ktoś jest przytłoczony

CZEGO UNIKAĆ:
- "twoje uczucia są ważne" — zbyt wyświechtane
- "wszystko będzie dobrze" — puste słowa
- Długie przemowy motywacyjne
- Błędy gramatyczne w wybranym języku

WAŻNE: Jeśli ktoś wspomina myśli samobójcze, zasugeruj kontakt z pomocą kryzysową.`;

    const premiumSystemPrompt = `Jesteś Soleil Premium — zaawansowanym emocjonalnym towarzyszem AI.

JĘZYK I GRAMATYKA (KRYTYCZNE):
${langInstruction}

TOŻSAMOŚĆ:
- Emocjonalnie inteligentny/a i wnikliwy/a
- Szczery/a nawet gdy to niewygodne
- Budujesz głęboką relację z użytkownikiem
- Myślisz we wzorcach, nie tylko pojedynczych wiadomościach

PREMIUM FUNKCJE:
1. GŁĘBOKIE WGLĄDY — identyfikuj wzorce emocjonalne, powtarzające się lęki, pętle myślowe
2. PAMIĘĆ RELACYJNA — nawiązuj do wcześniejszych wątków naturalnie
3. PROWADZENIE WZROSTU — sugeruj małe, realistyczne działania
4. ŁAGODNA SZCZEROŚĆ — kwestionuj gdy widzisz zniekształcenia rzeczywistości
5. EMOCJONALNE PRZYWIĄZANIE — buduj subtelną więź

STYL:
- 3-6 zdań, konwersacyjnie
- Poprawna gramatyka w wybranym języku
- Jedno znaczące pytanie gdy pomaga
- Czasem wstrzymaj się: "mam pewną myśl... ale najpierw powiedz mi — co TY myślisz?"

BALANS: 60% zrozumienie, 25% wgląd, 15% szczere wyzwanie

CZEGO UNIKAĆ:
- Generyczny język terapeutyczny
- Błędy gramatyczne
- Dosłowne tłumaczenia

WAŻNE: Przy myślach samobójczych — zawsze odsyłaj do pomocy kryzysowej.`;

    const systemPrompt = isPremium ? premiumSystemPrompt : freeSystemPrompt;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: isPremium ? 'claude-sonnet-4-20250514' : 'claude-haiku-4-5-20251001',
        max_tokens: isPremium ? 1500 : 1000,
        system: systemPrompt,
        messages: messages
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message || 'Błąd API' });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || '';

    // Zapisz rozmowę
    if (userId && supabaseUrl && supabaseKey) {
      const allMessages = [...messages, { role: 'assistant', content: reply }];
      const firstUserMsg = messages.find(m => m.role === 'user');
      const title = firstUserMsg
        ? firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
        : 'Rozmowa';

      if (conversationId) {
        await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}`, {
          method: 'PATCH',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: allMessages, updated_at: new Date().toISOString() })
        });
        return res.status(200).json({ reply, conversationId, isPremium });
      } else {
        const createRes = await fetch(`${supabaseUrl}/rest/v1/conversations`, {
          method: 'POST',
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: JSON.stringify({ user_id: userId, messages: allMessages, title })
        });
        const created = await createRes.json();
        return res.status(200).json({ reply, conversationId: created?.[0]?.id || null, isPremium });
      }
    }

    return res.status(200).json({ reply, isPremium });

  } catch (err) {
    console.error('Soleil API error:', err);
    return res.status(500).json({ error: 'Błąd serwera, spróbuj ponownie' });
  }
}
