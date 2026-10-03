import { DISCLAIMER } from '../components/Footer.tsx'

export default function HelpScreen() {
  return (
    <div className="prose prose-slate mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Jak to działa</h1>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-slate-700">
        <li>
          <strong>Wskazujesz miejsce na sylwetce</strong> (przód lub tył) albo wpisujesz objaw. Dla każdej okolicy jest krótka lista typowych dolegliwości.
        </li>
        <li>
          <strong>Odpowiadasz na pytania alarmowe</strong> – najpierw wykluczamy sytuacje wymagające natychmiastowej pomocy. Potem pytamy o czas trwania, początek, nasilenie i przebieg.
        </li>
        <li>
          <strong>Dostajesz wstępną ocenę:</strong> zalecenie (samoopieka, wizyta u lekarza, pilna konsultacja lub stan nagły), listę możliwych przyczyn z poziomem dopasowania i wskazówki, co możesz zrobić.
        </li>
      </ol>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Czego to narzędzie nie robi</h2>
      <p className="mt-2 text-slate-700">{DISCLAIMER} Nie stawia diagnozy, nie przepisuje leków i nie widzi Cię – lekarz ma dostęp do badania, historii choroby i wyników, których tu nie ma.</p>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Numery, które warto znać</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
        <li>
          <a href="tel:112" className="font-semibold">112</a> – ogólnoeuropejski numer alarmowy, <a href="tel:999" className="font-semibold">999</a> – pogotowie ratunkowe.
        </li>
        <li>
          <a href="tel:800137200" className="font-semibold">800 137 200</a> – Teleplatforma Pierwszego Kontaktu NFZ (bezpłatna): pon.–pt. 18:00–8:00, w weekendy i święta całą dobę. Teleporada lekarza, pielęgniarki lub położnej, e-recepta.
        </li>
        <li>Nocna i świąteczna opieka zdrowotna oraz SOR (szpitalny oddział ratunkowy) – gdy przychodnia jest zamknięta, a sprawa nie może czekać.</li>
      </ul>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Prywatność</h2>
      <p className="mt-2 text-slate-700">
        Odpowiedzi i zapisane analizy zostają w Twojej przeglądarce (localStorage); nic nie jest wysyłane na serwer. Logowanie (Clerk) służy tylko do rozdzielenia historii między osoby korzystające z tego samego urządzenia. To prototyp hackathonowy, nie wyrób medyczny.
      </p>

      <h2 className="mt-8 text-xl font-bold text-slate-900">Na jakich wzorcach się opieramy</h2>
      <p className="mt-2 text-slate-700">
        Układ ekranów naśladuje sprawdzone narzędzia: mapę ciała WebMD i Healthwise, kartę zalecenia i poziomy dopasowania Symptomate (Infermedica, Wrocław), pytania alarmowe i kolorowe karty NHS 111 oraz pytania „dlaczego o to pytamy” z Buoy. Szczegóły w pliku <code>docs/badanie-rynku.md</code> w repozytorium.
      </p>
    </div>
  )
}
