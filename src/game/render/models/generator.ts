import * as THREE from 'three'
import { Kit, M } from './kit'

export interface GeneratorVisual {
  group: THREE.Group
  glowMat: THREE.MeshStandardMaterial
  fan: THREE.Object3D
}

/** The great coal generator at the heart of the city. */
export function createGenerator(): GeneratorVisual {
  const m = M()
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x331a0a, emissive: 0xff7a1a, emissiveIntensity: 0.2, roughness: 0.5 })
  const k = new Kit()
  const ring = (n: number, fn: (a: number, c: number, s: number, i: number) => void) => {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; fn(a, Math.cos(a), Math.sin(a), i) }
  }

  // Octagonal stone platform with stairs between the buttresses
  k.cyl(5.4, 5.8, 0.8, m.stone, 0, 0, 0, 8)
  k.cyl(5.2, 5.25, 0.05, m.snow, 0, 0.8, 0, 8)
  ring(6, (a) => {
    const b = a + Math.PI / 6
    for (let st = 0; st < 3; st++) {
      const r = 5.95 - st * 0.3
      k.add(new THREE.BoxGeometry(1.4, 0.27, 0.35), m.stone, [Math.cos(b) * r, st * 0.27 + 0.13, Math.sin(b) * r], [0, -b + Math.PI / 2, 0])
    }
  })
  // Iron deck with rivets and a railing
  k.cyl(4.4, 4.7, 0.4, m.metal, 0, 0.8, 0, 24)
  ring(48, (_a, c, s) => k.sphere(0.05, m.iron, c * 4.62, 1.15, s * 4.62, [1, 1, 1], 5))
  ring(24, (_a, c, s, i) => { if (i % 4 !== 1) k.cyl(0.035, 0.035, 0.9, m.iron, c * 4.5, 1.2, s * 4.5, 5) })
  k.torus(4.5, 0.04, m.iron, 0, 2.1, 0, [Math.PI / 2, 0, 0], 48)
  k.torus(4.5, 0.025, m.iron, 0, 1.65, 0, [Math.PI / 2, 0, 0], 48)

  // Furnace drum: glowing core behind a cage of bars
  k.cyl(2.75, 2.75, 1.8, glowMat, 0, 1.2, 0, 24)
  ring(36, (_a, c, s) => k.cyl(0.06, 0.06, 1.8, m.iron, c * 3.0, 1.2, s * 3.0, 6))
  for (const y of [1.25, 2.95]) k.torus(3.0, 0.12, m.iron, 0, y, 0, [Math.PI / 2, 0, 0], 36)
  // Furnace mouths with hoods and coal heaps
  ring(4, (a, c, s) => {
    const b = a + Math.PI / 4
    const cb = Math.cos(b), sb = Math.sin(b)
    k.add(new THREE.BoxGeometry(1.3, 1.0, 0.9), m.metal, [cb * 3.6, 1.7, sb * 3.6], [0, -b + Math.PI / 2, 0])
    k.add(new THREE.BoxGeometry(0.9, 0.6, 0.1), glowMat, [cb * 4.06, 1.6, sb * 4.06], [0, -b + Math.PI / 2, 0])
    k.add(new THREE.BoxGeometry(1.5, 0.12, 1.1), m.iron, [cb * 3.65, 2.25, sb * 3.65], [0, -b + Math.PI / 2, 0])
    k.cone(0.55, 0.5, m.coal, cb * 4.0 + sb * 0.9, 1.2, sb * 4.0 - cb * 0.9, 9)
    k.add(new THREE.BoxGeometry(0.06, 0.9, 0.06), m.log, [cb * 4.2 - sb * 0.85, 1.65, sb * 4.2 + cb * 0.85], [0.3, -b, 0])
    void c; void s
  })

  // Main tower with plates, ribs, bands and rivets
  k.cyl(2.2, 2.9, 7.0, m.metal, 0, 3.0, 0, 24)
  ring(12, (a) => {
    const r0 = 2.92, r1 = 2.22
    k.bar([Math.cos(a) * r0, 3.0, Math.sin(a) * r0], [Math.cos(a) * r1, 10.0, Math.sin(a) * r1], 0.14, m.rust)
  })
  for (const y of [3.4, 5.2, 7.0, 8.8]) {
    const r = 2.85 - (y - 3.0) * 0.1
    k.torus(r, 0.18, m.brass, 0, y, 0, [Math.PI / 2, 0, 0], 32)
    ring(24, (_a, c, s) => k.sphere(0.05, m.iron, c * (r + 0.17), y + 0.18, s * (r + 0.17), [1, 1, 1], 5))
  }
  // Gauges on the tower
  ring(3, (a, c, s) => {
    k.add(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16), m.brass, [c * 2.68, 4.3, s * 2.68], [0, 0, 0])
    k.add(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 16), glowMat, [c * 2.7, 4.3, s * 2.7], [Math.PI / 2, 0, -a + Math.PI / 2])
  })

  // Catwalk ring with railing and a ladder up from the deck
  k.cyl(3.5, 3.5, 0.1, m.metal, 0, 6.2, 0, 32)
  ring(20, (_a, c, s) => k.cyl(0.03, 0.03, 0.8, m.iron, c * 3.45, 6.3, s * 3.45, 5))
  k.torus(3.45, 0.035, m.iron, 0, 7.1, 0, [Math.PI / 2, 0, 0], 40)
  for (const dx of [-0.25, 0.25]) k.bar([3.9, 1.2, dx], [3.4, 6.25, dx], 0.05, m.iron)
  for (let i = 0; i < 12; i++) {
    const f = i / 12
    k.bar([3.9 - 0.5 * f, 1.4 + 4.8 * f, -0.25], [3.9 - 0.5 * f, 1.4 + 4.8 * f, 0.25], 0.03, m.iron)
  }
  ring(4, (a, c, s) => {
    const b = a + Math.PI / 8
    k.lantern(Math.cos(b) * 3.45, 7.4, Math.sin(b) * 3.45, glowMat)
    void c; void s
  })

  // Upper stages and the glowing crown with spikes
  k.cyl(1.4, 2.2, 2.2, m.metal, 0, 10.0, 0, 20)
  k.cyl(1.9, 1.4, 1.4, m.rust, 0, 12.2, 0, 20)
  k.cyl(1.6, 1.6, 0.3, glowMat, 0, 13.4, 0, 20)
  k.torus(1.85, 0.1, m.brass, 0, 13.6, 0, [Math.PI / 2, 0, 0], 28)
  ring(12, (_a, c, s) => k.cone(0.12, 0.8, m.iron, c * 1.85, 13.6, s * 1.85, 6))

  // Buttresses and the big steam pipes that run out to the city
  ring(6, (a, c, s) => {
    k.add(new THREE.BoxGeometry(0.5, 4.5, 2.2), m.rust, [c * 3.6, 3.05, s * 3.6], [0, -a, 0])
    k.add(new THREE.BoxGeometry(0.56, 0.15, 2.3), m.iron, [c * 3.6, 5.35, s * 3.6], [0, -a, 0])
    const b = a + 0.5
    const cb = Math.cos(b), sb = Math.sin(b)
    const p1: [number, number, number] = [cb * 2.55, 8.2, sb * 2.55]
    const p2: [number, number, number] = [cb * 4.3, 6.8, sb * 4.3]
    const p3: [number, number, number] = [cb * 5.1, 0.8, sb * 5.1]
    k.beam(p1, p2, 0.28, m.copper, 12)
    k.beam(p2, p3, 0.28, m.copper, 12)
    k.sphere(0.34, m.copper, p2[0], p2[1], p2[2], [1, 1, 1], 10)
    for (const f of [0.25, 0.75]) {
      const q: [number, number, number] = [p2[0] + (p3[0] - p2[0]) * f, p2[1] + (p3[1] - p2[1]) * f, p2[2] + (p3[2] - p2[2]) * f]
      k.add(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 12), m.iron, q, [0, 0, 0])
    }
  })

  const group = new THREE.Group()
  group.add(k.build())

  // Exhaust fan inside the crown
  const fk = new Kit()
  ring(6, (a) => fk.add(new THREE.BoxGeometry(1.35, 0.06, 0.38), m.metal, [Math.cos(a) * 0.65, 0, Math.sin(a) * 0.65], [0.35, -a, 0]))
  fk.cyl(0.2, 0.2, 0.25, m.brass, 0, -0.12, 0, 12)
  const fan = fk.build()
  fan.position.y = 12.9
  group.add(fan)
  return { group, glowMat, fan }
}
