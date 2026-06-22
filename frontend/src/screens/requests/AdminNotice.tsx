import { AlertTriangle } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import { useLanguage } from '@/contexts/LanguageContext'

interface AdminNoticeProps {
  navigate: (to: string) => void
}

export default function AdminNotice({ navigate }: AdminNoticeProps) {
  const { t } = useLanguage()
  const rq = t.request
  const s2 = t.stream2

  return (
    <>
      {/* ── COMPACT INLINE HEADER — eyebrow → serif title → lede (start-aligned) ── */}
      <section className="req-header">
        <div className="page-container req-header-container">
          <Reveal>
            <div className="req-header-inner">
              <span className="eyebrow req-header-eyebrow">{rq.inlineHeader.eyebrow}</span>
              <h1 className="section-display-bold req-header-title">{rq.inlineHeader.title}</h1>
              <p className="section-lede req-header-lede">{rq.inlineHeader.lede}</p>
            </div>
          </Reveal>
        </div>
      </section>
      <div className="page-container req-admin-shell">
        <Reveal>
          <div className="card" style={{ padding:'clamp(32px, 5vw, 48px)', textAlign:'center', boxShadow:'var(--shadow-lg)' }}>
            <div aria-hidden="true" style={{
              width:'68px', height:'68px',
              background:'var(--ember-soft)',
              borderRadius:'var(--radius-lg)',
              display:'flex', alignItems:'center', justifyContent:'center',
              marginInline:'auto', marginBlockEnd:'var(--sp-5)',
            }}>
              <AlertTriangle size={30} color="var(--ember)" />
            </div>
            <h2 style={{
              fontFamily:'Frank Ruhl Libre, Georgia, serif',
              fontSize:'var(--fs-h2)', fontWeight:400, color:'var(--ink)',
              lineHeight:1.18, letterSpacing:'-0.01em', marginBlockEnd:'var(--sp-3)', textWrap:'balance',
            }}>
              {s2.adminNotice.title}
            </h2>
            <p style={{ color:'var(--gray-600)', fontSize:'var(--fs-body)', marginBlockEnd:'var(--sp-6)', lineHeight:1.7 }}>
              {s2.adminNotice.body}
            </p>
            <button className="btn btn-outline" onClick={() => navigate('/')}>
              {s2.adminNotice.switchBtn}
            </button>
          </div>
        </Reveal>
      </div>
    </>
  )
}
