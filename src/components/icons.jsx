// SVG 아이콘 (이모지 금지 — 전부 SVG)

export function GavelIcon({ size = 18, color = '#201A16', width = 2.4 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round">
      <path d="M13 4 L20 11" /><path d="M9 8 L16 15" />
      <path d="M15 6 L11 10" /><path d="M4 20 L10 14" />
    </svg>
  )
}

export function TimerIcon({ size = 16, color = '#F7C948' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
      <circle cx="12" cy="13" r="8" /><path d="M12 13 L12 8" /><path d="M9 2 L15 2" />
    </svg>
  )
}

export function CoinIcon({ size = 14, color = '#201A16' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8.5 L12 15.5" strokeLinecap="round" />
      <path d="M9.5 10.5 L14.5 10.5" strokeLinecap="round" />
      <path d="M9.5 13.5 L14.5 13.5" strokeLinecap="round" />
    </svg>
  )
}

export function InfoIcon({ size = 14, color = '#8A7A6A' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 8 L12 13" />
      <circle cx="12" cy="16.5" r="0.6" fill={color} />
    </svg>
  )
}

export function DownloadIcon({ size = 14, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
      <path d="M12 3 L12 15" /><path d="M7 10 L12 15 L17 10" /><path d="M4 20 L20 20" />
    </svg>
  )
}

export function RefreshIcon({ size = 14, color = '#201A16' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round">
      <path d="M20 12 A8 8 0 1 1 12 4" /><path d="M20 4 L20 10 L14 10" />
    </svg>
  )
}

export function ScaleIcon({ size = 11, color = '#F7C948' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round">
      <path d="M12 3 L12 21" /><path d="M5 8 L19 8" />
      <path d="M7 8 L5 14 L9 14 Z" /><path d="M17 8 L15 14 L19 14 Z" />
    </svg>
  )
}

export function CopyIcon({ size = 14, color = '#201A16' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15 L4 15 A1.5 1.5 0 0 1 2.5 13.5 L2.5 4 A1.5 1.5 0 0 1 4 2.5 L13.5 2.5 A1.5 1.5 0 0 1 15 4 L15 5" transform="translate(1.5 1.5)" />
    </svg>
  )
}

export function CheckIcon({ size = 14, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round">
      <path d="M4 12.5 L9.5 18 L20 6.5" />
    </svg>
  )
}

export function BoltIcon({ size = 16, color = '#E5484D' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 L5 13.5 L11 13.5 L10 22 L19 9.5 L12.5 9.5 Z" />
    </svg>
  )
}
