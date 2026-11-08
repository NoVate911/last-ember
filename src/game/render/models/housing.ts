import * as THREE from 'three'
import { type BuildFn, Kit, M } from './kit'

/** Flat triangle (or polygon) extruded to a thin slab, in the XY plane facing +z. */
export function slab(points: [number, number][], depth: number): THREE.BufferGeometry {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)))
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false })
  g.translate(0, 0, -depth / 2)
  return g
}

/** Interlocking log-cabin walls with a plank core so there are no gaps. */
export function logWalls(k: Kit, w: number, d: number, h: number, y: number, z: number, mat: THREE.Material) {
  const m = M()
  const r = 0.12
  const rows = Math.round(h / (r * 2))
  k.box(w - 0.1, h, d - 0.1, m.darkPlank, 0, y, z)
  for (let i = 0; i < rows; i++) {
    const ly = y + r + i * r * 2
    for (const sz of [1, -1]) k.add(new THREE.CylinderGeometry(r, r, w + 0.3, 8), mat, [0, ly, z + sz * (d / 2)], [0, 0, Math.PI / 2])
    for (const sx of [1, -1]) k.add(new THREE.CylinderGeometry(r, r, d + 0.3, 8), mat, [sx * (w / 2), ly + r * 0.5, z], [Math.PI / 2, 0, 0])
  }
}

export const tent: BuildFn = (k, win) => {
  const m = M()
  const W = 2.6, H = 1.9, D = 2.8
  const tilt = Math.atan2(W / 2, H)
  const sl = Math.hypot(W / 2, H)
  k.box(W + 0.2, 0.03, D + 0.2, m.canvas, 0, 0, 0)
  for (const sx of [-1, 1]) {
    k.add(new THREE.BoxGeometry(0.04, sl, D), m.canvas, [sx * W / 4, H / 2, 0], [0, 0, sx * tilt])
    k.add(new THREE.BoxGeometry(0.05, sl * 0.4, D * 0.96), m.snow, [sx * W / 8.5, H * 0.82, 0], [0, 0, sx * tilt])
    // A-poles front and back
    for (const sz of [-1, 1]) k.bar([sx * (W / 2 + 0.05), 0, sz * (D / 2 + 0.04)], [0, H + 0.12, sz * (D / 2 + 0.04)], 0.07, m.log)
    // Guy ropes to stakes
    k.beam([sx * W / 4, H / 2, 0], [sx * 1.75, 0, 0.6], 0.012, m.rope, 4)
    k.beam([sx * W / 4, H / 2, -0.8], [sx * 1.75, 0, -1.2], 0.012, m.rope, 4)
    k.box(0.05, 0.25, 0.05, m.log, sx * 1.75, 0, 0.6)
    k.box(0.05, 0.25, 0.05, m.log, sx * 1.75, 0, -1.2)
  }
  k.beam([0, H + 0.08, -D / 2 - 0.2], [0, H + 0.08, D / 2 + 0.2], 0.05, m.log)
  // Back wall and a half-open front flap
  k.add(slab([[-W / 2, 0], [W / 2, 0], [0, H]], 0.03), m.canvas, [0, 0, -D / 2])
  k.add(slab([[-W / 2, 0], [0, 0], [0, H]], 0.03), m.canvas, [0, 0, D / 2])
  k.add(slab([[0, 0], [W / 2, 0], [0, H]], 0.03), m.canvas, [0.02, 0, D / 2 + 0.02], [0, -1.1, 0])
  k.add(slab([[0, 0], [W / 2 - 0.1, 0], [0, H - 0.15]], 0.02), m.iron, [0, 0, D / 2 - 0.08])
  k.lantern(0.25, 1.15, D / 2 - 0.25, win)
  // Camp props
  k.crate(-1.45, 0, 1.55, 0.45, 0.4)
  k.barrel(1.5, 0, -1.5)
  k.woodpile(1.45, 1.3, 0.3, 2)
  k.drift(0, -D / 2 - 0.2, 2.8, 0.7)
  return {}
}

export const bunkhouse: BuildFn = (k, win) => {
  const m = M()
  k.box(3.4, 0.25, 2.4, m.stone)
  logWalls(k, 3.1, 2.1, 1.45, 0.25, 0, m.log)
  k.gableRoof(2.6, 3.4, 1.0, 1.7, m.darkPlank, m.plank)
  k.door(0, 1.08, 0.6, 1.1, 0, 0.25)
  k.window(-0.95, 1.05, 1.1, 0.5, 0.45, win)
  k.window(0.95, 1.05, 1.1, 0.5, 0.45, win)
  k.window(1.62, 1.05, 0, 0.5, 0.45, win, Math.PI / 2)
  k.window(-1.62, 1.05, 0, 0.5, 0.45, win, -Math.PI / 2)
  const chimney = k.stovepipe(1.0, 2.1, -0.5, 0.9)
  k.lantern(0.5, 1.45, 1.22, win)
  k.woodpile(-1.2, 1.55, 0, 3)
  k.drift(0, -1.25, 3.2, 0.6)
  k.drift(1.75, 0, 0.6, 2.0)
  return { chimney }
}

export const house: BuildFn = (k, win) => {
  const m = M()
  k.box(3.0, 0.3, 2.8, m.stone)
  k.box(2.8, 2.2, 2.6, m.stone, 0, 0.3, 0)
  k.box(2.92, 0.12, 2.72, m.darkPlank, 0, 1.35, 0)
  k.box(2.92, 0.14, 2.72, m.darkPlank, 0, 2.45, 0)
  // Plaster quoins on the corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 5; i++) {
    const big = i % 2 === 0
    k.boxC(big ? 0.34 : 0.2, 0.2, big ? 0.2 : 0.34, m.plaster, sx * 1.35, 0.5 + i * 0.42, sz * 1.25)
  }
  k.gableRoof(2.9, 3.0, 1.3, 2.52, m.shingle, m.stone)
  for (const x of [-0.85, 0.85]) {
    k.window(x, 0.95, 1.31, 0.5, 0.6, win)
    k.window(x, 1.95, 1.31, 0.5, 0.55, win)
  }
  k.window(1.41, 1.95, 0.4, 0.45, 0.5, win, Math.PI / 2)
  k.window(-1.41, 0.95, -0.4, 0.45, 0.55, win, -Math.PI / 2)
  k.door(0, 1.3, 0.55, 1.0, 0, 0.3)
  // Door awning on brackets
  k.add(new THREE.BoxGeometry(0.95, 0.06, 0.55), m.darkPlank, [0, 1.48, 1.52], [0.35, 0, 0])
  k.add(new THREE.BoxGeometry(0.9, 0.05, 0.5), m.snow, [0, 1.53, 1.52], [0.35, 0, 0])
  for (const x of [-0.42, 0.42]) k.bar([x, 1.2, 1.31], [x, 1.42, 1.72], 0.05, m.iron)
  const chimney = k.chimney(-0.8, 2.6, -0.5, 1.5)
  k.lampPost(1.25, 1.65, win, 1.6)
  k.drift(0, -1.5, 3, 0.6)
  return { chimney }
}

export const lodge: BuildFn = (k, win) => {
  const m = M()
  k.box(2.9, 0.2, 2.3, m.stone, 0, 0, -0.35)
  logWalls(k, 2.6, 2.0, 1.4, 0.2, -0.35, m.log)
  k.gableRoof(2.3, 3.0, 1.0, 1.6, m.darkPlank, m.log, -0.35)
  // Porch
  k.box(2.8, 0.12, 0.9, m.plank, 0, 0.08, 1.1)
  for (const x of [-1.25, 1.25]) k.box(0.12, 1.5, 0.12, m.log, x, 0.2, 1.45)
  k.add(new THREE.BoxGeometry(2.9, 0.07, 1.0), m.darkPlank, [0, 1.66, 1.05], [0.25, 0, 0])
  k.add(new THREE.BoxGeometry(2.8, 0.06, 0.9), m.snow, [0, 1.71, 1.05], [0.25, 0, 0])
  k.door(0, 0.67, 0.55, 1.05, 0, 0.2)
  k.window(-0.85, 0.95, 0.68, 0.42, 0.4, win)
  // Antlers over the door
  for (const sx of [-1, 1]) {
    k.bar([0, 1.42, 0.72], [sx * 0.28, 1.6, 0.74], 0.03, m.plank)
    k.bar([sx * 0.18, 1.52, 0.73], [sx * 0.22, 1.68, 0.74], 0.025, m.plank)
  }
  // Pelts nailed to the wall
  k.boxC(0.45, 0.6, 0.02, m.canvas, 0.85, 1.0, 0.7, [0, 0, 0.1])
  k.boxC(0.4, 0.5, 0.02, m.darkPlank, 1.0, 0.85, 0.72, [0, 0, -0.15])
  // Drying rack with meat
  for (const z of [-1.3, -0.3]) k.box(0.08, 1.4, 0.08, m.log, 1.65, 0, z)
  k.beam([1.65, 1.35, -1.35], [1.65, 1.35, -0.25], 0.035, m.log)
  for (let i = 0; i < 3; i++) {
    k.beam([1.65, 1.35, -1.1 + i * 0.3], [1.65, 1.05, -1.1 + i * 0.3], 0.008, m.rope, 4)
    k.boxC(0.14, 0.28, 0.1, m.meat, 1.65, 0.92, -1.1 + i * 0.3)
  }
  // Sled loaded with game
  for (const x of [-1.55, -1.15]) k.bar([x, 0.06, 0.6], [x, 0.06, 1.7], 0.05, m.iron)
  k.box(0.55, 0.06, 1.0, m.plank, -1.35, 0.12, 1.15)
  k.boxC(0.4, 0.22, 0.6, m.meat, -1.35, 0.3, 1.15)
  const chimney = k.chimney(0.8, 0.2, -1.35, 2.4, 0.38)
  k.lantern(0.45, 1.4, 0.75, win)
  return { chimney }
}

export const canteen: BuildFn = (k, win) => {
  const m = M()
  k.box(3.2, 0.25, 2.6, m.stone)
  k.box(3.0, 1.75, 2.4, m.brick, 0, 0.25, 0)
  k.box(3.1, 0.12, 2.5, m.darkPlank, 0, 1.95, 0)
  k.gableRoof(2.6, 3.2, 0.9, 2.05, m.shingle, m.brick)
  k.door(0, 1.21, 0.65, 1.15, 0, 0.25)
  k.window(-0.95, 1.05, 1.21, 0.55, 0.6, win)
  k.window(0.95, 1.05, 1.21, 0.55, 0.6, win)
  k.window(1.51, 1.05, 0, 0.55, 0.6, win, Math.PI / 2)
  // Signboard
  k.boxC(1.1, 0.3, 0.06, m.plank, 0, 1.68, 1.26)
  k.boxC(0.3, 0.12, 0.02, m.brass, 0, 1.68, 1.3)
  // Tall iron smokestack with bands
  k.cyl(0.2, 0.24, 3.9, m.metal, 1.1, 0, -1.38, 14)
  for (const y of [1.0, 2.0, 3.0]) k.torus(0.22, 0.03, m.iron, 1.1, y, -1.38, [Math.PI / 2, 0, 0], 14)
  k.cone(0.34, 0.2, m.iron, 1.1, 3.95, -1.38, 12)
  // Field kitchen: cauldron over a fire
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    k.bar([-1.35 + Math.cos(a) * 0.35, 0, 1.75 + Math.sin(a) * 0.35], [-1.35, 0.85, 1.75], 0.035, m.iron)
  }
  k.add(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.iron, [-1.35, 0.6, 1.75])
  k.sphere(0.14, win, -1.35, 0.15, 1.75, [1.3, 0.7, 1.3], 8)
  k.barrel(1.5, 0, 1.6)
  k.crate(1.0, 0, 1.75, 0.4, 0.3)
  k.drift(0, -1.45, 3.0, 0.6)
  return { chimney: new THREE.Vector3(1.1, 4.1, -1.38) }
}

export const pub: BuildFn = (k, win) => {
  const m = M()
  k.box(3.0, 0.25, 2.6, m.stone)
  k.box(2.8, 1.15, 2.4, m.brick, 0, 0.25, 0)
  k.box(3.0, 1.0, 2.6, m.plaster, 0, 1.4, 0)
  // Timber framing on the upper floor
  const t = m.darkPlank
  k.box(3.04, 0.1, 2.64, t, 0, 1.4, 0)
  k.box(3.04, 0.1, 2.64, t, 0, 2.3, 0)
  for (const x of [-1.45, -0.5, 0.5, 1.45]) k.box(0.1, 0.9, 0.04, t, x, 1.45, 1.31)
  k.bar([-1.45, 1.5, 1.32], [-0.5, 2.3, 1.32], 0.07, t)
  k.bar([1.45, 1.5, 1.32], [0.5, 2.3, 1.32], 0.07, t)
  k.gableRoof(2.8, 3.2, 1.1, 2.4, m.shingle, m.plaster)
  k.door(0, 1.21, 0.6, 1.0, 0, 0.25)
  k.window(-0.85, 0.75, 1.21, 0.6, 0.55, win)
  k.window(0.85, 0.75, 1.21, 0.6, 0.55, win)
  for (const x of [-0.95, 0, 0.95]) k.window(x, 1.85, 1.31, 0.35, 0.4, win)
  // Hanging sign
  k.bar([1.2, 2.05, 1.3], [1.2, 2.05, 1.85], 0.04, m.iron)
  for (const z of [1.55, 1.8]) k.beam([1.2, 2.05, z], [1.2, 1.85, z], 0.008, m.iron, 4)
  k.boxC(0.06, 0.4, 0.45, m.brass, 1.2, 1.65, 1.67)
  const chimney = k.chimney(-0.95, 0, -1.4, 3.8, 0.45)
  k.barrel(-1.55, 0, 1.55)
  k.barrel(-1.15, 0, 1.7, 0.2, 0.5)
  k.box(0.9, 0.08, 0.3, m.plank, 1.3, 0.4, 1.7)
  for (const x of [0.95, 1.65]) k.box(0.06, 0.4, 0.25, m.log, x, 0, 1.7)
  k.lantern(-0.5, 1.2, 1.3, win)
  return { chimney }
}
