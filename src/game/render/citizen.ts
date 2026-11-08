import * as THREE from 'three'
import { streetRadius } from '../grid'
import { basePose, type Pose } from './citizenBody'
import type { NetPos } from './streets'

export type Act = 'walk' | 'inside' | 'idle' | 'warm' | 'talk' | 'shovel' | 'hammer' | 'play'
export type Goal = 'home' | 'work' | 'build' | 'fetch' | 'errand' | 'plaza' | 'warm' | 'canteen' | 'medic' | 'rest' | 'school' | 'visit' | 'none'
export type Role = 'worker' | 'engineer' | 'child'

export interface Resume { arriveAct: Act; arriveTime: number; arriveFace: THREE.Vector3 | null; goal: Goal }

export interface Citizen {
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
  /** Population group this person belongs to (re-derived every frame from the city population) */
  role: Role
  /** Index inside the role group: decides which job / site / school seat the person takes */
  roleIdx: number
  /** Reached the workplace or site and is now on shift (presence counts toward output) */
  onShift: boolean
  sick: boolean
  /** Construction site / workplace slot so co-workers spread around a building */
  slot: number
  /** Cell id of the workplace or construction site the citizen is attached to */
  target: string
}

/** Turns a citizen's current activity into a body pose for this frame. */
export function buildPose(p: Pose, w: Citizen, i: number, t: number, simDt: number, sick: boolean, cold: boolean) {
  Object.assign(p, basePose())
  p.x = w.pos.x
  p.z = w.pos.z
  p.yaw = w.yaw
  p.scale = w.scale
  p.pack = w.pack && !w.child
  p.beard = !w.child && w.seed > 0.62
  p.goggles = !w.child && w.seed > 0.3 && w.seed < 0.45
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
      const hasPartner = w.partner >= 0
      // In pairs people take turns; in groups several may speak at once
      const turn = hasPartner ? Math.sin(t * 0.9 + Math.min(i, w.partner)) * (i < w.partner ? 1 : -1) > 0 : Math.sin(t * 0.7 + off) > 0.35
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
    case 'hammer': {
      // Quick raise and a hard strike, with a short pause between blows
      const cyc = (t * 1.6 + off) % 1
      const lift = cyc < 0.6 ? cyc / 0.6 : 1 - (cyc - 0.6) / 0.12
      const k = Math.max(0, Math.min(1, lift))
      p.armRX = -0.7 - k * 1.6
      p.armRZ = 0.12
      p.armLX = -0.75
      p.armLZ = -0.15
      p.lean = 0.28 + (1 - k) * 0.12
      p.legL = 0.22
      p.legR = -0.16
      p.nod = 0.15
      p.bob = -0.04 * w.scale
      p.hammer = true
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
