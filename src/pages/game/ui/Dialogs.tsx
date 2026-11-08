import { Check, FlaskConical, Hourglass, Lock, ScrollText, X as XIcon } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../lib/shadcn/dialog'
import { LAWS, RESEARCH } from '../../../game/data'
import { useGame } from './useGame'

export function LawsDialog() {
  const game = useGame()
  const open = game.ui.dialog === 'laws'
  const cooldown = game.lawCooldownLeft()
  const groups = [
    { id: 'adaptation', title: 'Выживание', desc: 'Жёсткие меры, чтобы пережить холод.' },
    { id: 'purpose', title: 'Цель', desc: 'Дайте людям то, во что верить. Выберите один путь.' },
  ] as const
  return (
    <Dialog open={open} onOpenChange={(o) => game.setUi({ dialog: o ? 'laws' : null })}>
      <DialogContent className="hud-dialog hud-root max-w-4xl">
        <DialogHeader>
          <DialogTitle className="hud-font flex items-center gap-2 text-2xl uppercase tracking-widest text-[#ffad4a]">
            <ScrollText className="h-6 w-6" /> Книга законов
          </DialogTitle>
          <DialogDescription className="text-[#8ea3b8]">
            {cooldown > 0 ? `Совет соберётся снова через ${Math.ceil(cooldown)} ч.` : 'Совет ждёт вашего указа. За раз можно подписать один закон.'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="hud-scroll">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {groups.map((g) => (
              <div key={g.id} className="hud-paper rounded p-4">
                <div className="hud-font text-lg uppercase tracking-widest">{g.title}</div>
                <div className="mb-3 text-xs italic opacity-80">{g.desc}</div>
                <div className="flex flex-col gap-2">
                  {LAWS.filter((l) => l.group === g.id).map((law) => {
                    const st = game.lawStatus(law.id)
                    return (
                      <div key={law.id} className={`rounded border border-[#8a7347]/50 p-2 ${st === 'signed' ? 'bg-[#8a7347]/25' : 'bg-white/20'} ${st === 'excluded' || st === 'locked' ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="hud-font text-sm uppercase">{law.name}</span>
                          {st === 'signed' && <span className="hud-font flex items-center gap-1 text-xs text-[#3c5a2a]"><Check className="h-3.5 w-3.5" />Подписан</span>}
                          {st === 'available' && (
                            <button type="button" className="hud-btn rounded px-2 py-0.5 text-xs" onClick={() => game.signLaw(law.id)}>Подписать</button>
                          )}
                          {st === 'cooldown' && <span className="flex items-center gap-1 text-xs"><Hourglass className="h-3.5 w-3.5" />Ожидание</span>}
                          {st === 'excluded' && <span className="flex items-center gap-1 text-xs"><XIcon className="h-3.5 w-3.5" />Исключён</span>}
                          {st === 'locked' && <span className="flex items-center gap-1 text-xs"><Lock className="h-3.5 w-3.5" />Закрыт</span>}
                        </div>
                        <div className="mt-1 text-xs leading-snug">{law.description}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

export function ResearchDialog() {
  const game = useGame()
  const s = game.state
  const open = game.ui.dialog === 'research'
  const tiers = [1, 2, 3, 4]
  const workshops = s.buildings.filter((b) => b.type === 'workshop' && b.built).length
  return (
    <Dialog open={open} onOpenChange={(o) => game.setUi({ dialog: o ? 'research' : null })}>
      <DialogContent className="hud-dialog hud-root max-w-5xl">
        <DialogHeader>
          <DialogTitle className="hud-font flex items-center gap-2 text-2xl uppercase tracking-widest text-[#8ec5ff]">
            <FlaskConical className="h-6 w-6" /> Технологии
          </DialogTitle>
          <DialogDescription className="text-[#8ea3b8]">
            {workshops === 0
              ? 'Постройте мастерскую и назначьте туда инженеров, чтобы исследовать технологии.'
              : `Мастерских: ${workshops} · ${s.stats.researchPerHour.toFixed(1)} очков/ч во время смены.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="hud-scroll">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiers.map((t) => (
              <div key={t} className="flex flex-col gap-2">
                <div className="hud-title text-center text-xs">Уровень {t}</div>
                {RESEARCH.filter((r) => r.tier === t).map((r) => {
                  const st = game.researchStatus(r.id)
                  const pct = st === 'active' ? Math.min(100, (s.researchProgress / r.points) * 100) : st === 'done' ? 100 : 0
                  return (
                    <div
                      key={r.id}
                      className={`rounded border p-2 ${st === 'done' ? 'border-[#7fd38f]/60 bg-[#7fd38f]/10' : st === 'active' ? 'border-[#8ec5ff] bg-[#8ec5ff]/10' : 'border-white/15 bg-black/30'} ${st === 'locked' ? 'opacity-50' : ''}`}
                    >
                      <div className="hud-font text-sm">{r.name}</div>
                      <div className="mt-0.5 text-[11px] leading-snug text-[#cdd8e4]">{r.description}</div>
                      <div className="mt-1 text-[11px] text-[#8ea3b8]">
                        {r.points} очк. · дерево {r.cost.wood ?? 0}{r.cost.steel ? ` · сталь ${r.cost.steel}` : ''}
                        {r.requires && st === 'locked' && ` · нужно: ${RESEARCH.find((x) => x.id === r.requires)?.name}`}
                      </div>
                      <div className="hud-bar-track mt-1.5 h-1.5 overflow-hidden rounded-sm">
                        <div className="h-full bg-[#8ec5ff]" style=undefined />
                      </div>
                      {st === 'available' && (
                        <button type="button" disabled={!!s.researching} className="hud-btn mt-1.5 w-full rounded py-1 text-xs" onClick={() => game.startResearch(r.id)}>
                          Исследовать
                        </button>
                      )}
                      {st === 'unaffordable' && <div className="mt-1 text-[11px] text-[#ff6b55]">Не хватает материалов</div>}
                      {st === 'done' && <div className="hud-font mt-1 text-[11px] text-[#7fd38f]">Завершено</div>}
                      {st === 'active' && <div className="hud-font mt-1 text-[11px] text-[#8ec5ff]">В процессе</div>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
