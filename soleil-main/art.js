// Doco's drawings: one small animated vector scene per conversation topic, the pool the chat
// screen draws its topic tiles from, the mood sky above the mood diary and the sprout on the
// thought of the day. Drawn in the app's pastel green: lines (.l), soft fills (.f), solid
// shapes (.s); classes such as .fall or .bob animate them (soleil.css, "Drawings").
// Each topic says what the chat sends when it's tapped; the offline companion recognises
// every Polish one (tools/soleil/offline-companion.test.mjs checks).
(function () {
  const svg = (body, cls = '') => `<svg class="art ${cls}" viewBox="0 0 80 56" aria-hidden="true" focusable="false">${body}</svg>`;

  const ART = {
    rain: svg(`
      <path class="l f bob" d="M24 33h31a8 8 0 0 0 1-16 12 12 0 0 0-23-4 9 9 0 0 0-9 20z"/>
      <path class="l fall" style="--d:0" d="M29 39v5"/><path class="l fall" style="--d:.55" d="M38 41v5"/>
      <path class="l fall" style="--d:.25" d="M47 39v5"/><path class="l fall" style="--d:.8" d="M56 41v5"/>`),
    knot: svg(`
      <path class="l draw" d="M22 34c-4-12 10-22 20-16s4 18-6 16-10-14 2-18 20 2 18 14-14 12-18 4 4-12 14-10 14 10 6 14"/>
      <path class="l f flick" d="M62 6l-6 10h6l-4 9 10-12h-6l4-7z"/>`),
    briefcase: svg(`
      <g class="bob"><rect class="l f" x="22" y="20" width="36" height="26" rx="4"/>
      <path class="l" d="M33 20v-4a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4M22 31h36"/>
      <rect class="s" x="37" y="28.5" width="6" height="5" rx="1.5"/></g>
      <path class="l f fall slow" d="M63 9c2.4 3.2 3 4.8 0 6.6-3-1.8-2.4-3.4 0-6.6z"/>`),
    book: svg(`
      <path class="l f" d="M14 22c8-3 18-3 26 2 8-5 18-5 26-2v22c-8-3-18-3-26 2-8-5-18-5-26-2z"/>
      <path class="l" d="M40 24v22"/><path class="l dim" d="M20 30c5-1 10-1 14 1M20 36c5-1 10-1 14 1M46 30c5-2 9-2 13-1"/>
      <g class="write"><path class="l f" d="M60 6l6 6-14 14-7 1 1-7z"/><path class="l" d="M56 10l6 6"/></g>`),
    bubbles: svg(`
      <g class="drift-l"><path class="l f" d="M10 12h22a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H20l-6 5v-5h-4a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z"/><path class="l" d="M21 17v5M21 25.5v.5"/></g>
      <g class="drift-r"><path class="l f" d="M70 22H48a4 4 0 0 0-4 4v10a4 4 0 0 0 4 4h12l6 5v-5h4a4 4 0 0 0 4-4V26a4 4 0 0 0-4-4z"/><path class="l" d="M59 27v5M59 35.5v.5"/></g>
      <path class="l flick" d="M41 4l-3 6 4 1-3 6"/>`),
    hill: svg(`
      <path class="l f" d="M2 54c14-12 28-17 38-17s24 5 38 17"/>
      <circle class="l f" cx="38" cy="17" r="5"/><path class="l f" d="M38 23c-5 0-7 5-7 14h14c0-9-2-14-7-14z"/>
      <path class="s twinkle" d="M62 6l1.6 3.6 3.9.4-2.9 2.6.8 3.8L62 14.4l-3.4 2 .8-3.8-2.9-2.6 3.9-.4z"/>
      <circle class="s twinkle" style="--d:1.1" cx="18" cy="12" r="1.2"/><circle class="s twinkle" style="--d:.5" cx="72" cy="28" r="1"/>`),
    moon: svg(`
      <path class="l f bob" d="M38 8a18 18 0 1 0 16 27A15 15 0 0 1 38 8z"/>
      <path class="l zz" d="M56 16h6l-6 7h6"/><path class="l zz" style="--d:1.4" d="M64 6h4.5l-4.5 5h4.5"/>
      <circle class="s twinkle" cx="14" cy="14" r="1.2"/><circle class="s twinkle" style="--d:.8" cx="68" cy="40" r="1.2"/><circle class="s twinkle" style="--d:1.6" cx="10" cy="42" r="1"/>`),
    boat: svg(`
      <g class="rock"><path class="l f" d="M27 36h26l-5 7H32z"/><path class="l f" d="M40 36V12l12 18H40z"/><path class="l" d="M40 18l-8 12h8"/></g>
      <path class="l sway" d="M2 46c6-4 10-4 16 0s10 4 16 0 10-4 16 0 10 4 16 0 8-3 12-3"/>
      <path class="l dim sway rev" d="M8 52c6-4 10-4 16 0s10 4 16 0 10-4 16 0 10 4 16 0"/>`),
    flame: svg(`
      <g class="flame"><path class="l f" d="M40 52c-9 0-14-6-13-13 1-6 6-9 7-16 5 3 8 8 8 13 2-2 3-4 3-7 5 4 8 9 7 14-1 6-5 9-12 9z"/>
      <path class="s" d="M40 49c-4 0-6-3-5-6 1-3 3-4 4-7 3 2 5 5 5 8 0 3-2 5-4 5z"/></g>
      <circle class="s ember" cx="52" cy="18" r="1.4"/><circle class="s ember" style="--d:1" cx="30" cy="16" r="1.1"/>`),
    battery: svg(`
      <rect class="l f" x="18" y="18" width="38" height="22" rx="5"/><path class="l" d="M60 25v8"/>
      <rect class="s blink" x="23" y="23" width="7" height="12" rx="1.6"/>
      <path class="l zz" d="M64 6h5l-5 6h5"/>`),
    mountain: svg(`
      <path class="l f" d="M4 52 30 18l10 12 9-9 27 31z"/>
      <path class="l dim" stroke-dasharray="1 4" d="M14 50c9-4 6-10 14-13s5-9 2-15"/>
      <path class="l" d="M30 18V5"/><path class="s flag" d="M30 5h11l-3 3.5 3 3.5H30z"/>`),
    sun: svg(`
      <g class="spin"><path class="l" d="M40 6v5M40 45v5M18 28h5M57 28h5M24.4 12.4l3.5 3.5M52.1 40.1l3.5 3.5M24.4 43.6l3.5-3.5M52.1 15.9l3.5-3.5"/></g>
      <circle class="s" cx="40" cy="28" r="11"/>
      <path class="ink" d="M35.5 29.5c2.4 3 6.6 3 9 0M36 25v1M44 25v1"/>
      <path class="l twinkle" d="M68 8v7M64.5 11.5h7"/><path class="l twinkle" style="--d:1" d="M12 42v6M9 45h6"/>`),
    spiral: svg(`
      <path class="l f" d="M30 52V42c-7-3-11-10-11-18C19 13 28 5 39 5c10 0 18 7 18 16l5 8-5 1v6c0 3-2 5-5 5h-5v11"/>
      <path class="l spinfast" d="M38 22c0-2 3.4-2 3.4.4 0 3.4-5.6 4.2-6.6-.2-1.2-5.4 6.6-7.8 10-3.2 4 5.6-1.4 12.2-7.8 11-7.4-1.4-9.4-9.6-5.2-15"/>`),
    heart: svg(`
      <path class="l f drift-l" d="M40 21l-5-4a9 9 0 0 0-17 4c0 8 8 15 22 25l-3-8 4-5-4-6z"/>
      <path class="l f drift-r" d="M42 21l5-4a9 9 0 0 1 17 4c0 8-8 15-22 25l-3-8 4-5-4-6z"/>`),
    house: svg(`
      <path class="l f" d="M16 30 40 10l24 20v20H16z"/><path class="l" d="M34 50V38h12v12"/>
      <rect class="l blink slow" x="22" y="32" width="7" height="7" rx="1"/>
      <path class="l flick" d="M42 16l-4 7 5 2-4 7"/>`),
    plaster: svg(`
      <circle class="l ring" cx="40" cy="28" r="18"/><circle class="l ring" style="--d:1" cx="40" cy="28" r="18"/>
      <g transform="rotate(-32 40 28)"><rect class="l f" x="18" y="21" width="44" height="14" rx="7"/><rect class="l" x="33" y="21" width="14" height="14" rx="1"/>
      <circle class="s" cx="37" cy="25.5" r="1"/><circle class="s" cx="43" cy="25.5" r="1"/><circle class="s" cx="37" cy="30.5" r="1"/><circle class="s" cx="43" cy="30.5" r="1"/></g>`),
    stack: svg(`
      <g class="wobble"><rect class="l f" x="25" y="42" width="30" height="10" rx="2"/><rect class="l f" x="29" y="32" width="24" height="10" rx="2"/>
      <rect class="l f" x="23" y="22" width="28" height="10" rx="2"/><rect class="l f" x="31" y="10" width="20" height="12" rx="2"/></g>
      <path class="l dim flick" d="M58 12l4-2M59 18h5M18 16l-4-2M17 22h-5"/>`),
    plane: svg(`
      <path class="l dim" stroke-dasharray="1 4" d="M4 48c10-2 14-14 24-12s10 12 20 4"/>
      <g class="fly"><path class="l f" d="M48 30 74 10l-9 28-7-7z"/><path class="l" d="M48 30l26-20-16 21"/></g>
      <path class="s" d="M8 40c1.6-2.4 4.8-1 3.6 1.4-.6 1.2-3.6 3.2-3.6 3.2s-3-2-3.6-3.2C3.2 39 6.4 37.6 8 40z"/>`),
    road: svg(`
      <path class="l" d="M26 54h28M40 54V8"/>
      <g class="sway-r"><path class="l f" d="M40 13h19l5 5-5 5H40z"/></g>
      <g class="sway-l"><path class="l f" d="M40 28H21l-5 5 5 5h19z"/></g>
      <path class="l bob" d="M60 30a4 4 0 1 1 5 3.9c-1 .4-1.6 1-1.6 2.3M63.4 41v.5"/>`),
    star: svg(`
      <path class="s pop" d="M40 8l4.7 9.5 10.5 1.5-7.6 7.4 1.8 10.4L40 31.9l-9.4 4.9 1.8-10.4-7.6-7.4 10.5-1.5z"/>
      <path class="l twinkle" d="M18 12l3 3M62 12l-3 3"/><path class="l twinkle" style="--d:.7" d="M14 32h5M61 32h5"/>
      <path class="l twinkle" style="--d:1.4" d="M26 46l2-3M54 46l-2-3"/><path class="l" d="M32 50h16"/>`),
    dice: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8.5 8.5h.01M15.5 15.5h.01M15.5 8.5h.01M8.5 15.5h.01M12 12h.01" stroke-width="3"/></svg>`,
  };

  // The topics. group = the companion's topic, so one draw never shows two of the same kind.
  const TOPICS = [
    { art: 'rain', group: 'sad', pl: 'Jestem smutny/a', en: 'I feel sad', uk: 'Мені сумно', de: 'Ich bin traurig', es: 'Estoy triste' },
    { art: 'knot', group: 'stress', pl: 'Czuję stres', en: 'I feel stressed', uk: 'Я відчуваю стрес', de: 'Ich bin gestresst', es: 'Siento estrés' },
    { art: 'briefcase', group: 'work', pl: 'Problem w pracy', en: 'Trouble at work', uk: 'Проблеми на роботі', de: 'Ärger bei der Arbeit', es: 'Problemas en el trabajo' },
    { art: 'book', group: 'stress', pl: 'Stres przed egzaminem', en: 'Exam nerves', uk: 'Стрес перед іспитом', de: 'Prüfungsstress', es: 'Nervios por un examen' },
    { art: 'bubbles', group: 'conflict', pl: 'Pokłóciłem/am się z kimś', en: 'I had a fight with someone', uk: 'Я з кимось посварився', de: 'Ich hatte Streit', es: 'Discutí con alguien' },
    { art: 'hill', group: 'lonely', pl: 'Czuję się samotny/a', en: 'I feel lonely', uk: 'Я почуваюся самотньо', de: 'Ich fühle mich einsam', es: 'Me siento solo/a' },
    { art: 'moon', group: 'tired', pl: 'Nie mogę zasnąć', en: "I can't fall asleep", uk: 'Не можу заснути', de: 'Ich kann nicht einschlafen', es: 'No puedo dormir', night: true },
    { art: 'boat', group: 'anxiety', pl: 'Coś mnie niepokoi', en: 'Something worries me', uk: 'Мене щось тривожить', de: 'Etwas beunruhigt mich', es: 'Algo me preocupa' },
    { art: 'flame', group: 'anger', pl: 'Jestem wściekły/a', en: "I'm furious", uk: 'Я в люті', de: 'Ich bin wütend', es: 'Estoy furioso/a' },
    { art: 'battery', group: 'tired', pl: 'Jestem wykończony/a', en: "I'm exhausted", uk: 'Я виснажений', de: 'Ich bin erschöpft', es: 'Estoy agotado/a' },
    { art: 'mountain', group: 'motivation', pl: 'Brak mi motywacji', en: 'No motivation', uk: 'Бракує мотивації', de: 'Keine Motivation', es: 'Me falta motivación' },
    { art: 'sun', group: 'joy', pl: 'Mam dziś dobry dzień', en: "I'm having a good day", uk: 'У мене гарний день', de: 'Ich habe einen guten Tag', es: 'Tengo un buen día', good: true },
    { art: 'spiral', group: 'anxiety', pl: 'Mam gonitwę myśli', en: 'My thoughts are racing', uk: 'Думки не дають спокою', de: 'Gedankenkarussell', es: 'Mis pensamientos no paran' },
    { art: 'heart', group: 'conflict', pl: 'Przeżywam rozstanie', en: 'Going through a breakup', uk: 'Переживаю розставання', de: 'Trennungsschmerz', es: 'Estoy pasando una ruptura' },
    { art: 'house', group: 'conflict', pl: 'Kłótnie w domu', en: 'Arguments at home', uk: 'Сварки вдома', de: 'Streit zu Hause', es: 'Discusiones en casa' },
    { art: 'plaster', group: 'pain', pl: 'Coś mnie boli', en: 'Something hurts', uk: 'Щось болить', de: 'Mir tut etwas weh', es: 'Me duele algo' },
    { art: 'stack', group: 'stress', pl: 'Mam za dużo na głowie', en: 'Too much on my mind', uk: 'Забагато всього', de: 'Zu viel im Kopf', es: 'Demasiado en la cabeza' },
    { art: 'plane', group: 'sad', pl: 'Tęsknię za kimś', en: 'I miss someone', uk: 'Я сумую за кимось', de: 'Ich vermisse jemanden', es: 'Extraño a alguien' },
    { art: 'road', group: 'anxiety', pl: 'Boję się przyszłości', en: "I'm afraid of the future", uk: 'Я боюся майбутнього', de: 'Ich habe Angst vor der Zukunft', es: 'Tengo miedo del futuro' },
    { art: 'star', group: 'joy', pl: 'Udało mi się coś!', en: 'I did it!', uk: 'У мене вийшло!', de: "Ich hab's geschafft!", es: '¡Lo logré!', good: true },
  ];

  // Six for this visit: different every time, never two of one kind, one good thing among them,
  // what was shown last time goes to the back of the queue, and at night sleep comes first.
  const LAST = 'soleil_topics_last';
  function draw(count = 6, night = false) {
    let last = [];
    try {
      last = JSON.parse(localStorage.getItem(LAST) || '[]');
    } catch {
      last = [];
    }
    const shuffled = TOPICS.map((t) => [Math.random() + (last.includes(t.art) ? 1 : 0), t])
      .sort((a, b) => a[0] - b[0])
      .map(([, t]) => t);
    const picked = [];
    const groups = new Set();
    const take = (t) => {
      if (picked.length < count && !picked.includes(t) && !groups.has(t.group)) {
        picked.push(t);
        groups.add(t.group);
      }
    };
    if (night) take(TOPICS.find((t) => t.night));
    take(shuffled.find((t) => t.good));
    shuffled.filter((t) => !t.good).forEach(take);
    // Mix the good one in among the rest (sleep stays first at night).
    const fixed = night ? 1 : 0;
    const rest = picked.slice(fixed).sort(() => Math.random() - 0.5);
    const out = picked.slice(0, fixed).concat(rest);
    try {
      localStorage.setItem(LAST, JSON.stringify(out.map((t) => t.art)));
    } catch {
      /* private mode: no memory of the last draw */
    }
    return out;
  }

  // ── The mood sky above the mood diary: the weather follows the face you pick ──
  const SKY = `<svg class="sky" viewBox="0 0 360 120" aria-hidden="true" focusable="false">
    <defs><radialGradient id="sky-glow"><stop offset="0" style="stop-color: var(--green)" stop-opacity=".45"/><stop offset="1" style="stop-color: var(--green)" stop-opacity="0"/></radialGradient>
      <clipPath id="sky-above"><path d="M0 0H360V96L0 112Z"/></clipPath></defs>
    <g class="sky-stars"><circle cx="40" cy="20" r="1.2"/><circle cx="120" cy="12" r="1"/><circle cx="300" cy="18" r="1.3"/><circle cx="330" cy="54" r="1"/><circle cx="70" cy="60" r="1"/></g>
    <g clip-path="url(#sky-above)"><g class="sky-sun"><circle cx="180" cy="58" r="64" fill="url(#sky-glow)"/>
      <g class="sky-rays"><path d="M180 14v8M180 94v8M136 58h8M216 58h8M149 27l6 6M205 83l6 6M149 89l6-6M205 33l6-6"/></g>
      <circle class="sky-disc" cx="180" cy="58" r="22"/>
      <path class="sky-face" d="M171 61c4 5 14 5 18 0M172 52v2M188 52v2"/></g></g>
    <g class="sky-cloud c1"><path d="M120 76h70a16 16 0 0 0 0-32 24 24 0 0 0-45-8 18 18 0 0 0-25 40z"/></g>
    <g class="sky-cloud c2"><path d="M196 92h62a14 14 0 0 0 0-28 21 21 0 0 0-40-6 15 15 0 0 0-22 34z"/></g>
    <g class="sky-rain"><path d="M140 84v9M160 88v9M180 84v9M214 98v9M234 100v9M250 96v9"/></g>
    <path class="sky-bolt" d="M172 80l-8 14h9l-5 12 14-18h-9l6-8z"/>
    <g class="sky-sparks"><path d="M100 30v10M95 35h10M262 26v8M258 30h8M282 70v6M279 73h6"/></g>
    <path class="sky-horizon" d="M0 112 360 96"/>
  </svg>`;
  function moodSky() {
    const heading = document.getElementById('moodHeading');
    if (!heading || document.getElementById('hySky')) return;
    const box = document.createElement('div');
    box.className = 'sky-box';
    box.id = 'hySky';
    box.innerHTML = SKY;
    heading.before(box);
    const set = (n) => (box.dataset.mood = n || 0);
    set(window.hyTodayMood ? window.hyTodayMood() : 0);
    document.querySelectorAll('#view-nastroj .face').forEach((f) => f.addEventListener('click', () => set(f.dataset.mood)));
    window.addEventListener('hashchange', () => {
      if (location.hash === '#nastroj') set(window.hyTodayMood ? window.hyTodayMood() : 0);
    });
  }

  // A sprout on the thought of the day.
  const SPROUT = `<svg class="sprout" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <path class="l f" d="M14 38h20l-3 8H17z"/><path class="l grow" d="M24 38V22"/>
    <path class="l f leaf-l" d="M24 28c-7 0-11-4-11-10 7 0 11 4 11 10z"/><path class="l f leaf-r" d="M24 23c0-7 4-11 11-11 0 7-4 11-11 11z"/></svg>`;

  window.SoleilArt = { ART, TOPICS, draw };
  moodSky();
  const daily = document.getElementById('hyDailyArt');
  if (daily) daily.innerHTML = SPROUT;
})();
