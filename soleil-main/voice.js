// ROZMOWA GŁOSOWA — agent ElevenLabs, którego mózgiem jest Claude.
// Agenta zakłada i aktualizuje tools/elevenlabs-agent.mjs (wpisuje też tutaj jego ID).
// ID publicznego agenta nie jest tajne: chronią go dozwolone domeny i limity ustawione w ElevenLabs.
// Rozmowę otwiera słuchawka na pasku pisania (#voiceCallBtn w index.html).
const ELEVENLABS_AGENT_ID = 'agent_7001m4101dzqencvje57j48h6k5r';
const ELEVENLABS_SDK_URL = 'https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.26.0/dist/lib.iife.min.js';

const voiceTexts = {
  pl: {
    button: 'Porozmawiaj z Doco', title: 'Rozmowa z Doco', credit: 'Głos: ElevenLabs',
    connecting: 'Łączę…', listening: 'Słucham cię…', speaking: 'Doco mówi…', ended: 'Rozmowa zakończona',
    hint: 'Mów normalnie — możesz mi przerwać w każdej chwili.',
    mic: 'Potrzebuję dostępu do mikrofonu, żeby cię słyszeć. Zezwól na niego w przeglądarce.',
    error: 'Nie udało się połączyć. Spróbuj jeszcze raz.',
    notReady: 'Rozmowa głosowa nie jest jeszcze skonfigurowana.',
    loginNeeded: 'Rozmowa głosowa jest dostępna po zalogowaniu.',
    micLabel: 'Mikrofon', soundLabel: 'Głośnik', endLabel: 'Zakończ', callLabel: 'Zadzwoń',
    micMute: 'Wycisz mikrofon', micUnmute: 'Włącz mikrofon',
    soundMute: 'Wycisz Doco', soundUnmute: 'Włącz głos Doco',
    hangup: 'Zakończ rozmowę', call: 'Zadzwoń jeszcze raz',
    menu: 'Głos Doco', pickerTitle: 'Głos Doco', pickerDesc: 'Wybierz, jakim głosem Doco ma z tobą rozmawiać.',
    listen: 'Posłuchaj', pickerNote: 'Próbki są po angielsku — w rozmowie Doco mówi w twoim języku.',
    gender: { f: 'kobiecy', m: 'męski' },
    traits: { upbeat: 'pogodny', warm: 'ciepły', soothing: 'kojący', deep: 'głęboki', calm: 'spokojny', relaxed: 'swobodny' },
    firstMessage: 'Hej, tu Doco. Jestem tu dla ciebie. Jak się dziś czujesz?',
    firstMessageNamed: (n) => `Hej, ${n}, tu Doco. Jestem tu dla ciebie. Jak się dziś czujesz?`
  },
  en: {
    button: 'Talk to Doco', title: 'Call with Doco', credit: 'Voice: ElevenLabs',
    connecting: 'Connecting…', listening: 'I\'m listening…', speaking: 'Doco is speaking…', ended: 'Call ended',
    hint: 'Just talk normally — you can interrupt me anytime.',
    mic: 'I need microphone access to hear you. Please allow it in your browser.',
    error: 'Couldn\'t connect. Please try again.',
    notReady: 'Voice chat isn\'t set up yet.',
    loginNeeded: 'Voice calls are available once you sign in.',
    micLabel: 'Microphone', soundLabel: 'Speaker', endLabel: 'End', callLabel: 'Call',
    micMute: 'Mute microphone', micUnmute: 'Unmute microphone',
    soundMute: 'Mute Doco', soundUnmute: 'Unmute Doco',
    hangup: 'End call', call: 'Call again',
    menu: 'Doco\'s voice', pickerTitle: 'Doco\'s voice', pickerDesc: 'Choose the voice Doco uses when you talk.',
    listen: 'Listen', pickerNote: 'Samples are in English — in the call Doco speaks your language.',
    gender: { f: 'female', m: 'male' },
    traits: { upbeat: 'upbeat', warm: 'warm', soothing: 'reassuring', deep: 'deep', calm: 'calm', relaxed: 'relaxed' },
    firstMessage: 'Hey, it\'s Doco. I\'m here for you. How are you feeling today?',
    firstMessageNamed: (n) => `Hey ${n}, it's Doco. I'm here for you. How are you feeling today?`
  },
  uk: {
    button: 'Поговори з Doco', title: 'Розмова з Doco', credit: 'Голос: ElevenLabs',
    connecting: 'З\'єднуюся…', listening: 'Слухаю тебе…', speaking: 'Doco говорить…', ended: 'Розмову завершено',
    hint: 'Говори як завжди — можеш перебити мене будь-коли.',
    mic: 'Мені потрібен доступ до мікрофона, щоб тебе чути. Дозволь його в браузері.',
    error: 'Не вдалося з\'єднатися. Спробуй ще раз.',
    notReady: 'Голосову розмову ще не налаштовано.',
    loginNeeded: 'Голосова розмова доступна після входу.',
    micLabel: 'Мікрофон', soundLabel: 'Динамік', endLabel: 'Завершити', callLabel: 'Подзвонити',
    micMute: 'Вимкнути мікрофон', micUnmute: 'Увімкнути мікрофон',
    soundMute: 'Вимкнути звук Doco', soundUnmute: 'Увімкнути звук Doco',
    hangup: 'Завершити розмову', call: 'Подзвонити ще раз',
    menu: 'Голос Doco', pickerTitle: 'Голос Doco', pickerDesc: 'Обери, яким голосом Doco говоритиме з тобою.',
    listen: 'Послухати', pickerNote: 'Зразки англійською — у розмові Doco говорить твоєю мовою.',
    gender: { f: 'жіночий', m: 'чоловічий' },
    traits: { upbeat: 'бадьорий', warm: 'теплий', soothing: 'заспокійливий', deep: 'глибокий', calm: 'спокійний', relaxed: 'невимушений' },
    firstMessage: 'Привіт, це Doco. Я тут для тебе. Як ти сьогодні почуваєшся?',
    firstMessageNamed: (n) => `Привіт, ${n}, це Doco. Я тут для тебе. Як ти сьогодні почуваєшся?`
  },
  de: {
    button: 'Mit Doco sprechen', title: 'Gespräch mit Doco', credit: 'Stimme: ElevenLabs',
    connecting: 'Verbinde…', listening: 'Ich höre dir zu…', speaking: 'Doco spricht…', ended: 'Gespräch beendet',
    hint: 'Sprich ganz normal — du kannst mich jederzeit unterbrechen.',
    mic: 'Ich brauche Zugriff auf dein Mikrofon, um dich zu hören. Erlaube ihn im Browser.',
    error: 'Verbindung fehlgeschlagen. Versuch es noch einmal.',
    notReady: 'Der Sprachchat ist noch nicht eingerichtet.',
    loginNeeded: 'Sprachgespräche sind nach der Anmeldung verfügbar.',
    micLabel: 'Mikrofon', soundLabel: 'Lautsprecher', endLabel: 'Beenden', callLabel: 'Anrufen',
    micMute: 'Mikrofon stummschalten', micUnmute: 'Mikrofon einschalten',
    soundMute: 'Doco stummschalten', soundUnmute: 'Doco wieder hören',
    hangup: 'Gespräch beenden', call: 'Erneut anrufen',
    menu: 'Docos Stimme', pickerTitle: 'Docos Stimme', pickerDesc: 'Wähle, mit welcher Stimme Doco mit dir spricht.',
    listen: 'Anhören', pickerNote: 'Die Hörproben sind auf Englisch — im Gespräch spricht Doco deine Sprache.',
    gender: { f: 'weiblich', m: 'männlich' },
    traits: { upbeat: 'fröhlich', warm: 'warm', soothing: 'beruhigend', deep: 'tief', calm: 'ruhig', relaxed: 'entspannt' },
    firstMessage: 'Hey, hier ist Doco. Ich bin für dich da. Wie fühlst du dich heute?',
    firstMessageNamed: (n) => `Hey ${n}, hier ist Doco. Ich bin für dich da. Wie fühlst du dich heute?`
  },
  es: {
    button: 'Habla con Doco', title: 'Llamada con Doco', credit: 'Voz: ElevenLabs',
    connecting: 'Conectando…', listening: 'Te escucho…', speaking: 'Doco está hablando…', ended: 'Llamada terminada',
    hint: 'Habla con normalidad — puedes interrumpirme cuando quieras.',
    mic: 'Necesito acceso al micrófono para escucharte. Permítelo en tu navegador.',
    error: 'No se pudo conectar. Inténtalo de nuevo.',
    notReady: 'El chat de voz aún no está configurado.',
    loginNeeded: 'Las llamadas de voz están disponibles al iniciar sesión.',
    micLabel: 'Micrófono', soundLabel: 'Altavoz', endLabel: 'Colgar', callLabel: 'Llamar',
    micMute: 'Silenciar micrófono', micUnmute: 'Activar micrófono',
    soundMute: 'Silenciar a Doco', soundUnmute: 'Volver a oír a Doco',
    hangup: 'Terminar llamada', call: 'Llamar de nuevo',
    menu: 'Voz de Doco', pickerTitle: 'Voz de Doco', pickerDesc: 'Elige con qué voz te habla Doco.',
    listen: 'Escuchar', pickerNote: 'Las muestras están en inglés; en la llamada Doco habla tu idioma.',
    gender: { f: 'femenina', m: 'masculina' },
    traits: { upbeat: 'alegre', warm: 'cálida', soothing: 'tranquilizadora', deep: 'profunda', calm: 'tranquila', relaxed: 'relajada' },
    firstMessage: 'Hola, soy Doco. Estoy aquí para ti. ¿Cómo te sientes hoy?',
    firstMessageNamed: (n) => `Hola, ${n}, soy Doco. Estoy aquí para ti. ¿Cómo te sientes hoy?`
  }
};

// Głosy do wyboru w menu użytkownika (gotowe głosy ElevenLabs, dostępne na każdym koncie).
// Pierwszy jest domyślnym głosem agenta. Płeć głosu decyduje o rodzaju gramatycznym, w jakim Doco mówi o sobie.
const VOICE_PREVIEW_BASE = 'https://storage.googleapis.com/eleven-public-prod/premade/voices/';
const VOICE_OPTIONS = [
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'f', trait: 'upbeat', preview: 'b930e18d-6b4d-466e-bab2-0ae97c6d8535.mp3' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', gender: 'f', trait: 'warm', preview: '56a97bf8-b69b-448f-846c-c3a11683d45a.mp3' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'f', trait: 'soothing', preview: '01a3e33c-6e99-4ee7-8543-ff2216a32186.mp3' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'm', trait: 'deep', preview: '2dd3e72c-4fd3-42f1-93ea-abc5d4e5aa1d.mp3' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', gender: 'm', trait: 'calm', preview: 'd098fda0-6456-4030-b3d8-63aa048c9070.mp3' },
  { id: 'bIHbv24MWmeRgasZH58o', name: 'Will', gender: 'm', trait: 'relaxed', preview: '8caf8f3d-ad29-4980-af41-53f20c72d7a4.mp3' }
];

const VOICE_ICONS = {
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>',
  person: '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>',
  hangup: '<svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/></svg>',
  micOff: '<svg viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>'
};

let voiceConversation = null;
let voiceLive = false;
let voiceAttempt = 0;
let voiceMicOff = false;
let voiceSoundOff = false;
let voiceState = 'ended';
let voiceLines = [];
let voiceLevelFrame = 0;
let voiceCallStart = 0;
let voiceEnterNext = false; // okno właśnie się otworzyło: Doco ma zjechać na swoje miejsce
let voiceEntering = false;
let voiceTimerId = 0;
let voiceSdkPromise = null;
// Kept in sessionStorage too: signing in with Google reloads the page on the way back
let voiceLoginRequestedAt = Number(sessionStorage.getItem('soleil_voice_login')) || 0;
let voicePreview = null;

function vt() { return voiceTexts[currentLanguage] || voiceTexts.pl; }

document.body.insertAdjacentHTML('beforeend', `
<div class="overlay" id="voiceOverlay">
  <div class="voice-call" id="voiceCall" role="dialog" aria-modal="true">
    <button class="popup-close" onclick="closeVoiceCall()">✕</button>
    <h2 class="voice-title" id="voiceTitle">Doco</h2>
    <p class="voice-timer" id="voiceTimer" aria-hidden="true"></p>
    <div class="voice-stage" id="voiceStage">
      <svg class="voice-scene" id="voiceScene" aria-hidden="true"></svg>
      <div class="voice-lemur" id="voiceLemur"></div>
    </div>
    <div class="voice-status" aria-live="polite"><span class="status-dot"></span><span id="voiceStatus"></span></div>
    <p class="voice-hint" id="voiceHint"></p>
    <div class="voice-transcript" id="voiceTranscript"></div>
    <div class="voice-controls">
      <div class="voice-ctl side"><button class="voice-btn toggle" id="voiceMicBtn" onclick="toggleVoiceMic()"></button><span id="voiceMicLabel"></span></div>
      <div class="voice-ctl"><button class="voice-btn call" id="voiceMainBtn" onclick="voiceMainAction()"></button><span id="voiceMainLabel"></span></div>
      <div class="voice-ctl side"><button class="voice-btn toggle" id="voiceSoundBtn" onclick="toggleVoiceSound()"></button><span id="voiceSoundLabel"></span></div>
    </div>
    <a class="voice-credit" id="voiceCredit" href="https://elevenlabs.io" target="_blank" rel="noopener"></a>
  </div>
</div>
<div class="overlay" id="voicePickerOverlay">
  <div class="lang-popup">
    <button class="popup-close" onclick="closeVoicePicker()">✕</button>
    <h2 id="voicePickerTitle"></h2>
    <p class="voice-picker-desc" id="voicePickerDesc"></p>
    <div class="lang-options" id="voicePickerList"></div>
    <p class="voice-picker-note" id="voicePickerNote"></p>
  </div>
</div>`);

// Doco jako lemur z logo (lemur.js): kiwa głową, gdy mówisz, i porusza pyszczkiem, gdy mówi
const voiceLemur = window.DocoLemur ? DocoLemur.create(document.getElementById('voiceLemur')) : null;

// SCENA: lemur siedzi na linii horyzontu, tej samej co w Rozmowie (wznosi się od lewej do prawej).
// Gdy ktoś mówi, linia po obu stronach lemura faluje: głos Doco rozchodzi się od niego na boki,
// twój płynie do niego od brzegów. Przy łączeniu spod lemura rozchodzą się ośmiokąty jak dzwonek
// (kształt przycisków rozmowy). Fala rysuje się tylko wtedy, gdy coś słychać albo jeszcze opada.
const voiceStage = (() => {
  const stage = document.getElementById('voiceStage');
  const svg = document.getElementById('voiceScene');
  const lemur = document.getElementById('voiceLemur');
  const SLOPE = 17.8 / 400; // nachylenie .sc-horizon z chat.js
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const ring = '<polygon class="vs-ring" vector-effect="non-scaling-stroke"/>';
  svg.innerHTML = `<g class="vs-rings">${ring + ring + ring}</g><line class="vs-horizon2"/><path class="vs-horizon"/><line class="vs-glint" pathLength="100"/>`;
  const [line2, horizon, glint] = ['.vs-horizon2', '.vs-horizon', '.vs-glint'].map(s => svg.querySelector(s));
  let w = 0, cx = 0, seat = 0, reach = 0;
  let input = 0, output = 0, ampIn = 0, ampOut = 0, phase = 0, frame = 0, last = 0;
  let hitAt = -1, hit = 0; // lądowanie lemura: linia ugina się pod nim i odbija
  const y = x => seat - (x - cx) * SLOPE;
  const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

  function draw() {
    let d = '';
    for (let x = -8; x <= w + 8; x += 5) {
      const dist = Math.abs(x - cx);
      // od krawędzi lemura (pod nim fali i tak nie widać) do brzegu sceny
      const u = (dist - reach) / Math.max(1, (x < cx ? cx : w - cx) - reach);
      const win = smooth(0, 0.22, u) * (1 - smooth(0.6, 1, u));
      const swell = 0.75 + 0.25 * Math.sin(dist * 0.031 - phase * 2.3);
      const off = win * swell * (ampOut * Math.sin(dist * 0.09 - phase * 7) + ampIn * Math.sin(dist * 0.09 + phase * 6));
      const sag = hit ? hit * Math.exp(-(((x - cx) / (reach * 1.9)) ** 2)) : 0;
      d += `${d ? 'L' : 'M'}${x} ${(y(x) - off + sag).toFixed(1)}`;
    }
    horizon.setAttribute('d', d);
  }

  function layout() {
    w = stage.clientWidth;
    const h = stage.clientHeight, s = stage.getBoundingClientRect(), r = lemur.getBoundingClientRect();
    if (!w || !r.width) return;
    // w rysunku lemura (240×260) twarz jest na x 110, a stopy kończą się na y ≈ 252
    cx = r.left - s.left + r.width * 110 / 240;
    seat = r.top - s.top + r.height * 250 / 260;
    reach = r.width * 0.27;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const x1 = w * 0.08, x2 = w * 0.92;
    Object.entries({ x1, y1: y(x1) + 24, x2, y2: y(x2) + 24 }).forEach(([k, v]) => line2.setAttribute(k, v.toFixed(1)));
    Object.entries({ x1: 0, y1: y(0), x2: w, y2: y(w) }).forEach(([k, v]) => glint.setAttribute(k, v.toFixed(1)));
    // ośmiokąt jak przycisk rozmowy (rogi ścięte na 30%), wokół głowy lemura
    const hx = cx, hy = r.top - s.top + r.height * 80 / 260, a = r.width * 0.25, b = a * 0.4;
    const pts = [[-b, -a], [b, -a], [a, -b], [a, b], [b, a], [-b, a], [-a, b], [-a, -b]].map(([px, py]) => `${(hx + px).toFixed(1)},${(hy + py).toFixed(1)}`).join(' ');
    svg.querySelectorAll('.vs-ring').forEach(p => { p.setAttribute('points', pts); p.style.transformOrigin = `${hx}px ${hy}px`; });
    draw();
  }

  function tick(ms) {
    const dt = Math.min(0.05, (ms - (last || ms)) / 1000);
    last = ms;
    phase += dt;
    // szybki atak, wolniejsze opadanie, jak wskazówka miernika
    const ease = (cur, level) => { const target = Math.min(1, level * 3.5) * 9; return cur + (target - cur) * (1 - Math.exp(-dt / (target > cur ? 0.06 : 0.3))); };
    ampOut = ease(ampOut, output);
    ampIn = ease(ampIn, input);
    // ugięcie: w 80 ms w dół (razem z przysiadem lemura), potem gasnące odbicie
    const age = hitAt < 0 ? 9 : Math.max(0, (ms - hitAt) / 1000);
    hit = age >= 1 ? 0 : 6 * (age < 0.08 ? Math.sin(age / 0.08 * Math.PI / 2) : Math.exp(-(age - 0.08) / 0.18) * Math.cos((age - 0.08) * 2 * Math.PI / 0.45));
    draw();
    frame = ampOut + ampIn > 0.02 || input + output > 0.004 || hit ? requestAnimationFrame(tick) : (ampOut = ampIn = 0, draw(), 0);
  }

  new ResizeObserver(layout).observe(stage);
  return {
    layout,
    impact() {
      if (still.matches) return;
      hitAt = performance.now();
      if (!frame) { last = 0; frame = requestAnimationFrame(tick); }
    },
    setLevels(i, o) {
      input = Number.isFinite(i) ? i : 0;
      output = Number.isFinite(o) ? o : 0;
      if (!frame && (input + output > 0.004 || ampIn + ampOut > 0.02) && !still.matches) {
        last = 0;
        frame = requestAnimationFrame(tick);
      }
    }
  };
})();

function updateVoiceLanguage() {
  const btn = document.getElementById('voiceCallBtn');
  if (btn) { btn.title = vt().button; btn.setAttribute('aria-label', vt().button); }
  const menu = document.getElementById('menuVoiceLabel');
  if (menu) menu.textContent = vt().menu;
}

// WYBÓR GŁOSU (menu użytkownika); wybór zapamiętuje przeglądarka, tak jak język
function currentVoiceOption() {
  return VOICE_OPTIONS.find(v => v.id === localStorage.getItem('soleil_voice')) || VOICE_OPTIONS[0];
}

function openVoicePicker() {
  const t = vt();
  pushOverlayState('voicePickerOverlay');
  document.getElementById('voicePickerTitle').textContent = t.pickerTitle;
  document.getElementById('voicePickerDesc').textContent = t.pickerDesc;
  document.getElementById('voicePickerNote').textContent = t.pickerNote;
  renderVoicePicker();
  document.getElementById('voicePickerOverlay').classList.add('visible');
}

function closeVoicePicker() {
  stopVoicePreview();
  document.getElementById('voicePickerOverlay').classList.remove('visible');
}

function renderVoicePicker() {
  const t = vt();
  const selected = currentVoiceOption().id;
  const playing = voicePreview?.voiceId;
  document.getElementById('voicePickerList').innerHTML = VOICE_OPTIONS.map(v => `
    <div class="lang-option ${v.id === selected ? 'active' : ''}" role="button" tabindex="0" onclick="selectVoice('${v.id}')">
      <span class="voice-option-avatar ${v.gender}">${v.name[0]}</span>
      <div class="voice-option-text"><div class="lang-name">${v.name}</div><div class="lang-native">${t.gender[v.gender]} · ${t.traits[v.trait]}</div></div>
      <button class="voice-preview ${v.id === playing ? 'playing' : ''}" onclick="previewVoice(event, '${v.id}')" title="${t.listen}" aria-label="${t.listen}: ${v.name}">${v.id === playing ? VOICE_ICONS.stop : VOICE_ICONS.play}</button>
    </div>`).join('');
}

function selectVoice(id) {
  localStorage.setItem('soleil_voice', id);
  closeVoicePicker();
}

function previewVoice(event, id) {
  event.stopPropagation();
  const wasPlaying = voicePreview?.voiceId === id;
  stopVoicePreview();
  if (!wasPlaying) {
    const v = VOICE_OPTIONS.find(o => o.id === id);
    voicePreview = new Audio(VOICE_PREVIEW_BASE + v.id + '/' + v.preview);
    voicePreview.voiceId = id;
    voicePreview.onended = () => { voicePreview = null; renderVoicePicker(); };
    voicePreview.play().catch(() => { voicePreview = null; renderVoicePicker(); });
  }
  renderVoicePicker();
}

function stopVoicePreview() {
  if (voicePreview) { voicePreview.pause(); voicePreview = null; }
}

function loadVoiceSdk() {
  if (window.ElevenLabsClient) return Promise.resolve(window.ElevenLabsClient);
  if (!voiceSdkPromise) {
    voiceSdkPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = ELEVENLABS_SDK_URL; s.async = true;
      s.onload = () => resolve(window.ElevenLabsClient);
      s.onerror = () => { voiceSdkPromise = null; reject(new Error('Nie udało się pobrać SDK ElevenLabs')); };
      document.head.appendChild(s);
    });
  }
  return voiceSdkPromise;
}

function openVoiceCall() {
  const t = vt();
  pushOverlayState('voiceOverlay');
  document.getElementById('voiceOverlay').classList.add('visible');
  document.getElementById('voiceCall').setAttribute('aria-label', t.title);
  document.getElementById('voiceHint').textContent = t.hint;
  document.getElementById('voiceCredit').textContent = t.credit;
  voiceEnterNext = !voiceLive; // otwarte w trakcie rozmowy: Doco już siedzi na miejscu
  startVoiceCall();
}

function closeVoiceCall() {
  if (voiceLive) endVoiceCall();
  document.getElementById('voiceOverlay').classList.remove('visible');
}

function voiceMainAction() {
  if (voiceLive) endVoiceCall();
  else if (voiceState === 'locked') { voiceLoginRequestedAt = Date.now(); sessionStorage.setItem('soleil_voice_login', voiceLoginRequestedAt); closeVoiceCall(); openAuth(); }
  else startVoiceCall();
}

// Rozmowa głosowa jest tylko dla zalogowanych. Kto kliknął słuchawkę i się zalogował, od razu do niej wraca.
function updateVoiceAuth(user) {
  if (user && Date.now() - voiceLoginRequestedAt < 5 * 60 * 1000) {
    voiceLoginRequestedAt = 0;
    sessionStorage.removeItem('soleil_voice_login');
    openVoiceCall();
  } else if (!user && voiceLive) {
    closeVoiceCall();
  }
}

async function startVoiceCall() {
  const t = vt();
  if (voiceLive) return;
  if (!(currentUser || clerk?.user)) {
    document.getElementById('voiceTranscript').innerHTML = '';
    document.getElementById('voiceHint').style.display = 'none';
    stopVoiceTimer(true);
    voiceEnterNext = voiceEntering = false;
    setVoiceState('locked', t.loginNeeded);
    return;
  }
  if (!ELEVENLABS_AGENT_ID) { setVoiceState('error', t.notReady); return; }
  const attempt = ++voiceAttempt;
  const current = () => attempt === voiceAttempt && voiceLive;
  voiceLive = true; voiceMicOff = false; voiceSoundOff = false; voiceLines = [];
  document.getElementById('voiceTranscript').innerHTML = '';
  document.getElementById('voiceHint').style.display = '';
  stopVoiceTimer(true);
  setVoiceState('connecting');
  if (voiceEnterNext) { voiceEnterNext = false; enterVoiceLemur(); }
  try {
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    mic.getTracks().forEach(track => track.stop());
  } catch (err) {
    if (current()) finishVoiceCall(t.mic);
    return;
  }
  try {
    const sdk = await loadVoiceSdk();
    if (!current()) return;
    const voice = currentVoiceOption();
    const name = window.hyUserName ? window.hyUserName() : null; // optional first name from the account (app.js)
    const conversation = await sdk.Conversation.startSession({
      agentId: ELEVENLABS_AGENT_ID,
      connectionType: 'webrtc',
      overrides: { agent: { language: currentLanguage, firstMessage: name ? t.firstMessageNamed(name) : t.firstMessage }, tts: { voiceId: voice.id } },
      dynamicVariables: { rodzaj: voice.gender === 'm' ? 'męskim' : 'żeńskim', imie: name || 'brak' },
      onModeChange: ({ mode }) => { if (current()) setVoiceState(mode); },
      onMessage: ({ message, role }) => { if (current()) addVoiceLine(role === 'agent' ? 'ai' : 'user', message); },
      onDisconnect: (details) => { if (current()) finishVoiceCall(details.reason === 'error' ? t.error : null); },
      onError: (message) => console.error('Doco voice:', message)
    });
    if (!current()) { conversation.endSession().catch(() => {}); return; }
    voiceConversation = conversation;
    if (voiceState === 'connecting') setVoiceState('listening');
    startVoiceTimer();
    startVoiceLevels();
  } catch (err) {
    console.error('Doco voice:', err);
    if (current()) finishVoiceCall(t.error);
  }
}

async function endVoiceCall() {
  const conversation = voiceConversation;
  finishVoiceCall();
  if (conversation) await conversation.endSession().catch(() => {});
}

function finishVoiceCall(errorMessage) {
  if (!voiceLive) return;
  voiceLive = false; voiceConversation = null;
  cancelAnimationFrame(voiceLevelFrame);
  voiceLemur?.setLevels(0, 0);
  voiceStage.setLevels(0, 0);
  stopVoiceTimer(!voiceCallStart);
  setVoiceState(errorMessage ? 'error' : 'ended', errorMessage);
  copyVoiceLinesToChat();
}

function renderVoiceButton(id, { icon, title, label, on, disabled, className }) {
  const btn = document.getElementById(id);
  if (className) btn.className = className;
  btn.innerHTML = icon; btn.title = title; btn.setAttribute('aria-label', title);
  btn.classList.toggle('on', !!on); btn.disabled = !!disabled;
  btn.nextElementSibling.textContent = label;
}

function setVoiceState(state, message) {
  const t = vt();
  voiceState = state;
  document.getElementById('voiceCall').className = `voice-call ${state}${voiceEntering ? ' entering' : ''}`;
  voiceLemur?.setState(state);
  document.getElementById('voiceStatus').textContent = message || t[state];
  const inCall = state === 'listening' || state === 'speaking';
  const loginLabel = (translations[currentLanguage] || translations.pl).loginBtn;
  renderVoiceButton('voiceMainBtn', voiceLive
    ? { icon: VOICE_ICONS.hangup, title: t.hangup, label: t.endLabel, className: 'voice-btn hangup' }
    : state === 'locked'
      ? { icon: VOICE_ICONS.person, title: loginLabel, label: loginLabel, className: 'voice-btn call' }
      : { icon: VOICE_ICONS.phone, title: t.call, label: t.callLabel, className: 'voice-btn call' });
  renderVoiceButton('voiceMicBtn', {
    icon: voiceMicOff ? VOICE_ICONS.micOff : VOICE_ICONS.mic, title: voiceMicOff ? t.micUnmute : t.micMute,
    label: t.micLabel, on: voiceMicOff, disabled: !inCall
  });
  renderVoiceButton('voiceSoundBtn', {
    icon: voiceSoundOff ? VOICE_ICONS.soundOff : VOICE_ICONS.sound, title: voiceSoundOff ? t.soundUnmute : t.soundMute,
    label: t.soundLabel, on: voiceSoundOff, disabled: !inCall
  });
}

// Mikrofon: Doco przestaje cię słyszeć, ale dalej mówi
function toggleVoiceMic() {
  if (!voiceConversation) return;
  voiceMicOff = !voiceMicOff;
  voiceConversation.setMicMuted(voiceMicOff);
  setVoiceState(voiceState);
}

// Głośnik: ty przestajesz słyszeć Doco, ale on dalej cię słucha, a zapis rozmowy leci na ekranie
function toggleVoiceSound() {
  if (!voiceConversation) return;
  voiceSoundOff = !voiceSoundOff;
  voiceConversation.setVolume({ volume: voiceSoundOff ? 0 : 1 });
  setVoiceState(voiceState);
}

function addVoiceLine(role, text) {
  if (!text || /^[\s.…]*$/.test(text)) return;
  voiceLines.push({ role, text });
  document.getElementById('voiceHint').style.display = 'none';
  const box = document.getElementById('voiceTranscript');
  const row = document.createElement('div'); row.className = `voice-line ${role}`;
  const bubble = document.createElement('div'); bubble.className = `bubble ${role}`; bubble.textContent = text;
  row.appendChild(bubble); box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

// Doco zjeżdża z góry na ogonie na swoje miejsce na horyzoncie, gdy rozmowa staje się dostępna.
// Imię i licznik pojawiają się dopiero, gdy wyląduje (lina przechodziłaby przez nie), wtedy też ugina się linia.
function enterVoiceLemur() {
  if (!voiceLemur?.enter) return;
  const call = document.getElementById('voiceCall');
  voiceEntering = true;
  call.classList.add('entering');
  voiceLemur.enter({ onLand: () => {
    voiceEntering = false;
    call.classList.remove('entering');
    voiceStage.impact();
  } });
}

// Licznik jak w telefonie: od odebrania do rozłączenia; po rozmowie zostaje na ekranie jej długość
function renderVoiceTimer() {
  const s = Math.floor((Date.now() - voiceCallStart) / 1000), m = Math.floor(s / 60);
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('voiceTimer').textContent = (m >= 60 ? `${Math.floor(m / 60)}:${pad(m % 60)}` : m) + ':' + pad(s % 60);
}
function startVoiceTimer() {
  voiceCallStart = Date.now();
  renderVoiceTimer();
  clearInterval(voiceTimerId);
  voiceTimerId = setInterval(renderVoiceTimer, 1000);
}
function stopVoiceTimer(clear) {
  clearInterval(voiceTimerId);
  if (clear) { voiceCallStart = 0; document.getElementById('voiceTimer').textContent = ''; }
}

// Po rozmowie jej zapis trafia do czatu, żeby można było ją kontynuować pisząc
function copyVoiceLinesToChat() {
  const start = voiceLines.findIndex(line => line.role === 'user');
  if (start === -1) return;
  const escape = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  voiceLines.slice(start).forEach(({ role, text }) => {
    appendMessage(role, escape(text));
    conversationHistory.push({ role: role === 'ai' ? 'assistant' : 'user', content: text });
  });
  voiceLines = [];
}

// Lemur dostaje oba poziomy głosu: twój (kiwa głową, gdy mówisz) i swój (pyszczek); horyzont pod nim faluje.
// Przy wyciszonym głośniku głośność Doco spada do zera, więc wtedy pyszczek rusza się sam.
function startVoiceLevels() {
  const tick = () => {
    const conversation = voiceConversation;
    if (!conversation) return;
    const input = voiceMicOff ? 0 : conversation.getInputVolume(), output = conversation.getOutputVolume();
    voiceLemur?.setLevels(input, output, { muted: voiceSoundOff });
    voiceStage.setLevels(input, output);
    voiceLevelFrame = requestAnimationFrame(tick);
  };
  cancelAnimationFrame(voiceLevelFrame);
  voiceLevelFrame = requestAnimationFrame(tick);
}

window.addEventListener('popstate', () => {
  if (document.getElementById('voiceOverlay').classList.contains('visible')) closeVoiceCall();
  if (document.getElementById('voicePickerOverlay').classList.contains('visible')) closeVoicePicker();
});
document.getElementById('voicePickerOverlay').addEventListener('click', (e) => { if (e.target.id === 'voicePickerOverlay') closeVoicePicker(); });

updateVoiceLanguage();
setVoiceState('ended', ' ');
// SDK ładuje się w tle po starcie strony, żeby rozmowa ruszała od razu po dotknięciu słuchawki
window.addEventListener('load', () => { if (ELEVENLABS_AGENT_ID) setTimeout(() => loadVoiceSdk().catch(() => {}), 2500); });
