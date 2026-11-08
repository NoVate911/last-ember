import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CRATER_RADIUS } from '../grid'

/** Bake a vertex colour so several materials can share one instanced mesh. */
function painted(g: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g
  geo.deleteAttribute('uv')
  const c = new THREE.Color(color)
  const n = (geo.attributes['position'] as THREE.BufferAttribute).count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

/** Spruce: trunk, five needle tiers, snow resting on each tier. */
function spruceGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [painted(new THREE.CylinderGeometry(0.12, 0.2, 1.4, 6).translate(0, 0.7, 0), 0x3a2a1e)]
  for (let i = 0; i < 5; i++) {
    const r = 1.35 - i * 0.24
    const y = 0.9 + i * 0.75
    parts.push(painted(new THREE.ConeGeometry(r, 1.3, 8).translate(0, y + 0.65, 0), i % 2 ? 0x22302a : 0x1c2a24))
    parts.push(painted(new THREE.ConeGeometry(r * 0.75, 0.45, 8).translate(0, y + 0.95, 0), 0xf2f6fa))
  }
  parts.push(painted(new THREE.ConeGeometry(0.25, 0.6, 6).translate(0, 5.0, 0), 0xf2f6fa))
  return mergeGeometries(parts)!
}

/** Bare dead tree with a few branches. */
function deadTreeGeo(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [painted(new THREE.CylinderGeometry(0.08, 0.18, 3.2, 6).translate(0, 1.6, 0), 0x2e2620)]
  for (let i = 0; i < 5; i++) {
    const b = new THREE.CylinderGeometry(0.03, 0.06, 1.0, 5)
    b.translate(0, 0.5, 0)
    b.rotateZ(0.7 + (i % 2) * 0.3)
    b.rotateY(i * 1.3)
    b.translate(0, 1.4 + i * 0.35, 0)
    parts.push(painted(b, 0x2e2620))
  }
  return mergeGeometries(parts)!
}

/** Boulder with a snow cap. */
function rockGeo(): THREE.BufferGeometry {
  return mergeGeometries([
    painted(new THREE.DodecahedronGeometry(1.4, 1).scale(1, 0.7, 1), 0x4d545c),
    painted(new THREE.SphereGeometry(1.2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1).translate(0, 0.62, 0), 0xf2f6fa),
  ])!
}

function smoothstep(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function noise(x: number, z: number) {
  return (
    Math.sin(x * 0.11 + Math.cos(z * 0.07)) * 0.5 +
    Math.sin(z * 0.13 + x * 0.05) * 0.35 +
    Math.sin((x + z) * 0.31) * 0.15
  )
}

export function terrainHeight(x: number, z: number): number {
  const r = Math.hypot(x, z)
  const rim = smoothstep(CRATER_RADIUS - 1, CRATER_RADIUS + 26, r)
  return rim * 24 + rim * noise(x, z) * 5 + (1 - rim) * noise(x * 2, z * 2) * 0.05
}

export function createTerrain(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(320, 320, 160, 160)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes['position'] as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const snow = new THREE.Color(0xeef3f9)
  const rock = new THREE.Color(0x58606a)
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    pos.setY(i, terrainHeight(x, z))
    const r = Math.hypot(x, z)
    const rimMid = smoothstep(CRATER_RADIUS + 2, CRATER_RADIUS + 10, r) * (1 - smoothstep(CRATER_RADIUS + 18, CRATER_RADIUS + 28, r))
    const n = noise(x * 1.7, z * 1.7)
    const rockAmt = rimMid * (n > 0.1 ? 0.8 : 0.15)
    tmp.copy(snow).lerp(rock, rockAmt)
    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 })
  const m = new THREE.Mesh(geo, mat)
  m.receiveShadow = true
  return m
}

export function createForest(): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, vertexColors: true })
  const count = 300
  const deadCount = 40
  const trees = new THREE.InstancedMesh(spruceGeo(), mat, count)
  const dead = new THREE.InstancedMesh(deadTreeGeo(), mat, deadCount)
  const rocks = new THREE.InstancedMesh(rockGeo(), mat, 90)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const sc = new THREE.Vector3()
  const p = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let i = 0; i < count; i++) {
    const a = rnd() * Math.PI * 2
    const r = CRATER_RADIUS + 8 + rnd() * 45
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const s = 0.7 + rnd() * 0.7
    p.set(x, terrainHeight(x, z) - 0.3, z)
    q.setFromAxisAngle(up, rnd() * 6)
    sc.set(s, s * (0.85 + rnd() * 0.4), s)
    m.compose(p, q, sc)
    trees.setMatrixAt(i, m)
  }
  for (let i = 0; i < deadCount; i++) {
    const a = rnd() * Math.PI * 2
    const r = CRATER_RADIUS + 3 + rnd() * 20
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const s = 0.7 + rnd() * 0.6
    p.set(x, terrainHeight(x, z) - 0.2, z)
    q.setFromEuler(new THREE.Euler((rnd() - 0.5) * 0.25, rnd() * 6, (rnd() - 0.5) * 0.25))
    sc.set(s, s, s)
    m.compose(p, q, sc)
    dead.setMatrixAt(i, m)
  }
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2
    const r = CRATER_RADIUS + 2 + rnd() * 30
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const s = 0.5 + rnd() * 1.6
    p.set(x, terrainHeight(x, z) - 0.2, z)
    q.setFromAxisAngle(up, rnd() * 6)
    sc.set(s * (0.8 + rnd() * 0.4), s * (0.6 + rnd() * 0.4), s)
    m.compose(p, q, sc)
    rocks.setMatrixAt(i, m)
  }
  for (const mesh of [trees, dead, rocks]) {
    mesh.castShadow = true
    mesh.receiveShadow = true
  }
  g.add(trees, dead, rocks)
  return g
}

function radialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, inner)
  grad.addColorStop(1, outer)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export class SnowSystem {
  points: THREE.Points
  private velocities: Float32Array
  private count = 6000
  private material: THREE.PointsMaterial

  constructor() {
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(this.count * 3)
    this.velocities = new Float32Array(this.count)
    for (let i = 0; i < this.count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 180
      pos[i * 3 + 1] = Math.random() * 70
      pos[i * 3 + 2] = (Math.random() - 0.5) * 180
      this.velocities[i] = 2 + Math.random() * 3
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.material = new THREE.PointsMaterial({
      size: 0.45, map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      transparent: true, depthWrite: false, opacity: 0.85,
    })
    this.points = new THREE.Points(geo, this.material)
    this.points.frustumCulled = false
  }

  update(dt: number, storm: number, center: THREE.Vector3) {
    const attr = this.points.geometry.attributes['position'] as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const wind = 2 + storm * 22
    const fall = 1 + storm * 1.5
    const active = Math.floor(this.count * (0.35 + storm * 0.65))
    for (let i = 0; i < this.count; i++) {
      const ix = i * 3
      if (i >= active) { arr[ix + 1] = -50; continue }
      arr[ix] = arr[ix]! + wind * dt
      arr[ix + 1] = arr[ix + 1]! - this.velocities[i]! * fall * dt
      arr[ix + 2] = arr[ix + 2]! + Math.sin(i + arr[ix + 1]! * 0.1) * dt * 0.8
      if (arr[ix + 1]! < 0 || arr[ix]! > center.x + 90) {
        arr[ix] = center.x + (Math.random() - 0.5) * 180 - (storm > 0.3 ? 30 : 0)
        arr[ix + 1] = 40 + Math.random() * 30
        arr[ix + 2] = center.z + (Math.random() - 0.5) * 180
      }
    }
    attr.needsUpdate = true
    this.material.size = 0.45 + storm * 0.25
  }
}

interface Puff { sprite: THREE.Sprite; life: number; max: number; vx: number; vz: number; alive: boolean }

export class SmokeSystem {
  group = new THREE.Group()
  private puffs: Puff[] = []
  private texture = radialTexture('rgba(90,90,95,0.9)', 'rgba(90,90,95,0)')
  private acc = new Map<string, number>()

  constructor(size = 260) {
    for (let i = 0; i < size; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture, transparent: true, depthWrite: false, opacity: 0 }))
      sprite.visible = false
      this.group.add(sprite)
      this.puffs.push({ sprite, life: 0, max: 1, vx: 0, vz: 0, alive: false })
    }
  }

  private spawn(pos: THREE.Vector3, scale: number, wind: number) {
    const p = this.puffs.find((x) => !x.alive)
    if (!p) return
    p.alive = true
    p.life = 0
    p.max = 3 + Math.random() * 2
    p.vx = wind * (0.6 + Math.random() * 0.4)
    p.vz = (Math.random() - 0.5) * 0.6
    p.sprite.position.copy(pos)
    p.sprite.scale.setScalar(scale)
    p.sprite.userData['base'] = scale
    p.sprite.visible = true
  }

  update(dt: number, emitters: { key: string; pos: THREE.Vector3; rate: number; scale: number }[], wind: number) {
    for (const e of emitters) {
      const a = (this.acc.get(e.key) ?? 0) + dt * e.rate
      let n = Math.floor(a)
      this.acc.set(e.key, a - n)
      while (n-- > 0) this.spawn(e.pos, e.scale, wind)
    }
    for (const p of this.puffs) {
      if (!p.alive) continue
      p.life += dt
      const t = p.life / p.max
      if (t >= 1) { p.alive = false; p.sprite.visible = false; continue }
      p.sprite.position.x += p.vx * dt
      p.sprite.position.z += p.vz * dt
      p.sprite.position.y += (2.2 - t) * dt
      const base = (p.sprite.userData['base'] as number) ?? 1
      p.sprite.scale.setScalar(base * (1 + t * 2.5))
      ;(p.sprite.material as THREE.SpriteMaterial).opacity = Math.sin(t * Math.PI) * 0.55
    }
  }
}
