import { Compass, Skull, Users } from 'lucide-react'
import { BUILDINGS, EXPEDITION_SITES, RESOURCE_NAMES, SCHOOL_CAPACITY, STUDY_HOURS_PER_ENGINEER, type ExpeditionSite } from '../../../game/data'
import { expeditionBlock } from '../../../game/expedition'
import type { Building, ResourceKey } from '../../../game/types'
import { useGame } from './useGame'

function rewardText(site: ExpeditionSite): string {
  const r = site.reward
  const parts: string[] = []
  for (const k of ['coal', 'wood', 'steel', 'rawFood'] as ResourceKey[]) {
    const v = r[k as keyof typeof r]
    if (v) parts.push(`${RESOURCE_NAMES[k].toLowerCase()} ${v}`)
  }
  const people = (r.workers ?? 0) + (r.engineers ?? 0) + (r.children ?? 0)
  if (people) parts.push(`выжившие ~${people}`)
  return parts.join(', ')
}

export function BeaconSection({ b }: { b: Building }) {
  const game = useGame()
  const s = game.state
  if (!b.built) return null
  const e = s.expedition
  const active = e ? EXPEDITION_SITES.find((x) => x.id === e.siteId) : undefined
  const max = BUILDINGS.beacon.maxWorkers ?? 5
  return (
    <>
      <div className="hud-section-title">Экспедиции</div>
      {e && active ? (
        <div className="flex flex-col gap-1.5 rounded border border-white/10 bg-black/20 p-2.5">
          <div className="flex items-center gap-2 text-sm"><Compass className="h-4 w-4 text-[#ffad4a]" /> {active.name}</div>
          <div className="hud-bar-track h-2 overflow-hidden rounded-sm">
            <div className="h-full bg-[#ffad4a]" style={{ width: `${Math.min(100, ((s.time - e.startedAt) / (e.returnAt - e.startedAt)) * 100)}%` }} />
          </div>
          <div className="text-[11px] text-[#8ea3b8]">Вернутся через {Math.max(0, Math.ceil(e.returnAt - s.time))} ч. Отряд нельзя изменить, пока он в пути.</div>
        </div>
      ) : (
        <p className="text-[11px] leading-snug text-[#8ea3b8]">
          Назначьте {max} разведчиков и выберите цель. Отряд уходит за пределы кратера; чем дальше цель, тем выше риск обморожения.
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {EXPEDITION_SITES.map((site) => {
          const explored = s.explored.includes(site.id)
          const block = expeditionBlock(s, site.id)
          return (
            <div key={site.id} className={`rounded border border-white/10 p-2 ${explored ? 'opacity-50' : 'bg-black/20'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="hud-font text-sm">{site.name}</span>
                <span className="shrink-0 text-[11px] text-[#8ea3b8]">{site.hours * 2} ч</span>
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-[#8ea3b8]">{site.description}</div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                <span className="flex items-center gap-1 text-[#cdd8e4]"><Users className="h-3 w-3" /> {rewardText(site)}</span>
                <span className="flex items-center gap-1 text-[#ff8a75]"><Skull className="h-3 w-3" /> {Math.round(site.danger * 100)}%</span>
              </div>
              {explored ? (
                <div className="mt-1 text-[11px] text-[#7fd18b]">Исследовано</div>
              ) : (
                <button
                  type="button"
                  disabled={block !== null}
                  title={block ?? undefined}
                  className="hud-btn mt-1.5 w-full rounded py-1 text-xs"
                  onClick={() => game.sendExpedition(site.id)}
                >
                  {block ?? 'Отправить отряд'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

export function SchoolSection({ b }: { b: Building }) {
  const game = useGame()
  const s = game.state
  if (!b.built) return null
  const youth = s.laws.includes('youthLabor')
  const pct = Math.min(100, (s.studyProgress / STUDY_HOURS_PER_ENGINEER) * 100)
  return (
    <>
      <div className="hud-section-title">Обучение</div>
      <div className="flex justify-between text-sm">
        <span className="text-[#8ea3b8]">Учеников в классе</span>
        <span className="hud-font">{b.stored}/{SCHOOL_CAPACITY}</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-[#8ea3b8]">Детей в городе</span>
        <span className="hud-font">{s.pop.children}</span>
      </div>
      <div>
        <div className="mb-1 text-xs text-[#8ea3b8]">До следующего инженера {Math.floor(pct)}%</div>
        <div className="hud-bar-track h-2 overflow-hidden rounded-sm">
          <div className="h-full bg-[#8ec5ff]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <p className="text-[11px] leading-snug text-[#8ea3b8]">
        {youth
          ? 'Закон «Трудовая программа для подростков» отправил детей на работу — школа закрыта.'
          : 'В рабочие часы дети приходят на уроки. Чем больше учителей и учеников на месте, тем быстрее выпуск.'}
      </p>
    </>
  )
}
