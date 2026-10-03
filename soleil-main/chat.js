// Soleil's chat screen: the sunrise scene, a greeting for the time of day, the mood faces and topic
// tiles that start a conversation, a minute of guided breathing, and quick replies under the offline
// companion's answers. Loaded last; it wraps the page's functions (the original runs first) and
// never rewrites them.
/* global sendSuggestion, currentLanguage, translations */
(function () {
  const $ = (id) => document.getElementById(id);
  const lang = () => (typeof currentLanguage !== 'undefined' && currentLanguage) || 'pl';

  // ── Words ───────────────────────────────────────────────────────────
  const L = {
    pl: {
      greet: { morning: 'Dzień dobry', day: 'Cześć', evening: 'Dobry wieczór', night: 'Nie możesz zasnąć?' },
      intro: 'Jestem Soleil. Napisz, co czujesz, albo stuknij poniżej.',
      introNight: 'Jestem tu też w nocy. Napisz, co nie daje Ci spać.',
      checkin: 'Jak się dziś czujesz?',
      breathe: 'Oddychaj ze mną · 1 min',
      breatheAria: 'Oddychaj ze mną przez minutę',
      names: ['Bardzo źle', 'Źle', 'Średnio', 'Dobrze', 'Świetnie'],
      say: ['Czuję się bardzo źle', 'Jest mi dziś źle', 'Tak sobie, średnio', 'Czuję się dobrze', 'Czuję się świetnie!'],
      inhale: 'Wdech', inhaleSub: 'nosem, powoli',
      exhale: 'Wydech', exhaleSub: 'ustami, dłużej',
      done: 'Dobra robota', doneSub: 'Jak się teraz czujesz?',
      stop: 'Zakończ',
      saved: 'Zapisano w dzienniku nastroju',
      yes: 'Tak, spróbuję', notNow: 'Nie teraz', withMe: 'Oddychaj ze mną',
      checker: 'Gdzie boli?', atlas: 'Atlas ciała',
      quick: 'Szybkie odpowiedzi',
      short: 'Napisz tutaj…',
      more: 'Pokaż inne tematy',
    },
    en: {
      greet: { morning: 'Good morning', day: 'Hi there', evening: 'Good evening', night: "Can't sleep?" },
      intro: "I'm Soleil. Write how you feel, or tap below.",
      introNight: "I'm here at night too. Tell me what keeps you awake.",
      checkin: 'How are you feeling today?',
      breathe: 'Breathe with me · 1 min',
      breatheAria: 'Breathe with me for a minute',
      names: ['Very bad', 'Bad', 'So-so', 'Good', 'Great'],
      say: ['I feel really bad', 'I feel bad today', 'So-so', 'I feel good', 'I feel great!'],
      inhale: 'Breathe in', inhaleSub: 'through your nose, slowly',
      exhale: 'Breathe out', exhaleSub: 'through your mouth, longer',
      done: 'Well done', doneSub: 'How do you feel now?',
      stop: 'Stop',
      saved: 'Saved in your mood diary',
      yes: "Yes, I'll try", notNow: 'Not now', withMe: 'Breathe with me',
      checker: 'Where does it hurt?', atlas: 'Body atlas',
      quick: 'Quick replies',
      short: 'Write here…',
      more: 'Show other topics',
    },
    uk: {
      greet: { morning: 'Доброго ранку', day: 'Привіт', evening: 'Добрий вечір', night: 'Не можеш заснути?' },
      intro: 'Я Soleil. Напиши, що відчуваєш, або торкнися нижче.',
      introNight: 'Я тут і вночі. Напиши, що не дає тобі спати.',
      checkin: 'Як ти сьогодні почуваєшся?',
      breathe: 'Дихай зі мною · 1 хв',
      breatheAria: 'Дихай зі мною одну хвилину',
      names: ['Дуже погано', 'Погано', 'Так собі', 'Добре', 'Чудово'],
      say: ['Мені дуже погано', 'Мені сьогодні погано', 'Так собі', 'Я почуваюся добре', 'Я почуваюся чудово!'],
      inhale: 'Вдих', inhaleSub: 'носом, повільно',
      exhale: 'Видих', exhaleSub: 'ротом, довше',
      done: 'Молодець', doneSub: 'Як ти зараз почуваєшся?',
      stop: 'Завершити',
      saved: 'Збережено в щоденнику настрою',
      yes: 'Так, спробую', notNow: 'Не зараз', withMe: 'Дихай зі мною',
      checker: 'Де болить?', atlas: 'Атлас тіла',
      quick: 'Швидкі відповіді',
      short: 'Напиши тут…',
      more: 'Інші теми',
    },
    de: {
      greet: { morning: 'Guten Morgen', day: 'Hallo', evening: 'Guten Abend', night: 'Kannst du nicht schlafen?' },
      intro: 'Ich bin Soleil. Schreib, wie es dir geht, oder tippe unten.',
      introNight: 'Ich bin auch nachts da. Schreib, was dich wach hält.',
      checkin: 'Wie fühlst du dich heute?',
      breathe: 'Atme mit mir · 1 Min.',
      breatheAria: 'Eine Minute mit mir atmen',
      names: ['Sehr schlecht', 'Schlecht', 'Geht so', 'Gut', 'Super'],
      say: ['Mir geht es sehr schlecht', 'Mir geht es heute schlecht', 'Geht so', 'Mir geht es gut', 'Mir geht es super!'],
      inhale: 'Einatmen', inhaleSub: 'durch die Nase, langsam',
      exhale: 'Ausatmen', exhaleSub: 'durch den Mund, länger',
      done: 'Gut gemacht', doneSub: 'Wie fühlst du dich jetzt?',
      stop: 'Beenden',
      saved: 'Im Stimmungstagebuch gespeichert',
      yes: 'Ja, ich versuche es', notNow: 'Nicht jetzt', withMe: 'Atme mit mir',
      checker: 'Wo tut es weh?', atlas: 'Körperatlas',
      quick: 'Schnelle Antworten',
      short: 'Schreib hier…',
      more: 'Andere Themen',
    },
    es: {
      greet: { morning: 'Buenos días', day: 'Hola', evening: 'Buenas tardes', night: '¿No puedes dormir?' },
      intro: 'Soy Soleil. Escribe cómo te sientes o toca abajo.',
      introNight: 'También estoy aquí de noche. Cuéntame qué no te deja dormir.',
      checkin: '¿Cómo te sientes hoy?',
      breathe: 'Respira conmigo · 1 min',
      breatheAria: 'Respira conmigo un minuto',
      names: ['Muy mal', 'Mal', 'Más o menos', 'Bien', 'Genial'],
      say: ['Me siento muy mal', 'Hoy me siento mal', 'Más o menos', 'Me siento bien', '¡Me siento genial!'],
      inhale: 'Inhala', inhaleSub: 'por la nariz, despacio',
      exhale: 'Exhala', exhaleSub: 'por la boca, más largo',
      done: 'Muy bien', doneSub: '¿Cómo te sientes ahora?',
      stop: 'Terminar',
      saved: 'Guardado en tu diario de ánimo',
      yes: 'Sí, lo intento', notNow: 'Ahora no', withMe: 'Respira conmigo',
      checker: '¿Dónde duele?', atlas: 'Atlas del cuerpo',
      quick: 'Respuestas rápidas',
      short: 'Escribe aquí…',
      more: 'Otros temas',
    },
  };
  const t = (k) => (L[lang()] || L.pl)[k] ?? L.pl[k];

  // ── The scene: a sun over a horizon that rises left to right, like the tab bar's edge ──
  // viewBox 360×160; the horizon runs from (0,116) to (360,100), so it crosses the sun's x at y=108.
  function scene(id) {
    const rays = [-80, -60, -40, -20, 0, 20, 40, 60, 80]
      .map((a, i) => {
        const r = (a * Math.PI) / 180;
        const p = (d) => `${(180 + Math.sin(r) * d).toFixed(1)} ${(96 - Math.cos(r) * d).toFixed(1)}`;
        return `<path d="M${p(38)} L${p(i % 2 ? 45 : 49)}" style="--d:${i}"/>`;
      })
      .join('');
    const sea = [[116, 30], [123, 22], [130, 14], [137, 7]]
      .map(([y, w], i) => {
        const dy = (w * 16) / 360;
        return `<line x1="${180 - w}" y1="${(y + dy).toFixed(1)}" x2="${180 + w}" y2="${(y - dy).toFixed(1)}" style="--d:${i}"/>`;
      })
      .join('');
    const stars = [[46, 34], [92, 62], [128, 18], [246, 26], [292, 54], [326, 20], [20, 78]]
      .map(([x, y], i) => `<path d="M${x} ${y - 2.4}l2.4 2.4-2.4 2.4-2.4-2.4z" style="--d:${(i * 0.7) % 4}"/>`)
      .join('');
    return `<svg class="scene" viewBox="0 0 360 160" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="${id}-disc" cx="50%" cy="38%" r="62%"><stop offset="0" stop-color="#f1fcf6"/><stop offset=".5" stop-color="#c6f2da"/><stop offset="1" stop-color="#a6e8c4"/></radialGradient>
    <radialGradient id="${id}-glow"><stop offset="0" stop-color="#a6e8c4" stop-opacity=".5"/><stop offset=".4" stop-color="#a6e8c4" stop-opacity=".14"/><stop offset="1" stop-color="#a6e8c4" stop-opacity="0"/></radialGradient>
    <clipPath id="${id}-sky"><polygon points="0,-60 360,-60 360,100 0,116"/></clipPath>
  </defs>
  <g class="sc-stars">${stars}</g>
  <g clip-path="url(#${id}-sky)">
    <g class="sc-sun">
      <circle class="sc-glow" cx="180" cy="96" r="84" fill="url(#${id}-glow)"/>
      <g class="sc-rays">${rays}</g>
      <circle class="sc-disc" cx="180" cy="96" r="27" fill="url(#${id}-disc)"/>
    </g>
  </g>
  <g class="sc-sea">${sea}</g>
  <line class="sc-horizon" x1="-20" y1="116.9" x2="380" y2="99.1"/>
  <line class="sc-glint" x1="0" y1="116" x2="360" y2="100" pathLength="100"/>
  <line class="sc-horizon2" x1="24" y1="141" x2="336" y2="127"/>
</svg>`;
  }
  $('hyHeroScene').innerHTML = scene('hs');
  $('hyBreatheScene').innerHTML = scene('bs');

  // ── Welcome ─────────────────────────────────────────────────────────
  const welcome = $('welcomeMsg');
  function period() {
    const h = new Date().getHours();
    return h >= 23 || h < 5 ? 'night' : h < 11 ? 'morning' : h < 18 ? 'day' : 'evening';
  }
  function renderWelcome() {
    const p = period();
    welcome.dataset.period = p;
    welcome.querySelector('h2').textContent = t('greet')[p];
    welcome.querySelector('p').textContent = p === 'night' ? t('introNight') : t('intro');
    $('hyCheckinLabel').textContent = t('checkin');
    $('hyBreatheLabel').textContent = t('breathe');
    $('hyHero').setAttribute('aria-label', t('breatheAria'));
    $('hyBreatheClose').setAttribute('aria-label', t('stop'));
    $('hyTopicsMoreLabel').textContent = t('more');
    renderTopics();
    document.querySelectorAll('.cface').forEach((b) => b.setAttribute('aria-label', t('names')[b.dataset.mood - 1]));
    const today = window.hyTodayMood ? window.hyTodayMood() : null;
    $('hyCheckin').querySelectorAll('.cface').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.mood) === today)));
  }
  const baseLanguage = window.updateInterfaceLanguage;
  window.updateInterfaceLanguage = function (l) {
    baseLanguage(l);
    renderWelcome();
    fitPlaceholder();
  };
  const baseBack = window.goBack;
  window.goBack = function () {
    baseBack();
    topics = null; // starting over draws new topics
    renderWelcome();
  };

  // ── Topics: six from art.js's pool of twenty, new on every visit ──────
  const Art = window.SoleilArt;
  let topics = null;
  function renderTopics(animate) {
    const box = $('hyTopics');
    if (!Art) return;
    if (!topics) topics = Art.draw(6, period() === 'night');
    box.innerHTML = '';
    topics.forEach((topic, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'topic';
      b.style.setProperty('--i', 4 + i * 0.5);
      b.innerHTML = Art.ART[topic.art] + '<span class="topic-text"></span>';
      const text = topic[lang()] || topic.pl;
      b.querySelector('.topic-text').textContent = text.replace(/\//g, '/\u2060'); // "samotny/a" stays on one line
      b.addEventListener('click', () => say(text));
      box.append(b);
    });
    if (animate) {
      box.classList.remove('reroll');
      void box.offsetWidth; // restart the animation
      box.classList.add('reroll');
    }
  }
  $('hyTopicsMore').addEventListener('click', () => {
    topics = Art.draw(6, false);
    renderTopics(true);
    $('hyTopicsMore').classList.remove('spun');
    void $('hyTopicsMore').offsetWidth;
    $('hyTopicsMore').classList.add('spun');
  });
  if (Art) $('hyTopicsMore').insertAdjacentHTML('afterbegin', Art.ART.dice);
  // Coming back to the app after a while is a new visit: new greeting, new topics (unless mid-conversation).
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      return;
    }
    if (hiddenAt && Date.now() - hiddenAt > 20 * 60e3 && welcome.style.display !== 'none') topics = null;
    renderWelcome();
  });

  // Sending something from the welcome, or a quick reply: the chat's own path, as if typed.
  function say(text) {
    sendSuggestion(text);
  }
  // A short line in the conversation that isn't a message (removed with the messages on "start over").
  function note(html) {
    const row = document.createElement('div');
    row.className = 'message-row hy-sys';
    row.innerHTML = html;
    $('chatWindow').insertBefore(row, $('typingRow'));
  }
  function startWithMood(n) {
    const saved = window.hyRecordMood ? window.hyRecordMood(n) : false;
    say(t('say')[n - 1]);
    if (saved) note(`<svg class="ico" aria-hidden="true"><use href="#i-check"/></svg><a href="#nastroj">${t('saved')}</a>`);
  }
  function faceTap(e) {
    const b = e.target.closest('.cface');
    if (!b || b.classList.contains('pop')) return;
    b.classList.add('pop');
    setTimeout(() => {
      b.classList.remove('pop');
      if ($('hyBreathe').contains(b)) closeBreathe();
      startWithMood(Number(b.dataset.mood));
    }, 240);
  }
  $('hyCheckin').addEventListener('click', faceTap);
  $('hyBreatheAfter').addEventListener('click', faceTap);
  $('hyHero').addEventListener('click', () => openBreathe());

  // ── A minute of breathing ───────────────────────────────────────────
  const B = $('hyBreathe');
  const IN = 4000;
  const OUT = 6000;
  const CYCLES = 6;
  let timer = null;
  let cycle = 0;
  let returnFocus = null;
  function cue(big, small) {
    const c = $('hyBreatheCue');
    c.textContent = big;
    $('hyBreatheSub').textContent = small;
    c.parentElement.classList.remove('swap');
    void c.offsetWidth; // restart the fade
    c.parentElement.classList.add('swap');
  }
  function phase(name, ms) {
    B.style.setProperty('--dur', ms + 'ms');
    B.dataset.phase = name;
  }
  function step() {
    if (cycle >= CYCLES) return finish();
    cycle++;
    $('hyBreatheCount').textContent = `${cycle} / ${CYCLES}`;
    cue(t('inhale'), t('inhaleSub'));
    phase('in', IN);
    timer = setTimeout(() => {
      cue(t('exhale'), t('exhaleSub'));
      phase('out', OUT);
      timer = setTimeout(step, OUT);
    }, IN);
  }
  function finish() {
    phase('done', 1200);
    cue(t('done'), t('doneSub'));
    $('hyBreatheCount').textContent = '';
    $('hyBreatheAfter').hidden = false;
  }
  function openBreathe() {
    clearTimeout(timer);
    returnFocus = document.activeElement;
    cycle = 0;
    $('hyBreatheAfter').hidden = true;
    const bar = $('hyBreatheProgress');
    bar.style.transition = 'none';
    bar.style.transform = 'scaleX(0)';
    phase('ready', 0);
    B.hidden = false;
    history.pushState({ hyBreathe: true }, '');
    $('hyBreatheClose').focus();
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        B.classList.add('open');
        bar.style.transition = `transform ${CYCLES * (IN + OUT)}ms linear`;
        bar.style.transform = 'scaleX(1)';
        step();
      }),
    );
  }
  function closeBreathe(fromHistory) {
    if (B.hidden) return;
    clearTimeout(timer);
    timer = null;
    B.classList.remove('open');
    B.hidden = true;
    if (!fromHistory && history.state && history.state.hyBreathe) history.back();
    if (returnFocus && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
  }
  $('hyBreatheClose').addEventListener('click', () => closeBreathe());
  B.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeBreathe();
  });
  window.addEventListener('popstate', () => closeBreathe(true));
  window.hyStartBreathing = openBreathe;

  // ── Quick replies under the offline companion's answers ─────────────
  // The companion says what each answer offers (kind): a small step gets "yes / not now", breathing
  // gets the guided minute, pain gets the symptom checker and the atlas, "how are you?" gets the faces.
  const STEPS = ['walk', 'write', 'text', 'ground', 'pause', 'small'];
  let lastReply = null;
  if (window.SoleilOffline) {
    const baseReply = window.SoleilOffline.reply;
    window.SoleilOffline.reply = function (text) {
      lastReply = baseReply.call(this, text);
      return lastReply;
    };
  }
  function clearChips() {
    document.querySelectorAll('.hy-chips').forEach((c) => c.remove());
  }
  function chip(label, icon, onTap) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.innerHTML = (icon ? `<svg class="ico" aria-hidden="true"><use href="#${icon}"/></svg>` : '') + '<span></span>';
    b.querySelector('span').textContent = label;
    b.addEventListener('click', onTap);
    return b;
  }
  function chipsFor(r) {
    if (!r || /^crisis/.test(r.topic) || r.html.includes('hy-reminder')) return;
    const row = document.createElement('div');
    row.className = 'message-row hy-chips';
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', t('quick'));
    const sayIt = (text) => () => say(text);
    if (r.kind === 'breath') {
      row.append(chip(t('withMe'), 'i-breath', () => openBreathe()), chip(t('notNow'), null, sayIt(t('notNow'))));
    } else if (STEPS.includes(r.kind)) {
      row.append(chip(t('yes'), 'i-check', sayIt(t('yes'))), chip(t('notNow'), null, sayIt(t('notNow'))));
    } else if (r.topic === 'pain') {
      row.append(chip(t('checker'), 'i-symptom', () => window.hyShowView('objawy')), chip(t('atlas'), 'i-body', () => window.hyShowView('cialo')));
    } else if ((r.topic === 'greeting' || r.topic === 'thanks') && r.kind === 'ask') {
      row.classList.add('hy-chip-faces');
      for (let n = 1; n <= 5; n++) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cface';
        b.dataset.mood = n;
        b.setAttribute('aria-label', t('names')[n - 1]);
        b.innerHTML = `<svg aria-hidden="true"><use href="#face-${n}"/></svg>`;
        row.append(b);
      }
      row.addEventListener('click', faceTap);
    } else return;
    [...row.children].forEach((c, i) => c.style.setProperty('--i', i));
    const win = $('chatWindow');
    win.append(row);
    win.scrollTop = win.scrollHeight;
  }
  const baseAppend = window.appendMessage;
  window.appendMessage = function (role, text) {
    clearChips();
    baseAppend(role, text);
    if (role === 'ai') chipsFor(lastReply);
    lastReply = null;
  };

  // ── The send button lights up once there is something to send ───────
  const field = $('userInput');
  const bar = field.closest('.input-wrapper');
  const sync = () => bar.classList.toggle('has-text', field.value.trim() !== '');
  field.addEventListener('input', sync);

  // A placeholder that wraps on a narrow phone gets cut in half; then a shorter one is used.
  const placeholderFull = () => (typeof translations !== 'undefined' && (translations[lang()] || translations.pl).placeholder) || field.placeholder;
  const measure = document.createElement('canvas').getContext('2d');
  function fitPlaceholder() {
    const full = placeholderFull();
    const css = getComputedStyle(field);
    measure.font = `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    const room = field.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
    field.placeholder = room > 0 && measure.measureText(full).width > room ? t('short') : full;
  }
  window.addEventListener('resize', fitPlaceholder);
  window.addEventListener('hashchange', () => requestAnimationFrame(fitPlaceholder));
  document.fonts?.ready.then(fitPlaceholder);
  const baseSend = window.sendMessage;
  window.sendMessage = function () {
    const out = baseSend.apply(this, arguments);
    sync();
    return out;
  };

  renderWelcome();
  fitPlaceholder();
})();
