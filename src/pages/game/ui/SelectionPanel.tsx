import type { ReactNode } from 'react'
import { Flame, Gauge, Minus, Plus, Power, Trash2, X, Zap } from 'lucide-react'
import { BUILDINGS, HEAT_LEVELS, PILE_TITLES, generatorCoalPerHour } from '../../../game/data'
import { heatAt } from '../../../game/simulation'
import { BUILDING_ICONS } from './BottomHud'
import { fmt, useGame } from './useGame'

function HeatBadge({ level }: { level: number }) {
  const h = HEAT_LEVELS[level] ?? HEAT_LEVELS[0]
  return (
    <span className="hud-font rounded px-2 py-0.5 text-xs text-[#111]" style={{ background: h.color }}>
      {h.name}
    </span>
  )
}

function Stepper({ value, max, onChange, label }: { value: number; max: number; onChange: (d: number) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-[#a59c8a]">{label}</span>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Убрать 5" className="hud-btn h-7 rounded px-1.5 text-[11px]" onClick={() => onChange(-5)}>-5</button>
        <button type="button" aria-label="Убрать одного" className="hud-btn flex h-7 w-7 items-center justify-center rounded" onClick={() => onChange(-1)}><Minus className="h-3.5 w-3.5" /></button>
        <span className="hud-font w-12 text-center text-base">{value}/{max}</span>
        <button type="button" aria-label="Добавить одного" className="hud-btn flex h-7 w-7 items-center justify-center rounded" onClick={() => onChange(1)}><Plus className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Добавить 5" className="hud-btn h-7 rounded px-1.5 text-[11px]" onClick={() => onChange(5)}>+5</button>
      </div>
    </div>
  )
}

function GeneratorPanel() {
  const game = useGame()
  const s = game.state
  const g = s.generator
  const maxLvl = game.maxGeneratorLevel()
  const burn = generatorCoalPerHour(g.level, g.overdrive) + s.buildings.filter((b) => b.type === 'relay' && b.built && b.enabled).length
  const hoursLeft = burn > 0 ? s.resources.coal / burn : Infinity
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Flame className={`h-6 w-6 ${g.on ? 'text-[#ffad4a]' : 'text-[#a59c8a]'}`} />
        <div>
          <div className="hud-font text-lg">Генератор</div>
          <div className="text-xs text-[#a59c8a]">Радиус тепла: {g.rangeRings} колец · {g.on ? 'Горит' : 'Остыл'}</div>
        </div>
      </div>
      <button type="button" className="hud-btn flex items-center justify-center gap-2 rounded py-2" data-active={g.on} onClick={() => game.toggleGenerator()}>
        <Power className="h-4 w-4" /> {g.on ? 'Остановить' : 'Разжечь'}
      </button>
      <div>
        <div className="hud-title mb-1 text-[11px]">Уровень мощности</div>
        <div className="grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((l) => (
            <button
              key={l}
              type="button"
              disabled={l > maxLvl}
              className="hud-btn rounded py-1.5 text-sm"
              data-active={g.level === l}
              onClick={() => game.setGeneratorLevel(l)}
            >
              {l}
            </button>
          ))}
        </div>
        {maxLvl < 4 && <div className="mt-1 text-[11px] text-[#a59c8a]">Уровни 3–4 открывает исследование «Усиленный котёл».</div>}
      </div>
      <button type="button" disabled={!g.on} className="hud-btn flex items-center justify-center gap-2 rounded py-2" data-active={g.overdrive} onClick={() => game.toggleOverdrive()}>
        <Zap className="h-4 w-4" /> Перегрузка {g.overdrive ? 'ВКЛ' : 'ВЫКЛ'}
      </button>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 text-[#a59c8a]"><Gauge className="h-3.5 w-3.5" /> Давление в котле</span>
          <span className={`hud-font ${g.stress > 70 ? 'hud-pulse text-[#ff6b55]' : ''}`}>{Math.round(g.stress)}%</span>
        </div>
        <div className="hud-bar-track h-2.5 overflow-hidden rounded-sm">
          <div className="h-full transition-all" style={{ width: `${g.stress}%`, background: g.stress > 70 ? '#ff6b55' : '#ffad4a' }} />
        </div>
      </div>
      <div className="rounded bg-black/30 p-2 text-xs leading-relaxed">
        <div>Расход угля: <span className="hud-font">{burn.toFixed(1)}/ч</span> {!g.on && <span className="text-[#a59c8a]">(если разжечь)</span>}</div>
        <div>Запаса угля хватит на: <span className={`hud-font ${hoursLeft < 12 ? 'text-[#ff6b55]' : ''}`}>{Number.isFinite(hoursLeft) ? `${Math.floor(hoursLeft)} ч` : '—'}</span></div>
        <div className="mt-1 text-[#a59c8a]">Каждый уровень мощности даёт +1 к теплу в радиусе генератора. Перегрузка даёт ещё +1, но повышает давление в котле — при 100% его разорвёт.</div>
      </div>
    </div>
  )
}

export function SelectionPanel() {
  const game = useGame()
  const s = game.state
  const sel = game.ui.selected
  if (!sel) return null

  let content: ReactNode = null
  if (sel.kind === 'generator') content = <GeneratorPanel />
  if (sel.kind === 'building') {
    const b = s.buildings.find((x) => x.id === sel.id)
    if (!b) return null
    const def = BUILDINGS[b.type]
    content = (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[#ffad4a]">{BUILDING_ICONS[b.type]}</span>
          <div className="flex-1">
            <div className="hud-font text-lg leading-tight">{def.name}</div>
            <div className="text-xs text-[#a59c8a]">{b.status}</div>
          </div>
          <HeatBadge level={b.heat} />
        </div>
        <p className="text-sm text-[#cfc6b3]">{def.description}</p>
        {!b.built && (
          <div>
            <div className="mb-1 text-xs text-[#a59c8a]">Строительство {Math.floor((b.progress / def.buildHours) * 100)}%</div>
            <div className="hud-bar-track h-2 overflow-hidden rounded-sm">
              <div className="h-full bg-[#ffad4a]" style={{ width: `${(b.progress / def.buildHours) * 100}%` }} />
            </div>
          </div>
        )}
        {def.workerKind && def.maxWorkers && (
          <div className="rounded bg-black/30 p-2">
            <Stepper
              label={def.workerKind === 'workers' ? 'Рабочие' : 'Инженеры'}
              value={b.assigned}
              max={def.maxWorkers}
              onChange={(d) => game.assign({ kind: 'building', id: b.id }, d)}
            />
            <div className="mt-1 text-[11px] text-[#a59c8a]">
              Свободных {def.workerKind === 'workers' ? 'рабочих' : 'инженеров'}: {def.workerKind === 'workers' ? s.stats.freeWorkers : s.stats.freeEngineers}
              {!b.built && ' · людей можно назначить заранее'}
            </div>
          </div>
        )}
        {def.capacity && <div className="text-sm">Вместимость: <span className="hud-font">{def.capacity}</span> · Утепление +{def.insulation}</div>}
        {b.type === 'relay' && b.built && (
          <button type="button" className="hud-btn rounded py-1.5 text-sm" data-active={b.enabled} onClick={() => game.toggleRelay(b.id)}>
            {b.enabled ? 'Узел ВКЛ (1 уголь/ч)' : 'Узел ВЫКЛ'}
          </button>
        )}
        <button type="button" className="hud-btn flex items-center justify-center gap-2 rounded py-1.5 text-sm" onClick={() => game.dismantle(b.id)}>
          <Trash2 className="h-4 w-4" /> Разобрать (возврат 50%)
        </button>
      </div>
    )
  }
  if (sel.kind === 'pile') {
    const p = s.piles.find((x) => x.id === sel.id)
    if (!p) return null
    const cell = s.cells.get(p.cellId)
    const heat = heatAt(s, p.x, p.z, cell?.ring ?? 9, 0, 'other')
    content = (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="hud-font text-lg">{PILE_TITLES[p.kind]}</div>
          <HeatBadge level={heat} />
        </div>
        <div>
          <div className="mb-1 text-xs text-[#a59c8a]">Осталось: {fmt(p.amount)} / {p.max}</div>
          <div className="hud-bar-track h-2 overflow-hidden rounded-sm">
            <div className="h-full bg-[#b08a4a]" style={{ width: `${(p.amount / p.max) * 100}%` }} />
          </div>
        </div>
        <div className="rounded bg-black/30 p-2">
          <Stepper label="Сборщики" value={p.assigned} max={5} onChange={(d) => game.assign({ kind: 'pile', id: p.id }, d)} />
        </div>
        <p className="text-xs text-[#a59c8a]">Рабочие собирают ресурсы прямо на морозе. Склад сбора рядом работает эффективнее.</p>
      </div>
    )
  }

  return (
    <div className="hud-panel hud-panel-rivets pointer-events-auto absolute right-3 top-40 w-80 rounded p-4 pt-5">
      <button
        type="button"
        aria-label="Закрыть панель"
        className="absolute right-2 top-2 text-[#a59c8a] hover:text-[#ece3cf]"
        onClick={() => game.setUi({ selected: null })}
      >
        <X className="h-4 w-4" />
      </button>
      {content}
    </div>
  )
}
