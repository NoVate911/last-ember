import { STORM_START_DAY } from './data'
import { RANDOM_EVENTS, type RandomEventDef } from './randomEvents'
import { addLog, clamp, totalPop } from './simulation'
import type { ActivePromise, EventChoice, GameState } from './types'

const at = (day: number, hour: number) => (day - 1) * 24 + hour

/** Minimum quiet hours between two random events */
const MIN_GAP = 10

/**
 * Story milestones tied to the storm. Only these two are fixed; the warning itself
 * comes at a random moment within a window, not at a set hour.
 */
const STORM_WARNING = { from: at(STORM_START_DAY - 6, 8), until: at(STORM_START_DAY - 4, 18) }

function fire(s: GameState, id: string, title: string, text: string, choices: EventChoice[], data?: Record<string, number>) {
  s.pendingEvent = data ? { id, title, text, choices, data } : { id, title, text, choices }
}

function milestones(s: GameState): boolean {
  if (!s.firedEvents.includes('scouts') && s.time >= STORM_WARNING.from) {
    if (s.time >= STORM_WARNING.until || Math.random() < 0.08) {
      s.firedEvents.push('scouts')
      const days = Math.max(1, Math.round((at(STORM_START_DAY, 0) - s.time) / 24))
      fire(s, 'scouts', 'Белая стена',
        `Дозорные на гребне видят, как чернеет северный горизонт. Примерно через ${days} дн. на город обрушится великая буря. Запасайте уголь, утепляйте дома, готовьте генератор.`,
        [{ label: 'Мы будем готовы', hint: `Буря начнётся на ${STORM_START_DAY}-й день`, action: 'none' }])
      return true
    }
  }
  if (!s.firedEvents.includes('storm') && s.time >= at(STORM_START_DAY, 0)) {
    s.firedEvents.push('storm')
    fire(s, 'storm', 'Буря',
      'Небо стало цвета железа. Температура падает ниже, чем город когда-либо знал. Не дайте огню погаснуть. Продержитесь до 21-го дня.',
      [{ label: 'Огонь не погаснет', hint: 'Продержитесь 3 дня', action: 'none' }])
    return true
  }
  return false
}

function eligible(s: GameState, e: RandomEventDef): boolean {
  const day = Math.floor(s.time / 24) + 1
  if (e.minDay && day < e.minDay) return false
  if (e.maxDay && day > e.maxDay) return false
  const last = s.eventLog[e.id]
  if (last !== undefined && (e.cooldown === Infinity || s.time - last < e.cooldown)) return false
  return e.when ? e.when(s) : true
}

/** Called every hour: maybe trigger a random event (more likely the longer it has been quiet). */
export function checkEvents(s: GameState) {
  if (s.pendingEvent || s.status !== 'playing' || totalPop(s) <= 0) return
  if (milestones(s)) return
  const hour = Math.round(s.time) % 24
  if (hour < 7 || hour > 21) return
  const quiet = s.time - s.lastEventAt
  if (quiet < MIN_GAP) return
  const chance = Math.min(0.4, 0.05 + (quiet - MIN_GAP) * 0.012)
  if (Math.random() > chance) return
  const pool = RANDOM_EVENTS.filter((e) => eligible(s, e))
  const total = pool.reduce((sum, e) => sum + e.weight, 0)
  if (total <= 0) return
  let r = Math.random() * total
  const chosen = pool.find((e) => (r -= e.weight) <= 0) ?? pool[pool.length - 1]
  if (!chosen) return
  const draft = chosen.make(s)
  s.eventLog[chosen.id] = s.time
  s.lastEventAt = s.time
  fire(s, chosen.id, draft.title, draft.text, draft.choices, draft.data)
}

export function resolveEvent(s: GameState, action: string) {
  const ev = s.pendingEvent
  const def = ev ? RANDOM_EVENTS.find((e) => e.id === ev.id) : undefined
  const effect = def?.effects[action]
  if (ev && effect) effect(s, ev.data ?? {})
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
