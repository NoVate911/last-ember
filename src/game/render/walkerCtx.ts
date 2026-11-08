import type { BuildingType, Cell, GameState, PileKind } from '../types'
import { BUILDINGS } from '../data'

/** What the citizen simulation needs to know about the city, rebuilt when the city changes. */

export type Haul = 'coal' | 'wood' | 'steel' | 'food'

export interface Job { cell: Cell; pile: boolean; type: BuildingType | null; kind: PileKind | null }

export interface Ctx {
  key: string
  homes: Cell[]
  /** One entry per assigned worker slot (buildings + heaps), interleaved across workplaces */
  workerJobs: Job[]
  /** One entry per assigned engineer slot */
  engineerJobs: Job[]
  sites: Cell[]
  siteIds: Set<string>
  canteens: Cell[]
  medics: Cell[]
  others: Cell[]
  coalStores: Cell[]
  stores: Cell[]
  depots: Cell[]
  schools: Cell[]
  heaps: { cell: Cell; kind: PileKind }[]
  expedition: boolean
}

export function emptyCtx(): Ctx {
  return {
    key: '', homes: [], workerJobs: [], engineerJobs: [], sites: [], siteIds: new Set(), canteens: [], medics: [],
    others: [], coalStores: [], stores: [], depots: [], schools: [], heaps: [], expedition: false,
  }
}

export function haulOf(type: BuildingType | null): Haul | null {
  switch (type) {
    case 'drill': case 'coalMine': return 'coal'
    case 'oreMine': case 'steelworks': return 'steel'
    case 'sawmill': return 'wood'
    case 'lodge': return 'food'
    default: return null
  }
}

export function ctxKey(s: GameState): string {
  let assigned = 0
  let built = 0
  for (const b of s.buildings) { assigned += b.assigned * 31 + b.id; if (b.built) built++ }
  for (const p of s.piles) assigned += p.assigned * 17 + p.id
  return `${s.buildings.length}|${built}|${s.piles.length}|${s.laws.length}|${assigned}|${s.expedition ? 1 : 0}`
}

/** Spread job slots over workplaces so the first N people cover every building, not one after another. */
function interleave(jobs: Job[]): Job[] {
  jobs.sort((a, b) => a.cell.id.localeCompare(b.cell.id))
  const groups = new Map<string, Job[]>()
  for (const j of jobs) {
    const g = groups.get(j.cell.id)
    if (g) g.push(j)
    else groups.set(j.cell.id, [j])
  }
  const out: Job[] = []
  while (out.length < jobs.length) {
    for (const g of groups.values()) { const j = g.shift(); if (j) out.push(j) }
  }
  return out
}

export function buildCtx(s: GameState, key: string): Ctx {
  const ctx = emptyCtx()
  ctx.key = key
  ctx.expedition = s.expedition !== null
  const wj: Job[] = []
  const ej: Job[] = []
  for (const b of s.buildings) {
    const c = s.cells.get(b.cellId)
    if (!c) continue
    if (!b.built) { ctx.sites.push(c); ctx.siteIds.add(c.id); continue }
    if (b.type === 'tent' || b.type === 'bunkhouse' || b.type === 'house') { ctx.homes.push(c); continue }
    ctx.others.push(c)
    if (b.type === 'canteen') ctx.canteens.push(c)
    if (b.type === 'coalStorage') ctx.coalStores.push(c)
    if (b.type === 'warehouse') ctx.stores.push(c)
    if (b.type === 'depot') ctx.depots.push(c)
    if (b.type === 'school' && b.assigned > 0 && !s.laws.includes('youthLabor')) ctx.schools.push(c)
    if ((b.type === 'aid' || b.type === 'hospital') && b.assigned > 0) ctx.medics.push(c)
    const list = BUILDINGS[b.type].workerKind === 'engineers' ? ej : wj
    for (let n = 0; n < b.assigned; n++) list.push({ cell: c, pile: false, type: b.type, kind: null })
  }
  for (const p of s.piles) {
    const c = s.cells.get(p.cellId)
    if (!c) continue
    ctx.heaps.push({ cell: c, kind: p.kind })
    for (let n = 0; n < p.assigned; n++) wj.push({ cell: c, pile: true, type: null, kind: p.kind })
  }
  ctx.workerJobs = interleave(wj)
  ctx.engineerJobs = interleave(ej)
  return ctx
}
