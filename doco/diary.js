// DZIENNIK — samopoczucie i ból zalogowanego użytkownika na jednym ekranie (zakładka Dziennik, #dziennik).
// Nastrój pochodzi z dziennika nastroju (app.js: doco_moods_v1, te same twarze co w zakładce Nastrój),
// a wpisy o bólu dodaje „Gdzie boli?” przyciskiem „Dodaj wpis do dziennika” (src/lib/diary.ts).
// Wpisy o bólu należą do konta i leżą na tym urządzeniu: localStorage['doco_pain_diary_v1_<id konta>'] =
// [{ id, type: 'pain', at (ISO), where, regions, symptoms, level (1–10), duration, onset, trend, triage, advice, source }]

const DIARY_DAYS = 30; // okres podsumowania
// Kolor natężenia: od zieleni (1) do czerwieni (10), zawsze z liczbą obok
const diaryLevelColor = (n) => `hsl(${120 - ((n - 1) * 120) / 9} 70% 42%)`;
const diaryLevelInk = (n) => (n >= 9 ? '#fff' : '#0b0f14');

const diaryTexts = {
  pl: {
    locale: 'pl-PL', title: 'Dziennik', back: 'Więcej',
    lead: 'Twoje samopoczucie i ból w jednym miejscu. Łatwiej zauważysz, co się powtarza, i opowiesz o tym lekarzowi.',
    locked: 'Dziennik jest dostępny po zalogowaniu — wpisy należą do Twojego konta.',
    cta: 'Boli Cię coś? Sprawdź, gdzie boli',
    period: 'Ostatnie 30 dni', painDays: 'Dni z bólem', avgLevel: 'Średnie nasilenie', topWhere: 'Najczęściej boli', avgMood: 'Średni nastrój',
    ofDays: (n) => `z ${n} dni`, outOf10: 'na 10', outOf5: 'z 5', times: (n) => `${n}×`, noData: 'brak danych',
    insight: (a, b) => `W dni z bólem Twój nastrój był średnio ${a} z 5, a w pozostałe dni ${b} z 5.`,
    entries: 'Wpisy', fromNewest: 'od najnowszego',
    empty: 'Na razie pusto. Zapisz wyżej, jak się czujesz, a gdy coś zaboli, dodaj wpis z „Gdzie boli?”.',
    device: 'Wpisy należą do Twojego konta i zapisują się na tym urządzeniu.', notMedical: 'To nie jest diagnoza. W nagłej sytuacji dzwoń pod 112.',
    deleteQ: 'Usunąć ten wpis?', deleteLabel: 'Usuń wpis', today: 'dziś', yesterday: 'wczoraj', mood: 'Nastrój', pain: 'Ból',
    moods: ['Bardzo źle', 'Źle', 'Średnio', 'Dobrze', 'Świetnie'], severity: ['lekki', 'umiarkowany', 'silny'],
    durations: { hours: 'Krócej niż dzień', days: 'Od kilku dni', weeks: 'Od 1 do 4 tygodni', months: 'Ponad miesiąc' },
    day: { one: 'dzień', few: 'dni', many: 'dni', other: 'dnia' }, entry: { one: 'wpis', few: 'wpisy', many: 'wpisów', other: 'wpisu' }
  },
  en: {
    locale: 'en-GB', title: 'Diary', back: 'More',
    lead: 'How you feel and what hurts, in one place. It\'s easier to spot what keeps coming back and to tell your doctor about it.',
    locked: 'The diary is available once you sign in, so the entries belong to your account.',
    cta: 'Does something hurt? Check where it hurts',
    period: 'Last 30 days', painDays: 'Days with pain', avgLevel: 'Average intensity', topWhere: 'Hurts most often', avgMood: 'Average mood',
    ofDays: (n) => `of ${n} days`, outOf10: 'out of 10', outOf5: 'out of 5', times: (n) => `${n}×`, noData: 'no data yet',
    insight: (a, b) => `On days with pain your mood was ${a} out of 5 on average, and ${b} out of 5 on other days.`,
    entries: 'Entries', fromNewest: 'newest first',
    empty: 'Nothing here yet. Note how you feel above, and when something hurts, add an entry from "Where does it hurt?".',
    device: 'The entries belong to your account and are saved on this device.', notMedical: 'This is not a diagnosis. In an emergency call 112.',
    deleteQ: 'Delete this entry?', deleteLabel: 'Delete entry', today: 'today', yesterday: 'yesterday', mood: 'Mood', pain: 'Pain',
    moods: ['Very bad', 'Bad', 'Okay', 'Good', 'Great'], severity: ['mild', 'moderate', 'severe'],
    durations: { hours: 'Less than a day', days: 'A few days', weeks: '1 to 4 weeks', months: 'Over a month' },
    day: { one: 'day', other: 'days' }, entry: { one: 'entry', other: 'entries' }
  },
  uk: {
    locale: 'uk-UA', title: 'Щоденник', back: 'Більше',
    lead: 'Твоє самопочуття й біль в одному місці. Так легше помітити, що повторюється, і розповісти про це лікарю.',
    locked: 'Щоденник доступний після входу — записи належать твоєму обліковому запису.',
    cta: 'Щось болить? Перевір, де болить',
    period: 'Останні 30 днів', painDays: 'Дні з болем', avgLevel: 'Середня сила болю', topWhere: 'Найчастіше болить', avgMood: 'Середній настрій',
    ofDays: (n) => `з ${n} днів`, outOf10: 'з 10', outOf5: 'з 5', times: (n) => `${n}×`, noData: 'ще немає даних',
    insight: (a, b) => `У дні з болем твій настрій був у середньому ${a} з 5, а в інші дні — ${b} з 5.`,
    entries: 'Записи', fromNewest: 'від найновішого',
    empty: 'Поки що порожньо. Відзнач вище, як почуваєшся, а коли щось заболить — додай запис із «Де болить?».',
    device: 'Записи належать твоєму обліковому запису й зберігаються на цьому пристрої.', notMedical: 'Це не діагноз. У надзвичайній ситуації телефонуй на 112.',
    deleteQ: 'Видалити цей запис?', deleteLabel: 'Видалити запис', today: 'сьогодні', yesterday: 'вчора', mood: 'Настрій', pain: 'Біль',
    moods: ['Дуже погано', 'Погано', 'Так собі', 'Добре', 'Чудово'], severity: ['легкий', 'помірний', 'сильний'],
    durations: { hours: 'Менше доби', days: 'Кілька днів', weeks: 'Від 1 до 4 тижнів', months: 'Понад місяць' },
    day: { one: 'день', few: 'дні', many: 'днів', other: 'дня' }, entry: { one: 'запис', few: 'записи', many: 'записів', other: 'запису' }
  },
  de: {
    locale: 'de-DE', title: 'Tagebuch', back: 'Mehr',
    lead: 'Dein Befinden und deine Schmerzen an einem Ort. So erkennst du leichter, was wiederkehrt, und kannst es in der Arztpraxis erzählen.',
    locked: 'Das Tagebuch ist nach der Anmeldung verfügbar – die Einträge gehören zu deinem Konto.',
    cta: 'Tut etwas weh? Prüfe, wo es wehtut',
    period: 'Letzte 30 Tage', painDays: 'Tage mit Schmerzen', avgLevel: 'Mittlere Stärke', topWhere: 'Am häufigsten', avgMood: 'Mittlere Stimmung',
    ofDays: (n) => `von ${n} Tagen`, outOf10: 'von 10', outOf5: 'von 5', times: (n) => `${n}×`, noData: 'noch keine Daten',
    insight: (a, b) => `An Tagen mit Schmerzen lag deine Stimmung im Schnitt bei ${a} von 5, an anderen Tagen bei ${b} von 5.`,
    entries: 'Einträge', fromNewest: 'neueste zuerst',
    empty: 'Noch leer. Halte oben fest, wie du dich fühlst, und wenn etwas wehtut, füge einen Eintrag aus „Wo tut es weh?“ hinzu.',
    device: 'Die Einträge gehören zu deinem Konto und werden auf diesem Gerät gespeichert.', notMedical: 'Das ist keine Diagnose. Im Notfall wähle die 112.',
    deleteQ: 'Diesen Eintrag löschen?', deleteLabel: 'Eintrag löschen', today: 'heute', yesterday: 'gestern', mood: 'Stimmung', pain: 'Schmerz',
    moods: ['Sehr schlecht', 'Schlecht', 'Mittel', 'Gut', 'Super'], severity: ['leicht', 'mäßig', 'stark'],
    durations: { hours: 'Weniger als ein Tag', days: 'Seit ein paar Tagen', weeks: '1 bis 4 Wochen', months: 'Über einen Monat' },
    day: { one: 'Tag', other: 'Tage' }, entry: { one: 'Eintrag', other: 'Einträge' }
  },
  es: {
    locale: 'es-ES', title: 'Diario', back: 'Más',
    lead: 'Cómo te sientes y lo que te duele, en un solo lugar. Así verás más fácil lo que se repite y podrás contárselo a tu médico.',
    locked: 'El diario está disponible al iniciar sesión: los registros pertenecen a tu cuenta.',
    cta: '¿Te duele algo? Revisa dónde duele',
    period: 'Últimos 30 días', painDays: 'Días con dolor', avgLevel: 'Intensidad media', topWhere: 'Duele más a menudo', avgMood: 'Ánimo medio',
    ofDays: (n) => `de ${n} días`, outOf10: 'de 10', outOf5: 'de 5', times: (n) => `${n}×`, noData: 'aún sin datos',
    insight: (a, b) => `Los días con dolor tu ánimo fue de ${a} sobre 5 de media, y ${b} sobre 5 el resto de días.`,
    entries: 'Registros', fromNewest: 'del más reciente',
    empty: 'Aún está vacío. Anota arriba cómo te sientes y, cuando algo te duela, añade un registro desde «¿Dónde duele?».',
    device: 'Los registros pertenecen a tu cuenta y se guardan en este dispositivo.', notMedical: 'Esto no es un diagnóstico. En una emergencia llama al 112.',
    deleteQ: '¿Eliminar este registro?', deleteLabel: 'Eliminar registro', today: 'hoy', yesterday: 'ayer', mood: 'Ánimo', pain: 'Dolor',
    moods: ['Muy mal', 'Mal', 'Regular', 'Bien', 'Genial'], severity: ['leve', 'moderado', 'intenso'],
    durations: { hours: 'Menos de un día', days: 'Desde hace unos días', weeks: 'De 1 a 4 semanas', months: 'Más de un mes' },
    day: { one: 'día', other: 'días' }, entry: { one: 'registro', other: 'registros' }
  }
};

// Kept in sessionStorage too: signing in with Google reloads the page on the way back
let diaryLoginRequestedAt = Number(sessionStorage.getItem('doco_diary_login')) || 0;

function dt() { return diaryTexts[currentLanguage] || diaryTexts.pl; }
const diaryUser = () => currentUser || null;
const diaryKey = () => 'doco_pain_diary_v1_' + diaryUser().id;
const diaryEsc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const diaryVisible = () => document.getElementById('app')?.dataset.view === 'dziennik';
const diaryNum = (n) => new Intl.NumberFormat(dt().locale, { maximumFractionDigits: 1 }).format(n);
const diaryPlural = (n, forms) => forms[new Intl.PluralRules(dt().locale).select(n)] || forms.other;
const diaryDayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function loadPain() {
  try { return (JSON.parse(localStorage.getItem(diaryKey()) || '[]') || []).filter(e => e && e.type === 'pain' && e.at); } catch (e) { return []; }
}
function storePain(entries) {
  try { localStorage.setItem(diaryKey(), JSON.stringify(entries)); return true; } catch (e) { return false; }
}
// Mood diary from app.js: { 'YYYY-MM-DD': { mood 1–5, note, at } }, one per day
function loadMoods() {
  const all = typeof window.hyMoods === 'function' ? window.hyMoods() : {};
  return Object.entries(all).filter(([, m]) => m && m.mood).map(([day, m]) => ({
    type: 'mood', day, mood: m.mood, note: m.note || '',
    at: new Date(m.at || `${day}T12:00:00`).toISOString()
  }));
}

function updateDiaryLanguage() {
  if (diaryVisible()) renderDiaryView();
}

// Entries belong to the account: whoever tapped "Zaloguj się" here comes straight back after signing in
function updateDiaryAuth(user) {
  if (user && Date.now() - diaryLoginRequestedAt < 5 * 60 * 1000) {
    diaryLoginRequestedAt = 0;
    sessionStorage.removeItem('doco_diary_login');
    hyShowView('dziennik');
  }
  if (diaryVisible()) renderDiaryView();
}

function diaryLogin() {
  diaryLoginRequestedAt = Date.now();
  sessionStorage.setItem('doco_diary_login', diaryLoginRequestedAt);
  openAuth();
}

function deleteDiaryEntry(id) {
  if (!confirm(dt().deleteQ)) return;
  storePain(loadPain().filter(e => e.id !== id));
  renderDiaryView();
}

// Statistics for the last DIARY_DAYS days
function diaryStats(pain, moods) {
  const since = new Date(); since.setHours(0, 0, 0, 0); since.setDate(since.getDate() - (DIARY_DAYS - 1));
  const p = pain.filter(e => new Date(e.at) >= since);
  const m = moods.filter(e => new Date(`${e.day}T12:00:00`) >= since);
  const painDays = new Set(p.map(e => diaryDayKey(new Date(e.at))));
  const levels = p.map(e => e.level).filter(Number.isFinite);
  // Most frequent place; on a tie, the one that hurt most recently
  const counts = {}, last = {};
  p.forEach(e => { counts[e.where] = (counts[e.where] || 0) + 1; if (!last[e.where] || e.at > last[e.where]) last[e.where] = e.at; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1] || last[b[0]].localeCompare(last[a[0]]))[0];
  const avg = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const withPain = m.filter(e => painDays.has(e.day)).map(e => e.mood);
  const withoutPain = m.filter(e => !painDays.has(e.day)).map(e => e.mood);
  return {
    painDays: painDays.size, painCount: p.length,
    avgLevel: avg(levels), levelCount: levels.length,
    top, avgMood: avg(m.map(e => e.mood)), moodDays: m.length,
    // compare only with at least two days on each side, a single day says little
    moodWithPain: withPain.length >= 2 ? avg(withPain) : null, moodWithoutPain: withoutPain.length >= 2 ? avg(withoutPain) : null
  };
}

function renderDiaryView() {
  const page = document.getElementById('diaryPage');
  if (!page) return;
  const t = dt();
  const head = `<h2 class="page-title" id="diaryHeading">${t.title}</h2><p class="page-lead">${t.lead}</p>`;
  if (!diaryUser()) {
    const login = (translations[currentLanguage] || translations.pl).loginBtn;
    page.innerHTML = `${head}<div class="account"><p class="page-lead">${t.locked}</p>
      <button type="button" class="btn-green" onclick="diaryLogin()"><svg class="ico"><use href="#i-login"/></svg><span>${login}</span></button></div>`;
    return;
  }
  const pain = loadPain();
  const moods = loadMoods();
  const s = diaryStats(pain, moods);

  const stat = (label, value, context, extra = '') => `<div class="diary-stat"${extra}><span class="diary-stat-label">${label}</span><span class="diary-stat-value">${value}</span><span class="diary-stat-context">${context}</span></div>`;
  const levelSev = s.avgLevel === null ? null : Math.round(s.avgLevel);
  const stats = [
    stat(t.painDays, diaryNum(s.painDays), t.ofDays(DIARY_DAYS)),
    stat(t.avgLevel, s.avgLevel === null ? '—' : `${diaryNum(s.avgLevel)}`, s.avgLevel === null ? t.noData : `${t.outOf10} · ${s.levelCount} ${diaryPlural(s.levelCount, t.entry)}`,
      levelSev ? ` style="--lvl-color:${diaryLevelColor(levelSev)}"` : ''),
    stat(t.topWhere, s.top ? diaryEsc(s.top[0]) : '—', s.top ? t.times(s.top[1]) : t.noData),
    stat(t.avgMood, s.avgMood === null ? '—' : t.moods[Math.round(s.avgMood) - 1], s.avgMood === null ? t.noData : `${diaryNum(s.avgMood)} ${t.outOf5} · ${s.moodDays} ${diaryPlural(s.moodDays, t.day)}`)
  ].join('');
  const insight = s.moodWithPain !== null && s.moodWithoutPain !== null ? `<p class="diary-insight">${t.insight(diaryNum(s.moodWithPain), diaryNum(s.moodWithoutPain))}</p>` : '';

  // The last 30 days first; how you feel today is asked in Nastrój, so not again here.
  page.innerHTML = `${head}
    <h3 class="page-sub">${t.period}</h3>
    <div class="diary-stats">${stats}</div>
    ${insight}
    <button type="button" class="diary-cta" onclick="hyShowView('objawy')"><svg class="ico"><use href="#i-pulse"/></svg><span>${t.cta}</span><svg class="ico row-go"><use href="#i-next"/></svg></button>
    <h3 class="page-sub">${t.entries} <span class="diary-sub-note">${t.fromNewest}</span></h3>
    ${diaryTilesHtml(pain, moods, t)}
    <p class="diary-fine">${t.device} ${t.notMedical}</p>`;
}

// Tiles from the newest entry to the oldest (top left is the latest), with a heading for each month
function diaryTilesHtml(pain, moods, t) {
  const entries = [...pain, ...moods].sort((a, b) => b.at.localeCompare(a.at));
  if (!entries.length) return `<p class="diary-empty">${t.empty}</p>`;
  const month = new Intl.DateTimeFormat(t.locale, { month: 'long', year: 'numeric' });
  let lastMonth = '';
  const html = entries.map(e => {
    const d = new Date(e.at);
    const m = month.format(d);
    const header = m !== lastMonth ? `<h4 class="diary-month">${m}</h4>` : '';
    lastMonth = m;
    if (e.type === 'mood') {
      return `${header}<article class="diary-tile is-mood" data-mood="${e.mood}">
        <div class="diary-tile-top"><svg class="diary-face"><use href="#face-${e.mood}"/></svg><span class="diary-when">${diaryWhen(d, e.type)}</span></div>
        <span class="diary-kind">${t.mood}</span><strong class="diary-tile-title">${t.moods[e.mood - 1]}</strong>
        ${e.note ? `<p class="diary-tile-note">${diaryEsc(e.note)}</p>` : ''}
      </article>`;
    }
    const lvl = Number.isFinite(e.level) ? e.level : null;
    const sev = lvl === null ? '' : t.severity[lvl <= 3 ? 0 : lvl <= 6 ? 1 : 2];
    return `${header}<article class="diary-tile is-pain">
      <div class="diary-tile-top">${lvl === null ? '<svg class="ico diary-pain-ico"><use href="#i-pulse"/></svg>' : `<span class="diary-level" style="background:${diaryLevelColor(lvl)};color:${diaryLevelInk(lvl)}">${lvl}</span>`}
        <span class="diary-when">${diaryWhen(d, e.type)}</span>
        <button type="button" class="diary-delete" onclick="deleteDiaryEntry('${diaryEsc(e.id)}')" aria-label="${t.deleteLabel}"><svg class="ico"><use href="#i-close"/></svg></button></div>
      <span class="diary-kind">${t.pain}${sev ? ` · ${lvl}/10 ${sev}` : ''}</span><strong class="diary-tile-title">${diaryEsc(e.where)}</strong>
      ${e.duration && t.durations[e.duration] ? `<span class="diary-tile-meta">${t.durations[e.duration]}</span>` : ''}
      ${e.symptoms?.length ? `<p class="diary-tile-note">${diaryEsc(e.symptoms.join(', '))}</p>` : ''}
      ${e.advice ? `<span class="diary-tile-advice">${diaryEsc(e.advice)}</span>` : ''}
    </article>`;
  }).join('');
  return `<div class="diary-tiles">${html}</div>`;
}

// "dziś, 14:20", "wczoraj, 9:05", "3 paź, 14:20"; a mood is one per day, so only the day
function diaryWhen(d, type) {
  const t = dt(), now = new Date();
  const time = type === 'mood' ? '' : `, ${new Intl.DateTimeFormat(t.locale, { hour: '2-digit', minute: '2-digit' }).format(d)}`;
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return t.today + time;
  if (d.toDateString() === yesterday.toDateString()) return t.yesterday + time;
  return new Intl.DateTimeFormat(t.locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(d) + time;
}

updateDiaryLanguage();
