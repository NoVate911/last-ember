import { Baby, FastForward, FlaskConical, HardHat, HeartPulse, Menu, Pause, Play, Save, ScrollText, Skull, Soup, Tent, Thermometer, Wrench, Ghost } from 'lucide-react'
import type { ReactNode } from 'react'
import { HEAT_LEVELS, RESEARCH, RESOURCE_NAMES, SECONDS_PER_HOUR, baseTempForDay, formatTime, isStorm, outsideTemp, tempToLevel } from '../../../game/data'
import type { ResourceKey } from '../../../game/types'
import { RESOURCE_ICONS, Tip } from './icons'
import { fmt, useGame } from './useGame'

const RES_ORDER: ResourceKey[] = ['coal', 'wood', 'steel', 'rawFood', 'rations']

function levelColor(t: number) {
  const lvl = Math.max(0, Math.min(5, tempToLevel(t)))
  return HEAT_LEVELS[lvl]?.color ?? '#fff'
}

function ResourceItem({ k }: { k: ResourceKey }) {
  const s = useGame().state
  const val = s.resources[k]
  const cap = s.stats.caps[k]
  const past = s.history[0]
  const delta = past ? val - past[k] : 0
  const full = val >= cap - 0.5
  return (
    <Tip label={<><b>{RESOURCE_NAMES[k]}</b>: {fmt(val)} из {fmt(cap)}<br />За последние 24 ч: {delta >= 0 ? '+' : ''}{Math.round(delta)}{full && <><br /><span className="text-[#ff6b55]">Склады заполнены — стройте склады.</span></>}</>}>
      <div className="flex min-w-[84px] items-center gap-1.5 px-2 py-1.5">
        <span className="text-[#ffad4a]">{RESOURCE_ICONS[k]}</span>
        <div className="flex flex-col leading-none">
          <span className={`hud-font text-base ${val < 10 ? 'text-[#ff6b55]' : full ? 'text-[#f2d27a]' : ''}`}>
            {fmt(val)}<span className="text-[10px] text-[#8ea3b8]">/{fmt(cap)}</span>
          </span>
          <span className={`hud-font text-[10px] ${delta > 0.5 ? 'text-[#7fd38f]' : delta < -0.5 ? 'text-[#ff6b55]' : 'text-[#8ea3b8]'}`}>
            {delta > 0.5 ? '▲' : delta < -0.5 ? '▼' : '•'} {Math.abs(Math.round(delta))}
          </span>
        </div>
      </div>
    </Tip>
  )
}

function PopItem({ icon, value, label, tone }: { icon: ReactNode; value: ReactNode; label: string; tone?: string }) {
  return (
    <Tip label={label}>
      <div className="flex items-center gap-1 px-1.5 py-1.5">
        <span className={tone ?? 'text-[#8ea3b8]'}>{icon}</span>
        <span className={`hud-font text-sm ${tone ?? ''}`}>{value}</span>
      </div>
    </Tip>
  )
}

function Dial() {
  const game = useGame()
  const s = game.state
  const temp = outsideTemp(s.time)
  const { day, clock } = formatTime(s.time)
  const hourAngle = ((s.time % 24) / 24) * 360
  const speeds = [
    { v: 0, icon: <Pause className="h-3.5 w-3.5" />, label: 'Пауза' },
    { v: 1, icon: <Play className="h-3.5 w-3.5" />, label: `Обычная скорость: 1 час = ${SECONDS_PER_HOUR} с` },
    { v: 2, icon: <FastForward className="h-3.5 w-3.5" />, label: `Быстро: 1 час = ${SECONDS_PER_HOUR / 2} с` },
    { v: 4, icon: <span className="hud-font text-[11px]">x4</span>, label: `Очень быстро: 1 час = ${SECONDS_PER_HOUR / 4} с` },
  ]
  return (
    <div className="flex flex-col items-center">
      <div className="hud-dial relative -mt-1 flex h-[118px] w-[118px] flex-col items-center justify-center rounded-full">
        <div className="absolute inset-1.5 rounded-full border border-dashed border-white/20" style=undefined>
          <div className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-[#ffad4a] shadow-[0_0_8px_#ffad4a]" />
        </div>
        <Thermometer className="h-4 w-4 text-[#8ea3b8]" />
        <div className="hud-font text-[34px] font-semibold leading-none" style=undefined>{temp}°</div>
        <div className="hud-font mt-0.5 text-[11px] text-[#8ea3b8]">{isStorm(s.time) ? <span className="hud-pulse text-[#ff6b55]">БУРЯ</span> : 'СНАРУЖИ'}</div>
      </div>
      <div className="hud-strip -mt-2 flex items-center gap-1 rounded-b px-2 pb-1 pt-2.5">
        <span className="hud-font mr-1 text-xs text-[#8ea3b8]">ДЕНЬ <span className="text-[#e6edf5]">{day}</span> · <span className="text-[#e6edf5]">{clock}</span></span>
        {speeds.map((sp) => (
          <Tip key={sp.v} label={sp.label}>
            <button type="button" aria-label={sp.label} className="hud-btn flex h-6 w-7 items-center justify-center rounded" data-active={s.speed === sp.v} onClick={() => game.setSpeed(sp.v)}>
              {sp.icon}
            </button>
          </Tip>
        ))}
      </div>
    </div>
  )
}

function StatusPills() {
  const s = useGame().state
  const research = s.researching ? RESEARCH.find((r) => r.id === s.researching) : undefined
  if (!s.promise && !research) return null
  return (
    <div className="mt-1.5 flex flex-col items-center gap-1">
      {s.promise && (
        <div className="hud-panel flex items-center gap-2 rounded px-3 py-1 text-xs">
          <ScrollText className="h-3.5 w-3.5 text-[#ffad4a]" />
          <span className="hud-font">ОБЕЩАНИЕ:</span>
          <span>{s.promise.text}</span>
          <span className="hud-font text-[#ffad4a]">{Math.max(0, Math.ceil(s.promise.deadline - s.time))} ч</span>
        </div>
      )}
      {research && (
        <div className="hud-panel flex items-center gap-2 rounded px-3 py-1 text-xs">
          <FlaskConical className="h-3.5 w-3.5 text-[#8ec5ff]" />
          <span>{research.name}</span>
          <div className="hud-bar-track h-1.5 w-24 overflow-hidden rounded">
            <div className="h-full bg-[#8ec5ff]" style=undefined />
          </div>
        </div>
      )}
    </div>
  )
}

function Forecast() {
  const game = useGame()
  const s = game.state
  const { day } = formatTime(s.time)
  const forecast = [0, 1, 2, 3, 4].map((i) => ({ day: day + i, t: baseTempForDay(day + i) }))
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <Tip label="Быстрое сохранение (слот 1)" side="left">
          <button type="button" aria-label="Быстрое сохранение" className="hud-round flex h-10 w-10 items-center justify-center" onClick={() => game.save('1')}>
            <Save className="h-4 w-4" />
          </button>
        </Tip>
        <Tip label="Меню: сохранение и загрузка" side="left">
          <button type="button" aria-label="Меню" className="hud-round flex h-10 w-10 items-center justify-center" onClick={() => game.setUi({ dialog: 'menu' })}>
            <Menu className="h-4 w-4" />
          </button>
        </Tip>
      </div>
      <div className="hud-panel rounded px-1.5 py-1.5">
        <div className="hud-title mb-1 text-center text-[9px]">Прогноз</div>
        <div className="flex flex-col gap-0.5">
          {forecast.map((f) => (
            <div key={f.day} className="flex w-[74px] items-center justify-between rounded bg-black/40 px-1.5 py-0.5">
              <span className="hud-font text-[10px] text-[#8ea3b8]">Д{f.day}</span>
              <span className="hud-font text-xs" style=undefined>{f.t}°</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TopBar() {
  const s = useGame().state
  const youth = s.laws.includes('youthLabor')
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        <div className="pointer-events-auto flex flex-col items-center">
          <div className="flex items-start">
            <div className="hud-strip flex rounded-bl-md pl-2">
              {RES_ORDER.map((k) => <ResourceItem key={k} k={k} />)}
            </div>
            <Dial />
            <div className="hud-strip flex rounded-br-md pr-2">
              <PopItem icon={<HardHat className="h-4 w-4" />} value={`${s.stats.freeWorkers}/${s.pop.workers + (youth ? s.pop.children : 0)}`} label="Рабочие (свободно / всего)" />
              <PopItem icon={<Wrench className="h-4 w-4" />} value={`${s.stats.freeEngineers}/${s.pop.engineers}`} label="Инженеры (свободно / всего)" />
              <PopItem icon={<Baby className="h-4 w-4" />} value={s.pop.children} label={youth ? 'Дети (работают)' : 'Дети'} />
              <div className="mx-1 my-2 w-px bg-white/15" />
              <PopItem icon={<HeartPulse className="h-4 w-4" />} value={s.sick} label={`Больные: ${s.sick} (лечатся ${s.stats.treated})`} {...(s.sick > 0 ? { tone: 'text-[#f2d27a]' } : {})} />
              <PopItem icon={<Skull className="h-4 w-4" />} value={s.gravelyIll} label="Тяжелобольные" {...(s.gravelyIll > 0 ? { tone: 'text-[#ff6b55]' } : {})} />
              <PopItem icon={<Tent className="h-4 w-4" />} value={s.stats.homeless} label="Бездомные" {...(s.stats.homeless > 0 ? { tone: 'text-[#ff6b55]' } : {})} />
              <PopItem icon={<Soup className="h-4 w-4" />} value={s.hungry} label="Голодные" {...(s.hungry > 0 ? { tone: 'text-[#ff6b55]' } : {})} />
              <PopItem icon={<Ghost className="h-4 w-4" />} value={Math.ceil(s.corpses)} label={`Непогребённые тела. Злят людей. Погибло всего: ${s.deaths}`} {...(s.corpses >= 0.5 ? { tone: 'text-[#ff6b55]' } : {})} />
            </div>
          </div>
          <StatusPills />
        </div>
      </div>
      <div className="pointer-events-auto absolute right-3 top-3">
        <Forecast />
      </div>
    </>
  )
}
