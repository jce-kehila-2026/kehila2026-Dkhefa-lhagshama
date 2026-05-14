import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
const useNavigate = () => {
  const router = useRouter()
  return (to) => router.push(to)
}
import { CheckCircle, Copy, ArrowLeft, ArrowRight, GraduationCap, Briefcase, Scale, Users, Printer } from 'lucide-react'
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
import { apiFetch } from '../lib/apiClient'

const CATS = [
  { key:'education',  Icon: GraduationCap, bg:'#EBF3FF', color:'#1A5EA0' },
  { key:'employment', Icon: Briefcase,     bg:'#E8F5EC', color:'#15803D' },
  { key:'legal',      Icon: Scale,         bg:'#FBF0C8', color:'#7C5F00' },
  { key:'social',     Icon: Users,         bg:'#F5EBF8', color:'#6D28D9' },
]

export default function RequestsPage() {
  const { t, isRTL, lang } = useLanguage()
  const { toast } = useApp()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const router = useRouter()
  const BackArrow  = isRTL ? ArrowRight : ArrowLeft
  const NextArrow  = isRTL ? ArrowLeft  : ArrowRight

  const [step, setStep] = useState(1)
  const [trackingId, setTrackingId] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [idUploaded, setIdUploaded] = useState(false)
  const [supportUploaded, setSupportUploaded] = useState(false)
  // Storage paths of uploaded files (UC-01-b). Built up as files complete;
  // sent to POST /api/requests as `attachmentPaths`.
  const [idPath, setIdPath] = useState('')
  const [supportPath, setSupportPath] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // requestId is generated once per form session. Used as the Firestore doc id
  // (so duplicate POST attempts collide loudly) and as the Storage path prefix
  // for file uploads (UC-01-b).
  const requestId = useMemo(() => {
    if (typeof window === 'undefined' || !window.crypto?.randomUUID) return null
    return window.crypto.randomUUID()
  }, [])

  // Auth guard — if signed out, send to /login with a next= back to here.
  // The early-return below the form definition stops the form rendering
  // for a frame between the redirect being scheduled and the navigation
  // committing.
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?next=${encodeURIComponent('/requests')}`)
    }
  }, [authLoading, user, router])

  // Map the UI's short gender codes (M/F/O) to the backend's canonical
  // enum (male/female/other). The backend (UC-01-c) is the source of truth
  // for the request-doc schema; the UI happens to use shorter codes.
  const GENDER_MAP = { M: 'male', F: 'female', O: 'other', '': '' }
  const toCanonicalGender = (g) => GENDER_MAP[g] ?? ''

  const rq = t.request
  const steps = [rq.steps.personal, rq.steps.type, rq.steps.documents, rq.steps.confirm]

  const { values, errors, touched, handleChange, setValue, setFieldErrors } = useForm({
    firstName:'', lastName:'', idNumber:'', phone:'', email:'',
    city:'', age:'', gender:'',
    category:'', description:'', urgency:'low',
    consent: false,
  })

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

  const submitForm = async () => {
    if (submitting || !requestId) return
    setSubmitting(true)
    try {
      const payload = {
        requestId,
        firstName: values.firstName,
        lastName:  values.lastName,
        idNumber:  values.idNumber,
        phone:     values.phone,
        email:     values.email,
        city:      values.city,
        age:       Number(values.age) || 0,
        gender:    toCanonicalGender(values.gender),
        category:  values.category,
        description: values.description,
        urgency:   values.urgency,
        consent:   values.consent === true,
        // Storage paths of uploaded attachments (UC-01-b).
        attachmentPaths: [idPath, supportPath].filter(Boolean),
      }
      const res = await apiFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let detail = ''
        try { detail = JSON.stringify(await res.json()) } catch { /* noop */ }
        throw new Error(`submit_failed: ${res.status} ${detail}`)
      }
      const body = await res.json()
      setTrackingId(body.requestId || requestId)
      setSubmitted(true)
      toast(lang === 'he' ? 'הבקשה נשלחה בהצלחה!' : 'Request submitted successfully!', 'success')
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

  // ── AUTH GATE ─────────────────────────────────────────────
  // While auth is still resolving, or after we've determined the user is
  // signed out, render nothing so the form is never visible to a
  // signed-out caller (the useEffect above is already scheduling the
  // redirect; this just avoids the one-frame flash).
  if (authLoading || !user) {
    return (
      <div className="page-container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ color: 'var(--gray-500)' }}>{t.common.loading}</div>
      </div>
    )
  }

  // ── SUCCESS SCREEN ────────────────────────────────────────
  if (submitted) {
    return (
      <>
        <PageHeader title={rq.pageTitle} subtitle={rq.pageSubtitle} />
        <div className="page-container" style={{ maxWidth:'580px', padding:'56px 1.5rem' }}>
          <div className="card" style={{ padding:'48px 40px', textAlign:'center' }}>
            <div style={{
              width:'72px', height:'72px',
              background:'var(--gold-pale)',
              borderRadius:'50%',
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 20px',
            }}>
              <CheckCircle size={34} color="var(--gold)" />
            </div>
            <h2 style={{ fontFamily:'Frank Ruhl Libre, serif', fontSize:'26px', fontWeight:900, color:'var(--navy)', marginBottom:'12px' }}>
              {rq.success.title}
            </h2>
            <p style={{ color:'var(--gray-500)', fontSize:'15px', marginBottom:'24px', lineHeight:1.7 }}>
              {rq.success.subtitle}
            </p>

            {/* Tracking number */}
            <div style={{
              background:'var(--navy)', color:'#fff',
              padding:'14px 28px', borderRadius:'10px',
              display:'inline-flex', alignItems:'center', gap:'12px',
              fontFamily:'monospace', fontSize:'20px', letterSpacing:'2px',
              marginBottom:'28px',
            }}>
              {trackingId}
              <button onClick={handleCopy} style={{
                background:'rgba(255,255,255,0.15)', border:'none',
                borderRadius:'6px', padding:'5px', cursor:'pointer',
                display:'flex', color:'#fff',
              }}>
                <Copy size={15} />
              </button>
            </div>

            <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                {rq.success.backHome}
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/track')}>
                {rq.success.trackBtn}
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── FORM CARD WRAPPER ─────────────────────────────────────
  const cardStyle = { background:'var(--white)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow)', border:'1px solid var(--gray-200)', padding:'36px' }

  return (
    <>
      <PageHeader title={rq.pageTitle} subtitle={rq.pageSubtitle} />
      <div className="page-container" style={{ maxWidth:'780px', padding:'48px 1.5rem 72px' }}>
        <StepIndicator steps={steps} currentStep={step} />

        {/* STEP 1 */}
        {step === 1 && (
          <div style={cardStyle}>
            <h3 style={{ fontSize:'19px', fontWeight:700, color:'var(--navy)', marginBottom:'26px' }}>{rq.step1.title}</h3>
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
            <FormRow>
              <FormGroup>
                <Label htmlFor="idNumber" required>{rq.step1.idNumber}</Label>
                <Input id="idNumber" name="idNumber" value={values.idNumber} onChange={handleChange}
                  placeholder={rq.step1.idPH} maxLength={9} error={errors.idNumber} />
              </FormGroup>
              <FormGroup>
                <Label htmlFor="phone" required>{rq.step1.phone}</Label>
                <Input id="phone" name="phone" type="tel" value={values.phone} onChange={handleChange}
                  placeholder={rq.step1.phonePH} error={errors.phone} />
              </FormGroup>
            </FormRow>
            <FormGroup>
              <Label htmlFor="email" required>{rq.step1.email}</Label>
              <Input id="email" name="email" type="email" value={values.email} onChange={handleChange}
                placeholder={rq.step1.emailPH} error={errors.email} />
            </FormGroup>
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
                    border:`1.5px solid ${values.gender === val ? 'var(--navy)' : 'var(--gray-200)'}`,
                    background: values.gender === val ? '#EBF0FA' : 'var(--white)',
                    cursor:'pointer', fontSize:'13.5px', transition:'all .18s',
                  }}>
                    <input type="radio" name="gender" value={val}
                      checked={values.gender === val}
                      onChange={handleChange}
                      style={{ accentColor:'var(--navy)' }} />
                    {label}
                  </label>
                ))}
              </div>
            </FormGroup>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={cardStyle}>
            <h3 style={{ fontSize:'19px', fontWeight:700, color:'var(--navy)', marginBottom:'6px' }}>{rq.step2.title}</h3>
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
                    style={{
                      border: selected ? '2px solid var(--navy)' : '2px solid var(--gray-200)',
                    }}
                  >
                    <div style={{ width:'38px', height:'38px', borderRadius:'8px', background:bg, color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <strong style={{ display:'block', fontSize:'14px', color:'var(--navy)', marginBottom:'2px' }}>{cat.label}</strong>
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
            <FormGroup>
              <Label htmlFor="urgency">{rq.step2.urgency}</Label>
              <Select id="urgency" name="urgency" value={values.urgency} onChange={handleChange}>
                <option value="low">{rq.step2.urgencyLow}</option>
                <option value="medium">{rq.step2.urgencyMed}</option>
                <option value="high">{rq.step2.urgencyHigh}</option>
              </Select>
            </FormGroup>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={cardStyle}>
            <h3 style={{ fontSize:'19px', fontWeight:700, color:'var(--navy)', marginBottom:'6px' }}>{rq.step3.title}</h3>
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
                  setSupportUploaded(!!r)
                  setSupportPath(r?.path || '')
                }}
              />
            </FormGroup>
            <div style={{
              marginTop:'16px', padding:'14px 16px',
              background:'var(--gray-50)', borderRadius:'8px',
              display:'flex', gap:'8px', alignItems:'flex-start',
              border:'1px solid var(--gray-200)',
            }}>
              <span style={{ fontSize:'16px' }}>🔒</span>
              <p style={{ fontSize:'12.5px', color:'var(--gray-500)', lineHeight:1.6 }}>{rq.step3.security}</p>
            </div>
          </div>
        )}

        {/* STEP 4 — SUMMARY */}
        {step === 4 && (
          <div style={cardStyle}>
            <h3 style={{ fontSize:'19px', fontWeight:700, color:'var(--navy)', marginBottom:'22px' }}>{rq.step4.title}</h3>
            <div style={{
              background:'var(--gray-50)', borderRadius:'10px',
              border:'1px solid var(--gray-200)',
              padding:'22px', marginBottom:'26px',
            }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px 20px' }}>
                {[
                  [rq.step4.fullName,    `${values.firstName} ${values.lastName}`],
                  [rq.step4.phone,       values.phone],
                  [rq.step4.city,        values.city],
                  [rq.step4.category,    values.category ? rq.step2.cats[values.category]?.label : '—'],
                  [rq.step4.urgency,     values.urgency === 'high' ? rq.step2.urgencyHigh : values.urgency === 'medium' ? rq.step2.urgencyMed : rq.step2.urgencyLow],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize:'12px', color:'var(--gray-400)', marginBottom:'2px' }}>{label}</div>
                    <div style={{ fontSize:'14px', fontWeight:600, color:'var(--navy)' }}>{val || '—'}</div>
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
                  style={{ marginTop:'3px', width:'17px', height:'17px', accentColor:'var(--navy)', flexShrink:0 }}
                />
                <span style={{ fontSize:'13.5px', color:'var(--gray-600)', lineHeight:1.65 }}>
                  {rq.step4.consent}
                </span>
              </label>
              {errors.consent && <div className="form-error" style={{ marginTop:'8px' }}>{errors.consent}</div>}
            </FormGroup>
          </div>
        )}

        {/* NAV BUTTONS */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'24px' }}>
          {step > 1 ? (
            <button className="btn btn-outline" onClick={() => setStep(s => s - 1)}>
              <BackArrow size={16} /> {rq.nav.back}
            </button>
          ) : <div />}
          <button
            className="btn btn-navy btn-lg"
            onClick={goNext}
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