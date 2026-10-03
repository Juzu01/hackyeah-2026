/* Doco offline: a simple conversation companion that runs in the browser, with no server.
   index.html uses it when api/chat doesn't respond (e.g. on GitHub Pages, which has no server functions).
   It is NOT AI: it recognises the topic from the words and answers with ready-made, warm replies.
   Order: 1) crisis signals (always crisis-line numbers), 2) urgent body symptoms (112),
   3) questions about something in the knowledge base (data/wiedza.json, built and checked by the agent team,
   see tools/wiedza/ZASADY.md), 4) topics, 5) short answers in the context of the previous topic, 6) open question.
   Never diagnoses. Never repeats the user's words; knowledge-base text is escaped (safe for innerHTML).
   In the browser: window.SoleilOffline.reply(text) -> { topic, kind, html, text, delay };
   kind is what the reply offers ('ask', a small step such as 'breath', 'done', 'end', 'info'), for chat.js's quick replies.
   In Node: require('./offline-companion.js').create({ knowledge }) (see offline-companion.test.mjs, tools/wiedza/wiedza.test.mjs). */
(function (root) {
  'use strict';

  // Lowercase, no Polish diacritics or punctuation: "Nie chcę żyć!" -> "nie chce zyc"
  function normalize(s) {
    return String(s || '').toLowerCase().replace(/ł/g, 'l')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  const ATLAS = '<a href="cialo/">Atlas ciała 3D</a>';
  const CHECKER = '<a href="gdzie-boli/">Gdzie boli?</a>';

  // ---- 1. Safety: suicide / self-harm signals (checked first, always) ----
  const CRISIS = [
    /\bnie chce (juz )?(dalej )?zyc\b/, /\bnie chce mi sie (juz )?zyc\b/, /\bnie chce (juz )?istniec\b/,
    /\b(zabic|zabije|zabijam|zabilbym|zabilabym) sie\b/, /\bsie (zabic|zabije|zabijam)\b/,
    /\b(skrzywdzic|skrzywdze|krzywdze|krzywdzic) (sam\w* )?sie\b/, /\bsie (skrzywdzic|skrzywdze|krzywdze)\b/,
    /\bsiebie (skrzywdzic|skrzywdze|krzywdze)\b/, /\b(zrobic|zrobie) sobie krzywd/,
    /\bsamoboj/, /\bsamookalecz/, /\bsamouszkodz/,
    /\b(nie ma|nie widze|bez) sensu (zyc|zycia|w zyciu)\b/, /\bzycie (nie ma|straci\w*) sensu\b/, /\bpo co (mam )?(dalej )?zyc\b/,
    /\b(chce|chcialbym|chcialabym|wole|wolalbym|wolalabym|marze zeby) (juz )?umrzec\b/,
    /\b(odebrac|odbiore) sobie zycie\b/, /\b(skonczyc|skoncze) ze soba\b/, /\b(skonczyc|skoncze) z tym wszystkim\b/,
    /\b(pociac|potne|tne|ciac) sie\b/, /\bsie (pociac|potne|tne)\b/,
    /\b(powiesic|powiesze) sie\b/, /\bsie powiesic\b/, /\bwyskocz\w* (z okna|z mostu|z balkonu)/, /\brzuc\w* sie pod (pociag|auto|samochod)/,
    /\bnie chce sie (juz )?obudzic\b/, /\b(lepiej|lzej) (by )?(bylo|bedzie) (wszystkim )?beze mnie\b/, /\b(lepiej|lzej) beze mnie\b/, /\bbeze mnie (\w+ ){0,2}(lepiej|lzej)\b/,
    /\btargnac sie\b/, /\bzniknac na zawsze\b/, /\bnie dam rady (dluzej |dalej )?zyc\b/,
    // Sleep and pills ('zasnąć i się nie obudzić', 'wszystkie tabletki naraz'); 'zasnąłem i nie obudziłem się na czas' is not crisis
    /\b(za|u)sn(ac|e) (i )?((sie|juz|nigdy|wiecej) ){0,3}nie (obudzic|obudze|budzic)\b/, /\b(za|u)sn(ac|e) na (zawsze|wieki)\b/,
    /\b(obym|zebym|abym|bym) (\w+ ){0,3}nie obudzil\w*/, /\bnadziej\w* (ze )?(\w+ ){0,2}nie obudze\b/,
    /\b(zeby|aby|by|zebym|abym) (juz )?(umrzec|umarl\w*|nie zyc)\b/, /\bsmierteln\w* dawk/, /\bdawk\w* (\w+ ){0,2}smierteln/,
    /\b(wszystkie|cale opakowanie|cala paczke|caly blister) (\w+ ){0,2}(tabletek|tabletki|tabsow|tabsy|lekow|leki|pigulek|pigulki|proszki|proszkow|nasenn\w*|przeciwbolow\w*|zolpidem\w*|zopiklon\w*|benzo\w*|xanax\w*|relanium\w*|antydepresant\w*)( \w+){0,4} naraz\b/,
    /\b(lyknac|lykne|polknac|polkne|wziac|wezme|zazyc|zazyje|zjesc|zjem) (\w+ )?(cale opakowanie|cala paczke|caly blister|cala fiolke)\b/,
    /\b(chce|zamierzam|zaraz) (sie )?przedawkowac\b/, /\bprzedawkuje\b/,
    /\bbym (\w+ )?(za|u)sn\w* (i )?((sie|juz|nigdy|wiecej) ){0,3}nie obudz/,
    /\b(chce|chcialbym|chcialabym|wolalbym|wolalabym|marze|zeby|bym) (\w+ ){0,2}(sie )?nie obudzic\b/,
    /\b(lyknac|lykne|polknac|polkne|zjesc|zjem) (\w+ )?wszystkie (\w+ ){0,2}(tabletki|tabsy|leki|pigulki)\b/,
    /\bkill myself\b/, /\bsuicid/, /\bwant to die\b/, /\bself harm\b/,
  ];
  const HELP_LINES = [
    ['112', '112', 'gdy grozi ci niebezpieczeństwo teraz'],
    ['116123', '116 123', 'telefon zaufania dla dorosłych w kryzysie emocjonalnym'],
    ['800702222', '800 70 2222', 'Centrum Wsparcia, całą dobę'],
    ['116111', '116 111', 'telefon zaufania dla dzieci i młodzieży'],
  ];
  const HELP_HTML = '<span class="hy-help">' + HELP_LINES.map(([tel, label, what]) =>
    `<a class="hy-tel-row" href="tel:${tel}"><strong>${label}</strong><span>${what}</span></a>`).join('') + '</span>';

  // ---- 2. Urgent body symptoms: point to 112, no diagnosis ----
  const RED_FLAG = [
    /\bbol\w* (\w+ ){0,2}(w|na) klat/, /\b(kluje|klucie|sciska|ucisk\w*|gniecie|piecze) (\w+ ){0,2}(w|na) klat/,
    /\bklat\w* (\w+ )?(boli|bola|kluje|sciska|piecze)\b/, /\bbol\w* (\w+ )?klatk/, /\bklat\w* piersiow/,
    /\bdusz(nosc\w*|e sie|i mnie)\b/, /\bsie dusze\b/, /\bbrak\w* (mi )?(tchu|powietrza)\b/, /\b(dusi|dlawi) (mnie|go|ja|sie)\b/,
    /\boddycha\w* (\w+ )?(wolno|plytko|slabo|chrapliwie|nieregularnie)\b/, /\bnie oddycha\b/, /\bprzesta\w* oddychac\b/,
    /\bnie moge (zlapac )?(oddechu|oddychac)\b/, /\btrudno (mi )?(oddychac|zlapac oddech)/,
    /\bdretwie\w* (mi )?(twarz|reka|noga|polowa)/, /\bopadl\w* (mi )?kacik/, /\bzemdl/, /\bstracil\w* przytomnosc/,
    // Stroke signs ('opadający kącik ust', 'mówi niewyraźnie', 'bełkocze')
    /\bkrzyw\w* (\w+ )?(buzi\w*|twarz\w*|usta)\b/, /\b(mama|tata|maz|zona|dziecko|syn|corka|babcia|dziadek|brat|siostra)\w* (\w+ )?nie reaguje( na nic)?$/,
    /\bopada\w* (\w+ )?kacik/, /\bkacik\w* (\w+ ){0,2}opad/, /\bmowi\w* (\w+ )?niewyrazn/, /\bbelko(cz|t)\w*/, /\bnagle (\w+ )?nie (moze|moge) (nic )?(powiedziec|mowic)\b/,
    // Overdose or poisoning, also someone else's ('nie mogę dobudzić mamy po tabletkach', 'dziecko zjadło leki')
    /\bprzedawkowal\w*/, /\bnieprzytomn\w*/, /\b(nie (moge|mozemy|da sie)|nie umiem) (?!sie\b)(\w+ )?dobudzic\b/,
    /\bnie (moge|mozemy|da sie) (go|jej|ich|mamy|taty|meza|zony|dziecka|syna|corki|babci|dziadka|brata|siostry) obudzic\b/,
    /\bnie reaguj\w* na (glos|bodzc\w*|wolanie|dotyk|potrzasani\w*|szczypani\w*)/, /\bledwo (\w+ )?oddycha/,
    /\b(dziecko|synek|syn|corka|coreczka|maluch|niemowle|wnuk|wnuczka)\w* (\w+ ){0,2}(zjadl|polkn|lykn)\w* (\w+ ){0,2}(tabletk\w*|leki|lekow|lekarstw\w*|pigulk\w*|melatonin\w*|kapsulk\w*)/, /\bzatru\w* (\w+ )?(lekami|lekiem|tabletkami)\b/,
    /\b(zjadl|polkn|lykn|wzi[ae]l|zazyl)\w* (\w+ ){0,2}(cale opakowanie|cala paczke|caly blister|wszystkie|garsc|duzo|kilkanascie|kilkadziesiat) (\w+ ){0,2}(tabletek|tabletki|lekow|leki|pigulek|pigulki|tabsow|tabsy|kapsulek|kapsulki|melatonin\w*)\b/,
  ];

  // ---- 3. Topics ----
  const T = {
    sad: [/\bsmut/, /\bprzygnebi/, /\bdolek\b/, /\bdola\b/, /\b(placz|placze|plakac|plakal\w*|placzu)\b/, /\bbeznadziej/,
      /\bzle sie czuje\b/, /\bkiepsk/, /\bprzybit/, /\bzalaman/, /\bzalamal/, /\bciezko mi\b/, /\bdepres/, /\bpustk/,
      /\bnic mnie nie cieszy\b/, /\bnie mam na nic sily\b/, /\bjest mi (dzis |dzisiaj |teraz )?(bardzo |tak )?zle\b/,
      /\bczuje sie (dzis |dzisiaj )?(bardzo |strasznie |naprawde |tak )?(zle|fatalnie|okropnie|beznadziejnie|kiepsko|podle)\b/, /\b(fatalnie|okropnie)\b/, /\bsmutn/, /\btesknie\b/, /\btesknot/, /^zle\b/, /^(bardzo )?zle$/],
    work: [/\bprac(a|y|e|uje|ujesz|owac|odawc\w*|ownik\w*)?\b/, /\bszef/, /\bszkol/, /\bnauczyciel/, /\begzamin/, /\bsprawdzian/,
      /\bkolokwi/, /\bstudi(a|ow|ach|uje)/, /\buczelni/, /\bsesj/, /\bmatur/, /\bocen(a|y|e|ie)\b/, /\bprojekt/, /\bdeadline/,
      /\bzwolni/, /\bkorpo/, /\bklient/, /\bzebrani/, /\bnadgodzin/, /\bwykladowc/, /\bpromotor/, /\bjedynk/],
    conflict: [/\bklotn/, /\bklocim/, /\bklocil/, /\bpoklocil/, /\bsprzecz/, /\bkonflikt/, /\bobrazil/, /\bobraz(a|ony|ona)\b/,
      /\brozstan/, /\bzerwal/, /\brozwod/, /\bzdradz/, /\bnie odzywa sie\b/, /\bnakrzycz/, /\bkrzycz/, /\bawantur/, /\bpretensj/,
      /\bnie rozumie mnie\b/, /\bzawiodl/, /\bzawiodla/],
    stress: [/\bstres/, /\bpresj/, /\bprzytlocz/, /\bza duzo\b/, /\bnie wyrabiam\b/, /\bnapiec/, /\bnapiet/, /\bspiet/, /\bpospiech/,
      /\bnie ogarniam\b/, /\bwszystko na mojej glowie\b/, /\bmetlik/, /\bchaos/, /\bnie daje rady\b/, /\bnie dam rady\b/],
    anxiety: [/\bboje sie\b/, /\bbac sie\b/, /\bobaw/, /\bniepok/, /\bpanik/, /\bstrach/,
      /\bprzeraz/, /\bmartwi/, /\bzamartw/, /\bnerwic/, /\bniespokojn/, /\bco jesli\b/, /\bczarne mysli\b/, /\bserce mi wali\b/,
      /\bgonitw/, /\bnie moge przestac (o tym )?myslec\b/, /\bnakrec/, /\bmysli (mi )?(krazy|pedza|nie daja)/],
    lonely: [/\bsamotn/, /\bjestem (zupelnie |calkiem |taki |taka )?(sam|sama)\b/, /\bczuje sie (taki |taka )?(sam|sama)\b/,
      /\bnikt mnie nie/, /\bnie mam (nikogo|przyjaciol|z kim)\b/, /\bnikogo nie mam\b/, /\bopuszcz/, /\bodrzuc/, /\bwyobcow/,
      /\bnikomu na mnie nie zalezy\b/, /\bnigdzie nie pasuje\b/, /\bnie mam do kogo\b/],
    anger: [/\bzlosc/, /\bzlosci/, /\bjestem (taki |taka |strasznie |bardzo )?(zly|zla|wsciekly|wsciekla)\b/, /\bwkurz/, /\bwscie/,
      /\birytuj/, /\bdenerwuj/, /\bzdenerwow/, /\bwnerw/, /\bfrustr/, /\bszlag/, /\bfuri/, /\bnienawidz/, /\bmam dosc\b/],
    tired: [/\bzmecz/, /\bwyczerp/, /\bwypal/, /\bnie moge (za)?spac\b/, /\bzasn/, /\bzasypi/, /\bnie moge spac\b/, /\bnie spie\b/, /\bbezsenn/, /\bspac\b/, /\bsen\b/, /\bsnu\b/,
      /\bspie\b/, /\bspalem\b/, /\bspalam\b/, /\bsenn/, /\bpadam\b/, /\bnie mam sily\b/, /\bbrak (mi )?sil\b/, /\bbrak (mi )?energii\b/,
      /\bbez energii\b/, /\bwykonczon/, /\bbudze sie\b/, /\bnie wyspal/, /\bniewyspan/],
    motivation: [/\bmotywac/, /\bzmotyw/, /\bnie chce mi sie\b/, /\bprokrastyn/, /\bodklad/, /\blenis/, /\bleniw/, /\bnie moge sie zabrac\b/,
      /\bzabrac sie\b/, /\bnie mam ochoty\b/, /\brece (mi )?opadaj/, /\bnie wiem od czego zaczac\b/, /\bbrak (mi )?chec/],
    joy: [/\bsuper\b/, /\bswietn/, /\bciesze sie\b/, /\bradosc/, /\bradosn/, /\bszczesliw/, /\budalo (mi )?sie\b/, /\bzdal(em|am)\b/,
      /\bdostal(em|am)\b/, /\bawans/, /\bwygral/, /\bdobry dzien\b/, /\bdobrze mi\b/, /\bfajn/, /\bekstra\b/, /\bwspanial/,
      /\bmam dobry\b/, /\bzakochal/, /\bczuje sie (dobrze|lepiej|swietnie|super)\b/, /\bjest (dobrze|super|swietnie|ok)\b/, /\bhura\b/],
  };
  const MEH = /^(jakos|ujdzie|tak srednio)$|\b(srednio|tak sobie|jako tako|bywalo lepiej|bez szalu|ni to ni owo)\b/;
  const FINE = /^(dobrze|ok|okej|oki|spoko|dobra|w porzadku|niezle|calkiem dobrze|git)$/;
  const NEGATED_JOY = /\bnie (jest |czuje sie |bylo |jestem |mam )?(dobrze|super|fajnie|swietnie|wesolo|szczesliw\w*|dobry)\b/;
  const PAIN_WORD = /\b(boli|bola|bolal\w*|bolec|bol|bolu|bole|bolem|bolow|obolal\w*|kluje|klucie|rwie|piecze|kontuzj\w*|uraz\w*|skrecil\w*|naciagn\w*|migren\w*)\b/;
  const BODY_PART = /\b(glowa|glowe|glowy|kolan\w*|plecy|plecach|plecami|kregoslup\w*|brzuch\w*|zoladek|zoladk\w*|szyj\w*|kark\w*|bark\w*|ramie|ramion\w*|nog[aiei]|nogach|nodze|stop[aey]|stopie|kostk\w*|lydk\w*|reka|reke|reki|rece|dlon\w*|nadgarst\w*|lokie\w*|lokci\w*|biodr\w*|zab|zeba|zebow|zebach|ucho|uszy|ucha|gardl\w*|miesn\w*|staw\w*|kosc\w*|udo|uda)\b/;
  const GREETING = /^(hej\w*|czesc|witaj\w*|dzien dobry|dobry wieczor|siema\w*|elo|halo|hello|hi|hey|yo|serwus|dobry)\b/;
  const THANKS = /\b(dzieki|dziekuje|dziekuj\w*|dzieks|thx|thanks|wdzieczn\w*)\b/;
  const BYE = /\b(pa pa|papa|dobranoc|do zobaczenia|do uslyszenia|na razie|narazie|lece|ide spac|bywaj)\b|^pa$/;

  // Short answers that only make sense in the context of the previous message
  const YES = /^(tak|tak tak|no tak|jasne|ok|okej|okay|oki|dobrze|dobra|sprobuje|sprobujmy|moge|chce|zgoda|pewnie|spoko|niech bedzie|no|da sie|dam rade|chetnie|tak chce|tak sprobuje|czemu nie|zrobione|zrobilem|zrobilam|gotowe)$/;
  const NO = /^(nie|nie chce|raczej nie|nie bardzo|nie teraz|nope|nie dzieki|nie dziekuje|nie moge|wolalbym nie|wolalabym nie|nie za bardzo|no nie)$/;
  const DUNNO = /^(nie wiem|sam nie wiem|sama nie wiem|nie mam pojecia|trudno powiedziec|ciezko powiedziec|moze|chyba|hm+|eh+|ech|no nie wiem|w sumie nie wiem|nie jestem pewn\w*|nie wiem co powiedziec|nie wiem co mysle)$/;

  // ---- Replies. kind: 'ask' = asks one question, otherwise the name of the small step offered ----
  const R = {
    sad: [
      ['ask', 'Przykro mi, że jest ci smutno. Ten smutek ma prawo tu być — nie musisz go od razu przeganiać. Co się dziś wydarzyło?'],
      ['ask', 'Dobrze, że o tym piszesz, zamiast trzymać to w sobie. Smutek bywa ciężki jak mokry płaszcz. Od kiedy go czujesz?'],
      ['write', 'Słyszę, że jest ci ciężko. Mam jeden mały pomysł: napisz trzy zdania o tym, co czujesz — bez oceniania, tylko dla siebie. Spróbujesz?'],
      ['walk', 'To brzmi naprawdę smutno. Czasem pomaga drobny ruch: 10 minut spaceru, choćby dookoła bloku. Dałoby radę dziś wyjść na chwilę?'],
      ['text', 'Jestem tu z tobą. Czy jest ktoś bliski, komu możesz dziś napisać choćby krótkie „hej, co u ciebie?”'],
    ],
    work: [
      ['ask', 'Problemy w pracy albo w szkole potrafią zabrać dużo sił, nawet po wyjściu. Co jest teraz najtrudniejsze — ludzie, ilość zadań czy coś innego?'],
      ['ask', 'Rozumiem, że to cię męczy. Gdy wszystkiego jest dużo, pomaga wybrać jedną małą rzecz na dziś, a resztę zapisać na później. Co byłoby tą jedną rzeczą?'],
      ['ask', 'Brzmi, jakby to siedziało w tobie od jakiegoś czasu. Twoja wartość nie zależy od jednej oceny ani jednego trudnego dnia. Co się wydarzyło?'],
      ['pause', 'To naprawdę może przytłaczać. Zanim wrócimy do tematu: zrób dwie minuty przerwy — wstań, przeciągnij się, napij się wody. Dasz radę teraz?'],
    ],
    conflict: [
      ['ask', 'Kłótnia z kimś bliskim boli podwójnie, bo zależy ci na tej osobie. O co poszło, jeśli chcesz o tym opowiedzieć?'],
      ['ask', 'To trudne, kiedy między wami jest napięcie. Często obie strony czują się niezrozumiane. Jak myślisz, co ta osoba mogła czuć w tej rozmowie?'],
      ['write', 'Rozumiem, że to cię gryzie. Na początek może pomóc napisanie trzech zdań: co się stało, co cię zabolało i czego potrzebujesz. Nie musisz tego nikomu wysyłać. Spróbujesz?'],
      ['ask', 'Słyszę, że jest ci przykro. Emocje po kłótni potrzebują czasu, żeby opaść — nie musisz wszystkiego rozwiązywać dziś. Czego teraz najbardziej potrzebujesz: rozmowy, przeprosin czy po prostu spokoju?'],
    ],
    stress: [
      ['breath', 'Stres potrafi ścisnąć całe ciało. Zróbmy razem coś małego: 4 sekundy wdechu nosem, 6 sekund spokojnego wydechu ustami — pięć razy. Spróbujesz teraz?'],
      ['ask', 'Brzmi, jakby było tego naprawdę dużo naraz. Co teraz najbardziej cię stresuje — jedna konkretna rzecz czy wszystko po trochu?'],
      ['write', 'To zrozumiałe, że czujesz napięcie. Pomaga wypisać wszystko, co siedzi w głowie, i przy każdej rzeczy zaznaczyć: „mam na to wpływ” albo „nie mam”. Chcesz spróbować?'],
      ['ask', 'Słyszę cię. Twoje ciało robi, co może, żeby cię chronić — tylko czasem przesadza. Kiedy ostatnio udało ci się choć chwilę odpocząć?'],
    ],
    anxiety: [
      ['ground', 'Lęk potrafi być bardzo nieprzyjemny, nawet gdy nie wiadomo, skąd się bierze. Spróbuj rozejrzeć się i nazwać pięć rzeczy, które widzisz wokół siebie — to pomaga wrócić do „tu i teraz”. Zrobisz to ze mną?'],
      ['ask', 'Rozumiem, że coś cię niepokoi. Czy to obawa o coś konkretnego, czy raczej ogólne napięcie bez wyraźnego powodu?'],
      ['breath', 'To musi być męczące. Spróbujmy spokojnego oddechu: 4 sekundy wdechu, 6 sekund wydechu, pięć razy. Dłuższy wydech mówi ciału, że może zwolnić. Spróbujesz?'],
      ['ask', 'Dobrze, że o tym mówisz — lęk lubi ciszę. Co najczęściej podpowiada ci ta niespokojna myśl?'],
    ],
    lonely: [
      ['ask', 'Samotność potrafi bardzo boleć. Cieszę się, że tu piszesz — teraz nie jesteś z tym w pojedynkę. Kiedy czujesz ją najmocniej?'],
      ['text', 'To bardzo ludzkie, tęsknić za bliskością. Czy jest ktoś, nawet dawno niewidziany, komu możesz dziś wysłać krótkie „hej, co u ciebie?”'],
      ['ask', 'Rozumiem. Czasem pomaga pobyć wśród ludzi, nawet bez rozmowy — park, kawiarnia, biblioteka. Co byłoby dla ciebie najłatwiejsze?'],
      ['ask', 'Słyszę cię i jestem tu. Opowiesz mi, jak wygląda twój zwykły dzień? Chętnie posłucham.'],
    ],
    anger: [
      ['ask', 'Złość to ważna emocja — często pokazuje, że ktoś przekroczył twoją granicę. Co cię tak zdenerwowało?'],
      ['walk', 'Rozumiem, że aż się w tobie gotuje. Zanim cokolwiek odpiszesz albo zrobisz, daj sobie chwilę: kilka mocnych wydechów albo szybki, 10-minutowy spacer. Dasz radę?'],
      ['ask', 'Masz prawo czuć złość. Ważne jest to, co z nią zrobisz. Czego potrzebujesz, żeby choć trochę ci ulżyło?'],
      ['write', 'To brzmi naprawdę frustrująco. Czasem pomaga wypisać wszystko na kartce — bez cenzury — a potem ją podrzeć. Spróbujesz?'],
    ],
    tired: [
      ['ask', 'Zmęczenie sprawia, że wszystko wydaje się trudniejsze, niż jest. Jak ostatnio śpisz?'],
      ['ask', 'Brzmi, jakby twoje baterie były na wyczerpaniu. Co mogłoby dziś odrobinę ci ulżyć — krótka drzemka, wcześniejszy sen czy chwila tylko dla siebie?'],
      ['breath', 'Rozumiem. Przed snem może pomóc odłożenie telefonu pół godziny wcześniej i kilka spokojnych oddechów: 4 sekundy wdechu, 6 sekund wydechu. Spróbujesz dziś?'],
      ['ask', 'Słyszę, że brakuje ci sił. Odpoczynek to nie lenistwo, tylko część dbania o siebie. Co ostatnio najbardziej cię męczy? (Jeśli od dawna nie możesz spać, warto powiedzieć o tym lekarzowi.)'],
    ],
    motivation: [
      ['ask', 'Brak motywacji to nie lenistwo — często znak, że czegoś jest za dużo albo coś nie jest jasne. Co chcesz zacząć, a nie możesz?'],
      ['small', 'Znam to uczucie. Spróbuj zasady dwóch minut: zrób tylko pierwszy, malutki krok — otwórz plik albo załóż buty. Często reszta przychodzi sama. Spróbujesz?'],
      ['ask', 'Rozumiem. Czasem pomaga przypomnieć sobie, po co to wszystko. Dla kogo albo dla czego to robisz?'],
      ['ask', 'To w porządku, że nie każdy dzień jest pełen energii. Jaka jedna mała rzecz byłaby dziś wystarczająca?'],
    ],
    joy: [
      ['ask', 'Jak miło to czytać! Opowiedz mi więcej — co sprawiło, że tak się czujesz?'],
      ['ask', 'To wspaniała wiadomość! Warto zatrzymać się przy takich chwilach. Z kim chcesz się tym podzielić?'],
      ['write', 'Cieszę się razem z tobą! Mały pomysł: zapisz dziś trzy zdania o tym, co było dobre. W gorszy dzień miło będzie do nich wrócić.'],
      ['ask', 'Super! Takie chwile dodają sił na później. Co dziś najbardziej ci pomogło?'],
    ],
    pain: [
      ['ask', `Przykro mi, że coś cię boli — ból potrafi zepsuć cały dzień i nastrój. Nie postawię diagnozy, ale w „${CHECKER}” wskażesz miejsce na sylwetce i odpowiesz na kilka pytań, a w ${ATLAS} zobaczysz tę część ciała z bliska. Jak ból wpływa dziś na twój nastrój?`],
      ['ask', `Oj, to nieprzyjemne. Ciało i emocje są mocno połączone — ból potrafi przygnębić, a stres potrafi boleć. Sprawdź objaw krok po kroku w „${CHECKER}” albo zajrzyj do ${ATLAS}. Od kiedy to czujesz?`],
      ['ask', `Rozumiem, to męczące. Jeśli ból nie mija albo się nasila, warto pokazać się lekarzowi. Na początek możesz skorzystać z „${CHECKER}” albo zobaczyć tę okolicę w ${ATLAS}. Jak się z tym czujesz?`],
    ],
    greeting: [
      ['ask', 'Hej! Miło, że jesteś. Jak się dziś czujesz — tak naprawdę?'],
      ['ask', 'Cześć! Jestem tu dla ciebie. Co dziś chodzi ci po głowie?'],
      ['ask', 'Hej, dobrze, że wpadasz. Jak minął ci dzień?'],
    ],
    thanks: [
      ['ask', 'Cieszę się, że ta rozmowa choć trochę pomogła. Jak się czujesz teraz?'],
      ['end', 'Nie ma za co. Dbaj o siebie — i wpadaj, kiedy tylko zechcesz.'],
      ['end', 'Dziękuję za twoje zaufanie. Pamiętaj, że możesz tu wrócić o każdej porze.'],
    ],
    bye: [
      ['end', 'Trzymaj się ciepło. Jestem tu, kiedy tylko zechcesz wrócić.'],
      ['end', 'Do usłyszenia! Zadbaj dziś o siebie choć jedną małą rzeczą.'],
      ['end', 'Odpocznij. Gdyby coś się działo, wiesz, gdzie mnie szukać.'],
    ],
    meh: [
      ['ask', 'Takie „średnio” też jest w porządku. Co dziś przechyla szalę w gorszą stronę?'],
      ['ask', 'Rozumiem. Coś konkretnego ci dziś ciąży, czy raczej wszystko po trochu?'],
      ['breath', 'Rozumiem, taki dzień bez wyrazu. Mały pomysł na teraz: pięć spokojnych oddechów — 4 sekundy wdechu, 6 sekund wydechu. Spróbujesz?'],
    ],
    fine: [
      ['ask', 'Cieszę się. Co dziś było najprzyjemniejsze?'],
      ['ask', 'To dobrze! Jest coś, o czym chcesz dziś pogadać?'],
      ['ask', 'Miło to słyszeć. A co słychać u ciebie poza tym?'],
    ],
    open: [
      ['ask', 'Dziękuję, że mi to piszesz. Chcę dobrze zrozumieć — opowiesz mi trochę więcej, co się dzieje?'],
      ['ask', 'Słucham cię uważnie. Jak się z tym czujesz?'],
      ['ask', 'Rozumiem, że to dla ciebie ważne. Co jest w tym teraz najtrudniejsze?'],
      ['ask', 'Jestem tu. Gdyby trzeba było nazwać twój nastrój jednym słowem — jakie to byłoby słowo?'],
    ],
  };

  // Continuing a topic (a longer message with no new topic)
  const MORE = {
    sad: ['Dziękuję, że to mówisz. Słychać, ile to w tobie waży. Co mogłoby dziś choć odrobinę ci ulżyć?', 'Rozumiem. Smutek często mówi nam, że coś jest dla nas ważne. Co jest tym czymś u ciebie?'],
    work: ['Rozumiem, to sporo. Co z tego jest w twoich rękach, a na co nie masz wpływu?', 'Słyszę cię. Gdyby jutro miało być choć trochę łatwiej — co musiałoby się zmienić?'],
    conflict: ['Rozumiem. Gdyby można było powiedzieć tej osobie jedno zdanie, spokojnie i bez kłótni — jak by brzmiało?', 'To ważne, co mówisz. Chcesz tę relację naprawić, czy najpierw potrzebujesz trochę dystansu?'],
    stress: ['Rozumiem. Która z tych rzeczy jest najpilniejsza, a która może poczekać do jutra?', 'Słyszę, ile tego jest. Co zwykle pomaga ci choć trochę się wyciszyć?'],
    anxiety: ['Dziękuję, że to opisujesz. Czy ta myśl mówi o czymś, co się dzieje, czy o czymś, co może się wydarzyć?', 'Rozumiem. Co można by powiedzieć bliskiej osobie, która czuje to samo? Spróbuj powiedzieć to samo sobie.'],
    lonely: ['Rozumiem. Za kim albo za czym najbardziej tęsknisz?', 'Dziękuję, że mi to mówisz. Był kiedyś czas, gdy samotność dokuczała mniej? Co wtedy było inaczej?'],
    anger: ['Rozumiem, czemu cię to ruszyło. Co byłoby dla ciebie sprawiedliwym rozwiązaniem?', 'Słyszę cię. Pod złością często kryje się zawód albo przykrość. Czy tak jest i tym razem?'],
    tired: ['Rozumiem. Masz w ciągu dnia choć chwilę tylko dla siebie?', 'To brzmi wyczerpująco. Co dałoby się odpuścić w tym tygodniu, choćby jedną rzecz?'],
    motivation: ['Rozumiem. A gdyby to zadanie podzielić na trzy małe kawałki — jaki byłby pierwszy?', 'Słyszę cię. A gdyby zrobić dziś tylko połowę i uznać to za sukces?'],
    joy: ['Pięknie! Jak chcesz to dziś uczcić, choćby drobiazgiem?', 'Cieszę się! Co z tego dnia chcesz zabrać ze sobą na kolejne?'],
    meh: ['Rozumiem. Co by sprawiło, że ten dzień byłby choć o jeden stopień lepszy?', 'Dzięki, że mówisz. Jest coś, o czym chcesz dziś pogadać?'],
    pain: [`Rozumiem. Gdy ciało boli, łatwiej o gorszy nastrój — potraktuj się dziś łagodnie. „${CHECKER}” i ${ATLAS} są pod ręką, jeśli zechcesz sprawdzić więcej.`, 'Dziękuję, że mi o tym mówisz. Co dziś pomaga ci choć trochę lepiej się poczuć?'],
  };

  // Guided small steps, after "tak" in reply to an offer
  const STEP = {
    breath: 'Dobrze. Usiądź wygodnie. Wdech nosem — raz, dwa, trzy, cztery. Wydech ustami, powoli, przez sześć sekund. Powtórz to pięć razy, bez pośpiechu. Napisz mi potem, jak się czujesz.',
    walk: 'Super. Wystarczy 10 minut, w dowolnym tempie — bez celu, po prostu ruch i powietrze. Gdy wrócisz, napisz mi, czy coś się zmieniło.',
    write: 'Świetnie. Weź kartkę albo notatki w telefonie i napisz trzy zdania: co się dzieje, co czujesz i czego potrzebujesz. Nie musisz mi ich pokazywać — chyba że zechcesz.',
    text: 'To dobry pomysł. Nie musi to być nic wielkiego — krótkie „hej, co u ciebie?” wystarczy. Kontakt z kimś bliskim naprawdę robi różnicę. Daj znać, jak poszło.',
    ground: 'Dobrze. Nazwij w myślach pięć rzeczy, które widzisz, cztery, które słyszysz, i trzy, których dotykasz. Spokojnie, bez pośpiechu. Jak jest teraz?',
    pause: 'Dobrze. Dwie minuty tylko dla ciebie: wstań, przeciągnij się, kilka spokojnych oddechów i łyk wody. Potem wróć i opowiedz mi, co dalej.',
    small: 'Super. Ustaw minutnik na dwie minuty i zrób tylko ten pierwszy krok. Potem możesz przestać albo iść dalej — jedno i drugie jest w porządku. Daj znać, jak poszło!',
  };
  const AFTER_YES_ASK = [
    'Dobrze. Opowiedz mi o tym trochę więcej — słucham.',
    'Okej. Co jest w tym dla ciebie najważniejsze?',
    'Rozumiem. Jak się z tym teraz czujesz?',
  ];
  const AFTER_NO = [
    'W porządku, nic na siłę. Możemy po prostu porozmawiać. Co teraz najbardziej siedzi ci w głowie?',
    'Rozumiem, nie musimy. Czego teraz najbardziej potrzebujesz?',
    'Jasne. Jestem tu i słucham — napisz, cokolwiek przyjdzie ci do głowy.',
  ];
  const AFTER_DUNNO = [
    ['ask', 'To zupełnie w porządku, że nie wiesz. Uczucia bywają poplątane. Spróbuj nazwać to jednym słowem — choćby „zmęczenie” albo „pustka”. Jakie słowo pasuje najbardziej?'],
    ['breath', 'Nie musisz mieć teraz odpowiedzi. Zróbmy coś prostego: trzy spokojne oddechy — 4 sekundy wdechu, 6 sekund wydechu. Potem wrócimy do rozmowy. Dobrze?'],
    ['ask', 'Nic nie szkodzi. Czasem łatwiej zacząć od ciała: gdzie czujesz to najbardziej — w głowie, w klatce, w brzuchu?'],
  ];
  const CRISIS_REPLIES = [
    'Bardzo dobrze, że mi o tym piszesz. To, co czujesz, jest naprawdę ciężkie, i nie musisz przez to przechodzić w pojedynkę. Proszę, porozmawiaj teraz z kimś, kto umie pomóc — rozmowa jest bezpłatna:',
    'Jestem tu i traktuję to poważnie. Twoje życie jest ważne. Proszę, zadzwoń teraz do kogoś, kto jest przeszkolony, żeby pomóc w takiej chwili:',
    'Dziękuję, że mi ufasz. Gdy jest aż tak trudno, najważniejsze jest, żeby nie zostawać z tym bez wsparcia. Tutaj są ludzie, którzy pomogą od razu:',
  ];
  const CRISIS_FOLLOW = [
    'Jestem tu z tobą. Czy jest teraz ktoś blisko — w domu, obok — do kogo możesz pójść albo zadzwonić?',
    'Możesz dalej do mnie pisać. Ale proszę, zadzwoń też do jednego z tych numerów — tam po drugiej stronie jest człowiek:',
  ];
  const REMINDER = '<span class="hy-reminder">Gdyby znów było bardzo ciężko: <a class="hy-tel" href="tel:116123">116 123</a> <a class="hy-tel" href="tel:800702222">800 70 2222</a> <a class="hy-tel" href="tel:112">112</a></span>';
  const RED_FLAG_REPLY = `To może być pilne. Jeśli ból w klatce piersiowej jest silny, trudno ci oddychać, nagle opada kącik ust, drętwieje ręka albo mowa staje się niewyraźna, ktoś traci przytomność albo mógł przedawkować leki — nie czekaj, dzwoń pod <a class="hy-tel" href="tel:112">112</a>. Nie postawię diagnozy, ale gdy sytuacja jest spokojna, możesz sprawdzić objaw w „${CHECKER}”.`;

  const strip = (html) => html.replace(/<\/?a\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/ ([,.?!:])/g, '$1').trim();

  // ---- 3. Knowledge base: data/wiedza.json (entries verified and tested before they get here) ----
  // An entry answers when the message hits one of its keywords AND is a question ("jak zmierzyć ciśnienie?")
  // or has no feeling in it ("ciśnienie"). Plain feelings ("nie mogę spać") stay with the conversation.
  const QUESTION = /^(jak\w*|co|czy|kiedy|ile|dlaczego|czemu|gdzie|po co|czym|kto|ktor\w+|w jaki sposob)\b|\b(dlaczego|czemu)$|\b(co (robic|zrobic|pomaga|oznacza|to jest|to znaczy|moge|mam|warto|wziac|brac)|jak (sie )?\w+|czy (to|moge|mozna|warto|trzeba|powinien\w*|musze)|powiedz|wyjasnij|wytlumacz|opowiedz|porad\w*|informacj\w*)\b/;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const lowerFirst = (s) => (/^\p{Lu}\p{Ll}/u.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

  // "cisnieni* krwi" -> / cisnieni[a-z0-9]* krwi / on the normalized text
  function compileKnowledge(db) {
    if (!db || !Array.isArray(db.entries)) return null;
    return db.entries.filter((e) => e && Array.isArray(e.keywords) && e.answer).map((e) => ({
      entry: e,
      keys: e.keywords.map((k) => ({
        words: k.split(' ').length,
        re: new RegExp('(?:^| )' + k.split(' ').map((w) => w.replace(/[^a-z0-9*]/g, '').replace(/\*/g, '[a-z0-9]*')).join(' ') + '(?= |$)'),
      })),
    }));
  }

  // Best entry for the message, or null. Score = matched keyword words, so longer phrases win.
  function findInfo(kb, raw, d) {
    if (!kb || !kb.length) return null;
    if (!(raw.includes('?') || QUESTION.test(d.n) || d.topic === 'open')) return null;
    let best = null, bestScore = 0;
    for (const item of kb) {
      const score = item.keys.reduce((s, k) => s + (k.re.test(d.n) ? k.words : 0), 0);
      if (score > bestScore) { best = item.entry; bestScore = score; }
    }
    return best;
  }

  function infoReply(e) {
    let html = esc(e.answer);
    const now = (e.warningSigns || []).filter((w) => w.triage === 'emergency').slice(0, 3);
    if (now.length) html += ` Nie czekaj, dzwoń pod <a class="hy-tel" href="tel:112">112</a>, jeśli: ${now.map((w) => esc(lowerFirst(w.sign.replace(/\.$/, '')))).join('; ')}.`;
    const links = (e.sources || []).filter((s) => /^https:\/\//.test(s.url)).slice(0, 3)
      .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)}</a>`);
    if (links.length) html += `<span class="hy-reminder">Źródła: ${links.join(' ')}</span>`;
    return html;
  }

  let sharedKnowledge = null; // loaded in the browser, see the end of this file
  function setKnowledge(db) { sharedKnowledge = compileKnowledge(db); }

  function detect(raw) {
    const n = normalize(raw);
    if (!n) return { topic: 'open', n };
    if (CRISIS.some((re) => re.test(n))) return { topic: 'crisis', n };
    if (RED_FLAG.some((re) => re.test(n))) return { topic: 'redflag', n };
    const score = {};
    for (const [topic, list] of Object.entries(T)) score[topic] = list.filter((re) => re.test(n)).length;
    if (score.joy && NEGATED_JOY.test(n)) { score.joy = 0; score.sad += 1; }
    if (/lęk/i.test(raw)) score.anxiety += 1; // 'lęk' only with diacritics: without them it collides with 'lek' (medicine)
    // Pain alone weighs less than an emotional topic: 'boli mnie, że się pokłóciliśmy' -> conflict
    // 'zęby' (teeth) only with diacritics: without them it collides with 'żeby' (so that)
    score.pain = (PAIN_WORD.test(n) ? 0.6 : 0) + (BODY_PART.test(n) || /zęby/i.test(raw) ? 0.6 : 0);
    // Ties: the more specific/emotional topic wins
    const order = ['pain', 'conflict', 'anxiety', 'lonely', 'anger', 'stress', 'sad', 'tired', 'work', 'motivation', 'joy'];
    let best = null;
    for (const t of order) if (score[t] > 0 && (!best || score[t] > score[best])) best = t;
    if (best) return { topic: best, n, score };
    if (MEH.test(n)) return { topic: 'meh', n };
    if (FINE.test(n)) return { topic: 'fine', n };
    if (YES.test(n)) return { topic: 'yes', n };
    if (NO.test(n)) return { topic: 'no', n };
    if (DUNNO.test(n)) return { topic: 'dunno', n };
    if (THANKS.test(n)) return { topic: 'thanks', n };
    if (BYE.test(n)) return { topic: 'bye', n };
    if (GREETING.test(n)) return { topic: 'greeting', n };
    return { topic: 'open', n };
  }

  function create(opts = {}) {
    const rand = opts.random || Math.random;
    const ownKnowledge = opts.knowledge ? compileKnowledge(opts.knowledge) : null;
    const used = {};
    let topic = null; // current conversation topic
    let lastKind = null; // what the last reply offered ('ask' or the step name)
    let crisisSeen = false; // after a crisis signal every later reply keeps the numbers at hand

    // Pick an unused item from the list (no repeats until all are used)
    function pick(key, list) {
      const u = (used[key] = used[key] || []);
      if (u.length >= list.length) u.length = 0;
      const free = list.map((_, i) => i).filter((i) => !u.includes(i));
      const i = free[Math.floor(rand() * free.length)];
      u.push(i);
      return list[i];
    }

    function respond(raw) {
      const d = detect(raw);
      let t = d.topic;
      let html, info, kind = 'ask';
      if (t === 'crisis') {
        const again = topic === 'crisis';
        html = (again ? pick('crisisF', CRISIS_FOLLOW) : pick('crisis', CRISIS_REPLIES)) + HELP_HTML +
          (again ? '' : 'Jestem tu i możesz dalej do mnie pisać. Czy jest teraz ktoś blisko, do kogo możesz zadzwonić albo napisać?');
        topic = 'crisis';
      } else if (topic === 'crisis' && ['yes', 'no', 'dunno', 'open', 'fine', 'meh', 'sad', 'lonely', 'tired', 'thanks', 'bye'].includes(t)) {
        // After a crisis signal, keep a caring tone and keep the numbers close at hand
        t = 'crisis';
        html = pick('crisisF', CRISIS_FOLLOW) + HELP_HTML;
      } else if (t === 'redflag') {
        html = RED_FLAG_REPLY;
        topic = 'pain';
      } else if ((info = findInfo(ownKnowledge || sharedKnowledge, raw, d))) {
        html = infoReply(info);
        kind = 'info';
        t = `info:${info.id}`;
        topic = 'info';
      } else if (t === 'fine' && topic && STEP[lastKind]) {
        html = STEP[lastKind]; kind = 'done'; t = `${topic}:yes`;
      } else if (t === 'yes' || t === 'no' || t === 'dunno') {
        if (!topic || topic === 'greeting' || topic === 'thanks' || topic === 'bye') {
          [kind, html] = t === 'dunno' ? pick('dunno', AFTER_DUNNO) : pick('open', R.open);
        } else if (t === 'yes') {
          if (STEP[lastKind]) { html = STEP[lastKind]; kind = 'done'; }
          else html = pick('yesAsk', AFTER_YES_ASK);
        } else if (t === 'no') {
          html = pick('no', AFTER_NO);
        } else {
          [kind, html] = pick('dunno', AFTER_DUNNO);
        }
        t = `${topic || 'open'}:${t}`;
      } else if (t === 'open' && topic && MORE[topic] && MORE[topic].length) {
        html = pick(`more:${topic}`, MORE[topic]);
        t = `${topic}:more`;
      } else if (t === topic && MORE[t] && (used[t] || []).length >= R[t].length && (used[`more:${t}`] || []).length < MORE[t].length) {
        // Same topic again and its openers are used up: continue the thread before repeating anything
        html = pick(`more:${t}`, MORE[t]);
        t = `${t}:more`;
      } else {
        [kind, html] = pick(t, R[t]);
        topic = t;
      }
      lastKind = kind;
      if (t === 'crisis') crisisSeen = true;
      else if (crisisSeen) html += REMINDER;

      const text = strip(html);
      return { topic: t, kind, html, text, delay: 600 + Math.round(rand() * 300) + Math.min(300, text.length) };
    }

    return { reply: respond, get topic() { return topic; } };
  }

  const api = create();
  api.create = create;
  api.detect = detect;
  api.normalize = normalize;
  api.setKnowledge = setKnowledge;
  root.SoleilOffline = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  // In the browser the knowledge base loads in the background; until it arrives (or if it's missing) the chat works without it
  if (typeof document !== 'undefined' && typeof fetch === 'function') {
    fetch('data/wiedza.json').then((r) => (r.ok ? r.json() : null)).then((db) => { if (db) setKnowledge(db); }).catch(() => {});
  }
})(typeof window !== 'undefined' ? window : globalThis);
