# Postać: interaktywna mapa ciała

Pełnoekranowa postać człowieka (widok z przodu) podzielona na klikalne mięśnie i organy. Działa na telefonie i na komputerze.

- **Oddalenie:** widać całą sylwetkę z mięśniami.
- **Przybliżenie** (dwa palce, kółko myszy albo podwójny tap): mięśnie klatki i brzucha znikają i odsłaniają organy. Przy dalszym zoomie organy, które na siebie nachodzą, rozsuwają się. Przerywane linie pokazują, skąd który organ wyszedł, więc każdy da się trafić palcem osobno.
- **Tap** zaznacza część (podświetlenie i nazwa po polsku i łacinie). Tap w to samo miejsce albo w tło odznacza. `Esc` odznacza, `0` wraca do całej postaci.

Na razie bez GUI. Panel z opisem albo czat podpina się przez `onSelect` (niżej).

## Pliki

| plik | co robi |
|---|---|
| `anatomy.ts` | model ciała: katalog części (`INFO`: nazwa, łacina, opis), kształty, kolory i `buildBodyModel()` |
| `layout.ts` | solver widoku rozsuniętego: liczy raz na starcie, o ile przesunąć każdy organ, żeby przy pełnym zoomie żadne dwa się nie nakładały |
| `geometry.ts` | wygładzanie krzywych, układy współrzędnych kończyn, otoczki wypukłe, test kolizji SAT |
| `gestures.ts` | pinch, przesuwanie, kółko, tap i podwójny tap (Pointer Events) |
| `BodyMap.ts` | renderer SVG, kamera, zoom → głębokość, zaznaczanie |

## API

```ts
import { mountBodyMap } from './body/BodyMap.ts'
import './body/body.css'

const map = mountBodyMap(element, {
  onSelect(part) {
    // part === null po odznaczeniu
    // part.id: 'heart', 'biceps-left', ...
    // part.info: { name, latin, description, system: 'muscle' | 'organ' }
    // part.side: strona ciała postaci ('left' | 'right'), jeśli parzysta
  },
})
map.focus('liver') // animuje kamerę do części (odsłania ją) i zaznacza
map.select(null)
map.reset()
map.destroy()
```

`element` powinien mieć klasę `body-stage` (pełny ekran, `touch-action: none`).

Linki do konkretnego widoku (też do debugowania): `?k=3&x=0&y=280&sel=heart`. `k` to zoom względem „cała postać na ekranie”, `x`/`y` to punkt modelu na środku ekranu, a `sel` to id zaznaczonej części.

## Dodawanie i zmiana części

Współrzędne modelu: czubek głowy `y = 0`, stopy `y ≈ 806`, oś ciała `x = 0`. Kształty pisze się dla strony `+x`, czyli **lewej strony postaci** (patrzymy na nią z przodu); prawa strona powstaje przez odbicie. Mięśnie kończyn opisuje się we współrzędnych kończyny `[t, s]`: `t` biegnie 0..1 wzdłuż kości, `s` od −1 (strona przyśrodkowa) do +1 (strona boczna). Dzięki temu mięsień zawsze mieści się w obrysie ręki albo nogi.

Po zmianie kształtów organów solver sam przeliczy rozsunięcie. W trybie dev (`npm run dev`) konsola ostrzeże, jeśli jakieś organy nadal się nakładają.
