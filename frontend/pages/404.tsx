import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'

export default function Custom404() {
  const { lang } = useLanguage()
  const isHe = lang === 'he'
  return (
    <main style={{ padding: '120px 24px', textAlign: 'center' }}>
      <h1 style={{ fontSize: 48, marginBottom: 12 }}>404</h1>
      <p style={{ marginBottom: 24 }}>
        {isHe ? 'הדף לא נמצא' : 'Page not found'}
      </p>
      <Link href="/" className="btn btn-primary">
        {isHe ? 'חזרה לדף הבית' : 'Back to Home'}
      </Link>
    </main>
  )
}
