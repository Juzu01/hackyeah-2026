// Line icons for the atlas chrome: 24px grid, 1.6px strokes, currentColor.

import type { ReactNode } from 'react'

function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Turning round a vertical axis: front ↔ back. */
export const FlipIcon = () => (
  <Icon>
    <path d="M12 3v18" strokeDasharray="2 2.6" opacity="0.7" />
    <path d="M17.5 8.2C20 9 21.5 10.4 21.5 12c0 2.5-4.3 4.6-9.5 4.6S2.5 14.5 2.5 12c0-1.6 1.5-3 4-3.8" />
    <path d="m10 14.4 2 2.2-2 2.2" />
  </Icon>
)

export const InfoIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.6v.1" strokeWidth="1.9" />
  </Icon>
)

export const CloseIcon = () => (
  <Icon size={20}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const ChevronIcon = ({ up = false }: { up?: boolean }) => (
  <Icon size={18}>
    <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
  </Icon>
)

/** iOS's share symbol: a box with an arrow out of the top. */
export const ShareIcon = () => (
  <Icon size={18}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M8 11H6v10h12V11h-2" />
  </Icon>
)

export const RotateIcon = () => (
  <Icon>
    <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" />
    <path d="M18 3v4h-4M6 21v-4h4" />
  </Icon>
)

export const PinchIcon = () => (
  <Icon>
    <circle cx="9.5" cy="14.5" r="1.8" />
    <circle cx="14.5" cy="9.5" r="1.8" />
    <path d="M7.6 16.4 4 20M4 17v3h3M16.4 7.6 20 4M17 4h3v3" />
  </Icon>
)

export const TapIcon = () => (
  <Icon>
    <circle cx="12" cy="10" r="2.2" />
    <path d="M12 3.5v1.6M18.5 10h-1.6M5.5 10h1.6M16.6 5.4l-1.1 1.1M7.4 5.4l1.1 1.1" />
    <path d="M12 14v6" opacity="0.6" />
  </Icon>
)

export const DoubleTapIcon = () => (
  <Icon>
    <circle cx="12" cy="11" r="2.2" />
    <circle cx="12" cy="11" r="5.5" opacity="0.6" />
    <path d="M12 18v3" opacity="0.6" />
  </Icon>
)

export const InstallIcon = () => (
  <Icon size={20}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
    <path d="M5 19h14" />
  </Icon>
)

export const SearchIcon = () => (
  <Icon>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </Icon>
)

/** Layer icons: a muscle's spindle of fibres, a heart, and pieces set apart. */
export const MuscleIcon = () => (
  <Icon size={18}>
    <path d="M12 3c3.2 3 3.2 15 0 18-3.2-3-3.2-15 0-18z" />
    <path d="M12 6v12M10 8.5c.6 2.5.6 4.5 0 7M14 8.5c-.6 2.5-.6 4.5 0 7" opacity="0.7" />
  </Icon>
)

export const OrganIcon = () => (
  <Icon size={18}>
    <path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z" />
  </Icon>
)

export const ApartIcon = () => (
  <Icon size={18}>
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="3" width="7" height="7" rx="2" />
    <rect x="8.5" y="14" width="7" height="7" rx="2" />
  </Icon>
)

/** The two bodies: the Venus and Mars signs, as in medicine and biology. */
export const FemaleIcon = () => (
  <Icon size={18}>
    <circle cx="12" cy="9" r="5" />
    <path d="M12 14v7.5M8.8 18.2h6.4" />
  </Icon>
)

export const MaleIcon = () => (
  <Icon size={18}>
    <circle cx="10" cy="14" r="5" />
    <path d="m13.6 10.4 6.4-6.4M15 4h5v5" />
  </Icon>
)

/** The voice button's microphone: heavier, it sits on the lamp-lit disc. */
export const MicIcon = ({ size = 28 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="9" y="3" width="6" height="11.5" rx="3" fill="currentColor" stroke="none" />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
  </svg>
)

export const StopIcon = ({ size = 22 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
  </svg>
)

export const SendIcon = () => (
  <Icon size={20}>
    <path d="M12 19V5M6 11l6-6 6 6" strokeWidth="2" />
  </Icon>
)

export const SpeakerIcon = ({ off = false }: { off?: boolean }) => (
  <Icon size={20}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {off ? <path d="m16 9.5 5 5M21 9.5l-5 5" /> : <path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />}
  </Icon>
)

export const PhoneIcon = () => (
  <Icon size={20}>
    <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />
  </Icon>
)

/** The part card's "Więcej": what it does, how it's built, exercises, a fact, sport, and a closer look. */
export const ActionIcon = () => (
  <Icon size={18}>
    <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />
  </Icon>
)

export const BuildIcon = () => (
  <Icon size={18}>
    <path d="M12 3.5 3 8.5l9 5 9-5z" />
    <path d="m3 13 9 5 9-5" />
  </Icon>
)

export const ExerciseIcon = () => (
  <Icon size={18}>
    <path d="M3 9.5v5M6.5 7v10M17.5 7v10M21 9.5v5M6.5 12h11" />
  </Icon>
)

export const FactIcon = () => (
  <Icon size={18}>
    <path d="M9.5 18h5M10.5 21h3" />
    <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
  </Icon>
)

export const HealthIcon = () => (
  <Icon size={18}>
    <path d="M3 12.5h4l2.2-5 3.6 10 2.2-5H21" />
  </Icon>
)

export const ZoomInIcon = () => (
  <Icon size={20}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5M10.5 7.8v5.4M7.8 10.5h5.4" />
  </Icon>
)
