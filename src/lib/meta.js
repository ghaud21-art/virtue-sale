// 디자인 토큰 + 도메인 메타데이터

export const C = {
  bg: '#FBF3E7', ink: '#201A16', orange: '#F4702B', yellow: '#F7C948',
  red: '#E5484D', green: '#2F9E62', muted: '#8A7A6A', line: '#E8DCCB',
  faint: '#C9BBA8', paper: '#fff', peach: '#FFE3CF', mint: '#DCF2E5',
  cream2: '#F1E7D8', darkBg: '#1C1510', darkLine: '#3A322A',
  darkFaint: '#5A4E42', greenLite: '#7FDCA4', orangeLite: '#FFB27F',
}

export const COUNTDOWN_SECONDS = 5
export const MIN_INCREMENT = 10
export const TARGET_ITEM_COUNT = 50

export function tagMeta(tag) {
  return tag === 'in'
    ? { label: '내재적', bg: C.mint, dark: C.greenLite }
    : { label: '외재적', bg: C.peach, dark: C.orangeLite }
}

export function fmt(n) {
  return (n ?? 0).toLocaleString('ko-KR')
}

export function timeStr(iso) {
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export const STATUS_LABEL = {
  setup: '준비', propose: '제안 접수', auction: '경매 중',
  twist: '반전', reflect: '성찰', done: '종료',
}

// 반 생성 시 교사가 그대로 쓰거나 자유롭게 고쳐 쓸 수 있는 기본 성찰 질문 세트.
// DB(auction_classes.reflect_q1~q3, happiness_prompt)에 반별로 저장되며, 여기 값은
// 반 생성 폼의 초기값이자 klass 데이터가 아직 없을 때의 fallback으로만 쓰인다.
export const DEFAULT_REFLECT_QUESTIONS = [
  '이번 경매에서 내가 가장 많은 돈을 쓴 가치는 무엇이고, 그 이유는 무엇인가요?',
  '예산이 부족해 포기했던 가치 중 가장 아쉬운 것은 무엇인가요? 그것이 없어도 나는 괜찮을까요?',
  '오늘 등장한 가치들 중, 사실은 돈이 없어도 얻을 수 있는 것이 있었다면 무엇인가요?',
]
export const DEFAULT_HAPPINESS_PROMPT = '내가 생각하는 진정한 행복이란'

export function reflectQuestions(klass) {
  return [
    klass?.reflect_q1 || DEFAULT_REFLECT_QUESTIONS[0],
    klass?.reflect_q2 || DEFAULT_REFLECT_QUESTIONS[1],
    klass?.reflect_q3 || DEFAULT_REFLECT_QUESTIONS[2],
  ]
}
export function happinessPrompt(klass) {
  return klass?.happiness_prompt || DEFAULT_HAPPINESS_PROMPT
}
