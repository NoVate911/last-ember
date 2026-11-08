import * as THREE from 'three'
import { type BuildFn, type Kit, M } from './kit'

/** Green cross emblem on a wall facing +z. */
function cross(k: Kit, x: number, y: number, z: number, s: number) {
  const m = M()
  k.boxC(s * 1.15, s * 1.15, 0.03, m.plaster, x, y, z - 0.01)
  k.boxC(s, s * 0.3, 0.05, m.emblem, x, y, z + 0.01)
  k.boxC(s * 0.3, s, 0.05, m.emblem, x, y, z + 0.01)
}

export const aid: BuildFn = (k, win) => {
  const m = M()
  k.box(3.0, 0.25, 2.7, m.stone)
  k.box(2.8, 1.6, 2.5, m.plaster, 0, 0.25, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.14, 1.6, 0.14, m.darkPlank, sx * 1.4, 0.25, sz * 1.25)
  k.box(2.9, 0.1, 2.6, m.darkPlank, 0, 1.85, 0)
  k.gableRoof(2.7, 3.0, 1.0, 1.9, m.shingle, m.plaster)
  cross(k, 0, 2.35, 1.27, 0.45)
  k.door(0, 1.26, 0.6, 1.1, 0, 0.25)
  k.window(-0.85, 1.05, 1.26, 0.5, 0.55, win)
  k.window(0.85, 1.05, 1.26, 0.5, 0.55, win)
  k.window(1.41, 1.05, 0.2, 0.5, 0.55, win, Math.PI / 2)
  const chimney = k.stovepipe(0.85, 2.1, -0.6, 0.9)
  // Canvas awning over a triage bench
  for (const z of [0.2, 1.2]) k.box(0.06, 1.5, 0.06, m.log, -1.95, 0, z)
  k.add(new THREE.BoxGeometry(0.75, 0.04, 1.3), m.canvas, [-1.75, 1.45, 0.7], [0, 0, 0.3])
  k.box(0.5, 0.06, 1.0, m.plank, -1.75, 0.45, 0.7)
  k.box(0.45, 0.04, 0.9, m.canvas, -1.75, 0.51, 0.7)
  // Stretcher leaning on the wall
  k.add(new THREE.BoxGeometry(0.5, 1.6, 0.04), m.canvas, [1.0, 0.85, -1.33], [0.15, 0, 0])
  k.lantern(-0.45, 1.5, 1.32, win)
  return { chimney }
}

export const hospital: BuildFn = (k, win) => {
  const m = M()
  k.box(3.6, 0.3, 2.8, m.stone)
  k.box(3.4, 2.6, 2.6, m.plaster, 0, 0.3, 0)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 6; i++) {
    k.boxC(i % 2 ? 0.2 : 0.3, 0.2, i % 2 ? 0.3 : 0.2, m.brick, sx * 1.67, 0.5 + i * 0.42, sz * 1.27)
  }
  k.box(3.5, 0.12, 2.7, m.darkPlank, 0, 1.55, 0)
  k.box(3.5, 0.14, 2.7, m.darkPlank, 0, 2.85, 0)
  k.gableRoof(2.8, 3.6, 1.2, 2.95, m.shingle, m.plaster)
  cross(k, 0, 3.45, 1.31, 0.55)
  for (const x of [-1.2, -0.55, 0.55, 1.2]) k.window(x, 2.2, 1.31, 0.4, 0.55, win)
  for (const x of [-1.2, 1.2]) k.window(x, 1.0, 1.31, 0.45, 0.6, win)
  k.window(1.71, 1.0, 0, 0.45, 0.6, win, Math.PI / 2)
  k.window(1.71, 2.2, 0, 0.45, 0.55, win, Math.PI / 2)
  k.door(0, 1.31, 0.75, 1.15, 0, 0.3)
  // Entrance canopy on posts
  for (const x of [-0.6, 0.6]) k.box(0.08, 1.4, 0.08, m.iron, x, 0.3, 1.95)
  k.add(new THREE.BoxGeometry(1.5, 0.06, 0.8), m.metal, [0, 1.75, 1.65], [0.15, 0, 0])
  k.add(new THREE.BoxGeometry(1.45, 0.05, 0.75), m.snow, [0, 1.8, 1.65], [0.15, 0, 0])
  const chimney = k.chimney(-1.1, 2.9, -0.6, 1.5)
  k.lantern(0.6, 1.55, 1.95, win)
  k.drift(0, -1.5, 3.4, 0.6)
  return { chimney }
}

export const relay: BuildFn = (k, win) => {
  const m = M()
  k.cyl(1.35, 1.55, 0.5, m.stone, 0, 0, 0, 8)
  k.cyl(1.0, 1.1, 0.15, m.metal, 0, 0.5, 0, 8)
  k.cyl(0.55, 0.72, 3.6, m.metal, 0, 0.6, 0, 14)
  for (const y of [1.3, 2.3, 3.3]) {
    k.torus(0.68 - (y - 1.3) * 0.05, 0.07, m.brass, 0, y, 0, [Math.PI / 2, 0, 0], 20)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      const r = 0.7 - (y - 1.3) * 0.05
      k.sphere(0.025, m.iron, Math.cos(a) * r, y + 0.12, Math.sin(a) * r, [1, 1, 1], 5)
    }
  }
  // Glowing heat core in an iron cage
  k.sphere(0.45, win, 0, 4.5, 0, [1, 1, 1], 16)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    k.bar([Math.cos(a) * 0.4, 4.15, Math.sin(a) * 0.4], [Math.cos(a) * 0.15, 4.95, Math.sin(a) * 0.15], 0.04, m.iron)
  }
  k.cone(0.35, 0.25, m.iron, 0, 4.95, 0, 12)
  k.torus(0.48, 0.04, m.iron, 0, 4.2, 0, [Math.PI / 2, 0, 0], 16)
  // Steam pipes running out to the neighbours, with valve wheels
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const c = Math.cos(a), s = Math.sin(a)
    k.beam([c * 0.6, 1.6, s * 0.6], [c * 1.3, 1.0, s * 1.3], 0.1, m.copper)
    k.beam([c * 1.3, 1.0, s * 1.3], [c * 1.6, 0.0, s * 1.6], 0.1, m.copper)
    k.sphere(0.13, m.copper, c * 1.3, 1.0, s * 1.3, [1, 1, 1], 8)
    k.torus(0.1, 0.018, m.iron, c * 1.0, 1.32, s * 1.0, [0, -a, 0], 10)
  }
  // Pressure gauge
  k.add(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 16), m.brass, [0, 2.0, 0.66], [Math.PI / 2, 0, 0])
  k.add(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 16), m.plaster, [0, 2.0, 0.69], [Math.PI / 2, 0, 0])
  k.boxC(0.02, 0.1, 0.01, m.iron, 0.03, 2.03, 0.71, [0, 0, -0.6])
  return {}
}

export const cemetery: BuildFn = (k, win) => {
  const m = M()
  k.box(3.5, 0.08, 3.1, m.snow)
  // Fence with a gate arch at the front
  const fence: [number, number, number, number][] = [[-1.7, -1.5, 1.7, -1.5], [-1.7, -1.5, -1.7, 1.5], [1.7, -1.5, 1.7, 1.5], [-1.7, 1.5, -0.45, 1.5], [0.45, 1.5, 1.7, 1.5]]
  for (const [x1, z1, x2, z2] of fence) {
    const n = Math.max(2, Math.round(Math.hypot(x2 - x1, z2 - z1) / 0.55))
    for (let i = 0; i <= n; i++) k.box(0.07, 0.75, 0.07, m.darkPlank, x1 + ((x2 - x1) * i) / n, 0, z1 + ((z2 - z1) * i) / n)
    for (const y of [0.3, 0.6]) k.bar([x1, y, z1], [x2, y, z2], 0.04, m.darkPlank)
  }
  for (const x of [-0.45, 0.45]) k.box(0.12, 1.7, 0.12, m.log, x, 0, 1.5)
  k.bar([-0.55, 1.7, 1.5], [0.55, 1.7, 1.5], 0.12, m.log)
  k.box(1.2, 0.06, 0.2, m.snow, 0, 1.76, 1.5)
  k.lantern(0, 1.5, 1.5, win)
  // Rows of graves: mounds with crosses and a few headstones
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const x = -1.2 + c * 0.8
    const z = -1.1 + r * 0.85
    k.sphere(0.32, m.snow, x, 0.05, z + 0.2, [0.7, 0.25, 1.1], 8)
    if ((r + c) % 3 === 0) {
      k.box(0.36, 0.45, 0.1, m.stone, x, 0.05, z - 0.15)
      k.add(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 12, 1, false, 0, Math.PI), m.stone, [x, 0.5, z - 0.15], [Math.PI / 2, Math.PI / 2, 0])
    } else {
      k.box(0.06, 0.6, 0.05, m.darkPlank, x, 0.05, z - 0.15)
      k.box(0.32, 0.06, 0.05, m.darkPlank, x, 0.45, z - 0.15)
      k.box(0.08, 0.03, 0.08, m.snow, x, 0.65, z - 0.15)
    }
  }
  // Dead tree in the corner
  k.bar([1.45, 0, -1.25], [1.35, 1.8, -1.2], 0.1, m.log)
  k.bar([1.38, 1.2, -1.22], [1.0, 1.6, -1.0], 0.05, m.log)
  k.bar([1.36, 1.5, -1.2], [1.7, 1.95, -1.3], 0.04, m.log)
  return {}
}

export const arena: BuildFn = (k, win) => {
  const m = M()
  k.cyl(1.55, 1.6, 0.3, m.plank, 0, 0, 0, 16)
  k.cyl(1.5, 1.5, 0.02, m.canvas, 0, 0.3, 0, 16)
  // Ring posts and ropes
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    k.cyl(0.06, 0.07, 1.3, m.log, Math.cos(a) * 1.4, 0.3, Math.sin(a) * 1.4, 6)
    k.sphere(0.07, m.brass, Math.cos(a) * 1.4, 1.62, Math.sin(a) * 1.4, [1, 1, 1], 6)
  }
  for (const y of [0.8, 1.2]) k.torus(1.4, 0.025, m.rope, 0, y, 0, [Math.PI / 2, 0, 0], 32)
  // Benches for spectators at the sides
  for (const sx of [-1, 1]) {
    k.box(0.35, 0.08, 1.6, m.plank, sx * 1.85, 0.4, 0)
    for (const z of [-0.6, 0.6]) k.box(0.3, 0.4, 0.08, m.darkPlank, sx * 1.85, 0, z)
  }
  // Torches and banners
  for (const [x, z] of [[-1.7, 1.5], [1.7, 1.5], [-1.7, -1.5], [1.7, -1.5]] as const) {
    k.cyl(0.04, 0.05, 1.7, m.log, x, 0, z, 6)
    k.cyl(0.1, 0.06, 0.15, m.iron, x, 1.7, z, 8)
    k.cone(0.09, 0.22, win, x, 1.82, z, 8)
  }
  for (const sx of [-1, 1]) {
    k.cyl(0.03, 0.03, 2.3, m.iron, sx * 0.8, 0, -1.65, 6)
    k.add(new THREE.BoxGeometry(0.02, 0.6, 0.45), m.cloth, [sx * 0.8, 1.95, -1.42], [0, Math.PI / 2, 0])
  }
  // Bell on a post
  k.box(0.08, 1.5, 0.08, m.log, 1.3, 0, 1.75)
  k.bar([1.3, 1.5, 1.75], [1.0, 1.5, 1.75], 0.05, m.log)
  k.cone(0.12, 0.18, m.brass, 1.05, 1.27, 1.75, 10)
  return {}
}
