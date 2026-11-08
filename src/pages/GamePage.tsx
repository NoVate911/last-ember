import { useEffect, useRef, useState } from 'react'
import { Flame, FolderOpen, Play } from 'lucide-react'
import { TooltipProvider } from '../lib/shadcn/tooltip'
import { GAME_SUBTITLE, GAME_TITLE } from '../game/data'
import { Game } from '../game/engine'
import { WorldRenderer } from '../game/render/world'
import { latestSave, loadGame } from '../game/save'
import './game/game.css'
import { BottomHud } from './game/ui/BottomHud'
import { LawsDialog, ResearchDialog } from './game/ui/Dialogs'
import { MenuDialog } from './game/ui/MenuDialog'
import { EndScreen, EventDialog, LeftColumn } from './game/ui/Overlays'
import { HudScaler } from './game/ui/HudScaler'
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

function TitleScreen({ onStart, onContinue }: { onStart: () => void; onContinue: () => void }) {
  const game = useGame()
  const last = latestSave()
  return (
    <div className="hud-title-screen absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 p-6 text-center">
      <Flame className="h-14 w-14 text-[#ffad4a] drop-shadow-[0_0_18px_rgba(255,173,74,0.8)]" />
      <div>
        <h1 className="hud-font text-6xl font-bold uppercase tracking-[0.35em] text-[#e6edf5] drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          {GAME_TITLE}
        </h1>
        <p className="mt-2 text-lg italic text-[#cdd8e4]">{GAME_SUBTITLE}</p>
      </div>
      <div className="hud-panel max-w-2xl rounded-md p-5 text-left text-sm leading-relaxed">
        <p className="mb-3 italic">
          Мир замёрз. Восемьдесят выживших добрались до кратера, в котором стоит древний угольный генератор.
          Не дайте огню погаснуть, кормите и лечите людей и принимайте тяжёлые решения, чтобы провести их
          через надвигающуюся Великую бурю. Продержитесь до 21-го дня.
        </p>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 text-[#cdd8e4] md:grid-cols-2">
          <li>• Нажмите на <b>генератор</b>, чтобы разжечь его и задать мощность</li>
          <li>• Назначайте рабочих на <b>кучи</b> и в здания</li>
          <li>• На месте куч угля и металлолома стройте <b>шахты</b></li>
          <li>• Следите за <b>вместимостью складов</b></li>
          <li>• Выполняйте <b>задания</b> на панели слева</li>
          <li>• Подписывайте <b>законы</b>, исследуйте <b>технологии</b></li>
          <li>• Строят <b>свободные жители</b> — оставляйте людей без работы</li>
          <li>• <b>Маяк</b> шлёт разведчиков, <b>школа</b> растит инженеров</li>
          <li>• Хороните погибших — тела злят людей</li>
          <li>• ЛКМ-перетаскивание: поворот · ПКМ / WASD: сдвиг · Колесо: масштаб</li>
        </ul>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" className="hud-btn rounded px-10 py-3 text-lg" onClick={onStart}>
          Разжечь огонь
        </button>
        {last && (
          <button type="button" className="hud-btn flex items-center gap-2 rounded px-6 py-3 text-base" onClick={onContinue}>
            <Play className="h-4 w-4" /> Продолжить · день {last.day}
          </button>
        )}
        <button type="button" className="hud-btn flex items-center gap-2 rounded px-6 py-3 text-base" onClick={() => game.setUi({ dialog: 'menu' })}>
          <FolderOpen className="h-4 w-4" /> Загрузить
        </button>
      </div>
    </div>
  )
}

function GameShell() {
  const game = useGame()
  const [started, setStarted] = useState(false)

  const continueLatest = () => {
    const last = latestSave()
    const st = last ? loadGame(last.slot) : null
    if (!st) return
    game.load(st)
    setStarted(true)
  }

  return (
    <div className="hud-root fixed inset-0 overflow-hidden bg-[#0a1220]">
      <WorldView key={game.generation} />
      {started ? (
        <>
          <HudScaler>
            <TopBar />
            <LeftColumn />
            <SelectionPanel />
            <BottomHud />
          </HudScaler>
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
          onContinue={continueLatest}
        />
      )}
      <MenuDialog started={started} onLoaded={() => setStarted(true)} />
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
