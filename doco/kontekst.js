// What Doco already knows about the person, from what they saved in the app on this device: the mood diary
// (app.js, doco_moods_v1), pain in the diary (diary.js, doco_pain_diary_v1_<account>), checks in "Gdzie boli?"
// (gdzieboli:history:<account|anon>) and its profile (sex, age). The offline chat picks up the thread from it
// ("Widzę w dzienniku…"); the AI chat and the voice call get summary() as background. Read on demand, never stored.
/* global currentUser */
(function () {
  const DAY = 864e5;
  const MOODS = ['', 'bardzo źle', 'źle', 'średnio', 'dobrze', 'świetnie'];
  const DURATIONS = { hours: 'krócej niż dzień', days: 'od kilku dni', weeks: 'od 1–4 tygodni', months: 'ponad miesiąc' };
  const TRIAGE = { 'self-care': 'samoopieka', gp: 'lekarz w ciągu kilku dni', urgent: 'lekarz w ciągu 24 h', emergency: '112 albo SOR' };

  const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } };
  const user = () => (typeof currentUser !== 'undefined' && currentUser) || null;
  const recent = (at, days) => { const t = new Date(at).getTime(); return t && Date.now() - t <= days * DAY; };
  const short = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const years = (n) => (n === 1 ? 'rok' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'lata' : 'lat');
  const ago = (at) => {
    const d = Math.floor((Date.now() - new Date(at).getTime()) / DAY);
    return d <= 0 ? 'dziś' : d === 1 ? 'wczoraj' : `${d} dni temu`;
  };

  function get() {
    const u = user(), id = u && u.id;
    const moods = Object.entries(read('doco_moods_v1') || {})
      .filter(([day, m]) => m && m.mood >= 1 && m.mood <= 5 && recent(`${day}T12:00:00`, 14))
      .map(([day, m]) => ({ at: m.at || `${day}T12:00:00`, mood: m.mood, note: m.note || '' }))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const pains = (id ? read('doco_pain_diary_v1_' + id) || [] : [])
      .filter((e) => e && e.type === 'pain' && e.where && recent(e.at, 30))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const checks = [id, 'anon'].filter(Boolean).flatMap((k) => read('gdzieboli:history:' + k) || [])
      .filter((c) => c && c.where && recent(c.createdAt, 30))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const profile = (id && read('gdzieboli:profile:' + id)) || read('gdzieboli:profile:anon') || {};
    const name = u && (u.firstName || (u.fullName || '').split(' ')[0]) || '';
    return { name, profile, moods, pains, checks };
  }

  // A few short lines in Polish for the AI: what the person saved lately, newest first (empty when nothing is saved)
  function summary() {
    const c = get(), lines = [];
    const who = [c.profile.sex === 'f' ? 'kobieta' : c.profile.sex === 'm' ? 'mężczyzna' : '', c.profile.age ? `${c.profile.age} ${years(c.profile.age)}` : ''].filter(Boolean);
    if (c.name) lines.push(`Imię: ${short(c.name, 30)}.`);
    if (who.length) lines.push(`Profil z „Gdzie boli?”: ${who.join(', ')}.`);
    if (c.moods.length) lines.push('Nastrój z dziennika (ostatnie 2 tygodnie): ' + c.moods.slice(0, 7)
      .map((m) => `${ago(m.at)} ${MOODS[m.mood]}${m.note ? ` („${short(m.note, 60)}”)` : ''}`).join('; ') + '.');
    if (c.pains.length) lines.push('Ból zapisany w dzienniku: ' + c.pains.slice(0, 4)
      .map((p) => `${ago(p.at)} ${short(p.where, 50)}${p.level ? `, ${p.level}/10` : ''}${DURATIONS[p.duration] ? `, ${DURATIONS[p.duration]}` : ''}`).join('; ') + '.');
    if (c.checks.length) lines.push('Sprawdzenia objawów w „Gdzie boli?”: ' + c.checks.slice(0, 3)
      .map((k) => `${ago(k.createdAt)} ${short(k.where, 50)}${TRIAGE[k.triage] ? ` (zalecenie: ${TRIAGE[k.triage]})` : ''}`).join('; ') + '.');
    return lines.join('\n');
  }

  window.DocoContext = { get, summary };
})();
