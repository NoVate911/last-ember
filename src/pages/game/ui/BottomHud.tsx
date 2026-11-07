import { Angry, Axe, BedDouble, Clock, Cog, Drumstick, Factory, FlaskConical, Heater, Hospital, House, Lock, Pickaxe, ScrollText, Soup, Stethoscope, Sun, Tent, Thermometer, TreePine, Warehouse } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../lib/shadcn/tooltip'
import { BUILDINGS, CATEGORIES } from '../../../game/data'
import type { BuildCategory, BuildingType } from '../../../game/types'
import { useGame } from './useGame'

export const BUILDING_ICONS: Record<BuildingType, ReactNode> = {
  tent: <Tent className="h-6 w-6" />,
  bunkhouse: <BedDouble className="h-6 w-6" />,
  house: <House className="h-6 w-6" />,
  depot: <Warehouse className="h-6 w-6" />,
  drill: <Pickaxe className="h-6 w-6" />,
  sawmill: <Axe className="h-6 w-6" />,
  steelworks: <Factory className="h-6 w-6" />,
  lodge: <Drumstick className="h-6 w-6" />,
  canteen: <Soup className="h-6 w-6" />,
  aid: <Stethoscope className="h-6 w-6" />,
  hospital: <Hospital className="h-6 w-6" />,
  relay: <Heater className="h-6 w-6" />,
  workshop: <FlaskConical className="h-6 w-6" />,
}

function MeterBar({ label, value, icon, color, glow }: { label: string; value: number; icon: ReactNode; color: string; glow: string }) {
  return (
    <div className="flex items-center gap-2">
      <span style={{ color }}>{icon}</span>
      <span className="hud-font w-28 text-xs uppercase text-[#a59c8a]">{label}</span>
      <div className="hud-bar-track relative h-3 w-64 overflow-hidden rounded-sm">
        <div className="h-full transition-all duration-500" style={{ width: `${value}%`, background: color, boxShadow: `0 0 10px ${glow}` }} />
        {[25, 50, 75].map((t) => (
          <div key={t} className="absolute top-0 h-full w-px bg-black/60" style={{ left: `${t}%` }} />
        ))}
      </div>
      <span className="hud-font w-8 text-right text-sm">{Math.round(value)}</span>
    </div>
  )
}

export function BuildMenu() {
  const game = useGame()
  const [cat, setCat] = useState<BuildCategory>('housing')
  const s = game.state
  const items = Object.values(BUILDINGS).filter((b) => b.category === cat)
  return (
    <div className="hud-panel hud-panel-rivets rounded px-3 pb-2 pt-3">
      <div className="mb-2 flex gap-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className="hud-btn rounded px-2.5 py-1 text-xs"
            data-active={cat === c.id}
            onClick={() => setCat(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-[92px] gap-2">
        {items.map((def) => {
          const unlocked = game.isUnlocked(def.type)
          const affordable = game.canAfford(def.type)
          const active = game.ui.placing === def.type
          return (
            <Tooltip key={def.type}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={!unlocked}
                  data-active={active}
                  onClick={() => game.setUi({ placing: active ? null : def.type, selected: null })}
                  className="hud-btn relative flex w-[104px] flex-col items-center gap-1 rounded px-1.5 py-2 normal-case"
                >
                  {!unlocked && <Lock className="absolute right-1 top-1 h-3 w-3 text-[#a59c8a]" />}
                  <span className={affordable ? 'text-[#ffad4a]' : 'text-[#a59c8a]'}>{BUILDING_ICONS[def.type]}</span>
                  <span className="text-center text-[11px] leading-tight">{def.name}</span>
                  <span className="flex gap-2 text-[11px]">
                    {def.cost.wood ? (
                      <span className={`flex items-center gap-0.5 ${s.resources.wood < def.cost.wood ? 'text-[#ff6b55]' : 'text-[#a59c8a]'}`}>
                        <TreePine className="h-3 w-3" />{def.cost.wood}
                      </span>
                    ) : null}
                    {def.cost.steel ? (
                      <span className={`flex items-center gap-0.5 ${s.resources.steel < def.cost.steel ? 'text-[#ff6b55]' : 'text-[#a59c8a]'}`}>
                        <Cog className="h-3 w-3" />{def.cost.steel}
                      </span>
                    ) : null}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="hud-dialog max-w-[240px] border-0 text-xs">
                <div className="hud-font mb-1 text-sm text-[#ffad4a]">{def.name}</div>
                <div>{def.description}</div>
                {!unlocked && <div className="mt-1 text-[#ff6b55]">Нужно исследование в мастерской.</div>}
                <div className="mt-1 text-[#a59c8a]">Время строительства: {def.buildHours} ч</div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}

export function BottomHud() {
  const game = useGame()
  const s = game.state
  const cooldown = game.lawCooldownLeft()
  const canExtend = s.laws.includes('longShifts')
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-3">
      {game.ui.placing && (
        <div className="hud-panel pointer-events-auto rounded px-3 py-1 text-xs">
          Строится <span className="hud-font text-[#ffad4a]">{BUILDINGS[game.ui.placing].name}</span> — нажмите на свободный участок. Shift — строить несколько. ПКМ или Esc — отмена.
        </div>
      )}
      <div className="hud-panel hud-panel-rivets pointer-events-auto flex flex-col gap-1 rounded px-4 pb-2 pt-3">
        <MeterBar label="Надежда" value={s.hope} icon={<Sun className="h-4 w-4" />} color="#6fb6e8" glow="rgba(111,182,232,0.6)" />
        <MeterBar label="Недовольство" value={s.discontent} icon={<Angry className="h-4 w-4" />} color="#e2552d" glow="rgba(226,85,45,0.6)" />
      </div>
      <div className="pointer-events-auto flex items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <button type="button" className="hud-btn flex items-center gap-2 rounded px-3 py-2 text-sm" onClick={() => game.setUi({ dialog: 'laws' })}>
            <ScrollText className="h-4 w-4 text-[#ffad4a]" /> Книга законов
            {cooldown === 0 && <span className="h-2 w-2 rounded-full bg-[#ffad4a] shadow-[0_0_6px_#ffad4a]" />}
          </button>
          <button type="button" className="hud-btn flex items-center gap-2 rounded px-3 py-2 text-sm" onClick={() => game.setUi({ dialog: 'research' })}>
            <FlaskConical className="h-4 w-4 text-[#8ec5ff]" /> Технологии
            {!s.researching && <span className="h-2 w-2 rounded-full bg-[#8ec5ff] shadow-[0_0_6px_#8ec5ff]" />}
          </button>
          <button
            type="button"
            className="hud-btn flex items-center gap-2 rounded px-3 py-2 text-sm"
            data-active={game.ui.heatOverlay}
            onClick={() => game.setUi({ heatOverlay: !game.ui.heatOverlay })}
          >
            <Thermometer className="h-4 w-4" /> Карта тепла
          </button>
          {canExtend && (
            <button
              type="button"
              className="hud-btn flex items-center gap-2 rounded px-3 py-2 text-sm"
              data-active={s.shiftMode === 'extended'}
              onClick={() => game.setShiftMode(s.shiftMode === 'extended' ? 'normal' : 'extended')}
            >
              <Clock className="h-4 w-4" /> {s.shiftMode === 'extended' ? 'Длинные смены' : 'Обычные смены'}
            </button>
          )}
        </div>
        <BuildMenu />
      </div>
    </div>
  )
}
