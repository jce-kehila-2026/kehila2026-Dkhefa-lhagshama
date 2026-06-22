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
import { useState, useEffect, useRef } from 'react'
import type { FormEvent, ReactNode } from 'react'
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
 * Storage `avatars/{uid}` and sets `users/{uid}.photoURL`). The backend reads
 * the RAW image bytes (`express.raw`) with the image MIME in `Content-Type` —
 * same pattern as the existing request-file upload (`lib/storage.ts`). We send
 * the File directly as the body (NOT FormData/multipart, which the raw parser
 * would treat as a non-image and reject with 415).
 * The photo is OPTIONAL: callers must catch failures and continue.
 */
async function uploadAvatar(file: File): Promise<void> {
  const idToken = await getIdToken()
  const res = await fetch(`${API_BASE}/api/profile/avatar`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
    },
    body: file,
  })
  if (!res.ok) throw new Error(`avatar_upload_failed_${res.status}`)
}

// Slices of the canonical translation table consumed by the sub-forms.
type Translations = TFull
type AuthRegister = TFull['auth']['register']
type VolunteerSignup = TFull['volunteerSignup']
// Account credentials carried between volunteer step 1 and step 2.
type AccountData = { email: string; password: string }

// ── Small checkbox component ──────────────────────────────────────────────────
function Checkbox({ checked, onChange, label, id }: { checked: boolean; onChange: (checked: boolean) => void; label: ReactNode; id?: string }) {
  return (
    <label className="consent-row">
      <input
        id={id}
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
      {ok ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : <XIcon size={13} strokeWidth={3} aria-hidden="true" />}
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
function StepIndicator({ current, labels, progressLabel }: { current: number; labels: ReactNode[]; progressLabel: string }) {
  return (
    <ol className="reg-steps" aria-label={`${progressLabel} (${current} / ${labels.length})`}>
      {[1, 2].map((n, i) => {
        const done = current > n
        const on = current === n
        const state = done ? ' is-done' : on ? ' is-active' : ''
        return (
          <li key={n} className={`reg-step ${i === 0 ? 'reg-step--first' : 'reg-step--rest'}`}>
            <span className={`reg-step-label${state}`} aria-current={on ? 'step' : undefined}>
              <span className={`reg-step-dot${state}`} aria-hidden="true">
                {done ? <Check size={13} strokeWidth={3} /> : n}
              </span>
              {labels[i]}
            </span>
            {i === 0 && <span aria-hidden="true" className={`reg-step-bar${current > 1 ? ' is-done' : ''}`} />}
          </li>
        )
      })}
    </ol>
  )
}

// Inline field-level error, tied to its input via aria-describedby.
function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <div id={id} className="form-error" role="alert" style={{ marginBlockStart: 6 }}>
      <AlertCircle size={12} aria-hidden="true" /><span>{message}</span>
    </div>
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
  // Per-field error keys so we can show the message next to the offending input
  // and move focus to it on submit (WCAG 3.3.1 / 3.3.3).
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({})

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setFieldErrors({})
    // #85 — password policy: min 8 chars + ≥1 digit
    if (password.length < 8) { setFieldErrors({ password: a.passwordTooShort }); passwordRef.current?.focus(); return }
    if (!/\d/.test(password)) { setFieldErrors({ password: a.passwordNoDigit }); passwordRef.current?.focus(); return }
    if (password !== confirm) { setFieldErrors({ confirm: a.passwordMismatch }); confirmRef.current?.focus(); return }

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
      if (msg.includes('email-already-in-use')) { setError(a.emailInUse); emailRef.current?.focus() }
      else setError(a.error)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="reg-card" noValidate>
      <label className="reg-field" htmlFor="ben-email">
        {a.email}
        <input id="ben-email" ref={emailRef} type="email" name="email" autoComplete="email"
          inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={email}
          onChange={(e) => setEmail(e.target.value)} className="form-input" />
      </label>
      <div className="reg-field">
        <label htmlFor="ben-password">{a.password}</label>
        <input id="ben-password" ref={passwordRef} type="password" name="new-password"
          autoComplete="new-password" spellCheck={false} required minLength={8}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={`ben-pw-checks${fieldErrors.password ? ' ben-pw-err' : ''}`}
          value={password} onChange={(e) => setPassword(e.target.value)} className={`form-input${fieldErrors.password ? ' error' : ''}`} />
        {password.length > 0 && (
          <div id="ben-pw-checks" className="pw-checks" role="status" aria-live="polite" style={{ marginBlockStart: 8 }}>
            <PwCheck ok={password.length >= 8} label={a.pwRuleLength} />
            <PwCheck ok={/\d/.test(password)} label={a.pwRuleDigit} />
          </div>
        )}
        <FieldError id="ben-pw-err" message={fieldErrors.password} />
      </div>
      <label className="reg-field" htmlFor="ben-confirm">
        {a.confirmPassword}
        <input id="ben-confirm" ref={confirmRef} type="password" name="confirm-password"
          autoComplete="new-password" spellCheck={false} required minLength={8}
          aria-invalid={fieldErrors.confirm ? true : undefined}
          aria-describedby={fieldErrors.confirm ? 'ben-confirm-err' : undefined}
          value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`form-input${fieldErrors.confirm ? ' error' : ''}`} />
        <FieldError id="ben-confirm-err" message={fieldErrors.confirm} />
      </label>
      {error && <div className="form-error" role="alert"><AlertCircle size={12} aria-hidden="true" /><span>{error}</span></div>}
      <button type="submit" disabled={submitting} className={`btn btn-ember btn-lg${submitting ? ' is-loading' : ''}`} aria-busy={submitting} style={{ marginBlockStart: 4, justifyContent: 'center' }}>
        {submitting ? a.submitting : a.submit}
      </button>
      <div className="reg-alt">
        {a.haveAccount}{' '}
        <Link href="/login" className="reg-alt-link">
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
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirm?: string }>({})

  const passwordRef = useRef<HTMLInputElement>(null)
  const confirmRef = useRef<HTMLInputElement>(null)

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFieldErrors({})
    // Same password policy as the beneficiary tab (review r6, finding 21):
    // min 8 chars + >=1 digit. Both tabs hit the same Firebase createUser, so
    // the strength rule must not be weaker on one path.
    if (password.length < 8) { setFieldErrors({ password: a.passwordTooShort }); passwordRef.current?.focus(); return }
    if (!/\d/.test(password)) { setFieldErrors({ password: a.passwordNoDigit }); passwordRef.current?.focus(); return }
    if (password !== confirm) { setFieldErrors({ confirm: a.passwordMismatch }); confirmRef.current?.focus(); return }
    onNext({ email, password })
  }

  return (
    <form onSubmit={submit} className="reg-card" noValidate>
      <StepIndicator
        current={1}
        labels={[v.step1Title, v.step2Title]}
        progressLabel={lang === 'he' ? 'התקדמות הרשמת מתנדב' : 'Volunteer registration progress'}
      />
      <label className="reg-field" htmlFor="vol-email">
        {a.email}
        <input id="vol-email" type="email" name="email" autoComplete="email"
          inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={email}
          onChange={(e) => setEmail(e.target.value)} className="form-input" />
      </label>
      <div className="reg-field">
        <label htmlFor="vol-password">{a.password}</label>
        <input id="vol-password" ref={passwordRef} type="password" name="new-password"
          autoComplete="new-password" spellCheck={false} required minLength={8}
          aria-invalid={fieldErrors.password ? true : undefined}
          aria-describedby={`vol-pw-checks${fieldErrors.password ? ' vol-pw-err' : ''}`}
          value={password} onChange={(e) => setPassword(e.target.value)} className={`form-input${fieldErrors.password ? ' error' : ''}`} />
        {password.length > 0 && (
          <div id="vol-pw-checks" className="pw-checks" role="status" aria-live="polite" style={{ marginBlockStart: 8 }}>
            <PwCheck ok={password.length >= 8} label={a.pwRuleLength} />
            <PwCheck ok={/\d/.test(password)} label={a.pwRuleDigit} />
          </div>
        )}
        <FieldError id="vol-pw-err" message={fieldErrors.password} />
      </div>
      <label className="reg-field" htmlFor="vol-confirm">
        {a.confirmPassword}
        <input id="vol-confirm" ref={confirmRef} type="password" name="confirm-password"
          autoComplete="new-password" spellCheck={false} required minLength={8}
          aria-invalid={fieldErrors.confirm ? true : undefined}
          aria-describedby={fieldErrors.confirm ? 'vol-confirm-err' : undefined}
          value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`form-input${fieldErrors.confirm ? ' error' : ''}`} />
        <FieldError id="vol-confirm-err" message={fieldErrors.confirm} />
      </label>
      <button type="submit" className="btn btn-ember btn-lg" style={{ marginBlockStart: 4, justifyContent: 'center' }}>
        {v.nextStep}
      </button>
      <div className="reg-alt">
        {a.haveAccount}{' '}
        <Link href="/login" className="reg-alt-link">
          {a.loginLink}
        </Link>
      </div>
    </form>
  )
}

// ── VOLUNTEER FORM — step 2 (details) ────────────────────────────────────────
function VolunteerStep2({ v, a, lang, isRTL, accountData, accountCreated, onAccountCreated, onBack }: { v: VolunteerSignup; a: AuthRegister; lang: string; isRTL: boolean; accountData: AccountData; accountCreated: boolean; onAccountCreated: () => void; onBack: () => void }) {
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

  const areasRef = useRef<HTMLDivElement>(null)
  const langRef = useRef<HTMLInputElement>(null)
  const consentRef = useRef<HTMLInputElement>(null)

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

    if (selectedAreas.length === 0) { setError(v.minOneArea); areasRef.current?.querySelector<HTMLButtonElement>('button')?.focus(); return }
    const langs = languagesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    if (langs.length === 0) { setError(v.minOneLang); langRef.current?.focus(); return }
    if (!consent) { setError(v.consentRequired); consentRef.current?.focus(); return }

    setSubmitting(true)
    setPhotoNotice('')
    try {
      // Step A: Firebase Auth sign-up + set beneficiary claim (same as beneficiary tab)
      // The admin will later promote to 'volunteer' after reviewing the application.
      // Skip on retry: if a previous attempt created the account but the apply
      // POST failed, re-running register() would throw email-already-in-use and
      // dead-end the user. Re-POST only the application instead.
      if (!accountCreated) {
        await register(accountData.email, accountData.password)
        onAccountCreated()

        // Step A2: force a token refresh so freshly-minted claims are reflected
        // without a re-login (pragmatic refresh per the role-model contract).
        await refreshClaims()
      }

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
      // The apply POST runs AFTER account creation, so a retry after a partial
      // success surfaces these 409 codes — show the specific cause, not the
      // generic failure, so the user learns they already applied / are a volunteer.
      else if (msg.includes('already_applied')) setError(v.alreadyApplied)
      else if (msg.includes('already_volunteer')) setError(v.alreadyVolunteer)
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
    <form onSubmit={submit} className="reg-card" noValidate>
      <StepIndicator
        current={2}
        labels={[v.step1Title, v.step2Title]}
        progressLabel={lang === 'he' ? 'התקדמות הרשמת מתנדב' : 'Volunteer registration progress'}
      />

      <div className="reg-grid-2">
        <label className="reg-field" htmlFor="vol-first">
          {v.firstName}
          <input id="vol-first" type="text" name="given-name" autoComplete="given-name"
            required value={firstName}
            onChange={(e) => setFirstName(e.target.value)} className="form-input" />
        </label>
        <label className="reg-field" htmlFor="vol-last">
          {v.lastName}
          <input id="vol-last" type="text" name="family-name" autoComplete="family-name"
            required value={lastName}
            onChange={(e) => setLastName(e.target.value)} className="form-input" />
        </label>
      </div>

      <label className="reg-field" htmlFor="vol-phone">
        {v.phone}
        <input id="vol-phone" type="tel" name="tel" autoComplete="tel" inputMode="tel"
          required value={phone}
          onChange={(e) => setPhone(e.target.value)} className="form-input" />
      </label>

      <label className="reg-field" htmlFor="vol-city">
        {v.city}
        <input id="vol-city" type="text" name="address-level2" autoComplete="address-level2"
          required value={city}
          onChange={(e) => setCity(e.target.value)} className="form-input" />
      </label>

      <label className="reg-field" htmlFor="vol-profession">
        {v.profession}
        <input id="vol-profession" type="text" name="organization-title"
          placeholder={v.professionPH} value={profession}
          onChange={(e) => setProfession(e.target.value)} className="form-input" />
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="group" aria-labelledby="vol-areas-label" ref={areasRef}>
        <div id="vol-areas-label" className="reg-field-label">{v.areasOfHelp}</div>
        <div className="reg-pillset">
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
                {on && <Check size={13} strokeWidth={3} aria-hidden="true" />}
                {area}
              </button>
            )
          })}
        </div>
      </div>

      <label className="reg-field" htmlFor="vol-languages">
        {v.languages}
        <input id="vol-languages" ref={langRef} type="text" placeholder={v.languagesPH}
          value={languagesRaw}
          onChange={(e) => setLanguagesRaw(e.target.value)} className="form-input" />
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="radiogroup" aria-labelledby="vol-avail-label">
        <div id="vol-avail-label" className="reg-field-label">{v.availability}</div>
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

      <label className="reg-field" htmlFor="vol-motivation">
        {v.motivation}
        <textarea id="vol-motivation" rows={3} placeholder={v.motivationPH} value={motivation}
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

      <Checkbox id="vol-consent" checked={consent} onChange={setConsent} label={v.consent} />

      {error && <div className="form-error" role="alert"><AlertCircle size={12} aria-hidden="true" /><span>{error}</span></div>}

      {photoNotice && (
        <div className="form-error" role="status" style={{ color: 'var(--gray-600)' }}>
          <AlertCircle size={12} aria-hidden="true" /><span>{photoNotice}</span>
        </div>
      )}

      <div className="reg-actions">
        <button type="button" onClick={onBack} className="btn btn-outline btn-lg" style={{ flex: '0 0 auto', gap: 6 }}>
          <BackArrow size={16} aria-hidden="true" />
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

  const router = useRouter()
  const [tab, setTab] = useState('beneficiary') // 'beneficiary' | 'volunteer'
  const [volStep, setVolStep] = useState(1)      // 1 | 2
  const [accountData, setAccountData] = useState<AccountData | null>(null) // { email, password }
  const [accountCreated, setAccountCreated] = useState(false)

  // Preselect the volunteer tab when arrived via the /volunteer "Apply" CTA
  // (/register?role=volunteer). Runs once router.query is populated; the user
  // can still switch tabs afterwards (deps don't change on manual switch).
  useEffect(() => {
    if (router.isReady && router.query.role === 'volunteer') {
      setTab('volunteer')
    }
  }, [router.isReady, router.query.role])

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

  const joinEyebrow = lang === 'he' ? 'הצטרפות לקהילה' : 'Join the community'

  return (
    <div className="auth-grid" style={{ minHeight: 'calc(100vh - var(--nav-h))' }}>
      {/* ── BRAND ASIDE — editorial, ink-toned, sets the tone.
           `auth-aside` (login.css) hides this under 900px so the form
           stacks to a single, full-width column on phones/tablets.
           `reg-aside` carries the register-specific surface styling. ── */}
      <aside className="auth-aside reg-aside">
        {/* Flat ember-tinted corner wash — decorative, no gradient/blur. */}
        <span aria-hidden="true" className="reg-aside-wash" />

        <div className="reg-aside-inner">
          <img
            src="/logo.jpg"
            alt={lang === 'he' ? 'דחיפה להגשמה' : 'Push for Fulfillment'}
            width={72}
            height={72}
            decoding="async"
            className="reg-aside-avatar"
          />

          <span className="eyebrow" style={{ color: 'var(--ember)' }}>{joinEyebrow}</span>

          {/* Decorative brand display — presentational only (aria-hidden);
              the canonical page <h1> lives in the form <main> region. */}
          <div aria-hidden="true" className="reg-aside-title">{a.title}</div>

          {a.subtitle && <p className="reg-aside-lede">{a.subtitle}</p>}

          <ul className="reg-trust">
            {asidePoints.map(({ Icon, text }, i) => (
              <li key={i} className="reg-trust-item">
                <span aria-hidden="true" className="reg-trust-icon">
                  <Icon size={17} />
                </span>
                <span className="reg-trust-text">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* ── FORM COLUMN ── */}
      <main className="reg-main">
        <Reveal>
          <div className="reg-shell">
            {/* Form-region heading — gives the primary content area its own
                eyebrow → serif heading → lede rhythm and an accessible <h1>
                (the aside h1 is decorative + hidden under 900px). */}
            <div className="reg-head">
              <span className="eyebrow" style={{ color: 'var(--ember)' }}>{joinEyebrow}</span>
              <h1 className="reg-head-title">{a.title}</h1>
              {a.subtitle && <p className="reg-head-sub">{a.subtitle}</p>}
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
                accountCreated={accountCreated}
                onAccountCreated={() => setAccountCreated(true)}
                onBack={() => setVolStep(1)}
              />
            )}
          </div>
        </Reveal>
      </main>
    </div>
  )
}
