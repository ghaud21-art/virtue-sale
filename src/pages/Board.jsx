import { useState, useMemo, useEffect, useRef } from 'react'
import { C, fmt, tagMeta, timeStr } from '../lib/meta'
import { api, session } from '../lib/api'
import { useClassData, useServerClock, useCountdown } from '../hooks/useClassData'
import { LiveDot } from '../components/ui'
import { GavelIcon } from '../components/icons'

const MODES = [
  ['live', '경매 LIVE'], ['reveal', '반전 연출'], ['stand', '낙찰 현황판'],
]

export default function Board() {
  const teacherSession = session.loadTeacher()
  const studentSession = session.loadStudent()
  const [classId, setClassId] = useState(teacherSession?.classId || studentSession?.classId || null)
  const [mode, setMode] = useState('live')
  const [revealOn, setRevealOn] = useState(false)

  const data = useClassData(classId)
  const { serverNow } = useServerClock()

  useEffect(() => {
    if (data.klass?.status === 'twist' || data.klass?.status === 'done') {
      setMode(m => m === 'stand' ? m : 'reveal')
    }
  }, [data.klass?.status])

  if (!classId) return <NoClassScreen onSet={setClassId} />

  return (
    <div style={{ background: C.darkBg, minHeight: 'calc(100vh - 65px)', padding: '26px 32px 60px', color: C.bg, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 26 }}>
        {MODES.map(([k, label]) => (
          <button key={k} onClick={() => { setMode(k); if (k !== 'reveal') setRevealOn(false) }} style={{
            padding: '8px 18px', borderRadius: 999, border: `2px solid ${C.yellow}`, fontWeight: 700,
            fontSize: 13, whiteSpace: 'nowrap', background: mode === k ? C.yellow : 'transparent',
            color: mode === k ? C.ink : C.yellow,
          }}>{label}</button>
        ))}
      </div>
      {data.loading ? <div style={{ textAlign: 'center', color: C.faint, padding: 100 }}>불러오는 중...</div> : (
        <>
          {mode === 'live' && <LiveMode items={data.items} bids={data.bids} students={data.students} serverNow={serverNow} />}
          {mode === 'reveal' && <RevealMode items={data.items} students={data.students} revealOn={revealOn} setRevealOn={setRevealOn} schoolBadge={data.klass?.school_badge_enabled ?? true} />}
          {mode === 'stand' && <StandMode items={data.items} students={data.students} />}
        </>
      )}
    </div>
  )
}

function NoClassScreen({ onSet }) {
  const [code, setCode] = useState('')
  return (
    <div style={{ background: C.darkBg, minHeight: 'calc(100vh - 65px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: 'center', color: C.bg }}>
        <div style={{ width: 56, height: 56, margin: '0 auto 16px', borderRadius: '50%', background: C.orange, border: `2px solid ${C.yellow}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GavelIcon color="#201A16" />
        </div>
        <div className="bhs" style={{ fontSize: 24, marginBottom: 10 }}>표시할 반이 없습니다</div>
        <div style={{ fontSize: 13, color: C.faint, marginBottom: 20, lineHeight: 1.7 }}>
          이 기기에서 교사 또는 학생으로 먼저 입장했다면 자동으로 연결됩니다. 반 코드를 직접 입력해 전광판을 열 수도 있어요.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="반 코드"
            style={{ border: `2px solid ${C.yellow}`, background: 'transparent', color: C.bg, borderRadius: 10, padding: '10px 14px', fontSize: 16, fontWeight: 700, letterSpacing: '.15em', textAlign: 'center', width: 140 }} />
        </div>
        <button onClick={async () => {
          if (!code.trim()) return
          try {
            const k = await api.fetchClassByCode(code)
            if (!k) return alert('반 코드를 찾을 수 없습니다')
            onSet(k.id)
          } catch (e) { alert(e.message) }
        }} style={{ marginTop: 14, background: C.yellow, color: C.ink, border: 'none', borderRadius: 12, padding: '12px 28px', fontWeight: 700, fontSize: 14 }}>전광판 열기</button>
      </div>
    </div>
  )
}

// ---------------- 경매 LIVE ----------------

function LiveMode({ items, bids, students, serverNow }) {
  const active = useMemo(() => items.find(i => i.status === 'active'), [items])
  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students])
  const itemBids = useMemo(() => active ? bids.filter(b => b.item_id === active.id).sort((a, b) => b.amount - a.amount || new Date(a.created_at) - new Date(b.created_at)) : [], [bids, active])
  const topBid = itemBids[0]
  const remaining = useCountdown(active?.countdown_until, serverNow)
  const cdRunning = active?.countdown_until && remaining !== null && remaining > 0.05

  const lastSoldId = useRef(undefined) // undefined = 아직 초기 로드 안 됨
  const [burst, setBurst] = useState(null)
  useEffect(() => {
    const mostRecentSold = items.filter(i => i.status === 'sold').sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
    if (!mostRecentSold) return
    const isFirstLoad = lastSoldId.current === undefined
    if (mostRecentSold.id !== lastSoldId.current) {
      lastSoldId.current = mostRecentSold.id
      if (!isFirstLoad) {
        setBurst(mostRecentSold)
        const t = setTimeout(() => setBurst(null), 2600)
        return () => clearTimeout(t)
      }
    }
  }, [items])

  if (!active) {
    return (
      <div style={{ maxWidth: 900, margin: '80px auto', textAlign: 'center', border: `2px solid ${C.darkLine}`, borderRadius: 28, padding: '60px 30px' }}>
        <div className="bhs" style={{ fontSize: 40, color: C.faint }}>경매 대기 중</div>
        <div style={{ fontSize: 15, color: C.darkFaint, marginTop: 10 }}>교사 화면에서 매물을 올리면 여기 표시됩니다.</div>
      </div>
    )
  }

  const curTag = tagMeta(active.tag)

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 28, maxWidth: 1280, margin: '0 auto', alignItems: 'stretch' }}>
        <div style={{
          textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center',
          border: `2px solid ${C.darkLine}`, borderRadius: 28, padding: '40px 30px',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(244,112,43,.16), transparent 60%)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <LiveDot label="LIVE" size={10} fontSize={14} />
            <span style={{ fontSize: 13, fontWeight: 700, padding: '4px 14px', borderRadius: 999, border: `2px solid ${C.yellow}`, color: C.yellow, whiteSpace: 'nowrap' }}>{curTag.label}</span>
          </div>
          <div className="bhs" style={{ fontSize: 84, lineHeight: 1.15, color: '#fff', margin: '18px 0 8px' }}>{active.name}</div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 14, marginTop: 8 }}>
            <span style={{ fontSize: 18, color: C.faint, fontWeight: 700 }}>현재 최고가</span>
            <span className="bhs" style={{ fontSize: 96, color: C.yellow, lineHeight: 1 }}>{fmt(topBid?.amount || 0)}</span>
            <span className="bhs" style={{ fontSize: 40, color: C.yellow }}>P</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{topBid?.student_name || '—'}</div>
          {cdRunning ? (
            <div style={{ marginTop: 26 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.red, animation: 'blinkred 1s infinite' }}>낙찰까지</div>
              <div className="bhs" style={{ fontSize: 180, lineHeight: 1, color: C.red }}>{Math.ceil(remaining)}</div>
              <div style={{ height: 12, maxWidth: 420, margin: '8px auto 0', border: `2px solid ${C.red}`, borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${remaining / 5 * 100}%`, background: C.red, transition: 'width .1s linear' }} />
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 26, fontSize: 15, color: C.darkFaint, fontWeight: 700 }}>입찰이 이어지고 있습니다</div>
          )}
        </div>
        <div style={{ border: `2px solid ${C.darkLine}`, borderRadius: 28, padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div className="bhs" style={{ fontSize: 18, color: C.yellow, marginBottom: 14 }}>실시간 입찰 로그</div>
          <div style={{ display: 'grid', gap: 8, alignContent: 'start', overflow: 'auto', flex: 1 }}>
            {itemBids.slice(0, 30).map(b => (
              <div key={b.id} className="risein" style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 15, borderBottom: `1px solid ${C.darkLine}`, padding: '9px 2px' }}>
                <span style={{ color: C.darkFaint, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{timeStr(b.created_at)}</span>
                <span style={{ fontWeight: 700, flex: 1, color: C.bg }}>{b.student_name}</span>
                <span style={{ fontWeight: 700, color: C.yellow }}>{fmt(b.amount)}P</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {burst && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(28,21,16,.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
          <div className="pop" style={{ textAlign: 'center' }}>
            <div style={{
              width: 110, height: 110, margin: '0 auto 18px', borderRadius: '50%', background: C.yellow,
              border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'glow 1.4s infinite',
            }}>
              <GavelIcon size={54} color="#201A16" width={2.2} />
            </div>
            <div className="bhs" style={{ fontSize: 120, color: C.yellow, lineHeight: 1 }}>낙찰!</div>
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 12 }}>{burst.name} · {studentMap.get(burst.winner_id)?.name || ''} · {fmt(burst.final_price)}P</div>
          </div>
        </div>
      )}
    </>
  )
}

// ---------------- 반전 연출 ----------------

function RevealMode({ items, students, revealOn, setRevealOn, schoolBadge }) {
  const results = useMemo(() => items.filter(i => i.status === 'sold').sort((a, b) => (a.order_no || 0) - (b.order_no || 0)), [items])
  const studentMap = useMemo(() => new Map(students.map(s => [s.id, s])), [students])

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', textAlign: 'center' }}>
      {!revealOn ? (
        <div style={{ padding: '40px 0 30px' }}>
          <div className="bhs" style={{ fontSize: 40, color: C.faint }}>모든 경매가 끝났습니다</div>
          <button onClick={() => setRevealOn(true)} style={{
            cursor: 'pointer', marginTop: 22, background: C.red, color: '#fff', border: '2px solid #fff',
            borderRadius: 16, padding: '18px 40px', fontFamily: "'Black Han Sans', sans-serif", fontSize: 24,
          }}>반전 시작</button>
        </div>
      ) : (
        <div className="pop" style={{ padding: '26px 0 10px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.red, letterSpacing: '.2em', animation: 'blinkred 1s infinite' }}>긴급 속보</div>
          <div className="bhs" style={{ fontSize: 64, color: '#fff', lineHeight: 1.2 }}>세계 경제가 붕괴했습니다</div>
          <div style={{ fontSize: 17, color: C.faint, marginTop: 10 }}>돈으로 산 모든 외재적 가치가 사라집니다. 남는 것은 무엇입니까?</div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 16, marginTop: 30 }}>
        {results.map((r, i) => {
          const isIn = r.tag === 'in'
          const on = revealOn
          const winner = studentMap.get(r.winner_id)
          const style = {
            border: `2px solid ${on && isIn ? C.yellow : C.darkLine}`, borderRadius: 18, padding: '20px 16px',
            background: on && isIn ? 'rgba(247,201,72,.08)' : 'rgba(255,255,255,.03)',
            transition: 'all 1.4s ease',
            filter: on && !isIn ? 'grayscale(1)' : 'none',
            opacity: on && !isIn ? .28 : 1,
            transform: on && !isIn ? `translateY(36px) rotate(${i % 2 ? 3 : -3}deg)` : 'none',
            animation: on && isIn ? 'glow 2.2s infinite' : 'none',
          }
          return (
            <div key={r.id} style={style}>
              <div style={{ fontSize: 11, fontWeight: 700, color: isIn ? C.yellow : C.darkFaint, letterSpacing: '.1em' }}>
                {isIn ? '내재적 가치' : '외재적 가치'}
              </div>
              <div className="bhs" style={{ fontSize: 20, marginTop: 8, color: on && !isIn ? C.darkFaint : '#fff' }}>{r.name}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: C.faint }}>{winner?.name || '—'} · {fmt(r.final_price)}P</div>
            </div>
          )
        })}
      </div>
      {revealOn && (
        <div className="risein" style={{ marginTop: 34, fontFamily: "'Black Han Sans', sans-serif", fontSize: 28, color: C.yellow }}>
          빛나는 것만이 여러분에게 남았습니다
        </div>
      )}
    </div>
  )
}

// ---------------- 낙찰 현황판 ----------------

function StandMode({ items, students }) {
  const results = useMemo(() => items.filter(i => i.status === 'sold'), [items])
  return (
    <div style={{ maxWidth: 1240, margin: '0 auto' }}>
      <div className="bhs" style={{ fontSize: 34, color: C.yellow, textAlign: 'center', marginBottom: 26 }}>학생별 낙찰 현황</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 14 }}>
        {students.map(s => {
          const wins = results.filter(r => r.winner_id === s.id)
          return (
            <div key={s.id} style={{ border: `2px solid ${C.darkLine}`, borderRadius: 16, padding: 16, background: 'rgba(255,255,255,.03)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>{s.name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.yellow }}>{fmt(s.balance)}P</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 10, minHeight: 24 }}>
                {wins.length === 0 && <span style={{ fontSize: 11, color: C.darkFaint }}>낙찰 없음</span>}
                {wins.map(w => (
                  <span key={w.id} style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
                    border: `1.5px solid ${w.tag === 'in' ? C.yellow : C.darkFaint}`, whiteSpace: 'nowrap',
                    color: w.tag === 'in' ? C.yellow : C.faint,
                  }}>{w.name}</span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
