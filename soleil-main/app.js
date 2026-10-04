// The app shell around Doco: the tab bar and its sections (#rozmowa, #nastroj, #cialo,
// #objawy, #wiecej), the mood diary kept on this device, and adding Doco to the home screen.
// Loaded after the page's own scripts; it only adds to them.
(function () {
  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const VIEWS = ['rozmowa', 'nastroj', 'cialo', 'objawy', 'dziennik', 'wiecej'];

  // ── Languages ───────────────────────────────────────────────────────
  // The page translates its own parts (updateInterfaceLanguage); these are the parts this shell adds.
  const CRISIS = { a112: '<a href="tel:112">112</a>', line: '<a href="tel:800702222">800 70 2222</a>' };
  const SHELL = {
    pl: {
      locale: 'pl-PL', chooseLanguage: 'Wybierz język', loadingQuote: 'Ładowanie cytatu dnia…', tabsLabel: 'Sekcje aplikacji',
      tabs: { rozmowa: 'Rozmowa', dziennik: 'Dziennik', nastroj: 'Nastrój', cialo: 'Ciało', objawy: 'Objawy', wiecej: 'Więcej' },
      moodTitle: 'Jak się dziś czujesz?', moodLead: 'Wybierz jedną twarz. Zapisuje się tylko na tym urządzeniu.',
      faces: ['Bardzo źle', 'Źle', 'Średnio', 'Dobrze', 'Świetnie'], notePh: 'Chcesz coś dodać? (nie musisz)', noteLabel: 'Notatka do nastroju',
      save: 'Zapisz nastrój', saved: (n) => `Zapisano: ${n}. Możesz to zmienić w ciągu dnia.`, fail: 'Nie udało się zapisać na tym urządzeniu (tryb prywatny?).',
      todaySaved: 'Dzisiejszy nastrój jest już zapisany. Możesz go zmienić.', week: 'Ostatnie 7 dni', weekLabel: 'Nastrój w ostatnich 7 dniach', today: 'dziś', none: 'brak wpisu',
      more: 'Więcej', guest: 'Piszesz bez konta.', user: (n) => `Zalogowano: ${n}`, someone: 'konto Doco',
      whyGuest: 'Z kontem Doco zapamięta rozmowy, a słuchawka połączy Cię z Doco głosem.',
      whyUser: 'Doco pamięta Twoje rozmowy, a słuchawka łączy Cię z Doco głosem.',
      login: 'Zaloguj się', register: 'Załóż konto', logout: 'Wyloguj się', language: 'Język', voice: 'Głos Doco w rozmowie telefonicznej', install: 'Dodaj do ekranu głównego',
      fine: `Doco nie jest lekarzem ani terapeutą. W nagłej sytuacji dzwoń pod ${CRISIS.a112}, a w kryzysie psychicznym pod ${CRISIS.line} (całą dobę).`,
      installed: 'Doco jest już na ekranie głównym tego urządzenia.', installText: 'Doco działa jak aplikacja, bez sklepu i bez instalowania czegokolwiek.',
      iosSteps: '<li>Otwórz tę stronę w <strong>Safari</strong>.</li><li>Stuknij <strong>Udostępnij</strong> (kwadrat ze strzałką w górę).</li><li>Wybierz <strong>Do ekranu początkowego</strong>, potem <strong>Dodaj</strong>.</li>',
      promptSteps: '<li>Stuknij <strong>Dodaj teraz</strong> poniżej.</li>',
      menuSteps: '<li>Otwórz menu przeglądarki (trzy kropki).</li><li>Wybierz <strong>Dodaj do ekranu głównego</strong> albo <strong>Zainstaluj aplikację</strong>.</li>',
      installNow: 'Dodaj teraz',
      nameTitle: 'Jak mam się do Ciebie zwracać?', nameLead: 'Nie musisz. Jeśli podasz imię, Doco będzie mówić do Ciebie po imieniu — w czacie i w rozmowie głosowej.', namePh: 'Twoje imię', nameSave: 'Zapisz', nameSkip: 'Pomiń', nameError: 'Nie udało się zapisać imienia. Spróbuj jeszcze raz.', nameRow: 'Jak mam się do Ciebie zwracać', nameNone: 'nie podano',
      accent: 'Kolor aplikacji', accentLead: 'Wybierz tryb i kolor, które lubisz. Zapamiętamy je na tym urządzeniu.', themeLabel: 'Tryb', colorLabel: 'Kolor',
      themeNames: ['Ciemny', 'Jasny', 'Systemowy'], accentDone: 'Gotowe',
      accentNames: ['Mięta', 'Szałwia', 'Limonka', 'Cytryna', 'Bursztyn', 'Koral', 'Róż', 'Fiołek', 'Lawenda', 'Błękit', 'Turkus', 'Srebro']
    },
    en: {
      locale: 'en-GB', chooseLanguage: 'Choose a language', loadingQuote: 'Loading the thought of the day…', tabsLabel: 'App sections',
      tabs: { rozmowa: 'Chat', dziennik: 'Diary', nastroj: 'Mood', cialo: 'Body', objawy: 'Symptoms', wiecej: 'More' },
      moodTitle: 'How are you feeling today?', moodLead: 'Pick one face. It is saved only on this device.',
      faces: ['Very bad', 'Bad', 'Okay', 'Good', 'Great'], notePh: 'Want to add something? (optional)', noteLabel: 'Mood note',
      save: 'Save mood', saved: (n) => `Saved: ${n}. You can change it during the day.`, fail: 'Couldn\'t save on this device (private mode?).',
      todaySaved: 'Today\'s mood is already saved. You can change it.', week: 'Last 7 days', weekLabel: 'Mood over the last 7 days', today: 'today', none: 'no entry',
      more: 'More', guest: 'You\'re writing without an account.', user: (n) => `Signed in: ${n}`, someone: 'Doco account',
      whyGuest: 'With an account, Doco remembers your conversations, and the phone connects you to Doco by voice.',
      whyUser: 'Doco remembers your conversations, and the phone connects you to Doco by voice.',
      login: 'Sign in', register: 'Create account', logout: 'Sign out', language: 'Language', voice: 'Doco\'s voice for calls', install: 'Add to home screen',
      fine: `Doco is not a doctor or a therapist. In an emergency call ${CRISIS.a112}; in a mental health crisis call ${CRISIS.line} (24/7, Poland).`,
      installed: 'Doco is already on this device\'s home screen.', installText: 'Doco works like an app, with no store and nothing to install.',
      iosSteps: '<li>Open this page in <strong>Safari</strong>.</li><li>Tap <strong>Share</strong> (the square with an up arrow).</li><li>Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>',
      promptSteps: '<li>Tap <strong>Add now</strong> below.</li>',
      menuSteps: '<li>Open the browser menu (three dots).</li><li>Choose <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li>',
      installNow: 'Add now',
      nameTitle: 'What should I call you?', nameLead: 'Optional. If you tell me your name, Doco will use it in the chat and in voice calls.', namePh: 'Your first name', nameSave: 'Save', nameSkip: 'Skip', nameError: 'Couldn\'t save your name. Please try again.', nameRow: 'What should I call you', nameNone: 'not set',
      accent: 'App colour', accentLead: 'Pick the mode and colour you like. They\'re remembered on this device.', themeLabel: 'Mode', colorLabel: 'Colour',
      themeNames: ['Dark', 'Light', 'System'], accentDone: 'Done',
      accentNames: ['Mint', 'Sage', 'Lime', 'Lemon', 'Amber', 'Coral', 'Pink', 'Violet', 'Lavender', 'Sky blue', 'Turquoise', 'Silver']
    },
    uk: {
      locale: 'uk-UA', chooseLanguage: 'Обери мову', loadingQuote: 'Завантаження думки дня…', tabsLabel: 'Розділи застосунку',
      tabs: { rozmowa: 'Розмова', dziennik: 'Щоденник', nastroj: 'Настрій', cialo: 'Тіло', objawy: 'Симптоми', wiecej: 'Більше' },
      moodTitle: 'Як ти сьогодні почуваєшся?', moodLead: 'Обери одне обличчя. Зберігається лише на цьому пристрої.',
      faces: ['Дуже погано', 'Погано', 'Так собі', 'Добре', 'Чудово'], notePh: 'Хочеш щось додати? (необов\'язково)', noteLabel: 'Нотатка до настрою',
      save: 'Зберегти настрій', saved: (n) => `Збережено: ${n}. Можна змінити протягом дня.`, fail: 'Не вдалося зберегти на цьому пристрої (приватний режим?).',
      todaySaved: 'Сьогоднішній настрій уже збережено. Його можна змінити.', week: 'Останні 7 днів', weekLabel: 'Настрій за останні 7 днів', today: 'сьогодні', none: 'немає запису',
      more: 'Більше', guest: 'Ти пишеш без облікового запису.', user: (n) => `Обліковий запис: ${n}`, someone: 'Doco',
      whyGuest: 'З обліковим записом Doco пам\'ятатиме розмови, а слухавка з\'єднає тебе з Doco голосом.',
      whyUser: 'Doco пам\'ятає твої розмови, а слухавка з\'єднує тебе з Doco голосом.',
      login: 'Увійти', register: 'Створити акаунт', logout: 'Вийти', language: 'Мова', voice: 'Голос Doco для дзвінків', install: 'Додати на головний екран',
      fine: `Doco не є лікарем чи терапевтом. У надзвичайній ситуації телефонуй на ${CRISIS.a112}, а в психологічній кризі — на ${CRISIS.line} (цілодобово, Польща).`,
      installed: 'Doco уже є на головному екрані цього пристрою.', installText: 'Doco працює як застосунок — без магазину й без встановлення.',
      iosSteps: '<li>Відкрий цю сторінку в <strong>Safari</strong>.</li><li>Натисни <strong>Поділитися</strong> (квадрат зі стрілкою вгору).</li><li>Обери <strong>На початковий екран</strong>, потім <strong>Додати</strong>.</li>',
      promptSteps: '<li>Натисни <strong>Додати зараз</strong> нижче.</li>',
      menuSteps: '<li>Відкрий меню браузера (три крапки).</li><li>Обери <strong>Додати на головний екран</strong> або <strong>Встановити застосунок</strong>.</li>',
      installNow: 'Додати зараз',
      nameTitle: 'Як до тебе звертатися?', nameLead: 'Необов\'язково. Якщо вкажеш ім\'я, Doco звертатиметься до тебе на ім\'я — у чаті й у голосовій розмові.', namePh: 'Твоє ім\'я', nameSave: 'Зберегти', nameSkip: 'Пропустити', nameError: 'Не вдалося зберегти ім\'я. Спробуй ще раз.', nameRow: 'Як до тебе звертатися', nameNone: 'не вказано',
      accent: 'Колір застосунку', accentLead: 'Обери режим і колір, які тобі подобаються. Ми запам\'ятаємо їх на цьому пристрої.', themeLabel: 'Режим', colorLabel: 'Колір',
      themeNames: ['Темний', 'Світлий', 'Системний'], accentDone: 'Готово',
      accentNames: ['М\'ята', 'Шавлія', 'Лайм', 'Лимон', 'Бурштин', 'Корал', 'Рожевий', 'Фіалка', 'Лаванда', 'Блакитний', 'Бірюза', 'Срібло']
    },
    de: {
      locale: 'de-DE', chooseLanguage: 'Sprache wählen', loadingQuote: 'Gedanke des Tages wird geladen…', tabsLabel: 'Bereiche der App',
      tabs: { rozmowa: 'Chat', dziennik: 'Tagebuch', nastroj: 'Stimmung', cialo: 'Körper', objawy: 'Symptome', wiecej: 'Mehr' },
      moodTitle: 'Wie fühlst du dich heute?', moodLead: 'Wähle ein Gesicht. Es wird nur auf diesem Gerät gespeichert.',
      faces: ['Sehr schlecht', 'Schlecht', 'Mittel', 'Gut', 'Super'], notePh: 'Möchtest du etwas hinzufügen? (optional)', noteLabel: 'Notiz zur Stimmung',
      save: 'Stimmung speichern', saved: (n) => `Gespeichert: ${n}. Du kannst es im Laufe des Tages ändern.`, fail: 'Speichern auf diesem Gerät nicht möglich (privater Modus?).',
      todaySaved: 'Deine Stimmung für heute ist schon gespeichert. Du kannst sie ändern.', week: 'Letzte 7 Tage', weekLabel: 'Stimmung der letzten 7 Tage', today: 'heute', none: 'kein Eintrag',
      more: 'Mehr', guest: 'Du schreibst ohne Konto.', user: (n) => `Angemeldet: ${n}`, someone: 'Doco-Konto',
      whyGuest: 'Mit einem Konto merkt sich Doco eure Gespräche, und der Hörer verbindet dich per Stimme mit Doco.',
      whyUser: 'Doco merkt sich eure Gespräche, und der Hörer verbindet dich per Stimme mit Doco.',
      login: 'Anmelden', register: 'Konto erstellen', logout: 'Abmelden', language: 'Sprache', voice: 'Docos Stimme für Anrufe', install: 'Zum Startbildschirm hinzufügen',
      fine: `Doco ist weder Arzt noch Therapeut. Im Notfall wähle ${CRISIS.a112}, in einer psychischen Krise ${CRISIS.line} (rund um die Uhr, Polen).`,
      installed: 'Doco ist schon auf dem Startbildschirm dieses Geräts.', installText: 'Doco funktioniert wie eine App – ohne Store und ohne Installation.',
      iosSteps: '<li>Öffne diese Seite in <strong>Safari</strong>.</li><li>Tippe auf <strong>Teilen</strong> (Quadrat mit Pfeil nach oben).</li><li>Wähle <strong>Zum Home-Bildschirm</strong> und dann <strong>Hinzufügen</strong>.</li>',
      promptSteps: '<li>Tippe unten auf <strong>Jetzt hinzufügen</strong>.</li>',
      menuSteps: '<li>Öffne das Browsermenü (drei Punkte).</li><li>Wähle <strong>Zum Startbildschirm hinzufügen</strong> oder <strong>App installieren</strong>.</li>',
      installNow: 'Jetzt hinzufügen',
      nameTitle: 'Wie soll ich dich nennen?', nameLead: 'Freiwillig. Wenn du deinen Namen angibst, spricht Doco dich im Chat und im Sprachgespräch damit an.', namePh: 'Dein Vorname', nameSave: 'Speichern', nameSkip: 'Überspringen', nameError: 'Der Name konnte nicht gespeichert werden. Versuch es noch einmal.', nameRow: 'Wie soll ich dich nennen', nameNone: 'nicht angegeben',
      accent: 'App-Farbe', accentLead: 'Wähle den Modus und die Farbe, die dir gefallen. Sie werden auf diesem Gerät gespeichert.', themeLabel: 'Modus', colorLabel: 'Farbe',
      themeNames: ['Dunkel', 'Hell', 'System'], accentDone: 'Fertig',
      accentNames: ['Minze', 'Salbei', 'Limette', 'Zitrone', 'Bernstein', 'Koralle', 'Rosa', 'Veilchen', 'Lavendel', 'Himmelblau', 'Türkis', 'Silber']
    },
    es: {
      locale: 'es-ES', chooseLanguage: 'Elige un idioma', loadingQuote: 'Cargando el pensamiento del día…', tabsLabel: 'Secciones de la app',
      tabs: { rozmowa: 'Chat', dziennik: 'Diario', nastroj: 'Ánimo', cialo: 'Cuerpo', objawy: 'Síntomas', wiecej: 'Más' },
      moodTitle: '¿Cómo te sientes hoy?', moodLead: 'Elige una cara. Solo se guarda en este dispositivo.',
      faces: ['Muy mal', 'Mal', 'Regular', 'Bien', 'Genial'], notePh: '¿Quieres añadir algo? (opcional)', noteLabel: 'Nota sobre tu ánimo',
      save: 'Guardar ánimo', saved: (n) => `Guardado: ${n}. Puedes cambiarlo durante el día.`, fail: 'No se pudo guardar en este dispositivo (¿modo privado?).',
      todaySaved: 'El ánimo de hoy ya está guardado. Puedes cambiarlo.', week: 'Últimos 7 días', weekLabel: 'Ánimo en los últimos 7 días', today: 'hoy', none: 'sin registro',
      more: 'Más', guest: 'Escribes sin cuenta.', user: (n) => `Sesión iniciada: ${n}`, someone: 'cuenta de Doco',
      whyGuest: 'Con una cuenta, Doco recuerda tus conversaciones y el teléfono te conecta con Doco por voz.',
      whyUser: 'Doco recuerda tus conversaciones y el teléfono te conecta con Doco por voz.',
      login: 'Iniciar sesión', register: 'Crear cuenta', logout: 'Cerrar sesión', language: 'Idioma', voice: 'Voz de Doco en las llamadas', install: 'Añadir a la pantalla de inicio',
      fine: `Doco no es médico ni terapeuta. En una emergencia llama al ${CRISIS.a112}; en una crisis de salud mental, al ${CRISIS.line} (24 h, Polonia).`,
      installed: 'Doco ya está en la pantalla de inicio de este dispositivo.', installText: 'Doco funciona como una app, sin tienda y sin instalar nada.',
      iosSteps: '<li>Abre esta página en <strong>Safari</strong>.</li><li>Toca <strong>Compartir</strong> (el cuadrado con la flecha hacia arriba).</li><li>Elige <strong>Añadir a pantalla de inicio</strong> y luego <strong>Añadir</strong>.</li>',
      promptSteps: '<li>Toca <strong>Añadir ahora</strong> abajo.</li>',
      menuSteps: '<li>Abre el menú del navegador (tres puntos).</li><li>Elige <strong>Añadir a pantalla de inicio</strong> o <strong>Instalar aplicación</strong>.</li>',
      installNow: 'Añadir ahora',
      nameTitle: '¿Cómo quieres que te llame?', nameLead: 'Es opcional. Si me dices tu nombre, Doco lo usará en el chat y en las llamadas de voz.', namePh: 'Tu nombre', nameSave: 'Guardar', nameSkip: 'Omitir', nameError: 'No se pudo guardar el nombre. Inténtalo de nuevo.', nameRow: 'Cómo quieres que te llame', nameNone: 'sin indicar',
      accent: 'Color de la app', accentLead: 'Elige el modo y el color que más te gusten. Se guardan en este dispositivo.', themeLabel: 'Modo', colorLabel: 'Color',
      themeNames: ['Oscuro', 'Claro', 'Sistema'], accentDone: 'Listo',
      accentNames: ['Menta', 'Salvia', 'Lima', 'Limón', 'Ámbar', 'Coral', 'Rosa', 'Violeta', 'Lavanda', 'Celeste', 'Turquesa', 'Plata']
    }
  };
  /* global currentLanguage */
  const T = () => SHELL[typeof currentLanguage !== 'undefined' ? currentLanguage : 'pl'] || SHELL.pl;
  const setText = (el, text) => { if (el) el.textContent = text; };

  function applyLanguage() {
    const t = T();
    document.querySelector('.tabbar')?.setAttribute('aria-label', t.tabsLabel);
    document.querySelectorAll('.tabs .tab').forEach((tab) => {
      const name = t.tabs[tab.dataset.view];
      setText(tab.querySelector('span'), name);
      if (tab.dataset.view) $('view-' + tab.dataset.view)?.setAttribute('aria-label', name);
    });
    setText($('moodHeading'), t.moodTitle);
    setText(document.querySelector('#view-nastroj .page-lead'), t.moodLead);
    document.querySelector('#view-nastroj .faces')?.setAttribute('aria-label', t.tabs.nastroj);
    faces.forEach((f) => setText(f.querySelector('span'), t.faces[Number(f.dataset.mood) - 1]));
    $('hyMoodNote').placeholder = t.notePh;
    $('hyMoodNote').setAttribute('aria-label', t.noteLabel);
    setText($('hyMoodSave'), t.save);
    setText(document.querySelector('#view-nastroj h3.page-sub'), t.week);
    $('hyWeek').setAttribute('aria-label', t.weekLabel);
    setText($('moreHeading'), t.more);
    const row = (sel) => document.querySelector(`#view-wiecej ${sel} .row-text`);
    setText(row('[onclick="openLanguage()"]'), t.language);
    setText(row('[onclick="openVoicePicker()"]'), t.voice);
    setText(row('#hyInstallRow'), t.install);
    setText($('hyNameRow'), t.nameRow);
    setText($('hyNameTitle'), t.nameTitle);
    setText($('hyNameLead'), t.nameLead);
    $('hyNameInput').placeholder = t.namePh;
    setText($('hyNameSave'), t.nameSave);
    setText($('hyNameSkip'), t.nameSkip);
    setText($('hyAccentRow'), t.accent);
    setText($('hyAccentTitle'), t.accent);
    setText($('hyAccentLead'), t.accentLead);
    setText($('hyThemeLabel'), t.themeLabel);
    setText($('hyColorLabel'), t.colorLabel);
    setText($('hyAccentDone'), t.accentDone);
    renderAppearance();
    if (typeof window.updateDiaryLanguage === 'function') window.updateDiaryLanguage();
    setText(document.querySelector('#hyInstallBtn span'), t.installNow);
    const fine = document.querySelector('#view-wiecej .fine');
    if (fine) fine.innerHTML = t.fine;
    setText(document.querySelector('#languageOverlay h2'), t.chooseLanguage);
    setText($('dailyLoading'), t.loadingQuote);
    document.documentElement.lang = typeof currentLanguage !== 'undefined' ? currentLanguage : 'pl';
  }

  // ── The light under the open tab ────────────────────────────────────
  // Its top lies exactly on the tab bar's slanted edge and its sides lean the same way, so the
  // open tab looks cut out of the bar rather than stuck onto it. Measured, so it fits any width.
  const bar = document.querySelector('.tabbar');
  const light = bar?.querySelector('.tabbar-lit');
  const lightEdge = bar?.querySelector('.tabbar-lit-edge');
  let lightPlaced = false;
  function placeLight(animate) {
    const tab = bar?.querySelector('.tab[aria-current="page"]');
    const b = bar?.getBoundingClientRect();
    if (!tab || !light || !lightEdge || !b.width) return;
    const r = tab.getBoundingClientRect();
    const slant = parseFloat(getComputedStyle(bar).getPropertyValue('--slant')) || 18;
    // The edge runs from (0, 15.5/16 of the slant) to (width, 0.5/16 of it); see .tabbar-edge.
    const edgeY = (x) => (slant * (15.5 - (15 * x) / b.width)) / 16;
    const left = r.left - b.left + 2;
    const right = r.right - b.left - 2;
    const bottom = r.bottom - b.top;
    const lean = (Math.tan((12 * Math.PI) / 180) * (bottom - edgeY(left))) / 2;
    const tl = left + lean;
    const tr = right + lean;
    const p = (x, y) => `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    const poly = (...pts) => `polygon(${pts.join(', ')})`;
    bar.classList.toggle('lit-still', !animate || !lightPlaced);
    light.style.clipPath = poly(p(tl, edgeY(tl)), p(tr, edgeY(tr)), p(right - lean, bottom), p(left - lean, bottom));
    lightEdge.style.clipPath = poly(p(tl, edgeY(tl) - 1.2), p(tr, edgeY(tr) - 1.2), p(tr, edgeY(tr) + 1.6), p(tl, edgeY(tl) + 1.6));
    lightPlaced = true;
    void light.offsetWidth;
    bar.classList.remove('lit-still');
  }
  window.addEventListener('resize', () => placeLight(false));

  // ── Sections ────────────────────────────────────────────────────────
  // The atlas and "Gdzie boli?" are their own pages, shown in a frame so the tab bar stays;
  // each loads the first time its tab is opened. Their pages are asked for afresh once per visit
  // (they're tiny; the scripts and styles they load are hashed and stay cached), so a deploy shows
  // in the tabs right away instead of after the browser's ten-minute page cache.
  const visit = Date.now().toString(36);
  function show(view) {
    if (!VIEWS.includes(view)) view = 'rozmowa';
    app.dataset.view = view;
    VIEWS.forEach((v) => {
      const section = $('view-' + v);
      section.hidden = v !== view;
      const frame = section.querySelector('iframe[data-src]');
      if (v === view && frame && !frame.src) frame.src = `${frame.dataset.src}?v=${visit}`;
    });
    document.querySelectorAll('.tab').forEach((t) => {
      if (t.dataset.view === view) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    placeLight(true);
    $('userMenu')?.classList.remove('visible');
    if (view === 'nastroj') renderWeek();
    if (view === 'wiecej') renderMore();
    if (view === 'dziennik' && typeof window.renderDiaryView === 'function') window.renderDiaryView();
  }
  // '#/…' belongs to Clerk's sign-in steps, not to a section: stay where we are
  const fromHash = () => {
    if (!location.hash.startsWith('#/')) show(location.hash.slice(1));
    else if (!app.dataset.view) show('rozmowa');
  };
  window.addEventListener('hashchange', fromHash);
  window.hyShowView = (view) => {
    if (location.hash === '#' + view) show(view);
    else location.hash = view;
  };

  // Links to the atlas or "Gdzie boli?" (in the chat's answers, for one) open their tab instead of leaving the app.
  const TAB_FOR = { 'cialo/': 'cialo', 'gdzie-boli/': 'objawy' };
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (url.origin !== location.origin) return;
    const path = url.pathname.slice(new URL('./', location.href).pathname.length);
    const view = TAB_FOR[path] || TAB_FOR[path + '/'];
    if (!view) return;
    e.preventDefault();
    window.hyShowView(view);
  });

  // The old mood popup and week summary needed a server; both now open the Nastrój section.
  window.openMood = () => window.hyShowView('nastroj');
  window.openSummary = () => window.hyShowView('nastroj');

  // ── Mood diary (this device only) ───────────────────────────────────
  const KEY = 'soleil_moods_v1';
  const moodName = (n) => T().faces[n - 1];
  const TONES = { 1: 'var(--mood-1)', 2: 'var(--mood-2)', 3: 'var(--mood-3)', 4: 'var(--mood-4)', 5: 'var(--green)' };
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const load = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    } catch (e) {
      return {};
    }
  };
  const store = (all) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(all));
      return true;
    } catch (e) {
      return false;
    }
  };

  let picked = null;
  const faces = document.querySelectorAll('.face');
  function pick(n) {
    picked = n;
    faces.forEach((f) => f.setAttribute('aria-checked', String(Number(f.dataset.mood) === n)));
    $('hyMoodSave').disabled = !n;
    $('hyMoodStatus').textContent = '';
  }
  faces.forEach((f) => f.addEventListener('click', () => pick(Number(f.dataset.mood))));

  $('hyMoodSave').addEventListener('click', () => {
    if (!picked) return;
    const all = load();
    all[dayKey(new Date())] = { mood: picked, note: $('hyMoodNote').value.trim(), at: Date.now() };
    $('hyMoodStatus').textContent = store(all)
      ? T().saved(moodName(picked).toLowerCase())
      : T().fail;
    renderWeek();
  });

  // The faces on the chat screen save today's mood here too (chat.js); a note written earlier stays.
  window.hyRecordMood = (n) => {
    const all = load();
    const key = dayKey(new Date());
    all[key] = { note: '', ...all[key], mood: n, at: Date.now() };
    picked = null;
    return store(all);
  };
  window.hyTodayMood = () => load()[dayKey(new Date())]?.mood || null;
  window.hyMoods = () => load(); // the diary (diary.js) shows the moods next to pain

  const day = (d) => new Intl.DateTimeFormat(T().locale, { weekday: 'short' }).format(d).replace('.', '');
  function renderWeek() {
    const all = load();
    const today = all[dayKey(new Date())];
    if (today && picked === null) {
      pick(today.mood);
      $('hyMoodNote').value = today.note || '';
      $('hyMoodStatus').textContent = T().todaySaved;
    }
    const week = $('hyWeek');
    week.innerHTML = '';
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const entry = all[dayKey(d)];
      const li = document.createElement('li');
      const label = i === 0 ? T().today : day(d);
      if (entry) {
        li.className = 'has';
        li.style.setProperty('--tone', TONES[entry.mood]);
        li.innerHTML = `<svg aria-hidden="true"><use href="#face-${entry.mood}"/></svg><span></span>`;
        li.setAttribute('aria-label', `${label}: ${moodName(entry.mood)}`);
      } else {
        li.innerHTML = '<i class="none" aria-hidden="true"></i><span></span>';
        li.setAttribute('aria-label', `${label}: ${T().none}`);
      }
      if (i === 0) li.classList.add('today');
      li.querySelector('span').textContent = label;
      week.append(li);
    }
  }

  // ── More: account, language, install ─────────────────────────────────
  const LANG_NAMES = { pl: 'Polski', en: 'English', uk: 'Українська', de: 'Deutsch', es: 'Español' };
  // The page's own state lives in top-level `let`s, which scripts share but window doesn't carry.
  /* global currentUser, currentLanguage */
  const user$ = () => (typeof currentUser !== 'undefined' ? currentUser : null);
  const lang$ = () => (typeof currentLanguage !== 'undefined' ? currentLanguage : 'pl');
  function renderMore() {
    const user = user$();
    const name = user && (`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.emailAddresses?.[0]?.emailAddress);
    $('hyAccountWho').textContent = user ? T().user(name || T().someone) : T().guest;
    $('hyAccountWhy').textContent = user ? T().whyUser : T().whyGuest;
    const btn = $('hyAccountBtn');
    btn.querySelector('span').textContent = user ? T().logout : T().login;
    btn.querySelector('use').setAttribute('href', user ? '#i-logout' : '#i-login');
    btn.onclick = user ? () => window.signOut() : () => window.openAuth();
    $('hyRegisterBtn').hidden = !!user;
    $('hyRegisterBtn').querySelector('span').textContent = T().register;
    $('hyLangValue').textContent = LANG_NAMES[lang$()] || LANG_NAMES.pl;
    $('hyNameRowItem').hidden = !user;
    $('hyNameValue').textContent = window.hyUserName() || T().nameNone;
  }
  // ── Name ──────────────────────────────────────────────────────────────
  // Optional first name on the Clerk account (the sign-up form asks for it too). Doco greets by it
  // in the chat (chat.js) and in voice calls (voice.js). Asked once after signing in if it's missing.
  /* global clerk */
  const account$ = () => user$() || (typeof clerk !== 'undefined' && clerk ? clerk.user : null);
  window.hyUserName = () => (account$()?.firstName || '').trim() || null;
  document.body.insertAdjacentHTML('beforeend', `
<div class="overlay" id="namePromptOverlay">
  <div class="popup" role="dialog" aria-modal="true" aria-labelledby="hyNameTitle">
    <button class="popup-close" onclick="hyCloseNamePrompt()" aria-label="✕">✕</button>
    <h2 id="hyNameTitle"></h2>
    <p id="hyNameLead"></p>
    <input class="field" id="hyNameInput" maxlength="40" autocomplete="given-name" enterkeyhint="done">
    <p class="saved-note" id="hyNameStatus" role="status"></p>
    <button type="button" class="btn-green" id="hyNameSave"></button>
    <button type="button" class="name-skip" id="hyNameSkip" onclick="hyCloseNamePrompt()"></button>
  </div>
</div>`);
  window.hyOpenNamePrompt = () => {
    if (!account$()) { window.openAuth(); return; }
    applyLanguage();
    $('hyNameInput').value = window.hyUserName() || '';
    $('hyNameStatus').textContent = '';
    window.pushOverlayState('namePromptOverlay');
    $('namePromptOverlay').classList.add('visible');
    setTimeout(() => $('hyNameInput').focus(), 50);
  };
  window.hyCloseNamePrompt = () => $('namePromptOverlay').classList.remove('visible');
  async function saveName() {
    const u = account$();
    if (!u) return;
    $('hyNameSave').disabled = true;
    try {
      await u.update({ firstName: $('hyNameInput').value.trim().slice(0, 40) });
      window.hyCloseNamePrompt();
      renderMore();
    } catch (e) {
      $('hyNameStatus').textContent = T().nameError;
    }
    $('hyNameSave').disabled = false;
  }
  $('hyNameSave').addEventListener('click', saveName);
  $('hyNameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(); });
  $('namePromptOverlay').addEventListener('click', (e) => { if (e.target.id === 'namePromptOverlay') window.hyCloseNamePrompt(); });
  function askNameOnce(user) {
    if (!user || (user.firstName || '').trim()) return;
    const key = 'doco_name_asked_' + user.id;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) { return; }
    setTimeout(window.hyOpenNamePrompt, 600); // after the sign-in popup has closed
  }

  // ── Mode and accent colour ────────────────────────────────────────────
  // Więcej → Kolor aplikacji: dark (the default), light or whatever the device uses, and twelve
  // colours. Each colour has a light one for black and a deeper one for light mode, both ≥ 4.8:1
  // against their background, and an ink for text on it. Everything green is var(--green), so one
  // colour on <html> repaints the app; the <head> script does the same before the first paint, and
  // "Gdzie boli?" and the atlas read the same keys (src/lib/accent.ts). The first colour is the default.
  const ACCENT_KEY = 'doco_accent';
  const THEME_KEY = 'doco_theme';
  const THEMES = ['dark', 'light', 'system'];
  const ACCENTS = [
    { accent: '#45e499', ink: '#04140c', light: { accent: '#048251', ink: '#ffffff' } },
    { accent: '#c0e4b2', ink: '#0b1307', light: { accent: '#4e7d3a', ink: '#ffffff' } },
    { accent: '#bdeb58', ink: '#121904', light: { accent: '#5d7b05', ink: '#ffffff' } },
    { accent: '#fade4e', ink: '#1b1601', light: { accent: '#837106', ink: '#ffffff' } },
    { accent: '#ffbd59', ink: '#211201', light: { accent: '#9f6401', ink: '#ffffff' } },
    { accent: '#ff9180', ink: '#250e0a', light: { accent: '#cf3a21', ink: '#ffffff' } },
    { accent: '#f990c4', ink: '#240e17', light: { accent: '#c8387e', ink: '#ffffff' } },
    { accent: '#e08ced', ink: '#1e0f21', light: { accent: '#ac44bd', ink: '#ffffff' } },
    { accent: '#baa3fe', ink: '#171226', light: { accent: '#8257d9', ink: '#ffffff' } },
    { accent: '#71bfff', ink: '#071727', light: { accent: '#0574c7', ink: '#ffffff' } },
    { accent: '#36dede', ink: '#001b1c', light: { accent: '#0a7e83', ink: '#ffffff' } },
    { accent: '#cdd3cc', ink: '#111311', light: { accent: '#4d524c', ink: '#ffffff' } },
  ];
  const read = (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
    } catch (e) {
      /* private mode: the choice lasts until the page closes */
    }
  };
  const savedTheme = () => (THEMES.includes(read(THEME_KEY)) ? read(THEME_KEY) : 'dark');
  // -1: something else is stored there
  const savedAccent = () => {
    try {
      const a = JSON.parse(read(ACCENT_KEY));
      return a ? ACCENTS.findIndex((c) => c.accent === a.accent) : 0;
    } catch (e) {
      return 0;
    }
  };
  // In private mode nothing can be read back, so the current choice is also kept here.
  let theme = savedTheme();
  let accent = savedAccent();
  const systemLight = matchMedia('(prefers-color-scheme: light)');
  const isLight = () => theme === 'light' || (theme === 'system' && systemLight.matches);
  function applyAppearance() {
    const root = document.documentElement;
    const light = isLight();
    if (light) root.dataset.theme = 'light';
    else delete root.dataset.theme;
    const c = accent > 0 && ACCENTS[accent];
    const v = c && (light ? c.light : c);
    if (v) {
      root.style.setProperty('--green', v.accent);
      root.style.setProperty('--green-ink', v.ink);
    } else {
      root.style.removeProperty('--green');
      root.style.removeProperty('--green-ink');
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f5f6f1' : '#000000');
    renderAppearance();
  }
  function setAccent(i) {
    accent = i;
    write(ACCENT_KEY, i > 0 ? JSON.stringify(ACCENTS[i]) : null);
    applyAppearance();
  }
  function setTheme(t) {
    theme = t;
    write(THEME_KEY, t === 'dark' ? null : t);
    applyAppearance();
  }
  document.body.insertAdjacentHTML('beforeend', `
<div class="overlay" id="accentOverlay">
  <div class="popup" role="dialog" aria-modal="true" aria-labelledby="hyAccentTitle">
    <button class="popup-close" onclick="hyCloseAccent()" aria-label="✕">✕</button>
    <h2 id="hyAccentTitle"></h2>
    <p id="hyAccentLead"></p>
    <p class="accent-label" id="hyThemeLabel"></p>
    <div class="theme-switch" role="radiogroup" aria-labelledby="hyThemeLabel">
      ${THEMES.map((t) => `<button type="button" role="radio" data-theme-pick="${t}"></button>`).join('')}
    </div>
    <p class="accent-label" id="hyColorLabel"></p>
    <div class="accent-grid" role="radiogroup" aria-labelledby="hyColorLabel">
      ${ACCENTS.map(() => '<button type="button" role="radio" class="accent-swatch"></button>').join('')}
    </div>
    <button type="button" class="btn-green" id="hyAccentDone" onclick="hyCloseAccent()"></button>
  </div>
</div>`);
  function renderAppearance() {
    const t = T();
    const light = isLight();
    const i = Math.max(0, accent);
    document.querySelectorAll('[data-theme-pick]').forEach((b, k) => {
      b.setAttribute('aria-checked', String(THEMES[k] === theme));
      b.textContent = t.themeNames[k];
    });
    document.querySelectorAll('.accent-swatch').forEach((b, k) => {
      const v = light ? ACCENTS[k].light : ACCENTS[k];
      b.style.setProperty('--sw', v.accent);
      b.style.setProperty('--sw-ink', v.ink);
      b.setAttribute('aria-checked', String(k === i));
      b.setAttribute('aria-label', t.accentNames[k]);
      b.title = t.accentNames[k];
    });
    setText($('hyAccentValue'), `${t.accentNames[i]} · ${t.themeNames[THEMES.indexOf(theme)].toLowerCase()}`);
  }
  document.querySelectorAll('[data-theme-pick]').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.themePick)));
  document.querySelectorAll('.accent-swatch').forEach((b, i) => b.addEventListener('click', () => setAccent(i)));
  window.hyOpenAccent = () => {
    renderAppearance();
    window.pushOverlayState('accentOverlay');
    $('accentOverlay').classList.add('visible');
  };
  window.hyCloseAccent = () => $('accentOverlay').classList.remove('visible');
  $('accentOverlay').addEventListener('click', (e) => { if (e.target.id === 'accentOverlay') window.hyCloseAccent(); });
  window.addEventListener('popstate', window.hyCloseAccent);
  // The device switched between light and dark
  systemLight.addEventListener('change', () => { if (theme === 'system') applyAppearance(); });
  // Changed in another tab of Doco
  window.addEventListener('storage', (e) => {
    if (e.key !== ACCENT_KEY && e.key !== THEME_KEY && e.key !== null) return;
    theme = savedTheme();
    accent = Math.max(0, savedAccent());
    applyAppearance();
  });
  // A colour that isn't one of the twelve goes back to the default, here and in the frames
  if (accent < 0) setAccent(0);
  else applyAppearance();

  // Keep the section in step with logging in and out, and with the language.
  if (typeof window.updateAuthUI === 'function') {
    const base = window.updateAuthUI;
    window.updateAuthUI = function (user) {
      base(user);
      renderMore();
      askNameOnce(user);
    };
  }
  if (typeof window.setLanguage === 'function') {
    const base = window.setLanguage;
    window.setLanguage = function (lang) {
      const out = base(lang);
      applyLanguage();
      renderMore();
      renderWeek();
      if (!$('hyInstallHow').hidden) renderInstall();
      return out;
    };
  }

  // Installing: Chrome and Edge offer a prompt; Safari on iPhone adds from the share sheet.
  let promptEvent = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    promptEvent = e;
    renderInstall();
  });
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function renderInstall() {
    const steps = $('hyInstallSteps');
    const btn = $('hyInstallBtn');
    btn.hidden = !promptEvent;
    if (standalone()) {
      $('hyInstallText').textContent = T().installed;
      steps.innerHTML = '';
      return;
    }
    $('hyInstallText').textContent = T().installText;
    steps.innerHTML = isIOS ? T().iosSteps : promptEvent ? T().promptSteps : T().menuSteps;
  }
  $('hyInstallRow').addEventListener('click', (e) => {
    const how = $('hyInstallHow');
    how.hidden = !how.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!how.hidden));
    renderInstall();
  });
  $('hyInstallBtn').addEventListener('click', async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    promptEvent = null;
    renderInstall();
  });


  // ── Keyboard ────────────────────────────────────────────────────────
  // Choices drawn as <div role="button"> (language, voice) work with Enter and Space; Esc closes the open popup.
  const CLOSE = {
    voiceOverlay: () => window.closeVoiceCall(),
    voicePickerOverlay: () => window.closeVoicePicker(),
    authOverlay: () => window.closeAuth(),
    languageOverlay: () => window.closeLanguage(),
    namePromptOverlay: () => window.hyCloseNamePrompt(),
    accentOverlay: () => window.hyCloseAccent(),
  };
  document.addEventListener('keydown', (e) => {
    const el = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && el.matches && el.matches('[role="button"]:not(button)')) {
      e.preventDefault();
      el.click();
    } else if (e.key === 'Escape') {
      const open = [...document.querySelectorAll('.overlay.visible')].pop();
      if (open) (CLOSE[open.id] || (() => open.classList.remove('visible')))();
      else $('userMenu')?.classList.remove('visible');
    }
  });

  applyLanguage();
  fromHash();
})();
