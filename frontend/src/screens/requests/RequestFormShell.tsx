import type { ReactNode } from 'react'
import { CheckCircle, Users, AlertTriangle, ShieldCheck, Clock, Lock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Reveal from '@/components/motion/Reveal'
import StepIndicator from '@/components/forms/StepIndicator'
import { useLanguage } from '@/contexts/LanguageContext'

interface RequestFormShellProps {
  step: number
  steps: string[]
  role: string | null
  emailVerified: boolean
  resendSent: boolean
  handleResendVerification: () => void
  submitting: boolean
  setStep: (updater: (s: number) => number) => void
  goNext: () => void
  BackArrow: LucideIcon
  NextArrow: LucideIcon
  children: ReactNode
}

export default function RequestFormShell({
  step,
  steps,
  role,
  emailVerified,
  resendSent,
  handleResendVerification,
  submitting,
  setStep,
  goNext,
  BackArrow,
  NextArrow,
  children,
}: RequestFormShellProps) {
  const { t, lang } = useLanguage()
  const rq = t.request
  // #86 — t.auth.verifyBanner strings
  const vb = t.auth.verifyBanner

  // Reassurance items shown beneath the form — quiet, brand-aligned trust signals.
  const trustItems = [
    { Icon: Clock,       text: lang === 'he' ? 'נציג חוזר אליך תוך 48 שעות' : 'A representative replies within 48 hours' },
    { Icon: Lock,        text: lang === 'he' ? 'הפרטים שלך מאובטחים ומוצפנים' : 'Your details are encrypted and secure' },
    { Icon: ShieldCheck, text: lang === 'he' ? 'הטיוטה נשמרת אוטומטית' : 'Your draft is saved automatically' },
  ]

  return (
    <>
      {/* ── COMPACT INLINE HEADER — eyebrow → serif title → lede + step indicator (start-aligned) ── */}
      <section className="req-header">
        <div className="page-container req-header-container req-header-container-compact">
          <Reveal>
            <div className="req-header-inner">
              <span className="eyebrow req-header-eyebrow">{rq.inlineHeader.eyebrow}</span>
              <h1 className="section-display-bold req-header-title">{rq.inlineHeader.title}</h1>
              <p className="section-lede req-header-lede">{rq.inlineHeader.lede}</p>
            </div>
          </Reveal>
          <div className="req-header-stepper">
            <StepIndicator steps={steps} currentStep={step} progressLabel={rq.progressLabel} />
          </div>
        </div>
      </section>

      <div className="page-container req-shell-compact">
        {/* #86 — email-not-verified banner; shown only when user is signed in but unverified */}
        {!emailVerified && (
          <div className="form-banner form-banner-info req-banner" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            <span className="req-banner-text">{vb.text}</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleResendVerification}
              disabled={resendSent}
            >
              {resendSent ? vb.sent : vb.resend}
            </button>
          </div>
        )}

        {/* FEATURE 1 — volunteer on-behalf banner */}
        {role === 'volunteer' && (
          <div className="form-banner form-banner-info req-banner" role="status">
            <Users size={16} aria-hidden="true" />
            <span className="req-banner-text">{rq.onBehalf.banner}</span>
          </div>
        )}

        <Reveal>
        <div className="card" style={{ overflow:'hidden', boxShadow:'var(--shadow-lg)' }}>
          <div className="card-body" style={{ padding:'clamp(24px, 4vw, 40px)' }}>

            {children}

          </div>
        </div>
        </Reveal>

        {/* NAV BUTTONS */}
        <div className="req-nav">
          {step > 1 ? (
            <button className="btn btn-outline" onClick={() => setStep(s => s - 1)} disabled={submitting}>
              <BackArrow size={16} aria-hidden="true" /> {rq.nav.back}
            </button>
          ) : <span />}
          {/* #86 — email verification is a gentle reminder (banner above), NOT a
              hard block: an unverified user can still submit a request. */}
          <button
            className={`btn ${step === 4 ? 'btn-ember' : 'btn-primary'} btn-lg${submitting ? ' is-loading' : ''}`}
            onClick={goNext}
            disabled={submitting}
            aria-busy={submitting}
          >
            {step === 4 ? (
              <><CheckCircle size={16} aria-hidden="true" /> {rq.nav.submit}</>
            ) : (
              <>{rq.nav.next} <NextArrow size={16} aria-hidden="true" /></>
            )}
          </button>
        </div>

        {/* Quiet reassurance strip — sets expectations and signals trust. */}
        <Reveal delay={0.1}>
          <ul className="req-trust">
            {trustItems.map(({ Icon, text }, i) => (
              <li key={i} className="req-trust-item">
                <span className="req-trust-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="req-trust-text">{text}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </>
  )
}
