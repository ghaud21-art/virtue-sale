import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { C, fmt, reflectQuestions, happinessPrompt, MIN_INCREMENT } from '../lib/meta'
import { api, session } from '../lib/api'
import { useClassData, useServerClock, useCountdown } from '../hooks/useClassData'
import { PrimaryBtn, Field, inputStyle, ErrorNote, InfoNote, LiveDot } from '../components/ui'
import { GavelIcon, CoinIcon, InfoIcon, DownloadIcon } from '../components/icons'
import html2canvas from 'html2canvas'

const STEPS = [
  ['join', '입장'], ['propose', '제안'], ['auction', '경매'], ['reflect', '성찰'], ['card', '카드'],
]

export default function Student() {
  const [saved] = useState(() => session.loadStudent())
  const [studentId, setStudentId] = useState(saved?.studentId || null)
  const [classId, setClassId] = useState(saved?.classId || null)
  const [code, setCode] = useState(saved?.code || null)
  const [name, setName] = useState(saved?.name || null)
  const [step, setStep] = useState(saved ? 'auction' : 'join')

  const data = useClassData(classId)
  const { serverNow } = useServerClock()
  const me = useMemo(() => data.students.find(s => s.id === studentId), [data.students, studentId])

  const handleJoined = useCallback((res) => {
    const s = { studentId: res.student_id, classId: res.class_id, code: res.code, name: res.name }
    session.saveStudent(s)
    setStudentId(s.studentId); setClassId(s.classId); setCode(s.code); setName(s.name)
    setStep('propose')
  }, [])

  if (!studentId) {
    return <JoinScreen onJoined={handleJoined} />
  }

  return (
    <div style={{ padding: '28px 16px 80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {STEPS.map(([k, label]) => (
          <button key={k} onClick={() => setStep(k)} style={{
            padding: '7px 14px', borderRadius: 999, border: `2px solid ${C.ink}`,
            fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap',
            background: step === k ? C.ink : '#fff', color: step === k ? C.yellow : C.ink,
          }}>{label}</button>
        ))}
        <button onClick={() => {
          if (!confirm('입장 화면으로 돌아갈까요? (내 기록은 유지됩니다)')) return
          session.clearStudent(); setStudentId(null)
        }} style={{ padding: '7px 14px', borderRadius: 999, border: `2px solid ${C.faint}`, fontWeight: 700, fontSize: 12, background: '#fff', color: C.muted }}>나가기</button>
      </div>
      <div style={{ width: 390, maxWidth: '100%', background: '#fff', border: `2px solid ${C.ink}`, borderRadius: 32, overflow: 'hidden', boxShadow: '0 8px 0 rgba(32,26,22,.12)' }}>
        {data.loading ? <div style={{ padding: 60, textAlign: 'center', color: C.muted }}>불러오는 중...</div> : (
          <>
            {step === 'propose' && <ProposeStep studentId={studentId} items={data.items} onNext={() => setStep('auction')} />}
            {step === 'auction' && <AuctionStep classId={classId} studentId={studentId} me={me} items={data.items} bids={data.bids} serverNow={serverNow} klass={data.klass} onReflect={() => setStep('reflect')} />}
            {step === 'reflect' && <ReflectStep studentId={studentId} items={data.items} klass={data.klass} onNext={() => setStep('card')} />}
            {step === 'card' && <CardStep name={name} code={code} classId={classId} studentId={studentId} me={me} items={data.items} klass={data.klass} />}
            {step === 'join' && <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>이미 입장했습니다. 위 단계를 선택하세요.</div>}
          </>
        )}
      </div>
    </div>
  )
}

// ---------------- 입장 ----------------

function JoinScreen({ onJoined }) {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const join = async () => {
    if (!code.trim() || !name.trim()) return
    setBusy(true); setError('')
    try {
      const res = await api.joinClass(code, name)
      onJoined(res)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 16px 80px' }}>
      <div style={{ width: 390, maxWidth: '100%', background: '#fff', border: `2px solid ${C.ink}`, borderRadius: 32, overflow: 'hidden', boxShadow: '0 8px 0 rgba(32,26,22,.12)' }}>
        <div style={{ background: C.orange, padding: '44px 28px 36px', textAlign: 'center', borderBottom: `2px solid ${C.ink}` }}>
          <div style={{ width: 64, height: 64, margin: '0 auto 14px', borderRadius: '50%', background: C.yellow, border: `2px solid ${C.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GavelIcon size={30} />
          </div>
          <div className="bhs" style={{ fontSize: 28, color: '#fff', lineHeight: 1.25 }}>가치 경매</div>
          <div style={{ fontSize: 13, color: C.peach, marginTop: 8 }}>학습용 실시간 가치경매 게임</div>
        </div>
        <div style={{ padding: '28px 24px 32px', display: 'grid', gap: 14 }}>
          <Field label="반 코드">
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="예: HB27X9"
              style={{ ...inputStyle, fontSize: 20, fontWeight: 700, letterSpacing: '.2em', textAlign: 'center' }}
              onKeyDown={e => e.key === 'Enter' && join()} />
          </Field>
          <Field label="닉네임">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 김하늘" style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && join()} maxLength={20} />
          </Field>
          <ErrorNote>{error}</ErrorNote>
          <PrimaryBtn onClick={join} disabled={busy} style={{ marginTop: 4 }}>{busy ? '입장 중...' : '입장하기'}</PrimaryBtn>
        </div>
      </div>
    </div>
  )
}

// ---------------- 제안 ----------------

function ProposeStep({ studentId, items, onNext }) {
  const mine = useMemo(() => items.find(i => i.proposed_by === studentId), [items, studentId])
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!value.trim()) return
    setBusy(true); setError('')
    try { await api.proposeItem(studentId, value); setValue('') }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (mine) {
    return (
      <div style={{ padding: '32px 24px', display: 'grid', gap: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, letterSpacing: '.08em' }}>STEP 1 · 가치 제안</div>
        <div className="bhs" style={{ fontSize: 22, lineHeight: 1.4 }}>제안을 제출했어요</div>
        <div style={{ border: `1.5px solid ${C.line}`, borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{mine.name}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
            {mine.approved ? '선생님이 승인했어요. 경매 목록에 올라갑니다.' : '선생님의 승인을 기다리는 중이에요.'}
          </div>
        </div>
        <PrimaryBtn onClick={onNext}>경매로 이동</PrimaryBtn>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px 24px 32px', display: 'grid', gap: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, letterSpacing: '.08em' }}>STEP 1 · 가치 제안</div>
      <div className="bhs" style={{ fontSize: 24, lineHeight: 1.35 }}>행복한 삶을 위해<br />필요한 것은?</div>
      <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>한 가지만 제출할 수 있어요. 제출된 가치는 선생님 승인 후 경매 목록에 올라갑니다.</div>
      <textarea value={value} onChange={e => setValue(e.target.value)} placeholder="예: 마음의 평온, 100억 원의 자산" maxLength={30}
        style={{ width: '100%', boxSizing: 'border-box', border: `2px solid ${C.ink}`, borderRadius: 14, padding: 16, fontSize: 16, minHeight: 110, resize: 'none' }} />
      <InfoNote><InfoIcon />물건이 아니어도 좋아요. 상태, 관계, 명예 모두 가능합니다.</InfoNote>
      <ErrorNote>{error}</ErrorNote>
      <PrimaryBtn onClick={submit} disabled={busy || !value.trim()}>{busy ? '제출 중...' : '제안 제출하기'}</PrimaryBtn>
      <button onClick={onNext} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, fontWeight: 700, textDecoration: 'underline' }}>
        나중에 제안하고 경매로 이동 →
      </button>
    </div>
  )
}

// ---------------- 경매 ----------------

function AuctionStep({ classId, studentId, me, items, bids, serverNow, klass, onReflect }) {
  const active = useMemo(() => items.find(i => i.status === 'active'), [items])
  const itemBids = useMemo(() => active ? bids.filter(b => b.item_id === active.id).sort((a, b) => b.amount - a.amount || new Date(a.created_at) - new Date(b.created_at)) : [], [bids, active])
  const topBid = itemBids[0]
  const remaining = useCountdown(active?.countdown_until, serverNow)
  const cdRunning = active?.countdown_until && remaining !== null && remaining > 0.05

  const [bidVal, setBidVal] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const maxWins = klass?.max_wins ?? 3
  const atLimit = (me?.win_count ?? 0) >= maxWins

  const bump = (d) => {
    const cur = parseInt(String(bidVal).replace(/[^0-9]/g, ''), 10) || topBid?.amount || 0
    setBidVal(String(cur + d))
    setError('')
  }

  const place = async () => {
    const n = parseInt(String(bidVal).replace(/[^0-9]/g, ''), 10)
    if (!active) return
    if (!n) { setError('금액을 입력해 주세요.'); return }
    setBusy(true); setError('')
    try {
      await api.placeBid(active.id, studentId, n)
      setBidVal('')
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (!active) {
    return (
      <div style={{ padding: '32px 24px 28px', display: 'grid', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <div className="bhs" style={{ fontSize: 22 }}>경매 대기 중</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>선생님이 다음 매물을 올릴 때까지 기다려 주세요.</div>
        </div>
        {(klass?.status === 'reflect' || klass?.status === 'twist' || klass?.status === 'done') && (
          <PrimaryBtn onClick={onReflect}>성찰로 이동</PrimaryBtn>
        )}
        <ItemRoster items={items} />
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `2px solid ${C.ink}`, background: C.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LiveDot label="LIVE" size={7} fontSize={11} />
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>낙찰 {me?.win_count ?? 0}/{maxWins}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `2px solid ${C.ink}`, borderRadius: 999, padding: '5px 14px' }}>
          <CoinIcon /><span style={{ fontWeight: 700, fontSize: 14 }}>{fmt(me?.balance)}P</span>
        </div>
      </div>
      <div style={{ padding: '22px 20px 28px', display: 'grid', gap: 14 }}>
        <div style={{ background: C.ink, color: C.bg, borderRadius: 18, padding: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.faint, letterSpacing: '.08em' }}>현재 매물</div>
          <div className="bhs" style={{ fontSize: 30, margin: '6px 0 4px', color: C.yellow }}>{active.name}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 10 }}>
            <div><div style={{ fontSize: 11, color: C.faint }}>현재 최고가</div><div className="bhs" style={{ fontSize: 26, color: '#fff' }}>{fmt(topBid?.amount || 0)}P</div></div>
            <div style={{ whiteSpace: 'nowrap' }}><div style={{ fontSize: 11, color: C.faint }}>최고 입찰자</div><div style={{ fontWeight: 700, fontSize: 18, marginTop: 4 }}>{topBid?.student_name || '—'}</div></div>
          </div>
        </div>
        {cdRunning && (
          <div className="pop" style={{ background: C.red, color: '#fff', border: `2px solid ${C.ink}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 13, paddingRight: 8 }}>낙찰 대기 중! 지금 입찰하면 리셋</span>
            <span className="bhs" style={{ fontSize: 30, flexShrink: 0 }}>{Math.ceil(remaining)}</span>
          </div>
        )}
        {atLimit ? (
          <InfoNote style={{ background: C.cream2, borderColor: C.faint }}>
            <InfoIcon />낙찰 한도({maxWins}개)에 도달해 더 이상 입찰할 수 없어요.
          </InfoNote>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={bidVal} onChange={e => { setBidVal(e.target.value.replace(/[^0-9]/g, '')); setError('') }}
                placeholder="입찰 금액" inputMode="numeric"
                style={{ flex: 1, minWidth: 0, border: `2px solid ${C.ink}`, borderRadius: 12, padding: 14, fontSize: 18, fontWeight: 700, textAlign: 'right' }} />
              <button onClick={() => bump(10)} style={quickBtn}>+10</button>
              <button onClick={() => bump(50)} style={quickBtn}>+50</button>
            </div>
            <ErrorNote>{error}</ErrorNote>
            <PrimaryBtn onClick={place} disabled={busy}>{busy ? '입찰 중...' : '입찰하기'}</PrimaryBtn>
            <InfoNote><InfoIcon />잔액 초과·현재 최고가 이하 금액은 입찰할 수 없어요. 최소 {MIN_INCREMENT}P 단위로 올려야 해요.</InfoNote>
          </div>
        )}
        <ItemRoster items={items} />
        <button onClick={onReflect} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 12, fontWeight: 700, textDecoration: 'underline' }}>
          경매가 끝났나요? 성찰로 이동 →
        </button>
      </div>
    </>
  )
}

const quickBtn = {
  border: `2px solid ${C.ink}`, background: '#fff', borderRadius: 12, padding: '0 12px', fontWeight: 700, fontSize: 13,
}

// 학생에게 전체 매물 목록을 보여준다. 내재/외재 태그는 반전 전까지 스포일러가 되므로 표시하지 않는다.
function ItemRoster({ items }) {
  const list = useMemo(() => {
    return items.filter(i => i.approved).slice().sort((a, b) => {
      const ao = a.order_no ?? Infinity, bo = b.order_no ?? Infinity
      if (ao !== bo) return ao - bo
      return new Date(a.created_at) - new Date(b.created_at)
    })
  }, [items])
  if (!list.length) return null

  const statusMeta = (status) => {
    if (status === 'sold') return { label: '낙찰', color: C.faint }
    if (status === 'active') return { label: '진행중', color: C.orange }
    return { label: '대기', color: C.muted }
  }

  return (
    <div style={{ border: `1.5px solid ${C.line}`, borderRadius: 14, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, marginBottom: 8 }}>전체 매물 ({list.length}개)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflow: 'auto' }}>
        {list.map(i => {
          const s = statusMeta(i.status)
          return (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
              <span style={{
                color: i.status === 'sold' ? C.faint : C.ink,
                textDecoration: i.status === 'sold' ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{i.name}</span>
              <span style={{ fontWeight: 700, fontSize: 11, color: s.color, flexShrink: 0 }}>{s.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- 성찰 ----------------

function ReflectStep({ studentId, items, klass, onNext }) {
  const won = useMemo(() => items.filter(i => i.status === 'sold' && i.winner_id === studentId), [items, studentId])
  const topSpend = useMemo(() => won.reduce((max, w) => (!max || w.final_price > max.final_price) ? w : max, null), [won])
  const questions = useMemo(() => reflectQuestions(klass), [klass])
  const prompt = happinessPrompt(klass)

  const [q1, setQ1] = useState('')
  const [q2, setQ2] = useState('')
  const [q3, setQ3] = useState('')
  const [happiness, setHappiness] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!happiness.trim()) { setError('행복 정의 문장을 입력해 주세요.'); return }
    setBusy(true); setError('')
    try {
      await api.submitReflection(studentId, q1, q2, q3, happiness)
      onNext()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div style={{ padding: '32px 24px', display: 'grid', gap: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, letterSpacing: '.08em' }}>경매 종료 · 성찰</div>
      <div className="bhs" style={{ fontSize: 22, lineHeight: 1.4 }}>오늘의 경매,<br />어떤 마음이었나요?</div>
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
            1. {questions[0]}
            {topSpend && <span style={{ display: 'block', fontWeight: 400, fontSize: 12, color: C.orange, marginTop: 4 }}>내 최고 지출: {topSpend.name} ({fmt(topSpend.final_price)}P)</span>}
          </div>
          <textarea value={q1} onChange={e => setQ1(e.target.value)} style={reflectArea} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>2. {questions[1]}</div>
          <textarea value={q2} onChange={e => setQ2(e.target.value)} style={reflectArea} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>3. {questions[2]}</div>
          <textarea value={q3} onChange={e => setQ3(e.target.value)} style={reflectArea} />
        </div>
      </div>
      <div style={{ background: C.bg, border: `2px solid ${C.ink}`, borderRadius: 14, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{prompt}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <input value={happiness} onChange={e => setHappiness(e.target.value)} placeholder="한 문장으로" maxLength={80}
            style={{ flex: 1, minWidth: 0, border: 'none', borderBottom: `2px solid ${C.ink}`, background: 'none', padding: '6px 2px', fontSize: 15, fontWeight: 700 }} />
          <span style={{ fontWeight: 700, fontSize: 15 }}>이다.</span>
        </div>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <PrimaryBtn onClick={submit} disabled={busy}>{busy ? '제출 중...' : '제출하고 내 카드 만들기'}</PrimaryBtn>
    </div>
  )
}

const reflectArea = {
  width: '100%', boxSizing: 'border-box', border: `1.5px solid ${C.line}`, borderRadius: 12,
  padding: 12, fontSize: 14, minHeight: 64, resize: 'none',
}

// ---------------- 카드 ----------------

function CardStep({ name, code, classId, studentId, me, items, klass }) {
  const cardRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [reflection, setReflection] = useState(null)

  useEffect(() => {
    let alive = true
    api.fetchReflections(classId).then(rs => {
      if (alive) setReflection(rs.find(r => r.student_id === studentId) || null)
    }).catch(() => {})
    return () => { alive = false }
  }, [classId, studentId])

  const won = useMemo(() => items.filter(i => i.status === 'sold' && i.winner_id === studentId).sort((a, b) => b.final_price - a.final_price), [items, studentId])
  const twistRevealed = klass?.status === 'twist' || klass?.status === 'done'
  const prompt = happinessPrompt(klass)

  const save = async () => {
    if (!cardRef.current) return
    setSaving(true)
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#201A16', scale: 2, useCORS: true })
      const link = document.createElement('a')
      link.download = `가치경매_${name}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      alert('이미지 저장에 실패했습니다: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const happinessText = reflection?.happiness || ''

  return (
    <div style={{ padding: '24px 20px 28px', display: 'grid', gap: 14, background: C.bg }}>
      <div ref={cardRef} style={{
        width: '100%', aspectRatio: '9/16', background: C.darkBg, border: `2px solid ${C.ink}`,
        borderRadius: 22, overflow: 'hidden', display: 'flex', flexDirection: 'column', color: C.bg,
      }}>
        <div style={{ background: C.orange, padding: '18px 20px 16px', borderBottom: `2px solid ${C.ink}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.14em', color: C.peach }}>나의 행복 포트폴리오</div>
          <div className="bhs" style={{ fontSize: 21, lineHeight: 1.35, color: '#fff', marginTop: 6 }}>
            {happinessText ? `"${prompt}\n${happinessText}"` : `${prompt}...`}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.peach }}>{name} · {code}</span>
          </div>
        </div>
        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.12em', color: C.faint }}>
            낙찰 가치 {twistRevealed ? '· 반전 생존' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
            {won.length === 0 && <div style={{ fontSize: 12, color: C.faint }}>낙찰한 가치가 없습니다.</div>}
            {won.map(w => {
              const survived = !twistRevealed || w.tag === 'in'
              return (
                <div key={w.id} style={survived ? {
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(247,201,72,.12)', border: `1.5px solid ${C.yellow}`, borderRadius: 10, padding: '9px 12px',
                } : {
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: `1.5px solid ${C.darkFaint}`, borderRadius: 10, padding: '9px 12px', opacity: .5,
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: survived ? C.yellow : C.faint, textDecoration: survived ? 'none' : 'line-through' }}>{w.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: survived ? '#fff' : C.faint }}>{fmt(w.final_price)}P{!survived ? ' · 소멸' : ''}</span>
                </div>
              )
            })}
          </div>
          <div style={{ marginTop: 'auto', borderTop: `1px dashed ${C.darkFaint}`, paddingTop: 10, fontSize: 11.5, lineHeight: 1.65, color: C.line }}>
            {reflection?.q1 || ''}
          </div>
        </div>
        <div style={{ padding: '10px 20px 14px', display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: C.muted, borderTop: `1px solid ${C.darkLine}` }}>
          <span>가치 경매</span><span>{code}</span>
        </div>
      </div>
      <button onClick={save} disabled={saving} style={{
        background: C.ink, color: C.yellow, border: `2px solid ${C.ink}`, borderRadius: 14, padding: 15,
        fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        opacity: saving ? .6 : 1,
      }}>
        <DownloadIcon color={C.yellow} />{saving ? '저장 중...' : '이미지로 저장하기'}
      </button>
    </div>
  )
}
