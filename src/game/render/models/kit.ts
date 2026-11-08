import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { textures } from './textures'

/** World units covered by one texture repeat. */
const TEX_SCALE = 1.6

export type V3 = [number, number, number]

/** What a building model exposes to the renderer beyond its static meshes. */
export interface Built {
  animated?: THREE.Object3D
  animKind?: 'piston' | 'spin' | 'turn'
  chimney?: THREE.Vector3
}

/** Builds a model into the kit; animated parts are added straight to `body`. */
export type BuildFn = (k: Kit, win: THREE.Material, body: THREE.Group) => Built

// ---------- Shared materials ----------
type MatKey =
  | 'plank' | 'darkPlank' | 'log' | 'brick' | 'stone' | 'metal' | 'iron' | 'rust' | 'brass' | 'copper'
  | 'snow' | 'ice' | 'canvas' | 'plaster' | 'shingle' | 'coal' | 'ore' | 'rope' | 'emblem' | 'cloth' | 'meat'

let mats: Record<MatKey, THREE.MeshStandardMaterial> | null = null

export function M(): Record<MatKey, THREE.MeshStandardMaterial> {
  if (mats) return mats
  const t = textures()
  const tex = (map: THREE.Texture, color: number, o: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 1.2, color, roughness: 0.88, ...o })
  mats = {
    plank: tex(t.planks, 0xd8c0a8),
    darkPlank: tex(t.planks, 0x8a7060),
    log: tex(t.planks, 0x7a5a44, { roughness: 0.95 }),
    brick: tex(t.bricks, 0xffffff),
    stone: tex(t.stone, 0xffffff),
    metal: tex(t.metal, 0xffffff, { metalness: 0.55, roughness: 0.5 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x2a2d32, metalness: 0.7, roughness: 0.45 }),
    rust: tex(t.metal, 0xb06a40, { metalness: 0.35, roughness: 0.7 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xa8823f, metalness: 0.85, roughness: 0.3 }),
    copper: new THREE.MeshStandardMaterial({ color: 0x9a5a38, metalness: 0.8, roughness: 0.35 }),
    snow: tex(t.snow, 0xffffff, { roughness: 1, bumpScale: 0.6 }),
    ice: new THREE.MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }),
    canvas: tex(t.canvas, 0xffffff, { roughness: 1 }),
    plaster: tex(t.plaster, 0xffffff),
    shingle: tex(t.shingles, 0xffffff),
    coal: tex(t.coal, 0xffffff, { roughness: 0.55, metalness: 0.15 }),
    ore: tex(t.stone, 0x9a6040, { roughness: 0.8, metalness: 0.2 }),
    rope: new THREE.MeshStandardMaterial({ color: 0x6b5a40, roughness: 1 }),
    emblem: new THREE.MeshStandardMaterial({ color: 0x1f7a6a, emissive: 0x0d5c4f, emissiveIntensity: 0.6 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x7a2a22, roughness: 1, side: THREE.DoubleSide }),
    meat: new THREE.MeshStandardMaterial({ color: 0x8a3a30, roughness: 0.7 }),
  }
  return mats
}

/** Window glass: emissive so lit windows glow at night. Cloned per building. */
export const WINDOW_BASE = new THREE.MeshStandardMaterial({
  color: 0x2a2018, emissive: 0xffa040, emissiveIntensity: 0, roughness: 0.25, metalness: 0.2,
})

/** Planar-projected UVs in world units, chosen per vertex by the dominant normal axis. */
function worldUV(g: THREE.BufferGeometry) {
  const pos = g.attributes['position'] as THREE.BufferAttribute
  const nor = g.attributes['normal'] as THREE.BufferAttribute
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i))
    let u: number, v: number
    if (ay >= ax && ay >= az) { u = x; v = z } else if (ax >= az) { u = z; v = y } else { u = x; v = y }
    uv[i * 2] = u / TEX_SCALE
    uv[i * 2 + 1] = v / TEX_SCALE
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}

const tmpM = new THREE.Matrix4()
const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()
const tmpV = new THREE.Vector3()
const tmpS = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

/**
 * Model builder: primitives are transformed and bucketed by material, then merged
 * into one mesh per material — detailed models with only a handful of draw calls.
 */
export class Kit {
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()

  /** Add a geometry with position / euler rotation / scale. */
  add(geo: THREE.BufferGeometry, mat: THREE.Material, p: V3 = [0, 0, 0], r: V3 = [0, 0, 0], s: V3 = [1, 1, 1]) {
    tmpQ.setFromEuler(tmpE.set(r[0], r[1], r[2]))
    tmpM.compose(tmpV.set(p[0], p[1], p[2]), tmpQ, tmpS.set(s[0], s[1], s[2]))
    this.addMatrix(geo, mat, tmpM)
  }

  addMatrix(geo: THREE.BufferGeometry, mat: THREE.Material, m: THREE.Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    g.deleteAttribute('uv')
    if (!g.attributes['normal']) g.computeVertexNormals()
    g.applyMatrix4(m)
    worldUV(g)
    const list = this.buckets.get(mat) ?? []
    list.push(g)
    this.buckets.set(mat, list)
  }

  /** Box resting on y (base), centred on x/z. */
  box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, r: V3 = [0, 0, 0]) {
    this.add(new THREE.BoxGeometry(w, h, d), mat, [x, y + h / 2, z], r)
  }

  /** Box centred at the point. */
  boxC(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, r: V3 = [0, 0, 0]) {
    this.add(new THREE.BoxGeometry(w, h, d), mat, [x, y, z], r)
  }

  /** Vertical cylinder resting on y. */
  cyl(rt: number, rb: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 12, r: V3 = [0, 0, 0]) {
    this.add(new THREE.CylinderGeometry(rt, rb, h, seg), mat, [x, y + h / 2, z], r)
  }

  sphere(rad: number, mat: THREE.Material, x = 0, y = 0, z = 0, s: V3 = [1, 1, 1], seg = 10) {
    this.add(new THREE.SphereGeometry(rad, seg, Math.max(6, Math.round(seg * 0.7))), mat, [x, y, z], [0, 0, 0], s)
  }

  cone(rad: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 10, r: V3 = [0, 0, 0]) {
    this.add(new THREE.ConeGeometry(rad, h, seg), mat, [x, y + h / 2, z], r)
  }

  torus(rad: number, tube: number, mat: THREE.Material, x = 0, y = 0, z = 0, r: V3 = [0, 0, 0], seg = 20) {
    this.add(new THREE.TorusGeometry(rad, tube, 6, seg), mat, [x, y, z], r)
  }

  /** Cylinder spanning two points (pipes, beams, ropes). */
  beam(a: V3, b: V3, rad: number, mat: THREE.Material, seg = 8) {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const dir = vb.clone().sub(va)
    const len = dir.length()
    if (len < 1e-4) return
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize())
    const m = new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))
    this.addMatrix(new THREE.CylinderGeometry(rad, rad, len, seg), mat, m)
  }

  /** Square beam spanning two points (lattice members, rafters). */
  bar(a: V3, b: V3, t: number, mat: THREE.Material) {
    const va = new THREE.Vector3(...a)
    const vb = new THREE.Vector3(...b)
    const dir = vb.clone().sub(va)
    const len = dir.length()
    if (len < 1e-4) return
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize())
    const m = new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1))
    this.addMatrix(new THREE.BoxGeometry(t, len, t), mat, m)
  }

  /**
   * Pitched roof with a ridge along X: gable infill, two sloped plank/shingle planes
   * with overhang, a snow layer and a ridge cap.
   */
  gableRoof(W: number, L: number, H: number, y: number, roof: THREE.Material, wall: THREE.Material | null, z = 0, ov = 0.25, x = 0) {
    const m = M()
    if (wall) {
      const g = new THREE.CylinderGeometry(1, 1, L, 3)
      g.rotateX(-Math.PI / 2)
      g.scale(W / 1.732, H / 1.5, 1)
      g.translate(0, H / 3, 0)
      g.rotateY(Math.PI / 2)
      this.add(g, wall, [x, y, z])
    }
    const half = W / 2
    const slope = H / half
    const ang = Math.atan2(H, half)
    const run = half + ov
    const len = Math.hypot(run, run * slope)
    const t = 0.1
    for (const side of [1, -1]) {
      const cz = z + side * (run / 2)
      const cy = y + H - (run * slope) / 2 + t / 2
      this.add(new THREE.BoxGeometry(L + ov * 2, t, len), roof, [x, cy, cz], [side * ang, 0, 0])
      // Snow blanket, slightly shorter so the roof edge shows
      this.add(new THREE.BoxGeometry(L + ov * 1.6, 0.09, len * 0.92), m.snow, [x, cy + 0.09 / Math.cos(ang) + 0.01, cz - side * 0.02], [side * ang, 0, 0])
      // Icicles along the eave
      for (let i = 0; i < 7; i++) {
        const ix = x - L / 2 + (L / 6) * i + (i % 2 ? 0.07 : -0.05)
        const ih = 0.12 + ((i * 37) % 5) * 0.04
        this.add(new THREE.ConeGeometry(0.03, ih, 5), m.ice, [ix, y - ov * slope - ih / 2 + 0.02, z + side * run], [Math.PI, 0, 0])
      }
    }
    this.boxC(L + ov * 2 + 0.05, 0.12, 0.16, m.snow, x, y + H + 0.1, z)
  }

  /** Framed window with cross mullion, sill and a little snow, on a wall facing `ry`. */
  window(cx: number, cy: number, cz: number, w: number, h: number, win: THREE.Material, ry = 0) {
    const m = M()
    const c = Math.cos(ry), s = Math.sin(ry)
    const at = (dx: number, dy: number, dz: number): V3 => [cx + dx * c + dz * s, cy + dy, cz - dx * s + dz * c]
    const r: V3 = [0, ry, 0]
    const f = 0.06
    this.add(new THREE.BoxGeometry(w, h, 0.04), win, at(0, 0, 0.01), r)
    this.add(new THREE.BoxGeometry(w + f * 2, f, 0.08), m.darkPlank, at(0, h / 2 + f / 2, 0.03), r)
    this.add(new THREE.BoxGeometry(w + f * 2, f, 0.08), m.darkPlank, at(0, -h / 2 - f / 2, 0.03), r)
    this.add(new THREE.BoxGeometry(f, h, 0.08), m.darkPlank, at(-w / 2 - f / 2, 0, 0.03), r)
    this.add(new THREE.BoxGeometry(f, h, 0.08), m.darkPlank, at(w / 2 + f / 2, 0, 0.03), r)
    this.add(new THREE.BoxGeometry(0.03, h, 0.06), m.darkPlank, at(0, 0, 0.04), r)
    this.add(new THREE.BoxGeometry(w, 0.03, 0.06), m.darkPlank, at(0, 0, 0.04), r)
    this.add(new THREE.BoxGeometry(w + 0.2, 0.05, 0.16), m.darkPlank, at(0, -h / 2 - f - 0.02, 0.08), r)
    this.add(new THREE.BoxGeometry(w + 0.16, 0.05, 0.13), m.snow, at(0, -h / 2 - f + 0.03, 0.08), r)
  }

  /** Plank door with frame, handle and a stone step. */
  door(cx: number, cz: number, w: number, h: number, ry = 0, y = 0) {
    const m = M()
    const c = Math.cos(ry), s = Math.sin(ry)
    const at = (dx: number, dy: number, dz: number): V3 => [cx + dx * c + dz * s, y + dy, cz - dx * s + dz * c]
    const r: V3 = [0, ry, 0]
    this.add(new THREE.BoxGeometry(w, h, 0.06), m.darkPlank, at(0, h / 2, 0.02), r)
    this.add(new THREE.BoxGeometry(w + 0.14, 0.08, 0.1), m.log, at(0, h + 0.04, 0.04), r)
    this.add(new THREE.BoxGeometry(0.07, h, 0.1), m.log, at(-w / 2 - 0.035, h / 2, 0.04), r)
    this.add(new THREE.BoxGeometry(0.07, h, 0.1), m.log, at(w / 2 + 0.035, h / 2, 0.04), r)
    for (const dy of [h * 0.25, h * 0.75]) this.add(new THREE.BoxGeometry(w * 0.9, 0.04, 0.03), m.iron, at(0, dy, 0.06), r)
    this.add(new THREE.SphereGeometry(0.035, 6, 5), m.brass, at(w * 0.32, h * 0.5, 0.08), r)
    this.add(new THREE.BoxGeometry(w + 0.3, 0.1, 0.35), m.stone, at(0, 0.05, 0.2), r)
  }

  /** Brick chimney stack with cap; returns the smoke outlet. */
  chimney(x: number, y: number, z: number, h: number, w = 0.42): THREE.Vector3 {
    const m = M()
    this.box(w, h, w, m.brick, x, y, z)
    this.box(w + 0.1, 0.08, w + 0.1, m.stone, x, y + h, z)
    this.box(w * 0.5, 0.12, w * 0.5, m.iron, x, y + h + 0.08, z)
    this.box(w + 0.06, 0.06, w + 0.06, m.snow, x, y + h + 0.08, z)
    return new THREE.Vector3(x, y + h + 0.25, z)
  }

  /** Iron stovepipe with a conical rain cap; returns the smoke outlet. */
  stovepipe(x: number, y: number, z: number, h: number, r = 0.11): THREE.Vector3 {
    const m = M()
    this.cyl(r, r, h, m.iron, x, y, z, 10)
    this.torus(r + 0.01, 0.015, m.iron, x, y + h * 0.5, z, [Math.PI / 2, 0, 0], 12)
    this.cone(r * 2.2, 0.16, m.iron, x, y + h + 0.1, z, 10)
    return new THREE.Vector3(x, y + h + 0.1, z)
  }

  /** Lantern on a bracket: glowing bulb in an iron cage. */
  lantern(x: number, y: number, z: number, win: THREE.Material) {
    const m = M()
    this.sphere(0.09, win, x, y, z, [1, 1.2, 1], 8)
    this.box(0.2, 0.03, 0.2, m.iron, x, y + 0.11, z)
    this.cone(0.14, 0.1, m.iron, x, y + 0.13, z, 6)
    this.box(0.2, 0.03, 0.2, m.iron, x, y - 0.13, z)
  }

  /** Lamp post with lantern. */
  lampPost(x: number, z: number, win: THREE.Material, h = 1.8) {
    const m = M()
    this.cyl(0.04, 0.05, h, m.iron, x, 0, z, 6)
    this.box(0.4, 0.04, 0.04, m.iron, x + 0.15, h - 0.05, z)
    this.lantern(x + 0.32, h - 0.25, z, win)
    this.cyl(0.12, 0.14, 0.12, m.stone, x, 0, z, 8)
  }

  crate(x: number, y: number, z: number, s = 0.5, ry = 0) {
    const m = M()
    this.add(new THREE.BoxGeometry(s, s, s), m.plank, [x, y + s / 2, z], [0, ry, 0])
    for (const dy of [0.08, s - 0.08]) {
      this.add(new THREE.BoxGeometry(s + 0.02, 0.05, s + 0.02), m.darkPlank, [x, y + dy, z], [0, ry, 0])
    }
    this.add(new THREE.BoxGeometry(s * 0.9, 0.04, s * 0.9), m.snow, [x, y + s + 0.02, z], [0, ry, 0])
  }

  barrel(x: number, y: number, z: number, r = 0.22, h = 0.55) {
    const m = M()
    this.add(new THREE.CylinderGeometry(r * 0.9, r * 0.9, h, 12), m.darkPlank, [x, y + h / 2, z])
    this.add(new THREE.SphereGeometry(r, 12, 8), m.darkPlank, [x, y + h / 2, z], [0, 0, 0], [1, h / (r * 2.2), 1])
    for (const dy of [0.1, h / 2, h - 0.1]) this.torus(r * (dy === h / 2 ? 1.0 : 0.93), 0.015, m.iron, x, y + dy, z, [Math.PI / 2, 0, 0], 14)
    this.add(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.04, 12), m.snow, [x, y + h + 0.01, z])
  }

  /** Low snow drift along a wall. */
  drift(x: number, z: number, w: number, d: number, ry = 0) {
    this.add(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M().snow, [x, 0, z], [0, ry, 0], [w / 2, 0.22, d / 2])
  }

  /** Small stack of firewood. */
  woodpile(x: number, z: number, ry = 0, n = 3) {
    const m = M()
    const c = Math.cos(ry), s = Math.sin(ry)
    for (let row = 0; row < n; row++) {
      for (let i = 0; i < n - row; i++) {
        const dx = -((n - row - 1) * 0.11) + i * 0.22
        this.add(new THREE.CylinderGeometry(0.1, 0.1, 0.9, 7), m.log, [x + dx * c, 0.1 + row * 0.18, z - dx * s], [Math.PI / 2, ry, 0])
      }
    }
    this.add(new THREE.BoxGeometry(n * 0.22, 0.05, 0.85), m.snow, [x, 0.1 + n * 0.18 - 0.05, z], [0, ry, 0])
  }

  /** Merge every bucket into a single mesh per material. */
  build(shadows = true): THREE.Group {
    const g = new THREE.Group()
    for (const [mat, geos] of this.buckets) {
      const merged = mergeGeometries(geos, false)
      geos.forEach((x) => x.dispose())
      if (!merged) continue
      const mesh = new THREE.Mesh(merged, mat)
      mesh.castShadow = shadows
      mesh.receiveShadow = true
      g.add(mesh)
    }
    this.buckets.clear()
    return g
  }
}
