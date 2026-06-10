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

export default function VolunteerThanksPage() {
  const { t, isRTL } = useLanguage()
  const v = t.volunteerSignup
  const HomeArrow = isRTL ? ArrowRight : ArrowLeft

  // Subtle directional nudge on the primary action, RTL-aware.
  const [homeHover, setHomeHover] = useState(false)

  return (
    <main
      style={{
        minHeight: 'calc(100vh - var(--nav-h))',
        display: 'grid',
        placeItems: 'center',
        background: 'var(--paper)',
        paddingBlock: 'clamp(48px, 9vw, 96px)',
        paddingInline: 'clamp(20px, 5vw, 40px)',
      }}
    >
      <Reveal>
        <section
          role="status"
          aria-live="polite"
          className="card"
          style={{
            width: '100%',
            maxWidth: '34rem',
            textAlign: 'center',
            paddingBlock: 'clamp(40px, 6vw, 56px)',
            paddingInline: 'clamp(24px, 5vw, 48px)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--hair)',
            background: 'var(--white)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Success medallion — tinted ember disc, ember check, soft sky halo.
              Reveals a beat after the card so the check reads as confirmation. */}
          <Reveal delay={0.12} y={8}>
            <span
              aria-hidden="true"
              style={{
                display: 'inline-grid',
                placeItems: 'center',
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                marginBlockEnd: 'var(--sp-5)',
                color: 'var(--ember)',
                background: 'var(--ember-soft)',
                boxShadow: '0 0 0 8px var(--sky-3)',
              }}
            >
              <Check size={34} strokeWidth={2.25} />
            </span>
          </Reveal>

          {/* Eyebrow label — monospace, uppercase, ember */}
          <span
            className="eyebrow"
            style={{
              display: 'block',
              color: 'var(--ember)',
              marginBlockEnd: 'var(--sp-3)',
            }}
          >
            {v.thanksEyebrow}
          </span>

          <h1
            style={{
              fontFamily: 'Frank Ruhl Libre, Georgia, serif',
              fontSize: 'var(--fs-display)',
              fontWeight: 400,
              lineHeight: 1.14,
              letterSpacing: '-0.01em',
              color: 'var(--ink)',
              margin: '0 0 var(--sp-4)',
              textWrap: 'balance',
            }}
          >
            {v.thanksTitle}
          </h1>

          <p
            className="section-lede"
            style={{
              margin: '0 auto',
              maxWidth: '30rem',
              color: 'var(--ink-2)',
              textWrap: 'pretty',
            }}
          >
            {v.thanksSubtitle}
          </p>

          {/* Divider before the primary action */}
          <span
            aria-hidden="true"
            style={{
              display: 'block',
              height: '1px',
              background: 'var(--hair)',
              margin: 'var(--sp-6) auto',
              maxWidth: '12rem',
            }}
          />

          <Link
            href="/"
            onMouseEnter={() => setHomeHover(true)}
            onMouseLeave={() => setHomeHover(false)}
            onFocus={() => setHomeHover(true)}
            onBlur={() => setHomeHover(false)}
            className="btn btn-primary btn-lg"
            style={{ textDecoration: 'none' }}
          >
            <HomeArrow
              size={16}
              aria-hidden="true"
              style={{
                transition: 'transform var(--dur-2) var(--ease-out)',
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
