// Doco's quote of the day: words from people worth listening to, each signed with who said it
// and who they were. Only quotes with a known source (book, letter, speech); the many that
// circulate under a famous name they never said are left out.
// window.DocoQuotes.pick(step): today's quote for step 0, then the next ones in a fixed shuffle.
(function () {
  // [quote, author, who they were (and where it comes from)]
  const QUOTES = [
    ['Nie dlatego nie mamy odwagi, że rzeczy są trudne; są trudne, bo nie mamy odwagi.', 'Seneka', 'filozof rzymski, „Listy moralne do Lucyliusza”'],
    ['Uczyć się trzeba tak długo, jak długo się żyje.', 'Seneka', 'filozof rzymski, „Listy moralne do Lucyliusza”'],
    ['Nie same rzeczy niepokoją ludzi, lecz ich mniemania o rzeczach.', 'Epiktet', 'filozof stoicki, „Encheiridion”'],
    ['Nie żądaj, by wszystko działo się tak, jak chcesz; chciej, by działo się tak, jak się dzieje, a będzie ci dobrze.', 'Epiktet', 'filozof stoicki, „Encheiridion”'],
    ['Jeśli martwi cię coś zewnętrznego, to nie ono cię niepokoi, lecz twój sąd o nim. A ten sąd możesz w każdej chwili odrzucić.', 'Marek Aureliusz', 'cesarz rzymski i filozof, „Rozmyślania”'],
    ['Podróż tysiąca mil zaczyna się od pierwszego kroku.', 'Laozi', 'filozof chiński, „Tao te king”'],
    ['Kto zna innych, jest mądry. Kto zna siebie, jest oświecony.', 'Laozi', 'filozof chiński, „Tao te king”'],
    ['Nadzieja to sen na jawie.', 'Arystoteles', 'filozof grecki'],
    ['Kiedy nie jesteśmy już w stanie zmienić sytuacji, stajemy przed wyzwaniem, by zmienić siebie.', 'Viktor E. Frankl', 'psychiatra, ocalały z Auschwitz, „Człowiek w poszukiwaniu sensu”'],
    ['Kto ma po co żyć, zniesie prawie każde jak.', 'Friedrich Nietzsche', 'filozof, „Zmierzch bożyszcz”'],
    ['Trzeba mieć w sobie chaos, by zrodzić tańczącą gwiazdę.', 'Friedrich Nietzsche', 'filozof, „Tako rzecze Zaratustra”'],
    ['W środku zimy odkryłem w sobie niezwyciężone lato.', 'Albert Camus', 'pisarz, laureat Nagrody Nobla'],
    ['Życie jest jak jazda na rowerze: żeby utrzymać równowagę, trzeba jechać dalej.', 'Albert Einstein', 'fizyk, w liście do syna (1930)'],
    ['Ważne, by nie przestawać zadawać pytań.', 'Albert Einstein', 'fizyk, laureat Nagrody Nobla'],
    ['Nic w życiu nie jest straszne, trzeba to tylko zrozumieć.', 'Maria Skłodowska-Curie', 'fizyczka i chemiczka, dwukrotna noblistka'],
    ['Życie nie jest łatwe dla nikogo z nas. Ale cóż z tego? Trzeba mieć wytrwałość, a przede wszystkim wiarę w siebie.', 'Maria Skłodowska-Curie', 'fizyczka i chemiczka, dwukrotna noblistka'],
    ['Czemu ty się, zła godzino, z niepotrzebnym mieszasz lękiem? Jesteś — a więc musisz minąć. Miniesz — a więc to jest piękne.', 'Wisława Szymborska', 'poetka, noblistka, „Nic dwa razy”'],
    ['Tyle wiemy o sobie, ile nas sprawdzono.', 'Wisława Szymborska', 'poetka, noblistka, „Minuta ciszy po Ludmile Kocoń”'],
    ['Mierz siłę na zamiary, nie zamiar podług sił.', 'Adam Mickiewicz', 'poeta, „Oda do młodości”'],
    ['Musicie od siebie wymagać, nawet gdyby inni od was nie wymagali.', 'Jan Paweł II', 'do młodzieży na Jasnej Górze (1983)'],
    ['Dobrze widzi się tylko sercem. Najważniejsze jest niewidoczne dla oczu.', 'Antoine de Saint-Exupéry', 'pisarz i lotnik, „Mały Książę”'],
    ['Wszystko ma w sobie pęknięcie — i właśnie tędy wpada światło.', 'Leonard Cohen', 'poeta i muzyk, „Anthem”'],
    ['Musimy tylko zdecydować, co zrobić z czasem, który został nam dany.', 'J.R.R. Tolkien', 'pisarz, „Władca Pierścieni”'],
    ['Nie wszyscy, którzy wędrują, są zagubieni.', 'J.R.R. Tolkien', 'pisarz, „Władca Pierścieni”'],
    ['Próbowałeś. Przegrałeś. Nieważne. Spróbuj jeszcze raz. Przegraj znowu. Przegraj lepiej.', 'Samuel Beckett', 'dramaturg, laureat Nagrody Nobla'],
    ['W trzech słowach mogę zawrzeć wszystko, czego nauczyłem się o życiu: ono toczy się dalej.', 'Robert Frost', 'poeta, czterokrotny laureat Pulitzera'],
    ['Twój czas jest ograniczony, więc nie marnuj go, żyjąc cudzym życiem.', 'Steve Jobs', 'współzałożyciel Apple, przemówienie w Stanfordzie (2005)'],
    ['Bądź łagodny dla siebie. Jesteś dzieckiem wszechświata, nie mniej niż drzewa i gwiazdy; masz prawo tu być.', 'Max Ehrmann', 'poeta, „Desiderata”'],
    ['Gdy jedne drzwi szczęścia się zamykają, otwierają się inne; często jednak tak długo patrzymy na zamknięte, że nie widzimy tych, które otworzyły się przed nami.', 'Helen Keller', 'pisarka i działaczka, niewidoma i niesłysząca od dziecka'],
    ['Optymizm to wiara, która prowadzi do osiągnięć. Bez nadziei i pewności siebie nic nie da się zrobić.', 'Helen Keller', 'pisarka i działaczka, „Optymizm”'],
    ['Jeśli nie możesz latać, biegnij. Jeśli nie możesz biec, idź. Jeśli nie możesz iść, czołgaj się. Ale cokolwiek robisz, idź naprzód.', 'Martin Luther King Jr.', 'działacz na rzecz praw obywatelskich, noblista'],
    ['Ciemność nie może wypędzić ciemności; może to zrobić tylko światło.', 'Martin Luther King Jr.', 'działacz na rzecz praw obywatelskich, noblista'],
    ['Człowiek nie jest stworzony do klęski. Człowieka można zniszczyć, ale nie pokonać.', 'Ernest Hemingway', 'pisarz, noblista, „Stary człowiek i morze”'],
    ['Jedyną rzeczą, której musimy się bać, jest sam strach.', 'Franklin D. Roosevelt', 'prezydent Stanów Zjednoczonych'],
    ['Nie wszystko, z czym się mierzymy, da się zmienić, ale nic nie da się zmienić, dopóki się z tym nie zmierzymy.', 'James Baldwin', 'pisarz'],
    ['Bądź cierpliwy wobec wszystkiego, co nierozwiązane w twoim sercu, i staraj się pokochać same pytania.', 'Rainer Maria Rilke', 'poeta, „Listy do młodego poety”'],
    ['Siła nie pochodzi ze sprawności ciała. Pochodzi z niezłomnej woli.', 'Mahatma Gandhi', 'przywódca niepodległości Indii'],
    ['Nauczyłem się, że odwaga nie jest brakiem strachu, lecz zwycięstwem nad nim.', 'Nelson Mandela', 'prezydent RPA, noblista, „Długa droga do wolności”'],
    ['Jak wspaniale, że nikt nie musi czekać ani chwili, by zacząć ulepszać świat.', 'Anne Frank', 'autorka „Dziennika”'],
    ['Wielkie rzeczy nie powstają pod wpływem impulsu, lecz są sumą wielu drobnych rzeczy.', 'Vincent van Gogh', 'malarz, w liście do brata'],
    ['Jeśli słyszysz w sobie głos, który mówi: „nie umiesz malować”, to tym bardziej maluj, a ten głos ucichnie.', 'Vincent van Gogh', 'malarz, w liście do brata'],
    ['Pamiętaj, by patrzeć w gwiazdy, a nie pod nogi.', 'Stephen Hawking', 'fizyk'],
    ['Jakkolwiek trudne wydaje się życie, zawsze jest coś, co możesz zrobić i w czym możesz odnieść sukces.', 'Stephen Hawking', 'fizyk'],
    ['To nasze wybory pokazują, kim naprawdę jesteśmy, o wiele bardziej niż nasze zdolności.', 'J.K. Rowling', 'pisarka, „Harry Potter i Komnata Tajemnic”'],
    ['Najlepszym sposobem, by przewidzieć przyszłość, jest ją wynaleźć.', 'Alan Kay', 'informatyk, pionier komputerów osobistych'],
  ];

  // A fixed shuffle: stepping by a stride that shares no factor with the list's length visits
  // every quote once, and days in a row land far apart. "Next" walks on from today's.
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const n = QUOTES.length;
  let stride = 17;
  while (gcd(stride, n) !== 1) stride++;
  function pick(step = 0) {
    const d = new Date();
    const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
    return QUOTES[((((day + step) * stride) % n) + n) % n];
  }

  window.DocoQuotes = { QUOTES, pick };
})();
