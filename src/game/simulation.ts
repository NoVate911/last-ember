import { BASE_STORAGE, BUILDERS_PER_SITE, BUILDINGS, CEMETERY_CAPACITY, EVENING_END, EVENING_START, HEAT_LEVELS, MEAL_HOUR, PILE_NAMES, SCHOOL_CAPACITY, SECONDS_PER_HOUR, STUDY_HOURS_PER_ENGINEER, WORK_END, EXTENDED_END, WORK_START, generatorCoalPerHour, outsideTemp, tempToLevel } from './data'
import type { Building, GameState, LogEntry, ResourceKey } from './types'

export const RELAY_RADIUS = 11
export const DEPOT_RADIUS = 15

export function has(s: GameState, id: string): boolean {
  return s.researched.includes(id) || s.laws.includes(id)
}

export function totalPop(s: GameState): number {
  return s.pop.workers + s.pop.engineers + s.pop.children
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** Stochastic rounding: 2.3 -> 2 (70%) or 3 (30%) */
export function sr(x: number): number {
  const f = Math.floor(x)
  return f + (Math.random() < x - f ? 1 : 0)
}

export function addLog(s: GameState, text: string, tone: LogEntry['tone'] = 'info') {
  s.log.unshift({ id: s.nextId++, time: s.time, text, tone })
  if (s.log.length > 40) s.log.length = 40
}

/** Storage capacity per resource: base plus every finished warehouse. */
export function storageCaps(s: GameState): Record<ResourceKey, number> {
  const caps = { ...BASE_STORAGE }
  for (const b of s.buildings) {
    if (!b.built) continue
    const extra = BUILDINGS[b.type].storage
    if (!extra) continue
    for (const k of Object.keys(extra) as ResourceKey[]) caps[k] += extra[k] ?? 0
  }
  return caps
}

/** Free space left for a resource. */
export function roomFor(s: GameState, key: ResourceKey): number {
  return Math.max(0, s.stats.caps[key] - s.resources[key])
}

/** Add up to `amount`, limited by storage. Returns what was actually stored. */
export function addRes(s: GameState, key: ResourceKey, amount: number): number {
  const added = Math.max(0, Math.min(amount, roomFor(s, key)))
  s.resources[key] += added
  return added
}

export function clampToStorage(s: GameState) {
  for (const k of Object.keys(s.resources) as ResourceKey[]) {
    s.resources[k] = Math.min(s.resources[k], s.stats.caps[k])
  }
}

export function isWorkHour(s: GameState, hour: number): boolean {
  const end = s.shiftMode === 'extended' && s.laws.includes('longShifts') ? EXTENDED_END : WORK_END
  return hour >= WORK_START && hour < end
}

export function availableWorkers(s: GameState): number {
  return s.pop.workers + (s.laws.includes('youthLabor') ? s.pop.children : 0)
}

export function assignedOf(s: GameState, kind: 'workers' | 'engineers'): number {
  let n = 0
  for (const b of s.buildings) if (BUILDINGS[b.type].workerKind === kind) n += b.assigned
  if (kind === 'workers') for (const p of s.piles) n += p.assigned
  return n
}

/** Unassign people when the labor pool shrinks (deaths, law changes). */
export function reconcileWorkforce(s: GameState) {
  let over = assignedOf(s, 'workers') - availableWorkers(s)
  for (const p of s.piles) {
    if (over <= 0) break
    const take = Math.min(p.assigned, over)
    p.assigned -= take
    over -= take
  }
  for (let i = s.buildings.length - 1; i >= 0 && over > 0; i--) {
    const b = s.buildings[i]!
    if (BUILDINGS[b.type].workerKind !== 'workers') continue
    const take = Math.min(b.assigned, over)
    b.assigned -= take
    over -= take
  }
  let overE = assignedOf(s, 'engineers') - s.pop.engineers
  for (let i = s.buildings.length - 1; i >= 0 && overE > 0; i--) {
    const b = s.buildings[i]!
    if (BUILDINGS[b.type].workerKind !== 'engineers') continue
    const take = Math.min(b.assigned, overE)
    b.assigned -= take
    overE -= take
  }
}

function relayActive(s: GameState, b: Building): boolean {
  return b.type === 'relay' && b.built && b.enabled && s.generator.on
}

/** Heat level (0..5) at a world position. */
export function heatAt(s: GameState, x: number, z: number, ring: number, insulation: number, kind: 'home' | 'work' | 'other'): number {
  let lvl = tempToLevel(outsideTemp(s.time))
  const g = s.generator
  if (g.on && ring <= g.rangeRings) lvl += g.level + (g.overdrive ? 1 : 0)
  for (const b of s.buildings) {
    if (relayActive(s, b) && Math.hypot(b.x - x, b.z - z) <= RELAY_RADIUS) {
      lvl += 1
      break
    }
  }
  if (kind === 'home' && has(s, 'insulation')) lvl += 1
  if (kind === 'work' && has(s, 'heaters')) lvl += 1
  return clamp(lvl + insulation, 0, HEAT_LEVELS.length - 1)
}

export function buildingHeat(s: GameState, b: Building): number {
  const def = BUILDINGS[b.type]
  const ring = s.cells.get(b.cellId)?.ring ?? 9
  const kind = def.capacity ? 'home' : def.workerKind ? 'work' : 'other'
  return heatAt(s, b.x, b.z, ring, def.insulation, kind)
}

/** Remove n citizens, spread across population groups. */
export function killPeople(s: GameState, n: number, cause: string) {
  let left = Math.min(n, totalPop(s))
  if (left <= 0) return
  const killed = left
  while (left > 0) {
    const pool = totalPop(s)
    if (pool <= 0) break
    const r = Math.random() * pool
    if (r < s.pop.workers) s.pop.workers--
    else if (r < s.pop.workers + s.pop.engineers) s.pop.engineers--
    else s.pop.children--
    left--
  }
  s.deaths += killed
  s.corpses += killed
  const hopeLoss = killed * 2 * (s.laws.includes('burial') ? 0.5 : 1)
  s.hope = clamp(s.hope - hopeLoss, 0, 100)
  s.discontent = clamp(s.discontent + killed * 0.6, 0, 100)
  addLog(s, `Погибших: ${killed} (${cause}).`, 'bad')
  const pop = totalPop(s)
  s.sick = Math.min(s.sick, pop)
  s.gravelyIll = Math.min(s.gravelyIll, pop - s.sick)
  s.hungry = Math.min(s.hungry, pop)
  reconcileWorkforce(s)
}

const WORK_SICK = [0.01, 0.005, 0.0018, 0.0005, 0, 0]
const HOME_SICK = [0.014, 0.007, 0.0025, 0.0006, 0, 0]

/** Person-hours citizens actually spent at a workplace during the last hour. */
export function hoursOnSite(map: Record<string, number>, cellId: string): number {
  return (map[cellId] ?? 0) / SECONDS_PER_HOUR
}

export function runHour(s: GameState) {
  s.stats.caps = storageCaps(s)
  const hour = Math.round(s.time) % 24
  // The hour that just ended: citizens worked (or not) during it
  const working = isWorkHour(s, (hour + 23) % 24)
  const pop = totalPop(s)
  const sickMult = s.laws.includes('fillers') ? 1.25 : 1
  let newSick = 0

  // 1. Construction: progress only with builders on site
  for (const b of s.buildings) {
    if (b.built) continue
    const crew = Math.min(BUILDERS_PER_SITE, hoursOnSite(s.buildPresence, b.cellId))
    b.present = Math.round(crew)
    b.active = false
    if (crew < 0.05) { b.status = working ? 'Ждёт свободных строителей' : 'Стройка стоит: вне смены'; continue }
    b.progress += crew / BUILDERS_PER_SITE
    b.status = 'Идёт строительство'
    if (b.progress >= BUILDINGS[b.type].buildHours) {
      b.built = true
      b.progress = BUILDINGS[b.type].buildHours
      b.present = 0
      addLog(s, `Построено: ${BUILDINGS[b.type].name}.`, 'good')
    }
  }

  // 2. Generator
  const g = s.generator
  const relays = s.buildings.filter((b) => b.type === 'relay' && b.built && b.enabled).length
  const coalNeed = g.on ? generatorCoalPerHour(g.level, g.overdrive) + relays : 0
  s.stats.coalPerHour = coalNeed
  if (g.on) {
    if (s.resources.coal >= coalNeed) {
      s.resources.coal -= coalNeed
    } else {
      s.resources.coal = 0
      g.on = false
      g.overdrive = false
      addLog(s, 'В генераторе кончился уголь — он остыл!', 'bad')
    }
  }
  if (g.on && g.overdrive) {
    g.stress = clamp(g.stress + 6, 0, 100)
    if (g.stress >= 100) {
      s.status = 'lost'
      s.endReason = 'Котёл генератора разорвало от перегрузки. Сердце города погибло.'
      return
    }
    if (g.stress >= 70) addLog(s, `Критическое давление в котле: ${Math.round(g.stress)}%`, 'bad')
  } else {
    g.stress = clamp(g.stress - 4, 0, 100)
  }

  // 3. Heat for all buildings
  for (const b of s.buildings) b.heat = buildingHeat(s, b)

  // 4. Work: output depends on the people who actually showed up
  let research = 0
  for (const b of s.buildings) {
    const def = BUILDINGS[b.type]
    if (!b.built) continue
    b.active = false
    if (!def.workerKind) {
      if (b.type === 'relay') {
        b.active = relayActive(s, b)
        b.status = b.active ? 'Обогревает' : 'Простаивает'
      }
      if (def.storage) {
        b.active = true
        b.status = 'Хранилище'
      }
      continue
    }
    if (def.capacity) continue
    if (b.type === 'aid' || b.type === 'hospital') continue
    if (b.type === 'cemetery' || b.type === 'arena' || b.type === 'pub') continue
    if (b.type === 'beacon' || b.type === 'school') continue
    if (b.assigned === 0) { b.status = 'Нет рабочих'; b.present = 0; continue }
    const here = hoursOnSite(s.presence, b.cellId)
    b.present = Math.min(b.assigned, Math.round(here))
    const eff = Math.min(b.assigned, here)
    if (eff < 0.05) { b.status = working ? 'Рабочие в пути' : 'Вне смены'; continue }
    b.active = true
    newSick += eff * (WORK_SICK[b.heat] ?? 0) * sickMult
    const produce = (key: ResourceKey, amount: number, label: string) => {
      if (roomFor(s, key) <= 0) { b.status = 'Склады переполнены'; b.active = false; return }
      addRes(s, key, amount)
      b.status = label
    }
    switch (b.type) {
      case 'depot': {
        const rate = eff * 1.2 * (has(s, 'depotPlus') ? 1.4 : 1)
        const near = s.piles
          .filter((p) => p.amount > 0 && roomFor(s, p.kind) > 0 && Math.hypot(p.x - b.x, p.z - b.z) <= DEPOT_RADIUS)
          .sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))
        const target = near[0]
        if (!target) { b.status = 'Нет куч в радиусе или склады полны'; b.active = false; break }
        const take = addRes(s, target.kind, Math.min(rate, target.amount))
        target.amount -= take
        b.status = `Доставка: ${PILE_NAMES[target.kind]}`
        break
      }
      case 'drill': produce('coal', eff * 1.5, 'Добыча угля'); break
      case 'coalMine': produce('coal', eff * 2.0, 'Добыча угля в шахте'); break
      case 'oreMine': produce('steel', eff * 0.9, 'Добыча руды'); break
      case 'sawmill': produce('wood', eff * 0.8, 'Заготовка леса'); break
      case 'steelworks': produce('steel', eff * 0.5, 'Плавка стали'); break
      case 'lodge': produce('rawFood', eff * 0.3 * (has(s, 'huntGear') ? 1.5 : 1), 'Охота'); break
      case 'canteen': {
        const ratio = s.laws.includes('fillers') ? 3 : s.laws.includes('broth') ? 2.5 : 2
        const raw = Math.min(s.resources.rawFood, eff * 1.5, roomFor(s, 'rations') / ratio)
        s.resources.rawFood -= raw
        s.resources.rations += raw * ratio
        b.status = raw > 0 ? 'Готовка' : roomFor(s, 'rations') <= 0 ? 'Склады переполнены' : 'Нет сырой еды'
        b.active = raw > 0
        break
      }
      case 'workshop':
        if (s.researching) { research += eff; b.status = 'Исследование' } else { b.status = 'Исследование не выбрано'; b.active = false }
        break
      default: break
    }
  }
  for (const p of s.piles) {
    if (p.assigned === 0 || p.amount <= 0) { if (p.amount <= 0) p.assigned = 0; continue }
    const eff = Math.min(p.assigned, hoursOnSite(s.presence, p.cellId))
    if (eff < 0.05) continue
    const cell = s.cells.get(p.cellId)
    const heat = heatAt(s, p.x, p.z, cell?.ring ?? 9, 0, 'other')
    newSick += eff * (WORK_SICK[heat] ?? 0) * sickMult
    const take = Math.min(eff * 0.8, p.amount)
    p.amount -= addRes(s, p.kind, take)
  }
  s.stats.researchPerHour = research

  // 4b. Society: cemetery, arena, pub; beacon and school
  runSociety(s, hour, working, pop)
  runSchools(s, working)

  // 5. Research
  if (s.researching && research > 0) {
    s.researchProgress += research
  }

  // 6. Housing & night sickness
  const homes = s.buildings.filter((b) => b.built && BUILDINGS[b.type].capacity).sort((a, c) => c.heat - a.heat)
  let toHouse = pop
  let heatSum = 0
  let coldHomes = 0
  const night = hour >= 20 || hour < 6
  const childShare = pop > 0 ? s.pop.children / pop : 0
  const childFactor = s.laws.includes('shelters') ? 1 - childShare * 0.7 : 1
  for (const b of homes) {
    const n = Math.min(BUILDINGS[b.type].capacity ?? 0, toHouse)
    toHouse -= n
    heatSum += b.heat * n
    if (b.heat <= 1) coldHomes += n
    if (night) newSick += n * (HOME_SICK[b.heat] ?? 0) * sickMult * childFactor
    b.residents = n
    b.active = n > 0
    b.status = n > 0 ? `Жильцов: ${n}` : 'Пусто'
  }
  const outsideLvl = clamp(tempToLevel(outsideTemp(s.time)), 0, 5)
  if (night) newSick += toHouse * ((HOME_SICK[outsideLvl] ?? 0) + 0.004) * sickMult * childFactor
  if (s.hungry > 0) newSick += s.hungry * 0.002
  s.stats.housed = pop - toHouse
  s.stats.homeless = toHouse
  s.stats.coldHomes = coldHomes + toHouse
  s.stats.homeHeatAvg = pop - toHouse > 0 ? heatSum / (pop - toHouse) : 0

  const healthy = Math.max(0, pop - s.sick - s.gravelyIll)
  const gotSick = Math.min(healthy, sr(newSick))
  if (gotSick > 0) {
    s.sick += gotSick
    if (gotSick >= 3) addLog(s, `Заболели от холода: ${gotSick}.`, 'warn')
  }

  // 7. Medicine
  const bedMult = s.laws.includes('overflow') ? 1.5 : 1
  const healMult = (s.laws.includes('overflow') ? 0.8 : 1) * (s.laws.includes('healers') ? 1.3 : 1)
  let hospitalBeds = 0
  let aidBeds = 0
  for (const b of s.buildings) {
    if (!b.built) continue
    const def = BUILDINGS[b.type]
    if (b.type !== 'aid' && b.type !== 'hospital') continue
    const beds = Math.floor((b.type === 'hospital' ? 10 : 5) * (b.assigned / (def.maxWorkers ?? 1)) * bedMult)
    if (b.type === 'hospital') hospitalBeds += beds
    else aidBeds += beds
    b.active = beds > 0
    b.status = beds > 0 ? `Коек с персоналом: ${beds}` : 'Нет персонала'
  }
  const gravelyTreatedH = Math.min(s.gravelyIll, hospitalBeds)
  let freeBeds = hospitalBeds - gravelyTreatedH + aidBeds
  let gravelyTreatedA = 0
  if (s.laws.includes('amputation')) {
    gravelyTreatedA = Math.min(s.gravelyIll - gravelyTreatedH, aidBeds)
    freeBeds -= gravelyTreatedA
  }
  const sickTreated = Math.min(s.sick, freeBeds)
  s.stats.treated = gravelyTreatedH + gravelyTreatedA + sickTreated

  const warmHomes = s.stats.homeHeatAvg >= 4
  const recovered = Math.min(s.sick, sr(sickTreated * 0.07 * healMult + (s.sick - sickTreated) * (warmHomes ? 0.01 : 0.002)))
  s.sick -= recovered
  const curedH = sr(gravelyTreatedH * 0.04 * healMult)
  const amputated = sr(gravelyTreatedA * 0.05)
  const worsened = Math.min(s.sick, sr((s.sick - Math.min(s.sick, sickTreated)) * 0.006))
  s.sick -= worsened
  s.gravelyIll += worsened
  s.gravelyIll -= Math.min(s.gravelyIll, curedH + amputated)
  if (amputated > 0) {
    s.amputees += amputated
    s.hope = clamp(s.hope - amputated * 0.8, 0, 100)
    addLog(s, `Ампутация спасла пациентов: ${amputated}.`, 'warn')
  }
  const untreatedGrave = Math.max(0, s.gravelyIll - gravelyTreatedH - gravelyTreatedA)
  const deathRate = s.laws.includes('lifeSupport') ? 0.004 : 0.008
  const died = Math.min(s.gravelyIll, sr(untreatedGrave * deathRate + (gravelyTreatedH + gravelyTreatedA) * 0.0015))
  if (died > 0) {
    s.gravelyIll -= died
    killPeople(s, died, 'болезни')
  }

  // 8. Meal
  if (hour === MEAL_HOUR) {
    const need = totalPop(s)
    if (s.resources.rations >= need) {
      s.resources.rations -= need
      if (s.hungry > 0) addLog(s, 'Сегодня все поели.', 'good')
      s.hungry = 0
      s.hungerStreak = 0
    } else {
      const unfed = Math.ceil(need - s.resources.rations)
      s.resources.rations = 0
      s.hungry = unfed
      s.hungerStreak += 1
      s.discontent = clamp(s.discontent + 3 + (unfed / Math.max(1, need)) * 6, 0, 100)
      addLog(s, `Легли спать голодными: ${unfed}.`, 'bad')
      if (s.hungerStreak >= 2) killPeople(s, Math.max(1, sr(unfed * 0.08)), 'голод')
    }
  }

  // 9. Hope & discontent drift
  const p2 = Math.max(1, totalPop(s))
  let dDisc = -0.08
  if (night) dDisc += (s.stats.homeless / p2) * 0.5 + (s.stats.coldHomes / p2) * 0.25
  if (s.shiftMode === 'extended' && s.laws.includes('longShifts') && hour >= WORK_END && hour < EXTENDED_END) dDisc += 0.35
  if (s.laws.includes('broth')) dDisc += 0.03
  if (s.laws.includes('fillers')) dDisc += 0.05
  if (s.laws.includes('overflow')) dDisc += 0.01
  if (s.laws.includes('watch')) dDisc -= 0.1
  if (s.laws.includes('vigil')) dDisc -= 0.04
  if (s.hungry > 0) dDisc += 0.15
  if (s.corpses >= 0.5) dDisc += Math.min(0.3, s.corpses * 0.008)
  s.discontent = clamp(s.discontent + dDisc, 0, 100)

  let dHope = 0
  if (s.corpses >= 0.5) dHope -= Math.min(0.15, s.corpses * 0.004)
  dHope -= ((s.sick + s.gravelyIll) / p2) * 0.25
  if (warmHomes && s.stats.homeless === 0) dHope += 0.06
  if (s.stats.homeless / p2 > 0.3) dHope -= 0.05
  if (s.laws.includes('broadcast')) dHope += 0.08
  if (s.laws.includes('vigil')) dHope += 0.06
  if (!s.generator.on) dHope -= 0.08
  s.hope = clamp(s.hope + dHope, 0, 100)

  // 10. Hourly snapshot for resource trends
  clampToStorage(s)
  s.history.push({ ...s.resources })
  if (s.history.length > 25) s.history.shift()
  // Presence has been consumed: start counting the next hour
  s.presence = {}
  s.buildPresence = {}
  s.studyPresence = {}
}

/** Teachers on site + pupils in class = study hours; enough of them turn a child into an engineer. */
function runSchools(s: GameState, working: boolean) {
  const youth = s.laws.includes('youthLabor')
  for (const b of s.buildings) {
    if (!b.built) continue
    if (b.type === 'beacon') {
      const max = BUILDINGS.beacon.maxWorkers ?? 5
      b.active = s.expedition !== null
      b.present = s.expedition ? 0 : b.assigned
      b.status = s.expedition ? 'Разведчики в пути' : b.assigned >= max ? 'Отряд готов к выходу' : `Нужно ${max} разведчиков`
      continue
    }
    if (b.type !== 'school') continue
    b.active = false
    const teachers = hoursOnSite(s.presence, b.cellId)
    const pupils = Math.min(SCHOOL_CAPACITY, hoursOnSite(s.studyPresence, b.cellId))
    b.present = Math.round(teachers)
    b.stored = Math.round(pupils)
    if (youth) { b.status = 'Закрыта: дети работают'; continue }
    if (b.assigned === 0) { b.status = 'Нет учителей'; continue }
    if (teachers < 0.05) { b.status = working ? 'Учителя в пути' : 'Уроки окончены'; continue }
    if (pupils < 0.05) { b.status = s.pop.children > 0 ? 'Ждёт учеников' : 'Некого учить'; continue }
    const staffed = Math.min(1, teachers / (BUILDINGS.school.maxWorkers ?? 3))
    s.studyProgress += pupils * staffed
    s.hope = clamp(s.hope + 0.01 * staffed, 0, 100)
    b.active = true
    b.status = 'Идут уроки'
  }
  while (s.studyProgress >= STUDY_HOURS_PER_ENGINEER && s.pop.children > 0) {
    s.studyProgress -= STUDY_HOURS_PER_ENGINEER
    s.pop.children--
    s.pop.engineers++
    s.hope = clamp(s.hope + 1, 0, 100)
    addLog(s, 'Выпускник школы стал инженером.', 'good')
  }
  if (s.pop.children === 0) s.studyProgress = 0
}

function runSociety(s: GameState, hour: number, working: boolean, pop: number) {
  const evening = hour >= EVENING_START && hour < EVENING_END
  let gravediggers = 0
  for (const b of s.buildings) {
    if (!b.built) continue
    const f = b.assigned / (BUILDINGS[b.type].maxWorkers ?? 1)
    if (b.type === 'cemetery') {
      gravediggers += b.assigned
      if (b.assigned === 0) { b.status = 'Нет могильщиков'; continue }
      if (b.stored >= CEMETERY_CAPACITY) { b.status = 'Кладбище заполнено'; continue }
      if (s.corpses < 0.5) { b.status = `Могил: ${Math.floor(b.stored)}/${CEMETERY_CAPACITY}`; continue }
      const diggers = Math.min(b.assigned, hoursOnSite(s.presence, b.cellId))
      b.present = Math.round(diggers)
      if (diggers < 0.05) { b.status = working ? 'Могильщики в пути' : 'Вне смены'; continue }
      const bury = Math.min(s.corpses, diggers * 0.5, CEMETERY_CAPACITY - b.stored)
      s.corpses -= bury
      b.stored += bury
      b.active = true
      b.status = 'Идут похороны'
    } else if (b.type === 'arena') {
      if (b.assigned === 0) { b.status = 'Нет бойцов'; continue }
      if (!evening) { b.status = 'Бои начнутся вечером'; continue }
      b.active = true
      b.status = 'Идут бои'
      s.discontent = clamp(s.discontent - 0.14 * f, 0, 100)
      const healthy = pop - s.sick - s.gravelyIll
      if (healthy > 0 && Math.random() < 0.05 * f) {
        s.sick += 1
        addLog(s, 'На арене покалечили бойца.', 'warn')
      }
    } else if (b.type === 'pub') {
      if (b.assigned === 0) { b.status = 'Нет персонала'; continue }
      if (!evening) { b.status = 'Откроется вечером'; continue }
      const use = 0.5 * f
      if (s.resources.rawFood < use) { b.status = 'Нет сырой еды'; continue }
      s.resources.rawFood -= use
      b.active = true
      b.status = 'Открыт'
      s.discontent = clamp(s.discontent - 0.08 * f, 0, 100)
      s.hope = clamp(s.hope + 0.04 * f, 0, 100)
    }
  }
  // Without gravediggers, bodies are slowly carried out into the snow
  if (gravediggers === 0 && s.corpses > 0) s.corpses = Math.max(0, s.corpses - Math.max(0.25, s.corpses * 0.03))
}
