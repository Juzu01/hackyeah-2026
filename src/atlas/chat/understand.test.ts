import { describe, expect, it } from 'vitest'
import catalog from '../../anatomy/data/catalog.json'
import { parseIntensity, partsMentioned, understand } from './understand.ts'

const ids = new Set(catalog.parts.map((p) => p.id))

describe('partsMentioned', () => {
  it.each([
    ['boli mnie kolano', 'patella-right'],
    ['coś mi strzyka w kolanie', 'patella-right'],
    ['uderzyłem się kolanem', 'patella-right'],
    ['gdzie jest wątroba', 'liver'],
    ['co z moją wątrobą', 'liver'],
    ['skurcz w łydce', 'gastrocnemius-right'],
    ['pokaż łydki', 'gastrocnemius-right'],
    ['nerki', 'kidney-right'],
    ['ramię', 'deltoid-right'],
    ['mięsień dwugłowy ramienia', 'biceps-brachii-right'],
    ['kość ramienna', 'humerus-right'],
    ['palce u stóp', 'foot-bones-right'],
    ['pęcherzyk żółciowy', 'gallbladder'],
    ['pęcherz', 'urinary-bladder'],
    ['jelito grube', 'large-intestine'],
    ['tył uda', 'biceps-femoris-right'],
    ['najszerszy grzbietu', 'latissimus-dorsi-right'],
    ['klata', 'pectoralis-major-right'],
    ['krzyż', 'vertebral-column'],
  ])('%s → %s', (text, id) => {
    expect(partsMentioned(text)[0]).toBe(id)
  })

  it('takes the side said nearest to each part', () => {
    expect(partsMentioned('lewe kolano')).toEqual(['patella-left'])
    expect(partsMentioned('w kolanie lewym')).toEqual(['patella-left'])
    expect(partsMentioned('lewe kolano i prawa łydka')).toEqual(['patella-left', 'gastrocnemius-right'])
    expect(partsMentioned('płuco lewe')).toEqual(['lung-left'])
  })

  it('only returns ids that exist in the catalog', () => {
    const texts = ['głowa szyja kark bark obojczyk łopatka plecy krzyż brzuch serce płuca żołądek wątroba nerki pęcherz']
    texts.push('jelita trzustka śledziona tarczyca łokieć przedramię nadgarstek dłoń biodro pośladek udo kolano łydka')
    texts.push('goleń kostka stopa pięta biceps triceps brzuszki mózg szczęka skroń żebra gardło aorta tchawica')
    for (const t of texts) {
      const found = partsMentioned(t)
      expect(found.length).toBeGreaterThan(10)
      for (const id of found) expect(ids.has(id), id).toBe(true)
    }
  })
})

describe('parseIntensity', () => {
  it.each([
    ['tak na 6', 6],
    ['na szóstkę', 6],
    ['6 na 10', 6],
    ['6/10', 6],
    ['siedem na dziesięć', 7],
    ['w skali od 1 do 10 to 4', 4],
    ['boli mnie kolano 8', 8],
    ['dziesięć', 10],
    ['od 3 dni boli mnie łydka', null],
    ['od 2 tygodni, tak na 5', 5],
    ['dwa kolana', null],
    ['strasznie boli', 9],
    ['trochę boli', 3],
    ['średnio', 5],
    ['mocno', 7],
    ['11', null],
  ])('%s → %s', (text, n) => {
    expect(parseIntensity(text)).toBe(n)
  })
})

describe('understand', () => {
  it('reads a whole pain report', () => {
    expect(understand('Boli mnie lewe kolano, tak na 6, kłuje')).toEqual({
      kind: 'pain',
      partId: 'patella-left',
      intensity: 6,
      typeIds: ['stabbing'],
    })
  })

  it('collects the pain types in the table order', () => {
    const i = understand('piecze i pulsuje mnie w żołądku, promieniuje do pleców')
    expect(i).toMatchObject({ kind: 'pain', partId: 'stomach' })
    expect(i.kind === 'pain' && i.typeIds).toEqual(['throbbing', 'burning', 'radiating'])
  })

  it('treats belly ache as the stomach and belly exercises as the abs', () => {
    expect(understand('boli mnie brzuch')).toMatchObject({ kind: 'pain', partId: 'stomach' })
    expect(understand('ćwiczenia na brzuch')).toEqual({ kind: 'exercise', partId: 'rectus-abdominis-right' })
  })

  it('uses the selected part when none is named', () => {
    expect(understand('tutaj mnie boli na 4', { selectedId: 'deltoid-left' })).toMatchObject({
      kind: 'pain',
      partId: 'deltoid-left',
      intensity: 4,
    })
    expect(understand('jakie ćwiczenia na to?', { selectedId: 'soleus-right' })).toEqual({
      kind: 'exercise',
      partId: 'soleus-right',
    })
    expect(understand('boli mnie')).toEqual({ kind: 'pain', partId: null, intensity: null, typeIds: [] })
  })

  it('keeps the selected side for a paired part said without one', () => {
    expect(understand('boli mnie łydka', { selectedId: 'gastrocnemius-left' })).toMatchObject({
      partId: 'gastrocnemius-left',
    })
  })

  it('does not take a duration for the intensity', () => {
    expect(understand('od 3 dni boli mnie łydka')).toMatchObject({ kind: 'pain', intensity: null })
  })

  it('reads a part with a rating as pain even without "boli"', () => {
    expect(understand('kolano na siódemkę')).toMatchObject({ kind: 'pain', partId: 'patella-right', intensity: 7 })
  })

  it.each([
    ['gdzie jest wątroba', 'liver'],
    ['pokaż serce', 'heart'],
    ['co to jest biceps', 'biceps-brachii-right'],
    ['do czego służy trzustka', 'pancreas'],
    ['żołądek', 'stomach'],
  ])('show: %s', (text, partId) => {
    expect(understand(text)).toEqual({ kind: 'show', partId })
  })

  it.each([
    ['jak wzmocnić łydki', 'gastrocnemius-right'],
    ['ćwiczenia na plecy', 'latissimus-dorsi-right'],
    ['jak rozciągnąć udo', 'rectus-femoris-right'],
    ['jakie ćwiczenia na ból pleców', 'latissimus-dorsi-right'],
  ])('exercise: %s', (text, partId) => {
    expect(understand(text)).toEqual({ kind: 'exercise', partId })
  })

  it('does not mistake a strain for an exercise question', () => {
    expect(understand('naciągnąłem łydkę i boli')).toMatchObject({ kind: 'pain', partId: 'gastrocnemius-right' })
  })

  it.each([
    ['boli mnie w klatce piersiowej', 'ból w klatce piersiowej'],
    ['boli mnie serce', 'ból w klatce piersiowej'],
    ['ściska mnie w klatce, tak na 3', 'ból w klatce piersiowej'],
    ['nie mogę złapać tchu', 'duszność'],
    ['drętwieje mi twarz', 'objawy udaru'],
    ['nagle zaczęła mnie strasznie boleć głowa', 'nagły, bardzo silny ból głowy'],
    ['zemdlałem', 'utrata przytomności'],
    ['nie chcę już żyć', 'myśli samobójcze'],
  ])('emergency first: %s', (text, reason) => {
    expect(understand(text)).toEqual({ kind: 'emergency', reason })
  })

  it('lets gym talk about the pecs through', () => {
    expect(understand('boli mnie klata po treningu')).toMatchObject({ kind: 'pain', partId: 'pectoralis-major-right' })
    expect(understand('gdzie jest serce')).toEqual({ kind: 'show', partId: 'heart' })
  })

  it.each([
    ['pokaż narządy', 'organs'],
    ['pokaż mięśnie', 'muscles'],
    ['rozsuń narządy', 'exploded'],
    ['pokaż kości', 'organs'],
  ] as const)('layer: %s', (text, layer) => {
    expect(understand(text)).toEqual({ kind: 'layer', layer })
  })

  it.each(['odwróć', 'pokaż tył', 'pokaż plecy', 'obróć ciało'])('flip: %s', (text) => {
    expect(understand(text)).toEqual({ kind: 'flip' })
  })

  it('answers help, thanks and nonsense', () => {
    expect(understand('jak to działa?')).toEqual({ kind: 'help' })
    expect(understand('co umiesz')).toEqual({ kind: 'help' })
    expect(understand('dzięki!')).toEqual({ kind: 'thanks' })
    expect(understand('jaka jest pogoda')).toEqual({ kind: 'unknown' })
    expect(understand('   ')).toEqual({ kind: 'unknown' })
  })
})
