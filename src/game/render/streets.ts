import * as THREE from 'three'
import { GEN_RADIUS, RING_COUNT, RING_WIDTH, SPOKE_ANGLES, streetRadius } from '../grid'
import type { Cell } from '../types'

/**
 * Street network: ring streets run between the rings of plots and eight radial avenues
 * connect them. Citizens only walk on this network, so they never cut through buildings.
 */

export type NetPos =
  | { kind: 'ring'; k: number; theta: number }
  | { kind: 'spoke'; j: number; r: number }

const TAU = Math.PI * 2

export function angDiff(a: number, b: number): number {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d < -Math.PI) d += TAU
  return d
}

function spokeAngle(j: number): number {
  return SPOKE_ANGLES[j] ?? 0
}

function nearestStreet(r: number): number {
  return Math.max(0, Math.min(RING_COUNT, Math.round((r - GEN_RADIUS) / RING_WIDTH)))
}

function ringPt(k: number, theta: number, lane: number): THREE.Vector3 {
  const R = streetRadius(k) + lane
  return new THREE.Vector3(Math.cos(theta) * R, 0, Math.sin(theta) * R)
}

function spokePt(j: number, r: number, lane: number): THREE.Vector3 {
  const a = spokeAngle(j)
  return new THREE.Vector3(Math.cos(a) * r - Math.sin(a) * lane, 0, Math.sin(a) * r + Math.cos(a) * lane)
}

export function netPoint(p: NetPos, lane: number): THREE.Vector3 {
  return p.kind === 'ring' ? ringPt(p.k, p.theta, lane) : spokePt(p.j, p.r, lane)
}

function arc(k: number, from: number, to: number, lane: number, out: THREE.Vector3[]) {
  const d = angDiff(from, to)
  const R = streetRadius(k) + lane
  const steps = Math.max(1, Math.ceil((Math.abs(d) * R) / 1.0))
  for (let i = 1; i <= steps; i++) out.push(ringPt(k, from + (d * i) / steps, lane))
}

function spokeLine(j: number, r1: number, r2: number, lane: number, out: THREE.Vector3[]) {
  const steps = Math.max(1, Math.ceil(Math.abs(r2 - r1) / 1.5))
  for (let i = 1; i <= steps; i++) out.push(spokePt(j, r1 + ((r2 - r1) * i) / steps, lane))
}

/** Waypoints from network position a to b (the start point itself is not included). */
export function route(a: NetPos, b: NetPos, lane: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = []
  let A: { k: number; theta: number }
  if (a.kind === 'spoke') {
    const k = nearestStreet(a.r)
    spokeLine(a.j, a.r, streetRadius(k), lane, pts)
    A = { k, theta: spokeAngle(a.j) }
  } else {
    A = { k: a.k, theta: a.theta }
  }
  let B: { k: number; theta: number }
  const suffix: THREE.Vector3[] = []
  if (b.kind === 'spoke') {
    const k = nearestStreet(b.r)
    spokeLine(b.j, streetRadius(k), b.r, lane, suffix)
    B = { k, theta: spokeAngle(b.j) }
  } else {
    B = { k: b.k, theta: b.theta }
  }

  const RA = streetRadius(A.k)
  const RB = streetRadius(B.k)
  let best = A.k === B.k ? RA * Math.abs(angDiff(A.theta, B.theta)) : Infinity
  let bestJ = -1
  for (let j = 0; j < SPOKE_ANGLES.length; j++) {
    const phi = spokeAngle(j)
    const cost = RA * Math.abs(angDiff(A.theta, phi)) + Math.abs(RA - RB) + RB * Math.abs(angDiff(phi, B.theta))
    if (cost < best - 0.01) { best = cost; bestJ = j }
  }
  if (bestJ < 0) {
    arc(A.k, A.theta, B.theta, lane, pts)
  } else {
    const phi = spokeAngle(bestJ)
    arc(A.k, A.theta, phi, lane, pts)
    spokeLine(bestJ, RA, RB, lane, pts)
    arc(B.k, phi, B.theta, lane, pts)
  }
  pts.push(...suffix)
  return pts
}

/** Street spot in front of a plot's door (buildings face the generator). */
export function doorOf(cell: Cell): { anchor: NetPos; final: THREE.Vector3; face: THREE.Vector3 } {
  const k = cell.ring - 1
  const jitter = (Math.random() - 0.5) * 0.06
  const theta = cell.angle + jitter
  const r = streetRadius(k) + 0.6
  return {
    anchor: { kind: 'ring', k, theta },
    final: new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r),
    face: new THREE.Vector3(cell.x, 0, cell.z),
  }
}

export interface Plaza {
  j: number
  r: number
  center: THREE.Vector3
}

/** Open street cells on the avenues near the centre, used as gathering squares. */
export function plazasFrom(cells: Iterable<Cell>): Plaza[] {
  const out: Plaza[] = []
  for (const c of cells) {
    if (!c.road || c.ring > 3) continue
    let j = 0
    let bestD = Infinity
    SPOKE_ANGLES.forEach((a, idx) => {
      const d = Math.abs(angDiff(a, c.angle))
      if (d < bestD) { bestD = d; j = idx }
    })
    const r = c.inner + RING_WIDTH / 2
    out.push({ j, r, center: spokePt(j, r, 0) })
  }
  return out
}
