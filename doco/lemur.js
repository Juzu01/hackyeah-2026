// MASKOTKA DOCO: mały lemur katta, twarz rozmowy głosowej (voice.js).
//
// Rysunek: płaskie kolory, jeden kontur (4 j.), pięć barw na czarnym tle, bez gradientów i odblasków.
// SVG składa się tutaj, z osobnymi id dla każdej instancji. Każda część ma data-part i data-pivot
// (staw, wokół którego się obraca), więc rig to tylko transformacje i kilka przeliczanych ścieżek.
//
// Ruch: jedna pętla requestAnimationFrame, warstwy od spodu:
//   1. poza stanu (connecting / listening / ...): każdy kanał dochodzi do celu krytycznie tłumionym
//      wygładzaniem 2. rzędu (SmoothDamp), więc zmiana stanu ma i rozpęd, i hamowanie, bez przestrzału;
//   2. klipy: klatki kluczowe z krzywymi (kiwnięcie, „mhm”, machanie, wzruszenie ramion, chichot...),
//      dokładane addytywnie albo mieszane wagą (ręce celują w pozy z IK);
//   3. warstwa życia: oddech, fala po ogonie, mrugnięcia, sakkady, strzyżenie uchem, przenoszenie ciężaru;
//   4. ruch wtórny: uszy, ogon i łapki dociągają za głową i ciałem.
// Głos: pyszczek idzie za modulacją głosu Doco (automat sylab: otwórz na wzroście, domknij w dolinie),
// przy wyciszonym dźwięku ten sam automat dostaje własny rytm mowy; głowa akcentuje sylaby, a na
// początku frazy czasem pada gest otwartą dłonią. Gdy mówisz: adaptacyjny próg szumu (uczony tylko
// podczas słuchania), kiwnięcie w krótkiej pauzie i wyraźne „mhm” na końcu wypowiedzi.
//
//   const doco = DocoLemur.create(element);
//   doco.setState('connecting' | 'listening' | 'speaking' | 'ended' | 'error' | 'locked');
//   doco.setLevels(input, output, { muted });   // co klatkę, głośności 0..1 z ElevenLabs
//   doco.poke(); doco.wave(); doco.nod(); doco.mhm(); doco.shrug(); doco.pet(); doco.care(); doco.surprise();
//   doco.enter({ onLand });                      // zjeżdża z góry na ogonie i siada (gdy rozmowa staje się dostępna)
(function () {
  'use strict';

  // ───────────────────────────── rysunek ─────────────────────────────
  // tusz, szałwia (futro), las (dłonie, stopy, maska oczu, pierścienie), krem, bursztyn (tęczówki);
  // róż języka i serduszko (w kolorze aplikacji, --green) pojawiają się tylko na chwilę
  const C = { ink: '#16271e', sage: '#86b072', forest: '#3f6c49', cream: '#f4efd9', amber: '#f0b54a', rose: '#e48c79', mint: '#a6e8c4' };
  const AX = 110; // oś symetrii postaci; L/R = lewa/prawa strona patrzącego
  // kadr: twarz blisko środka karty (oś 110 przy środku 120); ogon może wyjść ~10 j. w prawo (overflow: visible)
  const VB = '0 0 240 260';
  const HEAD = 'M110 38C141 38 167 57 170 88C171 97 174 105 180 113C171 116 165 120 161 127C150 145 132 154 110 154C88 154 70 145 59 127C55 120 49 116 40 113C46 105 49 97 50 88C53 57 79 38 110 38Z';
  const CROWN = 'M110 97C115 83 126 75 139 75C152 75 164 83 172 96L212 96L212 0L8 0L8 96L48 96C56 83 68 75 81 75C94 75 105 83 110 97Z';
  const BODY = 'M84 138C65 148 56 178 57 206C58 232 77 246 110 246C143 246 162 232 163 206C164 178 155 148 136 138Z';
  // brzuszek węższy niż twarz: najjaśniejszą plamą ma być maska pyszczka, nie tułów
  const BELLY = 'M110 150C125 150 134 174 134 199C134 222 124 236 110 236C96 236 86 222 86 199C86 174 95 150 110 150Z';
  const EAR = 'M90 56C80 40 60 26 36 25C25 25 19 31 19.5 42C20 62 39 80 60 88Z';
  const EAR_IN = 'M82 59C73 47 59 36 41 35C33.5 35 29.5 39 30 46C31 60 43 72 60 78Z';
  const PATCH = 'M99 121.5C103.5 113 101.5 97 90.5 91C79 85.5 68 92.5 69 104C70 114.5 83 121 99 121.5Z';
  const FOOT = 'M72 241C72 233.5 80 230.5 89 231C99 231.5 104 236.5 103.5 243C103 249.5 96 253 87 253C78 253 72 248.5 72 241Z';
  const TOES = 'M85 253V248.5M93.5 252.5V248';
  const NOSE = 'M101.5 116.8Q110 113.6 118.5 116.8Q117.6 123.4 110 126.4Q102.4 123.4 101.5 116.8Z';
  const PAW_REST = 'M-11 2C-11.5 -5.5 -6 -9.5 0 -9.5C6 -9.5 11.5 -5.5 11 2C10.5 8.5 6 12 0 12C-6 12 -10.5 8.5 -11 2Z';
  const PAW_REST_TOES = 'M-3.6 12V7.5M3.6 12V7.5';
  // otwarta dłoń jak rękawiczka: dłoń, trzy palce-kapsułki wzdłuż +y z przerwami, osobny kciuk (-x)
  // [x, y, szerokość, długość, obrót]; kapsuła = prostokąt z pełnym zaokrągleniem
  const PAW_PALM = [0, 0, 8.5, 8];
  const PAW_FINGERS = [[-6.4, 8.6, 5.2, 8.4, 12], [0, 9.4, 5.2, 8.4, 0], [6.4, 8.6, 5.2, 8.4, -12]];
  const PAW_THUMB = [-9.6, 0.8, 5, 7.6, 58];
  const HEART = 'M110 199C102.5 193.6 94 188 94 180.6C94 175.6 97.8 172 102.6 172C106.1 172 108.6 173.9 110 176.8C111.4 173.9 113.9 172 117.4 172C122.2 172 126 175.6 126 180.6C126 188 117.5 193.6 110 199Z';
  const QMARK = 'M-5.4 -6C-5.4 -11.6 5.4 -12 5.4 -5.4C5.4 -1.2 0 -0.8 0 3.6';
  // pyszczek: kreski (spokojny łuk, zamknięty przy mowie, płaski, falisty) i pełne kształty do mowy
  // kreska pod nosem kończy się na 129.5; każdy pyszczek zaczyna się co najmniej 2 j. niżej,
  // żeby nos, kreska i usta nie zlewały się w jeden znak (kielich, dziurka od klucza)
  const MOUTH_LINES = {
    smile: 'M103 130.5Q110 136.5 117 130.5',
    soft: 'M104.6 131.8Q110 134.6 115.4 131.8',
    flat: 'M105 134.8H115',
    wavy: 'M102.6 135Q106.3 131.8 110 134.6Q113.7 137.4 117.4 134',
  };
  const MOUTH_FILLS = {
    open: 'M103.6 132.2Q110 133.8 116.4 132.2Q116 139.2 110 139.2Q104 139.2 103.6 132.2Z',
    a: 'M102.2 131.8Q110 134 117.8 131.8Q117.8 143 110 143Q102.2 143 102.2 131.8Z',
    o: 'M110 132.6C112.5 132.6 113.8 135.2 113.8 137.8C113.8 140.6 112.2 142.8 110 142.8C107.8 142.8 106.2 140.6 106.2 137.8C106.2 135.2 107.5 132.6 110 132.6Z',
    grin: 'M100.6 131.4Q110 134.6 119.4 131.4Q118.6 142 110 142Q101.4 142 100.6 131.4Z',
  };
  const TONGUE = { a: [146, 7.6], grin: [144.8, 7.2] }; // cy, ry; widać najwyżej ~5 j.

  // ogon: linia środkowa całkowana z profilu kierunku, liczona co klatkę z (sway, curl, fala)
  // gruby, puszysty ogon katty: 5 szerokich pierścieni, ciemny koniec
  const TAIL = { bx: 143, by: 228, len: 196, n: 64, w: 24, th0: -4, turn: -92, a0: 0.08, a1: 0.45, hook: 160, h0: 0.7, h1: 1, hp: 1.2, rings: 5 };
  // ręka: dwa segmenty FK; kąty w stopniach (y w dół), strona R to lustro (kąt -> 180 - kąt)
  const ARM = { sx: 70, sy: 160, l1: 26, l2: 30 }; // bark pod brodą, przedramię dłuższe: łokcie odstają
  // wejście: zjeżdża z góry głową w dół, wisząc na własnym ogonie jak na linie, na dole sprężynuje,
  // puszcza ogon, robi przewrót i siada na swoim miejscu. Czasy w s od startu; dy = przesunięcie środka
  // ciała (110, 150) w pionie; lina idzie do punktu wysoko nad kadrem (nad kartą, więc jej koniec ucina krawędź).
  const ENTER = { drop: 1.3, bounce: 1.62, flip: 1.76, land: 2.18, end: 2.95, from: -520, hang: -72, ax: 2 * AX - TAIL.bx, ay: -720 };

  const D2R = Math.PI / 180;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const r1 = (n) => Math.round(n * 10) / 10;
  const r2 = (n) => Math.round(n * 100) / 100;
  const r4 = (n) => Math.round(n * 10000) / 10000;
  const smooth = (a, b, u) => { const k = clamp((u - a) / (b - a)); return k * k * (3 - 2 * k); };

  // lustro ścieżki (tylko bezwzględne M L C Q H V Z) względem osi postaci
  function mirrorD(d) {
    const tok = d.match(/[MLCQHVZ]|-?\d*\.?\d+/g);
    const out = [];
    let cmd = '';
    for (let i = 0; i < tok.length;) {
      const s = tok[i];
      if (/[A-Z]/.test(s)) { cmd = s; out.push(s); i++; continue; }
      if (cmd === 'H') { out.push(r2(2 * AX - s)); i++; continue; }
      if (cmd === 'V') { out.push(s); i++; continue; }
      out.push(r2(2 * AX - tok[i]) + ' ' + tok[i + 1]); i += 2;
    }
    return out.join(' ');
  }

  const EYE = { cy: 103.5, r: 9.5, pupil: 6.8, L: 85.5, R: 134.5 };
  function eyeSVG(p, side) {
    const cx = EYE[side], cy = EYE.cy, r = EYE.r;
    const patch = side === 'R' ? mirrorD(PATCH) : PATCH;
    // bursztynowa tęczówka leży wprost na ciemnej masce, bez obwódki; powieki mają kolor maski,
    // więc przymknięte oko jest po prostu ściętym kołem (krawędź górnej prawie płaska)
    const lid = `M${cx - 17} ${cy - r - 30}H${cx + 17}V${cy - r - 1.5}Q${cx} ${cy - r + 2.5} ${cx - 17} ${cy - r - 1.5}Z`;
    const low = `M${cx - 12} ${cy + r + 4}Q${cx} ${cy + r - 10} ${cx + 12} ${cy + r + 4}V${cy + r + 26}H${cx - 12}Z`;
    return `
      <g data-part="eye${side}" data-pivot="${cx} ${cy}">
        <path d="${patch}" fill="${C.forest}"/>
        <g data-eye="open">
          <g clip-path="url(#${p}iris${side})">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="${C.amber}"/>
            <g data-part="pupil${side}" data-pivot="${cx} ${cy}"><circle cx="${cx}" cy="${cy}" r="${EYE.pupil}" fill="${C.ink}"/></g>
            <path data-part="low${side}" d="${low}" fill="${C.forest}"/>
            <path data-part="lid${side}" d="${lid}" fill="${C.forest}"/>
          </g>
        </g>
        <path data-eye="happy" display="none" d="M${cx - 8.5} ${cy + 3}Q${cx} ${cy - 7.5} ${cx + 8.5} ${cy + 3}" fill="none" stroke="${C.cream}" stroke-width="3.6" stroke-linecap="round"/>
        <path data-eye="closed" display="none" d="M${cx - 8.5} ${cy - 1}Q${cx} ${cy + 6.5} ${cx + 8.5} ${cy - 1}" fill="none" stroke="${C.cream}" stroke-width="3.6" stroke-linecap="round"/>
      </g>`;
  }

  // kapsuła (palec, kciuk) jako zaokrąglony prostokąt obrócony wokół swojego środka
  const capsule = (c, extra) => `<rect x="${-c[2] / 2}" y="${-c[3] / 2}" width="${c[2]}" height="${c[3]}" rx="${c[2] / 2}" transform="translate(${c[0]} ${c[1]}) rotate(${c[4]})" ${extra}/>`;
  const palm = (extra) => `<ellipse cx="${PAW_PALM[0]}" cy="${PAW_PALM[1]}" rx="${PAW_PALM[2]}" ry="${PAW_PALM[3]}" ${extra}/>`;
  function pawOpenSVG() {
    // obrys sumy kształtów: najpierw wszystko grubym tuszem, potem wypełnienia; przerwy między
    // palcami zostają ciemne, a krótkie kreski wchodzą z nich w dłoń
    const inkS = `fill="${C.ink}" stroke="${C.ink}" stroke-width="5.6" stroke-linejoin="round"`;
    const fill = `fill="${C.forest}"`;
    const parts = [palm, ...PAW_FINGERS.map((f) => (x) => capsule(f, x)), (x) => capsule(PAW_THUMB, x)];
    const div = [[-3.2, 3.1, -3.4, 6.4], [3.2, 3.1, 3.4, 6.4]].map((l) => `M${l[0]} ${l[1]}L${l[2]} ${l[3]}`).join('');
    return `<g transform="scale(1.15)">`
      + parts.map((f) => f(inkS)).join('')
      + capsule(PAW_THUMB, fill) + PAW_FINGERS.map((f) => capsule(f, fill)).join('') + palm(fill)
      + `<path d="${div}M-6.6 -2.6Q-8.4 -0.4 -7.6 2.6" fill="none" stroke="${C.ink}" stroke-width="2.2" stroke-linecap="round"/>`
      + `<ellipse cx="0" cy="1.2" rx="4.2" ry="3.6" fill="${C.sage}"/>`
      + '</g>';
  }

  function armSVG(side) {
    const R = side === 'R';
    return `
      <g data-part="arm${side}" data-pivot="${R ? 2 * AX - ARM.sx : ARM.sx} ${ARM.sy}">
        <path data-arm="ink" fill="none" stroke="${C.ink}" stroke-width="27" stroke-linecap="round"/>
        <path data-arm="fur" fill="none" stroke="${C.sage}" stroke-width="19" stroke-linecap="round"/>
        <g data-hand="${side}"><g data-part="paw${side}" data-pivot="0 0"><g${R ? ' transform="scale(-1 1)"' : ''}>
          <g data-paw="rest">
            <path d="${PAW_REST}" fill="${C.forest}" stroke="${C.ink}" stroke-width="4"/>
            <path d="${PAW_REST_TOES}" fill="none" stroke="${C.ink}" stroke-width="2.8" stroke-linecap="round"/>
          </g>
          <g data-paw="open" display="none">${pawOpenSVG()}</g>
        </g></g></g>
      </g>`;
  }

  function legSVG(side) {
    const R = side === 'R', cx = R ? 2 * AX - 73 : 73;
    return `
      <g data-part="leg${side}" data-pivot="${cx} 217">
        <ellipse cx="${cx}" cy="225" rx="22" ry="19" fill="${C.sage}" stroke="${C.ink}" stroke-width="4"/>
        <path d="${R ? mirrorD(FOOT) : FOOT}" fill="${C.forest}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>
        <path d="${R ? mirrorD(TOES) : TOES}" fill="none" stroke="${C.ink}" stroke-width="2.8" stroke-linecap="round"/>
      </g>`;
  }

  function earSVG(side) {
    const R = side === 'R';
    return `
      <g data-part="ear${side}" data-pivot="${R ? 2 * AX - 76 : 76} 66">
        <path d="${R ? mirrorD(EAR) : EAR}" fill="${C.sage}" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>
        <path d="${R ? mirrorD(EAR_IN) : EAR_IN}" fill="${C.forest}"/>
      </g>`;
  }

  function browSVG(side) {
    const d = 'M92.5 83Q85 79.5 77.5 83';
    const R = side === 'R';
    // brwi nie przenikają (półprzezroczysta kreska wygląda jak smuga): wjeżdżają z góry oka i rosną wszerz
    return `<g data-part="brow${side}" data-pivot="${R ? 135 : 85} 82" display="none"><path d="${R ? mirrorD(d) : d}" fill="none" stroke="${C.ink}" stroke-width="3.6" stroke-linecap="round"/></g>`;
  }

  function mouthSVG(p) {
    let s = '';
    for (const [k, d] of Object.entries(MOUTH_LINES)) {
      s += `<path data-mouth="${k}" display="${k === 'smile' ? 'inline' : 'none'}" d="${d}" fill="none" stroke="${C.ink}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    for (const [k, d] of Object.entries(MOUTH_FILLS)) {
      const tg = TONGUE[k];
      s += `<g data-mouth="${k}" display="none">`
        + (tg ? `<clipPath id="${p}m${k}"><path d="${d}"/></clipPath>` : '')
        + `<path d="${d}" fill="${C.ink}" stroke="${C.ink}" stroke-width="2.4" stroke-linejoin="round"/>`
        + (tg ? `<ellipse cx="110" cy="${tg[0]}" rx="7.5" ry="${tg[1]}" fill="${C.rose}" clip-path="url(#${p}m${k})"/>` : '')
        + '</g>';
    }
    return s;
  }

  function svgMarkup(p) {
    const ink = C.ink;
    return `
<svg class="doco-lemur" viewBox="${VB}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <clipPath id="${p}head"><path d="${HEAD}"/></clipPath>
    <clipPath id="${p}body"><path d="${BODY}"/></clipPath>
    <clipPath id="${p}irisL"><circle cx="${EYE.L}" cy="${EYE.cy}" r="${EYE.r}"/></clipPath>
    <clipPath id="${p}irisR"><circle cx="${EYE.R}" cy="${EYE.cy}" r="${EYE.r}"/></clipPath>
    <path id="${p}tail" pathLength="100"/>
  </defs>
  <g data-part="enter" data-pivot="110 150">
  <g data-part="lemur" data-pivot="110 254">
    <g data-part="tail" data-pivot="${TAIL.bx} ${TAIL.by}">
      <use href="#${p}tail" fill="none" stroke="${ink}" stroke-width="${TAIL.w + 8}" stroke-linecap="round" stroke-linejoin="round"/>
      <use href="#${p}tail" fill="none" stroke="${C.cream}" stroke-width="${TAIL.w}" stroke-linejoin="round"/>
      <use data-tail="rings" href="#${p}tail" fill="none" stroke="${C.forest}" stroke-width="${TAIL.w}"/>
      <circle data-tail="tip" r="${TAIL.w / 2}" fill="${C.forest}"/>
    </g>
    <g data-part="body" data-pivot="110 246">
      <path d="${BODY}" fill="${C.sage}" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
      <path d="${BELLY}" fill="${C.cream}" clip-path="url(#${p}body)"/>
      ${legSVG('L')}
      ${legSVG('R')}
      ${armSVG('L')}
      ${armSVG('R')}
      <g data-part="heart" data-pivot="110 185" display="none"><path d="${HEART}" style="fill: var(--green, ${C.mint})" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/></g>
    </g>
    <g data-part="head" data-pivot="110 146">
      ${earSVG('L')}
      ${earSVG('R')}
      <path d="${HEAD}" fill="${C.cream}"/>
      <g clip-path="url(#${p}head)"><path data-part="crown" d="${CROWN}" fill="${C.sage}"/></g>
      <path d="${HEAD}" fill="none" stroke="${ink}" stroke-width="4" stroke-linejoin="round"/>
      <g data-part="face">
        ${eyeSVG(p, 'L')}
        ${eyeSVG(p, 'R')}
        ${browSVG('L')}
        ${browSVG('R')}
        <g data-part="nose" data-pivot="110 121">
          <path d="${NOSE}" fill="${ink}"/>
          <path d="M110 126V128" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>
        </g>
        <g data-part="mouth" data-pivot="110 132">${mouthSVG(p)}</g>
      </g>
    </g>
    <g data-part="q" data-pivot="214 60" opacity="0">
      <path d="${QMARK}" transform="translate(214 60)" fill="none" stroke="${C.cream}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="214" cy="70.5" r="2.7" fill="${C.cream}"/>
    </g>
  </g>
  </g>
</svg>`;
  }

  // ───────────────────────────── rig ─────────────────────────────
  // IK dwóch kości po stronie L (prawą liczy się w lustrze): kąty a (bark) i b (łokieć) tak,
  // żeby nadgarstek trafił w (x, y); bend = +1 łokieć na zewnątrz, -1 do środka
  function ik(x, y, bend = 1) {
    const { sx, sy, l1, l2 } = ARM;
    const dx = x - sx, dy = y - sy;
    const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.05);
    const base = Math.atan2(dy, dx);
    const A = base + bend * Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const ex = sx + l1 * Math.cos(A), ey = sy + l1 * Math.sin(A);
    const B = Math.atan2(sy + d * Math.sin(base) - ey, sx + d * Math.cos(base) - ex);
    let a = A / D2R, b = B / D2R;
    while (a < -60) a += 360;
    while (a >= 300) a -= 360;
    while (b < a - 180) b += 360;
    while (b >= a + 180) b -= 360;
    return { a, b };
  }
  // pozy rąk (strona L, prawa w lustrze); fingers = kierunek palców otwartej dłoni w stopniach
  const armPose = (x, y, bend, fingers) => { const { a, b } = ik(x, y, bend); return { a, b, p: fingers == null ? 0 : fingers - b }; };
  const ARMS = {
    rest: armPose(80, 206, 1, null), // łapki na kolanach, łokcie odstają od tułowia
    lap: armPose(97, 203, 1, null), // łapka w podołku (druga do asymetrii)
    wave: armPose(33, 121, -1, 248), // dłoń na wysokości oczu, poza obrysem głowy
    talk: armPose(46, 182, -1, 210), // otwarta dłoń z boku na wysokości brzuszka: „widzisz?”
    talkR: armPose(61, 186, -1, 218), // po stronie ogona niżej i bliżej, żeby nie wejść na pierścienie
    shrug: armPose(40, 166, -1, 200),
    shrugR: armPose(55, 166, -1, 205), // prawa węziej, żeby nie wejść na ogon
    clasp: armPose(101, 196, 1, null),
    hold: armPose(93, 184, 1, null),
    stretch: armPose(40, 124, 1, 220),
  };

  // ───────────────────────────── ruch: narzędzia ─────────────────────────────
  // krytycznie tłumione wygładzanie 2. rzędu (SmoothDamp): rusza z prędkością 0 i nie przestrzeliwuje
  function damp(s, target, omega, dt) {
    const x = omega * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const ch = s.x - target, tmp = (s.v + omega * ch) * dt;
    s.v = (s.v - omega * tmp) * e;
    s.x = target + (ch + tmp) * e;
  }
  // lekko niedotłumiona sprężyna tylko dla ruchu wtórnego (uszy, ogon, łapki)
  function spring(s, force, w, z, dt) {
    const n = Math.ceil(dt / 0.012), h = dt / n;
    for (let i = 0; i < n; i++) { s.v += (force - w * w * s.x - 2 * z * w * s.v) * h; s.x += s.v * h; }
  }
  const EASE = {
    lin: (u) => u,
    in: (u) => u * u * u,
    out: (u) => 1 - (1 - u) ** 3,
    io: (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
    sine: (u) => 0.5 - Math.cos(Math.PI * u) / 2,
  };
  // ścieżka klatek kluczowych: [czas, wartość, krzywa dojścia do tej klatki]
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const k = keys[i];
      if (t <= k[0]) {
        const q = keys[i - 1];
        return q[1] + (k[1] - q[1]) * EASE[k[2] || 'io']((t - q[0]) / (k[0] - q[0] || 1));
      }
    }
    return keys[keys.length - 1][1];
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // kanały pozy: [spoczynek, omega]; omega = sztywność wygładzania (ciało i ręce 7, głowa 10, uszy i powieki 14)
  const CH = {
    rootTx: [0, 7], rootTy: [0, 7], rootR: [0, 7], rootSx: [1, 7], rootSy: [1, 7], bodySy: [1, 7],
    headR: [0, 10], headTx: [0, 10], headTy: [0, 10], headS: [1, 10], pitch: [0, 10], yaw: [0, 10],
    earL: [0, 14], earR: [0, 14],
    armLa: [ARMS.rest.a, 7], armLb: [ARMS.rest.b, 7], armRa: [ARMS.rest.a, 7], armRb: [ARMS.rest.b, 7], pawLr: [0, 7], pawRr: [0, 7],
    lidL: [0.06, 14], lidR: [0.06, 14], lowL: [0, 14], lowR: [0, 14], pupil: [1, 14],
    browLo: [0, 14], browLr: [0, 14], browLy: [0, 14], browRo: [0, 14], browRr: [0, 14], browRy: [0, 14],
    lookX: [0, 6], lookY: [0, 6],
    tailSway: [-0.06, 4], tailCurl: [0.97, 4], tailWave: [0, 6], heart: [0, 9], q: [0, 9], doze: [0, 2.6],
  };
  const CH_KEYS = Object.keys(CH);
  // odbicie klipu na drugą stronę: zamiana L/R i zmiana znaku kanałów poziomych
  const FLIP = { headR: 1, yaw: 1, rootR: 1, rootTx: 1, headTx: 1, lookX: 1 };
  const swapLR = (k) => k.replace(/^(arm|paw|ear|lid|low|brow|eye)([LR])/, (m, a, s) => a + (s === 'L' ? 'R' : 'L'));
  const armSet = (side, pose) => ({ ['arm' + side + 'a']: pose.a, ['arm' + side + 'b']: pose.b, ['paw' + side + 'r']: pose.p });
  const pair = (name, keys) => ({ [name + 'L']: keys, [name + 'R']: keys });

  // pozy stanów (cele kanałów i elementy dyskretne)
  const STATE_POSE = {
    connecting: { earL: 11, earR: 11, lidL: 0, lidR: 0, headTy: -1.4, rootSy: 1.008, pupil: 1.04, ...armSet('L', ARMS.clasp), ...armSet('R', ARMS.clasp) },
    listening: { earL: 7, earR: 7, lidL: 0.04, lidR: 0.04, lowL: 0.22, lowR: 0.22 },
    hearing: { earL: 14, earR: 14, lidL: 0, lidR: 0, headS: 1.03, headTy: 1.6 },
    speaking: { earL: 3, earR: 3, lidL: 0.06, lidR: 0.06 },
    // po rozmowie: zadowolone zmrużenie (dolna powieka do góry), jedna łapka na kolanie, druga w podołku
    ended: { earL: -10, earR: -10, lidL: 0.28, lidR: 0.28, lowL: 0.5, lowR: 0.5, pupil: 0.85, headR: -4, headTy: 2.2, lookY: 0.2,
      tailSway: -0.2, tailCurl: 0.92, ...armSet('L', ARMS.rest), ...armSet('R', ARMS.lap) },
    // „ups”: szeroko otwarte oczy, obie brwi uniesione do środka (zmartwienie, nie ocenianie), przechylona głowa
    error: { earL: -7, earR: 6, lidL: 0.02, lidR: 0.02, headR: -9, browLo: 1, browRo: 1, browLy: -2.5, browRy: -2.5, browLr: -14, browRr: -14,
      q: 1, lookX: -0.25, lookY: -0.45 },
  };
  // przed zalogowaniem siedzi tak samo jak przy łączeniu (łapki razem, uszy w górze), tylko bez gestów
  STATE_POSE.locked = STATE_POSE.connecting;
  const STATE_MOUTH = { error: 'wavy', speaking: 'soft' };
  const VALID = ['connecting', 'listening', 'speaking', 'ended', 'error', 'locked'];

  // wejście na ogonie: [czas od startu, wartość, krzywa]
  const ENTER_KEYS = {
    // zjazd hamuje jak opuszczana lina, na dole lina sprężynuje; przed przewrotem kulnięcie, w przewrocie odbicie w górę
    dy: [[0, ENTER.from], [ENTER.drop, ENTER.hang, 'out'], [ENTER.drop + 0.13, ENTER.hang + 9, 'out'], [ENTER.bounce, ENTER.hang, 'io'],
      [ENTER.flip, ENTER.hang + 4, 'io'], [ENTER.flip + 0.16, ENTER.hang - 22, 'out'], [ENTER.land, 0, 'in']],
    r: [[ENTER.flip, 180], [ENTER.land, 360, 'io']],
    s: [[ENTER.bounce, 1], [ENTER.flip, 0.94, 'io'], [ENTER.flip + 0.16, 1.04, 'out'], [ENTER.land - 0.04, 1, 'io']],
    rope: [[ENTER.flip, 1], [ENTER.flip + 0.36, 0, 'io']],
    arms: [[ENTER.flip + 0.08, 1], [ENTER.land + 0.22, 0, 'io']],
    // lądowanie: przysiad (stopy w miejscu) i lekkie zapadnięcie razem z linią horyzontu, która się ugina
    sy: [[ENTER.land, 0], [ENTER.land + 0.06, -0.1, 'out'], [ENTER.land + 0.2, 0.03, 'io'], [ENTER.land + 0.4, 0, 'io']],
    sx: [[ENTER.land, 0], [ENTER.land + 0.06, 0.07, 'out'], [ENTER.land + 0.2, -0.015, 'io'], [ENTER.land + 0.4, 0, 'io']],
    ty: [[ENTER.land, 0], [ENTER.land + 0.08, 5, 'out'], [ENTER.land + 0.28, -1.5, 'io'], [ENTER.land + 0.48, 0, 'io']],
    // uszy: głową w dół ciążenie je prostuje, w przewrocie zostają w tyle, przy lądowaniu opadają i wracają
    ear: [[0, 8], [ENTER.flip, 8], [ENTER.flip + 0.2, -8, 'io'], [ENTER.land, 2, 'io'], [ENTER.land + 0.1, -14, 'out'], [ENTER.land + 0.45, 3, 'io'], [ENTER.land + 0.7, 0, 'io']],
    // wisząc, patrzy w dół, na miejsce, gdzie wyląduje
    look: [[ENTER.flip, -0.7], [ENTER.land, 0, 'io']],
  };
  // w trakcie wejścia ruchy stanu czekają, aż wyląduje; reszta (ucho, zerknięcie, dotyk) przepada
  const ENTER_DEFER = { hello: 1, bye: 1, shrug: 1, surprise: 1 };

  // ───────────────────────────── klipy ─────────────────────────────
  // add: ścieżki dokładane do pozy; set + w: wartości docelowe mieszane wagą w (ręce); flags: [od, do, {...}]
  // slot: klip w tym samym slocie wygasza poprzedni; sided: osobny slot dla każdej strony
  const WAVE_KEYS = (a, b, t0, n, step) => {
    const k = [[t0, 0]];
    for (let i = 0; i < n; i++) k.push([t0 + 0.18 + i * step, i % 2 ? b : a, 'io']);
    k.push([t0 + 0.18 + n * step, 0, 'io']);
    return k;
  };
  // zgięcie łokcia w połowie podnoszenia i opuszczania ręki: łokieć prowadzi, dłoń dociąga
  // (bez tego ręka w pół drogi przechodzi przez sztywną, wyprostowaną poziomą pozę)
  const LEAD = (keys, up, down, amt) => [[0, 0], [up[0], 0], [up[1], amt, 'io'], [up[2], 0, 'io'], ...keys.filter((k) => k[0] > up[2] && k[0] < down[0]), [down[0], 0], [down[1], amt, 'io'], [down[2], 0, 'io']];
  const CLIPS = {
    // kiwnięcie „rozumiem”: łagodny zamach w górę, wyraźny spadek, miękkie zmrużenie i uszy w luzie
    nod: { dur: 0.66, slot: 'head', add: {
      pitch: [[0, 0], [0.1, -0.16, 'sine'], [0.3, 1.5, 'io'], [0.66, 0, 'io']],
      ...pair('lid', [[0, 0], [0.3, 0.35, 'io'], [0.62, 0, 'io']]),
      ...pair('low', [[0, 0], [0.3, 0.25, 'io'], [0.62, 0, 'io']]),
      ...pair('ear', [[0, 0], [0.3, -5, 'io'], [0.66, 0, 'io']]) } },
    // „mhm”: podwójne kiwnięcie z uśmiechniętymi oczami
    mhm: { dur: 1.15, slot: 'head', add: {
      pitch: [[0, 0], [0.1, -0.14, 'sine'], [0.28, 1.3, 'io'], [0.46, 0.15, 'io'], [0.64, 1.0, 'io'], [1.05, 0, 'io']],
      headR: [[0, 0], [0.35, 3.5, 'io'], [0.85, 3.5], [1.15, 0, 'io']],
      ...pair('ear', [[0, 0], [0.22, -5, 'io'], [0.8, -4], [1.15, 0, 'io']]) },
      flags: [[0.14, 0.86, { eyeL: 'happy', eyeR: 'happy' }], [0.05, 1.05, { mouth: 'smile', weak: 1 }]] },
    // druga połowa „mhm”, gdy pierwsze kiwnięcie już padło w pauzie
    ack: { dur: 0.85, slot: 'ack', add: {
      pitch: [[0, 0], [0.2, 1.0, 'io'], [0.6, 0, 'io']],
      headR: [[0, 0], [0.25, 3, 'io'], [0.6, 3], [0.85, 0, 'io']],
      ...pair('ear', [[0, 0], [0.2, -4, 'io'], [0.85, 0, 'io']]) },
      flags: [[0.02, 0.62, { eyeL: 'happy', eyeR: 'happy' }], [0, 0.8, { mouth: 'smile', weak: 1 }]] },
    beat: { dur: 0.42, slot: 'beat', add: { pitch: [[0, 0], [0.12, 1, 'sine'], [0.42, 0, 'io']] } },
    inhale: { dur: 0.48, slot: 'inhale', add: {
      rootSy: [[0, 0], [0.15, 0.015, 'io'], [0.48, 0, 'io']], headTy: [[0, 0], [0.15, -1.2, 'io'], [0.48, 0, 'io']],
      ...pair('ear', [[0, 0], [0.15, 4, 'io'], [0.48, 0, 'io']]) } },
    perk: { dur: 0.7, slot: 'ears', add: {
      earL: [[0, 0], [0.12, -4, 'io'], [0.32, 7, 'out'], [0.7, 0, 'io']], earR: [[0, 0], [0.14, -4, 'io'], [0.34, 7, 'out'], [0.7, 0, 'io']],
      rootTy: [[0, 0], [0.12, 0.8, 'io'], [0.3, -1.2, 'out'], [0.7, 0, 'io']] } },
    // zaskoczenie: oczy na całą szerokość, małe źrenice, brwi w górę, „o”, uszy do przodu, podskok
    surprise: { dur: 0.95, slot: 'face', add: {
      ...pair('lid', [[0, 0], [0.07, -0.16, 'out'], [0.7, -0.16], [0.95, 0, 'io']]),
      pupil: [[0, 0], [0.07, -0.22, 'out'], [0.7, -0.22], [0.95, 0, 'io']],
      browLo: [[0, 0], [0.04, 1, 'lin'], [0.72, 1], [0.76, 0, 'lin']], browRo: [[0, 0], [0.04, 1, 'lin'], [0.72, 1], [0.76, 0, 'lin']],
      browLy: [[0, 0], [0.08, -4, 'out'], [0.72, -4], [0.95, 0, 'io']], browRy: [[0, 0], [0.08, -4, 'out'], [0.72, -4], [0.95, 0, 'io']],
      ...pair('ear', [[0, 0], [0.1, 12, 'out'], [0.6, 10], [0.95, 0, 'io']]),
      rootTy: [[0, 0], [0.1, -2.5, 'out'], [0.34, 0, 'io']],
      rootSy: [[0, 0], [0.1, 0.02, 'out'], [0.32, -0.008, 'io'], [0.5, 0, 'io']],
      headTy: [[0, 0], [0.12, -1.5, 'out'], [0.5, 0, 'io']] },
      flags: [[0.05, 0.62, { mouth: 'o' }]] },
    // powitanie: dłoń na wysokości oczu, przedramię macha ±25°, nadgarstek dociąga z opóźnieniem,
    // tułów odchyla się od machającej ręki
    hello: { dur: 2.3, slot: 'arms', set: armSet('L', ARMS.wave), w: [[0, 0], [0.1, -0.08, 'io'], [0.5, 1.07, 'io'], [0.68, 1, 'io'], [1.8, 1], [2.3, 0, 'io']],
      add: {
        armLb: LEAD(WAVE_KEYS(-34, 10, 0.48, 5, 0.22), [0.1, 0.31, 0.5], [1.8, 2.03, 2.3], -68), // na zewnątrz szerzej: do środka dłoń schowałaby się za policzkiem
        pawLr: WAVE_KEYS(-15, 15, 0.57, 5, 0.22),
        headR: [[0, 0], [0.4, -6, 'io'], [1.6, -5], [2.1, 0, 'io']],
        rootR: [[0, 0], [0.4, 2.5, 'io'], [1.75, 2.5], [2.25, 0, 'io']],
        rootTy: [[0, 0], [0.12, 1.2, 'io'], [0.32, -3, 'out'], [0.6, 0, 'io']],
        rootSy: [[0, 0], [0.12, -0.022, 'io'], [0.32, 0.016, 'out'], [0.6, 0, 'io']],
        earL: [[0, 0], [0.34, 8, 'io'], [1.7, 6], [2.2, 0, 'io']], earR: [[0, 0], [0.38, 8, 'io'], [1.7, 6], [2.2, 0, 'io']],
        tailSway: [[0, 0], [0.5, -0.2, 'io'], [1.2, 0.05, 'io'], [1.9, 0, 'io']] },
      flags: [[0.3, 1.9, { pawLm: 'open' }], [0.3, 1.25, { eyeL: 'happy', eyeR: 'happy' }], [0.24, 1.6, { mouth: 'grin', weak: 1 }]] },
    bye: { dur: 2.6, slot: 'arms', set: armSet('L', ARMS.wave), w: [[0, 0], [0.5, 1, 'io'], [2.0, 1], [2.6, 0, 'io']],
      add: {
        armLb: LEAD(WAVE_KEYS(-30, 8, 0.5, 5, 0.26), [0.05, 0.3, 0.52], [2.0, 2.3, 2.6], -68),
        pawLr: WAVE_KEYS(-14, 14, 0.59, 5, 0.26),
        headR: [[0, 0], [0.5, -5, 'io'], [2.0, -4], [2.6, 0, 'io']],
        rootR: [[0, 0], [0.5, 2, 'io'], [2.0, 2], [2.6, 0, 'io']] },
      flags: [[0.4, 2.3, { pawLm: 'open' }], [0.45, 1.5, { eyeL: 'happy', eyeR: 'happy' }], [0.4, 2.1, { mouth: 'smile', weak: 1 }]] },
    shrug: { dur: 1.9, slot: 'arms', set: { ...armSet('L', ARMS.shrug), ...armSet('R', ARMS.shrugR) }, w: [[0, 0], [0.1, -0.06, 'io'], [0.4, 1.05, 'io'], [0.56, 1, 'io'], [1.35, 1], [1.9, 0, 'io']],
      add: {
        headTy: [[0, 0], [0.4, 3.2, 'io'], [1.35, 2.6], [1.9, 0, 'io']],
        headR: [[0, 0], [0.42, -6, 'io'], [1.4, -6], [1.9, 0, 'io']],
        armLb: LEAD([], [0.05, 0.24, 0.42], [1.35, 1.62, 1.9], 38), armRb: LEAD([], [0.05, 0.24, 0.42], [1.35, 1.62, 1.9], 38),
        rootSy: [[0, 0], [0.4, -0.014, 'io'], [1.35, -0.01], [1.9, 0, 'io']],
        browLo: [[0, 0], [0.3, 1, 'io'], [1.4, 1], [1.7, 0, 'io']], browRo: [[0, 0], [0.3, 1, 'io'], [1.4, 1], [1.7, 0, 'io']],
        browLy: [[0, 0], [0.3, -2, 'io'], [1.4, -2], [1.8, 0, 'io']], browRy: [[0, 0], [0.3, -2, 'io'], [1.4, -2], [1.8, 0, 'io']],
        // ogon odsuwa się, żeby prawa dłoń nie wylądowała na pierścieniach
        tailSway: [[0, 0], [0.4, 0.14, 'io'], [1.35, 0.14], [1.9, 0, 'io']], tailCurl: [[0, 0], [0.4, -0.1, 'io'], [1.35, -0.1], [1.9, 0, 'io']] },
      flags: [[0.3, 1.7, { pawLm: 'open', pawRm: 'open' }], [0.2, 1.6, { mouth: 'flat', weak: 1 }]] },
    // chichot: przysiad i podskok, potem trzy gasnące podrygi „he-he-he” z pyszczkiem w rytmie
    giggle: { dur: 1.3, slot: 'body', set: { ...armSet('L', ARMS.clasp), ...armSet('R', ARMS.clasp) }, w: [[0, 0], [0.24, 1, 'io'], [0.95, 1], [1.3, 0, 'io']],
      add: {
        rootSy: [[0, 0], [0.08, -0.06, 'out'], [0.21, 0.05, 'io'], [0.36, -0.012, 'io'], [0.44, 0, 'out'], [0.52, -0.012, 'io'], [0.6, 0, 'out'], [0.68, -0.008, 'io'], [0.84, 0, 'io']],
        rootSx: [[0, 0], [0.08, 0.03, 'out'], [0.21, -0.024, 'io'], [0.36, 0.008, 'io'], [0.52, 0, 'io']],
        rootTy: [[0, 0], [0.08, 0.6, 'out'], [0.21, -5, 'out'], [0.36, 0, 'in'], [0.5, 0]],
        headTy: [[0.36, 0], [0.44, -2, 'out'], [0.52, 0, 'io'], [0.6, -1.4, 'out'], [0.68, 0, 'io'], [0.76, -0.8, 'out'], [0.84, 0, 'io']],
        headR: [[0, 0], [0.3, 3, 'io'], [1.0, 3], [1.3, 0, 'io']],
        ...pair('ear', [[0, 0], [0.21, -9, 'out'], [0.6, 4, 'io'], [1.0, 0, 'io']]),
        tailSway: [[0, 0], [0.3, -0.22, 'io'], [0.62, 0.06, 'io'], [1.0, 0, 'io']] },
      flags: [[0.06, 1.12, { eyeL: 'happy', eyeR: 'happy', mouth: 'grin' }],
        [0.44, 0.5, { mouth: 'smile' }], [0.6, 0.66, { mouth: 'smile' }], [0.76, 0.82, { mouth: 'smile' }]] },
    pet: { dur: 2.1, slot: 'body', add: {
        headR: [[0, 0], [0.4, -8, 'io'], [1.65, -7], [2.1, 0, 'io']], headTy: [[0, 0], [0.4, 1.8, 'io'], [1.65, 1.6], [2.1, 0, 'io']],
        earL: [[0, 0], [0.32, -15, 'io'], [1.65, -13], [2.1, 0, 'io']], earR: [[0, 0], [0.36, -15, 'io'], [1.65, -13], [2.1, 0, 'io']],
        rootSy: [[0, 0], [0.4, -0.022, 'io'], [1.65, -0.016], [2.1, 0, 'io']], rootSx: [[0, 0], [0.4, 0.01, 'io'], [1.65, 0.008], [2.1, 0, 'io']],
        tailSway: [[0, 0], [0.8, -0.2, 'sine'], [1.6, 0.04, 'sine'], [2.1, 0, 'sine']] },
      flags: [[0.16, 1.78, { eyeL: 'closed', eyeR: 'closed', mouth: 'smile' }]] },
    flick: { dur: 0.6, slot: 'flick', sided: true, add: { earL: [[0, 0], [0.07, 13, 'out'], [0.22, -4, 'io'], [0.6, 0, 'io']] } },
    // machnięcie ogonem: haczyk rozwija się i zwija w kadrze, fala biegnie po ogonie
    swish: { dur: 1.5, slot: 'tail', add: {
        tailCurl: [[0, 0], [0.14, -0.38, 'out'], [0.5, 0.14, 'io'], [0.85, -0.18, 'io'], [1.15, 0.06, 'io'], [1.5, 0, 'io']],
        tailSway: [[0, 0], [0.14, 0.06, 'out'], [0.5, -0.2, 'io'], [0.9, 0.05, 'io'], [1.5, 0, 'io']],
        tailWave: [[0, 0], [0.15, 5, 'io'], [1.15, 5], [1.5, 0, 'io']],
        lookX: [[0, 0], [0.1, 0.9, 'out'], [1.0, 0.9], [1.35, 0, 'io']], lookY: [[0, 0], [0.1, 0.3, 'out'], [1.0, 0.3], [1.35, 0, 'io']] } },
    tilt: { dur: 1.7, slot: 'head', add: {
        headR: [[0, 0], [0.4, 9, 'io'], [1.25, 9], [1.7, 0, 'io']],
        earL: [[0, 0], [0.4, 6, 'io'], [1.25, 6], [1.7, 0, 'io']], earR: [[0, 0], [0.45, -3, 'io'], [1.25, -3], [1.7, 0, 'io']],
        lookY: [[0, 0], [0.3, -0.25, 'io'], [1.3, -0.25], [1.7, 0, 'io']] } },
    look: { dur: 3.4, slot: 'look', add: {
        lookX: [[0, 0], [0.12, -1, 'out'], [1.1, -1], [1.24, 1, 'out'], [2.3, 1], [2.45, 0, 'out'], [3.4, 0]],
        lookY: [[0, 0], [0.12, -0.2, 'out'], [2.3, -0.2], [2.45, 0, 'out']] } },
    glance: { dur: 1.0, slot: 'look', add: { lookX: [[0, 0], [0.1, 0.7, 'out'], [0.62, 0.7], [0.8, 0, 'out']], lookY: [[0, 0], [0.1, -0.35, 'out'], [0.62, -0.35], [0.8, 0, 'out']] } },
    care: { dur: 3.6, slot: 'arms', set: { ...armSet('L', ARMS.hold), ...armSet('R', ARMS.hold) }, w: [[0, 0], [0.5, 1, 'io'], [2.95, 1], [3.6, 0, 'io']],
      add: {
        heart: [[0, 0], [0.18, 0], [0.46, 1.12, 'out'], [0.62, 1, 'io'], [2.9, 1], [3.3, 0, 'io']],
        headR: [[0, 0], [0.5, 6, 'io'], [2.9, 6], [3.5, 0, 'io']], headTy: [[0, 0], [0.5, 1.2, 'io'], [2.9, 1.2], [3.5, 0, 'io']],
        ...pair('low', [[0, 0], [0.5, 0.35, 'io'], [3.0, 0.35], [3.5, 0, 'io']]),
        ...pair('ear', [[0, 0], [0.5, -7, 'io'], [3.0, -6], [3.5, 0, 'io']]) },
      flags: [[0.1, 3.4, { mouth: 'smile', weak: 1 }], [0.55, 1.6, { eyeL: 'happy', eyeR: 'happy' }]] },
    stretch: { dur: 2.8, slot: 'arms', own: 'ended', set: { ...armSet('L', ARMS.stretch), ...armSet('R', ARMS.stretch) }, w: [[0, 0], [0.75, 1, 'io'], [1.75, 1], [2.7, 0, 'io']],
      add: {
        rootSy: [[0, 0], [0.75, 0.035, 'io'], [1.75, 0.04], [2.5, 0, 'io']], rootSx: [[0, 0], [0.75, -0.012, 'io'], [1.75, -0.014], [2.5, 0, 'io']],
        headR: [[0, 0], [0.75, -3, 'io'], [1.75, -4], [2.6, 0, 'io']], headTy: [[0, 0], [0.75, -2.5, 'io'], [1.75, -2.5], [2.6, 0, 'io']],
        ...pair('ear', [[0, 0], [0.75, -8, 'io'], [1.8, -8], [2.6, 0, 'io']]),
        tailCurl: [[0, 0], [0.75, 0.03, 'io'], [1.75, 0.03], [2.6, 0, 'io']] },
      flags: [[0.45, 1.95, { eyeL: 'closed', eyeR: 'closed' }], [0.6, 1.75, { mouth: 'o' }], [0.3, 2.45, { pawLm: 'open', pawRm: 'open' }]] },
    // gest przy mowie: otwarta dłoń przed brzuszkiem na 1.2-1.8 s (czas skaluje play), akcenty dokłada mowa
    talk: { dur: 1.5, slot: 'arms', pulse: 'armLb', set: armSet('L', ARMS.talk), w: [[0, 0], [0.35, 1, 'io'], [1.05, 1], [1.5, 0, 'io']],
      add: { headR: [[0, 0], [0.4, -1.5, 'io'], [1.1, -1.5], [1.5, 0, 'io']], armLb: LEAD([], [0, 0.17, 0.35], [1.05, 1.27, 1.5], 30) },
      flags: [[0.14, 1.36, { pawLm: 'open' }]] },
    talkR: { dur: 1.5, slot: 'arms', pulse: 'armRb', set: armSet('R', ARMS.talkR), w: [[0, 0], [0.35, 1, 'io'], [1.05, 1], [1.5, 0, 'io']],
      add: { headR: [[0, 0], [0.4, 1.5, 'io'], [1.1, 1.5], [1.5, 0, 'io']], armRb: LEAD([], [0, 0.17, 0.35], [1.05, 1.27, 1.5], 30), tailSway: [[0, 0], [0.4, 0.12, 'io'], [1.1, 0.12], [1.5, 0, 'io']] },
      flags: [[0.14, 1.36, { pawRm: 'open' }]] },
  };

  let uid = 0;

  // ───────────────────────────── instancja ─────────────────────────────
  function create(container, opts) {
    opts = opts || {};
    const p = 'dl' + (++uid) + '-';
    container.innerHTML = svgMarkup(p);
    const svg = container.querySelector('svg');
    const el = {};
    svg.querySelectorAll('[data-part]').forEach((n) => { el[n.dataset.part] = n; });
    const tailPath = svg.querySelector('#' + p + 'tail');
    const tailTip = svg.querySelector('[data-tail=tip]');
    const tailRings = svg.querySelector('[data-tail=rings]');
    const mouths = {};
    svg.querySelectorAll('[data-mouth]').forEach((n) => { mouths[n.dataset.mouth] = n; });
    const eyeEls = {}, pawEls = {}, armEls = {};
    for (const s of ['L', 'R']) {
      const e = el['eye' + s];
      eyeEls[s] = { open: e.querySelector('[data-eye=open]'), happy: e.querySelector('[data-eye=happy]'), closed: e.querySelector('[data-eye=closed]') };
      pawEls[s] = {};
      el['paw' + s].querySelectorAll('[data-paw]').forEach((n) => { pawEls[s][n.dataset.paw] = n; });
      armEls[s] = { lines: el['arm' + s].querySelectorAll('[data-arm]'), hand: el['arm' + s].querySelector('[data-hand]') };
    }
    // pierścienie: ciemny pas na samym końcu ogona (pathLength = 100, więc nie zależą od długości)
    const period = 100 / (TAIL.rings + 0.5);
    tailRings.setAttribute('stroke-dasharray', `${r2(period / 2)} ${r2(period / 2)}`);

    const rnd = mulberry32(opts.seed != null ? opts.seed : (Math.random() * 2 ** 31) | 0);
    const rand = (a, b) => a + (b - a) * rnd();
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const calm = () => ((opts.reduced != null ? opts.reduced : mq && mq.matches) ? 0.3 : 1);

    // zapisuj atrybut tylko, gdy się zmienił
    function attr(n, name, v) {
      const c = n.__dl || (n.__dl = {});
      if (c[name] !== v) { c[name] = v; n.setAttribute(name, v); }
    }
    // transformacja części wokół jej stawu: translate, potem obrót i skala wokół (px, py), jako jedna macierz
    function affine(px, py, tx, ty, r, sx, sy) {
      const a = r * D2R, c = Math.cos(a), s = Math.sin(a);
      const A = c * sx, B = s * sx, Cc = -s * sy, D = c * sy;
      return [A, B, Cc, D, tx + px - (A * px + Cc * py), ty + py - (B * px + D * py)];
    }
    function mat(px, py, tx, ty, r, sx, sy) {
      const m = affine(px, py, tx, ty, r, sx, sy);
      return `matrix(${r4(m[0])} ${r4(m[1])} ${r4(m[2])} ${r4(m[3])} ${r2(m[4])} ${r2(m[5])})`;
    }
    const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    const compose = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];

    // ── stan
    let state = 'locked', stateAt = 0;
    let running = false, manual = !!opts.manual, frameId = 0, lastTs = 0, t = 0, dtLast = 0;
    let rawIn = 0, rawOut = 0, muted = false;
    const S = {}; // wygładzone kanały bazy
    for (const k of CH_KEYS) S[k] = { x: CH[k][0], v: 0 };
    let clips = [];
    let listenSide = rnd() < 0.5 ? -1 : 1;
    let hearing = false;
    let pointer = null;
    // ruch wtórny i stany pomocnicze
    const sec = { earRot: { x: 0, v: 0 }, earVert: { x: 0, v: 0 }, tail: { x: 0, v: 0 }, pawL: { x: 0, v: 0 }, pawR: { x: 0, v: 0 } };
    let prevP = null;
    const eyeAim = { x: { x: 0, v: 0 }, y: { x: 0, v: 0 } }, headAim = { x: { x: 0, v: 0 }, y: { x: 0, v: 0 } };
    const sac = { x: 0, y: 0, next: 0.8 };
    const blink = { next: 1.4, start: -9, dbl: false };
    const flick = { next: rand(4, 8) };
    const shift = { s: { x: 0, v: 0 }, target: rnd() < 0.5 ? -0.8 : 0.8, next: rand(3, 6) };
    const browVis = { L: { v: 0 }, R: { v: 0 } };
    let breath = 0, tailPhase = 0, lastEvent = -9;
    const timers = { glance: rand(8, 14) };
    let tailKey = '', lastP = null;
    let ent = null, snap = true; // wejście na ogonie: { t0, onLand, landed }; snap = poza stanu od razu (też na start)

    function play(name, o) {
      o = o || {};
      if (ent) {
        if (!ENTER_DEFER[name]) return;
        const wait = ent.t0 + ENTER.land + 0.35 - t;
        if ((o.delay || 0) < wait) o = Object.assign({}, o, { delay: wait });
      }
      const def = CLIPS[name];
      const delay = o.delay || 0;
      // ten sam ruch zlecony kilka razy w jednej chwili (spam z API, podwójny klik) gra raz
      if (!delay && clips.some((c) => c.name === name && c.fade < 0 && c.start <= t && t - c.start < 0.15)) return;
      const mirror = !!o.mirror;
      clips.push({ name, def, slot: def.slot + (def.sided ? (mirror ? 'R' : 'L') : ''), start: t + delay, amp: o.amp == null ? 1 : o.amp,
        mirror, scale: o.scale || 1, fade: -1, fadeDur: 0.25, on: false, k: 0, lt: 0 });
    }
    const playing = (name) => clips.some((c) => c.name === name && c.fade < 0);
    const busy = (slots) => clips.some((c) => c.fade < 0 && slots.indexOf(c.def.slot) >= 0);
    const clipOnArms = () => busy(['arms']);
    function fadeSlots(slots, dur) { for (const c of clips) if (slots.indexOf(c.def.slot) >= 0 && c.fade < 0) { c.fade = t; c.fadeDur = dur; } }

    // ── mowa Doco
    // Pyszczek idzie za modulacją głosu, nie za bezwzględną głośnością: obwiednia -> lokalny zakres
    // (szczyt i dolina z ostatnich ~0.3 s) -> automat sylab: otwórz na wzroście, domknij w dolinie
    // albo najpóźniej po 300 ms. Przy wyciszonym głośniku ten sam automat dostaje własny rozkład sylab.
    const sp = { env: 0, floor: 0.02, pk: 0, vl: 0, m: 0, loudPk: 0.1, talk: 0, gateOn: false, offAt: -9,
      open: false, openedAt: 0, until: 0, shape: 'soft', lastOpen: '', grew: true, synSyl: 0, sylSeen: 0,
      sylCount: 0, beatEvery: 2, lastBeat: -9, gate: 0, gRest: 0, talkNext: 0, talkSide: rnd() < 0.5 ? -1 : 1,
      pulses: 0, pulseAt: -9, phr: { r0: 0, r1: 0, y0: 0, y1: 0, at: -9 } };
    const syn = { phraseEnd: 0, pauseEnd: 0, nextSyl: 0, sylEnd: 0, amp: 0, id: 0 };
    function phraseVal() {
      const ph = sp.phr, u = EASE.io(clamp((t - ph.at) / 0.4));
      return { r: lerp(ph.r0, ph.r1, u), y: lerp(ph.y0, ph.y1, u) };
    }
    function phraseTo(r, y) { const v = phraseVal(); Object.assign(sp.phr, { r0: v.r, y0: v.y, r1: r, y1: y, at: t }); }
    function phraseStart() {
      // nowa fraza: głowa ustawia się odrobinę inaczej, czasem gest otwartą dłonią, czasem zerknięcie
      phraseTo(rand(-1.5, 1.5), rand(-0.3, 0.3));
      if (t >= sp.talkNext && t >= sp.gRest && !clipOnArms() && rnd() < 0.5) {
        sp.talkSide = -sp.talkSide; sp.pulses = 0;
        const sc = rand(0.82, 1.2);
        play(sp.talkSide < 0 ? 'talkR' : 'talk', { scale: sc });
        sp.talkNext = t + CLIPS.talk.dur * sc + rand(2.5, 5);
      } else if (rnd() < 0.2 && !busy(['look'])) play('glance', { mirror: rnd() < 0.5 });
    }
    function syllable(loud) {
      // akcent głową na co 2.-3. mocniejszej sylabie
      sp.sylCount++;
      if (sp.sylCount >= sp.beatEvery && loud > 0.45 && t - sp.lastBeat > 0.45) {
        sp.lastBeat = t; sp.sylCount = 0; sp.beatEvery = rnd() < 0.5 ? 2 : 3;
        play('beat', { amp: rand(0.45, 0.6) });
      }
      // dłoń w geście akcentuje sylabę (najwyżej 3 razy na gest)
      const g = clips.find((c) => c.def.pulse && c.on && c.fade < 0);
      if (g && sp.pulses < 3 && t - sp.pulseAt > 0.3 && g.lt > 0.32 && g.lt < g.def.dur - 0.5) { sp.pulses++; sp.pulseAt = t; }
    }
    function mouthOpen(loud) {
      // szeroko („a”) tylko na mocniejszych sylabach i nie zawsze; „o” rzadko i nigdy dwa razy z rzędu
      const wide = loud > 0.7 && rnd() < 0.62;
      let s = wide ? 'a' : 'open';
      if (sp.lastOpen !== 'o' && rnd() < 0.16) s = 'o';
      // cicho zaczęta sylaba może się jeszcze rozwinąć do „a”, jeśli głos dalej rośnie
      Object.assign(sp, { open: true, openedAt: t, until: t + 0.08, shape: s, lastOpen: s, grew: s !== 'open' || loud > 0.7 });
      syllable(loud);
    }
    function mouthClose(shape) { Object.assign(sp, { open: false, shape, until: t + 0.06 }); }
    function speech(dt) {
      const speaking = state === 'speaking';
      let gate, loud, wantOpen, wantClose;
      if (speaking && muted) {
        // frazy 1.1-2.9 s, pauzy 0.25-0.6 s; sylaba: otwarty 90-160 ms, zamknięty 50-90 ms
        if (t >= syn.phraseEnd) { syn.pauseEnd = t + rand(0.25, 0.6); syn.phraseEnd = syn.pauseEnd + rand(1.1, 2.9); syn.nextSyl = syn.pauseEnd; }
        gate = t >= syn.pauseEnd && t < syn.phraseEnd;
        if (gate && t >= syn.nextSyl && t < syn.phraseEnd - 0.08) {
          syn.amp = rand(0.35, 1); syn.id++; syn.sylEnd = t + rand(0.09, 0.16); syn.nextSyl = syn.sylEnd + rand(0.05, 0.09);
        }
        loud = syn.amp;
        wantOpen = gate && t < syn.sylEnd && syn.id !== sp.sylSeen;
        wantClose = t >= syn.sylEnd;
        sp.env *= Math.exp(-dt / 0.05);
      } else {
        const raw = speaking ? rawOut : 0;
        sp.env += (raw - sp.env) * (1 - Math.exp(-dt / (raw > sp.env ? 0.018 : 0.045)));
        if (speaking) { sp.floor += (sp.env - sp.floor) * Math.min(1, dt * (sp.env < sp.floor ? 4 : 0.05)); sp.floor = clamp(sp.floor, 0.004, 0.1); }
        gate = speaking && sp.env > sp.floor * 1.4 + 0.02;
        sp.pk = sp.env > sp.pk ? sp.env : sp.pk + (sp.env - sp.pk) * (1 - Math.exp(-dt / 0.25));
        sp.vl = sp.env < sp.vl ? sp.env : sp.vl + (sp.env - sp.vl) * (1 - Math.exp(-dt / 0.4));
        sp.m = clamp((sp.env - sp.vl) / Math.max(sp.pk - sp.vl, 0.02));
        sp.loudPk = Math.max(sp.env - sp.floor, sp.loudPk - dt * 0.05, 0.05);
        loud = clamp((sp.env - sp.floor) / sp.loudPk);
        wantOpen = gate && sp.m > 0.55;
        wantClose = !gate || sp.m < 0.3;
      }
      // początek frazy po pauzie ≥ 250 ms
      if (gate && !sp.gateOn) { if (speaking && t >= sp.gate && t - sp.offAt >= 0.25) phraseStart(); sp.gateOn = true; }
      if (!gate && sp.gateOn) { sp.gateOn = false; sp.offAt = t; }
      // automat sylab
      if (!speaking || t < sp.gate) { if (sp.shape !== 'soft') mouthClose('soft'); }
      else if (sp.open) {
        // głośna sylaba: pyszczek otwiera się dalej (z „open” do „a”), jak przy rozwijaniu samogłoski
        if (!sp.grew && loud > 0.85 && t - sp.openedAt >= 0.05) { sp.shape = 'a'; sp.grew = true; }
        if (t >= sp.until && (wantClose || t - sp.openedAt > 0.26)) mouthClose(gate && !wantClose && sp.shape === 'a' ? 'open' : 'soft');
      } else if (t >= sp.until && wantOpen) { sp.sylSeen = syn.id; mouthOpen(loud); }
      // ciągła warstwa mowy: głowa lekko „wchodzi” w głośniejsze fragmenty
      sp.talk += ((speaking && gate ? loud : 0) - sp.talk) * (1 - Math.exp(-dt / 0.15));
      if (!speaking && (sp.phr.r1 || sp.phr.y1)) phraseTo(0, 0);
    }

    // ── słuchanie: adaptacyjny próg szumu, kiwnięcia w pauzach, „mhm” po wypowiedzi
    const ear = { floor: 0.02, avg: 0.02, stable: 0, on: false, onSince: 0, utter: 0, lastOn: -9, lastLoud: -9, mean: 0,
      lastNod: -9, nodAt: -9, pauseDecided: true };
    function listen(dt) {
      const listening = state === 'listening';
      if (listening) {
        // próg uczy się tylko podczas słuchania (gdy mówi Doco, wejście nic nie mówi o szumie sali);
        // stały szum (bez wahań mowy) przez 1.5 s: ucz się szybciej
        ear.avg += (rawIn - ear.avg) * Math.min(1, dt / 0.5);
        ear.stable = Math.abs(rawIn - ear.avg) < 0.25 * ear.avg + 0.004 ? ear.stable + dt : 0;
        ear.floor += (rawIn - ear.floor) * Math.min(1, dt * (rawIn < ear.floor ? 4 : ear.stable > 1.5 ? 0.3 : 0.08));
        ear.floor = clamp(ear.floor, 0.004, 0.12);
      }
      const raw = listening ? rawIn : 0;
      const was = ear.on;
      ear.on = raw > (was ? ear.floor * 1.25 + 0.02 : ear.floor * 1.6 + 0.032);
      if (ear.on) {
        if (ear.utter === 0) { ear.onSince = t; ear.mean = raw; }
        // głos wrócił: to była tylko pauza, zaplanowane drugie kiwnięcie „mhm” przepada
        if (!was) clips = clips.filter((c) => c.on || c.name !== 'ack');
        ear.utter += dt; ear.lastOn = t; ear.pauseDecided = false;
        ear.mean += (raw - ear.mean) * Math.min(1, dt / 1.2);
        // „głośno” = powyżej połowy średniej tej wypowiedzi; odcina ogon wygładzania analizatora
        if (raw >= 0.5 * ear.mean) ear.lastLoud = t;
      } else if (ear.utter > 0) {
        const quiet = t - Math.max(ear.lastLoud, ear.onSince), off = t - ear.lastOn;
        // krótka pauza w środku wypowiedzi: jedno potakujące kiwnięcie, w pauzie (nie przy powrocie głosu)
        if (!ear.pauseDecided && quiet >= 0.22 && off >= 0.05) {
          ear.pauseDecided = true;
          if (listening && ear.utter >= 1 && t - ear.lastNod > 2.2 && rnd() < 0.85) {
            ear.lastNod = t; ear.nodAt = t;
            play('nod', { amp: rand(0.8, 1), mirror: listenSide < 0 });
          }
        }
        if (quiet >= 0.5 && off >= 0.4) {
          // koniec wypowiedzi: wyraźne „mhm, rozumiem”; jeśli kiwnięcie już trwa, dokładamy drugie z uśmiechem
          if (listening && ear.utter >= 0.5) {
            if (t - ear.nodAt < 0.8) play('ack', { delay: Math.max(0, ear.nodAt + 0.56 - t), mirror: listenSide < 0 });
            else play('mhm', { mirror: listenSide < 0 });
            ear.lastNod = t;
          }
          ear.utter = 0;
        }
      }
      hearing = ear.utter > 0 && t - ear.onSince > 0.15 && t - ear.lastLoud < 0.6;
    }

    // ── zmiany stanu
    function setState(next) {
      if (VALID.indexOf(next) < 0 || next === state) return;
      const prev = state;
      state = next; stateAt = t;
      const inCall = (s) => s === 'listening' || s === 'speaking';
      const shown = running || manual; // niewidoczny: bez gestów przejścia, poza dojdzie sama
      // gesty przypisane do poprzedniego stanu (wskazywanie, przeciąganie się) gasną łagodnie
      for (const c of clips) if (c.def.own && c.def.own !== next && c.fade < 0) c.fade = t;
      timers.dozing = false; timers.peekUntil = 0; timers.stretch = 0;
      if (next === 'ended') {
        const fromCall = shown && (inCall(prev) || prev === 'connecting');
        if (fromCall) { play('bye'); timers.stretch = t + rand(4.6, 5.6); timers.doze = timers.stretch + 3.4; }
        else timers.doze = t + 3;
      }
      if (next === 'locked') ent = null; // przed rozmową nie zjeżdża
      const pending = prev === 'listening' && ear.utter >= 0.5; // użytkownik skończył, „mhm” jeszcze nie padło
      if (next === 'speaking') {
        sp.gate = t + 0.15; // wdech przed pierwszą sylabą
        // Doco zaczyna mówić: potakiwanie szybko gaśnie, mowa przejmuje głowę i pyszczek
        fadeSlots(['head', 'ack'], 0.15);
      }
      if (prev === 'listening') { ear.utter = 0; ear.pauseDecided = true; }
      if (next === 'listening' && prev === 'speaking') listenSide = -listenSide;
      if (!shown) { clips = []; snap = true; return; }
      if (next === 'connecting') play('perk');
      if (prev === 'connecting' && inCall(next)) { play('hello'); listenSide = rnd() < 0.5 ? -1 : 1; }
      if (next === 'speaking' && prev === 'listening') {
        play('inhale');
        if (pending) play('nod', { amp: 0.6, scale: 0.68, mirror: listenSide < 0 }); // szybkie „jasne” zamiast pełnego „mhm”
      }
      if (next === 'error') {
        // nieudane połączenie: najpierw zaskoczenie, potem „no nie wiem” ramionami
        if (prev === 'connecting' || inCall(prev)) { play('surprise'); play('shrug', { delay: 0.7 }); }
        else play('shrug', { delay: 0.12 });
      }
    }

    // głośności z SDK; NaN, Infinity i wartości spoza 0..1 nie mogą zepsuć obwiedni
    const level = (v) => { v = +v; return v > 0 && isFinite(v) ? Math.min(v, 1) : 0; };
    function setLevels(input, output, o) {
      rawIn = level(input); rawOut = level(output); muted = !!(o && o.muted);
    }

    // ── zachowania zależne od stanu (rzadkie, pojedyncze); przy ograniczonym ruchu rzadsze albo żadne
    function behaviours() {
      const calmNow = calm() < 1, slow = calmNow ? 2.5 : 1;
      // spokojne zerknięcie w bok, gdy nic się nie dzieje (przed zalogowaniem nic: sam oddech, mruganie, uszy, ogon)
      if (state === 'listening' && t >= timers.glance) {
        if (!hearing && ear.utter === 0 && !busy(['arms', 'look', 'head', 'ack', 'body'])) play('glance', { mirror: rnd() < 0.5, amp: rand(0.7, 1) });
        timers.glance = t + rand(8, 14) * slow;
      }
      if (state === 'ended') {
        // po pożegnaniu: przeciągnięcie, potem drzemka z uśmiechem; co jakiś czas uchyla oczy
        if (timers.stretch && t >= timers.stretch) { timers.stretch = 0; if (!calmNow) play('stretch'); }
        if (!timers.dozing && t >= timers.doze && !clipOnArms()) { timers.dozing = true; timers.peekAt = t + rand(8, 12); }
        if (timers.dozing && t >= timers.peekAt) { timers.peekUntil = t + rand(1.6, 2.4); timers.peekAt = timers.peekUntil + rand(9, 14); }
      }
      if (state === 'connecting' && t - stateAt > 1.2 && (!timers.eager || t >= timers.eager)) {
        // czeka na połączenie: co chwilę drobne, niecierpliwe drgnięcie uszu
        if (timers.eager && !calmNow && !clips.some((c) => c.fade < 0)) play('perk', { amp: 0.55 });
        timers.eager = t + rand(1.8, 2.6);
      }
      if (state === 'error' && (!timers.errTilt || t >= timers.errTilt)) {
        if (timers.errTilt && !calmNow && !clips.some((c) => c.fade < 0)) play('tilt', { mirror: true, amp: 0.6 });
        timers.errTilt = t + rand(5, 8);
      }
    }

    // ── jedno „zdarzenie” (mrugnięcie, sakkada, ucho) na 300 ms, żeby ruch nie był nerwowy
    function event() { if (t - lastEvent < 0.3) return false; lastEvent = t; return true; }
    function idleEvents() {
      const sleepy = state === 'ended', calmNow = calm() < 1;
      if (t >= blink.next) {
        if (event()) { blink.start = t; blink.dbl = rnd() < 0.2; blink.next = t + rand(2.5, 6) * (sleepy ? 1.3 : 1); }
        else blink.next = lastEvent + 0.3 + rand(0, 0.15);
      }
      if (t >= sac.next) {
        if (event()) {
          // oczy wędrują i wracają do patrzącego (60%), przytrzymanie 0.8-2.5 s
          if ((sac.x || sac.y) && rnd() < 0.6) { sac.x = 0; sac.y = 0; }
          else {
            const range = hearing ? 0.4 : state === 'speaking' ? 0.8 : 1;
            const a = rand(0, 2 * Math.PI), r = rand(hearing ? 0.6 : 0.45, 1) * range;
            sac.x = Math.cos(a) * r; sac.y = Math.sin(a) * r * 0.6;
          }
          sac.next = t + rand(0.8, 2.5);
        } else sac.next = lastEvent + 0.3 + rand(0, 0.15);
      }
      if (t >= flick.next) {
        if (!playing('flick') && event()) { play('flick', { mirror: rnd() < 0.5, amp: calmNow ? 0.35 : 0.7 }); flick.next = t + rand(6, 12) * (calmNow ? 2.5 : 1); }
        else flick.next = lastEvent + 0.3 + rand(0, 0.2);
      }
    }
    // mrugnięcie: szybkie domknięcie, krótkie przytrzymanie (≥ 3 klatki zamkniętego łuku), wolniejsze otwarcie
    function blinkAmount() {
      const sleepy = state === 'ended';
      const cl = sleepy ? 0.1 : 0.06, hold = sleepy ? 0.08 : 0.045, op = sleepy ? 0.22 : 0.12;
      const one = (e) => (e < 0 ? 0 : e < cl ? EASE.in(e / cl) * 0.7 + 0.3 * (e / cl) : e < cl + hold ? 1
        : e < cl + hold + op ? 1 - EASE.out((e - cl - hold) / op) : 0);
      const e = t - blink.start;
      return Math.max(one(e), blink.dbl ? one(e - (cl + hold + op + 0.07)) : 0);
    }
    // akcent dłoni w geście mowy: szybko w dół, łagodny powrót
    function pulse() {
      const u = t - sp.pulseAt;
      return u < 0 ? 0 : u < 0.1 ? EASE.sine(u / 0.1) : u < 0.3 ? 1 - EASE.io((u - 0.1) / 0.2) : 0;
    }

    // ── jedna klatka
    function update(dt) {
      t += dt; dtLast = dt;
      const m = calm();
      speech(dt);
      listen(dt);
      behaviours();
      idleEvents();

      // 1. poza stanu, wygładzona
      const tgt = {};
      for (const k of CH_KEYS) tgt[k] = CH[k][0];
      Object.assign(tgt, STATE_POSE[state] || {});
      if (state === 'listening') {
        if (hearing) Object.assign(tgt, STATE_POSE.hearing);
        tgt.headR = (hearing ? 6 : 3.5) * listenSide;
        tgt.rootR = (hearing ? 0.5 : 0.25) * listenSide;
      }
      tgt.doze = state === 'ended' && timers.dozing && t >= timers.peekUntil ? 1 : 0;
      if (snap) { for (const k of CH_KEYS) { S[k].x = tgt[k]; S[k].v = 0; } snap = false; prevP = null; }
      for (const k of CH_KEYS) damp(S[k], tgt[k], CH[k][1], dt);
      const P = {};
      for (const k of CH_KEYS) P[k] = S[k].x;
      P.eyeL = 'open'; P.eyeR = 'open';
      P.mouth = STATE_MOUTH[state] || 'smile';
      P.pawLm = 'rest'; P.pawRm = 'rest';

      // 2. klipy: start (wygasza poprzedni w slocie), mieszanie wagą (set), dodawanie (add), na końcu flagi
      const live = [];
      for (const c of clips) {
        if (t < c.start) continue;
        if (!c.on) { c.on = true; for (const o of clips) if (o !== c && o.on && o.slot === c.slot && o.fade < 0) o.fade = t; }
        const lt = (t - c.start) / c.scale;
        if (lt >= c.def.dur) continue;
        let k = 1;
        if (c.fade >= 0) { k = 1 - smooth(0, c.fadeDur, t - c.fade); if (k <= 0) continue; }
        c.k = k; c.lt = lt;
        live.push(c);
      }
      // po każdym geście rąk chwila przerwy, zanim ręka znów zacznie gestykulować przy mowie
      for (const c of clips) if (c.on && c.def.slot === 'arms' && live.indexOf(c) < 0) sp.gRest = Math.max(sp.gRest, t + 1.5);
      clips = clips.filter((c) => !c.on || live.indexOf(c) >= 0);
      const name = (c, ch) => (c.mirror ? swapLR(ch) : ch);
      for (const c of live) {
        if (!c.def.set) continue;
        const w = track(c.def.w, c.lt) * c.k * Math.min(1, c.amp);
        for (const ch in c.def.set) { const n = name(c, ch); P[n] = lerp(P[n], c.def.set[ch], w); }
        // akcenty dłoni w geście mowy
        if (c.def.pulse) P[name(c, c.def.pulse)] += 9 * pulse() * w;
      }
      let weakMouth = null, strongMouth = null;
      for (const c of live) {
        const amp = c.amp * c.k * (c.def.slot === 'body' ? lerp(0.4, 1, m) : 1);
        for (const ch in c.def.add || {}) {
          const n = name(c, ch);
          P[n] += track(c.def.add[ch], c.lt) * amp * (c.mirror && FLIP[ch] ? -1 : 1);
        }
        for (const f of c.def.flags || []) {
          if (c.lt < f[0] || c.lt >= f[1] || c.k < 0.5) continue;
          for (const key in f[2]) {
            if (key === 'weak') continue;
            if (key === 'mouth') { if (f[2].weak) weakMouth = f[2].mouth; else strongMouth = f[2].mouth; continue; }
            P[name(c, key)] = f[2][key];
          }
        }
      }
      // pyszczek: mowa wygrywa ze „słabymi” minami klipów, chichot i pogłaskanie wygrywają z mową
      if (state === 'speaking') P.mouth = strongMouth || sp.shape;
      else P.mouth = strongMouth || weakMouth || P.mouth;
      // wejście na ogonie nadpisuje ręce i minę, a przy lądowaniu dokłada przysiad
      const en = ent ? entrance(P) : null;
      // mowa: ustawienie głowy na frazę i lekkie „wchodzenie” w głośniejsze fragmenty
      const ph = phraseVal();
      P.headR += ph.r; P.yaw += ph.y; P.pitch += 0.25 * sp.talk;

      // 3. warstwa życia: oddech, przenoszenie ciężaru (z lekkim przechyłem głowy), fala ogona
      const period = state === 'ended' ? 5.2 : 4.2;
      breath += dt * 2 * Math.PI / period;
      const b = Math.sin(breath), bl = Math.sin(breath - 0.6 / period * 2 * Math.PI);
      P.bodySy *= 1 + 0.012 * b * Math.max(m, 0.5);
      P.headTy -= 0.9 * b * m;
      P.tailSway += 0.06 * bl * m;
      P.tailCurl += 0.02 * bl * m;
      if (t >= shift.next) { if (m === 1) shift.target = (shift.target > 0 ? -1 : 1) * rand(0.7, 1); shift.next = t + rand(9, 13); }
      damp(shift.s, shift.target, 1.1, dt);
      P.headR += 2.8 * shift.s.x; P.rootR += 0.55 * shift.s.x * m; P.tailSway -= 0.05 * shift.s.x;
      tailPhase += dt * 2 * Math.PI / 3.6;

      // 4. ruch wtórny: uszy za głową, ogon za ciałem, łapki za przedramieniem
      if (prevP && dt > 0) {
        const v = (k) => (P[k] - prevP[k]) / dt;
        spring(sec.earRot, -9 * v('headR'), 11, 0.55, dt);
        spring(sec.earVert, 70 * v('pitch') + 6 * (v('headTy') + v('rootTy')), 11, 0.55, dt);
        spring(sec.tail, -0.0035 * v('rootTy') - 0.04 * v('rootR') - 0.004 * v('headR'), 7, 0.6, dt);
        spring(sec.pawL, -3 * v('armLb'), 14, 0.6, dt);
        spring(sec.pawR, -3 * v('armRb'), 14, 0.6, dt);
      }
      prevP = { headR: P.headR, pitch: P.pitch, headTy: P.headTy, rootTy: P.rootTy, rootR: P.rootR, armLb: P.armLb, armRb: P.armRb };
      const er = clamp(sec.earRot.x, -8, 8), ev = clamp(sec.earVert.x, -7, 7);
      P.earL += -er + ev; P.earR += er + ev;
      P.tailSway += clamp(sec.tail.x, -0.15, 0.15);
      P.pawLr += clamp(sec.pawL.x, -14, 14); P.pawRr += clamp(sec.pawR.x, -14, 14);

      // 5. spojrzenie: oczy prowadzą, głowa dociąga z opóźnieniem (przy dużej sakkadzie też trochę)
      let ax = P.lookX, ay = P.lookY;
      if (pointer && t - pointer.t < 2.5) { ax += pointer.x; ay += pointer.y; }
      ax = clamp(ax, -1.2, 1.2); ay = clamp(ay, -1, 1.2);
      const big = Math.hypot(sac.x, sac.y) > 0.6 ? 0.15 : 0;
      damp(eyeAim.x, ax + sac.x * 0.9, 32, dt); damp(eyeAim.y, ay + sac.y * 0.9, 32, dt);
      damp(headAim.x, ax + sac.x * big, 4.2, dt); damp(headAim.y, ay + sac.y * big, 4.2, dt);
      P.gazeX = clamp((eyeAim.x.x - headAim.x.x * 0.4) * 2.2, -2.5, 2.5);
      P.gazeY = clamp((eyeAim.y.x - headAim.y.x * 0.4) * 2.0, -2.2, 2.5);
      P.yaw += headAim.x.x * 1.1 * Math.max(m, 0.5);
      P.headR += headAim.x.x * 2.4 * Math.max(m, 0.5);
      P.headTx += headAim.x.x * 0.8;
      P.pitch += headAim.y.x * 0.42;

      // 6. powieki: patrzenie w dół nie może wyglądać na senność; mrugnięcie i drzemka na końcu
      if (ay > 0.5) { P.lidL = Math.min(P.lidL, 0.08); P.lidR = Math.min(P.lidR, 0.08); }
      const bk = Math.max(blinkAmount(), clamp(P.doze));
      P.lidL += (1 - P.lidL) * bk; P.lidR += (1 - P.lidR) * bk;
      P.tailSway = clamp(P.tailSway, -0.5, 0.15);
      P.tailCurl = clamp(P.tailCurl, 0.55, 1.15);
      lastP = P;
      render(P, m, en);
    }

    // ── wejście: zwisa głową w dół (ręce w stronę ziemi, dłonie otwarte, „o”), w przewrocie zaciska oczy,
    // po lądowaniu „ta-dam”; zwraca przekształcenie całej postaci i to, ile ogona jest jeszcze liną
    function entrance(P) {
      const e = t - ent.t0;
      if (e >= ENTER.land && !ent.landed) {
        ent.landed = true;
        if (ent.onLand) try { ent.onLand(); } catch (err) { console.error(err); }
      }
      if (e >= ENTER.end) { ent = null; return null; }
      const tr = (k) => track(ENTER_KEYS[k], e);
      const w = tr('arms');
      for (const s of ['L', 'R']) {
        P['arm' + s + 'a'] = lerp(P['arm' + s + 'a'], ARMS.stretch.a, w);
        P['arm' + s + 'b'] = lerp(P['arm' + s + 'b'], ARMS.stretch.b, w);
        P['paw' + s + 'r'] = lerp(P['paw' + s + 'r'], ARMS.stretch.p, w);
      }
      if (e < ENTER.flip + 0.15) { P.pawLm = 'open'; P.pawRm = 'open'; }
      if (e < ENTER.land) P.mouth = 'o';
      if (e >= ENTER.flip && e < ENTER.land) { P.eyeL = 'closed'; P.eyeR = 'closed'; }
      if (e >= ENTER.land && e < ENTER.land + 0.7) { P.mouth = 'grin'; P.eyeL = 'happy'; P.eyeR = 'happy'; }
      P.earL += tr('ear'); P.earR += tr('ear');
      P.lookY += tr('look');
      P.rootSy += tr('sy'); P.rootSx += tr('sx'); P.rootTy += tr('ty');
      // kołysanie na linie, wygasa przed przewrotem
      const sw = 7 * Math.exp(-e / 1.1) * Math.sin(2 * Math.PI * e / 1.3) * (1 - smooth(ENTER.bounce, ENTER.flip, e));
      return { r: tr('r') + sw, dx: -0.9 * sw, dy: tr('dy'), s: tr('s'), rope: tr('rope') };
    }
    // lina: kierunek i długość od nasady ogona do punktu nad kartą, w układzie postaci
    function ropeFor(P, en) {
      const M = compose(affine(110, 150, en.dx, en.dy, en.r, en.s, en.s), affine(110, 254, P.rootTx, P.rootTy, P.rootR, P.rootSx, P.rootSy));
      const [bx, by] = apply(M, TAIL.bx, TAIL.by);
      const dev = Math.atan2(ENTER.ay - by, ENTER.ax - bx) / D2R + 90; // odchylenie od pionu
      // 270 - obrót: głową w dół lina idzie „w dół” postaci (90°), a w przewrocie obraca się razem z nią do -90°
      return { k: en.rope, th: 270 - en.r - P.rootR + dev, len: Math.hypot(ENTER.ax - bx, ENTER.ay - by) / en.s };
    }
    function enter(o) {
      o = o || {};
      if (calm() < 1) { ent = null; if (o.onLand) o.onLand(); return; }
      clips = [];
      ent = { t0: t, onLand: o.onLand, landed: false };
      snap = true;
      update(0); // od razu poza kadrem, zanim okno się pokaże
    }

    // ───────────── rysowanie pozy
    function tail(sway, curl, wave, rope) {
      const k = rope ? rope.k : 0;
      const key = r4(sway) + ' ' + r4(curl) + ' ' + r4(wave) + ' ' + r2(tailPhase % (2 * Math.PI)) + (k ? ` ${r4(k)} ${r2(rope.th)} ${r1(rope.len)}` : '');
      if (key === tailKey) return;
      tailKey = key;
      const T = TAIL, len = lerp(T.len, k ? rope.len : T.len, k * k * k), ds = len / T.n; // puszczona lina skraca się szybciej, niż prostuje
      let x = T.bx, y = T.by, d = 'M' + x + ' ' + y;
      for (let i = 0; i < T.n; i++) {
        const u = (i + 0.5) / T.n;
        const hk = Math.pow(clamp((u - T.h0) / (T.h1 - T.h0)), T.hp);
        let th = T.th0 + T.turn * smooth(T.a0, T.a1, u) + curl * T.hook * hk + sway * 26 * smooth(0.25, 1, u)
          + wave * Math.sin(tailPhase - u * 2.6) * smooth(0.15, 1, u);
        if (k) th = lerp(th, rope.th, k);
        x += ds * Math.cos(th * D2R); y += ds * Math.sin(th * D2R);
        d += ' ' + r1(x) + ' ' + r1(y);
      }
      attr(tailPath, 'd', d);
      attr(tailTip, 'cx', r1(x)); attr(tailTip, 'cy', r1(y));
      // pierścienie mają stałą szerokość w jednostkach rysunku, także gdy ogon jest długą liną
      const per = r2(50 * T.len / (T.rings + 0.5) / len);
      attr(tailRings, 'stroke-dasharray', per + ' ' + per);
    }
    function arm(s, a, b, pr, mode) {
      const R = s === 'R';
      const sx = R ? 2 * AX - ARM.sx : ARM.sx, sy = ARM.sy;
      const A = (R ? 180 - a : a) * D2R, B = (R ? 180 - b : b) * D2R;
      const ex = sx + ARM.l1 * Math.cos(A), ey = sy + ARM.l1 * Math.sin(A);
      const wx = ex + ARM.l2 * Math.cos(B), wy = ey + ARM.l2 * Math.sin(B);
      // jedna krzywa przechodząca przez łokieć
      const d = `M${sx} ${sy}Q${r1(2 * ex - (sx + wx) / 2)} ${r1(2 * ey - (sy + wy) / 2)} ${r1(wx)} ${r1(wy)}`;
      armEls[s].lines.forEach((n) => attr(n, 'd', d));
      attr(armEls[s].hand, 'transform', `translate(${r2(wx)} ${r2(wy)}) rotate(${r2(B / D2R - 90)})`);
      attr(el['paw' + s], 'transform', `rotate(${r2(R ? -pr : pr)})`);
      for (const k in pawEls[s]) attr(pawEls[s][k], 'display', k === (mode || 'rest') ? 'inline' : 'none');
    }
    function render(P, m, en) {
      attr(el.enter, 'transform', en ? mat(110, 150, en.dx, en.dy, en.r, en.s, en.s) : 'translate(0 0)');
      attr(el.lemur, 'transform', mat(110, 254, P.rootTx, P.rootTy, P.rootR, P.rootSx, P.rootSy));
      attr(el.body, 'transform', mat(110, 246, 0, 0, 0, 1, P.bodySy));
      tail(P.tailSway, P.tailCurl, 4.5 * m + P.tailWave, en && en.rope > 0.001 ? ropeFor(P, en) : null);
      arm('L', P.armLa, P.armLb, P.pawLr, P.pawLm);
      arm('R', P.armRa, P.armRb, P.pawRr, P.pawRm);
      const hs = clamp(P.heart, 0, 1.2);
      attr(el.heart, 'display', hs > 0.02 ? 'inline' : 'none');
      if (hs > 0.02) attr(el.heart, 'transform', mat(110, 185, 0, (1 - hs) * 6, 0, hs, hs));
      // głowa: kiwnięcie to przesunięcie twarzy względem obrysu (2.5D), skręt to paralaksa
      attr(el.head, 'transform', mat(110, 146, P.headTx, P.headTy + P.pitch * 2.4, P.headR, P.headS, P.headS * (1 - P.pitch * 0.018)));
      attr(el.crown, 'transform', `translate(${r2(P.yaw * 1.4)} ${r2(P.pitch * 1.6)})`);
      attr(el.face, 'transform', `translate(${r2(P.yaw * 3)} ${r2(P.pitch * 3.4)})`);
      attr(el.earL, 'transform', mat(76, 66, -P.yaw * 1.1, -P.pitch * 0.9, P.earL, 1, 1));
      attr(el.earR, 'transform', mat(2 * AX - 76, 66, -P.yaw * 1.1, -P.pitch * 0.9, -P.earR, 1, 1));
      for (const s of ['L', 'R']) {
        const lid = clamp(P['lid' + s], -0.2, 1), low = clamp(P['low' + s]);
        let mode = P['eye' + s];
        // zamknięty łuk dopiero przy prawie domkniętej powiece, tak samo przy zamykaniu i otwieraniu
        if (mode === 'open' && (lid >= 0.9 || 23.5 - 5.5 * low - 24 * lid < 2)) mode = 'closed';
        const E = eyeEls[s];
        attr(E.open, 'display', mode === 'open' ? 'inline' : 'none');
        attr(E.happy, 'display', mode === 'happy' ? 'inline' : 'none');
        attr(E.closed, 'display', mode === 'closed' ? 'inline' : 'none');
        if (mode === 'open') {
          attr(el['lid' + s], 'transform', `translate(0 ${r2(-4 + lid * 24)})`);
          attr(el['low' + s], 'transform', `translate(0 ${r2(4 - 5.5 * low)})`);
          attr(el['pupil' + s], 'transform', mat(EYE[s], EYE.cy, P.gazeX, P.gazeY, 0, P.pupil, P.pupil));
        }
        // brew: pełne krycie, wejście/wyjście ruchem (z dołu i od wąskiej), nigdy nad zamkniętym okiem
        const bv = browVis[s];
        const want = P['brow' + s + 'o'] > 0.5 && mode === 'open';
        bv.v = clamp(bv.v + (want ? dtLast / 0.12 : -dtLast / 0.1));
        if (!want && mode !== 'open') bv.v = 0;
        const e = want ? EASE.out(bv.v) : EASE.in(bv.v);
        attr(el['brow' + s], 'display', e > 0.02 ? 'inline' : 'none');
        if (e > 0.02) {
          const r = P['brow' + s + 'r'];
          attr(el['brow' + s], 'transform', mat(s === 'R' ? 135 : 85, 82, 0, P['brow' + s + 'y'] + (1 - e) * 5, s === 'R' ? -r : r, 0.5 + 0.5 * e, 1));
        }
      }
      for (const k in mouths) attr(mouths[k], 'display', k === P.mouth ? 'inline' : 'none');
      const q = clamp(P.q);
      attr(el.q, 'opacity', r2(q));
      if (q > 0.01) attr(el.q, 'transform', mat(214, 66, 0, Math.sin(t * 2.1) * 2 * m + (1 - q) * 6, Math.sin(t * 1.3) * 6 * m, 0.7 + 0.3 * q, 0.7 + 0.3 * q));
    }

    // ───────────── pętla i widoczność
    function loop(ts) {
      const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 1 / 60;
      lastTs = ts;
      update(dt);
      frameId = requestAnimationFrame(loop);
    }
    function start() {
      if (running || manual) return;
      running = true; lastTs = 0; frameId = requestAnimationFrame(loop);
      // okno otwarte tuż po ustawieniu „connecting”: czas stał, więc t - stateAt = 0 i nadstawienie uszu nie przepadło
      if (state === 'connecting' && t - stateAt < 0.5) play('perk');
    }
    function stop() { running = false; cancelAnimationFrame(frameId); }
    let visible = false;
    const sync = () => (visible && !document.hidden ? start() : stop());
    const io = manual || !window.IntersectionObserver ? null : new IntersectionObserver((en) => { visible = en[en.length - 1].isIntersecting; sync(); });
    if (io) io.observe(container); else if (!manual) { visible = true; sync(); }
    document.addEventListener('visibilitychange', sync);

    // ───────────── dotyk i wskaźnik
    function onMove(e) {
      if (!running && !manual) return; // niewidoczny: bez pomiaru układu przy każdym ruchu myszy
      const r = svg.getBoundingClientRect();
      if (!r.width) return;
      pointer = { x: clamp((e.clientX - (r.left + r.width * 0.42)) / (r.width * 0.9), -1, 1), y: clamp((e.clientY - (r.top + r.height * 0.4)) / (r.height * 0.9), -1, 1), t };
    }
    let lastPoke = -9;
    function react(target) {
      if (t - lastPoke < 0.35) return;
      lastPoke = t;
      if (target === 'earL' || target === 'earR') {
        play('flick', { mirror: target === 'earR' });
        play('flick', { mirror: target === 'earR', delay: 0.62, amp: 0.6 });
        play('flick', { mirror: target !== 'earR', delay: 0.18, amp: 0.35 });
      } else if (target === 'tail') play('swish');
      else play('giggle');
    }
    function onDown(e) {
      onMove(e);
      if (e.target === svg) return; // puste tło kadru to nie lemur
      let n = e.target, part = null;
      while (n && n !== svg) {
        const k = n.getAttribute && n.getAttribute('data-part');
        if (k === 'earL' || k === 'earR' || k === 'tail') { part = k; break; }
        n = n.parentNode;
      }
      react(part);
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    svg.addEventListener('pointerdown', onDown);

    update(0);
    const api = {
      setState, setLevels, enter,
      get entering() { return !!ent; },
      poke: () => react(null),
      wave: () => play(state === 'ended' ? 'bye' : 'hello'),
      nod: () => play('nod'),
      mhm: () => play('mhm'),
      shrug: () => play('shrug'),
      pet: () => play('pet'),
      care: () => play('care'),
      tilt: () => play('tilt', { mirror: rnd() < 0.5 }),
      surprise: () => play('surprise'),
      lookAround: () => play('look'),
      get state() { return state; },
      destroy() {
        stop(); if (io) io.disconnect();
        document.removeEventListener('visibilitychange', sync);
        window.removeEventListener('pointermove', onMove);
        container.innerHTML = '';
      },
    };
    // tryb ręczny (testy, klatki do podglądu): czas płynie tylko przez step(dt)
    if (manual) { api.step = (dt) => update(dt); api.__play = (n, o) => play(n, o); api.__pose = () => lastP; }
    return api;
  }

  window.DocoLemur = { create };
})();
