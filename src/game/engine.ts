import { BASE_STORAGE, BUILDINGS, FINAL_DAY, LAWS, LAW_COOLDOWN_HOURS, PILE_NAMES, RESEARCH, SECONDS_PER_HOUR, START_HOUR } from './data'
import { checkEnd, checkEvents, checkPromise, resolveEvent } from './events'
import { buildCells, mulberry32 } from './grid'
import { checkObjectives } from './objectives'
import { type SaveSlot, saveGame } from './save'
import {
  addLog, addRes, assignedOf, availableWorkers, buildingHeat, clamp, reconcileWorkforce, runHour, storageCaps, totalPop,
} from './simulation'
import type { Building, BuildingType, GameState, Pile, PileKind, UiState } from './types'

const HOURS_PER_SECOND = 1 / SECONDS_PER_HOUR
const FINAL_TIME = (FINAL_DAY - 1) * 24 + START_HOUR

function freshUi(): UiState {
  return { placing: null, selected: null, heatOverlay: false, hoverCellId: null, dialog: null, buildOpen: false }
}

function createInitialState(): GameState {
  const cells = buildCells()
  const rand = mulberry32(1337)
  const piles: Pile[] = []
  const kinds: PileKind[] = ['coal', 'coal', 'wood', 'coal', 'wood', 'steel', 'coal', 'wood', 'wood', 'steel', 'coal', 'wood', 'coal', 'steel', 'wood', 'coal', 'wood', 'steel', 'coal', 'wood']
  const candidates = [...cells.values()].filter((c) => c.ring >= 2 && !c.road)
  let id = 1
  for (const kind of kinds) {
    for (let tries = 0; tries < 50; tries++) {
      const c = candidates[Math.floor(rand() * candidates.length)]
      if (!c || c.occupant) continue
      // keep heaps apart from each other
      if (piles.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < 9)) continue
      const range = kind === 'coal' ? [140, 240] : kind === 'wood' ? [110, 190] : [60, 110]
      const amount = Math.round(range[0]! + rand() * (range[1]! - range[0]!))
      piles.push({ id, kind, cellId: c.id, x: c.x, z: c.z, amount, max: amount, assigned: 0 })
      c.occupant = { kind: 'pile', id }
      c.deposit = kind
      id++
      break
    }
  }
  const resources = { coal: 120, wood: 140, steel: 40, rawFood: 30, rations: 60 }
  const s: GameState = {
    time: START_HOUR,
    speed: 0,
    resources,
    history: [{ ...resources }],
    pop: { workers: 45, engineers: 15, children: 20 },
    sick: 0,
    gravelyIll: 0,
    hungry: 0,
    hungerStreak: 0,
    deaths: 0,
    corpses: 0,
    amputees: 0,
    hope: 55,
    discontent: 10,
    generator: { on: false, level: 1, overdrive: false, stress: 0, rangeRings: 4 },
    buildings: [],
    piles,
    cells,
    researched: [],
    researching: null,
    researchProgress: 0,
    laws: [],
    lastLawAt: -999,
    shiftMode: 'normal',
    firedEvents: [],
    objectivesDone: [],
    pendingEvent: null,
    promise: null,
    log: [],
    status: 'playing',
    endReason: '',
    nextId: 1000,
    stats: {
      housed: 0, homeless: 80, homeHeatAvg: 0, coldHomes: 80, coalPerHour: 0,
      researchPerHour: 0, freeWorkers: 45, freeEngineers: 15, treated: 0, caps: { ...BASE_STORAGE },
    },
  }
  addLog(s, 'Выжившие добрались до кратера. Разожгите генератор и постройте укрытия.', 'info')
  return s
}

export type LawStatus = 'signed' | 'available' | 'cooldown' | 'excluded' | 'locked'
export type ResearchStatus = 'done' | 'active' | 'available' | 'locked' | 'unaffordable'

export class Game {
  state: GameState
  ui: UiState = freshUi()
  version = 0
  generation = 0
  private listeners = new Set<() => void>()
  private lastEmit = 0

  constructor() {
    this.state = createInitialState()
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => { this.listeners.delete(fn) }
  }

  emit(force = false) {
    const now = performance.now()
    if (!force && now - this.lastEmit < 150) return
    this.lastEmit = now
    this.version++
    this.listeners.forEach((l) => l())
  }

  restart() {
    this.state = createInitialState()
    this.state.speed = 1
    this.generation++
    this.ui = freshUi()
    this.emit(true)
  }

  /** Replace the running game with a loaded save. The game stays paused. */
  load(state: GameState) {
    this.state = state
    this.state.speed = 0
    this.generation++
    this.ui = freshUi()
    this.refreshStats()
    addLog(this.state, 'Игра загружена.', 'info')
    this.emit(true)
  }

  save(slot: SaveSlot): boolean {
    const ok = saveGame(slot, this.state)
    if (slot !== 'auto') addLog(this.state, ok ? 'Игра сохранена.' : 'Не удалось сохранить игру.', ok ? 'good' : 'bad')
    this.emit(true)
    return ok
  }

  get paused(): boolean {
    const s = this.state
    return s.speed === 0 || s.status !== 'playing' || s.pendingEvent !== null
  }

  update(dtSec: number) {
    const s = this.state
    if (this.paused) { this.emit(); return }
    let dh = Math.min(dtSec, 0.25) * s.speed * HOURS_PER_SECOND
    while (dh > 0 && s.status === 'playing' && !s.pendingEvent) {
      const next = Math.floor(s.time + 1e-9) + 1
      if (s.time + dh >= next) {
        dh -= next - s.time
        s.time = next
        this.tickHour()
      } else {
        s.time += dh
        dh = 0
      }
    }
    this.emit()
  }

  private tickHour() {
    const s = this.state
    runHour(s)
    // Remove exhausted heaps and free their cells
    for (const p of [...s.piles]) {
      if (p.amount > 0.01) continue
      s.piles = s.piles.filter((x) => x.id !== p.id)
      const cell = s.cells.get(p.cellId)
      if (cell) cell.occupant = null
      if (this.ui.selected?.kind === 'pile' && this.ui.selected.id === p.id) this.ui = { ...this.ui, selected: null }
      addLog(s, `Куча исчерпана: ${PILE_NAMES[p.kind]}.`, 'warn')
    }
    // Research completion
    if (s.researching) {
      const def = RESEARCH.find((r) => r.id === s.researching)
      if (def && s.researchProgress >= def.points) {
        s.researched.push(def.id)
        addLog(s, `Исследование завершено: ${def.name}.`, 'good')
        if (def.id === 'genRange') s.generator.rangeRings += 2
        if (def.id === 'genRange2') s.generator.rangeRings += 2
        s.researching = null
        s.researchProgress = 0
      }
    }
    this.refreshStats()
    checkPromise(s)
    checkEvents(s)
    checkEnd(s, FINAL_TIME)
    // Autosave every morning
    if (Math.round(s.time) % 24 === 6 && s.status === 'playing') saveGame('auto', s)
    if (s.hope < 15 && Math.round(s.time) % 6 === 0) addLog(s, 'Надежда угасает. Люди теряют веру.', 'bad')
    if (s.discontent > 85 && Math.round(s.time) % 6 === 0) addLog(s, 'Недовольство на пределе. Изгнание близко.', 'bad')
    this.emit(true)
  }

  refreshStats() {
    const s = this.state
    s.stats.caps = storageCaps(s)
    s.stats.freeWorkers = availableWorkers(s) - assignedOf(s, 'workers')
    s.stats.freeEngineers = s.pop.engineers - assignedOf(s, 'engineers')
    checkObjectives(s)
  }

  setSpeed(speed: number) { this.state.speed = speed; this.emit(true) }

  setUi(patch: Partial<UiState>) {
    this.ui = { ...this.ui, ...patch }
    this.emit(true)
  }

  // ---------- Construction ----------
  isUnlocked(type: BuildingType): boolean {
    return this.lockReason(type) === null
  }

  /** Why a building can't be built yet (missing research or law), or null. */
  lockReason(type: BuildingType): string | null {
    const def = BUILDINGS[type]
    if (def.requires && !this.state.researched.includes(def.requires)) {
      return `Нужно исследование «${RESEARCH.find((r) => r.id === def.requires)?.name ?? def.requires}»`
    }
    if (def.requiresLaw && !this.state.laws.includes(def.requiresLaw)) {
      return `Нужен закон «${LAWS.find((l) => l.id === def.requiresLaw)?.name ?? def.requiresLaw}»`
    }
    return null
  }

  canAfford(type: BuildingType): boolean {
    const c = BUILDINGS[type].cost
    return this.state.resources.wood >= (c.wood ?? 0) && this.state.resources.steel >= (c.steel ?? 0)
  }

  canPlace(type: BuildingType, cellId: string | null): { ok: boolean; reason: string } {
    if (!cellId) return { ok: false, reason: 'Вне сетки города' }
    const cell = this.state.cells.get(cellId)
    if (!cell) return { ok: false, reason: 'Недопустимое место' }
    if (cell.road) return { ok: false, reason: 'Здесь проходит улица' }
    const def = BUILDINGS[type]
    if (def.onDeposit) {
      if (cell.deposit !== def.onDeposit) return { ok: false, reason: 'Нужно месторождение' }
      if (cell.occupant?.kind === 'building') return { ok: false, reason: 'Занято' }
    } else if (cell.occupant) return { ok: false, reason: 'Занято' }
    if (!this.isUnlocked(type)) return { ok: false, reason: this.lockReason(type) ?? 'Закрыто' }
    if (!this.canAfford(type)) return { ok: false, reason: 'Не хватает материалов' }
    return { ok: true, reason: '' }
  }

  place(type: BuildingType, cellId: string): boolean {
    const s = this.state
    const check = this.canPlace(type, cellId)
    const cell = s.cells.get(cellId)
    if (!check.ok || !cell) return false
    const def = BUILDINGS[type]
    s.resources.wood -= def.cost.wood ?? 0
    s.resources.steel -= def.cost.steel ?? 0
    // A mine replaces the heap on its deposit: the remaining heap is hauled to storage
    if (cell.occupant?.kind === 'pile') {
      const pileId = cell.occupant.id
      const pile = s.piles.find((p) => p.id === pileId)
      if (pile) {
        const got = addRes(s, pile.kind, pile.amount)
        s.piles = s.piles.filter((p) => p.id !== pileId)
        addLog(s, `Куча расчищена под шахту: +${Math.floor(got)} (${PILE_NAMES[pile.kind]}).`, 'info')
      }
      if (this.ui.selected?.kind === 'pile' && this.ui.selected.id === pileId) this.ui = { ...this.ui, selected: null }
      cell.occupant = null
    }
    const id = s.nextId++
    const b: Building = {
      id, type, cellId, x: cell.x, z: cell.z, angle: cell.angle, progress: 0, built: false,
      assigned: 0, enabled: true, status: 'Строится', heat: 0, active: false, residents: 0, stored: 0,
    }
    b.heat = buildingHeat(s, b)
    s.buildings.push(b)
    cell.occupant = { kind: 'building', id }
    this.refreshStats()
    this.emit(true)
    return true
  }

  dismantle(id: number) {
    const s = this.state
    const idx = s.buildings.findIndex((b) => b.id === id)
    const b = s.buildings[idx]
    if (!b) return
    const def = BUILDINGS[b.type]
    s.resources.wood += Math.floor((def.cost.wood ?? 0) * 0.5)
    s.resources.steel += Math.floor((def.cost.steel ?? 0) * 0.5)
    s.buildings.splice(idx, 1)
    const cell = s.cells.get(b.cellId)
    if (cell) cell.occupant = null
    addLog(s, `Разобрано: ${def.name}.`, 'info')
    this.ui = { ...this.ui, selected: null }
    this.refreshStats()
    // Losing a warehouse shrinks storage: overflow is lost
    for (const k of Object.keys(s.resources) as (keyof typeof s.resources)[]) {
      s.resources[k] = Math.min(s.resources[k], s.stats.caps[k])
    }
    this.emit(true)
  }

  /** Clamp a requested change to free hands when adding; removing is always allowed. */
  private allowedDelta(delta: number, free: number): number {
    return delta > 0 ? Math.min(delta, Math.max(0, free)) : delta
  }

  assign(target: { kind: 'building' | 'pile'; id: number }, delta: number) {
    const s = this.state
    this.refreshStats()
    if (target.kind === 'pile') {
      const p = s.piles.find((x) => x.id === target.id)
      if (!p || p.amount <= 0) return
      const next = clamp(p.assigned + this.allowedDelta(delta, s.stats.freeWorkers), 0, 5)
      p.assigned = next
    } else {
      const b = s.buildings.find((x) => x.id === target.id)
      if (!b) return
      const def = BUILDINGS[b.type]
      if (!def.workerKind || !def.maxWorkers) return
      const free = def.workerKind === 'workers' ? s.stats.freeWorkers : s.stats.freeEngineers
      b.assigned = clamp(b.assigned + this.allowedDelta(delta, free), 0, def.maxWorkers)
    }
    this.refreshStats()
    this.emit(true)
  }

  toggleRelay(id: number) {
    const b = this.state.buildings.find((x) => x.id === id)
    if (!b) return
    b.enabled = !b.enabled
    this.recomputeHeat()
  }

  // ---------- Generator ----------
  recomputeHeat() {
    const s = this.state
    for (const b of s.buildings) b.heat = buildingHeat(s, b)
    this.emit(true)
  }

  toggleGenerator() {
    const g = this.state.generator
    if (!g.on && this.state.resources.coal < 1) {
      addLog(this.state, 'Недостаточно угля, чтобы разжечь генератор.', 'warn')
    } else {
      g.on = !g.on
      if (!g.on) g.overdrive = false
      addLog(this.state, g.on ? 'Генератор с рёвом ожил.' : 'Генератор остановлен.', g.on ? 'good' : 'warn')
    }
    this.recomputeHeat()
  }

  maxGeneratorLevel(): number {
    return this.state.researched.includes('genPower') ? 4 : 2
  }

  setGeneratorLevel(level: number) {
    this.state.generator.level = clamp(level, 1, this.maxGeneratorLevel())
    this.recomputeHeat()
  }

  toggleOverdrive() {
    const g = this.state.generator
    if (!g.on) return
    g.overdrive = !g.overdrive
    this.recomputeHeat()
  }

  setShiftMode(mode: 'normal' | 'extended') {
    this.state.shiftMode = mode
    this.emit(true)
  }

  // ---------- Laws ----------
  lawStatus(id: string): LawStatus {
    const s = this.state
    const def = LAWS.find((l) => l.id === id)
    if (!def) return 'locked'
    if (s.laws.includes(id)) return 'signed'
    if (def.excludes?.some((x) => s.laws.includes(x))) return 'excluded'
    if (def.requires && !s.laws.includes(def.requires)) return 'locked'
    if (s.time - s.lastLawAt < LAW_COOLDOWN_HOURS) return 'cooldown'
    return 'available'
  }

  lawCooldownLeft(): number {
    return Math.max(0, LAW_COOLDOWN_HOURS - (this.state.time - this.state.lastLawAt))
  }

  signLaw(id: string) {
    const s = this.state
    if (this.lawStatus(id) !== 'available') return
    const def = LAWS.find((l) => l.id === id)
    if (!def) return
    s.laws.push(id)
    s.lastLawAt = s.time
    switch (id) {
      case 'youthLabor': s.hope = clamp(s.hope - 8, 0, 100); break
      case 'shelters': s.hope = clamp(s.hope + 4, 0, 100); break
      case 'pathOrder': s.discontent = clamp(s.discontent - 10, 0, 100); break
      case 'pathFaith': s.hope = clamp(s.hope + 10, 0, 100); break
      default: break
    }
    addLog(s, `Подписан закон: ${def.name}.`, 'info')
    reconcileWorkforce(s)
    this.refreshStats()
    this.emit(true)
  }

  // ---------- Research ----------
  researchStatus(id: string): ResearchStatus {
    const s = this.state
    const def = RESEARCH.find((r) => r.id === id)
    if (!def) return 'locked'
    if (s.researched.includes(id)) return 'done'
    if (s.researching === id) return 'active'
    if (def.requires && !s.researched.includes(def.requires)) return 'locked'
    if (s.resources.wood < (def.cost.wood ?? 0) || s.resources.steel < (def.cost.steel ?? 0)) return 'unaffordable'
    return 'available'
  }

  startResearch(id: string) {
    const s = this.state
    if (this.researchStatus(id) !== 'available' || s.researching) return
    const def = RESEARCH.find((r) => r.id === id)
    if (!def) return
    s.resources.wood -= def.cost.wood ?? 0
    s.resources.steel -= def.cost.steel ?? 0
    s.researching = id
    s.researchProgress = 0
    addLog(s, `Начато исследование: ${def.name}.`, 'info')
    this.emit(true)
  }

  // ---------- Events ----------
  chooseEvent(action: string) {
    resolveEvent(this.state, action)
    this.refreshStats()
    this.emit(true)
  }

  get population(): number {
    return totalPop(this.state)
  }
}
