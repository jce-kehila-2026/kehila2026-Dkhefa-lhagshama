import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
const useNavigate = () => {
  const router = useRouter()
  return (to) => router.push(to)
}
import { CheckCircle, Copy, ArrowLeft, ArrowRight, GraduationCap, Briefcase, Scale, Users, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StepIndicator from '../components/StepIndicator'
import UploadArea from '../components/UploadArea'
import { FormGroup, Label, Input, Select, Textarea, FormRow } from '../components/FormElements'
import HelpTooltip from '../components/HelpTooltip'
import { useLanguage } from '../contexts/LanguageContext'
import { useApp } from '../contexts/AppContext'
import { useAuth } from '../contexts/AuthContext'
import { sendEmailVerification } from 'firebase/auth' // #86
import { firebaseAuth } from '../lib/firebase' // #86
import { useForm } from '../hooks/useForm'
import { validateStep1, validateStep2, validateStep3, validateStep4 } from '../utils/validators'
import { copyToClipboard } from '../utils/helpers'
import { apiFetch, apiJson } from '../lib/apiClient'

// ── Constants ──────────────────────────────────────────────────
const CATS = [
  { key:'education',  Icon: GraduationCap, bg:'#EBF3FF', color:'#1A5EA0' },
  { key:'employment', Icon: Briefcase,     bg:'#E8F5EC', color:'#15803D' },
  { key:'legal',      Icon: Scale,         bg:'#FBF0C8', color:'#7C5F00' },
  { key:'social',     Icon: Users,         bg:'#F5EBF8', color:'#6D28D9' },
]

// localStorage key for draft persistence (#93)
const DRAFT_KEY = 'rq_draft_v1'

function loadDraft() {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage?.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveDraft(values) {
  try { window.localStorage?.setItem(DRAFT_KEY, JSON.stringify(values)) } catch { /* noop */ }
}

function clearDraft() {
  try { window.localStorage?.removeItem(DRAFT_KEY) } catch { /* noop */ }
}

// ── Component ─────────────────────────────────────────────────
export default function RequestsPage() {
  const { t, isRTL, lang } = useLanguage()
  const { toast } = useApp()
  const { user, role, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const router = useRouter()
  const BackArrow  = isRTL ? ArrowRight : ArrowLeft
  const NextArrow  = isRTL ? ArrowLeft  : ArrowRight

  // #86 — track email verification state so we can show a banner
  const emailVerified = user?.emailVerified ?? false
  const [resendSent, setResendSent] = useState(false)

  const handleResendVerification = async () => {
    const fbUser = firebaseAuth.currentUser
    if (!fbUser) return
    try {
      await sendEmailVerification(fbUser)
      setResendSent(true)
    } catch {
      // swallow — the toast system is not critical here
    }
  }

  const [step, setStep] = useState(1)
  const [trackingId, setTrackingId] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [idUploaded, setIdUploaded] = useState(false)
  const [idPath, setIdPath] = useState('')
  const [supportPath, setSupportPath] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // #67 — profile prefill state
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [showSaveProfile, setShowSaveProfile] = useState(false)

  // Client-generated UUID — stable per form session (#93 + upload path prefix)
  const requestId = useMemo(() => {
    if (typeof window === 'undefined' || !window.crypto?.randomUUID) return null
    return window.crypto.randomUUID()
  }, [])

  const GENDER_MAP = { M: 'male', F: 'female', O: 'other', '': '' }
  const toCanonicalGender = (g) => GENDER_MAP[g] ?? ''

  const rq = t.request
  const s2 = t.stream2
  const steps = [rq.steps.personal, rq.steps.type, rq.steps.documents, rq.steps.confirm]

  // ── Form state (#93 draft) ────────────────────────────────────
  const draft = loadDraft()
  const { values, errors, touched, handleChange, setValue, setFieldErrors, reset } = useForm({
    firstName:'', lastName:'',
    idType: 'israeli_id', idNumber:'', idNote:'',
    phone:'', email:'',
    city:'', age:'', gender:'',
    category:'', description:'', urgency:'low',
    deadline: '',
    consent: false,
    ...(draft || {}),
  })

  // Show draft-restored toast once on mount if we had a draft
  const [draftRestored] = useState(() => !!draft)
  useEffect(() => {
    if (draftRestored) {
      toast(s2.draftRestored, 'info')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist draft to localStorage on every values change (#93)
  useEffect(() => {
    if (!submitted) saveDraft(values)
  }, [values, submitted])

  // Auth guard — redirect to login if not signed in (#93 — next= so draft is kept)
  useEffect(() => {
    if (!authLoading && !user) {
      saveDraft(values) // save before redirect so it's restored on return
      router.replace(`/login?next=${encodeURIComponent('/requests')}`)
    }
  }, [authLoading, user, router, values])

  // #67 — core profile loader. `announce` controls whether we surface a toast
  // (true for the explicit "auto-fill" button, false for the silent mount fill).
  // Note: this intentionally does NOT early-return on `profileLoaded` so the
  // button keeps working even after the silent mount fill already ran.
  const loadProfileInto = useCallback(async (announce) => {
    if (profileLoading || !user) return
    setProfileLoading(true)
    try {
      const data = await apiJson('/api/users/me')
      const p = data.profile || {}
      let filledAny = false
      if (p.firstName)   { setValue('firstName', p.firstName); filledAny = true }
      if (p.lastName)    { setValue('lastName',  p.lastName);  filledAny = true }
      if (p.phone)       { setValue('phone',     p.phone);     filledAny = true }
      if (p.city)        { setValue('city',      p.city);      filledAny = true }
      if (p.age)         { setValue('age',       String(p.age)); filledAny = true }
      if (p.gender) {
        // Canonical gender from DB (male/female/other) → UI code (M/F/O)
        const reverseMap = { male:'M', female:'F', other:'O' }
        setValue('gender', reverseMap[p.gender] || '')
        filledAny = true
      }
      // Email is editable but prefill from auth or profile
      const emailSrc = p.email || user.email || ''
      if (emailSrc) { setValue('email', emailSrc); filledAny = true }
      setProfileLoaded(true)
      if (announce) {
        toast(filledAny ? s2.autoFill.filled : s2.autoFill.nothing, filledAny ? 'success' : 'info')
      }
    } catch {
      // Profile fetch failure is non-fatal; the user can fill manually
      if (announce) toast(s2.autoFill.fillError, 'error')
    } finally {
      setProfileLoading(false)
    }
  }, [profileLoading, user, setValue, toast, s2.autoFill])

  // Explicit "auto-fill from my profile" button handler (#67) — always runs.
  const fillFromProfile = useCallback(() => loadProfileInto(true), [loadProfileInto])

  // Silent auto-fill on mount (after auth resolves)
  useEffect(() => {
    if (user && !profileLoaded && !draft) {
      loadProfileInto(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // #67 — save profile after submit
  const offerSaveProfile = useCallback(async () => {
    try {
      await apiFetch('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          firstName: values.firstName,
          lastName:  values.lastName,
          phone:     values.phone,
          city:      values.city,
          age:       Number(values.age) || undefined,
          gender:    toCanonicalGender(values.gender) || undefined,
        }),
      })
      toast(s2.autoFill.saved, 'success')
    } catch {
      toast(s2.autoFill.saveError, 'error')
    }
    setShowSaveProfile(false)
  }, [values, s2.autoFill.saved, s2.autoFill.saveError, toast, toCanonicalGender])

  // ── Validation / navigation ─────────────────────────────────
  const goNext = () => {
    let errs = {}
    if (step === 1) errs = validateStep1(values, t)
    if (step === 2) errs = validateStep2(values, t)
    if (step === 3) errs = validateStep3({ idUploaded }, t)
    if (step === 4) errs = validateStep4(values, t)

    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return }
    if (step < 4) setStep(s => s + 1)
    else submitForm()
  }

  // ── Submit ────────────────────────────────────────────────────
  const submitForm = async () => {
    if (submitting || !requestId) return
    setSubmitting(true)
    try {
      const payload = {
        requestId,
        firstName: values.firstName,
        lastName:  values.lastName,
        idType:    values.idType || 'israeli_id',
        idNumber:  values.idNumber,
        idNote:    values.idNote || '',
        phone:     values.phone,
        email:     values.email,
        city:      values.city,
        age:       Number(values.age) || 0,
        gender:    toCanonicalGender(values.gender),
        category:  values.category,
        description: values.description,
        urgency:   values.urgency,
        consent:   true,
        deadline:  values.deadline || undefined,
        attachmentPaths: [idPath, supportPath].filter(Boolean),
      }
      const res = await apiFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let detail = ''
        try { detail = JSON.stringify(await res.json()) } catch { /* noop */ }
        // #93 — 401 on submit → save draft + prompt re-login
        if (res.status === 401) {
          saveDraft(values)
          toast(s2.reloginPrompt, 'warning')
          router.push(`/login?next=${encodeURIComponent('/requests')}`)
          return
        }
        throw new Error(`submit_failed: ${res.status} ${detail}`)
      }
      const body = await res.json()
      const newId = body.requestId || requestId
      clearDraft()
      setTrackingId(newId)
      setSubmitted(true)
      setShowSaveProfile(true)
      // #94 — replace route so back-button doesn't re-open the form
      router.replace(`/my-requests?new=${newId}`)
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[RequestsPage] submit failed:', err)
      toast(lang === 'he' ? 'שליחת הבקשה נכשלה' : 'Submit failed — please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async () => {
    const ok = await copyToClipboard(trackingId)
    toast(ok ? t.common.copied : t.common.error, ok ? 'success' : 'error')
  }

  // ── Auth / role gates ─────────────────────────────────────────
  if (authLoading || !user) {
    return (
      <div className="page-container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--gray-500)' }}>{t.common.loading}</div>
      </div>
    )
  }

  // #90 — Admin notice: block admins from submitting
  if (role === 'admin') {
    return (
      <>
        <PageHeader title={rq.pageTitle} subtitle={rq.pageSubtitle} />
        <div className="page-container" style={{ maxWidth:'580px', padding:'56px 1.5rem' }}>
          <div className="card" style={{ padding:'40px 36px', textAlign:'center' }}>
            <div aria-hidden="true" style={{
              width:'64px', height:'64px',
              background:'var(--ember-soft)',
              borderRadius:'50%',
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 20px',
            }}>
              <AlertTriangle size={28} color="var(--ember)" />
            </div>
            <h2 className="section-display" style={{ fontSize:'1.5rem', marginBottom:'12px' }}>
              {s2.adminNotice.title}
            </h2>
            <p style={{ color:'var(--ink-2)', fontSize:'15px', marginBottom:'28px', lineHeight:1.7 }}>
              {s2.adminNotice.body}
            </p>
            <button className="btn btn-outline" onClick={() => navigate('/')}>
              {s2.adminNotice.switchBtn}
            </button>
          </div>
        </div>
      </>
    )
  }

  // #86 — t.auth.verifyBanner strings
  const vb = t.auth.verifyBanner

  return (
    <>
      <PageHeader title={rq.pageTitle} subtitle={rq.pageSubtitle} />

      <div className="page-container" style={{ maxWidth:'780px', padding:'40px 1.5rem 72px' }}>
        {/* #86 — email-not-verified banner; shown only when user is signed in but unverified */}
        {!emailVerified && (
          <div className="form-banner form-banner-info" style={{ marginBottom:'24px' }}>
            <AlertTriangle size={16} />
            <span style={{ flex:1, fontWeight:500 }}>{vb.text}</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleResendVerification}
              disabled={resendSent}
            >
              {resendSent ? vb.sent : vb.resend}
            </button>
          </div>
        )}

        <div className="card">
          <div style={{ padding:'24px 24px 20px', background:'var(--gray-50)', borderBottom:'1px solid var(--hair)' }}>
            <StepIndicator steps={steps} currentStep={step} />
          </div>
          <div className="card-body" style={{ padding:'32px' }}>

        {/* STEP 1 — PERSONAL DETAILS */}
        {step === 1 && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'16px', flexWrap:'wrap', marginBottom:'24px' }}>
              <h3 style={{ fontSize:'1.25rem', fontWeight:700, color:'var(--ink)', margin:0 }}>{rq.step1.title}</h3>
              {/* #67 — auto-fill button */}
              <button
                type="button"
                className={`btn btn-ghost btn-sm${profileLoading ? ' is-loading' : ''}`}
                onClick={fillFromProfile}
                disabled={profileLoading}
                aria-busy={profileLoading}
                style={{ color:'var(--ember)' }}
              >
                <Sparkles size={14} /> {s2.autoFill.fillBtn}
              </button>
            </div>

            <FormRow>
              <FormGroup>
                <Label htmlFor="firstName" required>{rq.step1.firstName}</Label>
                <Input id="firstName" name="firstName" value={values.firstName} onChange={handleChange}
                  placeholder={rq.step1.firstNamePH} error={errors.firstName} />
              </FormGroup>
              <FormGroup>
                <Label htmlFor="lastName" required>{rq.step1.lastName}</Label>
                <Input id="lastName" name="lastName" value={values.lastName} onChange={handleChange}
                  placeholder={rq.step1.lastNamePH} error={errors.lastName} />
              </FormGroup>
            </FormRow>

            {/* #66 — ID type selector */}
            <FormGroup>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                <Label required>{s2.idType.label}</Label>
                <HelpTooltip text={s2.idType.tip} label={s2.idType.tipLabel} />
              </span>
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'12px' }}>
                {[
                  ['israeli_id', s2.idType.israeliId],
                  ['passport',   s2.idType.passport],
                  ['none',       s2.idType.none],
                ].map(([val, label]) => (
                  <label key={val} className={`opt-pill${values.idType === val ? ' is-on' : ''}`}>
                    <input type="radio" name="idType" value={val}
                      checked={values.idType === val}
                      onChange={handleChange} />
                    {label}
                  </label>
                ))}
              </div>
            </FormGroup>

            {values.idType === 'israeli_id' && (
              <FormGroup>
                <Label htmlFor="idNumber" required>{rq.step1.idNumber}</Label>
                <Input id="idNumber" name="idNumber" value={values.idNumber} onChange={handleChange}
                  placeholder={rq.step1.idPH} maxLength={9} error={errors.idNumber} />
              </FormGroup>
            )}

            {(values.idType === 'passport' || values.idType === 'none') && (
              <FormRow>
                {values.idType === 'passport' && (
                  <FormGroup>
                    <Label htmlFor="idNumber">{rq.step1.idNumber}</Label>
                    <Input id="idNumber" name="idNumber" value={values.idNumber} onChange={handleChange}
                      placeholder="AB123456" maxLength={40} error={errors.idNumber} />
                  </FormGroup>
                )}
                <FormGroup style={values.idType === 'none' ? {} : {}}>
                  <Label htmlFor="idNote">{s2.idType.noteLabel}</Label>
                  <Input id="idNote" name="idNote" value={values.idNote || ''} onChange={handleChange}
                    placeholder={s2.idType.notePH} maxLength={400} />
                </FormGroup>
              </FormRow>
            )}

            <FormRow>
              <FormGroup>
                <Label htmlFor="phone" required>{rq.step1.phone}</Label>
                <Input id="phone" name="phone" type="tel" value={values.phone} onChange={handleChange}
                  placeholder={rq.step1.phonePH} error={errors.phone} />
              </FormGroup>
              <FormGroup>
                <Label htmlFor="email" required>{rq.step1.email}</Label>
                <Input id="email" name="email" type="email" value={values.email} onChange={handleChange}
                  placeholder={rq.step1.emailPH} error={errors.email}
                  hint={s2.autoFill.emailNote} />
              </FormGroup>
            </FormRow>

            <FormRow>
              <FormGroup>
                <Label htmlFor="city" required>{rq.step1.city}</Label>
                <Select id="city" name="city" value={values.city} onChange={handleChange} error={errors.city}>
                  <option value="">{lang === 'he' ? 'בחר עיר...' : 'Select city...'}</option>
                  {rq.cities.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FormGroup>
              <FormGroup>
                <Label htmlFor="age">{rq.step1.age}</Label>
                <Input id="age" name="age" type="number" value={values.age} onChange={handleChange}
                  placeholder={rq.step1.agePH} min={1} max={120} />
              </FormGroup>
            </FormRow>

            <FormGroup>
              <Label>{rq.step1.gender}</Label>
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
                {[['M', rq.step1.genderM], ['F', rq.step1.genderF], ['O', rq.step1.genderO]].map(([val, label]) => (
                  <label key={val} className={`opt-pill${values.gender === val ? ' is-on' : ''}`}>
                    <input type="radio" name="gender" value={val}
                      checked={values.gender === val}
                      onChange={handleChange} />
                    {label}
                  </label>
                ))}
              </div>
            </FormGroup>
          </div>
        )}

        {/* STEP 2 — REQUEST TYPE */}
        {step === 2 && (
          <div>
            <h3 style={{ fontSize:'1.25rem', fontWeight:700, color:'var(--ink)', marginBottom:'4px' }}>{rq.step2.title}</h3>
            <p style={{ fontSize:'14px', color:'var(--gray-600)', marginBottom:'20px' }}>{rq.step2.subtitle}</p>
            <div className="choice-grid" role="radiogroup" aria-label={rq.step2.title} style={{ marginBottom:'24px' }}>
              {CATS.map(({ key, Icon, bg, color }) => {
                const cat = rq.step2.cats[key]
                const selected = values.category === key
                return (
                  <button
                    key={key}
                    type="button"
                    className="choice-tile"
                    role="radio"
                    aria-checked={selected}
                    aria-pressed={selected}
                    onClick={() => setValue('category', key)}
                  >
                    <span className="choice-tile-icon" aria-hidden="true" style={{ background:bg, color }}>
                      <Icon size={20} />
                    </span>
                    <span style={{ minWidth:0 }}>
                      <span className="choice-tile-title">{cat.label}</span>
                      <span className="choice-tile-hint">{cat.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            {errors.category && <div className="form-error" style={{ marginBottom:'14px' }}>{errors.category}</div>}

            <FormGroup>
              <Label htmlFor="description" required>{rq.step2.description}</Label>
              <Textarea id="description" name="description" value={values.description}
                onChange={handleChange} placeholder={rq.step2.descPH}
                rows={4} error={errors.description} />
            </FormGroup>
            <FormRow>
              <FormGroup>
                <Label htmlFor="urgency">{rq.step2.urgency}</Label>
                <Select id="urgency" name="urgency" value={values.urgency} onChange={handleChange}>
                  <option value="low">{rq.step2.urgencyLow}</option>
                  <option value="medium">{rq.step2.urgencyMed}</option>
                  <option value="high">{rq.step2.urgencyHigh}</option>
                </Select>
              </FormGroup>
              {/* #68 — deadline picker */}
              <FormGroup>
                <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <Label htmlFor="deadline">{s2.deadline.label}</Label>
                  <HelpTooltip text={s2.deadline.tip} label={s2.deadline.tipLabel} />
                </span>
                <Input
                  id="deadline" name="deadline" type="date"
                  value={values.deadline || ''}
                  onChange={handleChange}
                  min={new Date().toISOString().split('T')[0]}
                  hint={s2.deadline.hint}
                />
              </FormGroup>
            </FormRow>
          </div>
        )}

        {/* STEP 3 — DOCUMENTS */}
        {step === 3 && (
          <div>
            <h3 style={{ fontSize:'1.25rem', fontWeight:700, color:'var(--ink)', marginBottom:'4px' }}>{rq.step3.title}</h3>
            <p style={{ fontSize:'14px', color:'var(--gray-600)', marginBottom:'20px' }}>{rq.step3.subtitle}</p>
            <FormGroup>
              <UploadArea
                label={rq.step3.idLabel}
                hint={rq.step3.idHint}
                formats={rq.step3.idFormats}
                required
                requestId={requestId}
                onUpload={(r) => {
                  setIdUploaded(!!r)
                  setIdPath(r?.path || '')
                }}
                error={errors.idDoc}
              />
            </FormGroup>
            <FormGroup>
              <UploadArea
                label={rq.step3.supportLabel}
                hint={rq.step3.supportHint}
                formats={rq.step3.supportFormats}
                requestId={requestId}
                onUpload={(r) => {
                  setSupportPath(r?.path || '')
                }}
              />
            </FormGroup>
            <div className="soft-note" style={{ marginTop:'16px' }}>
              <ShieldCheck size={18} className="soft-note-icon" aria-hidden="true" />
              <p>{rq.step3.security}</p>
            </div>
          </div>
        )}

        {/* STEP 4 — SUMMARY + CONSENT */}
        {step === 4 && (
          <div>
            <h3 style={{ fontSize:'1.25rem', fontWeight:700, color:'var(--ink)', marginBottom:'20px' }}>{rq.step4.title}</h3>
            <div className="review-panel" style={{ marginBottom:'24px' }}>
              <dl className="review-grid">
                {[
                  [rq.step4.fullName,  `${values.firstName} ${values.lastName}`],
                  [rq.step4.phone,     values.phone],
                  [rq.step4.city,      values.city],
                  [rq.step4.category,  values.category ? rq.step2.cats[values.category]?.label : '—'],
                  [rq.step4.urgency,   values.urgency === 'high' ? rq.step2.urgencyHigh : values.urgency === 'medium' ? rq.step2.urgencyMed : rq.step2.urgencyLow],
                  ...(values.deadline ? [[t.myRequests.table.deadline, values.deadline]] : []),
                ].map(([label, val]) => (
                  <div key={label} className="review-item">
                    <dt>{label}</dt>
                    <dd>{val || '—'}</dd>
                  </div>
                ))}
              </dl>
              {values.description && (
                <div className="review-note">
                  <div style={{ fontSize:'12px', color:'var(--gray-500)', marginBottom:'4px' }}>{rq.step4.description}</div>
                  <div style={{ fontSize:'14px', color:'var(--gray-700)', lineHeight:1.7 }}>{values.description}</div>
                </div>
              )}
            </div>

            <FormGroup>
              <label className="consent-row">
                <input
                  type="checkbox" name="consent"
                  checked={values.consent}
                  onChange={handleChange}
                />
                <span>{rq.step4.consent}</span>
              </label>
              {errors.consent && <div className="form-error" style={{ marginTop:'8px' }}>{errors.consent}</div>}
            </FormGroup>

            {/* #67 — save-to-profile offer */}
            {showSaveProfile && (
              <div className="soft-note" style={{ marginTop:'16px', alignItems:'center', flexWrap:'wrap' }}>
                <span style={{ flex:1, minWidth:'180px', fontSize:'13px', color:'var(--ink-2)' }}>
                  {s2.autoFill.saveToProfile}
                </span>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button type="button" className="btn btn-outline btn-sm" onClick={offerSaveProfile}>
                    {t.common.save}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSaveProfile(false)}>
                    {t.common.cancel}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

          </div>
        </div>

        {/* NAV BUTTONS */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', marginTop:'24px' }}>
          {step > 1 ? (
            <button className="btn btn-outline" onClick={() => setStep(s => s - 1)} disabled={submitting}>
              <BackArrow size={16} /> {rq.nav.back}
            </button>
          ) : <span />}
          {/* #86 — email verification is a gentle reminder (banner above), NOT a
              hard block: an unverified user can still submit a request. */}
          <button
            className={`btn ${step === 4 ? 'btn-ember' : 'btn-primary'} btn-lg${submitting ? ' is-loading' : ''}`}
            onClick={goNext}
            disabled={submitting}
            aria-busy={submitting}
          >
            {step === 4 ? (
              <><CheckCircle size={16} /> {rq.nav.submit}</>
            ) : (
              <>{rq.nav.next} <NextArrow size={16} /></>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
