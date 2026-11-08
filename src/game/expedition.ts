import { BUILDINGS, EXPEDITION_SITES, RESOURCE_NAMES, isStorm } from './data'
import { addLog, addRes, clamp, totalPop } from './simulation'
import type { Building, GameState, ResourceKey } from './types'

export function beaconOf(s: GameState): Building | null {
  return s.buildings.find((b) => b.type === 'beacon' && b.built) ?? null
}

/** Why scouts can't be sent to this site right now, or null when they can. */
export function expeditionBlock(s: GameState, siteId: string): string | null {
  const b = beaconOf(s)
  if (!b) return 'Нужен построенный маяк'
  if (s.expedition) return 'Отряд уже в пути'
  if (s.explored.includes(siteId)) return 'Уже исследовано'
  const max = BUILDINGS.beacon.maxWorkers ?? 5
  if (b.assigned < max) return `Нужно ${max} разведчиков`
  if (isStorm(s.time)) return 'Во время бури экспедиции невозможны'
  return null
}

export function startExpedition(s: GameState, siteId: string): boolean {
  const site = EXPEDITION_SITES.find((x) => x.id === siteId)
  if (!site || expeditionBlock(s, siteId)) return false
  s.expedition = { siteId, startedAt: s.time, returnAt: s.time + site.hours * 2 }
  addLog(s, `Разведчики отправились: ${site.name}. Вернутся через ${site.hours * 2} ч.`, 'info')
  return true
}

/** Called every hour: bring the scouts home when their time is up and report the findings. */
export function resolveExpedition(s: GameState) {
  const e = s.expedition
  if (!e || s.time < e.returnAt) return
  s.expedition = null
  const site = EXPEDITION_SITES.find((x) => x.id === e.siteId)
  if (!site) return
  s.explored.push(site.id)
  const found: string[] = []
  const r = site.reward
  for (const key of ['coal', 'wood', 'steel', 'rawFood'] as ResourceKey[]) {
    const want = r[key as keyof typeof r] ?? 0
    if (want <= 0) continue
    const got = Math.floor(addRes(s, key, want))
    found.push(got < want ? `${RESOURCE_NAMES[key]}: +${got} (не поместилось ${want - got})` : `${RESOURCE_NAMES[key]}: +${got}`)
  }
  const people = (r.workers ?? 0) + (r.engineers ?? 0) + (r.children ?? 0)
  if (people > 0) {
    s.pop.workers += r.workers ?? 0
    s.pop.engineers += r.engineers ?? 0
    s.pop.children += r.children ?? 0
    s.hope = clamp(s.hope + Math.min(8, people * 0.5), 0, 100)
    found.push(`Новые жители: ${people} (рабочих ${r.workers ?? 0}, инженеров ${r.engineers ?? 0}, детей ${r.children ?? 0})`)
  }
  // The frost takes its toll on long trips
  let frostbite = 0
  for (let i = 0; i < (BUILDINGS.beacon.maxWorkers ?? 5); i++) if (Math.random() < site.danger) frostbite++
  frostbite = Math.min(frostbite, Math.max(0, totalPop(s) - s.sick - s.gravelyIll))
  if (frostbite > 0) {
    s.sick += frostbite
    found.push(`Обморожены разведчики: ${frostbite}`)
  }
  addLog(s, `Разведчики вернулись: ${site.name}.`, frostbite > 0 ? 'warn' : 'good')
  if (!s.pendingEvent) {
    s.pendingEvent = {
      id: `expedition-${site.id}`,
      title: `Отчёт разведки: ${site.name}`,
      text: `${site.description}\n\n${found.join('\n')}`,
      choices: [{ label: 'Принять находки', hint: 'Отряд снова готов к выходу', action: 'none' }],
    }
  }
}
