import type { Cell } from './types'

export const GEN_RADIUS = 6
export const RING_WIDTH = 4.6
export const RING_COUNT = 9
export const CRATER_RADIUS = GEN_RADIUS + RING_COUNT * RING_WIDTH + 3

/** Angles of the radial avenues that connect the ring streets */
export const SPOKE_ANGLES = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2 + Math.PI / 8)

/** Radius of the ring street that runs along the inner edge of ring k+1 (k = 0 is next to the generator) */
export function streetRadius(k: number): number {
  return GEN_RADIUS + k * RING_WIDTH + (k === 0 ? 0.3 : 0)
}

function angleInSpan(a: number, start: number, len: number): boolean {
  const TAU = Math.PI * 2
  const d = (((a - start) % TAU) + TAU) % TAU
  return d < len
}

export function ringInner(ring: number): number {
  return GEN_RADIUS + (ring - 1) * RING_WIDTH
}

export function sectorsForRing(ring: number): number {
  const center = ringInner(ring) + RING_WIDTH / 2
  return Math.max(8, Math.round((2 * Math.PI * center) / 4.8))
}

export function buildCells(): Map<string, Cell> {
  const cells = new Map<string, Cell>()
  for (let ring = 1; ring <= RING_COUNT; ring++) {
    const sectors = sectorsForRing(ring)
    const inner = ringInner(ring)
    const outer = inner + RING_WIDTH
    const thetaLength = (Math.PI * 2) / sectors
    // Offset alternate rings so the layout looks like a radial city plan
    const offset = ring % 2 === 0 ? thetaLength / 2 : 0
    for (let sector = 0; sector < sectors; sector++) {
      const thetaStart = offset + sector * thetaLength
      const angle = thetaStart + thetaLength / 2
      const r = inner + RING_WIDTH / 2
      const id = `${ring}:${sector}`
      cells.set(id, {
        id,
        ring,
        sector,
        sectors,
        angle,
        x: Math.cos(angle) * r,
        z: Math.sin(angle) * r,
        inner,
        outer,
        thetaStart,
        thetaLength,
        occupant: null,
        deposit: null,
        road: SPOKE_ANGLES.some((sa) => angleInSpan(sa, thetaStart, thetaLength)),
      })
    }
  }
  return cells
}

/** Map a world-space point on the ground to a grid cell id. */
export function cellIdAt(x: number, z: number): string | null {
  const r = Math.hypot(x, z)
  if (r < GEN_RADIUS) return null
  const ring = Math.floor((r - GEN_RADIUS) / RING_WIDTH) + 1
  if (ring < 1 || ring > RING_COUNT) return null
  const sectors = sectorsForRing(ring)
  const thetaLength = (Math.PI * 2) / sectors
  const offset = ring % 2 === 0 ? thetaLength / 2 : 0
  let angle = Math.atan2(z, x) - offset
  while (angle < 0) angle += Math.PI * 2
  angle %= Math.PI * 2
  const sector = Math.floor(angle / thetaLength) % sectors
  return `${ring}:${sector}`
}

export function isGeneratorAt(x: number, z: number): boolean {
  return Math.hypot(x, z) < GEN_RADIUS
}

/** Seeded RNG so every new game has the same map layout */
export function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
