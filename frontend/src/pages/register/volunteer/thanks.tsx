/**
 * /register/volunteer/thanks — Post-application confirmation page.
 *
 * Shown after a user completes the two-step volunteer signup flow
 * (Firebase sign-up → POST /api/volunteers/apply → redirect here).
 *
 * Bilingual: reads `volunteerSignup.thanks*` keys from translations.js.
 * Issue #69.
 */
import { useState } from 'react'
import Link from 'next/link'
import { Check, ArrowLeft, ArrowRight } from 'lucide-react'

import { useLanguage } from '@/contexts/LanguageContext'
import Reveal from '@/components/motion/Reveal'
import styles from './thanks.module.css'

// terminal confirmation screen for the volunteer signup flow; pure
// presentational (no data fetch, no side effects), state is only the hover nudge.
export default function VolunteerThanksPage() {
  const { t, isRTL } = useLanguage()
  const v = t.volunteerSignup
  // home arrow points back toward content: left in LTR, right in RTL.
  const HomeArrow = isRTL ? ArrowRight : ArrowLeft

  // Subtle directional nudge on the primary action, RTL-aware.
  const [homeHover, setHomeHover] = useState(false)

  return (
    <main className={styles.main}>
      <Reveal>
        <section
          role="status"
          aria-live="polite"
          className={`card ${styles.card}`}
        >
          {/* Success medallion — tinted ember disc, ember check, soft sky halo.
              Reveals a beat after the card so the check reads as confirmation. */}
          <Reveal delay={0.12} y={8}>
            <span aria-hidden="true" className={styles.medallion}>
              <Check size={34} strokeWidth={2.25} />
            </span>
          </Reveal>

          {/* Eyebrow label — monospace, uppercase, ember */}
          <span className={`eyebrow ${styles.eyebrow}`}>
            {v.thanksEyebrow}
          </span>

          <h1 className={styles.title}>
            {v.thanksTitle}
          </h1>

          <p className={`section-lede ${styles.lede}`}>
            {v.thanksSubtitle}
          </p>

          {/* Divider before the primary action */}
          <span aria-hidden="true" className={styles.divider} />

          <Link
            href="/"
            onMouseEnter={() => setHomeHover(true)}
            onMouseLeave={() => setHomeHover(false)}
            onFocus={() => setHomeHover(true)}
            onBlur={() => setHomeHover(false)}
            className={`btn btn-primary btn-lg ${styles.homeLink}`}
          >
            <HomeArrow
              size={16}
              aria-hidden="true"
              className={styles.homeArrow}
              style={{
                transform: homeHover
                  ? `translateX(${isRTL ? '3px' : '-3px'})`
                  : 'translateX(0)',
              }}
            />
            {v.thanksBackHome}
          </Link>
        </section>
      </Reveal>
    </main>
  )
}
