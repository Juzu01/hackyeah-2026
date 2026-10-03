// The app shell around Soleil: the tab bar and its sections (#rozmowa, #nastroj, #cialo,
// #objawy, #wiecej), the mood diary kept on this device, and adding Soleil to the home screen.
// Loaded after the page's own scripts; it only adds to them.
(function () {
  const $ = (id) => document.getElementById(id);
  const app = $('app');
  const VIEWS = ['rozmowa', 'nastroj', 'cialo', 'objawy', 'wiecej'];

  // ── Sections ────────────────────────────────────────────────────────
  // The atlas and "Gdzie boli?" are their own pages, shown in a frame so the tab bar stays;
  // each loads the first time its tab is opened.
  function show(view) {
    if (!VIEWS.includes(view)) view = 'rozmowa';
    app.dataset.view = view;
    VIEWS.forEach((v) => {
      const section = $('view-' + v);
      section.hidden = v !== view;
      const frame = section.querySelector('iframe[data-src]');
      if (v === view && frame && !frame.src) frame.src = frame.dataset.src;
    });
    document.querySelectorAll('.tab').forEach((t) => {
      if (t.dataset.view === view) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    $('userMenu')?.classList.remove('visible');
    if (view === 'nastroj') renderWeek();
    if (view === 'wiecej') renderMore();
  }
  const fromHash = () => show(location.hash.slice(1));
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
  const NAMES = { 1: 'Bardzo źle', 2: 'Źle', 3: 'Średnio', 4: 'Dobrze', 5: 'Świetnie' };
  const TONES = { 1: '#8fa3c2', 2: '#9fb8bb', 3: '#b9c9bf', 4: '#b4e3c8', 5: '#a6e8c4' };
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
      ? `Zapisano: ${NAMES[picked].toLowerCase()}. Możesz to zmienić w ciągu dnia.`
      : 'Nie udało się zapisać na tym urządzeniu (tryb prywatny?).';
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

  const DAY = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' });
  function renderWeek() {
    const all = load();
    const today = all[dayKey(new Date())];
    if (today && picked === null) {
      pick(today.mood);
      $('hyMoodNote').value = today.note || '';
      $('hyMoodStatus').textContent = 'Dzisiejszy nastrój jest już zapisany. Możesz go zmienić.';
    }
    const week = $('hyWeek');
    week.innerHTML = '';
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const entry = all[dayKey(d)];
      const li = document.createElement('li');
      const label = i === 0 ? 'dziś' : DAY.format(d).replace('.', '');
      if (entry) {
        li.className = 'has';
        li.style.setProperty('--tone', TONES[entry.mood]);
        li.innerHTML = `<svg aria-hidden="true"><use href="#face-${entry.mood}"/></svg><span></span>`;
        li.setAttribute('aria-label', `${label}: ${NAMES[entry.mood]}`);
      } else {
        li.innerHTML = '<i class="none" aria-hidden="true"></i><span></span>';
        li.setAttribute('aria-label', `${label}: brak wpisu`);
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
    $('hyAccountWho').textContent = user ? `Zalogowano: ${name || 'konto Soleil'}` : 'Piszesz bez konta.';
    $('hyAccountWhy').textContent = user
      ? 'Soleil pamięta Twoje rozmowy, a słuchawka przy polu pisania łączy Cię z Soleil głosem.'
      : 'Z kontem Soleil zapamięta rozmowy, a słuchawka połączy Cię z Soleil głosem.';
    const btn = $('hyAccountBtn');
    btn.querySelector('span').textContent = user ? 'Wyloguj się' : 'Zaloguj się';
    btn.querySelector('use').setAttribute('href', user ? '#i-logout' : '#i-login');
    btn.onclick = user ? () => window.signOut() : () => window.openAuth();
    $('hyLangValue').textContent = LANG_NAMES[lang$()] || LANG_NAMES.pl;
  }
  // Keep the section in step with logging in and out, and with the language.
  if (typeof window.updateAuthUI === 'function') {
    const base = window.updateAuthUI;
    window.updateAuthUI = function (user) {
      base(user);
      renderMore();
    };
  }
  if (typeof window.setLanguage === 'function') {
    const base = window.setLanguage;
    window.setLanguage = function (lang) {
      const out = base(lang);
      renderMore();
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
      $('hyInstallText').textContent = 'Soleil jest już na ekranie głównym tego urządzenia.';
      steps.innerHTML = '';
      return;
    }
    $('hyInstallText').textContent = 'Soleil działa jak aplikacja, bez sklepu i bez instalowania czegokolwiek.';
    steps.innerHTML = isIOS
      ? '<li>Otwórz tę stronę w <strong>Safari</strong>.</li><li>Stuknij <strong>Udostępnij</strong> (kwadrat ze strzałką w górę).</li><li>Wybierz <strong>Do ekranu początkowego</strong>, potem <strong>Dodaj</strong>.</li>'
      : promptEvent
        ? '<li>Stuknij <strong>Dodaj teraz</strong> poniżej.</li>'
        : '<li>Otwórz menu przeglądarki (trzy kropki).</li><li>Wybierz <strong>Dodaj do ekranu głównego</strong> albo <strong>Zainstaluj aplikację</strong>.</li>';
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

  fromHash();
})();
