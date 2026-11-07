import type { BuildingDef, BuildingType, BuildCategory, PileKind } from './types'

export const GAME_TITLE = 'ПОСЛЕДНИЙ ЖАР'
export const GAME_SUBTITLE = 'Город на краю света'

export const START_HOUR = 8
export const FINAL_DAY = 21 // the city wins when day 21 dawns
export const STORM_START_DAY = 18
export const LAW_COOLDOWN_HOURS = 18
export const WORK_START = 8
export const WORK_END = 18
export const EXTENDED_END = 22
export const MEAL_HOUR = 19

export const HEAT_LEVELS = [
  { name: 'Лютый мороз', color: '#1e3a8a' },
  { name: 'Очень холодно', color: '#2f6fd6' },
  { name: 'Холодно', color: '#8ec5ff' },
  { name: 'Прохладно', color: '#f2d27a' },
  { name: 'Комфортно', color: '#f59a3c' },
  { name: 'Тепло', color: '#e2552d' },
] as const

/** Resource name used inside sentences */
export const PILE_NAMES: Record<PileKind, string> = { coal: 'уголь', wood: 'дерево', steel: 'сталь' }
/** Title shown for a resource heap */
export const PILE_TITLES: Record<PileKind, string> = { coal: 'Куча угля', wood: 'Обломки древесины', steel: 'Груда металлолома' }

export const BUILDINGS: Record<BuildingType, BuildingDef> = {
  tent: {
    type: 'tent', name: 'Палатка', category: 'housing', buildHours: 2,
    description: 'Дешёвое укрытие на 10 человек. От холода не защищает.',
    cost: { wood: 10 }, capacity: 10, insulation: 0,
  },
  bunkhouse: {
    type: 'bunkhouse', name: 'Деревянный барак', category: 'housing', buildHours: 4,
    description: 'Дощатые стены и печка. 10 жильцов. +1 к теплу.',
    cost: { wood: 20, steel: 5 }, capacity: 10, insulation: 1, requires: 'bunkhouse',
  },
  house: {
    type: 'house', name: 'Каменный дом', category: 'housing', buildHours: 6,
    description: 'Толстые каменные стены. 10 жильцов. +2 к теплу.',
    cost: { wood: 30, steel: 10 }, capacity: 10, insulation: 2, requires: 'house',
  },
  depot: {
    type: 'depot', name: 'Склад сбора', category: 'resources', buildHours: 3,
    description: 'Носильщики собирают ресурсы со всех куч в радиусе. 5 рабочих.',
    cost: { wood: 15 }, insulation: 0, workerKind: 'workers', maxWorkers: 5,
  },
  drill: {
    type: 'drill', name: 'Угольный бур', category: 'resources', buildHours: 8,
    description: 'Выбивает уголь из мёрзлой земли. Запас не кончается. 10 рабочих.',
    cost: { wood: 30, steel: 15 }, insulation: 0, workerKind: 'workers', maxWorkers: 10, requires: 'drill',
  },
  sawmill: {
    type: 'sawmill', name: 'Ледяная лесопилка', category: 'resources', buildHours: 6,
    description: 'Валит промёрзший лес на краю кратера. 10 рабочих.',
    cost: { wood: 20, steel: 10 }, insulation: 0, workerKind: 'workers', maxWorkers: 10, requires: 'sawmill',
  },
  steelworks: {
    type: 'steelworks', name: 'Литейная', category: 'resources', buildHours: 8,
    description: 'Выплавляет сталь из рудного лома. 10 рабочих.',
    cost: { wood: 40, steel: 10 }, insulation: 1, workerKind: 'workers', maxWorkers: 10, requires: 'steelworks',
  },
  lodge: {
    type: 'lodge', name: 'Хижина охотников', category: 'food', buildHours: 3,
    description: 'Охотники приносят сырое мясо из ледяной пустоши. 10 рабочих.',
    cost: { wood: 20 }, insulation: 0, workerKind: 'workers', maxWorkers: 10,
  },
  canteen: {
    type: 'canteen', name: 'Столовая', category: 'food', buildHours: 4,
    description: 'Готовит пайки из сырой еды (1 сырая = 2 пайка). 5 рабочих.',
    cost: { wood: 25 }, insulation: 1, workerKind: 'workers', maxWorkers: 5,
  },
  aid: {
    type: 'aid', name: 'Медпункт', category: 'health', buildHours: 4,
    description: 'Лечит 5 больных. Нужно 5 инженеров.',
    cost: { wood: 30 }, insulation: 0, workerKind: 'engineers', maxWorkers: 5,
  },
  hospital: {
    type: 'hospital', name: 'Больница', category: 'health', buildHours: 8,
    description: 'Лечит 10 пациентов, в том числе тяжелобольных. 10 инженеров.',
    cost: { wood: 40, steel: 20 }, insulation: 1, workerKind: 'engineers', maxWorkers: 10, requires: 'hospital',
  },
  relay: {
    type: 'relay', name: 'Тепловой узел', category: 'heat', buildHours: 4,
    description: 'Подаёт пар к соседним зданиям (+1 к теплу). Сжигает 1 уголь в час.',
    cost: { wood: 30, steel: 10 }, insulation: 0, requires: 'relay',
  },
  workshop: {
    type: 'workshop', name: 'Мастерская', category: 'tech', buildHours: 4,
    description: 'Инженеры разрабатывают новые технологии. 5 инженеров.',
    cost: { wood: 30 }, insulation: 1, workerKind: 'engineers', maxWorkers: 5,
  },
}

export const CATEGORIES: { id: BuildCategory; label: string }[] = [
  { id: 'housing', label: 'Жильё' },
  { id: 'resources', label: 'Ресурсы' },
  { id: 'food', label: 'Еда' },
  { id: 'health', label: 'Здоровье' },
  { id: 'heat', label: 'Тепло' },
  { id: 'tech', label: 'Технологии' },
]

export interface ResearchDef {
  id: string
  name: string
  description: string
  points: number
  cost: { wood?: number; steel?: number }
  requires?: string
  tier: number
}

export const RESEARCH: ResearchDef[] = [
  { id: 'heaters', name: 'Печи на рабочих местах', tier: 1, points: 40, cost: { wood: 20 }, description: 'Все рабочие места получают +1 к теплу.' },
  { id: 'bunkhouse', name: 'Деревянные бараки', tier: 1, points: 40, cost: { wood: 20 }, description: 'Открывает утеплённые бараки (+1 к теплу).' },
  { id: 'depotPlus', name: 'Грузовые сани', tier: 1, points: 35, cost: { wood: 15 }, description: 'Склады сбора работают на 40% быстрее.' },
  { id: 'huntGear', name: 'Охотничье снаряжение', tier: 1, points: 45, cost: { wood: 20 }, description: 'Хижины охотников приносят на 50% больше еды.' },
  { id: 'relay', name: 'Тепловой узел', tier: 2, points: 55, cost: { wood: 20, steel: 5 }, requires: 'heaters', description: 'Открывает тепловые узлы, которые греют здания вокруг.' },
  { id: 'sawmill', name: 'Ледяная лесопилка', tier: 2, points: 50, cost: { wood: 15, steel: 5 }, description: 'Открывает ледяную лесопилку.' },
  { id: 'drill', name: 'Угольный бур', tier: 2, points: 60, cost: { wood: 20, steel: 5 }, description: 'Открывает угольный бур.' },
  { id: 'house', name: 'Каменные дома', tier: 2, points: 75, cost: { wood: 30, steel: 10 }, requires: 'bunkhouse', description: 'Открывает каменные дома (+2 к теплу).' },
  { id: 'genRange', name: 'Напорные трубы', tier: 2, points: 80, cost: { wood: 30, steel: 15 }, description: 'Радиус тепла генератора +2 кольца.' },
  { id: 'steelworks', name: 'Литейная', tier: 3, points: 70, cost: { wood: 25, steel: 10 }, requires: 'sawmill', description: 'Открывает литейную.' },
  { id: 'hospital', name: 'Больница', tier: 3, points: 80, cost: { wood: 25, steel: 15 }, requires: 'heaters', description: 'Открывает больницу, где вылечивают тяжелобольных.' },
  { id: 'genPower', name: 'Усиленный котёл', tier: 3, points: 100, cost: { wood: 40, steel: 25 }, requires: 'genRange', description: 'Открывает 3-й и 4-й уровни мощности генератора.' },
  { id: 'insulation', name: 'Утепление стен', tier: 3, points: 90, cost: { wood: 30, steel: 15 }, requires: 'house', description: 'Все жилые дома получают +1 к теплу.' },
  { id: 'genRange2', name: 'Дальние трубы', tier: 4, points: 120, cost: { wood: 40, steel: 30 }, requires: 'genPower', description: 'Радиус тепла генератора ещё +2 кольца.' },
]

export interface LawDef {
  id: string
  name: string
  group: 'adaptation' | 'purpose'
  description: string
  excludes?: string[]
  requires?: string
}

export const LAWS: LawDef[] = [
  { id: 'youthLabor', group: 'adaptation', name: 'Трудовая программа для подростков', excludes: ['shelters'], description: 'Дети работают наравне с рабочими. Надежда −8.' },
  { id: 'shelters', group: 'adaptation', name: 'Детский приют', excludes: ['youthLabor'], description: 'Детей берегут и держат в тепле — они болеют гораздо реже. Надежда +4.' },
  { id: 'longShifts', group: 'adaptation', name: 'Длинные смены', description: 'Рабочий день можно продлить до 22:00. Пока смены длинные, растёт недовольство.' },
  { id: 'broth', group: 'adaptation', name: 'Жидкая похлёбка', excludes: ['fillers'], description: 'Столовые делают 2,5 пайка из 1 сырой еды. Немного растёт недовольство.' },
  { id: 'fillers', group: 'adaptation', name: 'Опилки в еде', excludes: ['broth'], description: 'Столовые делают 3 пайка из 1 сырой еды. Больше болезней и недовольства.' },
  { id: 'amputation', group: 'adaptation', name: 'Экстренная ампутация', excludes: ['lifeSupport'], description: 'Медпункты могут лечить тяжелобольных. Каждое такое лечение немного снижает надежду.' },
  { id: 'lifeSupport', group: 'adaptation', name: 'Поддержание жизни', excludes: ['amputation'], description: 'Тяжелобольные, ожидающие лечения, умирают вдвое реже.' },
  { id: 'overflow', group: 'adaptation', name: 'Дополнительные койки', description: 'Медицинские здания принимают на 50% больше пациентов, но лечат медленнее.' },
  { id: 'burial', group: 'adaptation', name: 'Кладбище', description: 'Смерти снижают надежду вдвое меньше.' },
  { id: 'pathOrder', group: 'purpose', name: 'Путь дисциплины', excludes: ['pathFaith'], description: 'Единство через порядок. Недовольство сразу −10.' },
  { id: 'watch', group: 'purpose', name: 'Ночной дозор', requires: 'pathOrder', description: 'Патрули поддерживают порядок. Недовольство постепенно снижается.' },
  { id: 'broadcast', group: 'purpose', name: 'Городское вещание', requires: 'pathOrder', description: 'Громкоговорители сообщают о каждом успехе. Надежда постепенно растёт.' },
  { id: 'pathFaith', group: 'purpose', name: 'Путь пламени', excludes: ['pathOrder'], description: 'Единство через веру. Надежда сразу +10.' },
  { id: 'vigil', group: 'purpose', name: 'Вечернее бдение', requires: 'pathFaith', description: 'Каждый вечер люди собираются у генератора. Надежда растёт, недовольство падает.' },
  { id: 'healers', group: 'purpose', name: 'Хранители огня', requires: 'pathFaith', description: 'Добровольцы ухаживают за больными. Выздоровление на 30% быстрее.' },
]

/** Base outside temperature for each day, in °C */
const TEMP_BY_DAY = [-20, -20, -25, -30, -30, -40, -30, -35, -40, -50, -45, -40, -50, -55, -60, -50, -60, -90, -110, -100, -70]

export function baseTempForDay(day: number): number {
  const idx = Math.min(Math.max(day - 1, 0), TEMP_BY_DAY.length - 1)
  return TEMP_BY_DAY[idx] ?? -40
}

export function outsideTemp(time: number): number {
  const day = Math.floor(time / 24) + 1
  const hour = time % 24
  const base = baseTempForDay(day)
  // Slightly colder at night
  const nightDip = hour < 6 || hour >= 21 ? -5 : 0
  return base + nightDip
}

export function tempToLevel(t: number): number {
  return Math.floor((t + 60) / 15)
}

export function isStorm(time: number): boolean {
  const day = Math.floor(time / 24) + 1
  return day >= STORM_START_DAY && day < FINAL_DAY
}

export function generatorCoalPerHour(level: number, overdrive: boolean): number {
  const base = 1 + level * 2
  return overdrive ? base * 1.5 : base
}

export function formatTime(time: number): { day: number; clock: string } {
  const day = Math.floor(time / 24) + 1
  const h = Math.floor(time % 24)
  const m = Math.floor(((time % 24) - h) * 60)
  return { day, clock: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
}
