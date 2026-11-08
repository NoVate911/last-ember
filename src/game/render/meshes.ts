import * as THREE from 'three'
import type { BuildingType } from '../types'
import { aid, arena, cemetery, hospital, relay } from './models/civic'
import { beacon, school } from './models/expedition'
import { coalMine, coalStorage, depot, drill, oreMine, sawmill, steelworks, warehouse, workshop } from './models/industry'
import { bunkhouse, canteen, house, lodge, pub, tent } from './models/housing'
import { type BuildFn, Kit, WINDOW_BASE } from './models/kit'

export { createGenerator, type GeneratorVisual } from './models/generator'
export { createDepositMark, createPileMesh, createScaffold } from './models/props'
export { WINDOW_BASE } from './models/kit'

export interface BuildingVisual {
  group: THREE.Group
  windowMat: THREE.MeshStandardMaterial
  body: THREE.Group
  animated: THREE.Object3D | null
  animKind: 'piston' | 'spin' | 'turn' | null
  chimney: THREE.Vector3 | null
}

const BUILDERS: Record<BuildingType, BuildFn> = {
  tent, bunkhouse, house, lodge, canteen, pub,
  depot, drill, coalMine, oreMine, sawmill, steelworks, warehouse, coalStorage, workshop,
  aid, hospital, relay, cemetery, arena, beacon, school,
}

export function createBuildingMesh(type: BuildingType): BuildingVisual {
  const group = new THREE.Group()
  const body = new THREE.Group()
  group.add(body)
  const win = WINDOW_BASE.clone()
  const k = new Kit()
  const built = BUILDERS[type](k, win, body)
  body.add(k.build())
  return {
    group,
    windowMat: win,
    body,
    animated: built.animated ?? null,
    animKind: built.animKind ?? null,
    chimney: built.chimney ?? null,
  }
}
