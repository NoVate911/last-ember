import { Angry, Clock, Cog, FlaskConical, Hammer, Home, Lock, MapPin, ScrollText, Sun, Thermometer, TreePine } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { BUILDINGS, CATEGORIES } from '../../../game/data'
import type { BuildCategory } from '../../../game/types'
import { BUILDING_ICONS, Tip } from './icons'
import { useGame } from './useGame'

function MeterBar({ label, value, icon, color, glow }: { label: string; value: number; icon: ReactNode; color: string; glow: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style=undefined>{icon}</span>
      <div className="flex-1">
        <div className="mb-0.5 flex justify-between">
          <span className="hud-font text-[10px] uppercase tracking-[0.18em] text-[#8ea3b8]">{label}</span>
          <span className="hud-font text-[11px]">{Math.round(value)}</span>
        </div>
        <div className="hud-bar-track relative h-2.5 w-72 overflow-hidden rounded-sm">
          <div className="h-full transition-all duration-500" style=undefined />
          {[25, 50, 75].map((t) => (
            <div key={t} className="absolute top-0 h-full w-px bg-black/60" style=undefined />
          ))}
        </div>
      </div>
    </div>
  )
}

function RoundButton({ label, icon, active, badge, onClick }: { label: string; icon: ReactNode; active?: boolean; badge?: string; onClick: () => void }) {
  return (
    <Tip label={label} side="top">
      <button type="button" aria-label={label} data-active={active ?? false} className="hud-round relative flex h-14 w-14 items-center justify-center" onClick={onClick}>
        {icon}
        {badge && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-black shadow-[0_0_6px_currentColor]" style=undefined />}
      </button>
    </Tip>
  )
}

export function BuildMenu() {
  const game = useGame()
  const [cat, setCat] = useState<BuildCategory>('housing')
  const s = game.state
  const items = Object.values(BUILDINGS).filter((b) => b.category === cat)
  return (
    <div className="hud-panel pointer-events-auto max-w-[760px] rounded-md px-3 pb-2.5 pt-2">
      <div className="mb-2 flex flex-wrap justify-center gap-1">
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" className="hud-btn rounded px-2.5 py-1 text-[11px]" data-active={cat === c.id} onClick={() => setCat(c.id)}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-[96px] flex-wrap justify-center gap-2">
        {items.map((def) => {
          const lock = game.lockReason(def.type)
          const affordable = game.canAfford(def.type)
          const active = game.ui.placing === def.type
          return (
            <Tip
              key={def.type}
              side="top"
              label={
                <>
                  <div className="hud-font mb-1 text-sm text-[#ffad4a]">{def.name}</div>
                  <div>{def.description}</div>
                  {lock && <div className="mt-1 text-[#ff6b55]">{lock}.</div>}
                  {def.onDeposit && <div className="mt-1 text-[#8ec5ff]">Ставится на месторождение (на месте кучи).</div>}
                  <div className="mt-1 text-[#8ea3b8]">Время строительства: {def.buildHours} ч при 4 строителях</div>
                </>
              }
            >
              <button
                type="button"
                aria-disabled={lock !== null}
                data-active={active}
                onClick={() => { if (!lock) game.setUi({ placing: active ? null : def.type, selected: null }) }}
                className="hud-btn relative flex w-[100px] flex-col items-center gap-1 rounded px-1.5 py-2 normal-case"
              >
                {lock && <Lock className="absolute right-1 top-1 h-3 w-3 text-[#8ea3b8]" />}
                {def.onDeposit && <MapPin className="absolute left-1 top-1 h-3 w-3 text-[#8ec5ff]" />}
                <span className={affordable ? 'text-[#ffad4a]' : 'text-[#8ea3b8]'}>{BUILDING_ICONS[def.type]}</span>
                <span className="text-center text-[11px] leading-tight">{def.name}</span>
                <span className="flex gap-2 text-[11px]">
                  {def.cost.wood ? (
                    <span className={`flex items-center gap-0.5 ${s.resources.wood < def.cost.wood ? 'text-[#ff6b55]' : 'text-[#8ea3b8]'}`}>
                      <TreePine className="h-3 w-3" />{def.cost.wood}
                    </span>
                  ) : null}
                  {def.cost.steel ? (
                    <span className={`flex items-center gap-0.5 ${s.resources.steel < def.cost.steel ? 'text-[#ff6b55]' : 'text-[#8ea3b8]'}`}>
                      <Cog className="h-3 w-3" />{def.cost.steel}
                    </span>
                  ) : null}
                </span>
              </button>
            </Tip>
          )
        })}
      </div>
    </div>
  )
}

function HousingCounter() {
  const game = useGame()
  const s = game.state
  const pop = s.stats.housed + s.stats.homeless
  const canExtend = s.laws.includes('longShifts')
  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 flex flex-col items-end gap-2">
      {canExtend && (
        <button
          type="button"
          className="hud-btn flex items-center gap-2 rounded px-3 py-1.5 text-xs"
          data-active={s.shiftMode === 'extended'}
          onClick={() => game.setShiftMode(s.shiftMode === 'extended' ? 'normal' : 'extended')}
        >
          <Clock className="h-3.5 w-3.5" /> {s.shiftMode === 'extended' ? 'Длинные смены' : 'Обычные смены'}
        </button>
      )}
      <Tip label="Жители под крышей / все жители" side="left">
        <div className="hud-panel flex items-center gap-2 rounded px-3 py-1.5">
          <Home className={`h-4 w-4 ${s.stats.homeless > 0 ? 'text-[#ff6b55]' : 'text-[#8ea3b8]'}`} />
          <span className="hud-font text-xl">{s.stats.housed}<span className="text-sm text-[#8ea3b8]">/{pop}</span></span>
        </div>
      </Tip>
    </div>
  )
}

export function BottomHud() {
  const game = useGame()
  const s = game.state
  const ui = game.ui
  const cooldown = game.lawCooldownLeft()
  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3">
        {ui.placing && (
          <div className="hud-panel pointer-events-auto rounded px-3 py-1 text-xs">
            Строится <span className="hud-font text-[#ffad4a]">{BUILDINGS[ui.placing].name}</span> — нажмите на {BUILDINGS[ui.placing].onDeposit ? 'подсвеченное месторождение' : 'свободный участок'}. Shift — строить несколько. ПКМ или Esc — отмена.
          </div>
        )}
        {ui.buildOpen && <BuildMenu />}
        <div className="pointer-events-auto flex items-center gap-3">
          <RoundButton label="Строительство" icon={<Hammer className="h-6 w-6" />} active={ui.buildOpen} onClick={() => game.setUi({ buildOpen: !ui.buildOpen, placing: null })} />
          <RoundButton label="Книга законов" icon={<ScrollText className="h-6 w-6" />} {...(cooldown === 0 ? { badge: '#ffad4a' } : {})} onClick={() => game.setUi({ dialog: 'laws' })} />
          <div className="hud-panel flex flex-col gap-1.5 rounded-md px-4 py-2">
            <MeterBar label="Надежда" value={s.hope} icon={<Sun className="h-4 w-4" />} color="#5fb3ff" glow="rgba(95,179,255,0.6)" />
            <MeterBar label="Недовольство" value={s.discontent} icon={<Angry className="h-4 w-4" />} color="#e2482d" glow="rgba(226,72,45,0.6)" />
          </div>
          <RoundButton label="Технологии" icon={<FlaskConical className="h-6 w-6" />} {...(!s.researching ? { badge: '#8ec5ff' } : {})} onClick={() => game.setUi({ dialog: 'research' })} />
          <RoundButton label="Карта тепла" icon={<Thermometer className="h-6 w-6" />} active={ui.heatOverlay} onClick={() => game.setUi({ heatOverlay: !ui.heatOverlay })} />
        </div>
      </div>
      <HousingCounter />
    </>
  )
}
