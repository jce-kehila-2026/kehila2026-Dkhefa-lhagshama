import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

export default function Custom404() {
  const { t, isRTL } = useLanguage()
  // Home points "back" into the app; mirror the arrow for RTL.
  const HomeArrow = isRTL ? ArrowRight : ArrowLeft
  return (
    <main
      className="page-enter"
      style={{
        minHeight: 'calc(100vh - var(--nav-h))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '80px 24px',
        background: 'var(--paper)',
      }}
    >
      <div
        role="status"
        aria-live="polite"
        aria-labelledby="notfound-title"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <span className="eyebrow" style={{ color: 'var(--ember)' }}>
          {t.notFound.eyebrow}
        </span>
        <span
          aria-hidden="true"
          style={{
            fontFamily: 'Frank Ruhl Libre, Georgia, serif',
            fontSize: 'clamp(4rem, 14vw, 8rem)',
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--ink)',
            letterSpacing: '-0.03em',
          }}
        >
          404
        </span>
        <span className="gold-line center" aria-hidden="true" style={{ marginBlock: '24px' }} />
        <h1
          id="notfound-title"
          style={{
            fontFamily: 'Frank Ruhl Libre, Georgia, serif',
            fontWeight: 400,
            fontSize: 'var(--fs-h2)',
            color: 'var(--ink)',
            margin: '0 0 12px',
            textWrap: 'balance',
          }}
        >
          {t.notFound.title}
        </h1>
        <p className="section-lede" style={{ margin: '0 auto 28px', maxWidth: '30rem' }}>
          {t.notFound.subtitle}
        </p>
        <Link href="/" className="btn btn-primary btn-lg">
          <HomeArrow size={18} strokeWidth={2} aria-hidden="true" />
          {t.notFound.btn}
        </Link>
      </div>
    </main>
  )
}
