import Link from 'next/link'
import { ShieldOff, Mail } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

/**
 * #87 — Account-disabled landing page.
 *
 * Shown after AuthContext detects `users/{uid}.disabled === true`, signs the
 * user out, and redirects here. The tone is calm and informative (not an error
 * shout): it explains what happened and offers a way to reach the team.
 */
export default function AccountDisabledPage() {
  const { t } = useLanguage()
  const d = t.accountDisabled

  return (
    <main className="auth-page">
      <div className="auth-card disabled-card" role="status" aria-live="polite">
        <span className="disabled-icon" aria-hidden="true">
          <ShieldOff size={28} />
        </span>

        <h1 className="auth-title">{d.title}</h1>
        <p className="auth-subtitle disabled-lead">{d.body}</p>

        <a className="disabled-contact" href={`mailto:${d.contactEmail}`}>
          <Mail size={16} aria-hidden="true" />
          <span>{d.contactEmail}</span>
        </a>

        <Link href="/" className="btn btn-primary disabled-home">
          {d.backHome}
        </Link>
      </div>
    </main>
  )
}
