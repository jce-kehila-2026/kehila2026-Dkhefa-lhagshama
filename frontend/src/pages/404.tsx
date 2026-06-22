/**
 * Custom 404 page (Next.js Pages Router special route).
 * Next renders this for any unmatched URL; it has no data deps and runs client-side.
 * Fully bilingual: all copy comes from the shared LanguageContext (t.notFound), and
 * direction (LTR/RTL) drives the home-link arrow so it always points "back" into the app.
 */
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import styles from './404.module.css'

// static, translation-driven not-found panel; aria role="status"/live region so SRs
// announce it on soft (client-side) navigations to a missing route.
export default function Custom404() {
  const { t, isRTL } = useLanguage()
  // home points "back" into the app, so mirror the arrow direction for RTL (Hebrew).
  const HomeArrow = isRTL ? ArrowRight : ArrowLeft
  return (
    <main className={`page-enter ${styles.main}`}>
      <div
        role="status"
        aria-live="polite"
        aria-labelledby="notfound-title"
        className={styles.panel}
      >
        <span className={`eyebrow ${styles.eyebrow}`}>
          {t.notFound.eyebrow}
        </span>
        <span aria-hidden="true" className={styles.bigCode}>
          404
        </span>
        <span className={`gold-line center ${styles.divider}`} aria-hidden="true" />
        <h1 id="notfound-title" className={styles.title}>
          {t.notFound.title}
        </h1>
        <p className={`section-lede ${styles.lede}`}>
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
