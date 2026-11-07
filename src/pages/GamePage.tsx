import { useEffect, useRef, useState } from 'react'
import { Download, Flame } from 'lucide-react'
import { TooltipProvider } from '../lib/shadcn/tooltip'
import { GAME_SUBTITLE, GAME_TITLE } from '../game/data'
import { Game } from '../game/engine'
import { downloadProjectZip } from '../game/export/projectZip'
import { WorldRenderer } from '../game/render/world'
import './game/game.css'
import { BottomHud } from './game/ui/BottomHud'
import { LawsDialog, ResearchDialog } from './game/ui/Dialogs'
import { EndScreen, EventDialog, LogPanel } from './game/ui/Overlays'
import { SelectionPanel } from './game/ui/SelectionPanel'
import { TopBar } from './game/ui/TopBar'
import { GameContext, useGame } from './game/ui/useGame'

function WorldView() {
  const ref = useRef<HTMLDivElement>(null)
  const game = useGame()
  useEffect(() => {
    if (!ref.current) return
    const world = new WorldRenderer(ref.current, game)
    return () => world.dispose()
  }, [game])
  return <div ref={ref} className="absolute inset-0" />
}

function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="hud-title-screen absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 p-6 text-center">
      <Flame className="h-14 w-14 text-[#ffad4a] drop-shadow-[0_0_18px_rgba(255,173,74,0.8)]" />
      <div>
        <h1 className="hud-font text-6xl font-bold uppercase tracking-[0.35em] text-[#ece3cf] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          {GAME_TITLE}
        </h1>
        <p className="mt-2 text-lg italic text-[#cfc6b3]">{GAME_SUBTITLE}</p>
      </div>
      <div className="hud-panel hud-panel-rivets max-w-2xl rounded p-5 pt-6 text-left text-sm leading-relaxed">
        <p className="mb-3 italic">
          Мир замёрз. Восемьдесят выживших добрались до кратера, в котором стоит древний угольный генератор.
          Не дайте огню погаснуть, кормите и лечите людей и принимайте тяжёлые решения, чтобы провести их
          через надвигающуюся Великую бурю. Продержитесь до 21-го дня.
        </p>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-[#cfc6b3] md:grid-cols-2">
          <li>• Нажмите на <b>генератор</b>, чтобы разжечь его и задать мощность</li>
          <li>• Назначайте рабочих на <b>кучи</b> и в здания</li>
          <li>• Стройте дома ближе к теплу — смотрите <b>карту тепла</b></li>
          <li>• В 19:00 каждый съедает 1 паёк</li>
          <li>• В холодных домах и на холодной работе люди болеют</li>
          <li>• Подписывайте <b>законы</b>, исследуйте <b>технологии</b></li>
          <li>• Поддерживайте надежду и сдерживайте недовольство</li>
          <li>• ЛКМ-перетаскивание: поворот · ПКМ / WASD: сдвиг · Колесо: масштаб</li>
        </ul>
      </div>
      <button type="button" className="hud-btn rounded px-10 py-3 text-lg" onClick={onStart}>
        Разжечь огонь
      </button>
      <button
        type="button"
        className="hud-btn flex items-center gap-2 rounded px-4 py-1.5 text-xs"
        onClick={() => downloadProjectZip()}
      >
        <Download className="h-4 w-4" /> Скачать проект (.zip)
      </button>
    </div>
  )
}

function GameShell() {
  const game = useGame()
  const [started, setStarted] = useState(false)
  return (
    <div className="hud-root fixed inset-0 overflow-hidden bg-[#0a1220]">
      <WorldView key={game.generation} />
      {started ? (
        <>
          <TopBar />
          <LogPanel />
          <SelectionPanel />
          <BottomHud />
          <LawsDialog />
          <ResearchDialog />
          <EventDialog />
          <EndScreen />
        </>
      ) : (
        <TitleScreen
          onStart={() => {
            setStarted(true)
            game.setUi({ selected: { kind: 'generator' } })
            game.setSpeed(1)
          }}
        />
      )}
    </div>
  )
}

export default function GamePage() {
  const [game] = useState(() => new Game())
  return (
    <GameContext.Provider value={game}>
      <TooltipProvider delayDuration={200}>
        <GameShell />
      </TooltipProvider>
    </GameContext.Provider>
  )
}
