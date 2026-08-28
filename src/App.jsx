import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { C } from './lib/meta'
import { hasSupabaseConfig } from './lib/supabase'
import { GavelIcon } from './components/icons'
import Home from './pages/Home'
import Teacher from './pages/Teacher'
import Student from './pages/Student'
import Board from './pages/Board'

function Header() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '14px 24px', borderBottom: `2px solid ${C.ink}`, background: C.bg,
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: C.ink }}>
        <div style={{
          width: 34, height: 34, borderRadius: '50%', background: C.orange,
          border: `2px solid ${C.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <GavelIcon />
        </div>
        <div>
          <div className="bhs" style={{ fontSize: 18, lineHeight: 1 }}>가치 경매</div>
          <div style={{ fontSize: 11, color: C.muted }}>학습용 실시간 가치경매 게임</div>
        </div>
      </Link>
    </div>
  )
}

function ConfigMissing() {
  return (
    <div style={{ maxWidth: 640, margin: '80px auto', padding: 24 }}>
      <div style={{ background: '#fff', border: `2px solid ${C.ink}`, borderRadius: 20, padding: 32 }}>
        <div className="bhs" style={{ fontSize: 24, marginBottom: 12 }}>Supabase 설정이 필요합니다</div>
        <div style={{ fontSize: 14, lineHeight: 1.7, color: C.muted }}>
          프로젝트 루트에 <code>.env</code> 파일을 만들고 아래 값을 채운 뒤 다시 실행하세요.
          <pre style={{
            background: C.bg, border: `1.5px solid ${C.line}`, borderRadius: 12,
            padding: 16, fontSize: 13, overflow: 'auto', color: C.ink,
          }}>{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}</pre>
          그리고 <code>supabase/schema.sql</code>을 Supabase SQL Editor에서 실행해 주세요.
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const loc = useLocation()
  const isBoard = loc.pathname.startsWith('/board')
  return (
    <div style={{ minHeight: '100vh', background: isBoard ? C.darkBg : C.bg }}>
      <Header />
      {!hasSupabaseConfig ? <ConfigMissing /> : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/teacher" element={<Teacher />} />
          <Route path="/student" element={<Student />} />
          <Route path="/board" element={<Board />} />
        </Routes>
      )}
    </div>
  )
}
