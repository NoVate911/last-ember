import * as THREE from 'three'
import { BUILDERS_PER_SITE, SCHOOL_CAPACITY, WORK_START, outsideTemp, tempToLevel } from '../data'
import { isWorkHour } from '../simulation'
import type { Cell, GameState } from '../types'
import { type Act, type Citizen, type Goal, type Role, buildPose } from './citizen'
import { CitizenBodies, basePose, type Pose } from './citizenBody'
import { type NetPos, type Plaza, angDiff, doorOf, netPoint, plazasFrom, route } from './streets'
import { type Ctx, type Haul, type Job, buildCtx, ctxKey, emptyCtx, haulOf } from './walkerCtx'
import { type Dest, furnaceSpot, rimSpot, siteSpot, workStyle } from './workplaces'

/**
 * Citizen life simulation. Every citizen of the city is a walker with a role (worker, engineer, child),
 * a home, possibly a job, and follows a daily routine along the streets. The time people actually
 * spend at their workplace, on a construction site or in class is recorded into the game state
 * (`presence`, `buildPresence`, `studyPresence`) and drives production, construction and study.
 */

const MAX = 200
const ORIGIN = new THREE.Vector3(0, 0, 0)
const WALK_SPEED = 1.9

export class Walkers {
  private bodies: CitizenBodies
  mesh: THREE.Group
  private people: Citizen[] = []
  private plazas: Plaza[] = []
  private ctx: Ctx = emptyCtx()
  private ctxChanged = false
  private clock = 0
  private pairTimer = 0
  private pose: Pose = basePose()
  /** Population split used for role lookups in the current frame */
  private W = 0
  private C = 0
  private youth = false
  private weight = 1
  private roleSig = ''

  constructor() {
    this.bodies = new CitizenBodies(MAX, 42)
    this.mesh = this.bodies.group
    let s = 99
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    for (let i = 0; i < MAX; i++) {
      this.people.push({
        pos: new THREE.Vector3(), yaw: 0, at: { kind: 'ring', k: 0, theta: 0 }, path: [], pi: 0,
        act: 'idle', arriveAct: 'idle', arriveTime: 0, arriveFace: null, goal: 'none', timer: rnd() * 2,
        face: null, partner: -1, resume: null, child: false,
        pack: rnd() < 0.3, scale: 1, lane: (rnd() - 0.5) * 0.4, carry: false, phase: rnd() * 6, seed: rnd(), active: false,
        workCycles: 0, chatCooldown: rnd() * 10, role: 'worker', roleIdx: -1, onShift: false, sick: false, slot: i, target: '',
      })
    }
  }

  // ---------- Roles ----------
  /**
   * Keep roles stable: when the population split changes, only the minimum number of walkers
   * switch roles, and indices inside each role stay compact (0..n-1) so jobs don't reshuffle.
   */
  private assignRoles(count: number, desired: Record<Role, number>) {
    const roles: Role[] = ['worker', 'engineer', 'child']
    const lists: Record<Role, Citizen[]> = { worker: [], engineer: [], child: [] }
    const loose: Citizen[] = []
    for (let i = 0; i < count; i++) {
      const w = this.people[i]!
      if (w.roleIdx < 0) loose.push(w)
      else lists[w.role].push(w)
    }
    const changed = new Set<Citizen>()
    for (const role of roles) {
      const list = lists[role].sort((a, b) => a.roleIdx - b.roleIdx)
      // Surplus: drop the highest indices
      while (list.length > desired[role]) { const w = list.pop()!; w.roleIdx = -1; loose.push(w) }
      // Compact: fill gaps with the highest holders
      const n = list.length
      const used = new Set(list.map((w) => w.roleIdx))
      const gaps: number[] = []
      for (let k = 0; k < n; k++) if (!used.has(k)) gaps.push(k)
      for (const w of list) {
        if (w.roleIdx >= n) { w.roleIdx = gaps.shift() ?? w.roleIdx; changed.add(w) }
      }
    }
    for (const role of roles) {
      while (lists[role].length < desired[role] && loose.length) {
        const w = loose.shift()!
        w.role = role
        w.roleIdx = lists[role].length
        lists[role].push(w)
        changed.add(w)
      }
    }
    for (const w of loose) { w.roleIdx = -1 }
    for (const w of changed) {
      w.child = w.role === 'child'
      w.scale = w.child ? 0.66 + w.seed * 0.06 : 0.94 + w.seed * 0.14
      if (w.act !== 'walk' && w.act !== 'talk') w.timer = Math.min(w.timer, 0.2)
    }
  }

  /** Index inside the role in "people space" (differs from roleIdx only when walkers stand for several people). */
  private pidx(w: Citizen): number {
    return Math.floor(w.roleIdx * this.weight)
  }

  /** Position in the labor pool (workers, then children under the youth labor law), or -1. */
  private laborIdx(w: Citizen): number {
    if (w.roleIdx < 0) return -1
    if (w.role === 'worker') return this.pidx(w)
    if (w.role === 'child' && this.youth) return this.W + this.pidx(w)
    return -1
  }

  private jobOf(w: Citizen): Job | undefined {
    if (w.role === 'engineer' && w.roleIdx >= 0) return this.ctx.engineerJobs[this.pidx(w)]
    const li = this.laborIdx(w)
    return li >= 0 ? this.ctx.workerJobs[li] : undefined
  }

  /** Free hands (workers first, then engineers) staff construction sites: full crews of 4, oldest site first. */
  private siteFor(w: Citizen): { cell: Cell; slot: number } | null {
    const { sites, workerJobs, engineerJobs } = this.ctx
    if (!sites.length || w.roleIdx < 0) return null
    const laborPool = this.W + (this.youth ? this.C : 0)
    let bi = -1
    const li = this.laborIdx(w)
    if (li >= 0) bi = li - workerJobs.length
    else if (w.role === 'engineer' && this.pidx(w) >= engineerJobs.length) {
      bi = Math.max(0, laborPool - workerJobs.length) + (this.pidx(w) - engineerJobs.length)
    }
    if (bi < 0 || bi >= sites.length * BUILDERS_PER_SITE) return null
    return { cell: sites[Math.floor(bi / BUILDERS_PER_SITE)]!, slot: bi % BUILDERS_PER_SITE }
  }

  private intendedTarget(w: Citizen): string {
    return this.jobOf(w)?.cell.id ?? this.siteFor(w)?.cell.id ?? ''
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
  private build(w: Citizen, site: Cell, slot: number, pre: boolean) {
    const rand = Math.random()
    const here = w.target === site.id && (w.goal === 'build' || w.goal === 'fetch')
    if (!here) {
      w.target = site.id
      w.slot = slot
      w.onShift = false
      this.goTo(w, siteSpot(site, slot), 'build', pre ? 'idle' : 'hammer', pre ? 3 : 8 + rand * 6)
      return
    }
    if (pre) { this.stay(w, 'idle', 3); return }
    if (w.goal === 'fetch') {
      // Back from the stores with materials
      w.carry = true
      this.goTo(w, siteSpot(site, w.slot), 'build', 'hammer', 8 + rand * 6)
      return
    }
    if (rand < 0.2) this.goTo(w, this.storeSpot(rand < 0.1 ? 'steel' : 'wood'), 'fetch', 'idle', 1.5)
    else this.stay(w, 'hammer', 7 + rand * 6)
  }

  private station(w: Citizen, job: Job, i: number, pre: boolean) {
    const rand = Math.random()
    const cell = job.cell
    const style = job.pile ? 'heap' : workStyle(job.type ?? 'tent')
    const t = pre ? 3 : 9 + rand * 6
    if (style === 'heap' || style === 'dig') this.goTo(w, siteSpot(cell, i), 'work', pre ? 'idle' : 'shovel', t)
    else if (style === 'craft') this.goTo(w, siteSpot(cell, i), 'work', pre ? 'idle' : 'hammer', t)
    else if (style === 'inside' || style === 'scout') this.goTo(w, doorOf(cell), 'work', 'inside', t)
    else this.goTo(w, doorOf(cell), 'work', 'idle', 1.5)
  }

  private work(w: Citizen, i: number, job: Job, pre: boolean) {
    const rand = Math.random()
    const cell = job.cell
    const style = job.pile ? 'heap' : workStyle(job.type ?? 'tent')
    const atWork = w.target === cell.id && w.onShift && (w.goal === 'work' || w.goal === 'errand')

    if (!atWork) {
      w.target = cell.id
      w.slot = i
      w.workCycles = 0
      w.onShift = false
      this.station(w, job, i, pre)
      return
    }
    // Back from an errand: return to the workbench
    if (w.goal === 'errand') { this.station(w, job, w.slot, pre); return }
    if (pre) { this.stay(w, style === 'inside' || style === 'scout' ? 'inside' : 'idle', 3); return }

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
      case 'scout':
        this.stay(w, 'inside', 10)
        break
      default:
        if (rand < 0.25 && this.ctx.others.length > 1) {
          const target = this.ctx.others[Math.floor(Math.random() * this.ctx.others.length)]!
          w.carry = true
          this.goTo(w, doorOf(target), 'errand', 'idle', 2)
        } else this.stay(w, 'inside', 8 + rand * 8)
    }
  }

  /** Scouts leave over the crater rim and stay out until the expedition returns. */
  private scout(w: Citizen, cell: Cell) {
    if (w.goal === 'work' && w.target === cell.id && w.act === 'inside' && w.onShift) { this.stay(w, 'inside', 20); return }
    w.target = cell.id
    w.onShift = false
    this.goTo(w, rimSpot(cell), 'work', 'inside', 20)
  }

  private decide(w: Citizen, i: number, hour: number, s: GameState) {
    const ctx = this.ctx
    const rand = Math.random()
    const working = isWorkHour(s, hour)
    const night = (hour >= 21 || hour < 6) && !working
    const prevTarget = w.target
    w.carry = false
    const job = this.jobOf(w)

    if (job && job.type === 'beacon' && ctx.expedition) { this.scout(w, job.cell); return }

    if (w.sick) {
      w.onShift = false
      w.target = ''
      if ((w.goal === 'medic' || w.goal === 'rest') && w.act !== 'walk' && !night) { this.stay(w, 'inside', 15); return }
      const m = ctx.medics.length ? ctx.medics[i % ctx.medics.length] : undefined
      const home = ctx.homes.length ? ctx.homes[i % ctx.homes.length] : undefined
      if (m && !night) this.goTo(w, doorOf(m), 'medic', 'inside', 15 + rand * 10)
      else if (home) this.goTo(w, doorOf(home), night ? 'home' : 'rest', 'inside', night ? 1e9 : 15)
      else this.goTo(w, this.warmSpot(), 'warm', 'warm', 12 + rand * 8)
      return
    }

    if (night) {
      w.onShift = false
      const home = ctx.homes.length ? ctx.homes[i % ctx.homes.length] : undefined
      if (home) this.goTo(w, doorOf(home), 'home', 'inside', 1e9)
      else this.goTo(w, this.warmSpot(), 'warm', 'warm', 12 + rand * 8)
      return
    }

    // Two hours before the shift people head to their posts, so work starts on time
    const pre = !working && hour >= WORK_START - 2 && hour < WORK_START
    if ((working || pre) && job) { this.work(w, i, job, pre); return }
    const site = working || pre ? this.siteFor(w) : null
    if (site) { this.build(w, site.cell, site.slot, pre); return }
    w.target = ''
    w.onShift = false

    if (working && w.child && w.roleIdx >= 0 && ctx.schools.length && w.roleIdx < ctx.schools.length * SCHOOL_CAPACITY) {
      const school = ctx.schools[w.roleIdx % ctx.schools.length]!
      w.target = school.id
      if (w.goal === 'school' && prevTarget === school.id && w.act !== 'walk') { this.stay(w, 'inside', 10); return }
      this.goTo(w, doorOf(school), 'school', 'inside', 10 + rand * 4)
      return
    }

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
    const busy: Goal[] = ['work', 'build', 'fetch', 'errand', 'school', 'medic', 'rest']
    const free = (w: Citizen) =>
      w.active && w.partner < 0 && w.chatCooldown <= 0 && !w.carry && !w.sick &&
      (w.act === 'walk' || w.act === 'idle' || w.act === 'warm') && !busy.includes(w.goal)
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
    const key = ctxKey(s)
    if (key !== this.ctx.key) { this.ctx = buildCtx(s, key); this.ctxChanged = true }
    const simDt = speed === 0 ? 0 : dt * speed
    this.clock += simDt
    const t = this.clock
    const { workers: W, engineers: E, children: C } = s.pop
    const pop = W + E + C
    this.W = W
    this.C = C
    this.youth = s.laws.includes('youthLabor')
    const count = Math.min(MAX, pop)
    // When the city outgrows the walker pool, each walker stands for several people
    const weight = count > 0 ? pop / count : 1
    this.weight = weight
    const dW = Math.round((W * count) / Math.max(1, pop))
    const dE = Math.min(count - dW, Math.round((E * count) / Math.max(1, pop)))
    const sig = `${count}|${dW}|${dE}`
    if (sig !== this.roleSig) {
      this.roleSig = sig
      for (let i = count; i < MAX; i++) this.people[i]!.roleIdx = -1
      this.assignRoles(count, { worker: dW, engineer: dE, child: count - dW - dE })
    }
    const night = hour >= 21 || hour < 6
    const workNow = isWorkHour(s, Math.floor(hour))
    const cold = tempToLevel(outsideTemp(s.time)) <= 1
    const sickRatio = pop > 0 ? (s.sick + s.gravelyIll) / pop : 0

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
      const sick = w.seed < sickRatio
      if (sick !== w.sick) {
        w.sick = sick
        if (w.act !== 'walk' && w.act !== 'talk') w.timer = Math.min(w.timer, 0.2)
      }
      if (!w.active) {
        w.active = true
        const theta = Math.random() * Math.PI * 2
        w.at = { kind: 'ring', k: 0, theta }
        w.pos.copy(netPoint(w.at, w.lane))
        w.act = 'idle'
        w.goal = 'none'
        w.timer = Math.random() * 2
        w.partner = -1
        w.resume = null
        w.onShift = false
      }
      w.chatCooldown -= simDt

      // A finished construction site releases its builders; reassigned workers leave right away
      if (w.goal === 'build' && w.act === 'hammer' && !this.ctx.siteIds.has(w.target)) w.timer = 0
      if (this.ctxChanged && (w.goal === 'work' || w.goal === 'build') && w.act !== 'walk' && w.act !== 'talk' &&
        this.intendedTarget(w) !== w.target && !(this.ctx.expedition && this.jobOf(w)?.type === 'beacon')) w.timer = 0

      // State machine
      if (w.act === 'walk') {
        let step = simDt * WALK_SPEED * (w.child ? 1.1 : 1) * (sick ? 0.55 : 1) * (w.carry ? 0.85 : 1)
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
          if (w.goal === 'work' || w.goal === 'build') w.onShift = true
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
            } else this.decide(w, i, hour, s)
          } else this.decide(w, i, hour, s)
        }
      }

      // Time on site feeds the economy
      if (workNow && simDt > 0 && w.target) {
        const amount = simDt * weight
        if (!w.sick && w.onShift && (w.goal === 'work' || w.goal === 'errand')) {
          s.presence[w.target] = (s.presence[w.target] ?? 0) + amount
        } else if (!w.sick && w.onShift && (w.goal === 'build' || w.goal === 'fetch')) {
          s.buildPresence[w.target] = (s.buildPresence[w.target] ?? 0) + amount
        } else if (w.goal === 'school' && w.act === 'inside') {
          s.studyPresence[w.target] = (s.studyPresence[w.target] ?? 0) + amount
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
    this.ctxChanged = false
    this.bodies.finish(MAX)
  }
}
