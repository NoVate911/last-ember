import * as THREE from 'three'
import { outsideTemp, tempToLevel } from '../data'
import { isWorkHour, totalPop } from '../simulation'
import type { BuildingType, Cell, GameState, PileKind } from '../types'
import { type Act, type Citizen, type Goal, buildPose } from './citizen'
import { CitizenBodies, basePose, type Pose } from './citizenBody'
import { type NetPos, type Plaza, angDiff, doorOf, netPoint, plazasFrom, route } from './streets'
import { type Dest, furnaceSpot, rimSpot, siteSpot, workStyle } from './workplaces'

/**
 * Citizen life simulation (visual only): every person has a home, possibly a job,
 * follows a daily routine along the streets, builds new structures, works at mines,
 * heaps and workshops, hauls crates to storage, chats, warms up and plays (children).
 */

const MAX = 120
const ORIGIN = new THREE.Vector3(0, 0, 0)
const BUILDERS_PER_SITE = 4

type Haul = 'coal' | 'wood' | 'steel' | 'food'

interface Job { cell: Cell; pile: boolean; type: BuildingType | null; kind: PileKind | null }

interface Ctx {
  key: string
  homes: Cell[]
  jobs: Job[]
  sites: Cell[]
  siteIds: Set<string>
  canteens: Cell[]
  medics: Cell[]
  others: Cell[]
  coalStores: Cell[]
  stores: Cell[]
  depots: Cell[]
  heaps: { cell: Cell; kind: PileKind }[]
}

const EMPTY_CTX: Ctx = {
  key: '', homes: [], jobs: [], sites: [], siteIds: new Set(), canteens: [], medics: [], others: [],
  coalStores: [], stores: [], depots: [], heaps: [],
}

function haulOf(type: BuildingType | null): Haul | null {
  switch (type) {
    case 'drill': case 'coalMine': return 'coal'
    case 'oreMine': case 'steelworks': return 'steel'
    case 'sawmill': return 'wood'
    case 'lodge': return 'food'
    default: return null
  }
}

export class Walkers {
  private bodies: CitizenBodies
  mesh: THREE.Group
  private people: Citizen[] = []
  private plazas: Plaza[] = []
  private ctx: Ctx = EMPTY_CTX
  private clock = 0
  private pairTimer = 0
  private pose: Pose = basePose()

  constructor() {
    this.bodies = new CitizenBodies(MAX, 42)
    this.mesh = this.bodies.group
    let s = 99
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    let adult = 0
    for (let i = 0; i < MAX; i++) {
      const child = rnd() < 0.22
      this.people.push({
        pos: new THREE.Vector3(), yaw: 0, at: { kind: 'ring', k: 0, theta: 0 }, path: [], pi: 0,
        act: 'idle', arriveAct: 'idle', arriveTime: 0, arriveFace: null, goal: 'none', timer: rnd() * 2,
        face: null, partner: -1, resume: null, child,
        pack: !child && rnd() < 0.3, scale: child ? 0.66 + rnd() * 0.06 : 0.94 + rnd() * 0.14,
        lane: (rnd() - 0.5) * 0.4, carry: false, phase: rnd() * 6, seed: rnd(), active: false,
        workCycles: 0, chatCooldown: rnd() * 10, adultIndex: child ? -1 : adult++, slot: i, target: '',
      })
    }
  }

  // ---------- Context ----------
  private refreshCtx(s: GameState) {
    let assigned = 0
    let built = 0
    for (const b of s.buildings) { assigned += b.assigned; if (b.built) built++ }
    for (const p of s.piles) assigned += p.assigned
    const key = `${Math.floor(s.time)}|${s.buildings.length}|${built}|${s.piles.length}|${s.laws.length}|${assigned}`
    if (key === this.ctx.key) return
    const ctx: Ctx = { ...EMPTY_CTX, key, siteIds: new Set(), homes: [], jobs: [], sites: [], canteens: [], medics: [], others: [], coalStores: [], stores: [], depots: [], heaps: [] }
    const jobs: Job[] = []
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
      if ((b.type === 'aid' || b.type === 'hospital') && b.assigned > 0) ctx.medics.push(c)
      for (let n = 0; n < b.assigned; n++) jobs.push({ cell: c, pile: false, type: b.type, kind: null })
    }
    for (const p of s.piles) {
      const c = s.cells.get(p.cellId)
      if (!c) continue
      ctx.heaps.push({ cell: c, kind: p.kind })
      for (let n = 0; n < p.assigned; n++) jobs.push({ cell: c, pile: true, type: null, kind: p.kind })
    }
    // Interleave jobs so visible people spread over all workplaces
    jobs.sort((a, b) => a.cell.id.localeCompare(b.cell.id))
    const groups = new Map<string, Job[]>()
    for (const j of jobs) groups.set(j.cell.id, [...(groups.get(j.cell.id) ?? []), j])
    while (ctx.jobs.length < jobs.length) {
      for (const g of groups.values()) { const j = g.shift(); if (j) ctx.jobs.push(j) }
    }
    this.ctx = ctx
  }

  // ---------- Destinations ----------
  private warmSpot(): Dest {
    const theta = Math.random() * Math.PI * 2
    const anchor: NetPos = { kind: 'ring', k: 0, theta }
    return { anchor, final: netPoint(anchor, 0.05), face: ORIGIN }
  }

  private plazaSpot(spread: number): Dest {
    const p = this.plazas[Math.floor(Math.random() * this.plazas.length)]
    if (!p) return this.warmSpot()
    const a = Math.random() * Math.PI * 2
    const r = spread * (0.75 + Math.random() * 0.35)
    return {
      anchor: { kind: 'spoke', j: p.j, r: p.r },
      final: new THREE.Vector3(p.center.x + Math.cos(a) * r, 0, p.center.z + Math.sin(a) * r),
      face: p.center,
    }
  }

  /** Where hauled goods go: coal to coal storage or the furnace, food to the canteen, the rest to warehouses. */
  private storeSpot(what: Haul): Dest {
    const ctx = this.ctx
    const list = what === 'coal' ? ctx.coalStores
      : what === 'food' ? (ctx.canteens.length ? ctx.canteens : ctx.stores)
      : ctx.stores.length ? ctx.stores : ctx.depots
    const c = list[Math.floor(Math.random() * list.length)]
    return c ? doorOf(c) : furnaceSpot()
  }

  private goTo(w: Citizen, d: Dest, goal: Goal, act: Act, time: number) {
    w.path = [netPoint(w.at, w.lane), ...route(w.at, d.anchor, w.lane), d.final]
    w.pi = 0
    w.at = d.anchor
    w.act = 'walk'
    w.goal = goal
    w.arriveAct = act
    w.arriveTime = time
    w.arriveFace = d.face
    w.face = null
  }

  private stay(w: Citizen, act: Act, time: number) {
    w.act = act
    w.timer = time
  }

  // ---------- Work routines ----------
  private build(w: Citizen, site: Cell, slot: number) {
    const rand = Math.random()
    if (w.goal === 'fetch' && w.target === site.id) {
      // Back from the stores with materials
      w.carry = true
      this.goTo(w, siteSpot(site, w.slot), 'build', 'hammer', 8 + rand * 6)
      return
    }
    if (w.goal === 'build' && w.target === site.id) {
      if (rand < 0.25) this.goTo(w, this.storeSpot(rand < 0.12 ? 'steel' : 'wood'), 'fetch', 'idle', 1.5)
      else this.stay(w, 'hammer', 7 + rand * 6)
      return
    }
    w.target = site.id
    w.slot = slot
    this.goTo(w, siteSpot(site, slot), 'build', 'hammer', 8 + rand * 6)
  }

  private work(w: Citizen, i: number, job: Job) {
    const rand = Math.random()
    const cell = job.cell
    const style = job.pile ? 'heap' : workStyle(job.type ?? 'tent')
    const here = w.goal === 'work' && w.target === cell.id

    if (!here) {
      w.target = cell.id
      w.slot = i
      w.workCycles = 0
      if (style === 'heap' || style === 'dig') this.goTo(w, siteSpot(cell, i), 'work', 'shovel', 9 + rand * 6)
      else if (style === 'craft') this.goTo(w, siteSpot(cell, i), 'work', 'hammer', 9 + rand * 6)
      else if (style === 'inside') this.goTo(w, doorOf(cell), 'work', 'inside', 10 + rand * 6)
      else this.goTo(w, doorOf(cell), 'work', 'idle', 1.5)
      return
    }

    w.workCycles++
    const haul = job.pile ? job.kind : haulOf(job.type)
    switch (style) {
      case 'heap':
      case 'dig':
      case 'craft':
        if (haul && w.workCycles % 3 === 0) {
          w.carry = true
          this.goTo(w, this.storeSpot(haul), 'errand', 'idle', 1.5)
        } else this.stay(w, style === 'craft' ? 'hammer' : 'shovel', 8 + rand * 6)
        break
      case 'haul': {
        // Depot porters: dig at the nearest heap, then carry the crate back
        if (w.workCycles % 2 === 1) {
          const heaps = this.ctx.heaps
            .filter((h) => Math.hypot(h.cell.x - cell.x, h.cell.z - cell.z) <= 15)
            .sort((a, b) => Math.hypot(a.cell.x - cell.x, a.cell.z - cell.z) - Math.hypot(b.cell.x - cell.x, b.cell.z - cell.z))
          const heap = heaps[0]
          if (heap) this.goTo(w, siteSpot(heap.cell, i + 3), 'work', 'shovel', 4 + rand * 3)
          else this.stay(w, 'idle', 4)
        } else {
          w.carry = true
          this.goTo(w, doorOf(cell), 'work', 'idle', 1.5)
        }
        break
      }
      case 'hunt':
        // Hunters disappear beyond the rim and come back loaded with game
        if (w.workCycles % 2 === 1) this.goTo(w, rimSpot(cell), 'work', 'inside', 10 + rand * 8)
        else {
          w.carry = true
          this.goTo(w, doorOf(cell), 'work', 'idle', 1.5)
        }
        break
      default:
        if (rand < 0.3 && this.ctx.others.length > 1) {
          const target = this.ctx.others[Math.floor(Math.random() * this.ctx.others.length)]!
          w.carry = true
          this.goTo(w, doorOf(target), 'errand', 'idle', 2)
        } else this.stay(w, 'inside', 8 + rand * 8)
    }
  }

  private decide(w: Citizen, i: number, s: GameState, hour: number) {
    const ctx = this.ctx
    const rand = Math.random()
    const night = hour >= 21 || hour < 6
    w.carry = false

    if (night) {
      const home = ctx.homes.length ? ctx.homes[i % ctx.homes.length] : undefined
      if (home) this.goTo(w, doorOf(home), 'home', 'inside', 1e9)
      else this.goTo(w, this.warmSpot(), 'warm', 'warm', 12 + rand * 8)
      return
    }

    const pop = Math.max(1, totalPop(s))
    const sick = w.seed < (s.sick + s.gravelyIll) / pop
    if (sick && ctx.medics.length && w.goal !== 'medic') {
      const m = ctx.medics[i % ctx.medics.length]!
      this.goTo(w, doorOf(m), 'medic', 'inside', 15 + rand * 10)
      return
    }

    const youth = s.laws.includes('youthLabor')
    const jobIdx = w.child ? (youth ? MAX - 1 - i : -1) : w.adultIndex
    const job = jobIdx >= 0 ? ctx.jobs[jobIdx] : undefined
    const working = isWorkHour(s, hour)

    if (working && job) { this.work(w, i, job); return }

    // Adults without a job become builders on construction sites
    if (working && !w.child && ctx.sites.length) {
      const bi = w.adultIndex - ctx.jobs.length
      if (bi >= 0 && bi < ctx.sites.length * BUILDERS_PER_SITE) {
        const site = ctx.sites[bi % ctx.sites.length]!
        this.build(w, site, Math.floor(bi / ctx.sites.length))
        return
      }
    }
    w.target = ''

    if (!working && hour >= 17) {
      // Evening routine: queue for food, gather with friends, warm up
      if (rand < 0.35 && ctx.canteens.length) {
        const c = ctx.canteens[i % ctx.canteens.length]!
        this.goTo(w, doorOf(c), 'canteen', 'idle', 4 + Math.random() * 3)
      } else if (rand < 0.75) this.goTo(w, this.plazaSpot(1.0), 'plaza', 'talk', 8 + Math.random() * 8)
      else this.goTo(w, this.warmSpot(), 'warm', 'warm', 6 + Math.random() * 6)
      return
    }

    if (w.child) {
      if (rand < 0.6) this.goTo(w, this.plazaSpot(1.5), 'plaza', 'play', 5 + Math.random() * 5)
      else this.goTo(w, this.plazaSpot(0.9), 'plaza', 'talk', 6 + Math.random() * 6)
      return
    }
    if (rand < 0.4) this.goTo(w, this.plazaSpot(1.0), 'plaza', 'talk', 8 + Math.random() * 8)
    else if (rand < 0.7 || !ctx.others.length) this.goTo(w, this.warmSpot(), 'warm', 'warm', 6 + Math.random() * 6)
    else {
      const c = ctx.others[Math.floor(Math.random() * ctx.others.length)]!
      this.goTo(w, doorOf(c), 'visit', 'idle', 2 + Math.random() * 3)
    }
  }

  // ---------- Conversations ----------
  private startChat(a: Citizen, ai: number, b: Citizen, bi: number) {
    const time = 4 + Math.random() * 5
    for (const [w, other, oi] of [[a, b, bi], [b, a, ai]] as const) {
      w.resume = w.act === 'walk' ? { arriveAct: w.arriveAct, arriveTime: w.arriveTime, arriveFace: w.arriveFace, goal: w.goal } : null
      w.act = 'talk'
      w.timer = time
      w.partner = oi
      w.face = other.pos.clone()
      w.chatCooldown = 20 + Math.random() * 20
    }
    const d = a.pos.distanceTo(b.pos)
    if (d < 0.6) {
      const dir = new THREE.Vector3().subVectors(b.pos, a.pos)
      if (dir.lengthSq() < 1e-4) dir.set(1, 0, 0)
      dir.setY(0).normalize().multiplyScalar((0.6 - d) / 2)
      a.pos.sub(dir)
      b.pos.add(dir)
    }
  }

  private findChats(count: number) {
    const free = (w: Citizen) =>
      w.active && w.partner < 0 && w.chatCooldown <= 0 && !w.carry &&
      (w.act === 'walk' || w.act === 'idle' || w.act === 'warm') && w.goal !== 'work' && w.goal !== 'build'
    for (let i = 0; i < count; i++) {
      const a = this.people[i]!
      if (!free(a)) continue
      for (let j = i + 1; j < count; j++) {
        const b = this.people[j]!
        if (!free(b)) continue
        if (a.pos.distanceToSquared(b.pos) > 1.6 * 1.6) continue
        if (Math.random() < (a.act === 'walk' ? 0.25 : 0.12)) {
          this.startChat(a, i, b, j)
          break
        }
      }
    }
  }

  // ---------- Frame update ----------
  update(dt: number, s: GameState, hour: number, speed: number) {
    if (this.plazas.length === 0) this.plazas = plazasFrom(s.cells.values())
    this.refreshCtx(s)
    const simDt = speed === 0 ? 0 : dt * speed
    this.clock += simDt
    const t = this.clock
    const count = Math.min(MAX, Math.floor(totalPop(s) * 0.75))
    const night = hour >= 21 || hour < 6
    const cold = tempToLevel(outsideTemp(s.time)) <= 1
    const pop = Math.max(1, totalPop(s))
    const sickRatio = (s.sick + s.gravelyIll) / pop

    this.pairTimer += simDt
    if (this.pairTimer > 0.3) { this.pairTimer = 0; this.findChats(count) }

    for (let i = 0; i < MAX; i++) {
      const w = this.people[i]!
      const p = this.pose
      if (i >= count) {
        w.active = false
        p.hidden = true
        this.bodies.apply(i, p)
        continue
      }
      if (!w.active) {
        w.active = true
        const theta = Math.random() * Math.PI * 2
        w.at = { kind: 'ring', k: 0, theta }
        w.pos.copy(netPoint(w.at, w.lane))
        w.act = 'idle'
        w.timer = Math.random() * 2
        w.partner = -1
        w.resume = null
      }
      w.chatCooldown -= simDt
      const sick = w.seed < sickRatio

      // A finished construction site releases its builders right away
      if (w.goal === 'build' && w.act === 'hammer' && !this.ctx.siteIds.has(w.target)) w.timer = 0

      // State machine
      if (w.act === 'walk') {
        let step = simDt * 1.25 * (w.child ? 1.1 : 1) * (sick ? 0.55 : 1) * (w.carry ? 0.85 : 1)
        while (step > 0 && w.pi < w.path.length) {
          const target = w.path[w.pi]!
          const d = Math.hypot(target.x - w.pos.x, target.z - w.pos.z)
          if (d <= step) { w.pos.set(target.x, 0, target.z); w.pi++; step -= d }
          else { w.pos.x += ((target.x - w.pos.x) / d) * step; w.pos.z += ((target.z - w.pos.z) / d) * step; step = 0 }
        }
        if (w.pi >= w.path.length) {
          w.act = w.arriveAct
          w.timer = w.arriveTime
          w.face = w.arriveFace
          w.carry = false
          // Leaving the street: anchor stays on the network so the next route starts correctly
        }
      } else {
        w.timer -= simDt
        const wakeUp = w.act === 'inside' && w.goal === 'home' && !night
        if (w.timer <= 0 || wakeUp) {
          if (w.act === 'talk' && w.partner >= 0) {
            w.partner = -1
            if (w.resume) {
              w.act = 'walk'
              w.arriveAct = w.resume.arriveAct
              w.arriveTime = w.resume.arriveTime
              w.arriveFace = w.resume.arriveFace
              w.goal = w.resume.goal
              w.resume = null
              w.face = null
            } else this.decide(w, i, s, hour)
          } else this.decide(w, i, s, hour)
        }
      }

      // Facing
      let targetYaw = w.yaw
      if (w.act === 'walk') {
        const nx = w.path[w.pi]
        if (nx && Math.hypot(nx.x - w.pos.x, nx.z - w.pos.z) > 0.01) targetYaw = Math.atan2(nx.x - w.pos.x, nx.z - w.pos.z)
      } else if (w.act === 'talk' && w.partner >= 0) {
        const o = this.people[w.partner]
        if (o) targetYaw = Math.atan2(o.pos.x - w.pos.x, o.pos.z - w.pos.z)
      } else if (w.face) {
        targetYaw = Math.atan2(w.face.x - w.pos.x, w.face.z - w.pos.z)
      }
      if (w.act !== 'play') w.yaw += angDiff(w.yaw, targetYaw) * Math.min(1, dt * 8)

      buildPose(p, w, i, t, simDt, sick, cold)
      this.bodies.apply(i, p)
    }
    this.bodies.finish(MAX)
  }
}
