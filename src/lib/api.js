import { supabase } from './supabase'

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    // Postgres RAISE EXCEPTION 메시지를 그대로 사용자에게 보여준다
    throw new Error(error.message || '요청에 실패했습니다')
  }
  return data
}

export const api = {
  serverNow: () => rpc('auction_now'),
  createClass: (budget, maxWins, twist, q1, q2, q3, happinessPrompt) =>
    rpc('auction_create_class', {
      p_budget: budget, p_max_wins: maxWins, p_twist: twist,
      p_q1: q1 ?? null, p_q2: q2 ?? null, p_q3: q3 ?? null, p_happiness_prompt: happinessPrompt ?? null,
    }),
  getClassByKey: (code, key) =>
    rpc('auction_get_class_by_key', { p_code: code, p_key: key }),
  updateSettings: (classId, key, { q1, q2, q3, happinessPrompt } = {}) =>
    rpc('auction_update_settings', {
      p_class_id: classId, p_key: key,
      p_q1: q1 ?? null, p_q2: q2 ?? null, p_q3: q3 ?? null,
      p_happiness_prompt: happinessPrompt ?? null,
    }),
  joinClass: (code, name) =>
    rpc('auction_join_class', { p_code: code, p_name: name }),
  proposeItem: (studentId, name) =>
    rpc('auction_propose_item', { p_student_id: studentId, p_name: name }),
  updateItem: (classId, key, itemId, action, extra = {}) =>
    rpc('auction_update_item', {
      p_class_id: classId, p_key: key, p_item_id: itemId, p_action: action,
      p_name: extra.name ?? null, p_tag: extra.tag ?? null,
    }),
  setStatus: (classId, key, status) =>
    rpc('auction_set_status', { p_class_id: classId, p_key: key, p_status: status }),
  startItem: (classId, key, itemId) =>
    rpc('auction_start_item', { p_class_id: classId, p_key: key, p_item_id: itemId }),
  placeBid: (itemId, studentId, amount) =>
    rpc('auction_place_bid', { p_item_id: itemId, p_student_id: studentId, p_amount: amount }),
  startCountdown: (classId, key, itemId) =>
    rpc('auction_start_countdown', { p_class_id: classId, p_key: key, p_item_id: itemId }),
  cancelCountdown: (classId, key, itemId) =>
    rpc('auction_cancel_countdown', { p_class_id: classId, p_key: key, p_item_id: itemId }),
  finalizeItem: (classId, key, itemId) =>
    rpc('auction_finalize_item', { p_class_id: classId, p_key: key, p_item_id: itemId }),
  submitReflection: (studentId, q1, q2, q3, happiness) =>
    rpc('auction_submit_reflection', {
      p_student_id: studentId, p_q1: q1, p_q2: q2, p_q3: q3, p_happiness: happiness,
    }),

  async fetchClass(classId) {
    const { data, error } = await supabase.from('auction_classes')
      .select('*').eq('id', classId).single()
    if (error) throw new Error(error.message)
    return data
  },
  async fetchClassByCode(code) {
    const { data, error } = await supabase.from('auction_classes')
      .select('*').eq('code', code.toUpperCase().trim()).maybeSingle()
    if (error) throw new Error(error.message)
    return data
  },
  async fetchStudents(classId) {
    const { data, error } = await supabase.from('auction_students')
      .select('*').eq('class_id', classId).order('created_at')
    if (error) throw new Error(error.message)
    return data
  },
  async fetchItems(classId) {
    const { data, error } = await supabase.from('auction_items')
      .select('*').eq('class_id', classId).order('created_at')
    if (error) throw new Error(error.message)
    return data
  },
  async fetchBids(classId) {
    const { data, error } = await supabase.from('auction_bids')
      .select('*').eq('class_id', classId).order('id', { ascending: false }).limit(500)
    if (error) throw new Error(error.message)
    return data
  },
  async fetchReflections(classId) {
    const { data, error } = await supabase.from('auction_reflections')
      .select('*').eq('class_id', classId)
    if (error) throw new Error(error.message)
    return data
  },
}

// localStorage 세션
const T_KEY = 'auction_teacher_session'   // 현재 이 탭에서 열려 있는 반
const T_LIST_KEY = 'auction_teacher_classes' // 이 브라우저에서 만들었거나 열어본 반 전체 목록 (여러 반 운영용)
const S_KEY = 'auction_student_session'

export const session = {
  saveTeacher: v => localStorage.setItem(T_KEY, JSON.stringify(v)),
  loadTeacher: () => { try { return JSON.parse(localStorage.getItem(T_KEY)) } catch { return null } },
  clearTeacher: () => localStorage.removeItem(T_KEY),
  saveStudent: v => localStorage.setItem(S_KEY, JSON.stringify(v)),
  loadStudent: () => { try { return JSON.parse(localStorage.getItem(S_KEY)) } catch { return null } },
  clearStudent: () => localStorage.removeItem(S_KEY),

  listClasses: () => {
    try { return JSON.parse(localStorage.getItem(T_LIST_KEY)) || [] } catch { return [] }
  },
  // 새로 만들거나 코드+키로 다시 연 반을 목록 맨 앞에 기억해둔다 (있으면 갱신, 없으면 추가)
  rememberClass: ({ classId, teacherKey, code }) => {
    const list = session.listClasses().filter(c => c.classId !== classId)
    list.unshift({ classId, teacherKey, code, savedAt: Date.now() })
    localStorage.setItem(T_LIST_KEY, JSON.stringify(list.slice(0, 30)))
  },
  forgetClass: (classId) => {
    localStorage.setItem(T_LIST_KEY, JSON.stringify(session.listClasses().filter(c => c.classId !== classId)))
  },
}
