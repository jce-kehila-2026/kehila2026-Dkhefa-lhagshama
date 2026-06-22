/**
 * AdminNotice — interstitial shown on the request-submission flow (UC-01) when an
 * admin/staff account lands on the beneficiary "submit a request" screen. Requests
 * are beneficiary-only, so instead of the form we render a notice telling the staff
 * user to switch to a beneficiary account and offer a way back home.
 *
 * Pure presentational: all copy comes from LanguageContext (HE/EN), navigation is
 * delegated to the parent via the `navigate` prop. No data fetching or local state.
 */
import { AlertTriangle } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import { useLanguage } from '@/contexts/LanguageContext'
import styles from './AdminNotice.module.css'

interface AdminNoticeProps {
  navigate: (to: string) => void
}

// `navigate`: parent-supplied router push (used for the "back home" CTA).
export default function AdminNotice({ navigate }: AdminNoticeProps) {
  const { t } = useLanguage()
  const rq = t.request // shared compact-header copy reused across the request screens
  const s2 = t.stream2 // submit-request (UC-01) namespace; holds the adminNotice strings

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
          <div className={`card ${styles.card}`}>
            <div aria-hidden="true" className={styles.icon}>
              <AlertTriangle size={30} color="var(--ember)" />
            </div>
            <h2 className={styles.title}>
              {s2.adminNotice.title}
            </h2>
            <p className={styles.body}>
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
