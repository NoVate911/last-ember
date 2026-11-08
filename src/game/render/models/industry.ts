import * as THREE from 'three'
import { type BuildFn, Kit, M, type V3 } from './kit'

/** Spoked wheel / gear in the XY plane, built as its own group so it can spin. */
function wheel(radius: number, mat: THREE.Material, spokes: number, teeth = 0): THREE.Group {
  const m = M()
  const k = new Kit()
  k.torus(radius, radius * 0.1, mat, 0, 0, 0, [0, 0, 0], 28)
  k.add(new THREE.CylinderGeometry(radius * 0.18, radius * 0.18, radius * 0.3, 12), m.iron, [0, 0, 0], [Math.PI / 2, 0, 0])
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2
    k.add(new THREE.BoxGeometry(radius * 0.08, radius, radius * 0.08), mat, [Math.cos(a) * radius / 2, Math.sin(a) * radius / 2, 0], [0, 0, a - Math.PI / 2])
  }
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    k.add(new THREE.BoxGeometry(radius * 0.22, radius * 0.2, radius * 0.22), mat, [Math.cos(a) * radius * 1.12, Math.sin(a) * radius * 1.12, 0], [0, 0, a])
  }
  return k.build()
}

/** Four-legged lattice tower: legs between base and top corners with rings and X braces. */
function lattice(k: Kit, base: V3[], top: V3[], levels: number, t: number, mat: THREE.Material) {
  const lerp = (a: V3, b: V3, f: number): V3 => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
  for (let i = 0; i < 4; i++) k.bar(base[i]!, top[i]!, t, mat)
  for (let l = 0; l <= levels; l++) {
    const f = l / levels
    for (let i = 0; i < 4; i++) {
      const a = lerp(base[i]!, top[i]!, f)
      const b = lerp(base[(i + 1) % 4]!, top[(i + 1) % 4]!, f)
      k.bar(a, b, t * 0.7, mat)
      if (l < levels) {
        const a2 = lerp(base[i]!, top[i]!, (l + 1) / levels)
        const b2 = lerp(base[(i + 1) % 4]!, top[(i + 1) % 4]!, (l + 1) / levels)
        k.bar(a, b2, t * 0.5, mat)
        k.bar(b, a2, t * 0.5, mat)
      }
    }
  }
}

/** Heap of lumps (coal, ore) with a snow cap. */
function heap(k: Kit, x: number, z: number, r: number, h: number, mat: THREE.Material, seed: number) {
  const m = M()
  k.cone(r, h, mat, x, 0, z, 10)
  let s = seed
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  for (let i = 0; i < 8; i++) {
    const a = rnd() * Math.PI * 2
    const d = r * (0.5 + rnd() * 0.5)
    k.add(new THREE.DodecahedronGeometry(0.1 + rnd() * 0.12, 0), mat, [x + Math.cos(a) * d, 0.08 + (1 - d / r) * h * 0.6, z + Math.sin(a) * d], [rnd() * 3, rnd() * 3, 0])
  }
  k.cone(r * 0.4, h * 0.25, m.snow, x, h * 0.78, z, 10)
}

export const depot: BuildFn = (k, win) => {
  const m = M()
  for (const x of [-1.5, 0, 1.5]) for (const z of [-1.3, 1.3]) k.cyl(0.08, 0.1, 0.3, m.log, x, 0, z, 6)
  k.box(3.4, 0.15, 3.0, m.plank, 0, 0.25, 0)
  k.box(3.45, 0.06, 3.05, m.snow, 0, 0.4, -1.2)
  // Booth
  k.box(1.1, 1.3, 1.0, m.plank, -1.1, 0.4, -0.95)
  k.add(new THREE.BoxGeometry(1.3, 0.06, 1.25), m.darkPlank, [-1.1, 1.78, -0.95], [0.2, 0, 0])
  k.add(new THREE.BoxGeometry(1.25, 0.05, 1.15), m.snow, [-1.1, 1.83, -0.95], [0.2, 0, 0])
  k.window(-1.1, 1.15, -0.44, 0.45, 0.35, win)
  const chimney = k.stovepipe(-1.45, 1.6, -1.25, 0.6, 0.07)
  // Crane
  k.cyl(0.1, 0.13, 3.0, m.log, 1.2, 0.4, -1.0, 8)
  k.bar([1.2, 3.3, -1.1], [1.2, 3.3, 0.7], 0.12, m.log)
  k.bar([1.2, 2.3, -1.0], [1.2, 3.25, -0.1], 0.08, m.log)
  k.beam([1.2, 3.3, -1.1], [1.2, 3.4, -1.0], 0.05, m.iron)
  k.torus(0.1, 0.025, m.iron, 1.2, 3.22, 0.6, [0, Math.PI / 2, 0], 10)
  k.beam([1.2, 3.2, 0.6], [1.2, 1.65, 0.6], 0.012, m.rope, 4)
  k.torus(0.06, 0.015, m.iron, 1.2, 1.6, 0.6, [0, 0, 0], 8)
  k.crate(1.2, 1.15, 0.6, 0.4, 0.3)
  // Cargo
  k.crate(0.0, 0.4, 0.6, 0.55)
  k.crate(0.05, 0.95, 0.6, 0.45, 0.4)
  k.crate(-0.6, 0.4, 0.9, 0.5, 0.2)
  k.barrel(0.5, 0.4, -0.6)
  k.barrel(0.0, 0.4, -0.7, 0.2, 0.5)
  for (let i = 0; i < 3; i++) k.sphere(0.2, m.canvas, -1.3 + i * 0.32, 0.55, 0.9, [1, 0.7, 1.2], 8)
  k.lampPost(1.55, 1.35, win, 1.7)
  return { chimney }
}

export const drill: BuildFn = (k, win, body) => {
  const m = M()
  k.box(3.2, 0.4, 3.2, m.stone)
  k.box(1.6, 0.06, 1.6, m.iron, 0, 0.4, 0)
  lattice(k, [[-1.1, 0.4, -1.1], [1.1, 0.4, -1.1], [1.1, 0.4, 1.1], [-1.1, 0.4, 1.1]], [[-0.6, 4.6, -0.6], [0.6, 4.6, -0.6], [0.6, 4.6, 0.6], [-0.6, 4.6, 0.6]], 3, 0.16, m.rust)
  k.box(1.5, 0.3, 1.5, m.metal, 0, 4.6, 0)
  k.cyl(0.35, 0.35, 0.5, m.iron, 0, 2.6, 0, 12)
  k.torus(0.4, 0.06, m.brass, 0, 3.1, 0, [Math.PI / 2, 0, 0])
  // Pulley on top
  k.add(new THREE.TorusGeometry(0.4, 0.06, 6, 18), m.iron, [0, 5.25, 0])
  k.box(0.1, 0.5, 0.1, m.iron, 0, 4.9, 0)
  // Boiler with riveted bands
  k.cyl(0.42, 0.42, 1.5, m.metal, 1.5, 0.4, 0.2, 14)
  k.sphere(0.42, m.metal, 1.5, 1.9, 0.2, [1, 0.5, 1], 14)
  for (const y of [0.7, 1.2, 1.7]) k.torus(0.43, 0.025, m.brass, 1.5, y, 0.2, [Math.PI / 2, 0, 0], 16)
  k.sphere(0.12, win, 1.5, 0.75, 0.63, [1, 1, 0.4], 8)
  k.beam([1.2, 1.4, 0.2], [0.3, 2.8, 0.1], 0.07, m.copper)
  const chimney = k.stovepipe(1.5, 2.05, 0.2, 0.9, 0.09)
  heap(k, -0.2, 1.55, 0.6, 0.5, m.coal, 3)
  k.lantern(0.75, 4.4, 0.75, win)
  // Piston: hammer head with shaft, animated up and down
  const pk = new Kit()
  pk.box(0.75, 0.55, 0.75, m.metal, 0, 0, 0)
  pk.box(0.85, 0.08, 0.85, m.iron, 0, 0.5, 0)
  pk.cyl(0.16, 0.16, 1.7, m.iron, 0, 0.55, 0, 10)
  for (const y of [0.15, 0.35]) pk.box(0.78, 0.04, 0.78, m.brass, 0, y, 0)
  const piston = pk.build()
  piston.userData['baseY'] = 0.46
  piston.position.y = 0.46
  body.add(piston)
  return { animated: piston, animKind: 'piston', chimney }
}

function mine(ore: boolean): BuildFn {
  return (k, win, body) => {
    const m = M()
    const lump = ore ? m.ore : m.coal
    k.box(3.4, 0.3, 3.2, m.stone)
    // Shaft collar
    k.cyl(0.75, 0.8, 0.3, m.stone, -0.3, 0.3, 0.2, 14)
    k.cyl(0.6, 0.6, 0.02, m.iron, -0.3, 0.6, 0.2, 14)
    // Headframe
    lattice(k, [[-1.05, 0.3, -0.45], [0.45, 0.3, -0.45], [0.45, 0.3, 0.85], [-1.05, 0.3, 0.85]], [[-0.6, 5.0, 0.0], [0.0, 5.0, 0.0], [0.0, 5.0, 0.4], [-0.6, 5.0, 0.4]], 4, 0.14, m.rust)
    k.box(0.9, 0.12, 0.7, m.metal, -0.3, 5.0, 0.2)
    k.bar([-0.3, 4.9, 0.0], [1.05, 1.9, -0.85], 0.14, m.rust)
    k.bar([-0.3, 4.9, 0.4], [1.05, 1.9, -0.55], 0.1, m.rust)
    k.beam([-0.3, 5.75, 0.2], [-0.3, 0.7, 0.2], 0.015, m.iron, 4)
    k.beam([-0.3, 6.1, 0.2], [1.0, 1.9, -0.7], 0.015, m.iron, 4)
    // Cage at the top of the shaft
    k.box(0.5, 0.6, 0.5, m.iron, -0.3, 0.6, 0.2)
    k.box(0.44, 0.5, 0.44, win, -0.3, 0.65, 0.2)
    // Engine house
    k.box(1.4, 1.5, 1.3, m.brick, 1.15, 0.3, -0.9)
    k.gableRoof(1.3, 1.5, 0.6, 1.8, m.shingle, m.brick, -0.9, 0.15, 1.15)
    k.window(1.15, 1.1, -0.24, 0.4, 0.4, win)
    k.door(1.86, -0.9, 0.45, 0.95, Math.PI / 2, 0.3)
    const chimney = k.chimney(1.55, 1.8, -1.25, 1.4, 0.3)
    // Rails and an ore cart
    for (const x of [-0.5, -0.1]) k.bar([x, 0.33, 0.9], [x, 0.33, 2.0], 0.05, m.iron)
    for (let i = 0; i < 5; i++) k.box(0.6, 0.04, 0.1, m.darkPlank, -0.3, 0.3, 1.0 + i * 0.25)
    k.box(0.5, 0.35, 0.6, m.rust, -0.3, 0.42, 1.55)
    for (const x of [-0.53, -0.07]) for (const z of [1.38, 1.72]) k.add(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10), m.iron, [x, 0.42, z], [0, 0, Math.PI / 2])
    for (let i = 0; i < 6; i++) k.sphere(0.1, lump, -0.42 + (i % 3) * 0.12, 0.8, 1.42 + Math.floor(i / 3) * 0.22, [1, 0.8, 1], 6)
    heap(k, 1.3, 1.25, 0.6, 0.55, lump, ore ? 7 : 5)
    k.lantern(0.15, 3.0, 0.9, win)
    // Winding wheel spins in the XY plane
    const w = wheel(0.6, m.metal, 6)
    w.position.set(-0.3, 5.75, 0.2)
    body.add(w)
    return { animated: w, animKind: 'spin', chimney }
  }
}

export const coalMine = mine(false)
export const oreMine = mine(true)

export const sawmill: BuildFn = (k, win, body) => {
  const m = M()
  k.box(3.4, 0.15, 3.0, m.plank)
  for (const x of [-1.5, 0, 1.5]) for (const z of [-1.2, 1.2]) k.box(0.16, 2.1, 0.16, m.log, x, 0.15, z)
  k.bar([-1.6, 2.2, 1.2], [1.6, 2.2, 1.2], 0.14, m.log)
  k.bar([-1.6, 2.2, -1.2], [1.6, 2.2, -1.2], 0.14, m.log)
  k.gableRoof(2.6, 3.4, 0.8, 2.25, m.darkPlank, null)
  // Saw table and the log being cut
  k.box(2.4, 0.75, 0.7, m.darkPlank, 0, 0.15, 0)
  k.add(new THREE.CylinderGeometry(0.2, 0.22, 1.6, 10), m.log, [-0.6, 1.12, 0], [0, 0, Math.PI / 2])
  // Steam engine and drive belt
  k.box(0.6, 0.7, 0.6, m.metal, -1.25, 0.15, 0.65)
  k.stovepipe(-1.25, 0.85, 0.65, 0.7, 0.07)
  k.beam([-1.0, 0.75, 0.6], [0, 1.2, 0.05], 0.03, m.rope, 4)
  // Log pile behind, plank stack in front
  for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
    k.add(new THREE.CylinderGeometry(0.2, 0.2, 2.6, 9), m.log, [-0.6 - row * 0.2 + i * 0.4 + 0.2, 0.35 + row * 0.35, -1.65], [0, 0, Math.PI / 2])
  }
  for (let i = 0; i < 5; i++) k.box(1.2, 0.08, 0.35, m.plank, 0.95, 0.15 + i * 0.09, 1.55, [0, (i % 2) * 0.05, 0])
  k.cone(0.4, 0.3, m.plank, 0.6, 0.15, -0.6, 10)
  k.lantern(1.5, 1.8, 1.32, win)
  // Spinning saw blade with teeth
  const bk = new Kit()
  bk.add(new THREE.CylinderGeometry(0.55, 0.55, 0.03, 32), m.metal, [0, 0, 0], [Math.PI / 2, 0, 0])
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2
    bk.add(new THREE.BoxGeometry(0.08, 0.08, 0.03), m.iron, [Math.cos(a) * 0.57, Math.sin(a) * 0.57, 0], [0, 0, a + Math.PI / 4])
  }
  bk.add(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 10), m.brass, [0, 0, 0], [Math.PI / 2, 0, 0])
  const blade = bk.build()
  blade.position.set(0.35, 1.05, 0)
  body.add(blade)
  return { animated: blade, animKind: 'spin' }
}

export const steelworks: BuildFn = (k, win) => {
  const m = M()
  k.box(3.4, 0.3, 3.2, m.stone)
  // Blast furnace
  k.cyl(1.0, 1.3, 2.6, m.brick, -0.4, 0.3, -0.3, 16)
  for (const y of [0.8, 1.5, 2.2]) k.torus(1.15 - (y - 0.8) * 0.1, 0.05, m.iron, -0.4, y, -0.3, [Math.PI / 2, 0, 0], 24)
  k.cyl(0.6, 1.05, 0.5, m.metal, -0.4, 2.9, -0.3, 16)
  k.cyl(0.35, 0.35, 0.6, m.metal, -0.4, 3.4, -0.3, 12)
  k.boxC(0.5, 0.45, 0.2, win, -0.4, 0.8, 0.95)
  k.boxC(0.7, 0.1, 0.3, m.iron, -0.4, 1.08, 1.0)
  k.boxC(0.14, 0.04, 0.9, win, -0.4, 0.34, 1.4)
  // Ladle on its stand
  k.add(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.iron, [-0.4, 0.75, 1.75])
  k.cyl(0.24, 0.24, 0.02, win, -0.4, 0.74, 1.75, 12)
  for (const x of [-0.75, -0.05]) k.box(0.06, 0.75, 0.06, m.iron, x, 0, 1.75)
  // Stacks and ducts
  k.cyl(0.26, 0.32, 4.4, m.metal, 1.1, 0.3, -1.0, 14)
  for (const y of [1.5, 2.8, 4.0]) k.torus(0.3, 0.04, m.iron, 1.1, y, -1.0, [Math.PI / 2, 0, 0], 14)
  k.cyl(0.2, 0.25, 3.4, m.metal, 1.35, 0.3, 0.7, 12)
  k.beam([-0.4, 3.6, -0.3], [1.1, 3.6, -1.0], 0.14, m.rust)
  k.beam([-0.1, 2.0, 0.6], [1.35, 2.6, 0.7], 0.1, m.rust)
  // Casting shed and stock
  for (const [x, z] of [[0.6, 1.0], [1.6, 1.0], [0.6, 1.7], [1.6, 1.7]] as const) k.box(0.08, 1.3, 0.08, m.log, x, 0.3, z)
  k.add(new THREE.BoxGeometry(1.3, 0.06, 1.0), m.metal, [1.1, 1.68, 1.35], [0.15, 0, 0])
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) k.box(0.4, 0.1, 0.14, m.metal, 1.1, 0.3 + i * 0.1, 1.2 + j * 0.2 + (i % 2) * 0.05)
  heap(k, -1.45, 1.4, 0.4, 0.4, m.coal, 9)
  return { chimney: new THREE.Vector3(1.1, 4.8, -1.0) }
}

export const warehouse: BuildFn = (k, win) => {
  const m = M()
  k.box(3.6, 0.2, 2.8, m.stone)
  k.box(3.4, 1.9, 2.6, m.plank, 0, 0.2, 0)
  for (const x of [-1.7, 1.7]) for (const z of [-1.3, 1.3]) k.box(0.16, 1.95, 0.16, m.log, x, 0.2, z)
  k.box(3.5, 0.1, 2.7, m.darkPlank, 0, 1.1, 0)
  k.gableRoof(2.8, 3.6, 1.1, 2.1, m.shingle, m.plank)
  // Big double doors, one ajar
  k.box(1.3, 1.4, 0.04, m.iron, 0, 0.2, 1.28)
  k.add(new THREE.BoxGeometry(0.62, 1.35, 0.06), m.darkPlank, [-0.33, 0.9, 1.33])
  k.add(new THREE.BoxGeometry(0.62, 1.35, 0.06), m.darkPlank, [0.6, 0.9, 1.55], [0, -0.9, 0])
  k.bar([-0.62, 0.3, 1.37], [-0.04, 1.5, 1.37], 0.05, m.plank)
  k.bar([-0.04, 0.3, 1.37], [-0.62, 1.5, 1.37], 0.05, m.plank)
  // Loft door with hoist
  k.boxC(0.5, 0.5, 0.05, m.darkPlank, 0, 2.3, 1.32)
  k.bar([0, 2.8, 0.9], [0, 2.8, 1.9], 0.1, m.log)
  k.beam([0, 2.75, 1.85], [0, 1.6, 1.85], 0.012, m.rope, 4)
  k.torus(0.07, 0.015, m.iron, 0, 1.58, 1.85, [0, 0, 0], 8)
  k.window(-1.71, 1.4, 0.5, 0.4, 0.35, win, -Math.PI / 2)
  k.crate(-1.3, 0, 1.75, 0.5, 0.2)
  k.crate(-1.25, 0.5, 1.75, 0.4, 0.5)
  k.barrel(1.4, 0, 1.7)
  k.lantern(-0.9, 1.65, 1.36, win)
  k.drift(0, -1.5, 3.2, 0.6)
  return {}
}

export const coalStorage: BuildFn = (k, win) => {
  const m = M()
  k.box(3.4, 0.25, 3.0, m.stone)
  // Bin walls: posts with plank infill, open to the front
  for (const x of [-1.6, -0.55, 0.55, 1.6]) k.box(0.14, 1.6, 0.14, m.log, x, 0.25, -1.4)
  for (const z of [-0.45, 0.6]) for (const x of [-1.6, 1.6]) k.box(0.14, 1.6, 0.14, m.log, x, 0.25, z)
  k.box(3.2, 1.3, 0.08, m.darkPlank, 0, 0.25, -1.4)
  for (const x of [-1.6, 1.6]) k.box(0.08, 1.3, 2.0, m.darkPlank, x, 0.25, -0.4)
  k.box(3.2, 0.4, 0.08, m.darkPlank, 0, 0.25, 0.65)
  // Canopy over the back
  k.add(new THREE.BoxGeometry(3.5, 0.06, 1.4), m.metal, [0, 1.95, -0.8], [-0.2, 0, 0])
  k.add(new THREE.BoxGeometry(3.4, 0.05, 1.3), m.snow, [0, 2.0, -0.8], [-0.2, 0, 0])
  heap(k, 0, -0.35, 1.25, 1.2, m.coal, 13)
  heap(k, 0.9, 1.3, 0.45, 0.4, m.coal, 21)
  // Chute and tools
  k.bar([1.75, 1.6, -0.2], [1.75, 0.3, 1.0], 0.22, m.rust)
  k.bar([-1.3, 0.3, 1.2], [-1.15, 1.4, 1.0], 0.04, m.log)
  k.box(0.18, 0.04, 0.24, m.iron, -1.3, 0.3, 1.25)
  k.barrel(-1.3, 0.25, 1.65, 0.2, 0.5)
  k.lantern(-1.6, 1.7, 0.7, win)
  return {}
}

export const workshop: BuildFn = (k, win, body) => {
  const m = M()
  k.box(3.2, 0.25, 2.8, m.stone)
  k.box(3.0, 2.0, 2.6, m.brick, 0, 0.25, 0)
  k.box(3.1, 0.12, 2.7, m.stone, 0, 2.25, 0)
  k.gableRoof(2.8, 3.2, 1.0, 2.35, m.metal, m.brick)
  // Skylights on the roof
  for (const x of [-0.9, 0.9]) k.add(new THREE.BoxGeometry(0.6, 0.06, 0.6), win, [x, 2.95, 0.6], [0.62, 0, 0])
  k.door(0, 1.31, 0.75, 1.2, 0, 0.25)
  k.window(-1.0, 1.0, 1.31, 0.55, 0.75, win)
  k.window(1.0, 1.0, 1.31, 0.55, 0.75, win)
  k.window(1.51, 1.1, 0, 0.6, 0.6, win, Math.PI / 2)
  const chimney = k.chimney(-1.0, 1.8, -0.6, 1.9, 0.36)
  // Pipes along the wall
  k.beam([1.52, 0.4, -1.1], [1.52, 2.1, -1.1], 0.06, m.copper)
  k.beam([1.52, 2.1, -1.1], [1.52, 2.1, 0.8], 0.06, m.copper)
  k.torus(0.1, 0.02, m.brass, 1.6, 1.0, -1.1, [0, Math.PI / 2, 0], 10)
  // Workbench with parts
  k.box(1.1, 0.06, 0.5, m.darkPlank, -1.0, 0.75, 1.75)
  for (const x of [-1.5, -0.5]) for (const z of [1.55, 1.95]) k.box(0.06, 0.75, 0.06, m.darkPlank, x, 0, z)
  k.box(0.18, 0.15, 0.12, m.iron, -1.35, 0.81, 1.7)
  k.torus(0.12, 0.035, m.brass, -0.8, 0.85, 1.75, [Math.PI / 2, 0, 0], 12)
  k.crate(1.3, 0, 1.75, 0.45)
  k.lantern(0.6, 1.7, 1.36, win)
  // Brass gear emblem over the door
  const gear = wheel(0.32, m.brass, 6, 10)
  gear.position.set(0, 1.95, 1.4)
  body.add(gear)
  return { animated: gear, animKind: 'spin', chimney }
}
