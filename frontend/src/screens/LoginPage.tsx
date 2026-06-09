import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AlertCircle, ArrowLeft, ArrowRight, ShieldCheck, HeartHandshake, Users } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { validateRedirect } from '../utils/validateRedirect' // #88
import { mockStats } from '../data/mockData'
import AssetImage from '@/components/layout/AssetImage'
import Reveal from '../components/motion/Reveal'

export default function LoginPage() {
  const { t, lang, isRTL } = useLanguage()
  const { login } = useAuth()
  const router = useRouter()
  const a = t.auth.login
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // First field, so we can move focus to the start of the form when the
  // credentials are rejected (web-guidelines: "focus first error on submit").
  const emailRef = useRef<HTMLInputElement>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      // #88 — validateRedirect ensures `next` is a same-origin relative path only
      const safe = validateRedirect(router.query.next, '/')
      router.push(safe)
    } catch {
      setError(a.error)
      setSubmitting(false)
      // Return keyboard focus to the first field so the user can correct and
      // retry without reaching for the mouse. The error text itself is
      // announced via the role="alert" banner referenced by aria-describedby.
      emailRef.current?.focus()
    }
  }

  const orgName = lang === 'he' ? 'עמותת דחיפה להגשמה' : 'Push for Fulfillment'

  // Quiet reassurance points shown on the brand aside. Reuse existing
  // translated label fragments (t.hero.stats.*) but pair each with its
  // numeric value from mockStats so the chips read as coherent credibility
  // signals (the labels are designed to sit under a number, not stand alone).
  // Icons are aligned to meaning: people → beneficiaries, partnership →
  // volunteers, shield → satisfaction.
  const trustPoints = [
    {
      icon: <Users size={18} strokeWidth={2.25} aria-hidden="true" />,
      label: `${mockStats.beneficiaries.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US')} ${t.hero.stats.beneficiaries}`,
    },
    {
      icon: <HeartHandshake size={18} strokeWidth={2.25} aria-hidden="true" />,
      label: `${mockStats.volunteers.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US')}+ ${t.hero.stats.volunteers}`,
    },
    {
      icon: <ShieldCheck size={18} strokeWidth={2.25} aria-hidden="true" />,
      label: `${mockStats.satisfaction}% ${t.hero.stats.satisfaction}`,
    },
  ]

  return (
    <div className="auth-grid" style={{ minHeight: 'calc(100vh - var(--nav-h))' }}>
      {/* ── Brand aside — image + welcome + quiet trust signals. Hidden on small screens. ── */}
      <aside className="auth-aside">
        {/* Flat tinted corner blocks give the panel depth without a gradient. */}
        <span aria-hidden="true" className="login-aside-wash login-aside-wash--ember" />
        <span aria-hidden="true" className="login-aside-wash login-aside-wash--sky" />

        <div className="auth-aside-inner">
          <Reveal y={20}>
            <div className="login-aside-head">
              <AssetImage
                slot="authAside"
                rounded="50%"
                ratio="1 / 1"
                shadow="var(--shadow-lg)"
                border="4px solid var(--paper)"
                priority
                className="login-aside-avatar"
              />
              <span className="eyebrow login-aside-org">{orgName}</span>
              <h1 className="login-aside-title">{a.title}</h1>
              {a.subtitle && <p className="login-aside-lede">{a.subtitle}</p>}
            </div>
          </Reveal>

          <Reveal y={20} delay={0.12}>
            <ul className="login-trust">
              {trustPoints.map((p, i) => (
                <li key={i} className="login-trust-item">
                  <span className="login-trust-icon">{p.icon}</span>
                  {p.label}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </aside>

      {/* ── Form column ───────────────────────────────────────────── */}
      <main className="auth-main">
        <Reveal y={16}>
          <form onSubmit={onSubmit} className="auth-form" noValidate>
            <header className="login-form-head">
              <span className="eyebrow login-form-org">{orgName}</span>
              <h2 className="login-form-title">{a.title}</h2>
              {a.subtitle && <p className="login-form-sub">{a.subtitle}</p>}
            </header>

            {error && (
              <div id="login-error" className="form-banner form-banner-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="login-email">
                {a.email}
              </label>
              <input
                ref={emailRef}
                id="login-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`form-input${error ? ' error' : ''}`}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">
                {a.password}
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`form-input${error ? ' error' : ''}`}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              aria-busy={submitting}
              className={`btn btn-ember btn-full login-submit${submitting ? ' is-loading' : ''}`}
            >
              {submitting ? a.submitting : a.submit}
              {!submitting && <ArrowIcon size={16} aria-hidden="true" />}
            </button>

            <p className="login-alt">
              {a.noAccount}{' '}
              <Link href="/register" className="login-alt-link">
                {a.registerLink}
              </Link>
            </p>
          </form>
        </Reveal>
      </main>
    </div>
  )
}
