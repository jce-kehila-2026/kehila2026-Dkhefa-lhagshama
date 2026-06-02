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
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { Check, X as XIcon, AlertCircle, ArrowLeft, ArrowRight, HeartHandshake, ShieldCheck, Users } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useLanguage } from '../contexts/LanguageContext'
import type { Translations as TFull } from '../contexts/LanguageContext'
import type { CaughtError } from '@/types'
import { useAuth } from '../contexts/AuthContext'
import { useApp } from '../contexts/AppContext'
import { validateRedirect } from '../utils/validateRedirect'
import { apiFetch } from '../lib/apiClient'
import { getIdToken } from '../lib/auth'
import UploadArea from '../components/forms/UploadArea'
import Reveal from '../components/motion/Reveal'

// ── Note 11: optional volunteer profile photo ────────────────────────────────
// Client-side guards that mirror the backend avatar endpoint contract.
const AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const AVATAR_MAX_BYTES = 5 * 1024 * 1024 // 5MB
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001'

/**
 * Upload the chosen volunteer avatar via the backend (Admin SDK writes to
 * Storage `avatars/{uid}` and sets `users/{uid}.photoURL`). Uses a raw fetch +
 * FormData so the browser sets the multipart boundary itself — `apiFetch`
 * forces a JSON Content-Type, which would corrupt the multipart body.
 * The photo is OPTIONAL: callers must catch failures and continue.
 */
async function uploadAvatar(file: File): Promise<void> {
  const idToken = await getIdToken()
  const form = new FormData()
  form.append('avatar', file)
  const res = await fetch(`${API_BASE}/api/profile/avatar`, {
    method: 'POST',
    headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
    body: form,
  })
  if (!res.ok) throw new Error(`avatar_upload_failed_${res.status}`)
}

// Slices of the canonical translation table consumed by the sub-forms.
type Translations = TFull
type AuthRegister = TFull['auth']['register']
type VolunteerSignup = TFull['volunteerSignup']
// Account credentials carried between volunteer step 1 and step 2.
type AccountData = { email: string; password: string }

// ── Shared input style ────────────────────────────────────────────────────────
const inputStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  fontSize: 13.5,
  color: 'var(--ink)',
  fontWeight: 600,
  textAlign: 'start',
}

// Eyebrow above a field group inside the form card.
const fieldLabel: CSSProperties = {
  fontSize: 13.5,
  color: 'var(--ink)',
  fontWeight: 600,
  textAlign: 'start',
}

// Shared card shell so both tabs and every step feel like one continuous surface.
const cardStyle: CSSProperties = {
  padding: 'clamp(24px, 4vw, 34px)',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  border: '1px solid var(--hair)',
  borderRadius: 'var(--radius-lg)',
  boxShadow: 'var(--shadow)',
  background: 'var(--white)',
}

const loginRowStyle: CSSProperties = {
  fontSize: 13.5,
  textAlign: 'center',
  color: 'var(--gray-600)',
  marginBlockStart: 4,
  paddingBlockStart: 16,
  borderBlockStart: '1px solid var(--hair)',
}

const loginLinkStyle: CSSProperties = {
  color: 'var(--ember)',
  fontWeight: 600,
  textDecoration: 'underline',
  textUnderlineOffset: '3px',
}

// ── Small checkbox component ──────────────────────────────────────────────────
function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode }) {
  return (
    <label className="consent-row">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}

// ── Password rule row (#85 visual checklist) ─────────────────────────────────
function PwCheck({ ok, label }: { ok: boolean; label: ReactNode }) {
  return (
    <div className={`pw-check${ok ? ' is-ok' : ''}`}>
      {ok ? <Check size={13} strokeWidth={3} /> : <XIcon size={13} strokeWidth={3} />}
      <span>{label}</span>
    </div>
  )
}

// ── Tab toggle ────────────────────────────────────────────────────────────────
function TabToggle({ active, labels, onChange }: { active: string; labels: Record<string, ReactNode>; onChange: (tab: string) => void }) {
  return (
    <div className="seg" role="tablist" style={{ marginBlockEnd: 22 }}>
      {['beneficiary', 'volunteer'].map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
          className={`seg-btn${active === tab ? ' is-active' : ''}`}
        >
          {labels[tab]}
        </button>
      ))}
    </div>
  )
}

// ── Two-step progress indicator (volunteer flow) ─────────────────────────────
function StepIndicator({ current, labels, progressLabel }: { current: number; labels: ReactNode[]; progressLabel: ReactNode }) {
  return (
    <ol
      aria-label={`${progressLabel} (${current} / ${labels.length})`}
      style={{
        listStyle: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        margin: '0 0 18px',
        padding: 0,
      }}
    >
      {[1, 2].map((n, i) => {
        const done = current > n
        const on = current === n
        return (
          <li key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, flex: i === 0 ? '0 0 auto' : '1 1 auto' }}>
            <span
              aria-current={on ? 'step' : undefined}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                fontWeight: 600,
                color: on || done ? 'var(--ink)' : 'var(--gray-500)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  flex: '0 0 auto',
                  background: done ? 'var(--success)' : on ? 'var(--ember)' : 'var(--gray-100)',
                  color: done || on ? 'var(--white)' : 'var(--gray-500)',
                  border: on || done ? 'none' : '1px solid var(--hair)',
                  transition: 'background var(--dur-2) var(--ease-out)',
                }}
              >
                {done ? <Check size={13} strokeWidth={3} /> : n}
              </span>
              {labels[i]}
            </span>
            {i === 0 && (
              <span
                aria-hidden="true"
                style={{ flex: 1, height: 2, borderRadius: 2, background: current > 1 ? 'var(--success)' : 'var(--hair)' }}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ── BENEFICIARY FORM (original flow) ─────────────────────────────────────────
function BeneficiaryForm({ t }: { t: Translations }) {
  const { register } = useAuth()
  const { toast } = useApp()
  const router = useRouter()
  const a = t.auth.register

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    // #85 — password policy: min 8 chars + ≥1 digit
    if (password.length < 8) { setError(a.passwordTooShort); return }
    if (!/\d/.test(password)) { setError(a.passwordNoDigit); return }
    if (password !== confirm) { setError(a.passwordMismatch); return }

    setSubmitting(true)
    try {
      await register(email, password)
      // #86 — auth.ts already sent the verification email; surface it as a toast
      toast(a.verifyEmailSent, 'info')
      // #88 — validate the `next` param before pushing
      const safe = validateRedirect(router.query.next, '/')
      router.push(safe)
    } catch (err) {
      const e = err as CaughtError
      const msg = e && e.message ? String(e.message) : ''
      if (msg.includes('email-already-in-use')) setError(a.emailInUse)
      else setError(a.error)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="card" style={cardStyle}>
      <label style={inputStyle}>
        {a.email}
        <input type="email" autoComplete="email" required value={email}
          onChange={(e) => setEmail(e.target.value)} className="form-input" />
      </label>
      <div style={inputStyle}>
        <label htmlFor="ben-password">{a.password}</label>
        <input id="ben-password" type="password" autoComplete="new-password" required minLength={6}
          value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" />
        {password.length > 0 && (
          <div className="pw-checks" style={{ marginBlockStart: 8 }}>
            <PwCheck ok={password.length >= 8} label={a.pwRuleLength} />
            <PwCheck ok={/\d/.test(password)} label={a.pwRuleDigit} />
          </div>
        )}
      </div>
      <label style={inputStyle}>
        {a.confirmPassword}
        <input type="password" autoComplete="new-password" required minLength={6}
          value={confirm} onChange={(e) => setConfirm(e.target.value)} className="form-input" />
      </label>
      {error && <div className="form-error" role="alert"><AlertCircle size={12} /><span>{error}</span></div>}
      <button type="submit" disabled={submitting} className={`btn btn-ember btn-lg${submitting ? ' is-loading' : ''}`} aria-busy={submitting} style={{ marginBlockStart: 4, justifyContent: 'center' }}>
        {submitting ? a.submitting : a.submit}
      </button>
      <div style={loginRowStyle}>
        {a.haveAccount}{' '}
        <Link href="/login" style={loginLinkStyle}>
          {a.loginLink}
        </Link>
      </div>
    </form>
  )
}

// ── VOLUNTEER FORM — step 1 (account) ────────────────────────────────────────
function VolunteerStep1({ v, a, lang, onNext }: { v: VolunteerSignup; a: AuthRegister; lang: string; onNext: (data: AccountData) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError(a.passwordTooShort); return }
    if (password !== confirm) { setError(a.passwordMismatch); return }
    onNext({ email, password })
  }

  return (
    <form onSubmit={submit} className="card" style={cardStyle}>
      <StepIndicator
        current={1}
        labels={[v.step1Title, v.step2Title]}
        progressLabel={lang === 'he' ? 'התקדמות הרשמת מתנדב' : 'Volunteer registration progress'}
      />
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
      {error && <div className="form-error" role="alert"><AlertCircle size={12} /><span>{error}</span></div>}
      <button type="submit" className="btn btn-ember btn-lg" style={{ marginBlockStart: 4, justifyContent: 'center' }}>
        {v.nextStep}
      </button>
      <div style={loginRowStyle}>
        {a.haveAccount}{' '}
        <Link href="/login" style={loginLinkStyle}>
          {a.loginLink}
        </Link>
      </div>
    </form>
  )
}

// ── VOLUNTEER FORM — step 2 (details) ────────────────────────────────────────
function VolunteerStep2({ v, a, lang, isRTL, accountData, onBack }: { v: VolunteerSignup; a: AuthRegister; lang: string; isRTL: boolean; accountData: AccountData; onBack: () => void }) {
  const { register, refreshClaims } = useAuth()
  const router = useRouter()
  const BackArrow = isRTL ? ArrowRight : ArrowLeft

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [profession, setProfession] = useState('')
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [languagesRaw, setLanguagesRaw] = useState('')
  const [availability, setAvailability] = useState('2-4')
  const [motivation, setMotivation] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Note 11 — optional profile photo (held client-side until after sign-up,
  // then POSTed to /api/profile/avatar). photoNotice is a non-blocking warning.
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoError, setPhotoError] = useState('')
  const [photoNotice, setPhotoNotice] = useState('')

  const toggleArea = (area: string) => {
    setSelectedAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    )
  }

  // Validate the picked image client-side (type + size) before holding it.
  // UploadArea is used without a requestId, so it reports the raw File without
  // performing a real upload — the actual upload happens on submit via the
  // backend avatar endpoint.
  const onPhotoPicked = (result: { file: File } | null) => {
    setPhotoNotice('')
    if (!result) { setPhotoFile(null); setPhotoError(''); return }
    const { file } = result
    if (!AVATAR_TYPES.has(file.type)) { setPhotoFile(null); setPhotoError(v.photoTypeError); return }
    if (file.size > AVATAR_MAX_BYTES) { setPhotoFile(null); setPhotoError(v.photoSizeError); return }
    setPhotoError('')
    setPhotoFile(file)
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (selectedAreas.length === 0) { setError(v.minOneArea); return }
    const langs = languagesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    if (langs.length === 0) { setError(v.minOneLang); return }
    if (!consent) { setError(v.consentRequired); return }

    setSubmitting(true)
    setPhotoNotice('')
    try {
      // Step A: Firebase Auth sign-up + set beneficiary claim (same as beneficiary tab)
      // The admin will later promote to 'volunteer' after reviewing the application.
      await register(accountData.email, accountData.password)

      // Step A2: force a token refresh so freshly-minted claims are reflected
      // without a re-login (pragmatic refresh per the role-model contract).
      await refreshClaims()

      // Step A3 (Note 11): optional profile photo. An upload failure must NOT
      // block the application — catch, surface a non-blocking notice, continue.
      if (photoFile) {
        try {
          await uploadAvatar(photoFile)
        } catch (photoErr) {
          console.error('[RegisterPage] avatar upload failed (non-blocking):', photoErr)
          // No dedicated translation key for this rare, non-blocking case —
          // inline HE/EN string, mirroring the AdminGate inline-message pattern.
          setPhotoNotice(lang === 'he'
            ? 'התמונה לא הועלתה, אך הבקשה נשלחה. ניתן להוסיף תמונה מאוחר יותר.'
            : "Your photo wasn't uploaded, but your application was sent. You can add a photo later.")
        }
      }

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
      const e = err as CaughtError
      const msg = e && e.message ? String(e.message) : ''
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
    <form onSubmit={submit} className="card" style={cardStyle}>
      <StepIndicator
        current={2}
        labels={[v.step1Title, v.step2Title]}
        progressLabel={lang === 'he' ? 'התקדמות הרשמת מתנדב' : 'Volunteer registration progress'}
      />

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
        <div style={fieldLabel}>{v.areasOfHelp}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {v.areasList.map((area: string) => {
            const on = selectedAreas.includes(area)
            return (
              <button
                key={area}
                type="button"
                aria-pressed={on}
                onClick={() => toggleArea(area)}
                className={`opt-pill${on ? ' is-on' : ''}`}
                style={{ borderRadius: 999 }}
              >
                {on && <Check size={13} strokeWidth={3} />}
                {area}
              </button>
            )
          })}
        </div>
      </div>

      <label style={inputStyle}>
        {v.languages}
        <input type="text" placeholder={v.languagesPH} value={languagesRaw}
          onChange={(e) => setLanguagesRaw(e.target.value)} className="form-input" />
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={fieldLabel}>{v.availability}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {availOptions.map((opt) => (
            <label key={opt.value} className={`opt-pill${availability === opt.value ? ' is-on' : ''}`}>
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

      {/* Note 11 — optional profile photo. Reuses UploadArea without a
          requestId (no real Storage write here); the chosen image is held in
          state and uploaded to the backend on submit. Image-only client-side
          validation runs in onPhotoPicked. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <UploadArea
          label={v.photoLabel}
          hint={v.photoHint}
          formats="JPG · PNG · WEBP"
          onUpload={onPhotoPicked}
          error={photoError || undefined}
        />
      </div>

      <Checkbox checked={consent} onChange={setConsent} label={v.consent} />

      {error && <div className="form-error" role="alert"><AlertCircle size={12} /><span>{error}</span></div>}

      {photoNotice && (
        <div className="form-error" role="status" style={{ color: 'var(--gray-600)' }}>
          <AlertCircle size={12} /><span>{photoNotice}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBlockStart: 4 }}>
        <button type="button" onClick={onBack} className="btn btn-outline btn-lg" style={{ flex: '0 0 auto', gap: 6 }}>
          <BackArrow size={16} />
          {v.backStep}
        </button>
        <button type="submit" disabled={submitting} className={`btn btn-ember btn-lg${submitting ? ' is-loading' : ''}`} aria-busy={submitting} style={{ flex: 1, justifyContent: 'center' }}>
          {submitting ? v.submitting : v.submit}
        </button>
      </div>
    </form>
  )
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const { t, lang, isRTL } = useLanguage()
  const v = t.volunteerSignup
  const a = t.auth.register

  const [tab, setTab] = useState('beneficiary') // 'beneficiary' | 'volunteer'
  const [volStep, setVolStep] = useState(1)      // 1 | 2
  const [accountData, setAccountData] = useState<AccountData | null>(null) // { email, password }

  const tabLabels: Record<string, ReactNode> = {
    beneficiary: v.tabBeneficiary,
    volunteer:   v.tabVolunteer,
  }

  const switchTab = (next: string) => {
    setTab(next)
    setVolStep(1)
    setAccountData(null)
  }

  // Editorial trust points for the brand aside.
  const asidePoints = lang === 'he'
    ? [
        { Icon: HeartHandshake, text: 'ליווי אישי בכל שלב מהבקשה ועד הסיוע' },
        { Icon: Users, text: 'קהילה של מתנדבים ונותני שירות לצידך' },
        { Icon: ShieldCheck, text: 'הפרטים שלך נשמרים באופן מאובטח וחסוי' },
      ]
    : [
        { Icon: HeartHandshake, text: 'Personal guidance at every step, from request to support' },
        { Icon: Users, text: 'A community of volunteers and providers by your side' },
        { Icon: ShieldCheck, text: 'Your details are kept secure and confidential' },
      ]

  return (
    <div
      className="auth-grid"
      style={{
        minHeight: 'calc(100vh - var(--nav-h))',
      }}
    >
      {/* ── BRAND ASIDE — editorial, ink-toned, sets the tone.
           `auth-aside` (globals.css) hides this under 900px so the form
           stacks to a single, full-width column on phones/tablets. ── */}
      <aside
        className="auth-aside"
        style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--ink)',
          color: 'var(--cream)',
          padding: 'clamp(48px, 6vw, 80px) clamp(32px, 4vw, 56px)',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'center',
          gap: 28,
        }}
      >
        {/* Soft ember glow, decorative */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            insetBlockStart: '-12%',
            insetInlineEnd: '-10%',
            width: 320,
            height: 320,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(185,105,78,0.32), transparent 70%)',
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 22, maxWidth: '30rem' }}>
          <img
            src="/logo.jpg"
            alt={lang === 'he' ? 'דחיפה להגשמה' : 'Push for Fulfillment'}
            width={72}
            height={72}
            style={{
              borderRadius: '50%',
              objectFit: 'cover',
              boxShadow: 'var(--shadow-lg)',
              border: '2px solid rgba(244,238,224,0.18)',
            }}
          />

          <span
            className="eyebrow"
            style={{ color: 'var(--ember)' }}
          >
            {lang === 'he' ? 'הצטרפות לקהילה' : 'Join the community'}
          </span>

          {/* Decorative brand display — presentational only (aria-hidden);
              the canonical page <h1> lives in the form <main> region. */}
          <div
            aria-hidden="true"
            style={{
              fontFamily: 'Frank Ruhl Libre, Georgia, serif',
              fontWeight: 400,
              fontSize: 'var(--fs-display)',
              lineHeight: 1.14,
              letterSpacing: '-0.01em',
              color: 'var(--cream)',
              margin: 0,
              textWrap: 'balance',
            }}
          >
            {a.title}
          </div>

          {a.subtitle && (
            <p style={{ color: 'rgba(244,238,224,0.8)', fontSize: 'var(--fs-lede)', lineHeight: 1.6, margin: 0 }}>
              {a.subtitle}
            </p>
          )}

          <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {asidePoints.map(({ Icon, text }, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span
                  aria-hidden="true"
                  style={{
                    flex: '0 0 auto',
                    width: 34,
                    height: 34,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(185,105,78,0.18)',
                    color: 'var(--ember-soft)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon size={17} />
                </span>
                <span style={{ fontSize: 14.5, lineHeight: 1.5, color: 'rgba(244,238,224,0.92)' }}>
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ── FORM COLUMN ── */}
      <main
        style={{
          padding: 'clamp(40px, 6vw, 72px) clamp(24px, 4vw, 48px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <Reveal>
          <div style={{ maxWidth: '480px', width: '100%', marginInline: 'auto' }}>
            {/* Form-region heading — gives the primary content area its own
                eyebrow → serif heading → lede rhythm and an accessible <h1>
                (the aside h1 is decorative + hidden under 900px). */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBlockEnd: 22, textAlign: 'start' }}>
              <span className="eyebrow" style={{ color: 'var(--ember)' }}>
                {lang === 'he' ? 'הצטרפות לקהילה' : 'Join the community'}
              </span>
              <h1
                style={{
                  fontFamily: 'Frank Ruhl Libre, Georgia, serif',
                  fontWeight: 400,
                  fontSize: 'var(--fs-h2)',
                  lineHeight: 1.18,
                  letterSpacing: '-0.01em',
                  color: 'var(--ink)',
                  margin: 0,
                  textWrap: 'balance',
                }}
              >
                {a.title}
              </h1>
              {a.subtitle && (
                <p style={{ color: 'var(--gray-600)', fontSize: 'var(--fs-body)', lineHeight: 1.6, margin: 0 }}>
                  {a.subtitle}
                </p>
              )}
            </div>

            <TabToggle active={tab} labels={tabLabels} onChange={switchTab} />

            {tab === 'beneficiary' && (
              <BeneficiaryForm t={t} />
            )}

            {tab === 'volunteer' && volStep === 1 && (
              <VolunteerStep1
                v={v}
                a={a}
                lang={lang}
                onNext={(data) => { setAccountData(data); setVolStep(2) }}
              />
            )}

            {tab === 'volunteer' && volStep === 2 && (
              <VolunteerStep2
                v={v}
                a={a}
                lang={lang}
                isRTL={isRTL}
                accountData={accountData!}
                onBack={() => setVolStep(1)}
              />
            )}
          </div>
        </Reveal>
      </main>
    </div>
  )
}
