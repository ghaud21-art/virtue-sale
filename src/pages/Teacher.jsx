import { useState, useMemo, useCallback, Fragment } from 'react'
import { C, fmt, tagMeta, TARGET_ITEM_COUNT, STATUS_LABEL, timeStr, DEFAULT_REFLECT_QUESTIONS, DEFAULT_HAPPINESS_PROMPT } from '../lib/meta'
import { api, session } from '../lib/api'
import { useClassData, useServerClock, useCountdown } from '../hooks/useClassData'
import { Card, PrimaryBtn, GhostBtn, TagPill, LiveDot, Field, inputStyle, ErrorNote } from '../components/ui'
import { TimerIcon, DownloadIcon, CopyIcon, CheckIcon } from '../components/icons'
import * as XLSX from 'xlsx'

const TABS = [
  { key: 'setup', label: '1 · 반 생성' },
  { key: 'values', label: '2 · 가치 관리' },
  { key: 'auction', label: '3 · 경매 진행' },
  { key: 'results', label: '4 · 결과' },
]

export default function Teacher() {
  const [saved] = useState(() => session.loadTeacher())
  const [classId, setClassId] = useState(saved?.classId || null)
  const [teacherKey, setTeacherKey] = useState(saved?.teacherKey || null)
  const [code, setCode] = useState(saved?.code || null)
  const [tab, setTab] = useState('setup')

  const data = useClassData(classId)
  const { serverNow } = useServerClock()

  const handleCreated = useCallback((res) => {
    const s = { classId: res.class_id, teacherKey: res.teacher_key, code: res.code }
    session.saveTeacher(s)
    setClassId(s.classId); setTeacherKey(s.teacherKey); setCode(s.code)
    setTab('setup')
  }, [])

  if (!classId) {
    return <SetupNew onCreated={handleCreated} />
  }

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 24px 80px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '9px 16px', borderRadius: 10, border: `2px solid ${C.ink}`,
            fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap',
            background: tab === t.key ? C.ink : '#fff', color: tab === t.key ? C.yellow : C.ink,
          }}>{t.label}</button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>
            반 코드 <span style={{ color: C.orange }}>{code}</span> · {STATUS_LABEL[data.klass?.status] || '-'}
          </span>
          <GhostBtn onClick={() => window.open('/board', '_blank', 'noopener')} style={{ padding: '6px 12px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <TimerIcon size={13} color={C.ink} />전광판 열기
          </GhostBtn>
          <GhostBtn onClick={() => {
            if (!confirm('다른 반으로 전환하시겠습니까? (현재 반 정보는 유지됩니다)')) return
            session.clearTeacher(); setClassId(null); setTeacherKey(null); setCode(null)
          }} style={{ padding: '6px 12px', fontSize: 12 }}>다른 반 열기</GhostBtn>
        </div>
      </div>

      {data.error && <ErrorBanner message={data.error} onRetry={data.refetchAll} />}
      {data.loading ? <LoadingCard /> : (
        <>
          {tab === 'setup' && <SetupExisting klass={data.klass} code={code} classId={classId} teacherKey={teacherKey} onNext={() => setTab('values')} />}
          {tab === 'values' && <ValuesTab classId={classId} teacherKey={teacherKey} items={data.items} onDone={() => setTab('auction')} />}
          {tab === 'auction' && <AuctionTab classId={classId} teacherKey={teacherKey} klass={data.klass} items={data.items} bids={data.bids} students={data.students} serverNow={serverNow} onDone={() => setTab('results')} />}
          {tab === 'results' && <ResultsTab classId={classId} teacherKey={teacherKey} klass={data.klass} items={data.items} students={data.students} code={code} />}
        </>
      )}
    </div>
  )
}

function LoadingCard() {
  return <Card style={{ textAlign: 'center', color: C.muted, padding: 60 }}>불러오는 중...</Card>
}

function ErrorBanner({ message, onRetry }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      background: '#FFE3CF', border: `2px solid ${C.red}`, borderRadius: 14,
      padding: '12px 16px', marginBottom: 18, fontSize: 13, fontWeight: 700, color: C.ink,
    }}>
      <span>오류: {message}</span>
      <GhostBtn onClick={onRetry} style={{ padding: '6px 12px', fontSize: 12 }}>다시 시도</GhostBtn>
    </div>
  )
}

// ---------------- 1. 반 생성 ----------------

function SetupNew({ onCreated }) {
  const [budget, setBudget] = useState(1000)
  const [maxWins, setMaxWins] = useState(3)
  const [twist, setTwist] = useState(true)
  const [q1, setQ1] = useState(DEFAULT_REFLECT_QUESTIONS[0])
  const [q2, setQ2] = useState(DEFAULT_REFLECT_QUESTIONS[1])
  const [q3, setQ3] = useState(DEFAULT_REFLECT_QUESTIONS[2])
  const [happinessPrompt, setHappinessPrompt] = useState(DEFAULT_HAPPINESS_PROMPT)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reopenCode, setReopenCode] = useState('')
  const [reopenKey, setReopenKey] = useState('')

  const create = async () => {
    setBusy(true); setError('')
    try {
      const res = await api.createClass(Number(budget) || 1000, maxWins, twist, q1, q2, q3, happinessPrompt)
      onCreated(res)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const reopen = async () => {
    setBusy(true); setError('')
    try {
      const res = await api.getClassByKey(reopenCode, reopenKey)
      onCreated({ class_id: res.class_id, teacher_key: reopenKey, code: res.code })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div style={{ maxWidth: 1160, margin: '0 auto', padding: '28px 24px 80px', display: 'grid', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <Card style={{ padding: 28, display: 'grid', gap: 18 }}>
          <div className="bhs" style={{ fontSize: 20 }}>경매 설정</div>
          <Row label="초기 예산" desc="학생 1인당 지급 포인트">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" value={budget} onChange={e => setBudget(e.target.value)}
                style={{ width: 100, textAlign: 'right', fontWeight: 700, fontSize: 16, border: `2px solid ${C.ink}`, borderRadius: 10, padding: '8px 10px' }} />
              <span style={{ fontWeight: 700 }}>P</span>
            </div>
          </Row>
          <Row label="1인 최대 낙찰 수" desc="한 명이 가져갈 수 있는 가치 개수">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setMaxWins(m => Math.max(1, m - 1))} style={stepBtn}>−</button>
              <span className="bhs" style={{ fontSize: 24, minWidth: 24, textAlign: 'center' }}>{maxWins}</span>
              <button onClick={() => setMaxWins(m => Math.min(9, m + 1))} style={stepBtn}>+</button>
            </div>
          </Row>
          <Row label="반전 룰" desc='경매 종료 후 "세계 경제 붕괴" 시나리오 공개'>
            <Toggle on={twist} onClick={() => setTwist(t => !t)} />
          </Row>
          <ErrorNote>{error}</ErrorNote>
          <PrimaryBtn onClick={create} disabled={busy}>{busy ? '생성 중...' : '반 열기 → 가치 모으기 시작'}</PrimaryBtn>
        </Card>
        <Card style={{ padding: 28, display: 'grid', gap: 14 }}>
          <div className="bhs" style={{ fontSize: 20 }}>이미 만든 반으로 돌아가기</div>
          <div style={{ fontSize: 13, color: C.muted }}>브라우저를 새로 열었다면 반 코드와 발급받은 교사 키를 입력하세요.</div>
          <Field label="반 코드">
            <input value={reopenCode} onChange={e => setReopenCode(e.target.value.toUpperCase())} placeholder="예: HB27X9" style={inputStyle} />
          </Field>
          <Field label="교사 키">
            <input value={reopenKey} onChange={e => setReopenKey(e.target.value)} placeholder="반 생성 시 발급된 키" style={inputStyle} />
          </Field>
          <GhostBtn onClick={reopen} disabled={busy || !reopenCode || !reopenKey}>이 반으로 이어하기</GhostBtn>
        </Card>
      </div>
      <Card style={{ padding: 28, display: 'grid', gap: 14 }}>
        <div>
          <div className="bhs" style={{ fontSize: 20 }}>성찰 질문 문구</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
            윤리 수업이 아닌 다른 주제(진로, 소비, 시간 등)로도 쓸 수 있도록 질문을 자유롭게 고쳐 쓸 수 있습니다. 나중에 반 정보 화면에서도 다시 수정할 수 있어요.
          </div>
        </div>
        <Field label="질문 1"><input value={q1} onChange={e => setQ1(e.target.value)} style={inputStyle} /></Field>
        <Field label="질문 2"><input value={q2} onChange={e => setQ2(e.target.value)} style={inputStyle} /></Field>
        <Field label="질문 3"><input value={q3} onChange={e => setQ3(e.target.value)} style={inputStyle} /></Field>
        <Field label='마지막 한 문장 ("____이다" 앞 문구)'>
          <input value={happinessPrompt} onChange={e => setHappinessPrompt(e.target.value)} style={inputStyle} />
        </Field>
      </Card>
    </div>
  )
}

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 58, height: 32, border: `2px solid ${C.ink}`, borderRadius: 999,
      background: on ? C.green : C.line, position: 'relative', padding: 0, flexShrink: 0,
    }}>
      <span style={{
        position: 'absolute', top: 2, left: on ? 28 : 2, width: 24, height: 24,
        borderRadius: '50%', background: '#fff', border: `2px solid ${C.ink}`,
        boxSizing: 'border-box', transition: 'left .2s',
      }} />
    </button>
  )
}

const stepBtn = {
  width: 32, height: 32, border: `2px solid ${C.ink}`, borderRadius: 10,
  background: '#fff', fontWeight: 700, fontSize: 16,
}

function Row({ label, desc, children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '14px 16px',
    }}>
      <div><div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div><div style={{ fontSize: 12, color: C.muted }}>{desc}</div></div>
      {children}
    </div>
  )
}

// ---------------- 1b. 이미 만든 반: 코드/키 카드 ----------------

function SetupExisting({ klass, code, classId, teacherKey, onNext }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch {}
  }
  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        <Card style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.muted, letterSpacing: '.08em' }}>반 코드</div>
          <div className="bhs" style={{ fontSize: 88, letterSpacing: '.12em', lineHeight: 1.1, color: C.orange }}>{code}</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>학생들은 이 코드로 입장합니다</div>
          <GhostBtn onClick={copy} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {copied ? <CheckIcon size={14} color={C.ink} /> : <CopyIcon size={14} />}
            {copied ? '복사됨' : '코드 복사'}
          </GhostBtn>
        </Card>
        <Card style={{ padding: 28, display: 'grid', gap: 14 }}>
          <div className="bhs" style={{ fontSize: 20 }}>반 정보</div>
          <InfoLine label="초기 예산" value={`${fmt(klass?.initial_budget)}P`} />
          <InfoLine label="1인 최대 낙찰 수" value={`${klass?.max_wins}개`} />
          <InfoLine label="반전 룰" value={klass?.twist_enabled ? '사용' : '미사용'} />
          <InfoLine label="상태" value={STATUS_LABEL[klass?.status] || '-'} />
          <div style={{
            background: C.bg, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: 14,
            fontSize: 12, color: C.muted, lineHeight: 1.6,
          }}>
            교사 키는 이 브라우저에 저장되어 있습니다. 다른 기기에서 이어하려면 반 코드와 함께 아래 키를 기록해 두세요.
            <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', color: C.ink, fontWeight: 700 }}>{teacherKey}</div>
          </div>
          <PrimaryBtn onClick={onNext}>가치 모으기로 이동</PrimaryBtn>
        </Card>
      </div>
      <SettingsCard classId={classId} teacherKey={teacherKey} klass={klass} />
    </div>
  )
}

function SettingsCard({ classId, teacherKey, klass }) {
  const [q1, setQ1] = useState(klass?.reflect_q1 || '')
  const [q2, setQ2] = useState(klass?.reflect_q2 || '')
  const [q3, setQ3] = useState(klass?.reflect_q3 || '')
  const [happinessPrompt, setHappinessPrompt] = useState(klass?.happiness_prompt || '')
  const [synced, setSynced] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  // klass는 실시간 구독으로 뒤늦게 채워지므로, 처음 값이 도착했을 때 한 번만 폼에 반영한다
  if (!synced && klass) {
    setSynced(true)
    setQ1(klass.reflect_q1 || ''); setQ2(klass.reflect_q2 || ''); setQ3(klass.reflect_q3 || '')
    setHappinessPrompt(klass.happiness_prompt || '')
  }

  const save = async () => {
    setBusy(true); setSaved(false)
    try {
      await api.updateSettings(classId, teacherKey, { q1, q2, q3, happinessPrompt })
      setSaved(true); setTimeout(() => setSaved(false), 1800)
    } catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  return (
    <Card style={{ padding: 28, display: 'grid', gap: 14 }}>
      <div className="bhs" style={{ fontSize: 20 }}>성찰 질문 설정</div>
      <Field label="질문 1"><input value={q1} onChange={e => setQ1(e.target.value)} style={inputStyle} /></Field>
      <Field label="질문 2"><input value={q2} onChange={e => setQ2(e.target.value)} style={inputStyle} /></Field>
      <Field label="질문 3"><input value={q3} onChange={e => setQ3(e.target.value)} style={inputStyle} /></Field>
      <Field label='마지막 한 문장 ("____이다" 앞 문구)'>
        <input value={happinessPrompt} onChange={e => setHappinessPrompt(e.target.value)} style={inputStyle} />
      </Field>
      <GhostBtn onClick={save} disabled={busy} style={{ background: saved ? C.mint : '#fff' }}>
        {busy ? '저장 중...' : saved ? '저장됨' : '설정 저장'}
      </GhostBtn>
    </Card>
  )
}

function InfoLine({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
      <span style={{ color: C.muted, fontWeight: 700 }}>{label}</span><span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  )
}

// ---------------- 2. 가치 관리 ----------------

function ValuesTab({ classId, teacherKey, items, onDone }) {
  const pending = useMemo(() => items.filter(i => i.source === 'student' && !i.approved && i.status !== 'rejected'), [items])
  const confirmed = useMemo(() => items.filter(i => i.approved && i.status !== 'rejected').sort((a, b) => new Date(a.created_at) - new Date(b.created_at)), [items])
  const [editing, setEditing] = useState(null) // item id

  const act = async (item, action, extra) => {
    try { await api.updateItem(classId, teacherKey, item.id, action, extra) }
    catch (e) { alert(e.message) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24, alignItems: 'start' }}>
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className="bhs" style={{ fontSize: 18 }}>학생 제안 수신</div>
          <LiveDot />
        </div>
        {pending.length === 0 && <div style={{ fontSize: 13, color: C.muted, padding: '20px 0' }}>대기 중인 제안이 없습니다.</div>}
        <div style={{ display: 'grid', gap: 12 }}>
          {pending.map(p => (
            <div key={p.id} className="risein" style={{ border: `1.5px solid ${C.line}`, borderRadius: 14, padding: '14px 16px' }}>
              {editing === p.id ? (
                <EditRow item={p} onCancel={() => setEditing(null)} onSave={async (name, tag) => {
                  await act(p, 'approve', { name, tag }); setEditing(null)
                }} />
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>제안</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                    <TagPill tag={p.tag} onClick={() => act(p, 'edit', { tag: p.tag === 'in' ? 'ex' : 'in' })} />
                    <span style={{ fontSize: 11, color: C.muted }}>태그 클릭으로 변경</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button onClick={() => act(p, 'approve')} style={miniBtn(C.green, '#fff')}>승인</button>
                    <button onClick={() => setEditing(p.id)} style={miniBtn('#fff', C.ink)}>수정</button>
                    <button onClick={() => act(p, 'reject')} style={miniBtn(C.cream2, C.muted, C.faint)}>거절</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <div className="bhs" style={{ fontSize: 18 }}>확정 가치 목록</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            <span className="bhs" style={{ color: C.orange, fontSize: 20 }}>{confirmed.length}</span> / {TARGET_ITEM_COUNT}
          </div>
        </div>
        <div style={{ height: 10, border: `2px solid ${C.ink}`, borderRadius: 999, overflow: 'hidden', marginBottom: 18 }}>
          <div style={{ height: '100%', width: `${Math.min(100, confirmed.length / TARGET_ITEM_COUNT * 100)}%`, background: C.yellow }} />
        </div>
        <div style={{ display: 'grid', gap: 8, maxHeight: 420, overflow: 'auto' }}>
          {confirmed.map((v, i) => (
            <div key={v.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: C.faint, fontWeight: 700, width: 22 }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontWeight: 500, fontSize: 14 }}>{v.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TagPill tag={v.tag} onClick={() => act(v, 'edit', { tag: v.tag === 'in' ? 'ex' : 'in' })} />
                <button onClick={() => { if (confirm(`"${v.name}"을(를) 목록에서 제거할까요?`)) act(v, 'delete') }}
                  style={{ width: 24, height: 24, border: 'none', background: 'none', color: C.faint, fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            </div>
          ))}
        </div>
        <PrimaryBtn onClick={onDone} style={{ width: '100%', marginTop: 18 }}>
          가치 {confirmed.length}개 확정 → 경매 시작
        </PrimaryBtn>
      </Card>
    </div>
  )
}

function EditRow({ item, onCancel, onSave }) {
  const [name, setName] = useState(item.name)
  const [tag, setTag] = useState(item.tag)
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <input value={name} onChange={e => setName(e.target.value)} style={{ ...inputStyle, padding: 10, fontSize: 14 }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => setTag('in')} style={miniToggle(tag === 'in')}>내재적</button>
        <button onClick={() => setTag('ex')} style={miniToggle(tag === 'ex')}>외재적</button>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(name, tag)} style={miniBtn(C.green, '#fff')}>저장 & 승인</button>
        <button onClick={onCancel} style={miniBtn('#fff', C.ink)}>취소</button>
      </div>
    </div>
  )
}

const miniToggle = on => ({
  padding: '5px 10px', borderRadius: 999, border: `1.5px solid ${C.ink}`,
  background: on ? C.ink : '#fff', color: on ? C.yellow : C.ink, fontWeight: 700, fontSize: 11,
})
const miniBtn = (bg, fg, border) => ({
  flex: 1, background: bg, color: fg, border: `2px solid ${border || C.ink}`,
  borderRadius: 10, padding: 8, fontWeight: 700, fontSize: 13,
})

// ---------------- 3. 경매 진행 ----------------

function AuctionTab({ classId, teacherKey, klass, items, bids, students, serverNow, onDone }) {
  const active = useMemo(() => items.find(i => i.status === 'active'), [items])
  const queue = useMemo(() => items.filter(i => i.approved && i.status === 'waiting'), [items])
  const finishedCount = useMemo(() => items.filter(i => i.status === 'sold' || i.status === 'passed').length, [items])
  const totalApproved = useMemo(() => items.filter(i => i.approved).length, [items])

  const itemBids = useMemo(() => active ? bids.filter(b => b.item_id === active.id).sort((a, b) => b.amount - a.amount || new Date(a.created_at) - new Date(b.created_at)) : [], [bids, active])
  const topBid = itemBids[0]
  const remaining = useCountdown(active?.countdown_until, serverNow)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const cdIdle = active && !active.countdown_until
  const cdRunning = active && active.countdown_until && remaining !== null && remaining > 0.05
  const cdDone = active && active.countdown_until && remaining !== null && remaining <= 0.05

  const pick = async (item) => {
    setBusy(true); setError('')
    try { await api.startItem(classId, teacherKey, item.id) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const start = async () => {
    if (!active) return
    setBusy(true); setError('')
    try { await api.startCountdown(classId, teacherKey, active.id) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const cancel = async () => {
    if (!active) return
    setBusy(true)
    try { await api.cancelCountdown(classId, teacherKey, active.id) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const finalize = async () => {
    if (!active) return
    setBusy(true); setError('')
    try { await api.finalizeItem(classId, teacherKey, active.id) }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 24, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 20 }}>
        <Card style={{ padding: 28 }}>
          {!active ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: C.muted }}>
              <div style={{ fontSize: 14, marginBottom: 12 }}>현재 진행 중인 매물이 없습니다. 오른쪽에서 다음 매물을 선택하세요.</div>
              {finishedCount > 0 && queue.length === 0 && (
                <PrimaryBtn onClick={onDone} style={{ maxWidth: 260, margin: '0 auto' }}>경매 종료 → 결과 보기</PrimaryBtn>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: '.08em' }}>
                  현재 매물 · {finishedCount + 1} / {totalApproved}번째
                </div>
                <TagPill tag={active.tag} />
              </div>
              <div className="bhs" style={{ fontSize: 44, margin: '6px 0 14px' }}>{active.name}</div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>현재 최고가</div>
                  <div className="bhs" style={{ fontSize: 36, color: C.orange }}>{fmt(topBid?.amount || 0)}<span style={{ fontSize: 20 }}> P</span></div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>최고 입찰자</div>
                  <div style={{ fontWeight: 700, fontSize: 20 }}>{topBid?.student_name || '—'}</div>
                </div>
              </div>
              <div style={{ borderTop: `2px dashed ${C.line}`, margin: '20px 0', height: 0 }} />

              {cdIdle && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={start} disabled={busy || !topBid} style={{
                    flex: 1, background: C.ink, color: C.yellow, border: `2px solid ${C.ink}`,
                    borderRadius: 14, padding: 16, fontWeight: 700, fontSize: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    opacity: !topBid ? .5 : 1,
                  }}>
                    <TimerIcon />낙찰 대기 시작 (5초)
                  </button>
                  <GhostBtn onClick={async () => {
                    if (!confirm('입찰 없이 이 매물을 유찰 처리할까요?')) return
                    setBusy(true)
                    try { await api.startCountdown(classId, teacherKey, active.id) } catch (e) { setError(e.message) }
                    setTimeout(async () => { try { await api.finalizeItem(classId, teacherKey, active.id) } catch {} setBusy(false) }, 5200)
                  }} disabled={busy || topBid} style={{ color: C.muted, borderStyle: 'dashed', borderColor: C.faint }}>입찰 없음 · 유찰</GhostBtn>
                </div>
              )}
              {cdRunning && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.red, animation: 'blinkred 1s infinite' }}>
                    낙찰 대기 중 — 새 입찰이 들어오면 리셋됩니다
                  </div>
                  <div className="bhs" style={{ fontSize: 72, color: C.red, lineHeight: 1.1 }}>{Math.ceil(remaining)}</div>
                  <div style={{ height: 10, border: `2px solid ${C.ink}`, borderRadius: 999, overflow: 'hidden', margin: '6px 0 14px' }}>
                    <div style={{ height: '100%', width: `${remaining / 5 * 100}%`, background: C.red, transition: 'width .1s linear' }} />
                  </div>
                  <GhostBtn onClick={cancel} disabled={busy} style={{ width: '100%' }}>대기 취소</GhostBtn>
                </div>
              )}
              {cdDone && (
                <button onClick={finalize} disabled={busy} className="pop" style={{
                  width: '100%', background: C.orange, color: '#fff', border: `2px solid ${C.ink}`,
                  borderRadius: 14, padding: 16, fontWeight: 700, fontSize: 17, boxShadow: `0 3px 0 ${C.ink}`,
                }}>낙찰 확정 — {topBid?.student_name || '유찰'} · {fmt(topBid?.amount || 0)}P</button>
              )}
              <ErrorNote>{error}</ErrorNote>
            </>
          )}
        </Card>
        <Card style={{ padding: 22 }}>
          <div className="bhs" style={{ fontSize: 16, marginBottom: 12 }}>실시간 입찰 로그</div>
          <div style={{ display: 'grid', gap: 6, maxHeight: 220, overflow: 'auto' }}>
            {itemBids.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>아직 입찰이 없습니다.</div>}
            {itemBids.slice(0, 20).map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, borderBottom: `1px solid ${C.cream2}`, padding: '7px 2px' }}>
                <span style={{ color: C.faint, fontVariantNumeric: 'tabular-nums' }}>{timeStr(b.created_at)}</span>
                <span style={{ fontWeight: 700, flex: 1 }}>{b.student_name}</span>
                <span style={{ fontWeight: 700, color: C.orange }}>{fmt(b.amount)}P</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card style={{ padding: 22 }}>
        <div className="bhs" style={{ fontSize: 16, marginBottom: 4 }}>다음 매물 선택</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>클릭하면 현재 매물로 올라갑니다</div>
        <div style={{ display: 'grid', gap: 8, maxHeight: 520, overflow: 'auto' }}>
          {queue.length === 0 && <div style={{ fontSize: 13, color: C.muted }}>대기 중인 매물이 없습니다.</div>}
          {queue.map(q => (
            <button key={q.id} onClick={() => pick(q)} disabled={busy || !!active} style={{
              textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              border: `1.5px solid ${C.line}`, background: '#fff', borderRadius: 12, padding: '11px 14px',
              opacity: active ? .5 : 1, cursor: active ? 'not-allowed' : 'pointer',
            }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>{q.name}</span>
              <TagPill tag={q.tag} />
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ---------------- 4. 결과 ----------------

function ResultsTab({ classId, teacherKey, klass, items, students, code }) {
  const results = useMemo(() => items.filter(i => i.status === 'sold').sort((a, b) => (a.order_no || 0) - (b.order_no || 0)), [items])
  const passed = useMemo(() => items.filter(i => i.status === 'passed'), [items])
  const [busy, setBusy] = useState(false)

  const stats = useMemo(() => {
    const total = results.length
    const avg = total ? Math.round(results.reduce((s, r) => s + r.final_price, 0) / total) : 0
    const top = results.reduce((max, r) => (!max || r.final_price > max.final_price) ? r : max, null)
    const inCount = results.filter(r => r.tag === 'in').length
    const exCount = results.filter(r => r.tag === 'ex').length
    return { total, avg, top, inCount, exCount }
  }, [results])

  const reveal = async () => {
    if (klass?.status === 'done') return
    setBusy(true)
    try { await api.setStatus(classId, teacherKey, 'twist') } catch (e) { alert(e.message) }
    setBusy(false)
  }

  const exportXlsx = async () => {
    const reflections = await api.fetchReflections(classId)
    const rMap = new Map(reflections.map(r => [r.student_id, r]))
    const studentMap = new Map(students.map(s => [s.id, s]))

    const wb = XLSX.utils.book_new()

    const resultRows = results.map(r => ({
      순번: r.order_no, 가치: r.name, 태그: r.tag === 'in' ? '내재적' : '외재적',
      낙찰자: studentMap.get(r.winner_id)?.name || '', 낙찰가: r.final_price,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resultRows), '낙찰결과')

    const studentRows = students.map(s => {
      const wins = results.filter(r => r.winner_id === s.id)
      const refl = rMap.get(s.id)
      return {
        이름: s.name, 잔액: s.balance, 낙찰수: s.win_count,
        낙찰목록: wins.map(w => `${w.name}(${w.final_price}P)`).join(', '),
        질문1: refl?.q1 || '', 질문2: refl?.q2 || '', 질문3: refl?.q3 || '',
        행복정의: refl?.happiness || '',
      }
    })
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(studentRows), '학생별 성찰')

    XLSX.writeFile(wb, `가치경매_${code}_결과.xlsx`)
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {klass?.twist_enabled && (
        <div style={{
          background: C.ink, color: C.bg, border: `2px solid ${C.ink}`, borderRadius: 20, padding: 28,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
        }}>
          <div>
            <div className="bhs" style={{ fontSize: 24, color: C.yellow }}>반전 공개</div>
            <div style={{ fontSize: 13, color: C.faint, marginTop: 4 }}>
              전광판에 "세계 경제 붕괴" 시나리오가 재생됩니다. 외재적 가치는 사라지고 내재적 가치만 남습니다.
            </div>
          </div>
          <button onClick={reveal} disabled={busy} style={{
            background: C.red, color: '#fff', border: `2px solid ${C.bg}`, borderRadius: 14,
            padding: '15px 26px', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap',
          }}>전광판에서 반전 공개 →</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14 }}>
        <StatCard label="총 낙찰" value={`${stats.total}개`} />
        <StatCard label="평균 낙찰가" value={`${fmt(stats.avg)}P`} />
        <StatCard label="최고가 매물" value={stats.top ? `${stats.top.name} · ${fmt(stats.top.final_price)}P` : '—'} small />
        <StatCard label="내재 : 외재 비율" value={`${stats.inCount} : ${stats.exCount}`} />
      </div>
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div className="bhs" style={{ fontSize: 18 }}>낙찰 결과 요약 {passed.length > 0 && <span style={{ fontSize: 12, color: C.muted, fontWeight: 400 }}>(유찰 {passed.length}개)</span>}</div>
          <button onClick={exportXlsx} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, background: C.green, color: '#fff',
            border: `2px solid ${C.ink}`, borderRadius: 12, padding: '10px 18px', fontWeight: 700,
            fontSize: 13, boxShadow: `0 3px 0 ${C.ink}`,
          }}><DownloadIcon />엑셀 내보내기</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 90px 110px 90px', gap: 0, fontSize: 13, minWidth: 480 }}>
            <HCell>순번</HCell><HCell>가치</HCell><HCell>태그</HCell><HCell>낙찰자</HCell><HCell right>낙찰가</HCell>
            {results.map(r => {
              const winner = students.find(s => s.id === r.winner_id)
              return (
                <Fragment key={r.id}>
                  <DCell muted>{r.order_no}</DCell>
                  <DCell>{r.name}</DCell>
                  <DCell><TagPill tag={r.tag} /></DCell>
                  <DCell>{winner?.name || '—'}</DCell>
                  <DCell right bold>{fmt(r.final_price)}P</DCell>
                </Fragment>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}

function StatCard({ label, value, small }) {
  return (
    <div style={{ background: '#fff', border: `2px solid ${C.ink}`, borderRadius: 16, padding: 18 }}>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>{label}</div>
      <div className="bhs" style={{ fontSize: small ? 20 : 32, marginTop: small ? 6 : 0 }}>{value}</div>
    </div>
  )
}
function HCell({ children, right }) {
  return <div style={{ fontWeight: 700, color: C.muted, padding: '8px 10px', borderBottom: `2px solid ${C.ink}`, textAlign: right ? 'right' : 'left' }}>{children}</div>
}
function DCell({ children, right, bold, muted }) {
  return <div style={{ padding: '9px 10px', borderBottom: `1px solid ${C.cream2}`, textAlign: right ? 'right' : 'left', fontWeight: bold ? 700 : 500, color: muted ? C.faint : C.ink }}>{children}</div>
}
