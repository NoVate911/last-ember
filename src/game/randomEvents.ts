import { RESOURCE_NAMES, isStorm } from './data'
import { addLog, addRes, clamp, killPeople, totalPop } from './simulation'
import type { EventChoice, GameState, ResourceKey } from './types'

/**
 * Pool of random events. Every occurrence is rolled fresh: who shows up, how many,
 * what was found and the wording differ from game to game.
 */

type Data = Record<string, number>

export interface EventDraft {
  title: string
  text: string
  choices: EventChoice[]
  data?: Data
}

export interface RandomEventDef {
  id: string
  weight: number
  /** Hours before the event may fire again (Infinity = once per game) */
  cooldown: number
  minDay?: number
  maxDay?: number
  when?: (s: GameState) => boolean
  make: (s: GameState) => EventDraft
  effects: Record<string, (s: GameState, d: Data) => void>
}

export const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
export const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)]!

const MEN = ['Григорий', 'Степан', 'Матвей', 'Тимофей', 'Аркадий', 'Фёдор', 'Илья', 'Савелий', 'Прохор', 'Захар']
const WOMEN = ['Агафья', 'Марфа', 'Пелагея', 'Ульяна', 'Евдокия', 'Варвара', 'Анисья', 'Дарья']
const person = () => (Math.random() < 0.5 ? pick(MEN) : pick(WOMEN))

const hope = (s: GameState, v: number) => { s.hope = clamp(s.hope + v, 0, 100) }
const disc = (s: GameState, v: number) => { s.discontent = clamp(s.discontent + v, 0, 100) }
const builtAny = (s: GameState, types: string[], staffed = false) =>
  s.buildings.some((b) => b.built && types.includes(b.type) && (!staffed || b.assigned > 0))
const healthy = (s: GameState) => Math.max(0, totalPop(s) - s.sick - s.gravelyIll)
const makeSick = (s: GameState, n: number) => { s.sick += Math.min(n, healthy(s)) }
const KINDS: ResourceKey[] = ['coal', 'wood', 'steel']

function makePromise(s: GameState, kind: 'house_all' | 'heat_homes' | 'no_sick', text: string, hours: number) {
  s.promise = { id: `${kind}-${s.time}`, kind, text, deadline: s.time + hours }
  hope(s, 3)
  addLog(s, `Дано обещание: ${text}`, 'info')
}

export const RANDOM_EVENTS: RandomEventDef[] = [
  {
    id: 'shelter', weight: 6, cooldown: Infinity, maxDay: 3,
    when: (s) => !s.promise && s.stats.homeless >= 15,
    make: (s) => ({
      title: pick(['Крыша до темноты', 'Ночь под открытым небом']),
      text: `${person()}, ${pick(['плотник', 'бывший каменщик', 'мать троих детей'])}, выходит вперёд: «${s.stats.homeless} человек спят в снегу. Дайте нам кров — и мы отдадим вам все силы».`,
      choices: [
        { label: 'Обещаю: через сутки у всех будет крыша', hint: 'Обещание: расселить всех за 20 ч', action: 'promise' },
        { label: 'Сейчас есть дела поважнее', hint: 'Недовольство +5', action: 'refuse' },
      ],
    }),
    effects: {
      promise: (s) => makePromise(s, 'house_all', 'Расселить всех жителей', 20),
      refuse: (s) => disc(s, 5),
    },
  },
  {
    id: 'refugees', weight: 3, cooldown: 60, minDay: 2,
    when: (s) => !isStorm(s.time),
    make: () => {
      const w = ri(5, 14), e = Math.random() < 0.5 ? ri(1, 3) : 0, c = ri(1, 6)
      const n = w + e + c
      return {
        title: pick(['Чужаки на гребне', 'Огни на склоне', 'Голоса за стеной']),
        text: pick([
          `По стене кратера спускается колонна оборванных путников — ${n} человек${e ? `, среди них ${e} инж.` : ''}. Они умоляют пустить их к теплу.`,
          `Дозорные заметили группу беженцев из ${n} человек. Их вожак, ${person()}, просит приюта в обмен на работу.`,
          `К воротам вышли ${n} измождённых людей${c > 3 ? ' — много детей' : ''}. Они шли сюда неделю.`,
        ]),
        choices: [
          { label: 'Открыть ворота', hint: `+${w} рабочих${e ? `, +${e} инж.` : ''}, +${c} детей, Надежда +4`, action: 'accept' },
          { label: 'Нам не прокормить лишние рты', hint: 'Надежда −6', action: 'refuse' },
        ],
        data: { w, e, c },
      }
    },
    effects: {
      accept: (s, d) => {
        s.pop.workers += d['w'] ?? 0; s.pop.engineers += d['e'] ?? 0; s.pop.children += d['c'] ?? 0
        hope(s, 4)
        addLog(s, `К городу присоединились ${(d['w'] ?? 0) + (d['e'] ?? 0) + (d['c'] ?? 0)} новых жителей.`, 'good')
      },
      refuse: (s) => hope(s, -6),
    },
  },
  {
    id: 'frostbitten', weight: 2, cooldown: 96, minDay: 4,
    when: (s) => !isStorm(s.time),
    make: () => {
      const w = ri(8, 16), c = ri(2, 6), sick = ri(4, 9), grave = ri(1, 4)
      return {
        title: pick(['Обмороженные', 'Сани с юга']),
        text: `С юга, хромая, приходит санная упряжка: ${w + c} человек. Многие обморожены, ${grave} — тяжело. Там, снаружи, они погибнут.`,
        choices: [
          { label: 'Принять всех до единого', hint: `+${w} рабочих, +${c} детей (${sick} больных, ${grave} тяжелобольных), Надежда +6`, action: 'accept' },
          { label: 'Развернуть сани', hint: 'Надежда −8', action: 'refuse' },
        ],
        data: { w, c, sick, grave },
      }
    },
    effects: {
      accept: (s, d) => {
        s.pop.workers += d['w'] ?? 0; s.pop.children += d['c'] ?? 0
        s.sick += d['sick'] ?? 0; s.gravelyIll += d['grave'] ?? 0
        hope(s, 6)
        addLog(s, `К городу присоединились ${(d['w'] ?? 0) + (d['c'] ?? 0)} обмороженных выживших.`, 'good')
      },
      refuse: (s) => hope(s, -8),
    },
  },
  {
    id: 'warmHomes', weight: 3, cooldown: 120, minDay: 3,
    when: (s) => !s.promise && s.stats.coldHomes / Math.max(1, totalPop(s)) > 0.3,
    make: () => ({
      title: pick(['Иней на подушках', 'Лёд в колыбели']),
      text: 'Семьи просыпаются со льдом в волосах. Делегация просит, чтобы в каждом доме было хотя бы прохладно, а не морозно.',
      choices: [
        { label: 'В течение 36 часов во всех домах будет тепло', hint: 'Обещание: во всех домах «Прохладно» или теплее', action: 'promise' },
        { label: 'Холод — это часть жизни', hint: 'Недовольство +6', action: 'refuse' },
      ],
    }),
    effects: {
      promise: (s) => makePromise(s, 'heat_homes', 'Во всех домах «Прохладно» или теплее', 36),
      refuse: (s) => disc(s, 6),
    },
  },
  {
    id: 'sickPromise', weight: 3, cooldown: 120, minDay: 3,
    when: (s) => !s.promise && s.sick + s.gravelyIll >= 8,
    make: (s) => ({
      title: pick(['Кашель в темноте', 'Лазарет переполнен']),
      text: `Больных уже ${s.sick + s.gravelyIll}. Люди требуют действовать, пока зараза не выкосила полгорода.`,
      choices: [
        { label: 'Меньше 5 больных в течение 48 часов', hint: 'Обещание: больных и тяжелобольных < 5', action: 'promise' },
        { label: 'Сначала — здоровые', hint: 'Недовольство +5', action: 'refuse' },
      ],
    }),
    effects: {
      promise: (s) => makePromise(s, 'no_sick', 'Меньше 5 больных', 48),
      refuse: (s) => disc(s, 5),
    },
  },
  {
    id: 'theft', weight: 2, cooldown: 72, minDay: 2,
    when: (s) => s.resources.rations >= 15,
    make: (s) => {
      const amount = Math.min(Math.floor(s.resources.rations), ri(12, 30))
      const who = person()
      return {
        title: pick(['Вор на складе', 'Пропажа пайков']),
        text: pick([
          `${who} пойман(а) на краже пайков для голодных детей. Толпа ждёт вашего решения.`,
          `Ночью со склада исчезли пайки. Следы привели к бараку, где живёт ${who}.`,
        ]),
        choices: [
          { label: 'Наказать в назидание другим', hint: 'Недовольство −4, Надежда −4', action: 'punish' },
          { label: 'Пусть оставит еду себе', hint: `Пайки −${amount}, Недовольство +4`, action: 'forgive' },
        ],
        data: { amount },
      }
    },
    effects: {
      punish: (s) => { disc(s, -4); hope(s, -4) },
      forgive: (s, d) => { s.resources.rations = Math.max(0, s.resources.rations - (d['amount'] ?? 0)); disc(s, 4) },
    },
  },
  {
    id: 'cache', weight: 2.5, cooldown: 48,
    when: (s) => !isStorm(s.time),
    make: () => {
      const k = ri(0, KINDS.length - 1)
      const kind = KINDS[k]!
      const amount = kind === 'steel' ? ri(20, 45) : ri(40, 90)
      return {
        title: pick(['Находка у края кратера', 'Занесённые ящики', 'Брошенный обоз']),
        text: `${person()} заметил(а) под снегом у гребня ${pick(['перевёрнутые сани', 'ящики старой экспедиции', 'остов вагонетки'])}. Внутри — ${RESOURCE_NAMES[kind].toLowerCase()}, около ${amount}. Тащить придётся по морозу.`,
        choices: [
          { label: 'Отправить людей за грузом', hint: `+${amount} (${RESOURCE_NAMES[kind].toLowerCase()}), риск обморожения`, action: 'take' },
          { label: 'Не рисковать', hint: 'Ничего не происходит', action: 'leave' },
        ],
        data: { k, amount },
      }
    },
    effects: {
      take: (s, d) => {
        const kind = KINDS[d['k'] ?? 0] ?? 'wood'
        const got = Math.floor(addRes(s, kind, d['amount'] ?? 0))
        addLog(s, `Груз доставлен: +${got} (${RESOURCE_NAMES[kind].toLowerCase()}).`, 'good')
        if (Math.random() < 0.3) { makeSick(s, ri(1, 2)); addLog(s, 'Носильщики обморозились.', 'warn') }
      },
      leave: () => undefined,
    },
  },
  {
    id: 'accident', weight: 2, cooldown: 96, minDay: 3,
    when: (s) => builtAny(s, ['drill', 'coalMine', 'oreMine', 'sawmill', 'steelworks'], true),
    make: () => {
      const n = ri(2, 4)
      return {
        title: pick(['Обвал', 'Несчастный случай']),
        text: `${pick(['Промёрзшая крепь треснула', 'Сорвался подъёмный трос', 'Лопнул паровой котёл'])} — ${n} рабочих оказались под завалом. Каждый час на счету.`,
        choices: [
          { label: 'Разбирать завал любой ценой', hint: `Дерево −20, ${n} раненых, Надежда +2`, action: 'rescue' },
          { label: 'Слишком опасно — запечатать', hint: `${n} погибших, Недовольство +6`, action: 'seal' },
        ],
        data: { n },
      }
    },
    effects: {
      rescue: (s, d) => { s.resources.wood = Math.max(0, s.resources.wood - 20); makeSick(s, d['n'] ?? 2); hope(s, 2) },
      seal: (s, d) => { killPeople(s, d['n'] ?? 2, 'обвал'); disc(s, 6) },
    },
  },
  {
    id: 'stove', weight: 2, cooldown: 72, minDay: 2,
    when: (s) => s.buildings.some((b) => b.built && b.residents > 0),
    make: () => ({
      title: pick(['Треснувшая печь', 'Угар в бараке']),
      text: `В одном из домов ${pick(['треснула печь', 'забилась труба', 'прогорела топка'])}. Жильцы ${pick(['кашляют от дыма', 'мёрзнут всю ночь'])}.`,
      choices: [
        { label: 'Починить немедленно', hint: 'Дерево −15, сталь −5', action: 'repair' },
        { label: 'Пусть потерпят', hint: '2 больных, Недовольство +3', action: 'ignore' },
      ],
    }),
    effects: {
      repair: (s) => { s.resources.wood = Math.max(0, s.resources.wood - 15); s.resources.steel = Math.max(0, s.resources.steel - 5) },
      ignore: (s) => { makeSick(s, 2); disc(s, 3) },
    },
  },
  {
    id: 'song', weight: 1.5, cooldown: 96,
    make: () => ({
      title: pick(['Песня у огня', 'Вечер у генератора']),
      text: `${person()} достаёт ${pick(['старую гармонь', 'губную гармошку', 'самодельную скрипку'])}, и у генератора собираются люди. Кто-то начинает подпевать.`,
      choices: [
        { label: 'Пусть поют', hint: 'Надежда +4, Недовольство +1', action: 'sing' },
        { label: 'Разогнать — завтра смена', hint: 'Надежда −2, Недовольство −2', action: 'curfew' },
      ],
    }),
    effects: {
      sing: (s) => { hope(s, 4); disc(s, 1) },
      curfew: (s) => { hope(s, -2); disc(s, -2) },
    },
  },
  {
    id: 'brawl', weight: 2, cooldown: 72,
    when: (s) => s.hungry > 0 || s.discontent > 40,
    make: () => ({
      title: pick(['Драка в очереди', 'Стычка у столовой']),
      text: `${pick(MEN)} и ${pick(MEN)} сцепились из-за места в очереди. Вокруг собирается толпа.`,
      choices: [
        { label: 'Посадить зачинщиков под замок', hint: 'Недовольство −3, Надежда −3', action: 'jail' },
        { label: 'Раздать лишнюю порцию, чтобы остыли', hint: 'Пайки −15, Недовольство −4', action: 'feed' },
      ],
    }),
    effects: {
      jail: (s) => { disc(s, -3); hope(s, -3) },
      feed: (s) => { s.resources.rations = Math.max(0, s.resources.rations - 15); disc(s, -4) },
    },
  },
  {
    id: 'preacher', weight: 1, cooldown: 200, minDay: 4,
    make: () => ({
      title: 'Проповедник',
      text: `${pick(MEN)} говорит на площади, что генератор — это дар свыше, а буря — испытание. Его слушают всё больше людей.`,
      choices: [
        { label: 'Пусть говорит', hint: 'Надежда +6, Недовольство +3', action: 'listen' },
        { label: 'Изгнать смутьяна', hint: '−1 рабочий, Недовольство −3, Надежда −3', action: 'exile' },
      ],
    }),
    effects: {
      listen: (s) => { hope(s, 6); disc(s, 3) },
      exile: (s) => { if (s.pop.workers > 0) s.pop.workers--; disc(s, -3); hope(s, -3) },
    },
  },
  {
    id: 'wolves', weight: 1.5, cooldown: 96,
    when: (s) => builtAny(s, ['lodge'], true),
    make: () => ({
      title: pick(['Волки у кратера', 'Стая']),
      text: 'Охотники вернулись бледные: на стоянку напала стая волков. Звери голодны и могут прийти снова.',
      choices: [
        { label: 'Устроить облаву', hint: 'Сырая еда +40, 2 раненых', action: 'hunt' },
        { label: 'Переждать', hint: 'Сырая еда −15', action: 'wait' },
      ],
    }),
    effects: {
      hunt: (s) => { addRes(s, 'rawFood', 40); makeSick(s, 2) },
      wait: (s) => { s.resources.rawFood = Math.max(0, s.resources.rawFood - 15) },
    },
  },
  {
    id: 'boiler', weight: 1.5, cooldown: 96, minDay: 3,
    when: (s) => s.generator.on,
    make: () => ({
      title: 'Сажа в котле',
      text: 'Механики докладывают: дымоходы генератора забиты сажей, давление скачет.',
      choices: [
        { label: 'Прочистить дымоходы', hint: 'Уголь −25, давление −10%', action: 'clean' },
        { label: 'Работать дальше', hint: 'Давление в котле +25%', action: 'ignore' },
      ],
    }),
    effects: {
      clean: (s) => { s.resources.coal = Math.max(0, s.resources.coal - 25); s.generator.stress = clamp(s.generator.stress - 10, 0, 100) },
      ignore: (s) => { s.generator.stress = clamp(s.generator.stress + 25, 0, 99) },
    },
  },
  {
    id: 'foundling', weight: 1, cooldown: 150,
    make: () => ({
      title: 'Ребёнок у ворот',
      text: `Утром у ворот нашли закутанного в тряпьё ребёнка. Рядом — записка: «${pick(['Сберегите её', 'Его зовут ' + pick(MEN), 'Простите нас'])}».`,
      choices: [
        { label: 'Принять в город', hint: '+1 ребёнок, Надежда +3', action: 'take' },
        { label: 'Нам и так тяжело', hint: 'Надежда −4', action: 'refuse' },
      ],
    }),
    effects: {
      take: (s) => { s.pop.children++; hope(s, 3) },
      refuse: (s) => hope(s, -4),
    },
  },
  {
    id: 'snowdrift', weight: 1.5, cooldown: 96, minDay: 5,
    when: (s) => s.resources.wood >= 40,
    make: (s) => {
      const lost = Math.round(s.resources.wood * (0.1 + Math.random() * 0.1))
      return {
        title: 'Сугробы на складе',
        text: 'Ночная метель обрушила навес — часть досок погребена под снегом и смёрзлась.',
        choices: [
          { label: 'Откапывать сверхурочно', hint: 'Недовольство +3', action: 'dig' },
          { label: 'Списать потери', hint: `Дерево −${lost}`, action: 'drop' },
        ],
        data: { lost },
      }
    },
    effects: {
      dig: (s) => disc(s, 3),
      drop: (s, d) => { s.resources.wood = Math.max(0, s.resources.wood - (d['lost'] ?? 0)) },
    },
  },
]
