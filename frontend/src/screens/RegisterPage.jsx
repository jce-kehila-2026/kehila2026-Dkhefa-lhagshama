/**
 * RegisterPage — Beneficiary / Volunteer tab toggle.
 *
 * Tab "Beneficiary" (default): original single-step sign-up → calls
 *   Firebase createUser + POST /api/auth/register (sets `beneficiary` claim).
 *
 * Tab "Volunteer": two-step flow
 *   Step 1 — email + password (same Firebase sign-up)
 *   Step 2 — volunteer details form → POST /api/volunteers/apply
 *   On success → redirect to /register/volunteer/thanks
 *
 * Issue #69.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useLanguage } from '../contexts/LanguageContext'
import { useAuth } from '../contexts/AuthContext'
import { apiFetch } from '../lib/apiClient'

// ── Shared input style ────────────────────────────────────────────────────────
const inputStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 13.5,
  color: 'var(--ink)',
  fontWeight: 500,
}

// ── Small checkbox component ──────────────────────────────────────────────────
function Checkbox({ checked, onChange, label }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.5 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3, flexShrink: 0 }}
      />
      <span>{label}</span>
    </label>
  )
}

// ── Tab toggle ────────────────────────────────────────────────────────────────
function TabToggle({ active, labels, onChange }) {
  return (
    <div style={{
      display: 'flex',
      borderRadius: 8,
      overflow: 'hidden',
      border: '1.5px solid var(--ember)',
      marginBottom: 20,
    }}>
      {['beneficiary', 'volunteer'].map((tab, i) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          style={{
            flex: 1,
            padding: '10px 0',
            fontSize: 14,
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            background: active === tab ? 'var(--ember)' : 'transparent',
            color: active === tab ? '#fff' : 'var(--ember)',
            borderRight: i === 0 ? '1.5px solid var(--ember)' : 'none',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {labels[tab]}
        </button>
      ))}
    </div>
  )
}

// ── BENEFICIARY FORM (original flow) ─────────────────────────────────────────
function BeneficiaryForm({ t }) {
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
    <form onSubmit={onSubmit} className="card" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <label style={inputStyle}>
        {a.email}
        <input type="email" autoComplete="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} className="form-input" />
      </label>
      <label style={inputStyle}>
        {a.password}
        <input type="password" autoComplete="new-password" required minLength={6}
          value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" />
      </label>
      <label style={inputStyle}>
        {a.confirmPassword}
        <input type="password" autoComplete="new-password" required minLength={6}
          value={confirm} onChange={(e) => setConfirm(e.target.value)} className="form-input" />
      </label>
      {error && <div style={{ color: 'var(--ember)', fontSize: 13.5 }}>{error}</div>}
      <button type="submit" disabled={submitting} className="btn btn-primary" style={{ marginTop: 4 }}>
        {submitting ? a.submitting : a.submit}
      </button>
      <div style={{ fontSize: 13.5, textAlign: 'center', color: 'var(--ink-2)', marginTop: 4 }}>
        {a.haveAccount}{' '}
        <Link href="/login" style={{ color: 'var(--ember)', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
          {a.loginLink}
        </Link>
      </div>
    </form>
  )
}

// ── VOLUNTEER FORM — step 1 (account) ────────────────────────────────────────
function VolunteerStep1({ v, a, onNext }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError(a.passwordTooShort); return }
    if (password !== confirm) { setError(a.passwordMismatch); return }
    onNext({ email, password })
  }

  return (
    <form onSubmit={submit} className="card" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, marginBottom: -4 }}>
        {v.step1Title}
      </div>
      <label style={inputStyle}>
        {a.email}
        <input type="email" autoComplete="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} className="form-input" />
      </label>
      <label style={inputStyle}>
        {a.password}
        <input type="password" autoComplete="new-password" required minLength={6}
          value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" />
      </label>
      <label style={inputStyle}>
        {a.confirmPassword}
        <input type="password" autoComplete="new-password" required minLength={6}
          value={confirm} onChange={(e) => setConfirm(e.target.value)} className="form-input" />
      </label>
      {error && <div style={{ color: 'var(--ember)', fontSize: 13.5 }}>{error}</div>}
      <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }}>
        {v.nextStep}
      </button>
      <div style={{ fontSize: 13.5, textAlign: 'center', color: 'var(--ink-2)', marginTop: 4 }}>
        {a.haveAccount}{' '}
        <Link href="/login" style={{ color: 'var(--ember)', fontWeight: 500, textDecoration: 'underline', textUnderlineOffset: '3px' }}>
          {a.loginLink}
        </Link>
      </div>
    </form>
  )
}

// ── VOLUNTEER FORM — step 2 (details) ────────────────────────────────────────
function VolunteerStep2({ v, a, accountData, onBack }) {
  const { register } = useAuth()
  const router = useRouter()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [profession, setProfession] = useState('')
  const [selectedAreas, setSelectedAreas] = useState([])
  const [languagesRaw, setLanguagesRaw] = useState('')
  const [availability, setAvailability] = useState('2-4')
  const [motivation, setMotivation] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const toggleArea = (area) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    )
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (selectedAreas.length === 0) { setError(v.minOneArea); return }
    const langs = languagesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    if (langs.length === 0) { setError(v.minOneLang); return }
    if (!consent) { setError(v.consentRequired); return }

    setSubmitting(true)
    try {
      // Step A: Firebase Auth sign-up + set beneficiary claim (same as beneficiary tab)
      // The admin will later promote to 'volunteer' after reviewing the application.
      await register(accountData.email, accountData.password)

      // Step B: POST volunteer application
      const res = await apiFetch('/api/volunteers/apply', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          email: accountData.email,
          city,
          profession,
          areasOfHelp: selectedAreas,
          languages: langs,
          availability,
          motivation,
          consent: true,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? 'apply_failed')
      }

      router.push('/register/volunteer/thanks')
    } catch (err) {
      const msg = err && err.message ? String(err.message) : ''
      if (msg.includes('email-already-in-use')) setError(a.emailInUse)
      else setError(a.error)
      setSubmitting(false)
    }
  }

  const availOptions = [
    { value: '2-4', label: v.avail24 },
    { value: '4-8', label: v.avail48 },
    { value: '8+',  label: v.avail8plus },
  ]

  return (
    <form onSubmit={submit} className="card" style={{ padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 500, marginBottom: -4 }}>
        {v.step2Title}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <label style={inputStyle}>
          {v.firstName}
          <input type="text" required value={firstName}
            onChange={(e) => setFirstName(e.target.value)} className="form-input" />
        </label>
        <label style={inputStyle}>
          {v.lastName}
          <input type="text" required value={lastName}
            onChange={(e) => setLastName(e.target.value)} className="form-input" />
        </label>
      </div>

      <label style={inputStyle}>
        {v.phone}
        <input type="tel" required value={phone}
          onChange={(e) => setPhone(e.target.value)} className="form-input" />
      </label>

      <label style={inputStyle}>
        {v.city}
        <input type="text" required value={city}
          onChange={(e) => setCity(e.target.value)} className="form-input" />
      </label>

      <label style={inputStyle}>
        {v.profession}
        <input type="text" placeholder={v.professionPH} value={profession}
          onChange={(e) => setProfession(e.target.value)} className="form-input" />
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{v.areasOfHelp}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {v.areasList.map((area) => (
            <button
              key={area}
              type="button"
              onClick={() => toggleArea(area)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 500,
                border: '1.5px solid var(--ember)',
                cursor: 'pointer',
                background: selectedAreas.includes(area) ? 'var(--ember)' : 'transparent',
                color: selectedAreas.includes(area) ? '#fff' : 'var(--ember)',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {area}
            </button>
          ))}
        </div>
      </div>

      <label style={inputStyle}>
        {v.languages}
        <input type="text" placeholder={v.languagesPH} value={languagesRaw}
          onChange={(e) => setLanguagesRaw(e.target.value)} className="form-input" />
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 500 }}>{v.availability}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {availOptions.map((opt) => (
            <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13.5 }}>
              <input type="radio" name="availability" value={opt.value}
                checked={availability === opt.value}
                onChange={() => setAvailability(opt.value)} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <label style={inputStyle}>
        {v.motivation}
        <textarea rows={3} placeholder={v.motivationPH} value={motivation}
          onChange={(e) => setMotivation(e.target.value)} className="form-input"
          style={{ resize: 'vertical', minHeight: 72 }} />
      </label>

      <Checkbox checked={consent} onChange={setConsent} label={v.consent} />

      {error && <div style={{ color: 'var(--ember)', fontSize: 13.5 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onBack} className="btn"
          style={{ flex: '0 0 auto', background: 'var(--paper)', border: '1.5px solid var(--sky-3)', color: 'var(--ink)' }}>
          {v.backStep}
        </button>
        <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1 }}>
          {submitting ? v.submitting : v.submit}
        </button>
      </div>
    </form>
  )
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const { t, lang } = useLanguage()
  const v = t.volunteerSignup
  const a = t.auth.register

  const [tab, setTab] = useState('beneficiary') // 'beneficiary' | 'volunteer'
  const [volStep, setVolStep] = useState(1)      // 1 | 2
  const [accountData, setAccountData] = useState(null) // { email, password }

  const tabLabels = {
    beneficiary: v.tabBeneficiary,
    volunteer:   v.tabVolunteer,
  }

  const switchTab = (next) => {
    setTab(next)
    setVolStep(1)
    setAccountData(null)
  }

  return (
    <div className="auth-grid" style={{
      minHeight: 'calc(100vh - 64px)',
      display: 'grid',
      gridTemplateColumns: '1fr',
      background: 'var(--paper)',
    }}>
      <aside style={{
        background: 'var(--sky-2)',
        padding: '64px 40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
      }}>
        <img
          src="/logo.jpg"
          alt={lang === 'he' ? 'דחיפה להגשמה' : 'Push for Fulfillment'}
          width={96}
          height={96}
          style={{ borderRadius: '50%', objectFit: 'cover', boxShadow: 'var(--shadow)' }}
        />
        <div className="section-eyebrow" style={{ textAlign: 'center' }}>
          {lang === 'he' ? 'הצטרפות לקהילה' : 'Join the community'}
        </div>
        <h1 className="section-display" style={{
          fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
          textAlign: 'center',
          maxWidth: '24rem',
          margin: 0,
        }}>
          {a.title}
        </h1>
        {a.subtitle && (
          <p className="section-lede" style={{ textAlign: 'center', margin: '0 auto', maxWidth: '26rem' }}>
            {a.subtitle}
          </p>
        )}
      </aside>

      <main style={{
        padding: '64px 40px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        maxWidth: '480px',
        width: '100%',
        margin: '0 auto',
      }}>
        <TabToggle active={tab} labels={tabLabels} onChange={switchTab} />

        {tab === 'beneficiary' && (
          <BeneficiaryForm t={t} />
        )}

        {tab === 'volunteer' && volStep === 1 && (
          <VolunteerStep1
            v={v}
            a={a}
            onNext={(data) => { setAccountData(data); setVolStep(2) }}
          />
        )}

        {tab === 'volunteer' && volStep === 2 && (
          <VolunteerStep2
            v={v}
            a={a}
            accountData={accountData}
            onBack={() => setVolStep(1)}
          />
        )}
      </main>
    </div>
  )
}
