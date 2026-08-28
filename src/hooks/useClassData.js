import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { api } from '../lib/api'

// 반 데이터 전체 로드 + Realtime 구독 (classes/students/items 변경, bids INSERT)
export function useClassData(classId) {
  const [klass, setKlass] = useState(null)
  const [students, setStudents] = useState([])
  const [items, setItems] = useState([])
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refetchAll = useCallback(async () => {
    if (!classId) return
    try {
      const [k, s, i, b] = await Promise.all([
        api.fetchClass(classId), api.fetchStudents(classId),
        api.fetchItems(classId), api.fetchBids(classId),
      ])
      setKlass(k); setStudents(s); setItems(i); setBids(b)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [classId])

  useEffect(() => {
    if (!classId) { setLoading(false); return }
    let alive = true
    refetchAll()

    const ch = supabase.channel(`auction-class-${classId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'auction_classes', filter: `id=eq.${classId}` },
        payload => { if (alive) setKlass(k => ({ ...k, ...payload.new })) })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'auction_students', filter: `class_id=eq.${classId}` },
        payload => {
          if (!alive) return
          if (payload.eventType === 'INSERT') {
            setStudents(prev => prev.some(s => s.id === payload.new.id) ? prev : [...prev, payload.new])
          } else if (payload.eventType === 'UPDATE') {
            setStudents(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } : s))
          } else {
            api.fetchStudents(classId).then(s => alive && setStudents(s)).catch(() => {})
          }
        })
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'auction_items', filter: `class_id=eq.${classId}` },
        payload => {
          if (!alive) return
          if (payload.eventType === 'INSERT') {
            setItems(prev => prev.some(i => i.id === payload.new.id) ? prev : [...prev, payload.new])
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i))
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== payload.old.id))
          }
        })
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'auction_bids', filter: `class_id=eq.${classId}` },
        payload => {
          if (!alive) return
          setBids(prev => prev.some(b => b.id === payload.new.id) ? prev : [payload.new, ...prev])
        })
      .subscribe(status => {
        // 재연결 시 놓친 이벤트 복구
        if (status === 'SUBSCRIBED') refetchAll()
      })

    return () => { alive = false; supabase.removeChannel(ch) }
  }, [classId, refetchAll])

  return { klass, students, items, bids, loading, error, refetchAll }
}

// 서버 시간 오프셋 (낙찰 카운트다운은 서버 시간 기준으로 판정)
export function useServerClock() {
  const offsetRef = useRef(0)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let alive = true
    api.serverNow()
      .then(iso => {
        if (!alive) return
        offsetRef.current = new Date(iso).getTime() - Date.now()
        setReady(true)
      })
      .catch(() => setReady(true))
    return () => { alive = false }
  }, [])
  const serverNow = useCallback(() => Date.now() + offsetRef.current, [])
  return { serverNow, ready }
}

// countdown_until 타임스탬프 → 남은 초 (0.1초 간격 갱신)
export function useCountdown(countdownUntil, serverNow) {
  const [remaining, setRemaining] = useState(null)
  useEffect(() => {
    if (!countdownUntil) { setRemaining(null); return }
    const until = new Date(countdownUntil).getTime()
    const tick = () => {
      const r = (until - serverNow()) / 1000
      setRemaining(r > 0 ? r : 0)
    }
    tick()
    const t = setInterval(tick, 100)
    return () => clearInterval(t)
  }, [countdownUntil, serverNow])
  return remaining
}
