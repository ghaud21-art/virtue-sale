import { C, tagMeta } from '../lib/meta'

// 네오브루탈 공통 컴포넌트

export function Card({ children, style }) {
  return (
    <div style={{ background: C.paper, border: `2px solid ${C.ink}`, borderRadius: 20, padding: 24, ...style }}>
      {children}
    </div>
  )
}

export function PrimaryBtn({ children, onClick, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: disabled ? C.faint : C.orange, color: '#fff',
      border: `2px solid ${C.ink}`, borderRadius: 14, padding: 15,
      fontWeight: 700, fontSize: 16, boxShadow: disabled ? 'none' : `0 3px 0 ${C.ink}`,
      cursor: disabled ? 'not-allowed' : 'pointer', ...style,
    }}>{children}</button>
  )
}

export function GhostBtn({ children, onClick, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: '#fff', border: `2px solid ${C.ink}`, borderRadius: 10,
      padding: '9px 18px', fontWeight: 700, fontSize: 13,
      opacity: disabled ? .5 : 1, cursor: disabled ? 'not-allowed' : 'pointer', ...style,
    }}>{children}</button>
  )
}

export function TagPill({ tag, onClick, style }) {
  const m = tagMeta(tag)
  return (
    <span onClick={onClick} style={{
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
      border: `1.5px solid ${C.ink}`, whiteSpace: 'nowrap', flexShrink: 0,
      background: m.bg, cursor: onClick ? 'pointer' : 'default', userSelect: 'none', ...style,
    }}>{m.label}</span>
  )
}

export function LiveDot({ label = '실시간', color = C.red, size = 8, fontSize = 12 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize, fontWeight: 700, color }}>
      <span style={{ width: size, height: size, borderRadius: '50%', background: color, animation: 'blinkred 1.2s infinite' }} />
      {label}
    </span>
  )
}

export function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

export const inputStyle = {
  width: '100%', boxSizing: 'border-box', border: `2px solid ${C.ink}`,
  borderRadius: 12, padding: 14, fontSize: 16,
}

export function ErrorNote({ children }) {
  if (!children) return null
  return (
    <div className="shake" style={{ fontSize: 12, fontWeight: 700, color: C.red, padding: '0 4px' }}>
      {children}
    </div>
  )
}

export function InfoNote({ children, style }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, background: C.bg,
      border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '10px 14px',
      fontSize: 12, color: C.muted, ...style,
    }}>{children}</div>
  )
}
