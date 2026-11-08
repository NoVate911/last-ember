export type BuildingType =
  | 'tent'
  | 'bunkhouse'
  | 'house'
  | 'depot'
  | 'lodge'
  | 'canteen'
  | 'aid'
  | 'hospital'
  | 'workshop'
  | 'relay'
  | 'drill'
  | 'sawmill'
  | 'steelworks'
  | 'coalMine'
  | 'oreMine'
  | 'warehouse'
  | 'coalStorage'
  | 'cemetery'
  | 'arena'
  | 'pub'

export type ResourceKey = 'coal' | 'wood' | 'steel' | 'rawFood' | 'rations'
export type PileKind = 'coal' | 'wood' | 'steel'
export type WorkerKind = 'workers' | 'engineers'
export type BuildCategory = 'housing' | 'resources' | 'storage' | 'food' | 'health' | 'heat' | 'social' | 'tech'

export interface BuildingDef {
  type: BuildingType
  name: string
  category: BuildCategory
  description: string
  cost: { wood?: number; steel?: number }
  buildHours: number
  /** Housing capacity (homes only) */
  capacity?: number
  /** Extra heat levels provided by walls */
  insulation: number
  workerKind?: WorkerKind
  maxWorkers?: number
  /** research id required to build */
  requires?: string
  /** law id required to build */
  requiresLaw?: string
  /** Must be placed on a resource deposit of this kind (mines) */
  onDeposit?: PileKind
  /** Extra storage capacity provided once built */
  storage?: Partial<Record<ResourceKey, number>>
}

export interface Cell {
  id: string
  ring: number
  sector: number
  sectors: number
  x: number
  z: number
  angle: number
  inner: number
  outer: number
  thetaStart: number
  thetaLength: number
  occupant: { kind: 'building' | 'pile'; id: number } | null
  /** Street / plaza cell on a radial avenue: kept free so people can walk through */
  road: boolean
  /** Underground resource deposit (left behind by heaps); mines can be built on it */
  deposit: PileKind | null
}

export interface Building {
  id: number
  type: BuildingType
  cellId: string
  x: number
  z: number
  angle: number
  progress: number
  built: boolean
  assigned: number
  /** Heat relays can be switched off to save coal */
  enabled: boolean
  /** Status message produced by the last simulation tick */
  status: string
  /** Whether the building is currently operating (lit windows, smoke, animation) */
  active: boolean
  /** Number of residents (homes only) */
  residents: number
  /** Heat level (0-5) computed by the last simulation tick */
  heat: number
  /** Graves filled (cemetery only) */
  stored: number
}

export interface Pile {
  id: number
  kind: PileKind
  cellId: string
  x: number
  z: number
  amount: number
  max: number
  assigned: number
}

export interface Population {
  workers: number
  engineers: number
  children: number
}

export interface GeneratorState {
  on: boolean
  level: number
  overdrive: boolean
  stress: number
  rangeRings: number
}

export interface EventChoice {
  label: string
  hint: string
  action: string
}

export interface PendingEvent {
  id: string
  title: string
  text: string
  choices: EventChoice[]
}

export interface ActivePromise {
  id: string
  text: string
  deadline: number
  kind: 'house_all' | 'heat_homes' | 'no_sick'
}

export interface LogEntry {
  id: number
  time: number
  text: string
  tone: 'info' | 'good' | 'warn' | 'bad'
}

export type Selection =
  | { kind: 'building'; id: number }
  | { kind: 'pile'; id: number }
  | { kind: 'generator' }
  | null

export interface UiState {
  placing: BuildingType | null
  selected: Selection
  heatOverlay: boolean
  hoverCellId: string | null
  dialog: 'laws' | 'research' | 'menu' | null
  buildOpen: boolean
}

export interface GameState {
  time: number
  speed: number
  resources: Record<ResourceKey, number>
  history: Record<ResourceKey, number>[]
  pop: Population
  sick: number
  gravelyIll: number
  hungry: number
  hungerStreak: number
  deaths: number
  /** Bodies waiting to be buried */
  corpses: number
  amputees: number
  hope: number
  discontent: number
  generator: GeneratorState
  buildings: Building[]
  piles: Pile[]
  cells: Map<string, Cell>
  researched: string[]
  researching: string | null
  researchProgress: number
  laws: string[]
  lastLawAt: number
  shiftMode: 'normal' | 'extended'
  firedEvents: string[]
  objectivesDone: string[]
  pendingEvent: PendingEvent | null
  promise: ActivePromise | null
  log: LogEntry[]
  status: 'playing' | 'won' | 'lost'
  endReason: string
  nextId: number
  /** Cached statistics from the last tick for the HUD */
  stats: {
    housed: number
    homeless: number
    homeHeatAvg: number
    coldHomes: number
    coalPerHour: number
    researchPerHour: number
    freeWorkers: number
    freeEngineers: number
    treated: number
    caps: Record<ResourceKey, number>
  }
}
