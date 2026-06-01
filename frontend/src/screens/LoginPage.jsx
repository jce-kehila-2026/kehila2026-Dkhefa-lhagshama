import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { AlertCircle, ArrowLeft, ArrowRight, ShieldCheck, HeartHandshake, Users } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { validateRedirect } from '../utils/validateRedirect' // #88
import { mockStats } from '../data/mockData'
import AssetImage from '../components/AssetImage'
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

  const orgName = lang === 'he' ? 'עמותת דחיפה להגשמה' : 'Push for Fulfillment'

  // Quiet reassurance points shown on the brand aside. Reuse existing
  // translated label fragments (t.hero.stats.*) but pair each with its
  // numeric value from mockStats so the chips read as coherent credibility
  // signals (the labels are designed to sit under a number, not stand alone).
  // Icons are aligned to meaning: people → beneficiaries, partnership →
  // volunteers, shield → satisfaction.
  const trustPoints = [
    {
      icon: <Users size={18} strokeWidth={2.25} />,
      label: `${mockStats.beneficiaries.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US')} ${t.hero.stats.beneficiaries}`,
    },
    {
      icon: <HeartHandshake size={18} strokeWidth={2.25} />,
      label: `${mockStats.volunteers.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US')}+ ${t.hero.stats.volunteers}`,
    },
    {
      icon: <ShieldCheck size={18} strokeWidth={2.25} />,
      label: `${mockStats.satisfaction}% ${t.hero.stats.satisfaction}`,
    },
  ]

  return (
    <div className="auth-grid" style={{ minHeight: 'calc(100vh - var(--nav-h))' }}>
      {/* ── Brand aside — image + welcome + quiet trust signals. Hidden on small screens. ── */}
      <aside
        className="auth-aside"
        style={{
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Soft layered wash to give the panel depth without competing with the form */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            insetInlineEnd: '-12%',
            insetBlockStart: '-18%',
            width: '60%',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(185,105,78,0.16), transparent 68%)',
            pointerEvents: 'none',
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            insetInlineStart: '-14%',
            insetBlockEnd: '-16%',
            width: '52%',
            aspectRatio: '1 / 1',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(15,30,45,0.07), transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div className="auth-aside-inner" style={{ position: 'relative', zIndex: 1 }}>
          <Reveal y={20}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <AssetImage
                slot="authAside"
                rounded="50%"
                ratio="1 / 1"
                shadow="var(--shadow-lg)"
                border="4px solid var(--paper)"
                priority
                style={{ width: 104, height: 104 }}
              />
              <span
                className="eyebrow"
                style={{ textAlign: 'center', color: 'var(--ember)', margin: '24px 0 10px' }}
              >
                {orgName}
              </span>
              <h1
                style={{
                  fontFamily: 'Frank Ruhl Libre, Georgia, serif',
                  fontSize: 'var(--fs-display)',
                  fontWeight: 400,
                  color: 'var(--ink)',
                  lineHeight: 1.14,
                  letterSpacing: '-0.01em',
                  textAlign: 'center',
                  maxWidth: '24rem',
                  margin: 0,
                  textWrap: 'balance',
                }}
              >
                {a.title}
              </h1>
              {a.subtitle && (
                <p
                  className="section-lede"
                  style={{
                    textAlign: 'center',
                    margin: '16px auto 0',
                    maxWidth: '26rem',
                    fontSize: '1.0625rem',
                  }}
                >
                  {a.subtitle}
                </p>
              )}
            </div>
          </Reveal>

          <Reveal y={20} delay={0.12}>
            <ul
              style={{
                listStyle: 'none',
                margin: '36px 0 0',
                padding: 0,
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '10px',
              }}
            >
              {trustPoints.map((p, i) => (
                <li
                  key={i}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    paddingBlock: '8px',
                    paddingInline: '14px',
                    background: 'var(--white)',
                    border: '1px solid var(--hair)',
                    borderRadius: '999px',
                    boxShadow: 'var(--shadow-xs)',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: 600,
                    color: 'var(--ink-2)',
                  }}
                >
                  <span style={{ color: 'var(--ember)', display: 'inline-flex' }}>{p.icon}</span>
                  {p.label}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </aside>

      {/* ── Form column ───────────────────────────────────────────── */}
      <main className="auth-main">
        <Reveal y={24}>
          <form
            onSubmit={onSubmit}
            className="auth-form"
            noValidate
            style={{ gap: '20px', boxShadow: 'var(--shadow-lg)', borderColor: 'var(--hair)' }}
          >
            <header style={{ marginBlockEnd: '2px' }}>
              <span
                className="eyebrow"
                style={{ color: 'var(--ember)', display: 'block', marginBlockEnd: '10px' }}
              >
                {orgName}
              </span>
              <h2
                style={{
                  fontFamily: 'Frank Ruhl Libre, Georgia, serif',
                  fontWeight: 400,
                  fontSize: 'var(--fs-h2)',
                  color: 'var(--ink)',
                  lineHeight: 1.16,
                  letterSpacing: '-0.01em',
                  margin: 0,
                  textWrap: 'balance',
                }}
              >
                {a.title}
              </h2>
              {a.subtitle && (
                <p
                  style={{
                    margin: '8px 0 0',
                    color: 'var(--gray-600)',
                    fontSize: 'var(--fs-sm)',
                    lineHeight: 1.55,
                  }}
                >
                  {a.subtitle}
                </p>
              )}
            </header>

            {error && (
              <div className="form-banner form-banner-error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="form-group" style={{ marginBlockEnd: 0 }}>
              <label className="form-label" htmlFor="login-email" style={{ textAlign: 'start' }}>
                {a.email}
              </label>
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
              <label className="form-label" htmlFor="login-password" style={{ textAlign: 'start' }}>
                {a.password}
              </label>
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
              className={`btn btn-ember btn-full${submitting ? ' is-loading' : ''}`}
              style={{
                marginBlockStart: 4,
                gap: '8px',
                fontWeight: 600,
              }}
            >
              {submitting ? a.submitting : a.submit}
              {!submitting && <ArrowIcon size={16} aria-hidden="true" />}
            </button>

            <p
              style={{
                fontSize: 'var(--fs-sm)',
                textAlign: 'center',
                color: 'var(--gray-600)',
                margin: '6px 0 0',
                paddingBlockStart: '16px',
                borderBlockStart: '1px solid var(--hair)',
              }}
            >
              {a.noAccount}{' '}
              <Link
                href="/register"
                style={{
                  color: 'var(--ember)',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                }}
              >
                {a.registerLink}
              </Link>
            </p>
          </form>
        </Reveal>
      </main>
    </div>
  )
}
