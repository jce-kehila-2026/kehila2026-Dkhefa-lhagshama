import { useState } from 'react'
import Link from 'next/link'
import { ShieldOff, Mail, ArrowLeft, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import Reveal from '../components/motion/Reveal'

/**
 * #87 — Account-disabled landing page.
 *
 * Shown after AuthContext detects `users/{uid}.disabled === true`, signs the
 * user out, and redirects here. The tone is calm and informative (not an error
 * shout): it explains what happened and offers a way to reach the team.
 */
export default function AccountDisabledPage() {
  const { t, isRTL, lang } = useLanguage()
  const d = t.accountDisabled
  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft

  // Subtle affordance feedback on the icon-only / link surfaces.
  const [homeHover, setHomeHover] = useState(false)
  const [mailHover, setMailHover] = useState(false)

  return (
    <main
      style={{
        minHeight: 'calc(100vh - var(--nav-h))',
        display: 'grid',
        placeItems: 'center',
        background:
          'radial-gradient(120% 90% at 50% -10%, var(--sky-3) 0%, var(--paper) 55%, var(--paper) 100%)',
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
            position: 'relative',
            width: '100%',
            maxWidth: '34rem',
            textAlign: 'center',
            paddingBlock: 'clamp(40px, 6vw, 56px)',
            paddingInline: 'clamp(24px, 5vw, 48px)',
            borderRadius: 'var(--radius-xl)',
            border: '1px solid var(--hair)',
            background: 'var(--white)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}
        >
          {/* Ember hairline accent along the top edge */}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              insetInline: 0,
              insetBlockStart: 0,
              height: '4px',
              background:
                'linear-gradient(90deg, var(--ember) 0%, var(--ember-700) 100%)',
            }}
          />

          {/* Icon medallion — soft ember halo, shield set in a tinted disc */}
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
            <ShieldOff size={32} strokeWidth={1.75} />
          </span>

          {/* Eyebrow label — monospace, uppercase, ember */}
          <span
            className="eyebrow"
            style={{
              display: 'block',
              color: 'var(--ember)',
              marginBlockEnd: 'var(--sp-3)',
            }}
          >
            {lang === 'he' ? 'הודעת מערכת' : 'Account notice'}
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
            {d.title}
          </h1>

          <p
            style={{
              fontSize: 'var(--fs-lede)',
              lineHeight: 1.65,
              color: 'var(--gray-600)',
              margin: '0 auto',
              maxWidth: '28rem',
              textWrap: 'pretty',
            }}
          >
            {d.body}
          </p>

          {/* Contact row — quiet card surface that lifts on hover/focus */}
          <a
            href={`mailto:${d.contactEmail}`}
            onMouseEnter={() => setMailHover(true)}
            onMouseLeave={() => setMailHover(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
              marginBlockStart: 'var(--sp-6)',
              paddingBlock: 'var(--sp-3)',
              paddingInline: 'var(--sp-5)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--hair)',
              background: mailHover ? 'var(--sky-3)' : 'var(--paper)',
              color: 'var(--ink-2)',
              fontSize: 'var(--fs-sm)',
              fontWeight: 600,
              textDecoration: 'none',
              direction: 'ltr',
              transition:
                'background var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out)',
              boxShadow: mailHover ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <Mail size={16} aria-hidden="true" style={{ color: 'var(--ember)' }} />
            <span>{d.contactEmail}</span>
          </a>

          {/* Divider before the primary action */}
          <span
            aria-hidden="true"
            style={{
              display: 'block',
              height: '1px',
              background: 'var(--hair)',
              margin: 'var(--sp-6) auto var(--sp-6)',
              maxWidth: '12rem',
            }}
          />

          <Link
            href="/"
            onMouseEnter={() => setHomeHover(true)}
            onMouseLeave={() => setHomeHover(false)}
            className="btn btn-ember btn-lg"
            style={{ textDecoration: 'none' }}
          >
            <ArrowIcon
              size={16}
              aria-hidden="true"
              style={{
                transition: 'transform var(--dur-2) var(--ease-out)',
                transform: homeHover
                  ? `translateX(${isRTL ? '3px' : '-3px'})`
                  : 'translateX(0)',
              }}
            />
            {d.backHome}
          </Link>
        </section>
      </Reveal>
    </main>
  )
}
