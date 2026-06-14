import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import type { ChangeEvent } from 'react'
import { useRouter } from 'next/router'
const useNavigate = () => {
  const router = useRouter()
  return (to: string) => router.push(to)
}

// The intake form's field set (shape of `useForm` values for this page).
interface RequestFormValues {
  firstName: string; lastName: string;
  idType: string; idNumber: string; idNote: string;
  phone: string; email: string;
  city: string; age: string; gender: string;
  category: string; description: string; urgency: string;
  deadline: string;
  consent: boolean;
}

import { CheckCircle, ArrowLeft, ArrowRight, GraduationCap, Briefcase, Scale, Users, AlertTriangle, ShieldCheck, Sparkles, Clock, Lock, Home, HeartPulse, HeartHandshake, Globe, HandHeart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Reveal from '../components/motion/Reveal'
import SuggestCard from '@/components/SuggestCard'
import StepIndicator from '@/components/forms/StepIndicator'
import UploadArea from '@/components/forms/UploadArea'
import { FormGroup, Label, Input, Select, Textarea, FormRow } from '@/components/forms/FormElements'
import HelpTooltip from '@/components/feedback/HelpTooltip'
import { useLanguage } from '../contexts/LanguageContext'
import { useApp } from '../contexts/AppContext'
import { useAuth } from '../contexts/AuthContext'
import { sendEmailVerification } from 'firebase/auth' // #86
import { firebaseAuth } from '../lib/firebase' // #86
import { useForm } from '../hooks/useForm'
import { useCategories } from '../hooks/useCategories'
import { validateStep1, validateStep2, validateStep3, validateStep4 } from '../utils/validators'
import { apiFetch, apiJson } from '../lib/apiClient'
import type { Suggestion } from '@/types'

// ── Constants ──────────────────────────────────────────────────
// Category LIST comes from the admin-managed taxonomy (useCategories); only
// the per-tile icon/color treatment stays local, keyed by the well-known slug
// ids. Any id without an entry gets the neutral DEFAULT treatment so a brand
// new admin category still renders a coherent tile.
const CAT_STYLE: Record<string, { Icon: LucideIcon; bg: string; color: string }> = {
  education:  { Icon: GraduationCap, bg:'#EBF3FF', color:'#1A5EA0' },
  employment: { Icon: Briefcase,     bg:'#E8F5EC', color:'#15803D' },
  legal:      { Icon: Scale,         bg:'#FBF0C8', color:'#7C5F00' },
  social:     { Icon: Users,         bg:'#F5EBF8', color:'#6D28D9' },
  housing:    { Icon: Home,          bg:'#EBF3FF', color:'#1A5EA0' },
  health:     { Icon: HeartPulse,    bg:'#E8F5EC', color:'#15803D' },
  welfare:    { Icon: HeartHandshake,bg:'var(--ember-soft)', color:'var(--ember)' },
  community:  { Icon: Users,         bg:'#F5EBF8', color:'#6D28D9' },
  youth:      { Icon: Sparkles,      bg:'#FBF0C8', color:'#7C5F00' },
  absorption: { Icon: Globe,         bg:'#EBF3FF', color:'#1A5EA0' },
}
const DEFAULT_CAT_STYLE = { Icon: HandHeart, bg: 'var(--ember-soft)', color: 'var(--ember)' }

// localStorage key for draft persistence (#93)
const DRAFT_KEY = 'rq_draft_v1'

// sessionStorage key for the post-submit "save to profile" offer (#67).
// The submit redirect unmounts this page in the same tick, so any in-form
// offer could never render; instead the submitted personal fields are
// stashed here and MyRequestsPage shows the offer (and clears the stash on
// save or dismiss, so the details do not outlive the offer).
const SAVE_PROFILE_OFFER_KEY = 'pff:saveProfileOffer'

function loadDraft() {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage?.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveDraft(values: RequestFormValues) {
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
  // Admin-managed taxonomy: tile list + bilingual label resolution.
  const { categories, loading: catsLoading, labelFor, refresh: refreshCats } = useCategories()
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
  const [submitted, setSubmitted] = useState(false)
  const [idUploaded, setIdUploaded] = useState(false)
  const [idPath, setIdPath] = useState('')
  const [supportPath, setSupportPath] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // #67 — profile prefill state
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  // Canonical profile values as last loaded from the server — compared after
  // submit to decide whether the save-to-profile offer is worth stashing.
  const profileSnapshot = useRef<{
    firstName: string; lastName: string; phone: string;
    city: string; age: string; gender: string;
  } | null>(null)

  // Client-generated UUID — stable per form session (#93 + upload path prefix)
  const requestId = useMemo(() => {
    if (typeof window === 'undefined' || !window.crypto?.randomUUID) return null
    return window.crypto.randomUUID()
  }, [])

  const toCanonicalGender = useCallback((g: string) => {
    const GENDER_MAP: Record<string, string> = { M: 'male', F: 'female', O: 'other', '': '' }
    return GENDER_MAP[g] ?? ''
  }, [])

  const rq = t.request
  const s2 = t.stream2
  const steps = [rq.steps.personal, rq.steps.type, rq.steps.documents, rq.steps.confirm]

  // ── Form state (#93 draft) ────────────────────────────────────
  const draft = loadDraft()
  const { values, errors, handleChange, setValue, setFieldErrors } = useForm({
    firstName:'', lastName:'',
    idType: 'israeli_id', idNumber:'', idNote:'',
    phone:'', email:'',
    city:'', age:'', gender:'',
    category:'', description:'', urgency:'low',
    deadline: '',
    consent: false,
    ...(draft || {}),
  }) as unknown as {
    values: RequestFormValues
    errors: Record<string, string>
    handleChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void
    setValue: (name: string, value: string | boolean) => void
    setFieldErrors: (errs: Record<string, string>) => void
  }

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

  // Matching organizations (feedback round 2) — once a category is chosen in
  // step 2, fetch up to 3 approved community answers in that category from the
  // public suggestions endpoint and offer them inline under the tiles. Silent
  // on error or when empty. Keyed on `values.category` (not the click handler)
  // so a category restored from the draft on mount also triggers the fetch.
  // Dismissal is local and resets whenever the category changes.
  const [orgSuggestions, setOrgSuggestions] = useState<Suggestion[]>([])
  const [orgSuggestionsDismissed, setOrgSuggestionsDismissed] = useState(false)
  useEffect(() => {
    setOrgSuggestionsDismissed(false)
    if (!values.category) {
      setOrgSuggestions([])
      return
    }
    let alive = true
    apiJson<{ items?: Suggestion[] }>(`/api/suggestions?category=${encodeURIComponent(values.category)}`)
      .then((data) => { if (alive) setOrgSuggestions(Array.isArray(data.items) ? data.items : []) })
      .catch(() => { if (alive) setOrgSuggestions([]) })
    return () => { alive = false }
  }, [values.category])

  // Auth guard — redirect to login if not signed in (#93 — next= so draft is kept)
  // Grace window before redirecting on (authLoading=false, user=null): Firebase
  // can briefly emit a null user during a token refresh before re-emitting the
  // signed-in user, and redirecting on that transient null tore the beneficiary
  // out of the form mid step-transition. The draft is saved first either way so
  // nothing is lost; the timer is cancelled the moment the user reappears.
  useEffect(() => {
    if (!authLoading && !user) {
      saveDraft(values) // save before (possible) redirect so it's restored on return
      const handle = setTimeout(() => {
        router.replace(`/login?next=${encodeURIComponent('/requests')}`)
      }, 600)
      return () => clearTimeout(handle)
    }
  }, [authLoading, user, router, values])

  // A restored draft may carry a category an admin has since archived or
  // deleted. Once the taxonomy arrives, clear any value that is not an active
  // id so step-2 validation forces a re-pick — otherwise the stale id sails
  // through to submit, where the backend rejects it with a 400 the generic
  // toast cannot explain. (Skipped when the fetch failed: categories === [].)
  useEffect(() => {
    if (catsLoading || categories.length === 0) return
    if (values.category && !categories.some((c) => c.id === values.category)) {
      setValue('category', '')
    }
  }, [catsLoading, categories, values.category, setValue])

  // #67 — core profile loader. `announce` controls whether we surface a toast
  // (true for the explicit "auto-fill" button, false for the silent mount fill).
  // Note: this intentionally does NOT early-return on `profileLoaded` so the
  // button keeps working even after the silent mount fill already ran.
  const loadProfileInto = useCallback(async (announce: boolean) => {
    if (profileLoading || !user) return
    setProfileLoading(true)
    try {
      const data = await apiJson('/api/users/me') as {
        profile?: {
          firstName?: string; lastName?: string; phone?: string; city?: string;
          age?: string | number; gender?: string; email?: string;
        }
      }
      const p = data.profile || {}
      profileSnapshot.current = {
        firstName: p.firstName || '',
        lastName:  p.lastName  || '',
        phone:     p.phone     || '',
        city:      p.city      || '',
        age:       p.age ? String(p.age) : '',
        gender:    p.gender    || '',
      }
      let filledAny = false
      if (p.firstName)   { setValue('firstName', p.firstName); filledAny = true }
      if (p.lastName)    { setValue('lastName',  p.lastName);  filledAny = true }
      if (p.phone)       { setValue('phone',     p.phone);     filledAny = true }
      if (p.city)        { setValue('city',      p.city);      filledAny = true }
      if (p.age)         { setValue('age',       String(p.age)); filledAny = true }
      if (p.gender) {
        // Canonical gender from DB (male/female/other) → UI code (M/F/O)
        const reverseMap: Record<string, string> = { male:'M', female:'F', other:'O' }
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

  // ── Validation / navigation ─────────────────────────────────
  const goNext = () => {
    let errs: Record<string, string> = {}
    // The validators live in JS, so TS infers concrete (index-signature-free)
    // return shapes; assert to the `Record<string, string>` `setFieldErrors`
    // expects. Values are already validation message strings.
    if (step === 1) errs = validateStep1(values, t) as unknown as Record<string, string>
    if (step === 2) errs = validateStep2(values, t) as unknown as Record<string, string>
    if (step === 3) errs = validateStep3({ idUploaded }, t) as unknown as Record<string, string>
    if (step === 4) errs = validateStep4(values, t) as unknown as Record<string, string>

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      // a11y: move focus to the first invalid control so screen-reader and
      // keyboard users land on the problem (presentation-only; does not change
      // what is validated or submitted).
      if (typeof document !== 'undefined') {
        const firstKey = Object.keys(errs)[0]
        requestAnimationFrame(() => {
          const target = document.getElementById(firstKey)
            || document.querySelector<HTMLElement>(`[name="${firstKey}"]`)
            || document.querySelector<HTMLElement>('[aria-invalid="true"]')
          target?.focus?.()
        })
      }
      return
    }
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
        onBehalf:  role === 'volunteer',
      }
      const res = await apiFetch('/api/requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let body: { fieldErrors?: Record<string, unknown> } | null = null
        try { body = await res.json() } catch { /* noop */ }
        // #93 — 401 on submit → save draft + prompt re-login
        if (res.status === 401) {
          saveDraft(values)
          toast(s2.reloginPrompt, 'warning')
          router.push(`/login?next=${encodeURIComponent('/requests')}`)
          return
        }
        // Backend category validation (a draft-restored category can be
        // archived between save and submit) — send the user back to step 2
        // with a field error instead of a dead-end generic toast.
        if (res.status === 400 && body?.fieldErrors?.category) {
          setFieldErrors({ category: rq.step2.catsInvalid })
          setValue('category', '')
          setStep(2)
          return
        }
        throw new Error(`submit_failed: ${res.status} ${body ? JSON.stringify(body) : ''}`)
      }
      const body = await res.json()
      const newId = body.requestId || requestId
      clearDraft()
      setSubmitted(true)
      // #67 — stash the submitted personal fields so MyRequestsPage can offer
      // to save them to the profile (the redirect below unmounts this page in
      // the same tick, so no in-form offer can render). Stashed only when the
      // fields differ from the profile we loaded; cleared there on save or
      // dismiss to keep the details from outliving the offer.
      const offered = {
        firstName: values.firstName,
        lastName:  values.lastName,
        phone:     values.phone,
        city:      values.city,
        age:       values.age,
        gender:    toCanonicalGender(values.gender),
      }
      const snap = profileSnapshot.current
      const differs = !snap || (Object.keys(offered) as (keyof typeof offered)[])
        .some((k) => (offered[k] || '') !== (snap[k] || ''))
      if (differs) {
        // uid-bound: MyRequestsPage discards a stash written by another
        // account, so a previous user's PII can never surface after a switch.
        const stash = { uid: user?.uid ?? '', ...offered }
        try { window.sessionStorage?.setItem(SAVE_PROFILE_OFFER_KEY, JSON.stringify(stash)) } catch { /* noop */ }
      } else {
        // Nothing to offer — also drop any stale stash from an earlier
        // session/user instead of leaving it to resurface on /my-requests.
        try { window.sessionStorage?.removeItem(SAVE_PROFILE_OFFER_KEY) } catch { /* noop */ }
      }
      // #94 — replace route so back-button doesn't re-open the form
      router.replace(`/my-requests?new=${newId}`)
    } catch (err) {

      console.error('[RequestsPage] submit failed:', err)
      toast(lang === 'he' ? 'שליחת הבקשה נכשלה' : 'Submit failed — please try again.', 'error')
    } finally {
      setSubmitting(false)
    }
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
        {/* ── COMPACT INLINE HEADER — eyebrow → serif title → lede (start-aligned) ── */}
        <section className="req-header">
          <div className="page-container req-header-container">
            <Reveal>
              <div className="req-header-inner">
                <span className="eyebrow req-header-eyebrow">{rq.inlineHeader.eyebrow}</span>
                <h1 className="section-display-bold req-header-title">{rq.inlineHeader.title}</h1>
                <p className="section-lede req-header-lede">{rq.inlineHeader.lede}</p>
              </div>
            </Reveal>
          </div>
        </section>
        <div className="page-container req-admin-shell">
          <Reveal>
            <div className="card" style={{ padding:'clamp(32px, 5vw, 48px)', textAlign:'center', boxShadow:'var(--shadow-lg)' }}>
              <div aria-hidden="true" style={{
                width:'68px', height:'68px',
                background:'var(--ember-soft)',
                borderRadius:'var(--radius-lg)',
                display:'flex', alignItems:'center', justifyContent:'center',
                marginInline:'auto', marginBlockEnd:'var(--sp-5)',
              }}>
                <AlertTriangle size={30} color="var(--ember)" />
              </div>
              <h2 style={{
                fontFamily:'Frank Ruhl Libre, Georgia, serif',
                fontSize:'var(--fs-h2)', fontWeight:400, color:'var(--ink)',
                lineHeight:1.18, letterSpacing:'-0.01em', marginBlockEnd:'var(--sp-3)', textWrap:'balance',
              }}>
                {s2.adminNotice.title}
              </h2>
              <p style={{ color:'var(--gray-600)', fontSize:'var(--fs-body)', marginBlockEnd:'var(--sp-6)', lineHeight:1.7 }}>
                {s2.adminNotice.body}
              </p>
              <button className="btn btn-outline" onClick={() => navigate('/')}>
                {s2.adminNotice.switchBtn}
              </button>
            </div>
          </Reveal>
        </div>
      </>
    )
  }

  // #86 — t.auth.verifyBanner strings
  const vb = t.auth.verifyBanner

  // Reassurance items shown beneath the form — quiet, brand-aligned trust signals.
  const trustItems = [
    { Icon: Clock,       text: lang === 'he' ? 'נציג חוזר אליך תוך 48 שעות' : 'A representative replies within 48 hours' },
    { Icon: Lock,        text: lang === 'he' ? 'הפרטים שלך מאובטחים ומוצפנים' : 'Your details are encrypted and secure' },
    { Icon: ShieldCheck, text: lang === 'he' ? 'הטיוטה נשמרת אוטומטית' : 'Your draft is saved automatically' },
  ]

  return (
    <>
      {/* ── COMPACT INLINE HEADER — eyebrow → serif title → lede + step indicator (start-aligned) ── */}
      <section className="req-header">
        <div className="page-container req-header-container">
          <Reveal>
            <div className="req-header-inner">
              <span className="eyebrow req-header-eyebrow">{rq.inlineHeader.eyebrow}</span>
              <h1 className="section-display-bold req-header-title">{rq.inlineHeader.title}</h1>
              <p className="section-lede req-header-lede">{rq.inlineHeader.lede}</p>
            </div>
          </Reveal>
          <div className="req-header-stepper">
            <StepIndicator steps={steps} currentStep={step} progressLabel={rq.progressLabel} />
          </div>
        </div>
      </section>

      <div className="page-container req-shell">
        {/* #86 — email-not-verified banner; shown only when user is signed in but unverified */}
        {!emailVerified && (
          <div className="form-banner form-banner-info req-banner" role="status">
            <AlertTriangle size={16} aria-hidden="true" />
            <span className="req-banner-text">{vb.text}</span>
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

        {/* FEATURE 1 — volunteer on-behalf banner */}
        {role === 'volunteer' && (
          <div className="form-banner form-banner-info req-banner" role="status">
            <Users size={16} aria-hidden="true" />
            <span className="req-banner-text">{rq.onBehalf.banner}</span>
          </div>
        )}

        <Reveal>
        <div className="card" style={{ overflow:'hidden', boxShadow:'var(--shadow-lg)' }}>
          <div className="card-body" style={{ padding:'clamp(24px, 4vw, 40px)' }}>

        {/* STEP 1 — PERSONAL DETAILS */}
        {step === 1 && (
          <div className="req-step" key="step1">
            <div className="req-step-head req-step-head--split">
              <div style={{ minWidth:0 }}>
                <span className="eyebrow req-step-eyebrow">
                  {lang === 'he' ? `שלב 1 מתוך 4` : `Step 1 of 4`}
                </span>
                <h2 className="req-step-title">{role === 'volunteer' ? rq.onBehalf.step1Title : rq.step1.title}</h2>
              </div>
              {/* #67 — auto-fill button */}
              <button
                type="button"
                className={`btn btn-ghost btn-sm req-fill-btn${profileLoading ? ' is-loading' : ''}`}
                onClick={fillFromProfile}
                disabled={profileLoading}
                aria-busy={profileLoading}
              >
                <Sparkles size={14} aria-hidden="true" /> {s2.autoFill.fillBtn}
              </button>
            </div>

            <FormRow>
              <FormGroup>
                <Label htmlFor="firstName" required>{rq.step1.firstName}</Label>
                <Input id="firstName" name="firstName" value={values.firstName} onChange={handleChange}
                  autoComplete="given-name" aria-invalid={!!errors.firstName}
                  placeholder={rq.step1.firstNamePH} error={errors.firstName} />
              </FormGroup>
              <FormGroup>
                <Label htmlFor="lastName" required>{rq.step1.lastName}</Label>
                <Input id="lastName" name="lastName" value={values.lastName} onChange={handleChange}
                  autoComplete="family-name" aria-invalid={!!errors.lastName}
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
                  inputMode="numeric" autoComplete="off" spellCheck={false} aria-invalid={!!errors.idNumber}
                  placeholder={rq.step1.idPH} maxLength={9} error={errors.idNumber} />
              </FormGroup>
            )}

            {(values.idType === 'passport' || values.idType === 'none') && (
              <FormRow>
                {values.idType === 'passport' && (
                  <FormGroup>
                    <Label htmlFor="idNumber">{rq.step1.idNumber}</Label>
                    <Input id="idNumber" name="idNumber" value={values.idNumber} onChange={handleChange}
                      autoComplete="off" spellCheck={false} aria-invalid={!!errors.idNumber}
                      placeholder={rq.step1.passportPH} maxLength={40} error={errors.idNumber} />
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
                  inputMode="tel" autoComplete="tel" aria-invalid={!!errors.phone}
                  placeholder={rq.step1.phonePH} error={errors.phone} />
              </FormGroup>
              <FormGroup>
                <Label htmlFor="email" required>{rq.step1.email}</Label>
                <Input id="email" name="email" type="email" value={values.email} onChange={handleChange}
                  inputMode="email" autoComplete="email" spellCheck={false} aria-invalid={!!errors.email}
                  placeholder={rq.step1.emailPH} error={errors.email}
                  hint={s2.autoFill.emailNote} />
              </FormGroup>
            </FormRow>

            <FormRow>
              <FormGroup>
                <Label htmlFor="city" required>{rq.step1.city}</Label>
                <Select id="city" name="city" value={values.city} onChange={handleChange}
                  autoComplete="address-level2" aria-invalid={!!errors.city} error={errors.city}>
                  <option value="">{lang === 'he' ? 'בחר עיר…' : 'Select city…'}</option>
                  {rq.cities.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FormGroup>
              <FormGroup>
                <Label htmlFor="age">{rq.step1.age}</Label>
                <Input id="age" name="age" type="number" value={values.age} onChange={handleChange}
                  inputMode="numeric" autoComplete="off"
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
          <div className="req-step" key="step2">
            <span className="eyebrow req-step-eyebrow">
              {lang === 'he' ? `שלב 2 מתוך 4` : `Step 2 of 4`}
            </span>
            <h2 className="req-step-title">{rq.step2.title}</h2>
            <p className="req-step-intro">{rq.step2.subtitle}</p>
            <div
              id="category"
              className="choice-grid"
              role="radiogroup"
              aria-label={rq.step2.title}
              aria-invalid={!!errors.category}
              aria-describedby={errors.category ? 'category-error' : undefined}
              tabIndex={errors.category ? -1 : undefined}
              style={{ marginBottom:'24px' }}
            >
              {catsLoading
                ? // Brief skeleton tiles while the taxonomy loads — same grid
                  // cell footprint as a tile, so there is no layout jump.
                  [0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className="skeleton"
                      style={{ minHeight:'76px', borderRadius:'var(--radius-lg)' }}
                      aria-hidden="true"
                    />
                  ))
                : categories.map(({ id }) => {
                    const { Icon, bg, color } = CAT_STYLE[id] ?? DEFAULT_CAT_STYLE
                    // Labels come from the category doc (labelFor); the legacy
                    // static map only still contributes the optional hint line.
                    const hint = (rq.step2.cats as Record<string, { label?: string; hint?: string }>)[id]?.hint
                    const selected = values.category === id
                    return (
                      <button
                        key={id}
                        type="button"
                        className="choice-tile"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setValue('category', id)}
                      >
                        <span className="choice-tile-icon" aria-hidden="true" style={{ background:bg, color }}>
                          <Icon size={20} />
                        </span>
                        <span style={{ minWidth:0 }}>
                          <span className="choice-tile-title">{labelFor(id)}</span>
                          {hint && <span className="choice-tile-hint">{hint}</span>}
                        </span>
                      </button>
                    )
                  })}
            </div>
            {errors.category && <div id="category-error" role="alert" className="form-error" style={{ marginBottom:'14px' }}>{errors.category}</div>}

            {/* Taxonomy failed to load (backend down / unseeded): without
                tiles step 2 is a dead end, so surface the failure + a retry
                (useCategories never caches failures, so retry refetches). */}
            {!catsLoading && categories.length === 0 && (
              <div className="form-banner form-banner-info" role="alert" style={{ marginBottom:'24px' }}>
                <AlertTriangle size={16} aria-hidden="true" />
                <span style={{ flex:1 }}>{rq.step2.catsLoadError}</span>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => refreshCats()}>
                  {rq.step2.catsRetry}
                </button>
              </div>
            )}

            {/* Matching organizations helper — community answers in the chosen category */}
            {!orgSuggestionsDismissed && orgSuggestions.length > 0 && (
              <Reveal>
                <SuggestCard
                  items={orgSuggestions}
                  lang={lang}
                  heading={rq.step2.suggestHeading}
                  subtitle={rq.step2.suggestSubtitle}
                  openLabel={t.myRequests.suggest.open}
                  callLabel={t.directory.modal.call}
                  emailLabel={t.directory.modal.email}
                  directoryLabel={t.myRequests.suggest.directory}
                  dismissLabel={t.myRequests.suggest.dismiss}
                  onDismiss={() => setOrgSuggestionsDismissed(true)}
                />
              </Reveal>
            )}

            {/* Link to the full directory, pre-filtered by the chosen category —
                gated on orgSuggestions.length > 0 so it only renders when the
                category actually has at least one matching organization
                (suggestions query both org types). This stops the CTA from
                promising "all organizations that can help" and then landing the
                beneficiary on an empty directory for categories with no orgs
                (e.g. absorption/youth in the current dataset). No `tab` param:
                DirectoryPage picks whichever org tab holds the category. */}
            {values.category && orgSuggestions.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginBottom:'24px' }}
                onClick={() => navigate(`/directory?category=${encodeURIComponent(values.category)}`)}
              >
                {rq.step2.seeAllOrgs} · {labelFor(values.category)}
                <NextArrow size={14} aria-hidden="true" />
              </button>
            )}

            <FormGroup>
              <Label htmlFor="description" required>{rq.step2.description}</Label>
              <Textarea id="description" name="description" value={values.description}
                onChange={handleChange} placeholder={rq.step2.descPH}
                rows={4} aria-invalid={!!errors.description} error={errors.description} />
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
          <div className="req-step" key="step3">
            <span className="eyebrow req-step-eyebrow">
              {lang === 'he' ? `שלב 3 מתוך 4` : `Step 3 of 4`}
            </span>
            <h2 className="req-step-title">{rq.step3.title}</h2>
            <p className="req-step-intro">{rq.step3.subtitle}</p>
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
          <div className="req-step" key="step4">
            <span className="eyebrow req-step-eyebrow">
              {lang === 'he' ? `שלב 4 מתוך 4` : `Step 4 of 4`}
            </span>
            <h2 className="req-step-title" style={{ marginBlockEnd:'var(--sp-5)' }}>{rq.step4.title}</h2>
            <div className="review-panel" style={{ marginBottom:'24px' }}>
              <dl className="review-grid">
                {[
                  [rq.step4.fullName,  `${values.firstName} ${values.lastName}`],
                  [rq.step4.phone,     values.phone],
                  [rq.step4.city,      values.city],
                  [rq.step4.category,  values.category ? labelFor(values.category) : '—'],
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
                  aria-invalid={!!errors.consent}
                  aria-describedby={errors.consent ? 'consent-error' : undefined}
                />
                <span>{rq.step4.consent}</span>
              </label>
              {errors.consent && <div id="consent-error" role="alert" className="form-error" style={{ marginTop:'8px' }}>{errors.consent}</div>}
            </FormGroup>
          </div>
        )}

          </div>
        </div>
        </Reveal>

        {/* NAV BUTTONS */}
        <div className="req-nav">
          {step > 1 ? (
            <button className="btn btn-outline" onClick={() => setStep(s => s - 1)} disabled={submitting}>
              <BackArrow size={16} aria-hidden="true" /> {rq.nav.back}
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
              <><CheckCircle size={16} aria-hidden="true" /> {rq.nav.submit}</>
            ) : (
              <>{rq.nav.next} <NextArrow size={16} aria-hidden="true" /></>
            )}
          </button>
        </div>

        {/* Quiet reassurance strip — sets expectations and signals trust. */}
        <Reveal delay={0.1}>
          <ul className="req-trust">
            {trustItems.map(({ Icon, text }, i) => (
              <li key={i} className="req-trust-item">
                <span className="req-trust-icon" aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className="req-trust-text">{text}</span>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </>
  )
}
