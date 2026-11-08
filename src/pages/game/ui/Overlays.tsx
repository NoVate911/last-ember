import { Check, Flame, RotateCcw, Snowflake, Square, Users } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../lib/shadcn/dialog'
import { formatTime } from '../../../game/data'
import { STAGES, currentStage } from '../../../game/objectives'
import { useGame } from './useGame'

export function EventDialog() {
  const game = useGame()
  const ev = game.state.pendingEvent
  return (
    <Dialog open={!!ev && game.state.status === 'playing'} onOpenChange={() => undefined}>
      <DialogContent
        className="hud-dialog hud-dialog-locked hud-root max-w-xl"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {ev && (
          <>
            <DialogHeader>
              <DialogTitle className="hud-font text-2xl uppercase tracking-widest text-[#ffad4a]">{ev.title}</DialogTitle>
              <DialogDescription className="whitespace-pre-line pt-2 text-base italic leading-relaxed text-[#e6edf5]">{ev.text}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-2">
                {ev.choices.map((c) => (
                  <button key={c.action + c.label} type="button" className="hud-btn rounded px-3 py-2 text-left normal-case" onClick={() => game.chooseEvent(c.action)}>
                    <div className="text-sm">{c.label}</div>
                    <div className="text-xs text-[#8ea3b8]">{c.hint}</div>
                  </button>
                ))}
              </div>
            </DialogBody>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function LogPanel() {
  const game = useGame()
  const entries = game.state.log.slice(0, 5)
  const tone = { info: 'text-[#e6edf5]', good: 'text-[#7fd38f]', warn: 'text-[#f2d27a]', bad: 'text-[#ff6b55]' }
  return (
    <div className="flex flex-col gap-1">
      {entries.map((e, i) => (
        <div key={e.id} className="hud-panel rounded px-2 py-1 text-xs" style={{ opacity: 1 - i * 0.15 }}>
          <span className="hud-font mr-1 text-[10px] text-[#8ea3b8]">{formatTime(e.time).clock}</span>
          <span className={tone[e.tone]}>{e.text}</span>
        </div>
      ))}
    </div>
  )
}

/** Scenario objectives, styled like Frostpunk's faction/quest panel. */
export function ObjectivesPanel() {
  const game = useGame()
  const s = game.state
  const stage = currentStage(s)
  const stageIdx = stage ? STAGES.indexOf(stage) : STAGES.length
  return (
    <div className="hud-panel pointer-events-auto rounded-md">
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
        <div className="hud-font flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[#ff6b55] bg-[#5a1a12] text-base shadow-[0_0_10px_rgba(255,107,85,0.45)]">
          {game.population}
        </div>
        <div className="min-w-0 flex-1">
          <div className="hud-font flex items-center gap-1.5 text-sm uppercase tracking-[0.18em]"><Users className="h-3.5 w-3.5 text-[#8ea3b8]" />Выжившие</div>
          <div className="text-[11px] text-[#8ea3b8]">Этап {Math.min(stageIdx + 1, STAGES.length)} из {STAGES.length}</div>
        </div>
      </div>
      {stage ? (
        <div className="px-3 pb-3 pt-2">
          <div className="hud-font text-sm uppercase text-[#ffad4a]">{stage.title}</div>
          <div className="mb-2 text-[11px] italic text-[#8ea3b8]">{stage.subtitle}</div>
          <div className="flex flex-col gap-1">
            {stage.objectives.map((o) => {
              const done = s.objectivesDone.includes(o.id)
              return (
                <div key={o.id} className={`flex items-start gap-2 rounded px-1.5 py-1 text-xs ${done ? 'bg-[#7fd38f]/10 text-[#8ea3b8] line-through' : 'bg-black/30'}`}>
                  {done ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7fd38f]" /> : <Square className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#8ea3b8]" />}
                  <span className="flex-1 leading-snug">{o.text}</span>
                  {!done && o.progress && <span className="hud-font text-[11px] text-[#ffad4a]">{o.progress(s)}</span>}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="px-3 py-3 text-xs text-[#7fd38f]">Все задания выполнены. Продержитесь до конца бури!</div>
      )}
    </div>
  )
}

export function LeftColumn() {
  return (
    <div className="pointer-events-none absolute bottom-[112px] left-3 top-[72px] flex w-[300px] flex-col gap-3">
      <LogPanel />
      <div className="mt-auto">
        <ObjectivesPanel />
      </div>
    </div>
  )
}

export function EndScreen() {
  const game = useGame()
  const s = game.state
  if (s.status === 'playing') return null
  const won = s.status === 'won'
  return (
    <div className="hud-title-screen absolute inset-0 z-40 flex items-center justify-center">
      <div className="hud-panel flex max-w-lg flex-col items-center gap-4 rounded-md p-8 text-center">
        {won ? <Flame className="h-12 w-12 text-[#ffad4a]" /> : <Snowflake className="h-12 w-12 text-[#8ec5ff]" />}
        <div className={`hud-font text-4xl uppercase tracking-[0.2em] ${won ? 'text-[#ffad4a]' : 'text-[#8ec5ff]'}`}>
          {won ? 'Город выстоял' : 'Огонь погас'}
        </div>
        <p className="text-lg italic">{s.endReason}</p>
        <div className="hud-font grid grid-cols-4 gap-4 text-sm">
          <div><div className="text-[#8ea3b8]">День</div><div className="text-xl">{formatTime(s.time).day}</div></div>
          <div><div className="text-[#8ea3b8]">Выжило</div><div className="text-xl">{game.population}</div></div>
          <div><div className="text-[#8ea3b8]">Погибло</div><div className="text-xl">{s.deaths}</div></div>
          <div><div className="text-[#8ea3b8]">Задания</div><div className="text-xl">{s.objectivesDone.length}</div></div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="hud-btn flex items-center gap-2 rounded px-5 py-2" onClick={() => game.restart()}>
            <RotateCcw className="h-4 w-4" /> Новый город
          </button>
          <button type="button" className="hud-btn rounded px-5 py-2" onClick={() => game.setUi({ dialog: 'menu' })}>
            Загрузить
          </button>
        </div>
      </div>
    </div>
  )
}
