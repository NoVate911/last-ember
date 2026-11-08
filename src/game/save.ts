import { BASE_STORAGE, formatTime } from './data'
import { totalPop } from './simulation'
import type { Building, Cell, GameState } from './types'

/** Local save slots. Saves live in the browser's localStorage. */
export const SAVE_SLOTS = ['auto', '1', '2', '3'] as const
export type SaveSlot = (typeof SAVE_SLOTS)[number]

const PREFIX = 'last-ember:save:'
const VERSION = 2

export interface SaveMeta {
  slot: SaveSlot
  savedAt: number
  day: number
  clock: string
  pop: number
}

interface SaveFile {
  version: number
  meta: SaveMeta
  state: Omit<GameState, 'cells'> & { cells: Cell[] }
}

function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function saveGame(slot: SaveSlot, s: GameState): boolean {
  const ls = storage()
  if (!ls) return false
  const { day, clock } = formatTime(s.time)
  const file: SaveFile = {
    version: VERSION,
    meta: { slot, savedAt: Date.now(), day, clock, pop: totalPop(s) },
    state: { ...s, cells: [...s.cells.values()] },
  }
  try {
    ls.setItem(PREFIX + slot, JSON.stringify(file))
    return true
  } catch {
    return false
  }
}

export function listSaves(): Partial<Record<SaveSlot, SaveMeta>> {
  const ls = storage()
  const out: Partial<Record<SaveSlot, SaveMeta>> = {}
  if (!ls) return out
  for (const slot of SAVE_SLOTS) {
    const raw = ls.getItem(PREFIX + slot)
    if (!raw) continue
    try {
      const file = JSON.parse(raw) as SaveFile
      out[slot] = file.meta
    } catch {
      // ignore corrupted slot
    }
  }
  return out
}

export function latestSave(): SaveMeta | null {
  const metas = Object.values(listSaves())
  return metas.sort((a, b) => b.savedAt - a.savedAt)[0] ?? null
}

export function deleteSave(slot: SaveSlot) {
  storage()?.removeItem(PREFIX + slot)
}

/** Loads a save and fills in fields added by newer versions of the game. */
export function loadGame(slot: SaveSlot): GameState | null {
  const raw = storage()?.getItem(PREFIX + slot)
  if (!raw) return null
  try {
    const file = JSON.parse(raw) as SaveFile
    const st = file.state
    const cells = new Map<string, Cell>()
    for (const c of st.cells) cells.set(c.id, { ...c, deposit: c.deposit ?? null })
    const buildings: Building[] = st.buildings.map((b) => ({ ...b, stored: b.stored ?? 0 }))
    return {
      ...st,
      cells,
      buildings,
      corpses: st.corpses ?? 0,
      objectivesDone: st.objectivesDone ?? [],
      speed: 0,
      stats: { ...st.stats, caps: st.stats.caps ?? { ...BASE_STORAGE } },
    }
  } catch {
    return null
  }
}
