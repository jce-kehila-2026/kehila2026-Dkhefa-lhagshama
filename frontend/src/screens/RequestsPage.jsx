import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/router'
const useNavigate = () => {
  const router = useRouter()
  return (to) => router.push(to)
}
import { CheckCircle, Copy, ArrowLeft, ArrowRight, GraduationCap, Briefcase, Scale, Users, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import StepIndicator from '../components/StepIndicator'
import UploadArea from '../components/UploadArea'
import { FormGroup, Label, Input, Select, Textarea, FormRow } from '../components/FormElements'
import { useLanguage } from '../contexts/LanguageContext'
import { useApp } from '../contexts/AppContext'
import { useAuth } from '../contexts/AuthContext'
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

  // #67 — auto-fill from profile on mount (only once, after auth resolves)
  const fillFromProfile = useCallback(async () => {
    if (profileLoaded || profileLoading || !user) return
    setProfileLoading(true)
    try {
      const data = await apiJson('/api/users/me')
      const p = data.profile || {}
      if (p.firstName)   setValue('firstName', p.firstName)
      if (p.lastName)    setValue('lastName',  p.lastName)
      if (p.phone)       setValue('phone',     p.phone)
      if (p.city)        setValue('city',      p.city)
      if (p.age)         setValue('age',       String(p.age))
      if (p.gender) {
        // Canonical gender from DB (male/female/other) → UI code (M/F/O)
        const reverseMap = { male:'M', female:'F', other:'O' }
        setValue('gender', reverseMap[p.gender] || '')
      }
      // Email is editable but prefill from auth or profile
      const emailSrc = p.email || user.email || ''
      if (emailSrc) setValue('email', emailSrc)
      setProfileLoaded(true)
    } catch {
      // Profile fetch failure is non-fatal; the user can fill manually
    } finally {
      setProfileLoading(false)
    }
  }, [profileLoaded, profileLoading, user, setValue])

  // Silent auto-fill on mount (after auth resolves)
  useEffect(() => {
    if (user && !profileLoaded && !draft) {
      fillFromProfile()
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
            <div style={{
              width:'64px', height:'64px',
              background:'var(--cream)',
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

  // ── Card style ────────────────────────────────────────────────
  const cardStyle = { background:'var(--paper)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-sm)', border:'1px solid var(--hair)', padding:'36px' }

  return (
    <>
      <PageHeader title={rq.pageTitle} subtitle={rq.pageSubtitle} />
      <div className="page-container" style={{ maxWidth:'780px', padding:'48px 1.5rem 72px' }}>
        <StepIndicator steps={steps} currentStep={step} />

        {/* STEP 1 — PERSONAL DETAILS */}
        {step === 1 && (
          <div style={cardStyle}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'26px' }}>
              <h3 style={{ fontSize:'19px', fontWeight:700, color:'var(--ink)', margin:0 }}>{rq.step1.title}</h3>
              {/* #67 — auto-fill button */}
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={fillFromProfile}
                disabled={profileLoading}
                style={{ fontSize:'12.5px', padding:'6px 14px' }}
              >
                {profileLoading ? t.common.loading : s2.autoFill.fillBtn}
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
              <Label required>{s2.idType.label}</Label>
              <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'12px' }}>
                {[
                  ['israeli_id', s2.idType.israeliId],
                  ['passport',   s2.idType.passport],
                  ['none',       s2.idType.none],
                ].map(([val, label]) => (
                  <label key={val} style={{
                    display:'flex', alignItems:'center', gap:'7px',
                    padding:'9px 16px', borderRadius:'8px',
                    border:`1px solid ${values.idType === val ? 'var(--ember)' : 'var(--hair)'}`,
                    background: values.idType === val ? 'var(--sky-2)' : 'var(--paper)',
                    cursor:'pointer', fontSize:'13.5px', transition:'all .18s',
                  }}>
                    <input type="radio" name="idType" value={val}
                      checked={values.idType === val}
                      onChange={handleChange}
                      style={{ accentColor:'var(--ember)' }} />
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
                  <label key={val} style={{
                    display:'flex', alignItems:'center', gap:'7px',
                    padding:'9px 16px', borderRadius:'8px',
                    border:`1px solid ${values.gender === val ? 'var(--ember)' : 'var(--hair)'}`,
                    background: values.gender === val ? 'var(--sky-2)' : 'var(--paper)',
                    cursor:'pointer', fontSize:'13.5px', transition:'all .18s',
                  }}>
                    <input type="radio" name="gender" value={val}
                      checked={values.gender === val}
                      onChange={handleChange}
                      style={{ accentColor:'var(--ember)' }} />
                    {label}
                  </label>
                ))}
              </div>
            </FormGroup>
          </div>
        )}

        {/* STEP 2 — REQUEST TYPE */}
        {step === 2 && (
          <div style={cardStyle}>
            <h3 style={{ fontSize:'19px', fontWeight:700, color:'var(--ink)', marginBottom:'6px' }}>{rq.step2.title}</h3>
            <p style={{ fontSize:'13.5px', color:'var(--gray-400)', marginBottom:'24px' }}>{rq.step2.subtitle}</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'12px', marginBottom:'24px' }}>
              {CATS.map(({ key, Icon, bg, color }) => {
                const cat = rq.step2.cats[key]
                const selected = values.category === key
                return (
                  <div
                    key={key}
                    className={`cat-option${selected ? ' selected' : ''}`}
                    onClick={() => setValue('category', key)}
                    role="button" tabIndex={0}
                    onKeyPress={e => e.key === 'Enter' && setValue('category', key)}
                  >
                    <div style={{ width:'38px', height:'38px', borderRadius:'8px', background:bg, color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <strong style={{ display:'block', fontSize:'14px', color:'var(--ink)', marginBottom:'2px' }}>{cat.label}</strong>
                      <span style={{ fontSize:'12px', color:'var(--gray-400)' }}>{cat.hint}</span>
                    </div>
                  </div>
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
                <Label htmlFor="deadline">{s2.deadline.label}</Label>
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
          <div style={cardStyle}>
            <h3 style={{ fontSize:'19px', fontWeight:700, color:'var(--ink)', marginBottom:'6px' }}>{rq.step3.title}</h3>
            <p style={{ fontSize:'13.5px', color:'var(--gray-400)', marginBottom:'24px' }}>{rq.step3.subtitle}</p>
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
            <div style={{
              marginTop:'16px', padding:'14px 16px',
              background:'var(--sky-2)', borderRadius:'8px',
              display:'flex', gap:'8px', alignItems:'flex-start',
              border:'1px solid var(--hair)',
            }}>
              <span style={{ fontSize:'16px' }}>🔒</span>
              <p style={{ fontSize:'12.5px', color:'var(--ink-2)', lineHeight:1.6 }}>{rq.step3.security}</p>
            </div>
          </div>
        )}

        {/* STEP 4 — SUMMARY + CONSENT */}
        {step === 4 && (
          <div style={cardStyle}>
            <h3 style={{ fontSize:'19px', fontWeight:700, color:'var(--ink)', marginBottom:'22px' }}>{rq.step4.title}</h3>
            <div style={{
              background:'var(--sky-2)', borderRadius:'10px',
              border:'1px solid var(--hair)',
              padding:'22px', marginBottom:'26px',
            }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 20px' }}>
                {[
                  [rq.step4.fullName,  `${values.firstName} ${values.lastName}`],
                  [rq.step4.phone,     values.phone],
                  [rq.step4.city,      values.city],
                  [rq.step4.category,  values.category ? rq.step2.cats[values.category]?.label : '—'],
                  [rq.step4.urgency,   values.urgency === 'high' ? rq.step2.urgencyHigh : values.urgency === 'medium' ? rq.step2.urgencyMed : rq.step2.urgencyLow],
                  ...(values.deadline ? [[t.myRequests.table.deadline, values.deadline]] : []),
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize:'12px', color:'var(--gray-400)', marginBottom:'2px' }}>{label}</div>
                    <div style={{ fontSize:'14px', fontWeight:600, color:'var(--ink)' }}>{val || '—'}</div>
                  </div>
                ))}
              </div>
              {values.description && (
                <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid var(--gray-200)' }}>
                  <div style={{ fontSize:'12px', color:'var(--gray-400)', marginBottom:'4px' }}>{rq.step4.description}</div>
                  <div style={{ fontSize:'13.5px', color:'var(--gray-700)', lineHeight:1.65 }}>{values.description}</div>
                </div>
              )}
            </div>

            <FormGroup>
              <label style={{ display:'flex', alignItems:'flex-start', gap:'10px', cursor:'pointer' }}>
                <input
                  type="checkbox" name="consent"
                  checked={values.consent}
                  onChange={handleChange}
                  style={{ marginTop:'3px', width:'17px', height:'17px', accentColor:'var(--ember)', flexShrink:0 }}
                />
                <span style={{ fontSize:'13.5px', color:'var(--gray-600)', lineHeight:1.65 }}>
                  {rq.step4.consent}
                </span>
              </label>
              {errors.consent && <div className="form-error" style={{ marginTop:'8px' }}>{errors.consent}</div>}
            </FormGroup>

            {/* #67 — save-to-profile offer */}
            {showSaveProfile && (
              <div style={{
                marginTop:'16px', padding:'14px 16px',
                background:'var(--sky-2)', borderRadius:'8px',
                display:'flex', gap:'12px', alignItems:'center',
                border:'1px solid var(--hair)',
              }}>
                <span style={{ flex:1, fontSize:'13px', color:'var(--ink-2)' }}>
                  {s2.autoFill.saveToProfile}
                </span>
                <button className="btn btn-outline btn-sm" onClick={offerSaveProfile}
                  style={{ fontSize:'12.5px', padding:'6px 14px' }}>
                  {t.common.save}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowSaveProfile(false)}
                  style={{ fontSize:'12.5px', padding:'6px 10px' }}>
                  {t.common.cancel}
                </button>
              </div>
            )}
          </div>
        )}

        {/* NAV BUTTONS */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'24px' }}>
          {step > 1 ? (
            <button className="btn btn-outline" onClick={() => setStep(s => s - 1)} disabled={submitting}>
              <BackArrow size={16} /> {rq.nav.back}
            </button>
          ) : <div />}
          <button
            className="btn btn-primary btn-lg"
            onClick={goNext}
            disabled={submitting}
          >
            {step === 4 ? (
              submitting
                ? <>{t.common.loading}</>
                : <><CheckCircle size={16} /> {rq.nav.submit}</>
            ) : (
              <>{rq.nav.next} <NextArrow size={16} /></>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
