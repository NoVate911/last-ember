import type { ReactNode } from 'react'
import { Flame, Gauge, Minus, Plus, Power, Trash2, X, Zap, Pickaxe } from 'lucide-react'
import { BUILDERS_PER_SITE, BUILDINGS, CEMETERY_CAPACITY, HEAT_LEVELS, PILE_TITLES, RESOURCE_NAMES, generatorCoalPerHour } from '../../../game/data'
import { heatAt } from '../../../game/simulation'
import type { ResourceKey } from '../../../game/types'
import { BUILDING_ICONS } from './icons'
import { BeaconSection, SchoolSection } from './SpecialPanels'
import { fmt, useGame } from './useGame'

function HeatBadge({ level }: { level: number }) {
  const h = HEAT_LEVELS[level] ?? HEAT_LEVELS[0]
  return (
    <span className="hud-font rounded px-2 py-0.5 text-xs text-[#111]" style={{ background: h.color }}>
      {h.name}
    </span>
  )
}

function Stepper({ value, max, onChange, label, free }: { value: number; max: number; onChange: (d: number) => void; label: string; free: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="hud-font text-sm uppercase">{label}</span>
        <span className="text-[11px] text-[#8ea3b8]">{Math.max(0, free)} доступно</span>
      </div>
      <div className="flex items-center justify-center gap-1">
        <button type="button" aria-label="Убрать 5" className="hud-btn h-8 rounded px-2 text-[11px]" onClick={() => onChange(-5)}>-5</button>
        <button type="button" aria-label="Убрать одного" className="hud-btn flex h-8 w-8 items-center justify-center rounded" onClick={() => onChange(-1)}><Minus className="h-3.5 w-3.5" /></button>
        <span className="hud-font w-16 text-center text-xl">{value}<span className="text-sm text-[#8ea3b8]">/{max}</span></span>
        <button type="button" aria-label="Добавить одного" className="hud-btn flex h-8 w-8 items-center justify-center rounded" onClick={() => onChange(1)}><Plus className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Добавить 5" className="hud-btn h-8 rounded px-2 text-[11px]" onClick={() => onChange(5)}>+5</button>
      </div>
      <div className="flex gap-0.5">
        {Array.from({ length: max }, (_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-sm ${i < value ? 'bg-[#ffad4a]' : 'bg-white/10'}`} />
        ))}
      </div>
    </div>
  )
}

function Header({ icon, title, status, badge }: { icon: ReactNode; title: string; status: string; badge?: ReactNode }) {
  return (
    <>
      <div className="hud-illustration relative flex h-32 items-center justify-center">
        <div className="text-[#ffad4a] drop-shadow-[0_0_16px_rgba(255,173,74,0.7)] [&_svg]:h-16 [&_svg]:w-16">{icon}</div>
        {badge && <div className="absolute bottom-2 right-2">{badge}</div>}
      </div>
      <div className="hud-banner py-1.5 text-center">
        <div className="hud-font text-lg uppercase tracking-[0.2em]">{title}</div>
      </div>
      <div className="px-4 pt-2 text-center text-xs text-[#8ea3b8]">{status}</div>
    </>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-[#8ea3b8]">{label}</span>
      <span className="hud-font">{value}</span>
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
    <>
      <Header icon={<Flame />} title="Генератор" status={`Радиус тепла: ${g.rangeRings} колец · ${g.on ? 'Горит' : 'Остыл'}`} />
      <div className="flex flex-col gap-3 p-4">
        <button type="button" className="hud-btn flex items-center justify-center gap-2 rounded py-2" data-active={g.on} onClick={() => game.toggleGenerator()}>
          <Power className="h-4 w-4" /> {g.on ? 'Остановить' : 'Разжечь'}
        </button>
        <div className="hud-section-title">Мощность</div>
        <div className="grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((l) => (
            <button key={l} type="button" disabled={l > maxLvl} className="hud-btn rounded py-1.5 text-sm" data-active={g.level === l} onClick={() => game.setGeneratorLevel(l)}>
              {l}
            </button>
          ))}
        </div>
        {maxLvl < 4 && <div className="text-[11px] text-[#8ea3b8]">Уровни 3–4 открывает исследование «Усиленный котёл».</div>}
        <button type="button" disabled={!g.on} className="hud-btn flex items-center justify-center gap-2 rounded py-2" data-active={g.overdrive} onClick={() => game.toggleOverdrive()}>
          <Zap className="h-4 w-4" /> Перегрузка {g.overdrive ? 'ВКЛ' : 'ВЫКЛ'}
        </button>
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-[#8ea3b8]"><Gauge className="h-3.5 w-3.5" /> Давление в котле</span>
            <span className={`hud-font ${g.stress > 70 ? 'hud-pulse text-[#ff6b55]' : ''}`}>{Math.round(g.stress)}%</span>
          </div>
          <div className="hud-bar-track h-2.5 overflow-hidden rounded-sm">
            <div className="h-full transition-all" style={{ width: `${g.stress}%`, background: g.stress > 70 ? '#ff6b55' : '#ffad4a' }} />
          </div>
        </div>
        <div className="hud-section-title">Уголь</div>
        <Row label="Расход" value={<>{burn.toFixed(1)}/ч {!g.on && <span className="text-[#8ea3b8]">(если разжечь)</span>}</>} />
        <Row label="Хватит на" value={<span className={hoursLeft < 12 ? 'text-[#ff6b55]' : ''}>{Number.isFinite(hoursLeft) ? `${Math.floor(hoursLeft)} ч` : '—'}</span>} />
        <p className="text-[11px] leading-snug text-[#8ea3b8]">Каждый уровень мощности даёт +1 к теплу в радиусе генератора. Перегрузка даёт ещё +1, но повышает давление в котле — при 100% его разорвёт.</p>
      </div>
    </>
  )
}

function BuildingPanel({ id }: { id: number }) {
  const game = useGame()
  const s = game.state
  const b = s.buildings.find((x) => x.id === id)
  if (!b) return null
  const def = BUILDINGS[b.type]
  const pct = Math.min(100, (b.progress / def.buildHours) * 100)
  return (
    <>
      <Header icon={BUILDING_ICONS[b.type]} title={def.name} status={b.status} badge={<HeatBadge level={b.heat} />} />
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm leading-snug text-[#cdd8e4]">{def.description}</p>
        {!b.built && (
          <div>
            <div className="mb-1 text-xs text-[#8ea3b8]">Строительство {Math.floor(pct)}%</div>
            <div className="hud-bar-track h-2 overflow-hidden rounded-sm">
              <div className="h-full bg-[#ffad4a]" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2"><Row label="Строителей на площадке" value={`${b.present}/${BUILDERS_PER_SITE}`} /></div>
            <p className="mt-1 text-[11px] leading-snug text-[#8ea3b8]">
              Строят свободные жители — те, кто не назначен на работу. Стройка идёт только в рабочие часы и только пока люди на месте.
            </p>
          </div>
        )}
        {def.workerKind && def.maxWorkers && (
          <>
            <div className="hud-section-title">Персонал</div>
            <Stepper
              label={def.workerKind === 'workers' ? 'Рабочие' : 'Инженеры'}
              value={b.assigned}
              max={def.maxWorkers}
              free={def.workerKind === 'workers' ? s.stats.freeWorkers : s.stats.freeEngineers}
              onChange={(d) => game.assign({ kind: 'building', id: b.id }, d)}
            />
            {!b.built && <div className="text-[11px] text-[#8ea3b8]">Людей можно назначить заранее.</div>}
            {b.built && !['beacon', 'aid', 'hospital', 'arena', 'pub'].includes(b.type) && <Row label="На месте за последний час" value={`${b.present}/${b.assigned}`} />}
          </>
        )}
        {b.type === 'beacon' && <BeaconSection b={b} />}
        {b.type === 'school' && <SchoolSection b={b} />}
        {(def.capacity || def.storage || b.type === 'cemetery') && <div className="hud-section-title">Сведения</div>}
        {def.capacity && (
          <>
            <Row label="Жильцы" value={`${b.residents}/${def.capacity}`} />
            <Row label="Утепление" value={`+${def.insulation}`} />
          </>
        )}
        {def.storage && (Object.keys(def.storage) as ResourceKey[]).map((k) => (
          <Row key={k} label={`Вместимость: ${RESOURCE_NAMES[k].toLowerCase()}`} value={`+${def.storage?.[k] ?? 0}`} />
        ))}
        {b.type === 'cemetery' && (
          <>
            <Row label="Могилы" value={`${Math.floor(b.stored)}/${CEMETERY_CAPACITY}`} />
            <Row label="Ждут погребения" value={Math.ceil(s.corpses)} />
          </>
        )}
        {b.type === 'relay' && b.built && (
          <button type="button" className="hud-btn rounded py-1.5 text-sm" data-active={b.enabled} onClick={() => game.toggleRelay(b.id)}>
            {b.enabled ? 'Узел ВКЛ (1 уголь/ч)' : 'Узел ВЫКЛ'}
          </button>
        )}
        <button type="button" className="hud-btn mt-1 flex items-center justify-center gap-2 rounded py-1.5 text-sm" onClick={() => game.dismantle(b.id)}>
          <Trash2 className="h-4 w-4" /> Разобрать (возврат 50%)
        </button>
      </div>
    </>
  )
}

function PilePanel({ id }: { id: number }) {
  const game = useGame()
  const s = game.state
  const p = s.piles.find((x) => x.id === id)
  if (!p) return null
  const cell = s.cells.get(p.cellId)
  const heat = heatAt(s, p.x, p.z, cell?.ring ?? 9, 0, 'other')
  const mine = p.kind === 'coal' ? 'угольную шахту' : p.kind === 'steel' ? 'рудную шахту' : null
  return (
    <>
      <Header icon={<Pickaxe />} title={PILE_TITLES[p.kind]} status={`Осталось: ${fmt(p.amount)} из ${p.max}`} badge={<HeatBadge level={heat} />} />
      <div className="flex flex-col gap-3 p-4">
        <div className="hud-bar-track h-2 overflow-hidden rounded-sm">
          <div className="h-full bg-[#ffad4a]" style={{ width: `${(p.amount / p.max) * 100}%` }} />
        </div>
        <div className="hud-section-title">Сборщики</div>
        <Stepper label="Рабочие" value={p.assigned} max={5} free={s.stats.freeWorkers} onChange={(d) => game.assign({ kind: 'pile', id: p.id }, d)} />
        <p className="text-xs text-[#8ea3b8]">Рабочие собирают ресурсы прямо на морозе. Склад сбора рядом работает эффективнее.</p>
        {mine && <p className="text-xs text-[#8ec5ff]">Под кучей — месторождение. Здесь можно построить {mine}.</p>}
      </div>
    </>
  )
}

export function SelectionPanel() {
  const game = useGame()
  const sel = game.ui.selected
  if (!sel || game.ui.buildOpen) return null
  return (
    <div className="hud-panel hud-scroll pointer-events-auto absolute bottom-[112px] right-[100px] top-[92px] w-[330px] overflow-y-auto rounded-md">
      <button
        type="button"
        aria-label="Закрыть панель"
        className="absolute right-2 top-2 z-10 rounded-full bg-black/40 p-1 text-[#8ea3b8] hover:text-white"
        onClick={() => game.setUi({ selected: null })}
      >
        <X className="h-4 w-4" />
      </button>
      {sel.kind === 'generator' && <GeneratorPanel />}
      {sel.kind === 'building' && <BuildingPanel id={sel.id} />}
      {sel.kind === 'pile' && <PilePanel id={sel.id} />}
    </div>
  )
}
