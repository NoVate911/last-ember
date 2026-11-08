import * as THREE from 'three'
import type { PileKind } from '../../types'
import { Kit, M } from './kit'

/** Construction scaffold: poles, braces, plank platforms and a ladder. */
export function createScaffold(): THREE.Group {
  const m = M()
  const k = new Kit()
  const corners: [number, number][] = [[-1.5, -1.3], [1.5, -1.3], [-1.5, 1.3], [1.5, 1.3]]
  for (const [x, z] of corners) {
    k.cyl(0.05, 0.05, 2.9, m.log, x, 0, z, 6)
    k.box(0.2, 0.06, 0.2, m.darkPlank, x, 0, z)
  }
  for (const y of [1.0, 2.0, 2.8]) {
    k.bar([-1.5, y, 1.3], [1.5, y, 1.3], 0.06, m.log)
    k.bar([-1.5, y, -1.3], [1.5, y, -1.3], 0.06, m.log)
    k.bar([1.5, y, -1.3], [1.5, y, 1.3], 0.06, m.log)
    k.bar([-1.5, y, -1.3], [-1.5, y, 1.3], 0.06, m.log)
  }
  // Diagonal braces
  k.bar([-1.5, 0.1, 1.3], [1.5, 2.0, 1.3], 0.05, m.log)
  k.bar([-1.5, 0.1, -1.3], [1.5, 2.0, -1.3], 0.05, m.log)
  k.bar([1.5, 0.1, -1.3], [1.5, 2.0, 1.3], 0.05, m.log)
  // Plank walkways
  for (const y of [1.03, 2.03]) {
    k.box(3.1, 0.05, 0.4, m.plank, 0, y, 1.45)
    k.box(0.4, 0.05, 2.7, m.plank, 1.65, y, 0)
  }
  // Ladder
  for (const x of [-1.05, -0.75]) k.bar([x, 0, 1.65], [x, 2.1, 1.5], 0.04, m.log)
  for (let i = 0; i < 7; i++) k.bar([-1.05, 0.25 + i * 0.28, 1.63 - i * 0.02], [-0.75, 0.25 + i * 0.28, 1.63 - i * 0.02], 0.03, m.log)
  // Materials waiting on site
  for (let i = 0; i < 4; i++) k.box(1.2, 0.07, 0.3, m.plank, -0.6, i * 0.08, -1.75, [0, (i % 2) * 0.08, 0])
  k.crate(0.9, 0, -1.75, 0.4)
  k.barrel(1.35, 0, -1.75, 0.18, 0.45)
  return k.build()
}

/** A heap of loose resources lying in the snow. */
export function createPileMesh(kind: PileKind, seed: number): THREE.Group {
  const m = M()
  const k = new Kit()
  let s = seed * 9301 + 49297
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  if (kind === 'coal') {
    k.cone(1.7, 1.35, m.coal, 0, 0, 0, 12)
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2
      const d = 0.4 + rnd() * 1.6
      const r = 0.15 + rnd() * 0.3
      k.add(new THREE.DodecahedronGeometry(r, 0), m.coal, [Math.cos(a) * d, r * 0.5 + Math.max(0, (1.6 - d)) * 0.6, Math.sin(a) * d], [rnd() * 3, rnd() * 3, 0])
    }
    k.cone(0.7, 0.35, m.snow, 0, 1.0, 0, 12)
    k.add(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), m.snow, [0.9, 0, -0.9], [0, 0, 0], [0.8, 0.35, 0.6])
    // Abandoned mine cart
    k.box(0.7, 0.4, 0.5, m.rust, -1.5, 0.12, 1.2, [0, 0.5, 0])
    for (const dx of [-0.25, 0.25]) k.add(new THREE.CylinderGeometry(0.11, 0.11, 0.6, 10), m.iron, [-1.5 + dx * Math.cos(0.5), 0.11, 1.2 - dx * Math.sin(0.5)], [Math.PI / 2, 0.5, 0])
  } else if (kind === 'wood') {
    // Ruined hut: broken beams, planks and crates
    for (let i = 0; i < 6; i++) {
      k.crate((rnd() - 0.5) * 2.4, i > 3 ? 0.5 : 0, (rnd() - 0.5) * 2.4, 0.5 + rnd() * 0.25, rnd() * 2)
    }
    for (let i = 0; i < 5; i++) {
      const a = rnd() * Math.PI
      k.add(new THREE.CylinderGeometry(0.15, 0.17, 2.4, 8), m.log, [(rnd() - 0.5) * 0.8, 0.18 + (i % 3) * 0.3, (rnd() - 0.5) * 0.8], [Math.PI / 2, a, 0.1])
    }
    for (let i = 0; i < 6; i++) {
      k.add(new THREE.BoxGeometry(2.0, 0.06, 0.28), m.plank, [(rnd() - 0.5) * 1.6, 0.6 + rnd() * 0.5, (rnd() - 0.5) * 1.6], [rnd() * 0.6 - 0.3, rnd() * 3, rnd() * 0.5 - 0.25])
    }
    k.add(new THREE.BoxGeometry(1.5, 1.0, 0.08), m.darkPlank, [-1.0, 0.45, -1.0], [-0.5, 0.6, 0.1])
    k.add(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), m.snow, [0, 0, 0], [0, 0, 0], [1.6, 0.35, 1.5])
  } else {
    // Scrapyard: girders, plates, pipes, a wheel
    for (let i = 0; i < 7; i++) {
      const L = 1.4 + rnd() * 1.2
      k.add(new THREE.BoxGeometry(L, 0.18, 0.22), m.rust, [(rnd() - 0.5) * 1.6, 0.1 + i * 0.12, (rnd() - 0.5) * 1.8], [rnd() * 0.3, rnd() * 3, rnd() * 0.2])
      k.add(new THREE.BoxGeometry(L, 0.04, 0.05), m.iron, [(rnd() - 0.5) * 1.6, 0.25 + i * 0.12, (rnd() - 0.5) * 1.8], [0, rnd() * 3, 0])
    }
    for (let i = 0; i < 3; i++) k.add(new THREE.BoxGeometry(1.1, 0.06, 0.9), m.metal, [(rnd() - 0.5) * 1.4, 0.5 + i * 0.2, (rnd() - 0.5) * 1.4], [rnd() * 0.8 - 0.4, rnd() * 3, rnd() * 0.8 - 0.4])
    for (let i = 0; i < 3; i++) k.add(new THREE.CylinderGeometry(0.15, 0.15, 1.6, 10, 1, true), m.copper, [(rnd() - 0.5) * 1.8, 0.2, (rnd() - 0.5) * 1.8], [Math.PI / 2, rnd() * 3, 0])
    k.torus(0.55, 0.12, m.rust, -0.7, 0.45, 0.7, [1.2, 0.3, 0], 16)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      k.add(new THREE.BoxGeometry(0.15, 0.15, 0.15), m.rust, [-0.7 + Math.cos(a) * 0.68, 0.45 + Math.sin(a) * 0.68 * Math.cos(1.2), 0.7 + Math.sin(a) * 0.68 * Math.sin(1.2)], [0, 0, a])
    }
    k.add(new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), m.snow, [0.6, 0, -0.6], [0, 0, 0], [1.1, 0.3, 1.0])
  }
  return k.build()
}

/** Dark patch left where a heap was: shows the deposit a mine can be built on. */
export function createDepositMark(kind: PileKind): THREE.Group {
  const m = M()
  const k = new Kit()
  const mat = kind === 'coal' ? m.coal : kind === 'steel' ? m.ore : m.darkPlank
  k.add(new THREE.CylinderGeometry(1.5, 1.6, 0.04, 16), mat, [0, 0.02, 0])
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7
    const d = 0.4 + (i % 3) * 0.4
    k.add(new THREE.DodecahedronGeometry(0.12 + (i % 3) * 0.06, 0), mat, [Math.cos(a) * d, 0.08, Math.sin(a) * d], [i, i * 2, 0])
  }
  // Survey stakes with flags
  for (const [x, z] of [[1.3, 0.6], [-1.2, -0.8]] as const) {
    k.cyl(0.025, 0.025, 0.8, m.log, x, 0, z, 5)
    k.add(new THREE.BoxGeometry(0.02, 0.15, 0.22), m.cloth, [x, 0.7, z + 0.11])
  }
  return k.build()
}
