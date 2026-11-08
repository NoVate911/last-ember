import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BUILDINGS, HEAT_LEVELS, isStorm } from '../data'
import type { Game } from '../engine'
import { GEN_RADIUS, RING_COUNT, RING_WIDTH, SPOKE_ANGLES, cellIdAt, isGeneratorAt } from '../grid'
import { heatAt } from '../simulation'
import type { BuildingType, Cell } from '../types'
import { SmokeSystem, SnowSystem, createForest, createTerrain } from './effects'
import { type BuildingVisual, createBuildingMesh, createDepositMark, createGenerator, createPileMesh, createScaffold } from './meshes'
import { Walkers } from './walkers'

function smooth(a: number, b: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function facing(x: number, z: number) {
  return Math.atan2(-x, -z)
}

function cellShape(c: Cell, pad: number) {
  const g = new THREE.RingGeometry(c.inner + pad, c.outer - pad, 6, 1, c.thetaStart + pad / c.outer, c.thetaLength - (2 * pad) / c.outer)
  g.rotateX(Math.PI / 2)
  return g
}

interface BuildingEntry { vis: BuildingVisual; scaffold: THREE.Group; type: BuildingType }

export class WorldRenderer {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private hemi: THREE.HemisphereLight
  private sun: THREE.DirectionalLight
  private genLight: THREE.PointLight
  private generator = createGenerator()
  private buildings = new Map<number, BuildingEntry>()
  private piles = new Map<number, THREE.Group>()
  private deposits = new Map<string, THREE.Group>()
  private depositVersion = -1
  private overlay = new Map<string, THREE.Mesh>()
  private overlayGroup = new THREE.Group()
  private overlayVersion = -1
  private hoverMesh: THREE.Mesh
  private selectMesh: THREE.Mesh
  private ghost: THREE.Group | null = null
  private ghostType: BuildingType | null = null
  private ghostMat = new THREE.MeshBasicMaterial({ color: 0x5fd38a, transparent: true, opacity: 0.45, depthWrite: false })
  private snow = new SnowSystem()
  private smoke = new SmokeSystem()
  private walkers = new Walkers()
  private raf = 0
  private last = performance.now()
  private keys = new Set<string>()
  private down: { x: number; y: number; button: number } | null = null
  private ro: ResizeObserver
  private raycaster = new THREE.Raycaster()
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
  private skyDay = new THREE.Color(0xa9bccd)
  private skyNight = new THREE.Color(0x0a1220)
  private skyStorm = new THREE.Color(0x4a5562)
  private tmpColor = new THREE.Color()
  private container: HTMLElement
  private game: Game

  constructor(container: HTMLElement, game: Game) {
    this.container = container
    this.game = game
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    container.appendChild(this.renderer.domElement)
    this.renderer.domElement.style.display = 'block'

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 600)
    this.camera.position.set(0, 58, 72)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.maxPolarAngle = 1.22
    this.controls.minDistance = 16
    this.controls.maxDistance = 150
    this.controls.screenSpacePanning = false
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }

    this.scene.fog = new THREE.FogExp2(0xa9bccd, 0.006)
    this.hemi = new THREE.HemisphereLight(0xcfe0ff, 0x4a5260, 1.2)
    this.sun = new THREE.DirectionalLight(0xfff1e0, 1.6)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(2048, 2048)
    const sc = this.sun.shadow.camera
    sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.far = 300
    this.sun.shadow.bias = -0.0005
    this.genLight = new THREE.PointLight(0xff8a3a, 0, 120, 1.4)
    this.genLight.position.set(0, 9, 0)
    this.scene.add(this.hemi, this.sun, this.sun.target, this.genLight)

    this.scene.add(createTerrain(), createForest(), this.generator.group)
    this.scene.add(this.buildRoads())
    this.scene.add(this.overlayGroup, this.snow.points, this.smoke.group, this.walkers.mesh)

    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
    this.hoverMesh = new THREE.Mesh(new THREE.BufferGeometry(), hlMat)
    this.hoverMesh.position.y = 0.06
    this.selectMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }))
    this.selectMesh.position.y = 0.07
    this.scene.add(this.hoverMesh, this.selectMesh)

    for (const c of game.state.cells.values()) {
      const m = new THREE.Mesh(cellShape(c, 0.12), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false }))
      m.position.y = 0.04
      this.overlay.set(c.id, m)
      this.overlayGroup.add(m)
    }

    const el = this.renderer.domElement
    el.addEventListener('pointerdown', this.onDown)
    el.addEventListener('pointerup', this.onUp)
    el.addEventListener('pointermove', this.onMove)
    el.addEventListener('contextmenu', this.onContext)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.resize()
    this.loop()
  }

  private buildRoads(): THREE.Group {
    const g = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: 0xb4bfcb, roughness: 1 })
    for (let r = 0; r <= RING_COUNT; r++) {
      const rad = GEN_RADIUS + r * RING_WIDTH
      const geo = new THREE.RingGeometry(rad - 0.3, rad + 0.3, 96)
      geo.rotateX(-Math.PI / 2)
      const m = new THREE.Mesh(geo, mat)
      m.position.y = 0.02
      m.receiveShadow = true
      g.add(m)
    }
    for (let i = 0; i < SPOKE_ANGLES.length; i++) {
      const a = SPOKE_ANGLES[i]!
      const len = RING_COUNT * RING_WIDTH
      const geo = new THREE.PlaneGeometry(0.7, len)
      geo.rotateX(-Math.PI / 2)
      const m = new THREE.Mesh(geo, mat)
      const mid = GEN_RADIUS + len / 2
      m.position.set(Math.cos(a) * mid, 0.025, Math.sin(a) * mid)
      m.rotation.y = -a + Math.PI / 2
      m.receiveShadow = true
      g.add(m)
    }
    // Trodden snow on avenue cells, where people walk and gather
    const plazaMat = new THREE.MeshStandardMaterial({ color: 0xc3ccd6, roughness: 1, side: THREE.DoubleSide })
    for (const c of this.game.state.cells.values()) {
      if (!c.road) continue
      const m = new THREE.Mesh(cellShape(c, 0.2), plazaMat)
      m.position.y = 0.012
      m.receiveShadow = true
      g.add(m)
    }
    return g
  }

  private resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  private groundPoint(e: PointerEvent): THREE.Vector3 | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const p = new THREE.Vector3()
    return this.raycaster.ray.intersectPlane(this.ground, p) ? p : null
  }

  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY, button: e.button } }
  private onContext = (e: Event) => e.preventDefault()

  private onMove = (e: PointerEvent) => {
    const p = this.groundPoint(e)
    const id = p ? cellIdAt(p.x, p.z) : null
    if (id !== this.game.ui.hoverCellId) this.game.setUi({ hoverCellId: id })
  }

  private onUp = (e: PointerEvent) => {
    const d = this.down
    this.down = null
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return
    const ui = this.game.ui
    if (d.button === 2) {
      if (ui.placing) this.game.setUi({ placing: null })
      return
    }
    if (d.button !== 0) return
    const p = this.groundPoint(e)
    if (!p) return
    const cellId = cellIdAt(p.x, p.z)
    if (ui.placing) {
      const ok = cellId ? this.game.place(ui.placing, cellId) : false
      // Shift keeps the tool active for building several in a row
      if (ok && (!e.shiftKey || !this.game.canAfford(ui.placing))) this.game.setUi({ placing: null })
      return
    }
    if (isGeneratorAt(p.x, p.z)) { this.game.setUi({ selected: { kind: 'generator' }, buildOpen: false }); return }
    const occ = cellId ? this.game.state.cells.get(cellId)?.occupant : null
    this.game.setUi(occ ? { selected: { kind: occ.kind, id: occ.id }, buildOpen: false } : { selected: null })
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    // Dialogs handle their own keys (Esc closes them)
    if (this.game.ui.dialog || this.game.state.pendingEvent) { this.keys.clear(); return }
    this.keys.add(e.key.toLowerCase())
    if (e.key === 'Escape') this.game.setUi({ placing: null, selected: null, buildOpen: false })
  }
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()) }
  /** Keys released while the window was unfocused never fire keyup: forget them. */
  private onBlur = () => { this.keys.clear() }

  private panWithKeys(dt: number) {
    const fwd = new THREE.Vector3()
    this.camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0))
    const move = new THREE.Vector3()
    if (this.keys.has('w') || this.keys.has('arrowup')) move.add(fwd)
    if (this.keys.has('s') || this.keys.has('arrowdown')) move.sub(fwd)
    if (this.keys.has('d') || this.keys.has('arrowright')) move.add(right)
    if (this.keys.has('a') || this.keys.has('arrowleft')) move.sub(right)
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(dt * 35)
      this.camera.position.add(move)
      this.controls.target.add(move)
    }
    const t = this.controls.target
    const r = Math.hypot(t.x, t.z)
    if (r > 55) {
      const k = 55 / r
      const dx = t.x * k - t.x
      const dz = t.z * k - t.z
      t.x += dx; t.z += dz
      this.camera.position.x += dx; this.camera.position.z += dz
    }
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.1)
    this.last = now
    this.game.update(dt)
    this.panWithKeys(dt)
    this.controls.update()
    this.sync(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private sync(dt: number) {
    const s = this.game.state
    const hour = s.time % 24
    const daylight = smooth(5.5, 8, hour) * (1 - smooth(17.5, 20, hour))
    const storm = isStorm(s.time) ? 1 : 0
    const simSpeed = this.game.paused ? 0 : s.speed

    // Sky & lighting
    this.tmpColor.copy(this.skyNight).lerp(this.skyDay, daylight)
    if (storm) this.tmpColor.lerp(this.skyStorm, 0.55)
    this.scene.background = this.tmpColor.clone()
    const fog = this.scene.fog as THREE.FogExp2
    fog.color.copy(this.tmpColor)
    fog.density = storm ? 0.016 : 0.0055
    this.hemi.intensity = 0.25 + daylight * 1.0
    this.sun.intensity = 0.15 + daylight * 1.5 * (storm ? 0.4 : 1)
    this.sun.color.setHex(daylight > 0.3 ? 0xfff1e0 : 0x8fa8ff)
    const sunAng = ((hour - 6) / 12) * Math.PI
    this.sun.position.set(Math.cos(sunAng) * 80, 40 + Math.max(0, Math.sin(sunAng)) * 60, 40)

    // Generator
    const g = s.generator
    const flicker = 0.9 + Math.sin(now() * 0.012) * 0.06 + Math.random() * 0.05
    const genPower = g.on ? g.level + (g.overdrive ? 1.5 : 0) : 0
    this.generator.glowMat.emissiveIntensity = g.on ? (1.2 + genPower * 0.6) * flicker : 0.08
    this.genLight.intensity = g.on ? (120 + genPower * 90) * flicker : 0
    this.generator.fan.rotation.y += dt * (g.on ? 1 + genPower : 0) * (simSpeed > 0 ? 1 : 0.2)
    if (g.overdrive) this.generator.glowMat.emissive.setHex(g.stress > 70 ? 0xff3010 : 0xff5a10)
    else this.generator.glowMat.emissive.setHex(0xff7a1a)

    const emitters: { key: string; pos: THREE.Vector3; rate: number; scale: number }[] = []
    if (g.on) emitters.push({ key: 'gen', pos: new THREE.Vector3(0, 13.8, 0), rate: 4 + genPower * 2, scale: 3 })

    // Buildings
    const seen = new Set<number>()
    const night = 1 - daylight
    for (const b of s.buildings) {
      seen.add(b.id)
      let entry = this.buildings.get(b.id)
      if (!entry) {
        const vis = createBuildingMesh(b.type)
        const scaffold = createScaffold()
        vis.group.add(scaffold)
        vis.group.position.set(b.x, 0, b.z)
        vis.group.rotation.y = facing(b.x, b.z)
        this.scene.add(vis.group)
        entry = { vis, scaffold, type: b.type }
        this.buildings.set(b.id, entry)
      }
      const { vis, scaffold } = entry
      const def = BUILDINGS[b.type]
      scaffold.visible = !b.built
      vis.body.scale.y = b.built ? 1 : 0.1 + 0.9 * Math.min(1, b.progress / def.buildHours)
      const active = b.built && b.active
      const warm = b.heat >= 3 ? 1 : 0.5
      vis.windowMat.emissiveIntensity = active ? (b.type === 'relay' ? 2 : (0.25 + night * 2.2) * warm) : 0
      if (vis.animated && active && simSpeed > 0) {
        if (vis.animKind === 'spin') vis.animated.rotation.z += dt * 6
        if (vis.animKind === 'piston') vis.animated.position.y = ((vis.animated.userData['baseY'] as number | undefined) ?? 0) + Math.abs(Math.sin(now() * 0.006)) * 1.2
      }
      if (vis.chimney && active) {
        vis.group.updateMatrixWorld()
        emitters.push({ key: `b${b.id}`, pos: vis.group.localToWorld(vis.chimney.clone()), rate: 1.1, scale: 0.9 })
      }
    }
    for (const [id, entry] of this.buildings) {
      if (!seen.has(id)) { this.scene.remove(entry.vis.group); this.buildings.delete(id) }
    }

    // Piles
    const seenP = new Set<number>()
    for (const p of s.piles) {
      seenP.add(p.id)
      let m = this.piles.get(p.id)
      if (!m) {
        m = createPileMesh(p.kind, p.id)
        m.position.set(p.x, 0, p.z)
        m.rotation.y = p.id * 1.3
        this.scene.add(m)
        this.piles.set(p.id, m)
      }
      m.scale.setScalar(0.35 + 0.65 * (p.amount / p.max))
    }
    for (const [id, m] of this.piles) {
      if (!seenP.has(id)) { this.scene.remove(m); this.piles.delete(id) }
    }

    this.syncDeposits()
    this.syncOverlay()
    this.syncHighlights()
    this.snow.update(dt, storm ? 1 : 0.15, this.controls.target)
    this.smoke.update(dt, emitters, storm ? 8 : 1.5)
    this.walkers.update(dt, s, hour, simSpeed)
  }

  /** Ground marks on free deposit cells, so the player sees where mines can go. */
  private syncDeposits() {
    if (this.depositVersion === this.game.version) return
    this.depositVersion = this.game.version
    for (const c of this.game.state.cells.values()) {
      const show = c.deposit !== null && c.occupant === null
      let m = this.deposits.get(c.id)
      if (show && !m && c.deposit) {
        m = createDepositMark(c.deposit)
        m.position.set(c.x, 0, c.z)
        this.scene.add(m)
        this.deposits.set(c.id, m)
      }
      if (m) m.visible = show
    }
  }

  private syncOverlay() {
    const ui = this.game.ui
    const show = ui.heatOverlay || ui.placing !== null
    this.overlayGroup.visible = show
    if (!show || this.overlayVersion === this.game.version) return
    this.overlayVersion = this.game.version
    const s = this.game.state
    const deposit = ui.placing ? BUILDINGS[ui.placing].onDeposit : undefined
    for (const c of s.cells.values()) {
      const m = this.overlay.get(c.id)
      if (!m) continue
      const mat = m.material as THREE.MeshBasicMaterial
      if (c.road) {
        mat.opacity = 0
        continue
      }
      if (deposit) {
        // Mines: highlight matching deposits only
        const ok = c.deposit === deposit && c.occupant?.kind !== 'building'
        mat.color.setHex(ok ? 0x5fd38a : 0x111111)
        mat.opacity = ok ? 0.55 : 0.25
        continue
      }
      if (ui.placing && c.occupant) {
        mat.color.setHex(0x111111)
        mat.opacity = 0.25
        continue
      }
      const kind = ui.placing ? (BUILDINGS[ui.placing].capacity ? 'home' : 'work') : 'other'
      const ins = ui.placing ? BUILDINGS[ui.placing].insulation : 0
      const lvl = heatAt(s, c.x, c.z, c.ring, ins, kind)
      mat.color.set(HEAT_LEVELS[lvl]?.color ?? '#ffffff')
      mat.opacity = 0.42
    }
  }

  private lastHover: string | null = null
  private lastSelect = ''

  private syncHighlights() {
    const s = this.game.state
    const ui = this.game.ui
    // Hover
    if (ui.hoverCellId !== this.lastHover) {
      this.lastHover = ui.hoverCellId
      this.hoverMesh.geometry.dispose()
      const c = ui.hoverCellId ? s.cells.get(ui.hoverCellId) : null
      this.hoverMesh.geometry = c ? cellShape(c, 0.05) : new THREE.BufferGeometry()
    }
    // Selection
    const sel = ui.selected
    let selCell: Cell | undefined
    if (sel?.kind === 'building') selCell = s.cells.get(s.buildings.find((b) => b.id === sel.id)?.cellId ?? '')
    if (sel?.kind === 'pile') selCell = s.cells.get(s.piles.find((p) => p.id === sel.id)?.cellId ?? '')
    const key = sel?.kind === 'generator' ? 'gen' : selCell?.id ?? ''
    if (key !== this.lastSelect) {
      this.lastSelect = key
      this.selectMesh.geometry.dispose()
      if (key === 'gen') {
        const g = new THREE.RingGeometry(GEN_RADIUS - 0.6, GEN_RADIUS, 48)
        g.rotateX(-Math.PI / 2)
        this.selectMesh.geometry = g
      } else {
        this.selectMesh.geometry = selCell ? cellShape(selCell, 0.05) : new THREE.BufferGeometry()
      }
    }
    // Ghost preview
    if (ui.placing !== this.ghostType) {
      if (this.ghost) this.scene.remove(this.ghost)
      this.ghost = null
      this.ghostType = ui.placing
      if (ui.placing) {
        const vis = createBuildingMesh(ui.placing)
        vis.group.traverse((o) => {
          if (o instanceof THREE.Mesh) { o.material = this.ghostMat; o.castShadow = false }
        })
        this.ghost = vis.group
        this.scene.add(this.ghost)
      }
    }
    if (this.ghost && ui.placing) {
      const c = ui.hoverCellId ? s.cells.get(ui.hoverCellId) : null
      this.ghost.visible = !!c
      if (c) {
        this.ghost.position.set(c.x, 0, c.z)
        this.ghost.rotation.y = facing(c.x, c.z)
        this.ghostMat.color.setHex(this.game.canPlace(ui.placing, c.id).ok ? 0x5fd38a : 0xe05050)
      }
    }
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.onDown)
    el.removeEventListener('pointerup', this.onUp)
    el.removeEventListener('pointermove', this.onMove)
    el.removeEventListener('contextmenu', this.onContext)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.ro.disconnect()
    this.controls.dispose()
    this.renderer.dispose()
    el.remove()
  }
}

function now() {
  return performance.now()
}
