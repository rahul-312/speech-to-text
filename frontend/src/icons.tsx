import type { SVGProps } from 'react'

const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2,
  strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
type P = SVGProps<SVGSVGElement>

export const Wave = (p: P) => (
  <svg {...base} strokeWidth={2.4} {...p}><path d="M2 11.5v1M6.5 8v8M12 3v18M17.5 8v8M22 11.5v1" /></svg>
)
export const Mic = (p: P) => (
  <svg {...base} {...p}>
    <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
  </svg>
)
export const Clock = (p: P) => (
  <svg {...base} {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3.5 2" /></svg>
)
export const Letter = (p: P) => (
  <svg {...base} {...p}><path d="M5 7V4h14v3M12 4v16M9 20h6" /></svg>
)
export const Square = (p: P) => (
  <svg {...base} {...p}><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>
)
export const Page = (p: P) => (
  <svg viewBox="0 0 84 64" fill="none" strokeWidth={2.5} strokeLinecap="round" aria-hidden="true" {...p}>
    <rect x="3" y="5" width="56" height="48" rx="5" stroke="#a5a9b8" />
    <path d="M14 18h34M14 28h34M14 38h22" stroke="#a5a9b8" />
    <path d="M68 3l2 5M80 4l-6 6M76 15h6" stroke="#0b6b4f" />
    <circle cx="66" cy="48" r="13" fill="#0b6b4f" />
    <path d="M60 47v2M64 44v8M68 42v12M72 47v2" stroke="#fff" strokeWidth={2} />
  </svg>
)
export const Waves = () => (
  <svg viewBox="0 0 1400 660" preserveAspectRatio="none" aria-hidden="true"
    className="pointer-events-none fixed inset-0 -z-10 h-full w-full" fill="#0b6b4f" fillOpacity=".055">
    <path d="M0 0h460C350 20 340 110 250 135S60 120 0 210Z" />
    <path d="M0 0h400C330 60 320 85 200 90S40 100 0 130Z" fillOpacity=".03" />
    <linearGradient id="wave-fade" x1="0" y1="85" x2="0" y2="330" gradientUnits="userSpaceOnUse">
      <stop stopColor="#0b6b4f" />
      <stop offset=".45" stopColor="#0b6b4f" stopOpacity=".7" />
      <stop offset="1" stopColor="#0b6b4f" stopOpacity="0" />
    </linearGradient>
    <path d="M1400 85C1270 60 1150 130 1110 250C1100 280 1092 305 1090 330H1400Z" fill="url(#wave-fade)" />
    <path d="M900 660c70-90 160-60 240-75s120-130 260-145v220Z" />
  </svg>
)
export const Chevron = (p: P) => (
  <svg {...base} {...p}><path d="M9 6l6 6-6 6" /></svg>
)
