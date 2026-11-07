import * as THREE from 'three'
import type { BuildingType, PileKind } from '../types'

const std = (color: number, opts: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...opts })

export const MAT = {
  wood: std(0x5a3d2b),
  darkWood: std(0x35261c),
  metal: std(0x3c4148, { metalness: 0.6, roughness: 0.45 }),
  brass: std(0x8a6a35, { metalness: 0.8, roughness: 0.35 }),
  rust: std(0x6f4125, { metalness: 0.3, roughness: 0.7 }),
  snow: std(0xeef3f8, { roughness: 1 }),
  canvas: std(0xa89880),
  stone: std(0x666a70),
  brick: std(0x56362c),
  plaster: std(0xb9b2a4),
  coal: std(0x16171a, { roughness: 0.6, metalness: 0.2 }),
  emblem: std(0x1f7a6a, { emissive: 0x0d5c4f, emissiveIntensity: 0.6 }),
}

export const WINDOW_BASE = new THREE.MeshStandardMaterial({
  color: 0x2a2018, emissive: 0xffa040, emissiveIntensity: 0, roughness: 0.4,
})

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  // y is the base of the box
  return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z)
}

/** Triangular prism roof; ridge runs along local X. */
function gable(width: number, height: number, length: number, mat: THREE.Material, y: number, z = 0) {
  const g = new THREE.CylinderGeometry(1, 1, length, 3)
  g.rotateX(-Math.PI / 2)
  g.scale(width / 1.732, height / 1.5, 1)
  g.translate(0, height / 3, 0)
  g.rotateY(Math.PI / 2)
  return mesh(g, mat, 0, y, z)
}

function cyl(rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 10) {
  return mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y + h / 2, z)
}

function windowsRow(group: THREE.Group, mat: THREE.Material, count: number, width: number, y: number, z: number) {
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? 0 : -width / 2 + (width / (count - 1)) * i
    group.add(box(0.35, 0.4, 0.06, mat, x, y, z))
  }
}

export interface BuildingVisual {
  group: THREE.Group
  windowMat: THREE.MeshStandardMaterial
  body: THREE.Group
  animated: THREE.Object3D | null
  animKind: 'piston' | 'spin' | null
  chimney: THREE.Vector3 | null
}

export function createBuildingMesh(type: BuildingType): BuildingVisual {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const win = WINDOW_BASE.clone()
  let animated: THREE.Object3D | null = null
  let animKind: BuildingVisual['animKind'] = null
  let chimney: THREE.Vector3 | null = null

  switch (type) {
    case 'tent': {
      const g = new THREE.ConeGeometry(1.7, 2.2, 4)
      g.rotateY(Math.PI / 4)
      body.add(mesh(g, MAT.canvas, 0, 1.1, 0))
      const cap = new THREE.ConeGeometry(0.75, 0.95, 4)
      cap.rotateY(Math.PI / 4)
      body.add(mesh(cap, MAT.snow, 0, 1.75, 0))
      body.add(cyl(0.05, 0.05, 2.6, MAT.darkWood, 0, 0, 0, 5))
      body.add(mesh(new THREE.SphereGeometry(0.14, 8, 6), win, 0.0, 0.5, 1.25))
      break
    }
    case 'bunkhouse': {
      body.add(box(3.2, 1.4, 2.2, MAT.wood))
      body.add(gable(2.5, 1.0, 3.4, MAT.snow, 1.4))
      body.add(box(0.3, 1.0, 0.3, MAT.metal, 1.0, 1.8, -0.4))
      windowsRow(body, win, 3, 2.2, 0.6, 1.11)
      chimney = new THREE.Vector3(1.0, 2.9, -0.4)
      break
    }
    case 'house': {
      body.add(box(2.8, 2.2, 2.6, MAT.stone))
      body.add(gable(2.9, 1.2, 3.0, MAT.snow, 2.2))
      body.add(box(0.4, 1.2, 0.4, MAT.brick, -0.8, 2.6, -0.4))
      windowsRow(body, win, 2, 1.4, 0.5, 1.31)
      windowsRow(body, win, 2, 1.4, 1.4, 1.31)
      chimney = new THREE.Vector3(-0.8, 3.9, -0.4)
      break
    }
    case 'depot': {
      body.add(box(3.4, 0.3, 3.0, MAT.darkWood))
      body.add(box(0.25, 3.2, 0.25, MAT.wood, -1.2, 0.3, -1.0))
      body.add(box(2.4, 0.2, 0.2, MAT.wood, -0.1, 3.3, -1.0))
      body.add(cyl(0.02, 0.02, 1.4, MAT.metal, 0.9, 1.9, -1.0, 4))
      body.add(box(0.8, 0.8, 0.8, MAT.wood, 0.6, 0.3, 0.6))
      body.add(box(0.7, 0.6, 0.7, MAT.rust, -0.4, 0.3, 0.8))
      body.add(box(0.6, 0.5, 0.6, MAT.wood, 0.6, 1.1, 0.6))
      body.add(mesh(new THREE.SphereGeometry(0.15, 8, 6), win, -1.2, 2.4, -0.8))
      break
    }
    case 'lodge': {
      body.add(box(2.6, 1.4, 2.0, MAT.darkWood, 0, 0, -0.4))
      body.add(gable(2.3, 1.0, 2.9, MAT.snow, 1.4, -0.4))
      for (const x of [-1.2, 1.2]) body.add(box(0.12, 1.4, 0.12, MAT.wood, x, 0, 1.2))
      body.add(box(2.5, 0.1, 0.1, MAT.wood, 0, 1.35, 1.2))
      for (const x of [-0.6, 0, 0.6]) body.add(box(0.4, 0.7, 0.06, MAT.canvas, x, 0.6, 1.2))
      windowsRow(body, win, 1, 0, 0.6, 0.61)
      chimney = new THREE.Vector3(0.8, 2.4, -0.6)
      body.add(box(0.25, 1.0, 0.25, MAT.metal, 0.8, 1.4, -0.6))
      break
    }
    case 'canteen': {
      body.add(box(3.0, 1.8, 2.4, MAT.brick))
      body.add(gable(2.6, 0.9, 3.2, MAT.snow, 1.8))
      body.add(cyl(0.3, 0.38, 3.6, MAT.metal, 1.0, 0, -0.6))
      windowsRow(body, win, 3, 2.0, 0.7, 1.21)
      chimney = new THREE.Vector3(1.0, 3.7, -0.6)
      break
    }
    case 'aid':
    case 'hospital': {
      const big = type === 'hospital'
      const w = big ? 3.4 : 2.8
      const h = big ? 2.6 : 1.6
      body.add(box(w, h, 2.5, MAT.plaster))
      body.add(gable(2.7, 1.0, w + 0.2, MAT.snow, h))
      body.add(box(0.7, 0.18, 0.06, MAT.emblem, 0, h - 0.6, 1.27))
      body.add(box(0.18, 0.7, 0.06, MAT.emblem, 0, h - 0.86, 1.27))
      windowsRow(body, win, big ? 4 : 2, w - 0.8, 0.5, 1.26)
      if (big) windowsRow(body, win, 2, w - 0.8, 1.5, 1.26)
      break
    }
    case 'workshop': {
      body.add(box(3.0, 2.0, 2.6, MAT.brick))
      body.add(gable(2.8, 1.0, 3.2, MAT.metal, 2.0))
      const gear = mesh(new THREE.TorusGeometry(0.45, 0.12, 6, 12), MAT.brass, 0, 1.45, 1.36)
      body.add(gear)
      animated = gear
      animKind = 'spin'
      body.add(box(0.35, 1.4, 0.35, MAT.metal, -1.0, 2.2, -0.6))
      windowsRow(body, win, 2, 2.0, 0.5, 1.31)
      chimney = new THREE.Vector3(-1.0, 3.7, -0.6)
      break
    }
    case 'relay': {
      body.add(cyl(1.3, 1.5, 0.5, MAT.stone, 0, 0, 0, 8))
      body.add(cyl(0.55, 0.7, 3.6, MAT.metal, 0, 0.5, 0, 10))
      for (const y of [1.3, 2.4, 3.5]) {
        const t = mesh(new THREE.TorusGeometry(0.66, 0.08, 6, 16), MAT.brass, 0, y, 0)
        t.rotation.x = Math.PI / 2
        body.add(t)
      }
      body.add(mesh(new THREE.SphereGeometry(0.45, 12, 10), win, 0, 4.3, 0))
      for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const p = cyl(0.12, 0.12, 1.4, MAT.rust, 0, 0, 0, 6)
        p.rotation.z = Math.PI / 2
        p.position.set(Math.cos(a) * 0.9, 0.7, Math.sin(a) * 0.9)
        p.rotation.y = -a
        body.add(p)
      }
      break
    }
    case 'drill': {
      body.add(box(3.2, 0.4, 3.2, MAT.stone))
      for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]] as const) {
        body.add(box(0.22, 4.4, 0.22, MAT.rust, x, 0.4, z))
      }
      body.add(box(2.6, 0.3, 2.6, MAT.rust, 0, 4.6, 0))
      const piston = cyl(0.45, 0.45, 2.6, MAT.metal, 0, 1.6, 0)
      body.add(piston)
      animated = piston
      animKind = 'piston'
      body.add(box(1.2, 0.8, 1.0, MAT.metal, 1.2, 0.4, 1.3))
      body.add(mesh(new THREE.SphereGeometry(0.18, 8, 6), win, 0, 4.95, 0))
      chimney = new THREE.Vector3(1.2, 1.5, 1.3)
      break
    }
    case 'sawmill': {
      for (const [x, z] of [[-1.4, -1.1], [1.4, -1.1], [-1.4, 1.1], [1.4, 1.1]] as const) {
        body.add(box(0.2, 2.0, 0.2, MAT.wood, x, 0, z))
      }
      body.add(gable(2.8, 0.9, 3.4, MAT.snow, 2.0))
      body.add(box(2.0, 0.8, 0.8, MAT.darkWood, 0, 0, 0))
      const saw = mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 16), MAT.metal, 0, 1.2, 0)
      saw.rotation.x = Math.PI / 2
      body.add(saw)
      animated = saw
      animKind = 'spin'
      const logs = new THREE.Group()
      for (let i = 0; i < 3; i++) {
        const l = mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.2, 7), MAT.wood, 0, 0.2 + (i === 2 ? 0.36 : 0), 1.0 + (i === 2 ? 0 : (i - 0.5) * 0.42))
        l.rotation.z = Math.PI / 2
        logs.add(l)
      }
      body.add(logs)
      body.add(mesh(new THREE.SphereGeometry(0.14, 8, 6), win, 1.4, 1.7, 1.25))
      break
    }
    case 'steelworks': {
      body.add(cyl(1.4, 1.7, 2.6, MAT.brick, -0.3, 0, -0.2, 10))
      body.add(cyl(0.3, 0.35, 4.6, MAT.metal, 1.1, 0, -1.0))
      body.add(cyl(0.25, 0.3, 3.8, MAT.metal, 1.3, 0, 0.6))
      body.add(box(1.0, 0.7, 0.2, win, -0.3, 0.4, 1.4))
      body.add(box(3.4, 0.3, 3.2, MAT.stone, 0, 0, 0))
      chimney = new THREE.Vector3(1.1, 4.7, -1.0)
      break
    }
  }
  return { group, windowMat: win, body, animated, animKind, chimney }
}

export function createScaffold(): THREE.Group {
  const g = new THREE.Group()
  const mat = MAT.wood
  for (const [x, z] of [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]] as const) {
    g.add(box(0.12, 2.6, 0.12, mat, x, 0, z))
  }
  for (const y of [0.9, 1.8, 2.6]) {
    g.add(box(2.9, 0.08, 0.08, mat, 0, y, 1.2))
    g.add(box(2.9, 0.08, 0.08, mat, 0, y, -1.2))
    g.add(box(0.08, 0.08, 2.5, mat, 1.4, y, 0))
    g.add(box(0.08, 0.08, 2.5, mat, -1.4, y, 0))
  }
  return g
}

export function createPileMesh(kind: PileKind, seed: number): THREE.Group {
  const g = new THREE.Group()
  let s = seed * 9301 + 49297
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  if (kind === 'coal') {
    for (let i = 0; i < 11; i++) {
      const r = 0.4 + rnd() * 0.6
      const m = mesh(new THREE.DodecahedronGeometry(r, 0), MAT.coal, (rnd() - 0.5) * 2.4, r * 0.5, (rnd() - 0.5) * 2.4)
      m.rotation.set(rnd() * 3, rnd() * 3, 0)
      g.add(m)
    }
    g.add(mesh(new THREE.ConeGeometry(1.6, 1.3, 7), MAT.coal, 0, 0.65, 0))
    g.add(mesh(new THREE.ConeGeometry(0.7, 0.35, 7), MAT.snow, 0, 1.2, 0))
  } else if (kind === 'wood') {
    for (let i = 0; i < 6; i++) {
      const c = box(0.9, 0.7, 0.9, MAT.wood, (rnd() - 0.5) * 2.2, (i > 3 ? 0.7 : 0), (rnd() - 0.5) * 2.2)
      c.rotation.y = rnd() * 2
      g.add(c)
    }
    for (let i = 0; i < 4; i++) {
      const l = mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.4, 7), MAT.darkWood, 0, 0.2 + Math.floor(i / 2) * 0.34, (i % 2) * 0.38 - 0.2)
      l.rotation.z = Math.PI / 2
      l.rotation.y = 0.6
      g.add(l)
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const b = box(2.2 * (0.6 + rnd() * 0.5), 0.2, 0.3, MAT.rust, (rnd() - 0.5) * 1.6, i * 0.12, (rnd() - 0.5) * 1.8)
      b.rotation.y = rnd() * 3
      g.add(b)
    }
    const plate = box(1.2, 0.1, 1.0, MAT.metal, 0.3, 0.8, 0)
    plate.rotation.z = 0.4
    g.add(plate)
    const gear = mesh(new THREE.TorusGeometry(0.5, 0.15, 5, 10), MAT.rust, -0.6, 0.4, 0.6)
    gear.rotation.x = 1.2
    g.add(gear)
  }
  return g
}

export interface GeneratorVisual {
  group: THREE.Group
  glowMat: THREE.MeshStandardMaterial
  fan: THREE.Object3D
}

export function createGenerator(): GeneratorVisual {
  const group = new THREE.Group()
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x331a0a, emissive: 0xff7a1a, emissiveIntensity: 0.2, roughness: 0.5 })
  group.add(cyl(5.4, 5.8, 0.8, MAT.stone, 0, 0, 0, 8))
  group.add(cyl(4.2, 4.6, 0.6, MAT.metal, 0, 0.8, 0, 8))
  // Furnace ring
  group.add(cyl(3.0, 3.0, 1.6, glowMat, 0, 1.4, 0, 16))
  // Core tower
  group.add(cyl(2.2, 2.9, 7.0, MAT.metal, 0, 3.0, 0, 16))
  for (const y of [3.4, 5.2, 7.0, 8.8]) {
    const t = mesh(new THREE.TorusGeometry(2.55 - (y - 3.4) * 0.07, 0.18, 8, 24), MAT.brass, 0, y, 0)
    t.rotation.x = Math.PI / 2
    group.add(t)
  }
  group.add(cyl(1.4, 2.2, 2.2, MAT.metal, 0, 10.0, 0, 16))
  group.add(cyl(1.9, 1.4, 1.4, MAT.rust, 0, 12.2, 0, 16))
  group.add(cyl(1.6, 1.6, 0.3, glowMat, 0, 13.4, 0, 16))
  // Buttresses
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const arm = box(0.5, 4.5, 2.2, MAT.rust, 0, 0.8, 0)
    arm.position.set(Math.cos(a) * 3.6, 0.8 + 2.25, Math.sin(a) * 3.6)
    arm.rotation.y = -a
    arm.rotation.z = Math.cos(a) * 0
    group.add(arm)
    const pipe = cyl(0.25, 0.25, 6, MAT.brass, Math.cos(a + 0.5) * 3.2, 0.8, Math.sin(a + 0.5) * 3.2, 8)
    group.add(pipe)
  }
  // Furnace mouths
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    const mouth = box(1.2, 0.9, 0.3, glowMat, 0, 0, 0)
    mouth.position.set(Math.cos(a) * 4.5, 1.5, Math.sin(a) * 4.5)
    mouth.rotation.y = -a + Math.PI / 2
    group.add(mouth)
  }
  const fan = new THREE.Group()
  for (let i = 0; i < 4; i++) {
    const blade = box(2.6, 0.08, 0.4, MAT.metal, 0, 0, 0)
    blade.rotation.y = (i / 4) * Math.PI
    fan.add(blade)
  }
  fan.position.y = 12.9
  group.add(fan)
  return { group, glowMat, fan }
}
