import * as THREE from 'three'
import { CRATER_RADIUS, SPOKE_ANGLES, streetRadius } from '../grid'
import type { BuildingType, Cell } from '../types'
import type { NetPos } from './streets'
import { angDiff } from './streets'

/**
 * How workers of each building look while on shift:
 *  - dig:    stand around the building and shovel (mines, drill, cemetery)
 *  - craft:  hammer at workbenches around the building (sawmill, steelworks)
 *  - haul:   walk between heaps and the depot carrying crates
 *  - hunt:   leave for the crater rim and come back with game
 *  - inside: work indoors, now and then carry supplies to another building
 *  - scout:  wait at the beacon; during an expedition leave the crater until it returns
 */
export type WorkStyle = 'dig' | 'craft' | 'haul' | 'hunt' | 'inside' | 'scout'

export function workStyle(type: BuildingType): WorkStyle {
  switch (type) {
    case 'drill':
    case 'coalMine':
    case 'oreMine':
    case 'cemetery':
      return 'dig'
    case 'sawmill':
    case 'steelworks':
      return 'craft'
    case 'depot':
      return 'haul'
    case 'lodge':
      return 'hunt'
    case 'beacon':
      return 'scout'
    default:
      return 'inside'
  }
}

export interface Dest { anchor: NetPos; final: THREE.Vector3; face: THREE.Vector3 | null }

/** Spots around a building footprint, as (radial, tangential) offsets from the plot centre. */
const SLOTS: [number, number][] = [
  [-2.0, -1.0], [-2.0, 1.0], [-1.0, -2.1], [-1.0, 2.1], [-2.1, 0], [0.4, -2.1], [0.4, 2.1], [-1.6, -1.8],
]

/** A place right next to the building (front and sides), reached from its street door. */
export function siteSpot(cell: Cell, slot: number): Dest {
  const [dr, dt] = SLOTS[((slot % SLOTS.length) + SLOTS.length) % SLOTS.length]!
  const rad = new THREE.Vector3(Math.cos(cell.angle), 0, Math.sin(cell.angle))
  const tan = new THREE.Vector3(-Math.sin(cell.angle), 0, Math.cos(cell.angle))
  const center = new THREE.Vector3(cell.x, 0, cell.z)
  const jitter = (Math.random() - 0.5) * 0.25
  const final = center.clone().addScaledVector(rad, dr + jitter).addScaledVector(tan, dt + jitter)
  return {
    anchor: { kind: 'ring', k: cell.ring - 1, theta: cell.angle + (Math.random() - 0.5) * 0.05 },
    final,
    face: center,
  }
}

/** Point on the crater rim at the end of the avenue nearest to the cell (hunters' exit). */
export function rimSpot(cell: Cell): Dest {
  let j = 0
  let best = Infinity
  SPOKE_ANGLES.forEach((a, idx) => {
    const d = Math.abs(angDiff(a, cell.angle))
    if (d < best) { best = d; j = idx }
  })
  const r = CRATER_RADIUS - 2
  const a = SPOKE_ANGLES[j] ?? 0
  return {
    anchor: { kind: 'spoke', j, r },
    final: new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r),
    face: null,
  }
}

/** Spot on the innermost street facing the generator: coal is delivered here. */
export function furnaceSpot(): Dest {
  const theta = Math.random() * Math.PI * 2
  const r = streetRadius(0) + 0.05
  return {
    anchor: { kind: 'ring', k: 0, theta },
    final: new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r),
    face: new THREE.Vector3(0, 0, 0),
  }
}
