import { addLog, clamp, totalPop } from './simulation'
import type { ActivePromise, GameState, PendingEvent } from './types'

interface ScriptedEvent extends PendingEvent {
  at: number
}

const at = (day: number, hour: number) => (day - 1) * 24 + hour

const SCRIPTED: ScriptedEvent[] = [
  {
    id: 'shelter', at: at(1, 15), title: 'Крыша до темноты',
    text: 'Выжившие жмутся друг к другу в снегу, а свет уже меркнет. Вперёд выходит плотник: «Дайте нам кров — и мы отдадим вам все силы».',
    choices: [
      { label: 'Обещаю: к утру у всех будет крыша', hint: 'Обещание: расселить всех до 08:00 2-го дня', action: 'promise_house' },
      { label: 'Сейчас есть дела поважнее', hint: 'Недовольство +5', action: 'refuse_promise' },
    ],
  },
  {
    id: 'refugees1', at: at(4, 10), title: 'Чужаки на гребне',
    text: 'По стене кратера спускается колонна оборванных путников: восемнадцать человек, среди них двое инженеров. Они умоляют пустить их к теплу.',
    choices: [
      { label: 'Открыть ворота', hint: '+12 рабочих, +2 инженера, +4 ребёнка, Надежда +5', action: 'accept_refugees1' },
      { label: 'Нам не прокормить лишние рты', hint: 'Надежда −6', action: 'refuse_refugees' },
    ],
  },
  {
    id: 'warmHomes', at: at(6, 9), title: 'Иней на подушках',
    text: 'Семьи просыпаются со льдом в волосах. Делегация просит, чтобы в каждом доме было хотя бы прохладно, а не морозно.',
    choices: [
      { label: 'В течение 36 часов во всех домах будет тепло', hint: 'Обещание: во всех домах «Прохладно» или теплее', action: 'promise_heat' },
      { label: 'Холод — это часть жизни', hint: 'Недовольство +6', action: 'refuse_promise_heat' },
    ],
  },
  {
    id: 'refugees2', at: at(9, 11), title: 'Обмороженные',
    text: 'С юга, хромая, приходит санная упряжка. Многие обморожены, некоторые — тяжело. Там, снаружи, они погибнут.',
    choices: [
      { label: 'Принять всех до единого', hint: '+15 рабочих, +5 детей (9 больных, 3 тяжелобольных), Надежда +6', action: 'accept_refugees2' },
      { label: 'Развернуть сани', hint: 'Надежда −8', action: 'refuse_refugees2' },
    ],
  },
  {
    id: 'theft', at: at(11, 14), title: 'Вор на складе',
    text: 'Отца семейства поймали на краже пайков для детей. Толпа ждёт вашего решения.',
    choices: [
      { label: 'Наказать его в назидание другим', hint: 'Недовольство −4, Надежда −4', action: 'punish' },
      { label: 'Пусть оставит еду себе', hint: 'Пайки −25, Недовольство +4', action: 'forgive' },
    ],
  },
  {
    id: 'scouts', at: at(13, 8), title: 'Белая стена',
    text: 'Дозорные на гребне видят, как чернеет северный горизонт. Примерно через пять дней на город обрушится великая буря. Запасайте уголь, утепляйте дома, готовьте генератор.',
    choices: [{ label: 'Мы будем готовы', hint: 'Буря начнётся на 18-й день', action: 'none' }],
  },
  {
    id: 'sickPromise', at: at(14, 10), title: 'Кашель в темноте',
    text: 'Больные заполнили каждый угол. Люди требуют действовать, пока не пришла буря.',
    choices: [
      { label: 'Меньше 5 больных в течение 48 часов', hint: 'Обещание: больных и тяжелобольных < 5', action: 'promise_sick' },
      { label: 'Сначала — здоровые', hint: 'Недовольство +5', action: 'refuse_promise_sick' },
    ],
  },
  {
    id: 'storm', at: at(18, 0), title: 'Буря',
    text: 'Небо стало цвета железа. Температура падает ниже, чем город когда-либо знал. Не дайте огню погаснуть. Продержитесь до 21-го дня.',
    choices: [{ label: 'Огонь не погаснет', hint: 'Продержитесь 3 дня', action: 'none' }],
  },
]

export function checkEvents(s: GameState) {
  if (s.pendingEvent) return
  for (const e of SCRIPTED) {
    if (s.time >= e.at && !s.firedEvents.includes(e.id)) {
      s.firedEvents.push(e.id)
      if (e.id === 'refugees2' && totalPop(s) <= 0) continue
      s.pendingEvent = { id: e.id, title: e.title, text: e.text, choices: e.choices }
      return
    }
  }
}

function makePromise(s: GameState, kind: ActivePromise['kind'], text: string, hours: number) {
  s.promise = { id: `${kind}-${s.time}`, kind, text, deadline: s.time + hours }
  s.hope = clamp(s.hope + 3, 0, 100)
  addLog(s, `Дано обещание: ${text}`, 'info')
}

export function resolveEvent(s: GameState, action: string) {
  switch (action) {
    case 'promise_house': makePromise(s, 'house_all', 'Расселить всех жителей', Math.max(4, at(2, 8) - s.time)); break
    case 'promise_heat': makePromise(s, 'heat_homes', 'Во всех домах «Прохладно» или теплее', 36); break
    case 'promise_sick': makePromise(s, 'no_sick', 'Меньше 5 больных', 48); break
    case 'refuse_promise': s.discontent = clamp(s.discontent + 5, 0, 100); break
    case 'refuse_promise_heat': s.discontent = clamp(s.discontent + 6, 0, 100); break
    case 'refuse_promise_sick': s.discontent = clamp(s.discontent + 5, 0, 100); break
    case 'accept_refugees1':
      s.pop.workers += 12; s.pop.engineers += 2; s.pop.children += 4
      s.hope = clamp(s.hope + 5, 0, 100)
      addLog(s, 'К городу присоединились 18 новых жителей.', 'good')
      break
    case 'refuse_refugees': s.hope = clamp(s.hope - 6, 0, 100); break
    case 'accept_refugees2':
      s.pop.workers += 15; s.pop.children += 5
      s.sick += 9; s.gravelyIll += 3
      s.hope = clamp(s.hope + 6, 0, 100)
      addLog(s, 'К городу присоединились 20 обмороженных выживших.', 'good')
      break
    case 'refuse_refugees2': s.hope = clamp(s.hope - 8, 0, 100); break
    case 'punish':
      s.discontent = clamp(s.discontent - 4, 0, 100); s.hope = clamp(s.hope - 4, 0, 100)
      break
    case 'forgive':
      s.resources.rations = Math.max(0, s.resources.rations - 25)
      s.discontent = clamp(s.discontent + 4, 0, 100)
      break
    default: break
  }
  s.pendingEvent = null
}

function promiseMet(s: GameState, p: ActivePromise): boolean {
  if (p.kind === 'house_all') return s.stats.homeless === 0
  if (p.kind === 'no_sick') return s.sick + s.gravelyIll < 5
  // heat_homes: every housed citizen is Chilly (3) or warmer and no one sleeps outside
  if (s.stats.homeless > 0) return false
  return s.buildings.every((b) => !b.built || b.residents === 0 || b.heat >= 3)
}

export function checkPromise(s: GameState) {
  const p = s.promise
  if (!p) return
  if (promiseMet(s, p)) {
    s.hope = clamp(s.hope + 10, 0, 100)
    s.discontent = clamp(s.discontent - 10, 0, 100)
    addLog(s, `Обещание выполнено: ${p.text}. Люди верят в вас.`, 'good')
    s.promise = null
  } else if (s.time >= p.deadline) {
    s.hope = clamp(s.hope - 10, 0, 100)
    s.discontent = clamp(s.discontent + 10, 0, 100)
    addLog(s, `Обещание нарушено: ${p.text}.`, 'bad')
    s.promise = null
  }
}

export function checkEnd(s: GameState, finalTime: number) {
  if (s.status !== 'playing') return
  const pop = totalPop(s)
  if (pop <= 0) {
    s.status = 'lost'
    s.endReason = 'Замёрз последний житель. Город погрузился в тишину.'
  } else if (s.discontent >= 100) {
    s.status = 'lost'
    s.endReason = 'Терпение людей лопнуло. Вас изгнали в ледяную пустошь.'
  } else if (s.hope <= 0) {
    s.status = 'lost'
    s.endReason = 'Надежда умерла. Выжившие покинули город и ушли бродить по льдам.'
  } else if (s.time >= finalTime) {
    s.status = 'won'
    s.endReason = `Буря миновала. Благодаря вашим решениям выжили ${pop} чел.`
  }
}
