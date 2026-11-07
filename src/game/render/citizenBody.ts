import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Instanced body parts for the citizens. Each part is one InstancedMesh, so a crowd
 * of 120 people costs ~15 draw calls. Poses are applied per instance every frame.
 */

const HIP = new THREE.Vector3(0.075, 0.46, 0)
const SHOULDER = new THREE.Vector3(0.19, 0.83, 0)
const NECK_Y = 0.9

const COATS = [0x4a3b2e, 0x3d4652, 0x5a4a3a, 0x2f3a33, 0x6b5440, 0x3a3030, 0x50555c, 0x5c3b2e, 0x2b2f3a]
const PANTS = [0x2a2a2e, 0x3a3328, 0x2e3338, 0x403a34]
const SKIN = [0xe0b89a, 0xc99878, 0xa8775a, 0xf0c8a8, 0x8a5a40, 0xd8a888]
const HATS = [0x3b2b20, 0x55473a, 0x1f1f22, 0x6e6252, 0x4a2f22, 0x7a7266]
const SCARVES = [0x8a2f2a, 0x6a6f78, 0x8a6a2a, 0x2f4f6a, 0xb8b0a0, 0x5a2a4a]

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
}

export function basePose(): Pose {
  return {
    x: 0, z: 0, yaw: 0, scale: 1, bob: 0, lean: 0, legL: 0, legR: 0,
    armLX: 0.05, armRX: 0.05, armLZ: 0.1, armRZ: 0.1, nod: 0,
    hidden: false, pack: false, crate: false, tool: false,
  }
}

function merge(parts: THREE.BufferGeometry[]) {
  return mergeGeometries(parts)!
}

function torsoGeo() {
  const coat = new THREE.CylinderGeometry(0.13, 0.17, 0.42, 10)
  coat.translate(0, 0.67, 0)
  const skirt = new THREE.CylinderGeometry(0.17, 0.21, 0.2, 10)
  skirt.translate(0, 0.38, 0)
  const shoulders = new THREE.SphereGeometry(0.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)
  shoulders.scale(1.25, 0.45, 0.9)
  shoulders.translate(0, 0.86, 0)
  const buttons = new THREE.BoxGeometry(0.03, 0.3, 0.02)
  buttons.translate(0, 0.66, 0.155)
  return merge([coat, skirt, shoulders, buttons])
}

function headGeo() {
  const head = new THREE.SphereGeometry(0.095, 12, 10)
  head.scale(1, 1.08, 1)
  head.translate(0, 1.0, 0)
  const nose = new THREE.BoxGeometry(0.03, 0.04, 0.04)
  nose.translate(0, 0.99, 0.098)
  const neck = new THREE.CylinderGeometry(0.045, 0.05, 0.08, 8)
  neck.translate(0, 0.9, 0)
  return merge([head, nose, neck])
}

function hatGeo() {
  const crown = new THREE.CylinderGeometry(0.1, 0.108, 0.09, 12)
  crown.translate(0, 1.075, 0)
  const top = new THREE.SphereGeometry(0.1, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2)
  top.scale(1, 0.35, 1)
  top.translate(0, 1.12, 0)
  const flapL = new THREE.BoxGeometry(0.03, 0.1, 0.09)
  flapL.translate(-0.105, 1.0, 0)
  const flapR = new THREE.BoxGeometry(0.03, 0.1, 0.09)
  flapR.translate(0.105, 1.0, 0)
  const brim = new THREE.BoxGeometry(0.17, 0.045, 0.03)
  brim.translate(0, 1.075, 0.1)
  return merge([crown, top, flapL, flapR, brim])
}

function scarfGeo() {
  const ring = new THREE.TorusGeometry(0.075, 0.035, 6, 14)
  ring.rotateX(Math.PI / 2)
  ring.translate(0, 0.89, 0)
  const tail = new THREE.BoxGeometry(0.05, 0.2, 0.025)
  tail.rotateZ(0.12)
  tail.translate(0.05, 0.78, 0.15)
  return merge([ring, tail])
}

function packGeo() {
  const bag = new THREE.BoxGeometry(0.2, 0.25, 0.11)
  bag.translate(0, 0.66, -0.19)
  const roll = new THREE.CylinderGeometry(0.05, 0.05, 0.24, 8)
  roll.rotateZ(Math.PI / 2)
  roll.translate(0, 0.82, -0.19)
  return merge([bag, roll])
}

function crateGeo() {
  const box = new THREE.BoxGeometry(0.3, 0.2, 0.22)
  box.translate(0, 0.6, 0.27)
  const lid = new THREE.BoxGeometry(0.32, 0.03, 0.24)
  lid.translate(0, 0.71, 0.27)
  return merge([box, lid])
}

function toolGeo() {
  // Shovel held in the right hand (arm space: hand at y = -0.38)
  const handle = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 5)
  handle.rotateX(0.5)
  handle.translate(0, -0.6, 0.18)
  const blade = new THREE.BoxGeometry(0.14, 0.18, 0.02)
  blade.rotateX(0.5)
  blade.translate(0, -0.98, 0.38)
  return merge([handle, blade])
}

function limb(rTop: number, rBot: number, len: number) {
  const g = new THREE.CylinderGeometry(rTop, rBot, len, 8)
  g.translate(0, -len / 2, 0)
  return g
}

type Part =
  | 'torso' | 'head' | 'hat' | 'scarf' | 'pack' | 'crate' | 'tool'
  | 'legL' | 'legR' | 'bootL' | 'bootR' | 'armL' | 'armR' | 'mittL' | 'mittR'

export class CitizenBodies {
  group = new THREE.Group()
  private parts = {} as Record<Part, THREE.InstancedMesh>
  private root = new THREE.Matrix4()
  private local = new THREE.Matrix4()
  private out = new THREE.Matrix4()
  private zero = new THREE.Matrix4().makeScale(0, 0, 0)
  private q = new THREE.Quaternion()
  private qLean = new THREE.Quaternion()
  private v = new THREE.Vector3()
  private sc = new THREE.Vector3()
  private euler = new THREE.Euler()
  private up = new THREE.Vector3(0, 1, 0)
  private xAxis = new THREE.Vector3(1, 0, 0)

  constructor(max: number, seed: number) {
    const mat = (color: number, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness })
    const legGeo = limb(0.055, 0.048, 0.42)
    const armGeo = limb(0.05, 0.042, 0.36)
    const boot = new THREE.BoxGeometry(0.09, 0.08, 0.17).translate(0, -0.43, 0.03)
    const mitt = new THREE.SphereGeometry(0.045, 8, 6).translate(0, -0.38, 0)
    const make = (name: Part, geo: THREE.BufferGeometry, material: THREE.Material) => {
      const m = new THREE.InstancedMesh(geo, material, max)
      m.castShadow = true
      m.frustumCulled = false
      this.parts[name] = m
      this.group.add(m)
    }
    const bootMat = mat(0x1a1714, 0.7)
    const mittMat = mat(0x3a2e26)
    const armMat = mat(0xffffff)
    const legMat = mat(0xffffff)
    make('torso', torsoGeo(), mat(0xffffff))
    make('head', headGeo(), mat(0xffffff, 0.75))
    make('hat', hatGeo(), mat(0xffffff))
    make('scarf', scarfGeo(), mat(0xffffff))
    make('pack', packGeo(), mat(0x5a4632))
    make('crate', crateGeo(), mat(0x6a4a2c))
    make('tool', toolGeo(), mat(0x4a4a4e, 0.5))
    make('legL', legGeo, legMat)
    make('legR', legGeo, legMat)
    make('bootL', boot, bootMat)
    make('bootR', boot, bootMat)
    make('armL', armGeo, armMat)
    make('armR', armGeo, armMat)
    make('mittL', mitt, mittMat)
    make('mittR', mitt, mittMat)

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
    this.parts.scarf.setMatrixAt(i, this.root)
    this.parts.pack.setMatrixAt(i, p.pack ? this.root : this.zero)
    this.parts.crate.setMatrixAt(i, p.crate ? this.root : this.zero)

    // Head nods around the neck
    this.local.makeTranslation(0, NECK_Y, 0)
    this.local.multiply(this.out.makeRotationX(p.nod))
    this.local.multiply(this.out.makeTranslation(0, -NECK_Y, 0))
    this.out.multiplyMatrices(this.root, this.local)
    this.parts.head.setMatrixAt(i, this.out)
    this.parts.hat.setMatrixAt(i, this.out)

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
  }

  finish(count: number) {
    for (const m of Object.values(this.parts)) {
      m.count = count
      m.instanceMatrix.needsUpdate = true
    }
  }
}
