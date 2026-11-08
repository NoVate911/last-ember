import {
  Axe, BedDouble, Beer, Boxes, Cross, Drumstick, Factory, FlaskConical, Heater, Hospital, House, Mountain,
  Pickaxe, Soup, Stethoscope, Swords, Tent, Warehouse, Cog, TreePine, Container, RadioTower, GraduationCap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../lib/shadcn/tooltip'
import type { BuildingType, ResourceKey } from '../../../game/types'

export const BUILDING_ICONS: Record<BuildingType, ReactNode> = {
  tent: <Tent className="h-6 w-6" />,
  bunkhouse: <BedDouble className="h-6 w-6" />,
  house: <House className="h-6 w-6" />,
  depot: <Warehouse className="h-6 w-6" />,
  drill: <Pickaxe className="h-6 w-6" />,
  coalMine: <Mountain className="h-6 w-6" />,
  oreMine: <Container className="h-6 w-6" />,
  sawmill: <Axe className="h-6 w-6" />,
  steelworks: <Factory className="h-6 w-6" />,
  warehouse: <Boxes className="h-6 w-6" />,
  coalStorage: <Warehouse className="h-6 w-6" />,
  lodge: <Drumstick className="h-6 w-6" />,
  canteen: <Soup className="h-6 w-6" />,
  aid: <Stethoscope className="h-6 w-6" />,
  hospital: <Hospital className="h-6 w-6" />,
  relay: <Heater className="h-6 w-6" />,
  cemetery: <Cross className="h-6 w-6" />,
  arena: <Swords className="h-6 w-6" />,
  pub: <Beer className="h-6 w-6" />,
  workshop: <FlaskConical className="h-6 w-6" />,
  beacon: <RadioTower className="h-6 w-6" />,
  school: <GraduationCap className="h-6 w-6" />,
}

export const RESOURCE_ICONS: Record<ResourceKey, ReactNode> = {
  coal: <Pickaxe className="h-4 w-4" />,
  wood: <TreePine className="h-4 w-4" />,
  steel: <Cog className="h-4 w-4" />,
  rawFood: <Drumstick className="h-4 w-4" />,
  rations: <Soup className="h-4 w-4" />,
}

/** HUD tooltip in the game's dark style. */
export function Tip({ label, children, side }: { label: ReactNode; children: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side ?? 'bottom'} className="hud-dialog max-w-[260px] border-0 text-xs">{label}</TooltipContent>
    </Tooltip>
  )
}
