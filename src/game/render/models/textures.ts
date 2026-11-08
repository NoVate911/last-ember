import * as THREE from 'three'

/**
 * Procedural canvas textures (no external assets — the app CSP blocks remote models).
 * Every texture tiles; UVs are generated in world units by the Kit (see kit.ts).
 */

type Draw = (ctx: CanvasRenderingContext2D, size: number, rnd: () => number) => void

function seeded(seed: number) {
  let s = seed
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
}

function make(draw: Draw, seed: number, size = 256): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  draw(ctx, size, seeded(seed))
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

function speckle(ctx: CanvasRenderingContext2D, size: number, rnd: () => number, n: number, alpha: number, light = false) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0
    ctx.fillStyle = `rgba(${v},${v},${v},${rnd() * alpha})`
    ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 2)
  }
}

const shade = (base: [number, number, number], k: number) => `rgb(${Math.round(base[0] * k)},${Math.round(base[1] * k)},${Math.round(base[2] * k)})`

/** Horizontal boards with grain, gaps and nails. */
const planks: Draw = (ctx, size, rnd) => {
  const rows = 8
  const h = size / rows
  for (let r = 0; r < rows; r++) {
    const k = 0.8 + rnd() * 0.35
    ctx.fillStyle = shade([150, 112, 78], k)
    ctx.fillRect(0, r * h, size, h)
    for (let g = 0; g < 7; g++) {
      ctx.strokeStyle = `rgba(60,35,20,${0.15 + rnd() * 0.25})`
      ctx.lineWidth = 1
      ctx.beginPath()
      const y0 = r * h + 3 + rnd() * (h - 6)
      ctx.moveTo(0, y0)
      for (let x = 0; x <= size; x += 16) ctx.lineTo(x, y0 + Math.sin(x * 0.05 + g + r) * 1.5)
      ctx.stroke()
    }
    const joint = rnd() * size
    ctx.fillStyle = 'rgba(30,18,10,0.7)'
    ctx.fillRect(joint, r * h, 2, h)
    ctx.fillRect(0, r * h, size, 2)
    ctx.fillStyle = 'rgba(40,40,45,0.9)'
    ctx.fillRect(joint - 5, r * h + h / 2 - 1, 3, 3)
    ctx.fillRect(joint + 4, r * h + h / 2 - 1, 3, 3)
  }
  speckle(ctx, size, rnd, 900, 0.25)
}

/** Running-bond brick with mortar. */
const bricks: Draw = (ctx, size, rnd) => {
  ctx.fillStyle = '#8c8379'
  ctx.fillRect(0, 0, size, size)
  const bh = size / 16
  const bw = size / 4
  for (let r = 0; r < 16; r++) {
    const off = r % 2 ? bw / 2 : 0
    for (let c = -1; c < 5; c++) {
      const k = 0.75 + rnd() * 0.35
      ctx.fillStyle = shade([150, 72, 52], k)
      ctx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 3)
      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.fillRect(c * bw + off + 2, r * bh + bh - 4, bw - 4, 2)
    }
  }
  speckle(ctx, size, rnd, 1500, 0.3)
}

/** Irregular ashlar stone blocks. */
const stone: Draw = (ctx, size, rnd) => {
  ctx.fillStyle = '#5d5f63'
  ctx.fillRect(0, 0, size, size)
  const rows = 6
  const h = size / rows
  for (let r = 0; r < rows; r++) {
    let x = -rnd() * 40
    while (x < size) {
      const w = 36 + rnd() * 50
      const k = 0.8 + rnd() * 0.35
      ctx.fillStyle = shade([128, 130, 134], k)
      ctx.fillRect(x + 2, r * h + 2, w - 4, h - 4)
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.fillRect(x + 2, r * h + 2, w - 4, 3)
      ctx.fillStyle = 'rgba(0,0,0,0.2)'
      ctx.fillRect(x + 2, r * h + h - 5, w - 4, 3)
      x += w
    }
  }
  speckle(ctx, size, rnd, 2500, 0.35)
  speckle(ctx, size, rnd, 800, 0.15, true)
}

/** Riveted iron panels with rust streaks. */
const metal: Draw = (ctx, size, rnd) => {
  const g = ctx.createLinearGradient(0, 0, size, size)
  g.addColorStop(0, '#5b626b')
  g.addColorStop(1, '#474d55')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const p = size / 2
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = `rgba(255,255,255,${rnd() * 0.06})`
      ctx.fillRect(i * p + 3, j * p + 3, p - 6, p - 6)
    }
  }
  ctx.fillStyle = 'rgba(15,17,20,0.85)'
  ctx.fillRect(0, p - 1, size, 3)
  ctx.fillRect(p - 1, 0, 3, size)
  ctx.fillRect(0, 0, size, 2)
  ctx.fillRect(0, 0, 2, size)
  for (let t = 8; t < size; t += 16) {
    for (const line of [6, p - 7, p + 7, size - 6]) {
      ctx.fillStyle = 'rgba(20,20,22,0.9)'
      ctx.beginPath(); ctx.arc(t, line, 2.6, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(line, t, 2.6, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = 'rgba(200,200,205,0.35)'
      ctx.fillRect(t - 1, line - 2, 1.5, 1.5)
    }
  }
  for (let i = 0; i < 14; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const grd = ctx.createLinearGradient(x, y, x, y + 40 + rnd() * 60)
    grd.addColorStop(0, 'rgba(130,60,25,0.5)')
    grd.addColorStop(1, 'rgba(130,60,25,0)')
    ctx.fillStyle = grd
    ctx.fillRect(x, y, 2 + rnd() * 4, 100)
  }
  speckle(ctx, size, rnd, 1500, 0.25)
}

/** Overlapping roof shingles. */
const shingles: Draw = (ctx, size, rnd) => {
  ctx.fillStyle = '#2b2d33'
  ctx.fillRect(0, 0, size, size)
  const rows = 10
  const h = size / rows
  const w = size / 8
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? w / 2 : 0
    for (let c = -1; c < 9; c++) {
      const k = 0.8 + rnd() * 0.4
      ctx.fillStyle = shade([70, 74, 84], k)
      ctx.beginPath()
      ctx.moveTo(c * w + off + 1, r * h)
      ctx.lineTo(c * w + off + w - 1, r * h)
      ctx.lineTo(c * w + off + w - 1, r * h + h - 3)
      ctx.quadraticCurveTo(c * w + off + w / 2, r * h + h + 3, c * w + off + 1, r * h + h - 3)
      ctx.fill()
    }
  }
  speckle(ctx, size, rnd, 1000, 0.3)
}

/** Packed snow with faint blue shadows and sparkles. */
const snow: Draw = (ctx, size, rnd) => {
  ctx.fillStyle = '#eef3f8'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 60; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 10 + rnd() * 40
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, 'rgba(170,190,215,0.18)')
    g.addColorStop(1, 'rgba(170,190,215,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  speckle(ctx, size, rnd, 400, 0.6, true)
}

/** Woven canvas / tarpaulin. */
const canvasCloth: Draw = (ctx, size, rnd) => {
  ctx.fillStyle = '#a89878'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < size; i += 3) {
    ctx.fillStyle = `rgba(80,65,45,${0.06 + rnd() * 0.06})`
    ctx.fillRect(i, 0, 1, size)
    ctx.fillRect(0, i, size, 1)
  }
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(60,48,35,${0.08 + rnd() * 0.1})`
    ctx.fillRect(rnd() * size, rnd() * size, 30 + rnd() * 60, 20 + rnd() * 50)
  }
  speckle(ctx, size, rnd, 800, 0.2)
}

/** Weathered lime plaster. */
const plaster: Draw = (ctx, size, rnd) => {
  ctx.fillStyle = '#bdb6a8'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 40; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 8 + rnd() * 30
    ctx.fillStyle = `rgba(${rnd() < 0.5 ? '120,110,95' : '230,225,215'},${0.06 + rnd() * 0.1})`
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  ctx.strokeStyle = 'rgba(80,70,60,0.35)'
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    let x = rnd() * size
    let y = rnd() * size
    ctx.moveTo(x, y)
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 30; y += rnd() * 20; ctx.lineTo(x, y) }
    ctx.stroke()
  }
  speckle(ctx, size, rnd, 1500, 0.2)
}

/** Lumpy coal surface. */
const coal: Draw = (ctx, size, rnd) => {
  ctx.fillStyle = '#141518'
  ctx.fillRect(0, 0, size, size)
  for (let i = 0; i < 400; i++) {
    const x = rnd() * size
    const y = rnd() * size
    const r = 3 + rnd() * 9
    ctx.fillStyle = shade([40, 42, 48], 0.6 + rnd() * 0.9)
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = 'rgba(160,170,190,0.25)'
    ctx.fillRect(x - r / 3, y - r / 2, r / 2, 1.5)
  }
}

let cache: Record<string, THREE.CanvasTexture> | null = null

export function textures() {
  if (!cache) {
    cache = {
      planks: make(planks, 11),
      bricks: make(bricks, 12),
      stone: make(stone, 13),
      metal: make(metal, 14),
      shingles: make(shingles, 15),
      snow: make(snow, 16),
      canvas: make(canvasCloth, 17),
      plaster: make(plaster, 18),
      coal: make(coal, 19),
    }
  }
  return cache as Record<'planks' | 'bricks' | 'stone' | 'metal' | 'shingles' | 'snow' | 'canvas' | 'plaster' | 'coal', THREE.CanvasTexture>
}
