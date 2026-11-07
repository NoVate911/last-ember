import { Baby, Cog, Drumstick, FastForward, FlaskConical, HardHat, HeartPulse, Pause, Pickaxe, Play, ScrollText, Skull, Soup, Tent, Thermometer, TreePine, Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../lib/shadcn/tooltip'
import { HEAT_LEVELS, RESEARCH, baseTempForDay, formatTime, isStorm, outsideTemp, tempToLevel } from '../../../game/data'
import type { ResourceKey } from '../../../game/types'
import { fmt, useGame } from './useGame'

const RES: { key: ResourceKey; label: string; icon: ReactNode }[] = [
  { key: 'coal', label: 'Уголь', icon: <Pickaxe className="h-4 w-4" /> },
  { key: 'wood', label: 'Дерево', icon: <TreePine className="h-4 w-4" /> },
  { key: 'steel', label: 'Сталь', icon: <Cog className="h-4 w-4" /> },
  { key: 'rawFood', label: 'Сырая еда', icon: <Drumstick className="h-4 w-4" /> },
  { key: 'rations', label: 'Пайки', icon: <Soup className="h-4 w-4" /> },
]

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="hud-dialog border-0 text-xs">{label}</TooltipContent>
    </Tooltip>
  )
}

function levelColor(t: number) {
  const lvl = Math.max(0, Math.min(5, tempToLevel(t)))
  return HEAT_LEVELS[lvl]?.color ?? '#fff'
}

export function TemperatureDial() {
  const game = useGame()
  const s = game.state
  const temp = outsideTemp(s.time)
  const { day, clock } = formatTime(s.time)
  const storm = isStorm(s.time)
  const hourAngle = ((s.time % 24) / 24) * 360
  const forecast = [0, 1, 2, 3, 4].map((i) => ({ day: day + i, t: baseTempForDay(day + i) }))
  return (
    <div className="flex items-start gap-2">
      <div className="hud-dial relative flex h-28 w-28 flex-col items-center justify-center rounded-full">
        <div
          className="absolute inset-1 rounded-full border border-dashed border-[#6e5630]"
          style={{ transform: `rotate(${hourAngle}deg)` }}
        >
          <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-[#ffad4a] shadow-[0_0_8px_#ffad4a]" />
        </div>
        <Thermometer className="h-4 w-4 text-[#a59c8a]" />
        <div className="hud-font text-3xl font-semibold leading-none" style={{ color: levelColor(temp) }}>
          {temp}°
        </div>
        <div className="hud-font mt-1 text-[11px] text-[#a59c8a]">ДЕНЬ {day}</div>
        <div className="hud-font text-sm">{clock}</div>
      </div>
      <div className="hud-panel hud-panel-rivets mt-2 rounded px-2 pb-1.5 pt-3">
        <div className="hud-title mb-1 text-center text-[10px]">Прогноз</div>
        <div className="flex gap-1">
          {forecast.map((f) => (
            <div key={f.day} className="flex w-10 flex-col items-center rounded bg-black/40 py-1">
              <span className="hud-font text-[10px] text-[#a59c8a]">Д{f.day}</span>
              <span className="hud-font text-sm" style={{ color: levelColor(f.t) }}>{f.t}°</span>
            </div>
          ))}
        </div>
        {storm && <div className="hud-font hud-pulse mt-1 text-center text-[11px] text-[#ff6b55]">БУРЯ</div>}
      </div>
    </div>
  )
}

export function ResourceStrip() {
  const game = useGame()
  const s = game.state
  const past = s.history[0]
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="hud-panel hud-panel-rivets flex gap-1 rounded px-3 pb-1.5 pt-2">
        {RES.map((r) => {
          const val = s.resources[r.key]
          const delta = past ? val - past[r.key] : 0
          return (
            <Tip key={r.key} label={`${r.label}: ${fmt(val)} (${delta >= 0 ? '+' : ''}${Math.round(delta)} за последние 24 ч)`}>
              <div className="flex min-w-[78px] items-center gap-1.5 rounded px-2 py-1 hover:bg-white/5">
                <span className="text-[#b08a4a]">{r.icon}</span>
                <div className="flex flex-col leading-none">
                  <span className={`hud-font text-base ${val < 10 ? 'text-[#ff6b55]' : ''}`}>{fmt(val)}</span>
                  <span className={`hud-font text-[10px] ${delta > 0.5 ? 'text-[#7fd38f]' : delta < -0.5 ? 'text-[#ff6b55]' : 'text-[#a59c8a]'}`}>
                    {delta > 0.5 ? '▲' : delta < -0.5 ? '▼' : '•'} {Math.abs(Math.round(delta))}
                  </span>
                </div>
              </div>
            </Tip>
          )
        })}
      </div>
      {s.promise && (
        <div className="hud-panel flex items-center gap-2 rounded px-3 py-1 text-xs">
          <ScrollText className="h-3.5 w-3.5 text-[#ffad4a]" />
          <span className="hud-font">ОБЕЩАНИЕ:</span>
          <span>{s.promise.text}</span>
          <span className="hud-font text-[#ffad4a]">{Math.max(0, Math.ceil(s.promise.deadline - s.time))} ч осталось</span>
        </div>
      )}
      {s.researching && (
        <div className="hud-panel flex items-center gap-2 rounded px-3 py-1 text-xs">
          <FlaskConical className="h-3.5 w-3.5 text-[#8ec5ff]" />
          <span>{RESEARCH.find((r) => r.id === s.researching)?.name}</span>
          <div className="hud-bar-track h-1.5 w-24 overflow-hidden rounded">
            <div
              className="h-full bg-[#8ec5ff]"
              style={{ width: `${Math.min(100, (s.researchProgress / (RESEARCH.find((r) => r.id === s.researching)?.points ?? 1)) * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function PopulationPanel() {
  const game = useGame()
  const s = game.state
  const speeds = [
    { v: 0, icon: <Pause className="h-4 w-4" />, label: 'Пауза' },
    { v: 1, icon: <Play className="h-4 w-4" />, label: 'Обычная скорость' },
    { v: 2, icon: <FastForward className="h-4 w-4" />, label: 'Быстро' },
    { v: 4, icon: <span className="hud-font text-xs">x4</span>, label: 'Очень быстро' },
  ]
  const item = (icon: ReactNode, value: number | string, label: string, tone = '') => (
    <Tip label={label}>
      <div className="flex items-center gap-1 px-1.5">
        <span className={tone || 'text-[#b08a4a]'}>{icon}</span>
        <span className={`hud-font text-sm ${tone}`}>{value}</span>
      </div>
    </Tip>
  )
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="hud-panel hud-panel-rivets flex items-center rounded px-2 pb-1.5 pt-2.5">
        {item(<HardHat className="h-4 w-4" />, `${s.stats.freeWorkers}/${s.pop.workers + (s.laws.includes('youthLabor') ? s.pop.children : 0)}`, 'Рабочие (свободно / всего)')}
        {item(<Wrench className="h-4 w-4" />, `${s.stats.freeEngineers}/${s.pop.engineers}`, 'Инженеры (свободно / всего)')}
        {item(<Baby className="h-4 w-4" />, s.pop.children, s.laws.includes('youthLabor') ? 'Дети (работают)' : 'Дети')}
        <div className="mx-1 h-5 w-px bg-[#6e5630]" />
        {item(<HeartPulse className="h-4 w-4" />, `${s.sick}`, `Больные: ${s.sick} (лечатся ${s.stats.treated})`, s.sick > 0 ? 'text-[#f2d27a]' : '')}
        {item(<Skull className="h-4 w-4" />, s.gravelyIll, 'Тяжелобольные', s.gravelyIll > 0 ? 'text-[#ff6b55]' : '')}
        {item(<Tent className="h-4 w-4" />, s.stats.homeless, 'Бездомные', s.stats.homeless > 0 ? 'text-[#ff6b55]' : '')}
        {item(<Soup className="h-4 w-4" />, s.hungry, 'Голодные', s.hungry > 0 ? 'text-[#ff6b55]' : '')}
      </div>
      <div className="flex items-center gap-1">
        {speeds.map((sp) => (
          <Tip key={sp.v} label={sp.label}>
            <button
              type="button"
              aria-label={sp.label}
              className="hud-btn flex h-8 w-9 items-center justify-center rounded"
              data-active={s.speed === sp.v}
              onClick={() => game.setSpeed(sp.v)}
            >
              {sp.icon}
            </button>
          </Tip>
        ))}
        <div className="hud-font ml-1 text-xs text-[#a59c8a]">Погибло: <span className="text-[#ece3cf]">{s.deaths}</span></div>
      </div>
    </div>
  )
}

export function TopBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
      <div className="pointer-events-auto"><TemperatureDial /></div>
      <div className="pointer-events-auto"><ResourceStrip /></div>
      <div className="pointer-events-auto"><PopulationPanel /></div>
    </div>
  )
}
