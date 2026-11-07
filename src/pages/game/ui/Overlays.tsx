import { Flame, RotateCcw, Snowflake } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../lib/shadcn/dialog'
import { formatTime } from '../../../game/data'
import { useGame } from './useGame'

export function EventDialog() {
  const game = useGame()
  const ev = game.state.pendingEvent
  return (
    <Dialog open={!!ev && game.state.status === 'playing'} onOpenChange={() => undefined}>
      <DialogContent
        className="hud-dialog hud-root max-w-xl"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {ev && (
          <>
            <DialogHeader>
              <DialogTitle className="hud-font text-2xl uppercase tracking-widest text-[#ffad4a]">{ev.title}</DialogTitle>
              <DialogDescription className="pt-2 text-base italic leading-relaxed text-[#ece3cf]">{ev.text}</DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-2">
                {ev.choices.map((c) => (
                  <button key={c.action + c.label} type="button" className="hud-btn rounded px-3 py-2 text-left normal-case" onClick={() => game.chooseEvent(c.action)}>
                    <div className="text-sm">{c.label}</div>
                    <div className="text-xs text-[#a59c8a]">{c.hint}</div>
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
  const entries = game.state.log.slice(0, 6)
  const tone = { info: 'text-[#ece3cf]', good: 'text-[#7fd38f]', warn: 'text-[#f2d27a]', bad: 'text-[#ff6b55]' }
  return (
    <div className="pointer-events-none absolute left-3 top-40 flex w-72 flex-col gap-1">
      {entries.map((e, i) => (
        <div key={e.id} className="hud-panel rounded px-2 py-1 text-xs" style={{ opacity: 1 - i * 0.13 }}>
          <span className="hud-font mr-1 text-[10px] text-[#a59c8a]">{formatTime(e.time).clock}</span>
          <span className={tone[e.tone]}>{e.text}</span>
        </div>
      ))}
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
      <div className="hud-panel hud-panel-rivets flex max-w-lg flex-col items-center gap-4 rounded p-8 text-center">
        {won ? <Flame className="h-12 w-12 text-[#ffad4a]" /> : <Snowflake className="h-12 w-12 text-[#8ec5ff]" />}
        <div className={`hud-font text-4xl uppercase tracking-[0.2em] ${won ? 'text-[#ffad4a]' : 'text-[#8ec5ff]'}`}>
          {won ? 'Город выстоял' : 'Огонь погас'}
        </div>
        <p className="text-lg italic">{s.endReason}</p>
        <div className="hud-font grid grid-cols-3 gap-4 text-sm">
          <div><div className="text-[#a59c8a]">День</div><div className="text-xl">{formatTime(s.time).day}</div></div>
          <div><div className="text-[#a59c8a]">Выжило</div><div className="text-xl">{game.population}</div></div>
          <div><div className="text-[#a59c8a]">Погибло</div><div className="text-xl">{s.deaths}</div></div>
        </div>
        <button type="button" className="hud-btn flex items-center gap-2 rounded px-5 py-2" onClick={() => game.restart()}>
          <RotateCcw className="h-4 w-4" /> Новый город
        </button>
      </div>
    </div>
  )
}
