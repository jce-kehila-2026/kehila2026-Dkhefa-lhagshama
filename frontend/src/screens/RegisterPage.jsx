import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import PageHeader from '../components/PageHeader'

export default function RegisterPage() {
  const { t } = useLanguage()
  const { register } = useAuth()
  const router = useRouter()
  const a = t.auth.register

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError(a.passwordTooShort); return }
    if (password !== confirm) { setError(a.passwordMismatch); return }

    setSubmitting(true)
    try {
      await register(email, password)
      const next = typeof router.query.next === 'string' ? router.query.next : '/'
      router.push(next)
    } catch (err) {
      const msg = err && err.message ? String(err.message) : ''
      if (msg.includes('email-already-in-use')) setError(a.emailInUse)
      else setError(a.error)
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader title={a.title} subtitle={a.subtitle} />
      <div className="page-container" style={{ maxWidth: 480, padding: '40px 1.5rem' }}>
        <form onSubmit={onSubmit} className="card" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: 'var(--gray-700)' }}>
            {a.email}
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ padding: '10px 12px', border: '1px solid var(--gray-300)', borderRadius: 8, fontSize: 15 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: 'var(--gray-700)' }}>
            {a.password}
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ padding: '10px 12px', border: '1px solid var(--gray-300)', borderRadius: 8, fontSize: 15 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, color: 'var(--gray-700)' }}>
            {a.confirmPassword}
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={{ padding: '10px 12px', border: '1px solid var(--gray-300)', borderRadius: 8, fontSize: 15 }}
            />
          </label>
          {error && <div style={{ color: '#b91c1c', fontSize: 14 }}>{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ marginTop: 8 }}
          >
            {submitting ? a.submitting : a.submit}
          </button>
          <div style={{ fontSize: 14, textAlign: 'center', color: 'var(--gray-600)', marginTop: 4 }}>
            {a.haveAccount}{' '}
            <Link href="/login" style={{ color: 'var(--navy)', fontWeight: 600 }}>
              {a.loginLink}
            </Link>
          </div>
        </form>
      </div>
    </>
  )
}
