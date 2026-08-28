import { Link } from 'react-router-dom'
import { C } from '../lib/meta'
import { GavelIcon, CoinIcon } from '../components/icons'

// 전광판은 학생이 우연히 들어가지 않도록 메인 화면에 노출하지 않는다.
// 교사 화면(반 정보 카드)의 링크를 통해서만 열 수 있다.
const roles = [
  {
    to: '/teacher', title: '교사 화면', icon: <GavelIcon size={26} />,
    desc: '반을 만들고 학생 제안을 승인한 뒤 경매를 진행합니다. 종료 후 결과 내보내기까지.',
    cta: '반 만들기 / 이어하기', accent: C.orange,
  },
  {
    to: '/student', title: '학생 화면', icon: <CoinIcon size={26} />,
    desc: '반 코드와 이름으로 입장해 가치를 제안하고, 예산으로 나의 행복을 낙찰받으세요.',
    cta: '반 코드로 입장', accent: C.yellow,
  },
]

export default function Home() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div className="bhs" style={{ fontSize: 44, lineHeight: 1.25 }}>
          반 전체가 실시간으로 참여하는 가치 경매
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {roles.map(r => (
          <Link key={r.to} to={r.to} style={{ textDecoration: 'none', color: C.ink }}>
            <div style={{
              background: '#fff', border: `2px solid ${C.ink}`, borderRadius: 20,
              padding: 28, height: '100%', boxSizing: 'border-box',
              boxShadow: `0 4px 0 ${C.ink}`, transition: 'transform .15s',
            }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', background: r.accent,
                border: `2px solid ${C.ink}`, display: 'flex', alignItems: 'center',
                justifyContent: 'center', marginBottom: 16,
              }}>{r.icon}</div>
              <div className="bhs" style={{ fontSize: 22, marginBottom: 8 }}>{r.title}</div>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, minHeight: 66 }}>{r.desc}</div>
              <div style={{
                marginTop: 16, fontWeight: 700, fontSize: 14, color: C.orange,
              }}>{r.cta} →</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
