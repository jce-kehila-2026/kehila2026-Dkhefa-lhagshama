/**
 * AccountDisabledPage — the calm "your account is disabled" landing screen.
 *
 * Its one job: render a static, reassuring page (icon + title + body + a contact
 * mailto + a back-home button) for a user the platform has already signed out and
 * redirected here. It owns no auth logic itself; the disabled-detection and sign-out
 * happen upstream in AuthContext. Collaborators: useLanguage (HE/EN copy + RTL flag),
 * the shared Reveal motion wrapper, lucide icons, and styles/screens/account-disabled.css.
 *
 * Big picture: this is a pure presentational dead-end screen, so there is no state,
 * no effects, no data fetching. RTL is handled by flipping only the back-arrow glyph;
 * everything else is driven by logical-property CSS.
 */
import Link from 'next/link'
import { ShieldOff, Mail, ArrowLeft, ArrowRight } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import Reveal from '../components/motion/Reveal'

/**
 * #87 Account-disabled landing page.
 *
 * Shown after AuthContext detects `users/{uid}.disabled === true`, signs the
 * user out, and redirects here. The tone is calm and informative (not an error
 * shout): it explains what happened and offers a way to reach the team.
 *
 * Presentation lives in styles/screens/account-disabled.css; this screen ships
 * structure + brand tokens only. Hover/focus affordances are CSS so keyboard
 * focus gets the same feedback as the pointer.
 */
export default function AccountDisabledPage() {
  const { t, isRTL } = useLanguage()
  const d = t.accountDisabled
  // back-arrow points toward the start edge: rightward in RTL (he), leftward in LTR (en)
  const ArrowIcon = isRTL ? ArrowRight : ArrowLeft

  return (
    <main className="disabled-main">
      <Reveal>
        <section className="card disabled-card" aria-labelledby="disabled-title">
          {/* Icon medallion: shield in a tinted disc with a soft sky halo */}
          <span aria-hidden="true" className="disabled-icon">
            <ShieldOff size={32} strokeWidth={1.75} />
          </span>

          <h1 id="disabled-title" className="disabled-title">
            {d.title}
          </h1>

          <p className="disabled-lead">{d.body}</p>

          {/* Contact row: quiet surface that lifts on hover/focus */}
          <a href={`mailto:${d.contactEmail}`} className="disabled-contact">
            <Mail size={16} aria-hidden="true" className="disabled-contact-icon" />
            <span>{d.contactEmail}</span>
          </a>

          <span aria-hidden="true" className="disabled-divider" />

          <Link href="/" className="btn btn-ember btn-lg disabled-home">
            <ArrowIcon size={16} aria-hidden="true" className="disabled-home-arrow" />
            {d.backHome}
          </Link>
        </section>
      </Reveal>
    </main>
  )
}
