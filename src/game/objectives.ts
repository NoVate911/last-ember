import type { BuildingType, GameState } from './types'
import { addLog, clamp } from './simulation'

export interface Objective {
  id: string
  text: string
  check: (s: GameState) => boolean
  /** Optional progress label, e.g. "120/300" */
  progress?: (s: GameState) => string
}

export interface Stage {
  id: string
  title: string
  subtitle: string
  objectives: Objective[]
}

const built = (s: GameState, ...types: BuildingType[]) => s.buildings.some((b) => b.built && types.includes(b.type))
const builtCount = (s: GameState, type: BuildingType) => s.buildings.filter((b) => b.built && b.type === type).length

export const STAGES: Stage[] = [
  {
    id: 'arrival', title: 'Прибытие', subtitle: 'Обустройте лагерь до наступления ночи',
    objectives: [
      { id: 'genOn', text: 'Разжечь генератор', check: (s) => s.generator.on },
      { id: 'houseAll', text: 'Дать крышу всем жителям', check: (s) => s.stats.housed > 0 && s.stats.homeless === 0, progress: (s) => `${s.stats.housed}/${s.stats.housed + s.stats.homeless}` },
      { id: 'depot', text: 'Построить склад сбора', check: (s) => built(s, 'depot') },
      { id: 'food', text: 'Построить хижину охотников и столовую', check: (s) => built(s, 'lodge') && built(s, 'canteen') },
    ],
  },
  {
    id: 'settle', title: 'Обустройство', subtitle: 'Наладьте жизнь города',
    objectives: [
      { id: 'workshop', text: 'Построить мастерскую', check: (s) => built(s, 'workshop') },
      { id: 'research2', text: 'Изучить 2 технологии', check: (s) => s.researched.length >= 2, progress: (s) => `${Math.min(2, s.researched.length)}/2` },
      { id: 'medic', text: 'Построить медпункт', check: (s) => built(s, 'aid', 'hospital') },
      { id: 'coal300', text: 'Запасти 300 угля', check: (s) => s.resources.coal >= 300, progress: (s) => `${Math.floor(Math.min(300, s.resources.coal))}/300` },
    ],
  },
  {
    id: 'industry', title: 'Промышленность', subtitle: 'Город должен кормить генератор сам',
    objectives: [
      { id: 'mine', text: 'Построить угольный бур или шахту', check: (s) => built(s, 'drill', 'coalMine') },
      { id: 'coalStorage', text: 'Построить угольный склад', check: (s) => built(s, 'coalStorage') },
      { id: 'laws3', text: 'Подписать 3 закона', check: (s) => s.laws.length >= 3, progress: (s) => `${Math.min(3, s.laws.length)}/3` },
      { id: 'warm', text: 'Средний уровень тепла в домах — «Прохладно» и выше', check: (s) => s.stats.housed > 0 && s.stats.homeHeatAvg >= 3 },
    ],
  },
  {
    id: 'storm', title: 'Перед бурей', subtitle: 'Великая буря приближается',
    objectives: [
      { id: 'coal800', text: 'Запасти 800 угля', check: (s) => s.resources.coal >= 800, progress: (s) => `${Math.floor(Math.min(800, s.resources.coal))}/800` },
      { id: 'storages2', text: 'Иметь 2 угольных склада', check: (s) => builtCount(s, 'coalStorage') >= 2, progress: (s) => `${Math.min(2, builtCount(s, 'coalStorage'))}/2` },
      { id: 'genPower', text: 'Изучить «Усиленный котёл»', check: (s) => s.researched.includes('genPower') },
      { id: 'healthy', text: 'Меньше 5 больных', check: (s) => s.sick + s.gravelyIll < 5 },
    ],
  },
]

/** First stage that still has unfinished objectives, or null when everything is done. */
export function currentStage(s: GameState): Stage | null {
  return STAGES.find((st) => st.objectives.some((o) => !s.objectivesDone.includes(o.id))) ?? null
}

/** Marks objectives of the current stage as done and rewards the player. */
export function checkObjectives(s: GameState) {
  const stage = currentStage(s)
  if (!stage || s.status !== 'playing') return
  let changed = false
  for (const o of stage.objectives) {
    if (s.objectivesDone.includes(o.id) || !o.check(s)) continue
    s.objectivesDone.push(o.id)
    s.hope = clamp(s.hope + 1, 0, 100)
    addLog(s, `Задание выполнено: ${o.text}.`, 'good')
    changed = true
  }
  if (changed && stage.objectives.every((o) => s.objectivesDone.includes(o.id))) {
    s.hope = clamp(s.hope + 5, 0, 100)
    s.discontent = clamp(s.discontent - 5, 0, 100)
    addLog(s, `Этап «${stage.title}» завершён. Люди воодушевлены.`, 'good')
  }
}
