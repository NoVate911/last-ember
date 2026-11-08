import { useEffect, useState, type ReactNode } from 'react'

/** The HUD is laid out for this virtual screen and uniformly scaled to fit the real one. */
const DESIGN_W = 1440
const DESIGN_H = 810
const MAX_SCALE = 1.3

function measure() {
  const w = window.innerWidth
  const h = window.innerHeight
  const scale = Math.min(w / DESIGN_W, h / DESIGN_H, MAX_SCALE)
  return { scale, w, h }
}

/**
 * Scales the whole HUD as one piece so panels keep their relative positions on any screen:
 * nothing overflows or overlaps on small displays and nothing looks tiny on large ones.
 */
export function HudScaler({ children }: { children: ReactNode }) {
  const [m, setM] = useState(measure)
  useEffect(() => {
    const onResize = () => setM(measure())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{ width: m.w / m.scale, height: m.h / m.scale, transform: `scale(${m.scale})`, transformOrigin: '0 0' }}
    >
      {children}
    </div>
  )
}
