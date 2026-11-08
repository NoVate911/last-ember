import * as THREE from 'three'
import { type BuildFn, Kit, M, type V3 } from './kit'
import { lattice } from './industry'

/** Searchlight head: housing, glowing lens and counterweight. Built separately so it can turn. */
function searchlight(win: THREE.Material): THREE.Group {
  const m = M()
  const k = new Kit()
  k.cyl(0.18, 0.22, 0.2, m.iron, 0, 0, 0, 10)
  k.box(0.08, 0.5, 0.5, m.iron, -0.32, 0.1, 0)
  k.box(0.08, 0.5, 0.5, m.iron, 0.32, 0.1, 0)
  // Drum lying along +z
  k.add(new THREE.CylinderGeometry(0.34, 0.3, 0.8, 16), m.brass, [0, 0.45, 0.05], [Math.PI / 2, 0, 0])
  k.add(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 16), win, [0, 0.45, 0.47], [Math.PI / 2, 0, 0])
  k.torus(0.32, 0.04, m.iron, 0, 0.45, 0.47, [0, 0, 0], 18)
  for (let i = 0; i < 5; i++) k.torus(0.35, 0.02, m.iron, 0, 0.45, -0.25 + i * 0.12, [0, 0, 0], 16)
  k.box(0.3, 0.3, 0.25, m.iron, 0, 0.3, -0.5)
  return k.build()
}

export const beacon: BuildFn = (k, win, body) => {
  const m = M()
  // Stone footing and the scouts' hut
  k.box(3.2, 0.25, 3.0, m.stone)
  k.box(1.5, 1.2, 1.2, m.plank, -0.75, 0.25, 0.75)
  k.gableRoof(1.2, 1.5, 0.6, 1.45, m.shingle, m.plank, 0.75, 0.2, -0.75)
  k.door(-0.75, 1.36, 0.45, 0.85, 0, 0.25)
  k.window(-1.51, 0.95, 0.75, 0.35, 0.35, win, Math.PI / 2)
  k.lantern(-0.35, 1.2, 1.4, win)
  // Lattice tower with ladder
  const base: V3[] = [[0.1, 0.25, -1.2], [1.3, 0.25, -1.2], [1.3, 0.25, 0.0], [0.1, 0.25, 0.0]]
  const top: V3[] = [[0.45, 5.2, -0.85], [0.95, 5.2, -0.85], [0.95, 5.2, -0.35], [0.45, 5.2, -0.35]]
  lattice(k, base, top, 5, 0.09, m.rust)
  for (let y = 0.5; y < 5.1; y += 0.3) k.bar([0.55 + (y / 5.2) * 0.1, y, -0.05 + (y / 5.2) * 0.3], [0.85 - (y / 5.2) * 0.1, y, -0.05 + (y / 5.2) * 0.3], 0.03, m.iron)
  // Top platform with railing
  k.box(1.1, 0.08, 1.1, m.darkPlank, 0.7, 5.2, -0.6)
  for (const [x, z] of [[0.17, -1.13], [1.23, -1.13], [1.23, -0.07], [0.17, -0.07]] as [number, number][]) k.box(0.04, 0.45, 0.04, m.iron, x, 5.28, z)
  for (const [a, b] of [[[0.17, -1.13], [1.23, -1.13]], [[1.23, -1.13], [1.23, -0.07]], [[1.23, -0.07], [0.17, -0.07]], [[0.17, -0.07], [0.17, -1.13]]] as [number, number][][]) {
    k.bar([a![0], 5.7, a![1]], [b![0], 5.7, b![1]], 0.035, m.iron)
  }
  k.box(1.0, 0.05, 1.0, m.snow, 0.7, 5.28, -0.6)
  // Signal flag on a pole
  k.beam([1.25, 5.28, -0.1], [1.25, 6.6, -0.1], 0.03, m.iron)
  k.add(new THREE.BoxGeometry(0.02, 0.32, 0.55), m.cloth, [1.25, 6.4, 0.18])
  // Sled with supplies ready for the next trip
  k.box(1.0, 0.06, 0.5, m.plank, 0.9, 0.4, 1.0)
  for (const z of [0.8, 1.2]) k.bar([0.35, 0.3, z], [1.45, 0.3, z], 0.04, m.iron)
  k.crate(0.7, 0.46, 1.0, 0.35, 0.2)
  k.crate(1.1, 0.46, 1.0, 0.3, -0.3)
  k.drift(-1.2, -1.1, 1.4, 0.6)
  const head = searchlight(win)
  head.position.set(0.7, 5.28, -0.6)
  body.add(head)
  return { animated: head, animKind: 'turn' }
}

export const school: BuildFn = (k, win) => {
  const m = M()
  k.box(3.6, 0.25, 2.4, m.stone, 0, 0, -0.4)
  k.box(3.4, 2.4, 2.2, m.plaster, 0, 0.25, -0.4)
  // Corner quoins and a storey band
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let i = 0; i < 5; i++) {
    k.boxC(i % 2 ? 0.18 : 0.26, 0.2, i % 2 ? 0.26 : 0.18, m.brick, sx * 1.68, 0.45 + i * 0.45, -0.4 + sz * 1.07)
  }
  k.box(3.5, 0.1, 2.3, m.darkPlank, 0, 1.4, -0.4)
  k.gableRoof(2.2, 3.4, 1.0, 2.65, m.shingle, m.plaster, -0.4)
  // Bell tower on the ridge
  k.box(0.6, 0.6, 0.6, m.plank, 0, 3.4, -0.4)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.07, 0.6, 0.07, m.darkPlank, sx * 0.27, 4.0, -0.4 + sz * 0.27)
  k.add(new THREE.CylinderGeometry(0.05, 0.2, 0.25, 12), m.brass, [0, 4.35, -0.4])
  k.sphere(0.05, m.iron, 0, 4.2, -0.4)
  k.cone(0.48, 0.6, m.shingle, 0, 4.6, -0.4, 4, [0, Math.PI / 4, 0])
  k.cone(0.06, 0.25, m.brass, 0, 5.2, -0.4, 6)
  // Windows on both floors, door with steps and a sign board
  for (const x of [-1.15, -0.45, 0.45, 1.15]) k.window(x, 2.0, 0.71, 0.42, 0.5, win)
  for (const x of [-1.15, 1.15]) k.window(x, 0.9, 0.71, 0.45, 0.55, win)
  k.window(1.71, 0.9, -0.4, 0.45, 0.55, win, Math.PI / 2)
  k.window(-1.71, 2.0, -0.4, 0.42, 0.5, win, Math.PI / 2)
  k.door(0, 0.71, 0.65, 1.05, 0, 0.25)
  k.box(1.0, 0.12, 0.35, m.stone, 0, 0, 0.88)
  k.boxC(1.1, 0.28, 0.05, m.darkPlank, 0, 1.6, 0.73)
  k.boxC(0.9, 0.18, 0.02, m.brass, 0, 1.6, 0.76)
  const chimney = k.chimney(1.0, 2.8, -0.9, 1.0, 0.35)
  // Playground: swing frame, seesaw, snowman
  for (const x of [-1.5, -0.6]) {
    k.bar([x, 0, 0.9], [x, 1.2, 1.15], 0.06, m.log)
    k.bar([x, 0, 1.4], [x, 1.2, 1.15], 0.06, m.log)
  }
  k.bar([-1.55, 1.2, 1.15], [-0.55, 1.2, 1.15], 0.07, m.log)
  for (const x of [-1.25, -0.85]) k.bar([x, 1.2, 1.15], [x, 0.45, 1.15], 0.015, m.rope)
  k.box(0.5, 0.04, 0.18, m.plank, -1.05, 0.43, 1.15)
  k.box(0.12, 0.25, 0.12, m.darkPlank, 0.9, 0, 1.15)
  k.add(new THREE.BoxGeometry(1.3, 0.05, 0.16), m.plank, [0.9, 0.3, 1.15], [0, 0, 0.18])
  k.sphere(0.25, m.snow, 1.5, 0.22, 0.6)
  k.sphere(0.17, m.snow, 1.5, 0.55, 0.6)
  k.sphere(0.11, m.snow, 1.5, 0.78, 0.6)
  k.cone(0.025, 0.12, m.meat, 1.5, 0.78, 0.71, 6, [Math.PI / 2, 0, 0])
  k.lantern(0.5, 1.2, 0.75, win)
  k.drift(-1.4, -1.6, 1.4, 0.6)
  return { chimney }
}
