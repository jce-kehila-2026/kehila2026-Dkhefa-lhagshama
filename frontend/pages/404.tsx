import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'

export default function Custom404() {
  const { lang } = useLanguage()
  const isHe = lang === 'he'
  return (
    <main
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
      <span
        style={{
          display: 'block',
          width: 48,
          height: 2,
          background: 'var(--ember)',
          margin: '24px auto',
          borderRadius: 2,
        }}
        aria-hidden="true"
      />
      <h1
        style={{
          fontFamily: 'Frank Ruhl Libre, Georgia, serif',
          fontWeight: 400,
          fontSize: 'var(--fs-h2)',
          color: 'var(--ink)',
          margin: '0 0 12px',
        }}
      >
        {isHe ? 'הדף לא נמצא' : 'Page not found'}
      </h1>
      <p className="section-lede" style={{ margin: '0 auto 28px', maxWidth: '30rem' }}>
        {isHe
          ? 'הקישור שביקשת אינו קיים או הוסר. אפשר לחזור לדף הבית ולהמשיך משם.'
          : 'The page you asked for does not exist or was moved. Head back home to continue.'}
      </p>
      <Link href="/" className="btn btn-primary btn-lg">
        {isHe ? 'חזרה לדף הבית' : 'Back to home'}
      </Link>
    </main>
  )
}
