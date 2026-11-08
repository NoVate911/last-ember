import { Download, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../../lib/shadcn/dialog'
import { SAVE_SLOTS, type SaveSlot, deleteSave, listSaves, loadGame } from '../../../game/save'
import { useGame } from './useGame'

const SLOT_LABEL: Record<SaveSlot, string> = { auto: 'Автосохранение', '1': 'Слот 1', '2': 'Слот 2', '3': 'Слот 3' }

/** Save / load / new game menu. Works from the title screen too. */
export function MenuDialog({ started, onLoaded }: { started: boolean; onLoaded: () => void }) {
  const game = useGame()
  const open = game.ui.dialog === 'menu'
  const saves = listSaves()

  const load = (slot: SaveSlot) => {
    const st = loadGame(slot)
    if (!st) return
    game.load(st)
    onLoaded()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => game.setUi({ dialog: o ? 'menu' : null })}>
      <DialogContent className="hud-dialog hud-root max-w-lg">
        <DialogHeader>
          <DialogTitle className="hud-font text-2xl uppercase tracking-widest text-[#ffad4a]">Меню</DialogTitle>
          <DialogDescription className="text-[#8ea3b8]">
            Сохранения хранятся в этом браузере. Автосохранение — каждое утро в 06:00.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="hud-scroll">
          <div className="flex flex-col gap-2">
            {SAVE_SLOTS.map((slot) => {
              const meta = saves[slot]
              return (
                <div key={slot} className="flex items-center gap-3 rounded border border-white/15 bg-black/30 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="hud-font text-sm uppercase">{SLOT_LABEL[slot]}</div>
                    <div className="text-xs text-[#8ea3b8]">
                      {meta
                        ? `День ${meta.day}, ${meta.clock} · ${meta.pop} жит. · ${new Date(meta.savedAt).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}`
                        : 'Пусто'}
                    </div>
                  </div>
                  {started && slot !== 'auto' && game.state.status === 'playing' && (
                    <button type="button" aria-label={`Сохранить в ${SLOT_LABEL[slot]}`} className="hud-btn flex h-8 items-center gap-1 rounded px-2 text-xs" onClick={() => game.save(slot)}>
                      <Save className="h-3.5 w-3.5" /> Сохр.
                    </button>
                  )}
                  <button type="button" aria-label={`Загрузить ${SLOT_LABEL[slot]}`} disabled={!meta} className="hud-btn flex h-8 items-center gap-1 rounded px-2 text-xs" onClick={() => load(slot)}>
                    <Download className="h-3.5 w-3.5" /> Загр.
                  </button>
                  {meta && slot !== 'auto' && (
                    <button type="button" aria-label={`Удалить ${SLOT_LABEL[slot]}`} className="hud-btn flex h-8 w-8 items-center justify-center rounded" onClick={() => { deleteSave(slot); game.emit(true) }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
            {started && (
              <button type="button" className="hud-btn mt-2 flex items-center justify-center gap-2 rounded py-2 text-sm" onClick={() => game.restart()}>
                <RotateCcw className="h-4 w-4" /> Новая игра
              </button>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
