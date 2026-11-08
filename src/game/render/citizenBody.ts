import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Instanced citizens. Each body part is one InstancedMesh (≈20 draw calls for the whole crowd).
 * Parts are merged from many primitives with baked vertex colours for shading details
 * (belts, cuffs, patches, faces); per-instance colours tint coats, trousers, hats and skin.
 */

const HIP = new THREE.Vector3(0.075, 0.46, 0)
const SHOULDER = new THREE.Vector3(0.19, 0.83, 0)
const NECK_Y = 0.9

const COATS = [0x4a3b2e, 0x3d4652, 0x5a4a3a, 0x2f3a33, 0x6b5440, 0x3a3030, 0x50555c, 0x5c3b2e, 0x2b2f3a, 0x46503f]
const PANTS = [0x2a2a2e, 0x3a3328, 0x2e3338, 0x403a34, 0x34302c]
const SKIN = [0xe0b89a, 0xc99878, 0xa8775a, 0xf0c8a8, 0x8a5a40, 0xd8a888]
const HATS = [0x3b2b20, 0x55473a, 0x1f1f22, 0x6e6252, 0x4a2f22, 0x7a7266, 0x2e3440]
const SCARVES = [0x8a2f2a, 0x6a6f78, 0x8a6a2a, 0x2f4f6a, 0xb8b0a0, 0x5a2a4a, 0x3f5a3a]
const FUR = [0xd8cbb0, 0x8a7560, 0x5a4a3a, 0xe8e4dc, 0x6e6252]
const HAIR = [0x2a1d14, 0x5a3a20, 0x8a6a40, 0x9a9a9a, 0x3a2a1a]

export interface Pose {
  x: number
  z: number
  yaw: number
  scale: number
  bob: number
  lean: number
  legL: number
  legR: number
  armLX: number
  armRX: number
  armLZ: number
  armRZ: number
  nod: number
  hidden: boolean
  pack: boolean
  crate: boolean
  tool: boolean
  hammer: boolean
  beard: boolean
  goggles: boolean
}

export function basePose(): Pose {
  return {
    x: 0, z: 0, yaw: 0, scale: 1, bob: 0, lean: 0, legL: 0, legR: 0,
    armLX: 0.05, armRX: 0.05, armLZ: 0.1, armRZ: 0.1, nod: 0,
    hidden: false, pack: false, crate: false, tool: false, hammer: false, beard: false, goggles: false,
  }
}

// ---------- Geometry helpers ----------
type RGB = [number, number, number]
const gray = (v: number): RGB => [v, v, v]
const hex = (h: number): RGB => { const c = new THREE.Color(h); return [c.r, c.g, c.b] }

/** Bake a flat vertex colour into a (non-indexed) geometry. */
function paint(g: THREE.BufferGeometry, rgb: RGB): THREE.BufferGeometry {
  const geo = g.index ? g.toNonIndexed() : g
  geo.deleteAttribute('uv')
  const n = (geo.attributes['position'] as THREE.BufferAttribute).count
  const col = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { col[i * 3] = rgb[0]; col[i * 3 + 1] = rgb[1]; col[i * 3 + 2] = rgb[2] }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return geo
}

function at(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  g.scale(sx, sy, sz)
  g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz)
  g.translate(x, y, z)
  return g
}

function merge(parts: THREE.BufferGeometry[]) {
  return mergeGeometries(parts)!
}

const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg)
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
const sph = (r: number, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs)

// ---------- Body parts ----------
function torsoGeo() {
  return merge([
    paint(at(cyl(0.13, 0.17, 0.42, 12), 0, 0.67, 0), gray(1)),
    paint(at(cyl(0.17, 0.215, 0.24, 12), 0, 0.37, 0), gray(0.92)),
    paint(at(new THREE.SphereGeometry(0.15, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.86, 0, 0, 0, 0, 1.25, 0.45, 0.9), gray(1)),
    // Quilted seams
    paint(at(cyl(0.155, 0.158, 0.02, 12), 0, 0.62, 0), gray(0.72)),
    paint(at(cyl(0.142, 0.145, 0.02, 12), 0, 0.76, 0), gray(0.72)),
    // Belt with buckle
    paint(at(cyl(0.165, 0.168, 0.05, 12), 0, 0.5, 0), gray(0.28)),
    paint(at(box(0.06, 0.05, 0.02), 0, 0.5, 0.168), [0.95, 0.8, 0.45]),
    // Front placket, buttons, pockets
    paint(at(box(0.035, 0.42, 0.02), 0, 0.64, 0.158), gray(0.78)),
    ...[0.58, 0.68, 0.78].map((y) => paint(at(sph(0.012, 6, 4), 0, y, 0.172), gray(0.25))),
    ...[-1, 1].map((s) => paint(at(box(0.07, 0.06, 0.02), s * 0.09, 0.4, 0.2), gray(0.8))),
    // Shoulder straps (pack harness)
    ...[-1, 1].map((s) => paint(at(box(0.03, 0.3, 0.012), s * 0.08, 0.72, 0.15, 0.12), gray(0.35))),
  ])
}

function collarGeo() {
  return merge([
    paint(at(new THREE.TorusGeometry(0.1, 0.045, 6, 14), 0, 0.88, 0, Math.PI / 2), gray(1)),
    ...[-1, 1].map((s) => paint(at(box(0.08, 0.16, 0.025), s * 0.06, 0.8, 0.15, -0.15, 0, s * 0.35), gray(0.9))),
  ])
}

function headGeo() {
  const eye = (s: number) => paint(at(sph(0.014, 6, 4), s * 0.033, 1.015, 0.088), gray(0.08))
  return merge([
    paint(at(sph(0.095, 14, 12), 0, 1.0, 0, 0, 0, 0, 1, 1.08, 1), gray(1)),
    paint(at(box(0.028, 0.04, 0.04), 0, 0.99, 0.098), gray(0.95)),
    paint(at(sph(0.02, 6, 4), 0, 0.975, 0.105), [1, 0.82, 0.8]),
    eye(-1), eye(1),
    ...[-1, 1].map((s) => paint(at(box(0.035, 0.01, 0.012), s * 0.033, 1.04, 0.09, 0, 0, s * -0.15), gray(0.3))),
    paint(at(box(0.04, 0.008, 0.01), 0, 0.955, 0.092), [0.6, 0.35, 0.33]),
    ...[-1, 1].map((s) => paint(at(sph(0.022, 6, 4), s * 0.06, 0.985, 0.075), [1, 0.85, 0.85])),
    ...[-1, 1].map((s) => paint(at(sph(0.022, 6, 5), s * 0.095, 1.0, 0, 0, 0, 0, 0.5, 1, 0.8), gray(0.95))),
    paint(at(cyl(0.045, 0.05, 0.08, 8), 0, 0.9, 0), gray(0.9)),
  ])
}

function beardGeo() {
  return merge([
    paint(at(sph(0.07, 10, 8), 0, 0.95, 0.055, 0, 0, 0, 1.05, 1.0, 0.75), gray(1)),
    paint(at(box(0.07, 0.012, 0.015), 0, 0.968, 0.1), gray(0.85)),
  ])
}

function hatGeo() {
  return merge([
    paint(at(cyl(0.102, 0.11, 0.1, 14), 0, 1.075, 0), gray(0.78)),
    paint(at(new THREE.SphereGeometry(0.102, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.12, 0, 0, 0, 0, 1, 0.45, 1), gray(0.78)),
    // Fur brim and folded ear flaps
    paint(at(new THREE.TorusGeometry(0.105, 0.03, 6, 16), 0, 1.06, 0, Math.PI / 2), gray(1)),
    paint(at(box(0.19, 0.06, 0.04), 0, 1.09, 0.1, -0.25), gray(1)),
    ...[-1, 1].map((s) => paint(at(box(0.035, 0.12, 0.1), s * 0.108, 0.99, 0, 0, 0, s * 0.12), gray(0.95))),
    ...[-1, 1].map((s) => paint(at(cyl(0.005, 0.005, 0.07, 4), s * 0.1, 0.92, 0.02), gray(0.3))),
    paint(at(sph(0.018, 6, 4), 0, 1.165, 0), gray(0.5)),
  ])
}

function gogglesGeo() {
  return merge([
    paint(at(new THREE.TorusGeometry(0.106, 0.012, 4, 18), 0, 1.13, 0, Math.PI / 2), gray(0.15)),
    ...[-1, 1].map((s) => paint(at(cyl(0.028, 0.03, 0.03, 10), s * 0.04, 1.135, 0.1, Math.PI / 2 - 0.4), [0.75, 0.6, 0.3])),
    ...[-1, 1].map((s) => paint(at(cyl(0.022, 0.022, 0.032, 10), s * 0.04, 1.137, 0.102, Math.PI / 2 - 0.4), [0.25, 0.45, 0.55])),
  ])
}

function scarfGeo() {
  return merge([
    paint(at(new THREE.TorusGeometry(0.075, 0.035, 6, 14), 0, 0.89, 0, Math.PI / 2), gray(1)),
    paint(at(box(0.05, 0.22, 0.025), 0.05, 0.77, 0.15, 0, 0, 0.12), gray(0.92)),
    paint(at(box(0.045, 0.16, 0.025), 0.0, 0.8, 0.155, 0, 0, -0.1), gray(0.85)),
    ...[0, 1, 2, 3].map((i) => paint(at(box(0.008, 0.03, 0.01), 0.033 + i * 0.012, 0.65, 0.16), gray(0.8))),
  ])
}

function packGeo() {
  return merge([
    paint(at(box(0.22, 0.28, 0.12), 0, 0.66, -0.19), hex(0x5a4632)),
    paint(at(box(0.23, 0.1, 0.13), 0, 0.79, -0.19, 0.15), hex(0x4a3828)),
    paint(at(box(0.16, 0.1, 0.03), 0, 0.6, -0.26), hex(0x4a3828)),
    paint(at(cyl(0.055, 0.055, 0.28, 10), 0, 0.84, -0.2, 0, 0, Math.PI / 2), hex(0x6a7a5a)),
    ...[-1, 1].map((s) => paint(at(cyl(0.058, 0.058, 0.015, 10), s * 0.08, 0.84, -0.2, 0, 0, Math.PI / 2), hex(0x2a2018))),
    paint(at(cyl(0.05, 0.04, 0.07, 10), 0.13, 0.55, -0.2), hex(0x3a3d42)),
  ])
}

function crateGeo() {
  return merge([
    paint(at(box(0.3, 0.2, 0.22), 0, 0.6, 0.27), hex(0x7a5a38)),
    paint(at(box(0.32, 0.03, 0.24), 0, 0.71, 0.27), hex(0x5a4028)),
    ...[-0.1, 0.1].map((x) => paint(at(box(0.02, 0.21, 0.23), x, 0.6, 0.27), hex(0x3a2a1a))),
  ])
}

function toolGeo() {
  // Shovel in the right hand (arm space: hand at y = -0.38)
  return merge([
    paint(at(cyl(0.015, 0.015, 0.8, 5), 0, -0.6, 0.18, 0.5), hex(0x6a4a2c)),
    paint(at(box(0.08, 0.02, 0.02), 0, -0.25, 0.0, 0.5), hex(0x6a4a2c)),
    paint(at(box(0.15, 0.2, 0.02), 0, -0.98, 0.38, 0.5), hex(0x4a4d52)),
    paint(at(box(0.04, 0.06, 0.03), 0, -0.88, 0.33, 0.5), hex(0x2a2d32)),
  ])
}

function hammerGeo() {
  // Hammer held in the right hand, pointing forward
  return merge([
    paint(at(cyl(0.014, 0.016, 0.34, 6), 0, -0.4, 0.14, Math.PI / 2), hex(0x6a4a2c)),
    paint(at(box(0.16, 0.07, 0.07), 0, -0.4, 0.3), hex(0x3a3d42)),
    paint(at(box(0.04, 0.05, 0.05), 0.09, -0.4, 0.3), hex(0x2a2d32)),
  ])
}

function legGeo() {
  return merge([
    paint(at(cyl(0.058, 0.05, 0.42, 9), 0, -0.21, 0), gray(1)),
    paint(at(box(0.07, 0.07, 0.02), 0, -0.2, 0.05), gray(0.75)),
    paint(at(cyl(0.054, 0.054, 0.12, 9), 0, -0.33, 0), gray(0.7)),
  ])
}

function bootGeo() {
  return merge([
    paint(at(box(0.1, 0.09, 0.18), 0, -0.43, 0.03), hex(0x2a221c)),
    paint(at(box(0.11, 0.025, 0.2), 0, -0.47, 0.035), hex(0x151210)),
    paint(at(cyl(0.065, 0.06, 0.06, 9), 0, -0.37, 0), hex(0x8a7a64)),
  ])
}

function armGeo() {
  return merge([
    paint(at(cyl(0.052, 0.045, 0.36, 9), 0, -0.18, 0), gray(1)),
    paint(at(sph(0.05, 8, 6), 0, -0.02, 0), gray(1)),
    paint(at(box(0.06, 0.06, 0.02), 0, -0.18, -0.045), gray(0.8)),
    paint(at(cyl(0.052, 0.052, 0.05, 9), 0, -0.33, 0), gray(0.65)),
  ])
}

function mittGeo() {
  return merge([
    paint(at(sph(0.045, 8, 6), 0, -0.39, 0, 0, 0, 0, 1, 1.2, 0.85), hex(0x3a2e26)),
    paint(at(sph(0.018, 6, 4), 0.035, -0.37, 0.025), hex(0x3a2e26)),
    paint(at(cyl(0.05, 0.05, 0.03, 9), 0, -0.35, 0), hex(0xb8a88a)),
  ])
}

type Part =
  | 'torso' | 'collar' | 'head' | 'beard' | 'hat' | 'goggles' | 'scarf' | 'pack' | 'crate' | 'tool' | 'hammer'
  | 'legL' | 'legR' | 'bootL' | 'bootR' | 'armL' | 'armR' | 'mittL' | 'mittR'

export class CitizenBodies {
  group = new THREE.Group()
  private parts = {} as Record<Part, THREE.InstancedMesh>
  private root = new THREE.Matrix4()
  private local = new THREE.Matrix4()
  private out = new THREE.Matrix4()
  private headM = new THREE.Matrix4()
  private zero = new THREE.Matrix4().makeScale(0, 0, 0)
  private q = new THREE.Quaternion()
  private qLean = new THREE.Quaternion()
  private v = new THREE.Vector3()
  private sc = new THREE.Vector3()
  private euler = new THREE.Euler()
  private up = new THREE.Vector3(0, 1, 0)
  private xAxis = new THREE.Vector3(1, 0, 0)

  constructor(max: number, seed: number) {
    const mat = (roughness = 0.9) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, vertexColors: true })
    const make = (name: Part, geo: THREE.BufferGeometry, material: THREE.Material) => {
      const m = new THREE.InstancedMesh(geo, material, max)
      m.castShadow = true
      m.frustumCulled = false
      this.parts[name] = m
      this.group.add(m)
    }
    const cloth = mat()
    const legs = legGeo()
    const arms = armGeo()
    const boot = bootGeo()
    const mitt = mittGeo()
    make('torso', torsoGeo(), cloth)
    make('collar', collarGeo(), mat(1))
    make('head', headGeo(), mat(0.7))
    make('beard', beardGeo(), mat(1))
    make('hat', hatGeo(), mat(1))
    make('goggles', gogglesGeo(), mat(0.35))
    make('scarf', scarfGeo(), mat(1))
    make('pack', packGeo(), mat())
    make('crate', crateGeo(), mat())
    make('tool', toolGeo(), mat(0.5))
    make('hammer', hammerGeo(), mat(0.5))
    make('legL', legs, cloth)
    make('legR', legs, cloth)
    make('bootL', boot, mat(0.7))
    make('bootR', boot, mat(0.7))
    make('armL', arms, cloth)
    make('armR', arms, cloth)
    make('mittL', mitt, mat())
    make('mittR', mitt, mat())

    let s = seed
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
    const pick = (arr: number[]) => arr[Math.floor(rnd() * arr.length)] ?? arr[0]!
    const c = new THREE.Color()
    for (let i = 0; i < max; i++) {
      const coat = c.setHex(pick(COATS)).clone()
      this.parts.torso.setColorAt(i, coat)
      this.parts.armL.setColorAt(i, coat)
      this.parts.armR.setColorAt(i, coat)
      const pants = c.setHex(pick(PANTS)).clone()
      this.parts.legL.setColorAt(i, pants)
      this.parts.legR.setColorAt(i, pants)
      this.parts.head.setColorAt(i, c.setHex(pick(SKIN)))
      this.parts.hat.setColorAt(i, c.setHex(pick(HATS)))
      this.parts.scarf.setColorAt(i, c.setHex(pick(SCARVES)))
      this.parts.collar.setColorAt(i, c.setHex(pick(FUR)))
      this.parts.beard.setColorAt(i, c.setHex(pick(HAIR)))
    }
  }

  private hide(i: number) {
    for (const m of Object.values(this.parts)) m.setMatrixAt(i, this.zero)
  }

  private limb(part: Part, i: number, pivot: THREE.Vector3, side: number, swingX: number, outZ: number) {
    this.euler.set(swingX, 0, outZ * side)
    this.local.makeRotationFromEuler(this.euler)
    this.local.setPosition(pivot.x * side, pivot.y, pivot.z)
    this.out.multiplyMatrices(this.root, this.local)
    this.parts[part].setMatrixAt(i, this.out)
  }

  apply(i: number, p: Pose) {
    if (p.hidden) { this.hide(i); return }
    this.v.set(p.x, p.bob, p.z)
    this.q.setFromAxisAngle(this.up, p.yaw)
    this.qLean.setFromAxisAngle(this.xAxis, p.lean)
    this.q.multiply(this.qLean)
    this.sc.setScalar(p.scale)
    this.root.compose(this.v, this.q, this.sc)

    this.parts.torso.setMatrixAt(i, this.root)
    this.parts.collar.setMatrixAt(i, this.root)
    this.parts.scarf.setMatrixAt(i, this.root)
    this.parts.pack.setMatrixAt(i, p.pack ? this.root : this.zero)
    this.parts.crate.setMatrixAt(i, p.crate ? this.root : this.zero)

    // Head nods around the neck
    this.local.makeTranslation(0, NECK_Y, 0)
    this.local.multiply(this.out.makeRotationX(p.nod))
    this.local.multiply(this.out.makeTranslation(0, -NECK_Y, 0))
    this.headM.multiplyMatrices(this.root, this.local)
    this.parts.head.setMatrixAt(i, this.headM)
    this.parts.hat.setMatrixAt(i, this.headM)
    this.parts.beard.setMatrixAt(i, p.beard ? this.headM : this.zero)
    this.parts.goggles.setMatrixAt(i, p.goggles ? this.headM : this.zero)

    this.limb('legL', i, HIP, -1, p.legL, 0)
    this.limb('bootL', i, HIP, -1, p.legL, 0)
    this.limb('legR', i, HIP, 1, p.legR, 0)
    this.limb('bootR', i, HIP, 1, p.legR, 0)
    this.limb('armL', i, SHOULDER, -1, p.armLX, p.armLZ)
    this.limb('mittL', i, SHOULDER, -1, p.armLX, p.armLZ)
    this.limb('armR', i, SHOULDER, 1, p.armRX, p.armRZ)
    this.limb('mittR', i, SHOULDER, 1, p.armRX, p.armRZ)
    if (p.tool) this.limb('tool', i, SHOULDER, 1, p.armRX, p.armRZ)
    else this.parts.tool.setMatrixAt(i, this.zero)
    if (p.hammer) this.limb('hammer', i, SHOULDER, 1, p.armRX, p.armRZ)
    else this.parts.hammer.setMatrixAt(i, this.zero)
  }

  finish(count: number) {
    for (const m of Object.values(this.parts)) {
      m.count = count
      m.instanceMatrix.needsUpdate = true
    }
  }
}
