// The three layers as the app names them, with an icon and the caption shown for a moment after picking one.

import type { ReactNode } from 'react'
import type { LayerName } from '../anatomy/depth.ts'
import { ApartIcon, MuscleIcon, OrganIcon } from './icons.tsx'

export const LAYERS: Record<LayerName, { label: string; icon: ReactNode; caption: string }> = {
  muscles: { label: 'Mięśnie', icon: <MuscleIcon />, caption: 'Mięśnie tuż pod skórą' },
  organs: { label: 'Narządy', icon: <OrganIcon />, caption: 'Narządy i kości we wnętrzu ciała' },
  exploded: { label: 'Osobno', icon: <ApartIcon />, caption: 'Narządy rozsunięte, żeby łatwo je wybrać' },
}
