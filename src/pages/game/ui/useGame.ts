import { useCallback, createContext, useContext, useSyncExternalStore } from 'react'
import type { Game } from '../../../game/engine'

export const GameContext = createContext<Game | null>(null)

/** Returns the game instance and re-renders whenever the simulation changes. */
export function useGame(): Game {
  const game = useContext(GameContext)
  if (!game) throw new Error('useGame must be used inside GameContext')
  // Stable subscribe so React doesn't resubscribe on every render
  const subscribe = useCallback((cb: () => void) => game.subscribe(cb), [game])
  const getSnapshot = useCallback(() => game.version, [game])
  useSyncExternalStore(subscribe, getSnapshot)
  return game
}

export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('ru-RU')
}
