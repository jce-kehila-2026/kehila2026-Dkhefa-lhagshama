/**
 * /register/volunteer/thanks — Post-application confirmation page.
 *
 * Shown after a user completes the two-step volunteer signup flow
 * (Firebase sign-up → POST /api/volunteers/apply → redirect here).
 *
 * Bilingual: reads `volunteerSignup.thanks*` keys from translations.js.
 * Issue #69.
 */
import Link from 'next/link'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { useLanguage } from '@/contexts/LanguageContext'

export default function VolunteerThanksPage() {
  // LanguageContext is a .jsx file without TS types; cast to access shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { t, lang } = useLanguage() as any
  const v = t.volunteerSignup as {
    thanksTitle: string
    thanksSubtitle: string
    thanksBackHome: string
  }
  const isRtl = lang === 'he'

  return (
    <main
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{
        minHeight: 'calc(100vh - 64px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        background: 'var(--paper)',
        textAlign: 'center',
      }}
    >
      {/* Success icon */}
      <div
        aria-hidden="true"
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'var(--ember)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 28,
          flexShrink: 0,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={40}
          height={40}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h1
        className="section-display"
        style={{
          fontSize: 'clamp(1.6rem, 4vw, 2.25rem)',
          marginBottom: 16,
          maxWidth: '28rem',
        }}
      >
        {v.thanksTitle}
      </h1>

      <p
        className="section-lede"
        style={{
          maxWidth: '32rem',
          marginBottom: 36,
          color: 'var(--ink-2)',
        }}
      >
        {v.thanksSubtitle}
      </p>

      <Link href="/" className="btn btn-primary" style={{ minWidth: 180 }}>
        {v.thanksBackHome}
      </Link>
    </main>
  )
}
