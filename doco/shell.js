// Doco's shell: the account, the language, popups and Back, the quote of the day, a minute of movement and the chat.
// app.js, chat.js, voice.js and diary.js build on these globals and wrap some of the functions (updateAuthUI,
// updateInterfaceLanguage, setLanguage, goBack, appendMessage, sendMessage), so those stay plain global functions
// and the shell itself calls them by name: whatever wrapped them runs too.

// ── Saved data from before the rename ─────────────────────────────────
// Keys the app wrote under its first name move once to the doco_ prefix, so diaries and settings stay.
(function moveOldKeys() {
  const OLD = 'soleil_';
  [window.localStorage, window.sessionStorage].forEach((store) => {
    try {
      Object.keys(store).filter((k) => k.startsWith(OLD)).forEach((k) => {
        const key = 'doco_' + k.slice(OLD.length);
        if (store.getItem(key) === null) store.setItem(key, store.getItem(k));
        store.removeItem(k);
      });
    } catch (e) {}
  });
})();

const $id = (id) => document.getElementById(id);
const stored = (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } };
const store = (key, value) => { try { localStorage.setItem(key, value); } catch (e) {} };

// ── Language ──────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'pl', name: 'Polski', english: 'Polish' },
  { code: 'en', name: 'English', english: 'English' },
  { code: 'uk', name: 'Українська', english: 'Ukrainian' },
  { code: 'de', name: 'Deutsch', english: 'German' },
  { code: 'es', name: 'Español', english: 'Spanish' },
];
let currentLanguage = stored('doco_language');
if (!LANGUAGES.some((l) => l.code === currentLanguage)) currentLanguage = 'pl';

// The shell's own words. chat.js reads placeholder; voice.js and diary.js read loginBtn.
const translations = {
  pl: { tagline: 'Zawsze tutaj dla Ciebie', placeholder: 'Napisz mi o swoim dniu...', loginBtn: 'Zaloguj się', language: 'Język', voice: 'Głos Doco', privacy: 'Polityka prywatności', quote: 'Cytat dnia', nextQuote: 'Kolejny cytat', testAccount: 'Konto testowe', back: 'Zacznij od nowa', accountMenu: 'Menu konta', close: 'Zamknij', send: 'Wyślij', call: 'Porozmawiaj z Doco', message: 'Wiadomość do Doco' },
  en: { tagline: 'Always here for you', placeholder: 'Tell me about your day...', loginBtn: 'Sign in', language: 'Language', voice: 'Doco\'s voice', privacy: 'Privacy policy', quote: 'Quote of the day', nextQuote: 'Next quote', testAccount: 'Test account', back: 'Start over', accountMenu: 'Account menu', close: 'Close', send: 'Send', call: 'Talk to Doco', message: 'Message to Doco' },
  uk: { tagline: 'Завжди тут для тебе', placeholder: 'Розкажи мені про свій день...', loginBtn: 'Увійти', language: 'Мова', voice: 'Голос Doco', privacy: 'Політика конфіденційності', quote: 'Цитата дня', nextQuote: 'Наступна цитата', testAccount: 'Тестовий акаунт', back: 'Почати спочатку', accountMenu: 'Меню акаунта', close: 'Закрити', send: 'Надіслати', call: 'Поговорити з Doco', message: 'Повідомлення для Doco' },
  de: { tagline: 'Immer für dich da', placeholder: 'Erzähl mir von deinem Tag...', loginBtn: 'Anmelden', language: 'Sprache', voice: 'Doco-Stimme', privacy: 'Datenschutzerklärung', quote: 'Zitat des Tages', nextQuote: 'Nächstes Zitat', testAccount: 'Testkonto', back: 'Neu anfangen', accountMenu: 'Kontomenü', close: 'Schließen', send: 'Senden', call: 'Mit Doco sprechen', message: 'Nachricht an Doco' },
  es: { tagline: 'Siempre aquí para ti', placeholder: 'Cuéntame sobre tu día...', loginBtn: 'Iniciar sesión', language: 'Idioma', voice: 'Voz de Doco', privacy: 'Política de privacidad', quote: 'Cita del día', nextQuote: 'Siguiente cita', testAccount: 'Cuenta de prueba', back: 'Empezar de nuevo', accountMenu: 'Menú de la cuenta', close: 'Cerrar', send: 'Enviar', call: 'Hablar con Doco', message: 'Mensaje para Doco' },
};
const tr = () => translations[currentLanguage] || translations.pl;

function renderLanguageList() {
  const list = $id('languageList');
  list.replaceChildren(...LANGUAGES.map((l) => {
    const option = document.createElement('div');
    option.className = 'lang-option' + (l.code === currentLanguage ? ' active' : '');
    option.id = 'lang-' + l.code;
    option.setAttribute('role', 'button');
    option.tabIndex = 0;
    option.innerHTML = `<span class="lang-flag">${l.code.toUpperCase()}</span><div><div class="lang-name">${l.name}</div><div class="lang-native">${l.english}</div></div>`;
    option.addEventListener('click', () => setLanguage(l.code));
    return option;
  }));
}
function updateLangUI() {
  renderLanguageList();
  $id('menuLangFlag').textContent = currentLanguage.toUpperCase();
}
function openLanguage() {
  updateLangUI();
  pushOverlayState('languageOverlay');
  $id('languageOverlay').classList.add('visible');
}
function closeLanguage() { $id('languageOverlay').classList.remove('visible'); }
function setLanguage(lang) {
  if (!LANGUAGES.some((l) => l.code === lang)) return;
  currentLanguage = lang;
  store('doco_language', lang);
  updateLangUI();
  updateInterfaceLanguage(lang);
  closeLanguage();
}
function updateInterfaceLanguage(lang) {
  const t = translations[lang] || translations.pl;
  document.documentElement.lang = lang;
  $id('tagline').textContent = t.tagline;
  input.placeholder = t.placeholder;
  input.setAttribute('aria-label', t.message);
  $id('menuLangLabel').textContent = t.language;
  $id('menuVoiceLabel').textContent = t.voice;
  $id('menuLangFlag').textContent = lang.toUpperCase();
  $id('backBtn').setAttribute('aria-label', t.back);
  $id('userAvatar').setAttribute('aria-label', t.accountMenu);
  $id('voiceCallBtn').setAttribute('aria-label', t.call);
  $id('voiceCallBtn').title = t.call;
  document.querySelector('.input-wrapper .send-btn:not(.call-btn)')?.setAttribute('aria-label', t.send);
  document.querySelectorAll('.popup-close').forEach((b) => b.setAttribute('aria-label', t.close));
  const privacy = document.querySelector('#privacyLink .row-text');
  if (privacy) privacy.textContent = t.privacy;
  renderMoves();
  showQuote();
  if (typeof updateVoiceLanguage === 'function') updateVoiceLanguage();
}

// ── Popups and Back ───────────────────────────────────────────────────
// Every popup adds a history entry, so the phone's Back closes it instead of leaving the app.
function pushOverlayState(id) { history.pushState({ overlay: id }, ''); }
window.addEventListener('popstate', () => {
  closeLanguage();
  $id('userMenu').classList.remove('visible');
});
$id('languageOverlay').addEventListener('click', (e) => { if (e.target.id === 'languageOverlay') closeLanguage(); });
function toggleUserMenu() {
  const menu = $id('userMenu');
  if (!menu.classList.contains('visible')) pushOverlayState('userMenu');
  menu.classList.toggle('visible');
}
document.addEventListener('click', (e) => {
  const menu = $id('userMenu');
  if (!menu.contains(e.target) && !$id('userAvatar').contains(e.target)) menu.classList.remove('visible');
});

// ── The account ───────────────────────────────────────────────────────
// Demo (HackYeah): everyone is signed in as one test account, with no sign-in screen. What an account unlocks
// (voice call, diary, saving in Objawy) works from the start; entries stay in this browser. Objawy uses the same
// id (src/lib/auth.tsx), so its "Dodaj do dziennika" lands in this diary.
const DOCO_TEST_USER = {
  id: 'test-user',
  firstName: stored('doco_test_name') || '',
  lastName: '',
  emailAddresses: [{ emailAddress: 'Konto testowe' }], // app.js shows it when there is no name
  hasImage: false,
  async update({ firstName }) { // Więcej → "Jak mam się do Ciebie zwracać"
    this.firstName = (firstName || '').trim();
    store('doco_test_name', this.firstName);
  },
};
store('doco_name_asked_test-user', '1'); // no name popup on the first visit
let currentUser = DOCO_TEST_USER;

function updateAuthUI(user) {
  const name = (user && user.firstName || '').trim();
  const initial = (name[0] || tr().testAccount[0]).toUpperCase();
  ['userAvatarPic', 'userMenuPic'].forEach((id) => { $id(id).textContent = initial; });
  $id('userName').textContent = name || tr().testAccount;
  $id('userEmail').textContent = name ? tr().testAccount : '';
  $id('userAvatar').classList.toggle('visible', !!user);
  if (typeof updateVoiceAuth === 'function') updateVoiceAuth(user);
  if (typeof updateDiaryAuth === 'function') updateDiaryAuth(user);
}
// There is nothing to sign in to or out of on the test account
function openAuth() {}
function closeAuth() {}
function signOut() {}

// ── Quote of the day ──────────────────────────────────────────────────
// Signed words from quotes.js, one a day, in Polish only; "Kolejny cytat" moves on.
let quoteStep = 0;
function showQuote() {
  const card = $id('dailyCard');
  if (currentLanguage !== 'pl' || !window.DocoQuotes) { card.hidden = true; return; }
  const [quote, author, who] = window.DocoQuotes.pick(quoteStep);
  $id('dailyLabel').textContent = tr().quote;
  $id('dailyQuote').textContent = `„${quote}”`;
  const strong = document.createElement('strong');
  strong.textContent = author;
  const span = document.createElement('span');
  span.textContent = who;
  $id('dailyAuthor').replaceChildren(strong, span);
  $id('hyQuoteNext').querySelector('span').textContent = tr().nextQuote;
  card.hidden = false;
  const box = $id('dailyContent');
  box.classList.remove('swap');
  void box.offsetWidth; // restart the fade
  box.classList.add('swap');
}
$id('hyQuoteNext').addEventListener('click', () => { quoteStep++; showQuote(); });

// ── A minute of movement (Nastrój) ────────────────────────────────────
// Six places that tighten up during the day, each with one exercise you can do where you sit or stand.
const MOVE_TEXT = {
  pl: { title: 'Minuta ruchu', lead: 'Co jest spięte? Wybierz, a podpowiem jedno krótkie ćwiczenie.', pick: 'Wybierz miejsce' },
  en: { title: 'A minute of movement', lead: 'What feels tight? Pick it and I\'ll suggest one short exercise.', pick: 'Pick a spot' },
  uk: { title: 'Хвилина руху', lead: 'Що напружене? Обери, і я підкажу одну коротку вправу.', pick: 'Обери місце' },
  de: { title: 'Eine Minute Bewegung', lead: 'Was ist verspannt? Wähl es aus, und ich zeige dir eine kurze Übung.', pick: 'Wähl eine Stelle' },
  es: { title: 'Un minuto de movimiento', lead: '¿Qué notas tenso? Elígelo y te propongo un ejercicio corto.', pick: 'Elige una zona' },
};
const MOVES = {
  neck: {
    pl: ['Kark', 'Przy telefonie i laptopie głowa wysuwa się do przodu, a kark ją dźwiga.', 'Cofnij brodę prosto do tyłu, jakbyś robił(a) podwójny podbródek. Przytrzymaj 5 sekund i puść. 8 razy, plecy proste.'],
    en: ['Neck', 'With a phone or laptop your head drifts forward and your neck carries it.', 'Draw your chin straight back, as if making a double chin. Hold 5 seconds, release. 8 times, back straight.'],
    uk: ['Шия', 'Над телефоном чи ноутбуком голова висувається вперед, і шия її тримає.', 'Відведи підборіддя прямо назад, ніби робиш подвійне підборіддя. Затримай на 5 секунд і відпусти. 8 разів, спина рівна.'],
    de: ['Nacken', 'Am Handy oder Laptop schiebt sich der Kopf nach vorn, und der Nacken trägt ihn.', 'Zieh das Kinn gerade nach hinten, als würdest du ein Doppelkinn machen. 5 Sekunden halten, lösen. 8-mal, Rücken gerade.'],
    es: ['Cuello', 'Con el móvil o el portátil la cabeza se adelanta y el cuello la sostiene.', 'Lleva la barbilla recta hacia atrás, como si hicieras papada. Mantén 5 segundos y suelta. 8 veces, con la espalda recta.'],
  },
  shoulders: {
    pl: ['Barki', 'W stresie barki same wędrują w stronę uszu.', 'Na wdechu unieś barki jak najwyżej, przytrzymaj 3 sekundy i z wydechem po prostu je upuść. 6 razy.'],
    en: ['Shoulders', 'Under stress your shoulders creep up towards your ears.', 'Breathing in, lift your shoulders as high as you can, hold 3 seconds, then let them drop as you breathe out. 6 times.'],
    uk: ['Плечі', 'У стресі плечі самі піднімаються до вух.', 'На вдиху підніми плечі якомога вище, затримай на 3 секунди й на видиху просто опусти їх. 6 разів.'],
    de: ['Schultern', 'Unter Stress wandern die Schultern von selbst zu den Ohren.', 'Beim Einatmen die Schultern so hoch wie möglich ziehen, 3 Sekunden halten und beim Ausatmen einfach fallen lassen. 6-mal.'],
    es: ['Hombros', 'Con el estrés los hombros suben solos hacia las orejas.', 'Al inhalar sube los hombros todo lo que puedas, mantén 3 segundos y al exhalar déjalos caer. 6 veces.'],
  },
  breath: {
    pl: ['Oddech', 'Szybki, płytki oddech podkręca napięcie, nawet gdy nic się nie dzieje.', 'Połóż dłoń na brzuchu. Wdech nosem na 4, wydech ustami na 6, tak żeby unosiła się dłoń, a nie barki. 6 oddechów.'],
    en: ['Breathing', 'Fast, shallow breathing keeps the tension going even when nothing is happening.', 'Put a hand on your belly. Breathe in through your nose for 4, out through your mouth for 6, so your hand rises, not your shoulders. 6 breaths.'],
    uk: ['Дихання', 'Швидке поверхневе дихання підтримує напругу, навіть коли нічого не відбувається.', 'Поклади долоню на живіт. Вдих носом на 4, видих ротом на 6, щоб піднімалася долоня, а не плечі. 6 вдихів.'],
    de: ['Atmung', 'Schnelles, flaches Atmen hält die Anspannung am Laufen, auch wenn nichts passiert.', 'Leg eine Hand auf den Bauch. Durch die Nase 4 Sekunden ein, durch den Mund 6 aus, sodass sich die Hand hebt, nicht die Schultern. 6 Atemzüge.'],
    es: ['Respiración', 'Respirar rápido y superficial mantiene la tensión aunque no pase nada.', 'Pon una mano en el vientre. Inhala por la nariz en 4, exhala por la boca en 6, que suba la mano y no los hombros. 6 respiraciones.'],
  },
  back: {
    pl: ['Plecy', 'Po godzinach siedzenia dół pleców sztywnieje.', 'Wstań, dłonie na biodrach, powoli odchyl się lekko do tyłu i wróć. 10 razy, tylko w zakresie bez bólu.'],
    en: ['Back', 'After hours of sitting, your lower back stiffens.', 'Stand up, hands on hips, slowly lean back a little and return. 10 times, only as far as it doesn\'t hurt.'],
    uk: ['Спина', 'Після годин сидіння поперек дубіє.', 'Встань, руки на стегнах, повільно трохи відхились назад і повернись. 10 разів, лише без болю.'],
    de: ['Rücken', 'Nach Stunden im Sitzen wird der untere Rücken steif.', 'Steh auf, Hände in die Hüften, lehn dich langsam leicht nach hinten und zurück. 10-mal, nur so weit es nicht wehtut.'],
    es: ['Espalda', 'Tras horas sentado, la zona lumbar se pone rígida.', 'Ponte de pie, manos en la cadera, inclínate despacio un poco hacia atrás y vuelve. 10 veces, solo hasta donde no duela.'],
  },
  hands: {
    pl: ['Dłonie', 'Pisanie i trzymanie telefonu zostawiają dłonie w ciągłym zacisku.', 'Rozczapierz palce najszerzej, jak się da, na 5 sekund, potem zrób luźną pięść. 10 razy, na koniec strząśnij dłonie.'],
    en: ['Hands', 'Typing and holding a phone keep your hands clenched all day.', 'Spread your fingers as wide as you can for 5 seconds, then make a loose fist. 10 times, then shake your hands out.'],
    uk: ['Кисті', 'Друк і телефон тримають кисті весь час стиснутими.', 'Розчепір пальці якомога ширше на 5 секунд, потім зроби вільний кулак. 10 разів, наприкінці струсни кистями.'],
    de: ['Hände', 'Tippen und das Handy halten lassen die Hände den ganzen Tag verkrampft.', 'Spreiz die Finger 5 Sekunden so weit du kannst, dann eine lockere Faust. 10-mal, zum Schluss die Hände ausschütteln.'],
    es: ['Manos', 'Escribir y sujetar el móvil dejan las manos apretadas todo el día.', 'Abre los dedos todo lo que puedas durante 5 segundos y luego cierra el puño sin fuerza. 10 veces y sacude las manos al final.'],
  },
  legs: {
    pl: ['Nogi', 'Już kilka minut ruchu potrafi poprawić nastrój.', 'Maszeruj w miejscu przez 2 minuty, unosząc kolana, albo wejdź po schodach piętro w górę i z powrotem.'],
    en: ['Legs', 'Just a few minutes of movement can lift your mood.', 'March on the spot for 2 minutes, knees up, or walk one floor up the stairs and back.'],
    uk: ['Ноги', 'Навіть кілька хвилин руху можуть покращити настрій.', 'Маршируй на місці 2 хвилини, піднімаючи коліна, або піднімись сходами на поверх і назад.'],
    de: ['Beine', 'Schon ein paar Minuten Bewegung können die Stimmung heben.', 'Marschier 2 Minuten auf der Stelle, Knie hoch, oder geh eine Etage die Treppe hoch und zurück.'],
    es: ['Piernas', 'Unos minutos de movimiento ya pueden mejorar el ánimo.', 'Marcha en el sitio 2 minutos subiendo las rodillas, o sube un piso por la escalera y vuelve.'],
  },
};
let openMove = null;
function renderMoves() {
  const lang = currentLanguage;
  const t = MOVE_TEXT[lang] || MOVE_TEXT.pl;
  $id('moveTitle').textContent = t.title;
  $id('moveLead').textContent = t.lead;
  $id('moveChips').setAttribute('aria-label', t.title);
  $id('moveChips').replaceChildren(...Object.entries(MOVES).map(([key, move]) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'body-chip' + (key === openMove ? ' selected' : '');
    chip.textContent = (move[lang] || move.pl)[0];
    chip.setAttribute('aria-pressed', String(key === openMove));
    chip.addEventListener('click', () => { openMove = key; renderMoves(); });
    return chip;
  }));
  const detail = $id('moveDetail');
  if (!openMove) {
    detail.innerHTML = '<div class="body-detail-placeholder" id="movePlaceholder"></div>';
    $id('movePlaceholder').textContent = t.pick;
    return;
  }
  const [name, why, how] = MOVES[openMove][lang] || MOVES[openMove].pl;
  const card = document.createElement('div');
  card.className = 'body-detail-card';
  [['body-detail-title', name], ['body-detail-link', why], ['body-detail-exercise', how]].forEach(([cls, text]) => {
    const line = document.createElement('div');
    line.className = cls;
    line.textContent = text;
    card.append(line);
  });
  detail.replaceChildren(card);
}

// ── The chat ──────────────────────────────────────────────────────────
const input = $id('userInput');
const chatWindow = $id('chatWindow');
const welcomeMsg = $id('welcomeMsg');
const backBtn = $id('backBtn');
let conversationHistory = []; // voice.js adds the call's lines here too
let chatStarted = false;

function fitInput() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 100) + 'px';
}
input.addEventListener('input', fitInput);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

// Typed text and server replies go into innerHTML, so they are escaped first
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// One line of the conversation: an avatar slot and a bubble, as doco.css lays them out
function messageRow(role, bubbleClass) {
  const row = document.createElement('div');
  row.className = `message-row ${role}`;
  const avatar = document.createElement('div');
  avatar.className = `avatar ${role}`;
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}${bubbleClass ? ' ' + bubbleClass : ''}`;
  row.append(avatar, bubble);
  return { row, bubble };
}
function appendMessage(role, html) {
  if (!chatStarted) {
    chatStarted = true;
    welcomeMsg.style.display = 'none';
    backBtn.classList.add('visible');
  }
  const { row, bubble } = messageRow(role);
  bubble.innerHTML = html.replace(/\n/g, '<br>');
  chatWindow.append(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}
// Back to the welcome: the conversation, its topic and the typed text go
function goBack() {
  chatWindow.querySelectorAll('.message-row').forEach((row) => row.remove());
  chatStarted = false;
  welcomeMsg.style.display = 'block';
  backBtn.classList.remove('visible');
  conversationHistory = [];
  offlineChat = null;
  input.value = '';
  fitInput();
}

// Without the AI server the offline companion (offline-companion.js) answers, but only in Polish.
// Other languages still get crisis numbers and urgent-symptom help, plus an honest note and a way forward.
let offlineChat = null; // one per conversation, so "start over" also forgets its topic
const CHAT_FALLBACK = {
  pl: { error: 'Przepraszam, wystąpił błąd.', retry: 'Przepraszam, spróbuj jeszcze raz.', connection: 'Przepraszam, mam chwilowe trudności z połączeniem.' },
  en: {
    error: 'Sorry, something went wrong.', retry: 'Sorry, please try again.', connection: 'Sorry, I\'m having trouble connecting right now.',
    crisis: /kill myself|suicid|want to die|self[- ]?harm|end my life|(don'?t|do not) want to (live|be alive)|hurt myself/i,
    redflag: /chest pain|pain in (my|the) chest|can'?t breathe|hard to breathe|short(ness)? of breath|fainted|passed out|lost consciousness/i,
    crisisReply: 'I\'m here and I take this seriously. Your life matters. Please talk right now to someone trained to help at a moment like this (numbers in Poland):',
    crisisOutro: 'You can keep writing to me. Is there someone close by you can call or text right now?',
    lines: ['if you are in danger right now', 'helpline for adults in emotional crisis', 'Support Centre, 24/7', 'helpline for children and young people'],
    redflagReply: 'This may be urgent. If the chest pain is strong, it is hard to breathe, something suddenly goes numb or someone loses consciousness, don\'t wait: call <a class="hy-tel" href="tel:112">112</a>.',
    onlyPolish: 'Without the server I can only chat in Polish for now. You can switch to Polish in <a href="#wiecej">More → Language</a>, or tap <a href="#" onclick="openVoiceCall(); return false">Call</a>: the voice conversation works in English.'
  },
  uk: {
    error: 'Вибач, сталася помилка.', retry: 'Вибач, спробуй ще раз.', connection: 'Вибач, зараз є проблеми зі з\'єднанням.',
    crisis: /не хочу жити|не хочу більше жити|покінчити з собою|вбити себе|убити себе|суїцид|самогубств|хочу померти|завдати собі шкоди/i,
    redflag: /біль у грудях|болить у грудях|не можу дихати|важко дихати|задихаюсь|знепритомн|втратив свідомість|втратила свідомість/i,
    crisisReply: 'Я тут і ставлюся до цього серйозно. Твоє життя важливе. Будь ласка, зателефонуй зараз тому, хто вміє допомогти в такий момент (номери в Польщі):',
    crisisOutro: 'Ти можеш і далі мені писати. Чи є зараз поруч хтось, кому можна зателефонувати або написати?',
    lines: ['якщо тобі зараз загрожує небезпека', 'телефон довіри для дорослих у кризі', 'Центр підтримки, цілодобово', 'телефон довіри для дітей і молоді'],
    redflagReply: 'Це може бути терміново. Якщо біль у грудях сильний, важко дихати, щось раптово німіє або хтось втрачає свідомість — не чекай, телефонуй на <a class="hy-tel" href="tel:112">112</a>.',
    onlyPolish: 'Без сервера я поки що можу писати лише польською. Можеш перемкнути мову на польську в <a href="#wiecej">Більше → Мова</a> або натиснути <a href="#" onclick="openVoiceCall(); return false">Дзвінок</a>: голосова розмова працює українською.'
  },
  de: {
    error: 'Entschuldige, da ist etwas schiefgelaufen.', retry: 'Entschuldige, versuch es noch einmal.', connection: 'Entschuldige, ich habe gerade Verbindungsprobleme.',
    crisis: /umbringen|selbstmord|suizid|nicht mehr leben|will sterben|möchte sterben|mich (selbst )?verletzen|mir das leben nehmen/i,
    redflag: /brustschmerz|schmerzen in der brust|bekomme keine luft|kann nicht atmen|atemnot|ohnmächtig|bewusstlos/i,
    crisisReply: 'Ich bin da und nehme das ernst. Dein Leben ist wichtig. Bitte sprich jetzt mit jemandem, der in so einem Moment helfen kann (Nummern in Polen):',
    crisisOutro: 'Du kannst mir weiter schreiben. Gibt es gerade jemanden in deiner Nähe, den du anrufen oder dem du schreiben kannst?',
    lines: ['wenn du gerade in Gefahr bist', 'Krisentelefon für Erwachsene', 'Hilfezentrum, rund um die Uhr', 'Hilfetelefon für Kinder und Jugendliche'],
    redflagReply: 'Das kann dringend sein. Wenn der Brustschmerz stark ist, das Atmen schwerfällt, plötzlich etwas taub wird oder jemand bewusstlos wird – warte nicht, ruf die <a class="hy-tel" href="tel:112">112</a> an.',
    onlyPolish: 'Ohne Server kann ich gerade nur auf Polnisch schreiben. Du kannst unter <a href="#wiecej">Mehr → Sprache</a> auf Polnisch umstellen oder auf <a href="#" onclick="openVoiceCall(); return false">Anrufen</a> tippen: Das Sprachgespräch funktioniert auf Deutsch.'
  },
  es: {
    error: 'Lo siento, ha ocurrido un error.', retry: 'Lo siento, inténtalo de nuevo.', connection: 'Lo siento, ahora mismo tengo problemas de conexión.',
    crisis: /suicid|matarme|quiero morir|no quiero vivir|hacerme daño|quitarme la vida|acabar con mi vida/i,
    redflag: /dolor (en el|de) pecho|no puedo respirar|me cuesta respirar|me falta el aire|me desmay|perd\w* el conocimiento/i,
    crisisReply: 'Estoy aquí y me lo tomo en serio. Tu vida importa. Por favor, habla ahora con alguien preparado para ayudar en un momento así (números en Polonia):',
    crisisOutro: 'Puedes seguir escribiéndome. ¿Hay alguien cerca a quien puedas llamar o escribir ahora mismo?',
    lines: ['si estás en peligro ahora', 'línea de ayuda para adultos en crisis emocional', 'Centro de Apoyo, 24 h', 'línea de ayuda para niños y jóvenes'],
    redflagReply: 'Puede ser urgente. Si el dolor en el pecho es fuerte, cuesta respirar, algo se adormece de repente o alguien pierde el conocimiento, no esperes: llama al <a class="hy-tel" href="tel:112">112</a>.',
    onlyPolish: 'Sin el servidor, por ahora solo puedo escribir en polaco. Puedes cambiar a polaco en <a href="#wiecej">Más → Idioma</a> o tocar <a href="#" onclick="openVoiceCall(); return false">Llamar</a>: la llamada de voz funciona en español.'
  }
};
const chatText = () => CHAT_FALLBACK[currentLanguage] || CHAT_FALLBACK.pl;
function offlineReply(text) {
  const offline = window.DocoOffline;
  if (!offline) return null;
  // The diary (kontekst.js) lets the chat pick up the thread: 'Widzę w dzienniku, że wczoraj zapisano ból…'
  if (currentLanguage === 'pl') {
    offlineChat = offlineChat || offline.create({ context: () => window.DocoContext && window.DocoContext.get() });
    return offlineChat.reply(text);
  }
  const t = chatText();
  const topic = offline.detect(text).topic;
  let html;
  if (topic === 'crisis' || t.crisis.test(text)) {
    const numbers = [['112', '112'], ['116123', '116 123'], ['800702222', '800 70 2222'], ['116111', '116 111']];
    html = t.crisisReply + '<span class="hy-help">' + numbers.map(([tel, label], i) => `<a class="hy-tel-row" href="tel:${tel}"><strong>${label}</strong><span>${t.lines[i]}</span></a>`).join('') + '</span>' + t.crisisOutro;
  } else if (topic === 'redflag' || t.redflag.test(text)) {
    html = t.redflagReply;
  } else {
    html = t.onlyPolish;
  }
  return { html, text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), delay: 700 };
}

// Doco takes a moment before answering: the dots and a line that changes while the answer is prepared
const THINKING = {
  pl: ['Doco myśli…', 'Sprawdzam w bazie wiedzy…', 'Układam odpowiedź…'],
  en: ['Doco is thinking…', 'Checking the knowledge base…', 'Putting the answer together…'],
  uk: ['Doco думає…', 'Перевіряю базу знань…', 'Складаю відповідь…'],
  de: ['Doco denkt nach…', 'Ich schaue in der Wissensbasis nach…', 'Ich formuliere die Antwort…'],
  es: ['Doco está pensando…', 'Consultando la base de conocimientos…', 'Preparando la respuesta…'],
};
let typingTimer = null;
function showTyping() {
  removeTyping();
  const { row, bubble } = messageRow('ai', 'typing-indicator');
  row.id = 'typingRow';
  bubble.setAttribute('role', 'status');
  bubble.innerHTML = '<div class="typing-dots" aria-hidden="true"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div><span class="typing-label"></span>';
  chatWindow.append(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  const steps = THINKING[currentLanguage] || THINKING.pl;
  const label = bubble.querySelector('.typing-label');
  let step = 0;
  label.textContent = steps[0];
  typingTimer = setInterval(() => {
    if (step >= steps.length - 1) return;
    label.textContent = steps[++step];
    label.classList.remove('swap');
    void label.offsetWidth;
    label.classList.add('swap');
  }, 1000);
}
function removeTyping() {
  clearInterval(typingTimer);
  typingTimer = null;
  $id('typingRow')?.remove();
}
function sendSuggestion(text) { input.value = text; sendMessage(); }

// Doco AI (doco-ai/ on Vercel, address in ai-config.js) answers with a language model, grounded in the checked
// knowledge base. Crisis and emergency messages never wait for it: the offline companion's checked reply with the
// numbers comes at once. Neither do requests that aren't about health (a recipe, homework, code, the weather):
// Doco says it only talks about health and wellbeing.
function safetyFirst(text) {
  const offline = window.DocoOffline;
  if (!offline) return false;
  if (currentLanguage === 'pl') return ['crisis', 'redflag', 'violence', 'assault', 'offtopic'].includes(offline.detect(text).topic);
  const t = chatText();
  return !!(t.crisis && (t.crisis.test(text) || t.redflag.test(text)));
}
const SOURCES_LABEL = { pl: 'Źródła', en: 'Sources', uk: 'Джерела', de: 'Quellen', es: 'Fuentes' };
const sourcesHtml = (list) => (list || []).length ? `<span class="hy-reminder">${SOURCES_LABEL[currentLanguage] || SOURCES_LABEL.pl}: ` +
  list.map((s) => `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.publisher)}</a>`).join(' ') + '</span>' : '';

// The AI's answer, or false when there is no server, it fails, is out of credit or takes over 20 s
async function askDocoAi() {
  if (!window.DOCO_AI_URL) return false;
  try {
    const res = await fetch(window.DOCO_AI_URL, {
      method: 'POST',
      signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined,
      headers: { 'Content-Type': 'application/json' },
      // context: what the person saved in the app (mood, pain diary, symptom checks), so the AI can pick up the thread
      body: JSON.stringify({ messages: conversationHistory, language: currentLanguage, context: window.DocoContext ? window.DocoContext.summary() : '' }),
    });
    const data = await res.json();
    if (!res.ok || !data.reply) return false;
    removeTyping();
    conversationHistory.push({ role: 'assistant', content: data.reply });
    appendMessage('ai', escapeHtml(data.reply) + sourcesHtml(data.sources));
    return true;
  } catch (e) {
    return false;
  }
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  fitInput();
  appendMessage('user', escapeHtml(text));
  conversationHistory.push({ role: 'user', content: text });
  showTyping();
  // The offline companion reads every message, so it follows the thread. Its checked reply is shown when it has to
  // answer here (crisis, emergency, off-topic, the pain questions and the muscle advice they lead to) or when the AI can't.
  const offline = offlineReply(text);
  const here = safetyFirst(text) || (offline && offline.local);
  if (!here && await askDocoAi()) return;
  if (offline) {
    await new Promise((done) => setTimeout(done, offline.delay));
    removeTyping();
    conversationHistory.push({ role: 'assistant', content: offline.text });
    appendMessage('ai', offline.html);
    return;
  }
  removeTyping();
  appendMessage('ai', chatText().connection);
}

// ── Start ─────────────────────────────────────────────────────────────
// After every script has hooked into the functions above (they load after this one)
document.addEventListener('DOMContentLoaded', () => {
  updateLangUI();
  updateInterfaceLanguage(currentLanguage);
  updateAuthUI(currentUser);
});
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
