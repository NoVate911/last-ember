import * as THREE from 'three'
import { outsideTemp, tempToLevel } from '../data'
import { streetRadius } from '../grid'
import { isWorkHour, totalPop } from '../simulation'
import type { Cell, GameState } from '../types'
import { CitizenBodies, basePose, type Pose } from './citizenBody'
import { type NetPos, type Plaza, angDiff, doorOf, netPoint, plazasFrom, route } from './streets'

/**
 * Citizen life simulation (visual only): every person has a home, possibly a job,
 * follows a daily routine along the streets, stops to chat, warms up at the generator,
 * shovels at resource heaps, hauls crates and plays (children).
 */

const MAX = 120
const ORIGIN = new THREE.Vector3(0, 0, 0)

type Act = 'walk' | 'inside' | 'idle' | 'warm' | 'talk' | 'shovel' | 'play'
type Goal = 'home' | 'work' | 'errand' | 'plaza' | 'warm' | 'canteen' | 'medic' | 'visit' | 'none'

interface Dest { anchor: NetPos; final: THREE.Vector3; face: THREE.Vector3 | null }

interface Resume { arriveAct: Act; arriveTime: number; arriveFace: THREE.Vector3 | null; goal: Goal }

interface Citizen {
  pos: THREE.Vector3
  yaw: number
  at: NetPos
  path: THREE.Vector3[]
  pi: number
  act: Act
  arriveAct: Act
  arriveTime: number
  arriveFace: THREE.Vector3 | null
  goal: Goal
  timer: number
  face: THREE.Vector3 | null
  partner: number
  resume: Resume | null
  child: boolean
  pack: boolean
  scale: number
  lane: number
  carry: boolean
  phase: number
  seed: number
  active: boolean
  workCycles: number
  chatCooldown: number
  adultIndex: number
}

interface Ctx {
  key: string
  homes: Cell[]
  jobs: { cell: Cell; pile: boolean }[]
  canteens: Cell[]
  medics: Cell[]
  others: Cell[]
}

export class Walkers {
  private bodies: CitizenBodies
  mesh: THREE.Group
  private people: Citizen[] = []
  private plazas: Plaza[] = []
  private ctx: Ctx = { key: '', homes: [], jobs: [], canteens: [], medics: [], others: [] }
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
        workCycles: 0, chatCooldown: rnd() * 10, adultIndex: child ? -1 : adult++,
      })
    }
  }

  // ---------- Context ----------
  private refreshCtx(s: GameState) {
    const key = `${Math.floor(s.time)}|${s.buildings.length}|${s.piles.length}|${s.laws.length}`
    if (key === this.ctx.key) return
    const cellOf = (id: string) => s.cells.get(id)
    const homes: Cell[] = []
    const jobs: Ctx['jobs'] = []
    const canteens: Cell[] = []
    const medics: Cell[] = []
    const others: Cell[] = []
    for (const b of s.buildings) {
      const c = cellOf(b.cellId)
      if (!c || !b.built) continue
      if (b.type === 'tent' || b.type === 'bunkhouse' || b.type === 'house') { homes.push(c); continue }
      others.push(c)
      if (b.type === 'canteen') canteens.push(c)
      if ((b.type === 'aid' || b.type === 'hospital') && b.assigned > 0) medics.push(c)
      for (let n = 0; n < b.assigned; n++) jobs.push({ cell: c, pile: false })
    }
    for (const p of s.piles) {
      const c = cellOf(p.cellId)
      if (!c) continue
      for (let n = 0; n < p.assigned; n++) jobs.push({ cell: c, pile: true })
    }
    // Interleave jobs so visible people spread over all workplaces
    jobs.sort((a, b) => a.cell.id.localeCompare(b.cell.id))
    const spread: Ctx['jobs'] = []
    const groups = new Map<string, Ctx['jobs']>()
    for (const j of jobs) groups.set(j.cell.id, [...(groups.get(j.cell.id) ?? []), j])
    while (spread.length < jobs.length) {
      for (const g of groups.values()) { const j = g.shift(); if (j) spread.push(j) }
    }
    this.ctx = { key, homes, jobs: spread, canteens, medics, others }
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

    if (working && job) {
      if (w.goal === 'work') {
        w.workCycles++
        if (job.pile) {
          if (w.workCycles % 3 === 0) {
            w.carry = true
            this.goTo(w, this.warmSpot(), 'errand', 'idle', 1.5)
          } else this.stay(w, 'shovel', 8 + rand * 6)
        } else if (rand < 0.35 && ctx.others.length > 1) {
          const target = ctx.others[Math.floor(Math.random() * ctx.others.length)]!
          w.carry = true
          this.goTo(w, doorOf(target), 'errand', 'idle', 2)
        } else this.stay(w, 'inside', 8 + rand * 8)
        return
      }
      const d = doorOf(job.cell)
      this.goTo(w, d, 'work', job.pile ? 'shovel' : 'inside', job.pile ? 10 : 12)
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
    for (let i = 0; i < count; i++) {
      const a = this.people[i]!
      if (!a.active || a.partner >= 0 || a.chatCooldown > 0 || a.carry) continue
      if (a.act !== 'walk' && a.act !== 'idle' && a.act !== 'warm') continue
      for (let j = i + 1; j < count; j++) {
        const b = this.people[j]!
        if (!b.active || b.partner >= 0 || b.chatCooldown > 0 || b.carry) continue
        if (b.act !== 'walk' && b.act !== 'idle' && b.act !== 'warm') continue
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

      // State machine
      if (w.act === 'walk') {
        let step = simDt * 1.25 * (w.child ? 1.1 : 1) * (sick ? 0.55 : 1)
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
          if (w.goal === 'work') w.workCycles = 0
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

      this.buildPose(p, w, i, t, simDt, sick, cold)
      this.bodies.apply(i, p)
    }
    this.bodies.finish(MAX)
  }

  private buildPose(p: Pose, w: Citizen, i: number, t: number, simDt: number, sick: boolean, cold: boolean) {
    Object.assign(p, basePose())
    p.x = w.pos.x
    p.z = w.pos.z
    p.yaw = w.yaw
    p.scale = w.scale
    p.pack = w.pack
    const off = w.seed * 50

    switch (w.act) {
      case 'inside':
        p.hidden = true
        return
      case 'walk': {
        w.phase += simDt * (w.child ? 11 : 8.5) * (sick ? 0.6 : 1)
        const sw = Math.sin(w.phase)
        p.legL = sw * 0.55
        p.legR = -sw * 0.55
        p.bob = Math.abs(Math.cos(w.phase)) * 0.035 * w.scale
        p.lean = sick ? 0.32 : w.child ? 0.05 : 0.12
        if (w.carry) {
          p.armLX = p.armRX = -0.95
          p.armLZ = p.armRZ = -0.05
          p.crate = true
        } else {
          p.armLX = -sw * (sick ? 0.15 : 0.45)
          p.armRX = sw * (sick ? 0.15 : 0.45)
        }
        break
      }
      case 'idle':
        p.lean = 0.03
        p.nod = Math.sin(t * 0.5 + off) * 0.05
        p.yaw += Math.sin(t * 0.3 + off) * 0.15
        break
      case 'warm':
        p.lean = 0.08
        p.armLX = p.armRX = -1.25 + Math.sin(t * 7 + off) * 0.06
        p.armLZ = p.armRZ = -0.28
        p.nod = 0.1
        break
      case 'talk': {
        const partner = w.partner >= 0 ? this.people[w.partner] : undefined
        // In pairs people take turns; in groups several may speak at once
        const turn = partner ? Math.sin(t * 0.9 + Math.min(i, w.partner)) * (i < w.partner ? 1 : -1) > 0 : Math.sin(t * 0.7 + off) > 0.35
        if (turn) {
          p.armRX = -0.6 + Math.sin(t * 5 + off) * 0.35
          p.armRZ = 0.35 + Math.sin(t * 3 + off) * 0.12
          p.armLX = -0.25 + Math.sin(t * 4 + off + 1) * 0.15
          p.nod = Math.sin(t * 6 + off) * 0.07
        } else {
          p.nod = Math.sin(t * 1.7 + off) > 0.9 ? 0.2 : 0.02
          p.armLZ = p.armRZ = 0.06
        }
        p.lean = 0.04
        break
      }
      case 'shovel': {
        const c = Math.sin(t * 3 + off)
        p.lean = 0.3 + (c + 1) * 0.18
        p.armLX = p.armRX = -0.5 - (c + 1) * 0.35
        p.armLZ = p.armRZ = -0.1
        p.legL = 0.18
        p.legR = -0.12
        p.tool = true
        break
      }
      case 'play': {
        const hop = Math.abs(Math.sin(t * 6 + off))
        p.bob = hop * 0.16 * w.scale
        w.yaw += simDt * 1.8
        p.yaw = w.yaw
        p.armRX = -2.6 + Math.sin(t * 8 + off) * 0.3
        p.armLX = -0.4 + Math.sin(t * 6 + off) * 0.3
        p.legL = Math.sin(t * 12 + off) * 0.3
        p.legR = -p.legL
        break
      }
    }
    // Shiver in the cold when standing still
    if (cold && (w.act === 'idle' || w.act === 'talk')) p.yaw += Math.sin(t * 45 + off) * 0.03
    if (w.goal === 'warm' && w.act === 'warm') {
      // keep a respectful distance from the furnace
      const r = Math.hypot(p.x, p.z)
      const min = streetRadius(0) - 0.05
      if (r < min && r > 0) { p.x *= min / r; p.z *= min / r }
    }
  }
}
