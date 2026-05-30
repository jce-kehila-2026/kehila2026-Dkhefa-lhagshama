import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AlertCircle } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { validateRedirect } from '../utils/validateRedirect' // #88
import AssetImage from '../components/AssetImage'

export default function LoginPage() {
  const { t, lang } = useLanguage()
  const { login } = useAuth()
  const router = useRouter()
  const a = t.auth.login

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
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
    }
  }

  return (
    <div className="auth-grid" style={{ minHeight: 'calc(100vh - var(--nav-h))' }}>
      {/* Brand aside — image + welcome. Hidden on small screens. */}
      <aside className="auth-aside">
        <div className="auth-aside-inner">
          <AssetImage
            slot="authAside"
            rounded="50%"
            ratio="1 / 1"
            shadow="var(--shadow)"
            border="3px solid var(--paper)"
            priority
            style={{ width: 88, height: 88 }}
          />
          <span className="eyebrow" style={{ textAlign: 'center', margin: '20px 0 8px' }}>
            {lang === 'he' ? 'עמותת דחיפה להגשמה' : 'Push for Fulfillment'}
          </span>
          <h1
            style={{
              fontFamily: 'Frank Ruhl Libre, Georgia, serif',
              fontSize: 'var(--fs-h2)', fontWeight: 400, color: 'var(--ink)',
              lineHeight: 1.18, textAlign: 'center', maxWidth: '22rem', margin: 0, textWrap: 'balance',
            }}
          >
            {a.title}
          </h1>
          {a.subtitle && (
            <p className="section-lede" style={{ textAlign: 'center', margin: '14px auto 0', maxWidth: '26rem', fontSize: '1rem' }}>
              {a.subtitle}
            </p>
          )}
        </div>
      </aside>

      {/* Form column */}
      <main className="auth-main">
        <form onSubmit={onSubmit} className="auth-form" noValidate>
          <h2 style={{ fontFamily: 'Frank Ruhl Libre, serif', fontWeight: 400, fontSize: '1.5rem', color: 'var(--ink)', margin: 0 }}>
            {a.title}
          </h2>

          {error && (
            <div className="form-banner form-banner-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="form-group" style={{ marginBlockEnd: 0 }}>
            <label className="form-label" htmlFor="login-email">{a.email}</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`form-input${error ? ' error' : ''}`}
              aria-invalid={Boolean(error)}
            />
          </div>

          <div className="form-group" style={{ marginBlockEnd: 0 }}>
            <label className="form-label" htmlFor="login-password">{a.password}</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`form-input${error ? ' error' : ''}`}
              aria-invalid={Boolean(error)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className={`btn btn-primary btn-full${submitting ? ' is-loading' : ''}`}
            style={{ marginBlockStart: 4 }}
          >
            {submitting ? a.submitting : a.submit}
          </button>

          <p style={{ fontSize: 13.5, textAlign: 'center', color: 'var(--ink-2)', margin: '4px 0 0' }}>
            {a.noAccount}{' '}
            <Link href="/register" style={{ color: 'var(--ember)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
              {a.registerLink}
            </Link>
          </p>
        </form>
      </main>
    </div>
  )
}
